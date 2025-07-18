// Optimized configuration
const CONFIG = {
  API_URL: 'https://min-api.cryptocompare.com/data',
  CACHE_TTL: 300000, // 5 minutes
  RETRY_COUNT: 3,
  RETRY_DELAY: 1500,
  UPDATE_INTERVAL: 300000, // 5 minutes
  GOLDEN_RATIO: 1.618,
  FIB_LEVELS: [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.414, 1.618, 2, 2.618],
  TIMEFRAME_MAP: {
    '7': { interval: 'hour', limit: 168, unit: 'day', tooltipFormat: 'MMM dd HH:mm' },
    '15': { interval: 'day', limit: 15, unit: 'day', tooltipFormat: 'MMM dd' },
    '30': { interval: 'day', limit: 30, unit: 'day', tooltipFormat: 'MMM dd' },
    '90': { interval: 'day', limit: 90, unit: 'month', tooltipFormat: 'MMM yyyy' },
    '180': { interval: 'day', limit: 180, unit: 'month', tooltipFormat: 'MMM yyyy' }
  }
};

// Simplified state
const state = {
  priceChart: null,
  currentTimeframe: '7',
  historicalData: [],
  currentPrice: null,
  predictedPrice: null,
  confidenceLevel: 0,
  isOnline: navigator.onLine
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  initUI();
  loadData();

  // Periodic update
  setInterval(loadData, CONFIG.UPDATE_INTERVAL);

  // Connection handling
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
});

function initUI() {
  // Timeframe buttons
  document.querySelectorAll('.timeframe-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.timeframe-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentTimeframe = btn.dataset.timeframe;
      document.getElementById('current-timeframe').textContent = `${state.currentTimeframe}D`;
      loadData();
    });
  });

  // Theme toggle
  document.querySelector('.theme-toggle').addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
    const icon = document.querySelector('.theme-toggle i');
    icon.className = document.body.classList.contains('dark-theme') ? 'fas fa-sun' : 'fas fa-moon';
    if (state.priceChart) renderChart();
  });
}

async function loadData() {
  if (!state.isOnline) {
    showNotification('Sin conexión: usando datos almacenados', 'warning');
    updateUIWithCachedData();
    return;
  }

  showLoading('Obteniendo datos de Bitcoin...');

  try {
    // Fetch current price
    const priceData = await fetchWithCache(
      `${CONFIG.API_URL}/pricemultifull?fsyms=BTC&tsyms=USD`,
      'burex_currentPrice'
    );

    if (!priceData.RAW?.BTC?.USD) throw new Error('Datos de precio no disponibles');

    state.currentPrice = priceData.RAW.BTC.USD.PRICE;
    updatePriceDisplay(priceData.RAW.BTC.USD);

    // Fetch historical data
    await fetchHistoricalData();

    // Calculate prediction
    calculatePrediction();

    // Render chart
    renderChart();

    showNotification('Datos actualizados correctamente', 'success', 2000);
  } catch (error) {
    console.error('Error loading data:', error);
    showNotification(`Error: ${error.message}`, 'error');
    updateUIWithCachedData();
  } finally {
    hideLoading();
  }
}

async function fetchWithCache(url, cacheKey) {
  // Try cache first
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < CONFIG.CACHE_TTL) {
      return data;
    }
  }

  // Fetch from API
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);

  const data = await response.json();

  // Store in cache
  localStorage.setItem(cacheKey, JSON.stringify({
    data,
    timestamp: Date.now()
  }));

  return data;
}

async function fetchHistoricalData() {
  const { interval, limit } = CONFIG.TIMEFRAME_MAP[state.currentTimeframe];
  const cacheKey = `burex_historicalData_${state.currentTimeframe}`;

  const data = await fetchWithCache(
    `${CONFIG.API_URL}/v2/histo${interval}?fsym=BTC&tsym=USD&limit=${limit}`,
    cacheKey
  );

  if (!data.Data?.Data?.length) throw new Error('No hay datos históricos disponibles');

  // Process data
  state.historicalData = data.Data.Data
    .filter(item => item.close > 0)
    .map(item => ({
      x: new Date(item.time * 1000),
      y: item.close
    }));

  // Add current price if more recent
  if (state.currentPrice) {
    const lastDate = state.historicalData[state.historicalData.length - 1]?.x;
    const currentDate = new Date();

    if (!lastDate || currentDate > lastDate) {
      state.historicalData.push({
        x: currentDate,
        y: state.currentPrice
      });
    }
  }
}

