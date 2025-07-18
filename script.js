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
    if (cached && state.isOnline) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < ttl) return data;
    }
    
    try {
        const response = await retryRequest(() => fetch(url), state.retryCount, state.retryDelay);
        if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);
        const data = await response.json();
        localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
        return data;
    } catch (error) {
        console.error('Fetch error:', error);
        throw error;
    }
}

async function retryRequest(fn, maxRetries, delay) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
            showNotification(`Reintentando... (${i+1}/${maxRetries})`, 'info', 2000);
        }
    }
}

// Data Fetching
async function loadData() {
    if (!state.isOnline) {
        showNotification('Sin conexión: mostrando datos almacenados', 'error', 5000);
        updateUIWithCachedData();
        return;
    }
    
    showLoading('Conectando con CryptoCompare API...', 0);
    try {
        updateLoadingProgress(20);
        const change24h = await fetchCurrentPrice();
        updateLoadingProgress(50);
        await fetchHistoricalData();
        updateLoadingProgress(80);
        const { rsi, volatility } = calculatePrediction(change24h);
        updatePredictionDetails(rsi, volatility);
        initChart();
        showNotification('Datos actualizados con éxito', 'success', 3000);
    } catch (error) {
        console.error('Error loading data:', error);
        showNotification(`Error: ${error.message}`, 'error', 5000);
        document.getElementById('chart-error').textContent = error.message;
        document.getElementById('chart-error').style.display = 'block';
        updateUIWithCachedData();
    } finally {
        updateLoadingProgress(100);
        setTimeout(hideLoading, 500);
    }
}

function updateUIWithCachedData() {
    const cachedPrice = localStorage.getItem(`burex_${state.currentCurrency}_currentPrice`);
    const cachedHistory = localStorage.getItem(`burex_${state.currentCurrency}_historicalData_${state.currentTimeframe}`);
    
    if (cachedPrice) {
        const { data } = JSON.parse(cachedPrice);
        state.currentPrice = data.RAW[state.currentCurrency].USD.PRICE;
        state.currentPriceTimestamp = new Date(data.timestamp);
        document.getElementById('current-price').textContent = `$${state.currentPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
        
        const change24h = data.RAW[state.currentCurrency].USD.CHANGEPCT24HOUR || 0;
        const changeElement = document.getElementById('price-change');
        changeElement.textContent = `${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}% (24h)`;
        changeElement.style.color = change24h >= 0 ? 'var(--success)' : 'var(--error)';
    }
    
    if (cachedHistory) {
        state.historicalData = JSON.parse(cachedHistory).data.Data.Data.map(item => ({
            x: new Date(item.time * 1000),
            y: item.close
        }));
        document.getElementById('data-points').textContent = `${state.historicalData.length} puntos`;
        initChart();
    }
    
    updatePredictionDetails();
}

async function fetchCurrentPrice() {
    const cacheKey = `burex_${state.currentCurrency}_currentPrice`;
    const url = `https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${state.currentCurrency}&tsyms=USD`;
    
    try {
        const data = await fetchWithCache(url, cacheKey);
        if (!data.RAW?.[state.currentCurrency]?.USD) throw new Error('Datos de precio no disponibles');
        
        state.currentPrice = data.RAW[state.currentCurrency].USD.PRICE;
        state.currentPriceTimestamp = new Date();
        
        document.getElementById('current-price').textContent = `$${state.currentPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
        
        const change24h = data.RAW[state.currentCurrency].USD.CHANGEPCT24HOUR || 0;
        const changeElement = document.getElementById('price-change');
        changeElement.textContent = `${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}% (24h)`;
        changeElement.style.color = change24h >= 0 ? 'var(--success)' : 'var(--error)';
        
        return change24h;
    } catch (error) {
        console.error('Error fetching current price:', error);
        throw error;
    }
}

async function fetchHistoricalData() {
    const cacheKey = `burex_${state.currentCurrency}_historicalData_${state.currentTimeframe}`;
    const interval = state.currentTimeframe === '7' ? 'hour' : 'day';
    let limit;
    
    switch(state.currentTimeframe) {
        case '7': limit = 168; break;
        case '15': limit = 15; break;
        case '30': limit = 30; break;
        case '90': limit = 90; break;
        case '180': limit = 180; break;
        default: limit = 168;
    }
    
    const url = `https://min-api.cryptocompare.com/data/v2/histo${interval}?fsym=${state.currentCurrency}&tsym=USD&limit=${limit}`;
    
    try {
        const data = await fetchWithCache(url, cacheKey);
        if (!data.Data?.Data?.length) throw new Error('No se recibieron datos de precios');
        
        state.historicalData = data.Data.Data
            .filter(item => item.close > 0)
            .map(item => ({
                x: new Date(item.time * 1000),
                y: item.close
            }));
        
        if (state.currentPrice && state.currentPriceTimestamp) {
            const lastDataPoint = state.historicalData[state.historicalData.length - 1]?.x;
            if (lastDataPoint && state.currentPriceTimestamp > lastDataPoint) {
                state.historicalData.push({
                    x: state.currentPriceTimestamp,
                    y: state.currentPrice
                });
            }
            state.historicalData.sort((a, b) => a.x - b.x);
        }
        
        document.getElementById('data-points').textContent = `${state.historicalData.length} puntos`;
    } catch (error) {
        console.error('Error fetching historical data:', error);
        throw error;
    }
}

// Prediction Logic
function calculateRSI(data, period = 14) {
    if (data.length < period + 1) return 50;
    
    const closes = data.map(d => d.y);
    let gains = 0, losses = 0;
    
    for (let i = 1; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff >= 0) gains += diff;
        else losses -= diff;
    }
    
    const avgGain = gains / period;
    const avgLoss = Math.abs(losses) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

function calculateVolatility(data, period = 30) {
    if (data.length < period) return 0;
    
    const prices = data.slice(-period).map(d => d.y);
    const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
    return Math.sqrt(variance) / mean * 100; // Volatilidad como % de la media
}

function linearRegression(data) {
    if (data.length < 2) return { slope: 0, intercept: 0 };
    
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    const n = data.length;
    
    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += data[i];
        sumXY += i * data[i];
        sumXX += i * i;
    }
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    return { slope, intercept };
}

