// Configuration
const CONFIG = {
    // Real API endpoint
    API_ENDPOINT: 'https://api.headout.com/api/v7/tour-groups/16818/calendar/',
    
    // Number of days to fetch (7 for 7-day lookahead)
    DAYS_AHEAD: 7,
    
    // Refresh interval in milliseconds (12 hours)
    REFRESH_INTERVAL: 12 * 60 * 60 * 1000,
    
    // Currency symbol
    CURRENCY_SYMBOL: '£'
};

// Global variables
let refreshTimer = null;
let currentPriceData = null;

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    const dayOptions = { weekday: 'short' };
    const dateOptions = { day: '2-digit', month: 'short' };
    
    return {
        day: date.toLocaleDateString('en-US', dayOptions),
        date: date.toLocaleDateString('en-US', dateOptions),
        full: date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    };
}

function formatPrice(price) {
    return `${CONFIG.CURRENCY_SYMBOL}${price.toFixed(2)}`;
}

function generateNext7Days() {
    const dates = [];
    const today = new Date();
    
    for (let i = 0; i < CONFIG.DAYS_AHEAD; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        dates.push(date.toISOString().split('T')[0]);
    }
    
    return dates;
}

function filterNext7Days(apiData) {
    const next7Days = generateNext7Days();
    const filteredData = { dates: {} };
    
    // Only include dates that are in our next 7 days
    next7Days.forEach(date => {
        if (apiData.dates && apiData.dates[date]) {
            filteredData.dates[date] = apiData.dates[date];
        }
    });
    
    return filteredData;
}

function findCheapestDate(priceData) {
    let cheapestDate = null;
    let cheapestPrice = Infinity;
    
    Object.keys(priceData.dates).forEach(date => {
        const data = priceData.dates[date];
        if (data.availableTourIds && data.availableTourIds.length > 0) {
            const totalPrice = data.isPricingInclusiveOfExtraCharges 
                ? data.listingPrice 
                : data.listingPrice + (data.extraCharges || 0);
            
            if (totalPrice < cheapestPrice) {
                cheapestPrice = totalPrice;
                cheapestDate = date;
            }
        }
    });
    
    return { date: cheapestDate, price: cheapestPrice };
}