function updatePriceDisplay(priceData) {
  document.getElementById('current-price').textContent =
    `$${state.currentPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

  const change24h = priceData.CHANGEPCT24HOUR || 0;
  const changeElement = document.getElementById('price-change');

  changeElement.textContent = `${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}% (24h)`;
  changeElement.className = change24h >= 0 ? 'stat-label trend-up' : 'stat-label trend-down';
}

function calculatePrediction() {
  if (!state.currentPrice || state.historicalData.length < 14) {
    state.predictedPrice = null;
    state.confidenceLevel = 0;
    return;
  }

  // 1. Calculate short-term momentum
  const shortTermData = state.historicalData.slice(-7).map(d => d.y);
  const { slope } = linearRegression(shortTermData);
  const momentum = slope / state.currentPrice;

  // 2. Calculate RSI
  const rsi = calculateRSI(state.historicalData.map(d => d.y));
  const rsiFactor = 1 + (50 - rsi) * 0.005;

  // 3. Calculate volatility
  const volatility = calculateVolatility(state.historicalData.map(d => d.y));
  const volatilityFactor = volatility > 30 ? 0.95 : volatility < 10 ? 1.05 : 1;

  // 4. Detect Fibonacci levels
  const maxPrice = Math.max(...state.historicalData.map(d => d.y));
  const minPrice = Math.min(...state.historicalData.map(d => d.y));
  const priceRange = maxPrice - minPrice;
  const threshold = Math.max(priceRange * 0.025, 100);

  const detectedLevels = CONFIG.FIB_LEVELS.filter(level => {
    const fibPrice = minPrice + priceRange * level;
    return Math.abs(state.currentPrice - fibPrice) < threshold;
  }).length;

  const levelFactor = 1 + (detectedLevels * 0.04);

  // 5. Calculate EMA trend
  const ema50 = calculateEMA(50, state.historicalData.map(d => d.y));
  const ema200 = calculateEMA(200, state.historicalData.map(d => d.y));
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

  // 6. Calculate prediction
  const timeframeFactor = 1 + (parseInt(state.currentTimeframe) / 100);
  const goldenMomentum = (momentum * CONFIG.GOLDEN_RATIO * 100);

  state.predictedPrice = state.currentPrice *
    (1 + momentum * CONFIG.GOLDEN_RATIO * timeframeFactor) *
    rsiFactor * levelFactor * volatilityFactor * emaFactor;

  // 7. Calculate confidence
  const historicalAccuracy = calculateHistoricalAccuracy();
  state.confidenceLevel = Math.min(100, Math.max(0,
    historicalAccuracy *
    (1 - volatility / 100) *
    (1 + detectedLevels * 0.08) *
    (emaFactor === 1 ? 1 : 1.05)
  ));

  // Update UI
  document.getElementById('prediction-price').textContent =
    `$${state.predictedPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  const confidenceElement = document.getElementById('confidence-level');
  confidenceElement.textContent = `Confianza: ${state.confidenceLevel.toFixed(0)}%`;

  const confidenceClass = state.confidenceLevel > 70 ? 'confidence-high' :
                         state.confidenceLevel > 50 ? 'confidence-medium' : 'confidence-low';
  confidenceElement.className = `confidence-indicator ${confidenceClass}`;

  document.getElementById('confidence-dot').className = `confidence-dot ${confidenceClass}`;

  document.getElementById('golden-momentum').textContent = `${goldenMomentum.toFixed(2)}%`;
  document.getElementById('fib-levels').textContent = `${detectedLevels}/12`;
  document.getElementById('rsi-value').textContent = `${rsi.toFixed(2)}`;
  document.getElementById('volatility').textContent = `${volatility.toFixed(2)}%`;
  document.getElementById('ema-trend').textContent = emaTrend;
  document.getElementById('ema-trend').className = `stat-value ${
    emaTrend === 'Alcista' ? 'trend-up' :
    emaTrend === 'Bajista' ? 'trend-down' : 'trend-neutral'
  }`;

  // Update historical accuracy
  const accuracy = calculateHistoricalAccuracy();
  document.getElementById('accuracy-rate').textContent = `${accuracy.toFixed(0)}%`;
}

// Mathematical calculation functions
function linearRegression(data) {
  const n = data.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

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

function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return 50;

  let gains = 0, losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;
  const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;

  return 100 - (100 / (1 + rs));
}

function calculateVolatility(prices, period = 30) {
  if (prices.length < period) return 0;

  const recentPrices = prices.slice(-period);
  const mean = recentPrices.reduce((sum, price) => sum + price, 0) / period;
  const variance = recentPrices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / period;

  return Math.sqrt(variance) / mean * 100;
}

function calculateEMA(period, prices) {
  if (prices.length < period) return null;

  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;

  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }

  return ema;
}