function calculateEMA(period, data) {
    if (data.length < period) return null;
    
    let ema = [];
    const k = 2 / (period + 1);
    
    // SMA para el primer valor
    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += data[i];
    }
    ema[period - 1] = sum / period;
    
    // EMA para el resto
    for (let i = period; i < data.length; i++) {
        ema[i] = (data[i] - ema[i - 1]) * k + ema[i - 1];
    }
    
    return ema[ema.length - 1];
}

function calculatePrediction(change24h) {
    if (!state.currentPrice || state.historicalData.length < 14) {
        state.predictedPrice = null;
        return { rsi: null, volatility: null };
    }
    
    // 1. Calcular momentum mediante regresión lineal
    const shortTerm = Math.max(3, Math.floor(state.historicalData.length * 0.2));
    const shortTermData = state.historicalData.slice(-shortTerm).map(d => d.y);
    const { slope } = linearRegression(shortTermData);
    const momentum = slope / state.currentPrice;
    
    // 2. Calcular RSI con ajuste continuo
    const rsi = calculateRSI(state.historicalData);
    const rsiFactor = 1 + (50 - rsi) * 0.005;
    
    // 3. Calcular volatilidad
    const volatility = calculateVolatility(state.historicalData);
    state.volatility = volatility;
    const volatilityFactor = volatility > 30 ? 0.95 : volatility < 10 ? 1.05 : 1;
    
    // 4. Identificar niveles de Fibonacci mediante clustering
    const maxPrice = Math.max(...state.historicalData.map(d => d.y));
    const minPrice = Math.min(...state.historicalData.map(d => d.y));
    
    // Retrocesos y extensiones de Fibonacci
    const fibLevels = [
        0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.414, 1.618, 2, 2.618
    ];
    
    const fibPrices = fibLevels.map(level => 
        minPrice + (maxPrice - minPrice) * level
    );
    
    const priceRange = maxPrice - minPrice;
    const detectionThreshold = Math.max(priceRange * 0.025, 100);
    const detectedLevels = fibPrices.filter(level => 
        Math.abs(state.currentPrice - level) < detectionThreshold
    ).length;
    
    // 5. Factor de niveles de Fibonacci
    const levelFactor = 1 + (detectedLevels * 0.04);
    
    // 6. EMA para tendencia primaria
    const prices = state.historicalData.map(d => d.y);
    const ema50 = calculateEMA(50, prices);
    const ema200 = calculateEMA(200, prices);
    let emaFactor = 1;
    let emaTrend = 'Neutral';
    
    if (ema50 && ema200) {
        if (ema50 > ema200) {
            emaFactor = 1.02;
            emaTrend = 'Alcista';
        } else {
            emaFactor = 0.98;
            emaTrend = 'Bajista';
        }
    }
    state.emaTrend = emaTrend;
    
    // 7. Factor de temporalidad
    const timeframeFactor = 1 + (parseInt(state.currentTimeframe) / 100);
    
    // 8. Impulso áureo
    const goldenMomentum = (momentum * state.goldenRatio * 100);
    
    // 9. Calcular predicción
    state.predictedPrice = state.currentPrice * 
        (1 + momentum * state.goldenRatio * timeframeFactor) * 
        rsiFactor * 
        levelFactor * 
        volatilityFactor * 
        emaFactor;
    
    // 10. Calcular nivel de confianza
    const historicalAccuracy = calculateHistoricalAccuracy();
    state.confidenceLevel = Math.min(100, Math.max(0, 
        historicalAccuracy * 
        (1 - volatility / 100) * 
        (1 + detectedLevels * 0.08) * 
        (emaFactor === 1 ? 1 : 1.05)
    ));
    
    // Logging para depuración
    console.log('Prediction Details:', {
        momentum: momentum.toFixed(4),
        rsi: rsi.toFixed(2),
        volatility: volatility.toFixed(2),
        detectedLevels,
        levelFactor: levelFactor.toFixed(2),
        timeframeFactor: timeframeFactor.toFixed(2),
        goldenMomentum: goldenMomentum.toFixed(2),
        predictedPrice: state.predictedPrice.toFixed(2),
        confidence: state.confidenceLevel.toFixed(2)
    });
    
    document.getElementById('golden-momentum').textContent = `${goldenMomentum.toFixed(2)}%`;
    document.getElementById('fib-levels').textContent = `${detectedLevels}/12 niveles detectados`;
    document.getElementById('rsi-value').textContent = `${rsi.toFixed(2)}`;
    document.getElementById('volatility').textContent = `${volatility.toFixed(2)}%`;
    document.getElementById('ema-trend').textContent = emaTrend;
    document.getElementById('ema-trend').style.color = emaTrend === 'Alcista' ? 'var(--ema-bullish)' : 
                                                      emaTrend === 'Bajista' ? 'var(--ema-bearish)' : 'var(--text)';
    
    return { rsi, volatility };
}

