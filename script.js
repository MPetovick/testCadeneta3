// State
const state = {
    priceChart: null,
    currentTimeframe: '7',
    currentCurrency: 'BTC',
    historicalData: [],
    predictedPrice: null,
    currentPrice: null,
    currentPriceTimestamp: null,
    predictionHistory: [],
    goldenRatio: 1.618,
    maxHistorySize: 100,
    isOnline: navigator.onLine,
    retryCount: 3,
    retryDelay: 1500,
    confidenceLevel: 0,
    volatility: 0,
    emaTrend: null
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initUI();
    loadData();
    setInterval(loadData, 300000); // Actualizar cada 5 minutos
    
    window.addEventListener('online', () => {
        state.isOnline = true;
        showNotification('Conexión restablecida, cargando datos...', 'success', 3000);
        loadData();
    });
    
    window.addEventListener('offline', () => {
        state.isOnline = false;
        showNotification('Sin conexión: usando datos almacenados', 'error', 5000);
        updateUIWithCachedData();
    });
});

// UI Initialization
function initUI() {
    initTimeframeButtons();
    initRefreshButton();
    initThemeToggle();
    initNotification();
    initCurrencySelector();
    initExportButton();
    updateCurrencyName();
    loadCachedHistory();
}

function initTimeframeButtons() {
    document.querySelectorAll('.timeframe-btn').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.timeframe-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            state.currentTimeframe = button.dataset.timeframe;
            document.getElementById('current-timeframe').textContent = `${state.currentTimeframe}D`;
            loadData();
        });
        
        button.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                button.click();
            }
        });
    });
}

function initRefreshButton() {
    const refreshBtn = document.querySelector('.refresh-btn');
    refreshBtn.addEventListener('click', debounce(loadData, 1000));
    
    refreshBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            refreshBtn.click();
        }
    });
}

function initThemeToggle() {
    const toggle = document.querySelector('.theme-toggle');
    toggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        toggle.innerHTML = `<i class="fas fa-${document.body.classList.contains('dark-theme') ? 'sun' : 'moon'}" aria-hidden="true"></i>`;
        if (state.priceChart) {
            initChart();
        }
    });
    
    toggle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle.click();
        }
    });
}

function initNotification() {
    const closeBtn = document.querySelector('.close-btn');
    closeBtn.addEventListener('click', () => {
        document.getElementById('notification').classList.remove('show');
    });
    
    closeBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            closeBtn.click();
        }
    });
}

function initCurrencySelector() {
    const selector = document.getElementById('currency-selector');
    selector.addEventListener('change', (e) => {
        state.currentCurrency = e.target.value;
        updateCurrencyName();
        loadCachedHistory();
        loadData();
    });
}

function initExportButton() {
    const exportBtn = document.querySelector('.export-btn');
    exportBtn.addEventListener('click', exportData);
    
    exportBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            exportBtn.click();
        }
    });
}

function updateCurrencyName() {
    const name = state.currentCurrency === 'BTC' ? 'Bitcoin' : 
                 state.currentCurrency === 'ETH' ? 'Ethereum' : 'Ripple';
    document.getElementById('currency-name').textContent = name;
    document.getElementById('currency-name-chart').textContent = name;
}

function loadCachedHistory() {
    state.predictionHistory = JSON.parse(localStorage.getItem(`burexPredictorHistory_${state.currentCurrency}`)) || [];
}

// Utilities
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

async function fetchWithCache(url, cacheKey, ttl = 300000) {
    const cached = localStorage.getItem(cacheKey);
    if 