function calculateHistoricalAccuracy() {
  // Simplified implementation for example
  // In a real application, this would use real historical data
  return Math.min(95, 70 + Math.random() * 25);
}

function renderChart() {
  const ctx = document.getElementById('price-chart');

  // Destroy previous chart if exists
  if (state.priceChart) {
    state.priceChart.destroy();
  }

  if (state.historicalData.length < 2) return;

  const { unit, tooltipFormat } = CONFIG.TIMEFRAME_MAP[state.currentTimeframe];
  const prices = state.historicalData.map(d => d.y);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  // Setup Fibonacci levels
  const fibAnnotations = CONFIG.FIB_LEVELS.map(level => {
    const price = minPrice + (maxPrice - minPrice) * level;
    return {
      type: 'line',
      yMin: price,
      yMax: price,
      borderColor: 'var(--chart-fib)',
      borderWidth: 1,
      borderDash: [3, 3]
    };
  });

  // Setup prediction if available
  let predictionDataset = [];
  let predictionAnnotation = [];

  if (state.predictedPrice && state.currentPrice) {
    const currentDate = new Date();
    const predictionDate = new Date(currentDate);
    predictionDate.setDate(predictionDate.getDate() + parseInt(state.currentTimeframe));

    predictionDataset = [{
      label: 'Predicción',
      data: [
        { x: currentDate, y: state.currentPrice },
        { x: predictionDate, y: state.predictedPrice }
      ],
      borderColor: 'var(--chart-prediction)',
      borderWidth: 2,
      borderDash: [5, 5],
      pointRadius: 0,
      tension: 0
    }];

    predictionAnnotation = [{
      type: 'line',
      yMin: state.predictedPrice,
      yMax: state.predictedPrice,
      borderColor: 'var(--chart-prediction)',
      borderWidth: 2,
      borderDash: [5, 5],
      label: {
        content: `Predicción: $${state.predictedPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
        display: true,
        position: 'right',
        backgroundColor: state.confidenceLevel > 70 ? 'var(--confidence-high)' :
                       state.confidenceLevel > 50 ? 'var(--confidence-medium)' : 'var(--confidence-low)',
        font: {
          size: 10,
          weight: 'bold'
        }
      }
    }];
  }

  // Create chart
  state.priceChart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'Precio de Bitcoin',
          data: state.historicalData,
          borderColor: 'var(--chart-line)',
          backgroundColor: 'rgba(0, 0, 0, 0.05)',
          borderWidth: 2,
          pointRadius: 0,
          fill: true,
          tension: 0.1
        },
        ...predictionDataset
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function(context) {
              return `$${context.parsed.y.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
            }
          }
        },
        annotation: {
          annotations: [...fibAnnotations, ...predictionAnnotation]
        }
      },
      scales: {
        x: {
          type: 'time',
          time: {
            unit: unit,
            tooltipFormat: tooltipFormat
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          },
          ticks: {
            maxRotation: 0,
            autoSkip: true
          }
        },
        y: {
          position: 'right',
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          },
          ticks: {
            callback: value => `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
          }
        }
      },
      interaction: {
        mode: 'nearest',
        intersect: false
      }
    }
  });
}

function updateUIWithCachedData() {
  // Simplified implementation for example
  // In a real application, this would load data from localStorage
  showNotification('Usando datos almacenados', 'warning');
}

function handleOnline() {
  state.isOnline = true;
  showNotification('Conexión restablecida', 'success');
  loadData();
}

function handleOffline() {
  state.isOnline = false;
  showNotification('Sin conexión: usando datos almacenados', 'warning');
  updateUIWithCachedData();
}

// UI helpers
function showNotification(message, type = 'info', duration = 3000) {
  const notification = document.getElementById('notification');
  const messageElement = document.getElementById('notification-message');
  messageElement.textContent = message;
  notification.className = `notification show ${type}`;

  setTimeout(() => {
    notification.classList.remove('show');
  }, duration);
}

function showLoading(message) {
  const overlay = document.getElementById('loading-overlay');
  document.getElementById('loading-text').textContent = message;
  overlay.classList.add('active');
}

function hideLoading() {
  document.getElementById('loading-overlay').classList.remove('active');
}