function updatePredictionDetails(rsi = null, volatility = null) {
    if (state.predictionHistory.length > 0) {
        const accuracy = calculateHistoricalAccuracy();
        document.getElementById('accuracy-rate').textContent = `${accuracy.toFixed(2)}%`;
        
        const accuracyBar = document.getElementById('accuracy-bar-fill');
        accuracyBar.style.width = `${Math.min(100, Math.max(0, accuracy))}%`;
        accuracyBar.style.background = accuracy > 70 ? 'var(--confidence-high)' : 
                                       accuracy > 50 ? 'var(--confidence-medium)' : 'var(--confidence-low)';
    }
    
    if (state.predictedPrice !== null) {
        document.getElementById('prediction-price').textContent = `$${state.predictedPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
    }
    
    if (rsi !== null) {
        document.getElementById('rsi-value').textContent = `${rsi.toFixed(2)}`;
    }
    
    if (volatility !== null) {
        document.getElementById('volatility').textContent = `${volatility.toFixed(2)}%`;
    }
    
    if (state.confidenceLevel !== null) {
        const confidenceText = `Confianza: ${state.confidenceLevel.toFixed(2)}%`;
        const confidenceElement = document.getElementById('confidence-level');
        confidenceElement.textContent = confidenceText;
        confidenceElement.className = 'confidence-indicator ' + 
            (state.confidenceLevel > 70 ? 'confidence-high' : 
             state.confidenceLevel > 50 ? 'confidence-medium' : 'confidence-low');
    }
}

function calculateHistoricalAccuracy() {
    if (state.predictionHistory.length < 2) return 0;
    
    let accuracySum = 0;
    let validEntries = 0;
    
    for (let i = 0; i < state.predictionHistory.length - 1; i++) {
        const prediction = state.predictionHistory[i];
        const nextData = state.predictionHistory[i + 1];
        
        if (prediction.timeframe === nextData.timeframe) {
            const priceDiff = Math.abs(prediction.predictedPrice - nextData.actualPrice);
            const accuracy = (1 - (priceDiff / prediction.predictedPrice)) * 100;
            
            if (!isNaN(accuracy)) {
                accuracySum += Math.max(0, accuracy);
                validEntries++;
            }
        }
    }
    
    return validEntries > 0 ? accuracySum / validEntries : 0;
}

// Chart Initialization
function initChart() {
    const ctx = document.getElementById('price-chart');
    const chartError = document.getElementById('chart-error');
    
    if (state.priceChart) {
        state.priceChart.destroy();
        state.priceChart = null;
    }
    
    if (!state.historicalData || state.historicalData.length < 2) {
        chartError.textContent = 'No hay suficientes datos para mostrar el gráfico';
        chartError.style.display = 'block';
        return;
    }
    
    try {
        const values = state.historicalData.map(d => d.y).filter(y => !isNaN(y) && y > 0);
        if (values.length === 0) {
            chartError.textContent = 'Datos de precios inválidos';
            chartError.style.display = 'block';
            return;
        }
        
        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);
        const range = maxValue - minValue;
        
        const allValues = state.predictedPrice ? [...values, state.predictedPrice] : values;
        const minBound = Math.min(...allValues) - range * 0.05;
        const maxBound = Math.max(...allValues) + range * 0.05;
        
        let predictionData = [];
        let annotations = [];
        
        if (state.currentPrice && state.currentPriceTimestamp && state.predictedPrice) {
            const futureDate = new Date(state.currentPriceTimestamp);
            const daysToAdd = parseInt(state.currentTimeframe);
            futureDate.setDate(futureDate.getDate() + daysToAdd);
            
            predictionData = [
                { x: state.currentPriceTimestamp, y: state.currentPrice },
                { x: futureDate, y: state.predictedPrice }
            ];
            
            annotations.push({
                type: 'line',
                mode: 'horizontal',
                scaleID: 'y',
                value: state.predictedPrice,
                borderColor: 'var(--chart-prediction)',
                borderWidth: 2,
                borderDash: [5, 5],
                label: {
                    display: true,
                    content: `PREDICCIÓN: $${state.predictedPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })} (Confianza: ${state.confidenceLevel.toFixed(2)}%)`,
                    backgroundColor: state.confidenceLevel > 70 ? 'var(--confidence-high)' : 
                                    state.confidenceLevel > 50 ? 'var(--confidence-medium)' : 'var(--confidence-low)',
                    font: { size: 12, weight: 'bold' },
                    color: '#ffffff',
                    position: 'end',
                    yAdjust: state.predictedPrice > state.currentPrice ? -10 : 10
                }
            });
        }
        
        // Calcular niveles de Fibonacci
        const maxPrice = Math.max(...state.historicalData.map(d => d.y));
        const minPrice = Math.min(...state.historicalData.map(d => d.y));
        
        const fibLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.414, 1.618, 2, 2.618];
        fibLevels.forEach(level => {
            const fibValue = minPrice + (maxPrice - minPrice) * level;
            annotations.push({
                type: 'line',
                mode: 'horizontal',
                scaleID: 'y',
                value: fibValue,
                borderColor: 'var(--chart-fib)',
                borderWidth: 1,
                borderDash: [3, 3],
                label: {
                    display: true,
                    content: `${(level * 100).toFixed(1)}%: $${fibValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    font: { size: 10 },
                    color: '#ffffff',
                    position: 'start',
                    yAdjust: level % 0.5 === 0 ? -10 : 10
                }
            });
        });
        
        const historicalPredictions = state.predictionHistory.map(prediction => {
            const predictionDate = new Date(prediction.timestamp);
            const resultDate = new Date(prediction.timestamp);
            resultDate.setDate(resultDate.getDate() + parseInt(prediction.timeframe));
            
            return {
                x: resultDate,
                y: prediction.actualPrice,
                prediction: prediction.predictedPrice,
                timestamp: prediction.timestamp,
                confidence: prediction.confidence
            };
        });
        
        state.priceChart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: 'Precio Real',
                        data: state.historicalData,
                        borderColor: 'var(--chart-line)',
                        backgroundColor: 'rgba(0, 0, 0, 0.05)',
                        borderWidth: 2,
                        pointRadius: 0,
                        fill: true,
                        tension: 0.1
                    },
                    {
                        label: 'Predicción Áurea',
                        data: predictionData,
                        borderColor: 'var(--chart-prediction)',
                        borderWidth: 3,
                        borderDash: [5, 5],
                        pointRadius: 0,
                        fill: false,
                        tension: 0
                    },
                    {
                        label: 'Predicciones Pasadas',
                        data: historicalPredictions,
                        pointBackgroundColor: historicalPredictions.map(p => 
                            p.confidence > 70 ? 'var(--confidence-high)' : 
                            p.confidence > 50 ? 'var(--confidence-medium)' : 'var(--confidence-low)'
                        ),
                        pointBorderColor: '#ffffff',
                        pointRadius: 6,
                        pointHoverRadius: 8,
                        showLine: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: 'var(--text)',
                            font: { size: 12 }
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'var(--card-bg)',
                        titleColor: 'var(--text)',
                        bodyColor: 'var(--text)',
                        borderColor: 'var(--border)',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                if (context.parsed.y !== null) {
                                    label += `$${context.parsed.y.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
                                }
                                
                                if (context.datasetIndex === 2) {
                                    const dataPoint = historicalPredictions[context.dataIndex];
                                    const predictionDate = new Date(dataPoint.timestamp).toLocaleDateString();
                                    label += `\nPredicho: $${dataPoint.prediction.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
                                    label += `\nConfianza: ${dataPoint.confidence.toFixed(2)}%`;
                                    label += `\nFecha predicción: ${predictionDate}`;
                                }
                                
                                return label;
                            }
                        }
                    },
                    annotation: {
                        annotations
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: state.currentTimeframe === '7' ? 'hour' : 'day',
                            tooltipFormat: state.currentTimeframe === '7' ? 'MMM dd HH:mm' : 'MMM dd',
                            displayFormats: {
                                day: 'MMM dd',
                                hour: 'HH:mm'
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            color: 'var(--text-light)',
                            maxTicksLimit: state.currentTimeframe === '7' ? 12 : 10
                        }
                    },
                    y: {
                        position: 'right',
                        min: minBound,
                        max: maxBound,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            color: 'var(--text-light)',
                            callback: function(value) {
                                return '$' + value.toLocaleString('en-US', { maximumFractionDigits: 0 });
                            },
                            maxTicksLimit: 8
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                },
                hover: {
                    mode: 'nearest',
                    intersect: false
                }
            }
        });
        
        chartError.style.display = 'none';
    } catch (error) {
        console.error('Error initializing chart:', error);
        chartError.textContent = 'Error al crear el gráfico: ' + error.message;
        chartError.style.display = 'block';
    }
}