// API functions
async function fetchPriceData() {
    try {
        const response = await fetch(CONFIG.API_ENDPOINT, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Filter to only include the next 7 days
        const filteredData = filterNext7Days(data);
        return filteredData;
        
    } catch (error) {
        console.error('Error fetching price data:', error);
        
        // Fallback to mock data for testing
        console.log('Falling back to mock data for testing...');
        return generateMockData();
    }
}

// Mock data generator for testing (fallback when API fails)
function generateMockData() {
    const dates = generateNext7Days();
    const mockData = { dates: {} };
    
    dates.forEach(date => {
        const basePrice = 43.75; // GBP base price
        const variation = (Math.random() - 0.5) * 20; // ±10 GBP variation
        const price = Math.max(20, Math.round((basePrice + variation) * 100) / 100);
        
        mockData.dates[date] = {
            primaryPax: "ADULT",
            listingPrice: price,
            retailPrice: price,
            extraCharges: Math.random() > 0.8 ? Math.round(Math.random() * 10 * 100) / 100 : 0,
            isPricingInclusiveOfExtraCharges: false,
            availableTourIds: Math.random() > 0.1 ? [4700] : [],
            discountAvailable: Math.random() > 0.7
        };
    });
    
    return mockData;
}

// UI functions
function showLoadingState() {
    document.getElementById('loadingState').style.display = 'flex';
    document.getElementById('errorState').style.display = 'none';
    document.getElementById('priceBarContainer').style.display = 'none';
}

function showErrorState() {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('errorState').style.display = 'flex';
    document.getElementById('priceBarContainer').style.display = 'none';
}

function showPriceBar() {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('errorState').style.display = 'none';
    document.getElementById('priceBarContainer').style.display = 'block';
}

function createPriceItem(date, priceData, isCheapest = false) {
    const dateInfo = formatDate(date);
    const isAvailable = priceData.availableTourIds && priceData.availableTourIds.length > 0;
    const totalPrice = priceData.isPricingInclusiveOfExtraCharges 
        ? priceData.listingPrice 
        : priceData.listingPrice + (priceData.extraCharges || 0);
    
    const classes = [
        'price-item',
        isAvailable ? 'available' : 'unavailable',
        isCheapest && isAvailable ? 'cheapest' : '',
        priceData.discountAvailable ? 'discount-available' : ''
    ].filter(Boolean).join(' ');
    
    return `
        <div class="${classes}" data-date="${date}" data-price="${totalPrice}">
            <div class="date-header">
                <div class="date-day">${dateInfo.day}</div>
                <div class="date-full">${dateInfo.date}</div>
            </div>
            
            <div class="price-display">
                <div class="price-amount">${formatPrice(totalPrice)}</div>
                <div class="price-currency">per adult</div>
            </div>
            
            <div class="availability-status ${isAvailable ? 'available' : 'unavailable'}">
                ${isAvailable ? 'Available' : 'Sold Out'}
            </div>
        </div>
    `;
}

function updateCheapestIndicator(cheapestInfo) {
    const indicator = document.getElementById('cheapestIndicator');
    const dateElement = document.getElementById('cheapestDate');
    const priceElement = document.getElementById('cheapestPrice');
    
    if (cheapestInfo.date) {
        const dateInfo = formatDate(cheapestInfo.date);
        dateElement.textContent = `${dateInfo.day}, ${dateInfo.date}`;
        priceElement.textContent = formatPrice(cheapestInfo.price);
        indicator.style.display = 'block';
    } else {
        indicator.style.display = 'none';
    }
}

function renderPriceData(data) {
    currentPriceData = data;
    const priceBar = document.getElementById('priceBar');
    const dates = Object.keys(data.dates).sort();
    
    // Find cheapest date
    const cheapestInfo = findCheapestDate(data);
    
    let itemsHTML = '';
    dates.forEach(date => {
        const isCheapest = date === cheapestInfo.date;
        itemsHTML += createPriceItem(date, data.dates[date], isCheapest);
    });
    
    priceBar.innerHTML = itemsHTML;
    
    // Update cheapest indicator for mobile
    updateCheapestIndicator(cheapestInfo);
    
    // Update last updated timestamp
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
    });
    const dateString = now.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });
    document.getElementById('lastUpdated').textContent = `Last updated: ${dateString} at ${timeString}`;
    
    showPriceBar();
}

// Main function to load price data
async function loadPriceData() {
    showLoadingState();
    
    try {
        const data = await fetchPriceData();
        renderPriceData(data);
        
        // Set up auto-refresh
        if (refreshTimer) {
            clearTimeout(refreshTimer);
        }
        refreshTimer = setTimeout(loadPriceData, CONFIG.REFRESH_INTERVAL);
        
    } catch (error) {
        console.error('Failed to load price data:', error);
        showErrorState();
    }
}

// Add click handlers for price items (for potential future interactions)
function addPriceItemClickHandlers() {
    document.addEventListener('click', function(e) {
        const priceItem = e.target.closest('.price-item');
        if (priceItem && priceItem.classList.contains('available')) {
            const date = priceItem.dataset.date;
            const price = priceItem.dataset.price;
            console.log(`Clicked on ${date} with price ${price}`);
            // Future: Add booking functionality here
        }
    });
}

// Initialize the widget when the page loads
document.addEventListener('DOMContentLoaded', function() {
    loadPriceData();
    addPriceItemClickHandlers();
});

// Handle page visibility changes to pause/resume auto-refresh
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        // Page is hidden, clear the timer
        if (refreshTimer) {
            clearTimeout(refreshTimer);
            refreshTimer = null;
        }
    } else {
        // Page is visible again, restart auto-refresh
        if (!refreshTimer) {
            refreshTimer = setTimeout(loadPriceData, CONFIG.REFRESH_INTERVAL);
        }
    }
});

// Clean up timer when page unloads
window.addEventListener('beforeunload', function() {
    if (refreshTimer) {
        clearTimeout(refreshTimer);
    }
});

// Expose loadPriceData globally for manual refresh
window.loadPriceData = loadPriceData;