// Export Data
function exportData() {
    if (!state.historicalData.length) {
        showNotification('No hay datos para exportar', 'error', 3000);
        return;
    }
    
    const csv = [
        ['Fecha', 'Precio (USD)', 'Predicción (USD)', 'Confianza (%)'],
        ...state.historicalData.map((d, i) => {
            const prediction = state.predictionHistory.find(p => 
                new Date(p.timestamp).toISOString().split('T')[0] === d.x.toISOString().split('T')[0]
            );
            
            return [
                d.x.toISOString(),
                d.y.toFixed(2),
                prediction ? prediction.predictedPrice.toFixed(2) : '',
                prediction ? prediction.confidence.toFixed(2) : ''
            ];
        })
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, `${state.currentCurrency}_historical_data_${new Date().toISOString().split('T')[0]}.csv`);
    showNotification('Datos exportados como CSV', 'success', 3000);
}

// UI Helpers
function showNotification(message, type = 'info', duration = 3000) {
    const notification = document.getElementById('notification');
    const messageElement = document.getElementById('notification-message');
    
    notification.className = `notification show ${type}`;
    messageElement.textContent = message;
    
    setTimeout(() => notification.classList.remove('show'), duration);
}

function showLoading(message, progress) {
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    
    loadingOverlay.classList.add('active');
    loadingText.textContent = message;
    updateLoadingProgress(progress);
}

function updateLoadingProgress(value) {
    document.getElementById('loading-progress').value = value;
}

function hideLoading() {
    document.getElementById('loading-overlay').classList.remove('active');
}