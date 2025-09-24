// Global variables
let ws = null;
let reconnectAttempts = 0;
let maxReconnectAttempts = 5;
let reconnectDelay = 1000;
let isConnected = false;
let currentTimeframe = '5m';
let allSymbols = [];
let coinData = new Map();
let historicalData = new Map();
let lastUpdateTime = null;

// DOM elements
const connectionStatus = document.getElementById('connectionStatus');
const connectionText = document.getElementById('connectionText');
const totalPairsElement = document.getElementById('totalPairs');
const bullishCountElement = document.getElementById('bullishCount');
const bearishCountElement = document.getElementById('bearishCount');
const potentialCountElement = document.getElementById('potentialCount');
const lastUpdateElement = document.getElementById('lastUpdate');
const loadingState = document.getElementById('loadingState');
const noResultsState = document.getElementById('noResultsState');
const coinsGrid = document.getElementById('coinsGrid');
const timeframeSelect = document.getElementById('timeframe');
const refreshBtn = document.getElementById('refreshBtn');
const crossTypeFilter = document.getElementById('crossTypeFilter');
const volumeFilter = document.getElementById('volumeFilter');
const searchFilter = document.getElementById('searchFilter');
const clearFiltersBtn = document.getElementById('clearFilters');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
});

function initializeApp() {
    console.log('Initializing Binance Market Watch...');
    fetchAllUSDTSymbols();
}

function setupEventListeners() {
    timeframeSelect.addEventListener('change', handleTimeframeChange);
    refreshBtn.addEventListener('click', handleRefresh);
    crossTypeFilter.addEventListener('change', applyFilters);
    volumeFilter.addEventListener('input', debounce(applyFilters, 500));
    searchFilter.addEventListener('input', debounce(applyFilters, 300));
    clearFiltersBtn.addEventListener('click', clearAllFilters);
}

// Fetch all USDT trading pairs from Binance
async function fetchAllUSDTSymbols() {
    try {
        updateConnectionStatus('connecting', 'Fetching symbols...');
        
        // Use CORS proxy to access Binance API
        const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
        const targetUrl = 'https://api.binance.com/api/v3/exchangeInfo';
        const response = await fetch(proxyUrl + targetUrl);
        const data = await response.json();
        
        // Filter for USDT pairs that are actively trading
        allSymbols = data.symbols
            .filter(symbol => 
                symbol.quoteAsset === 'USDT' && 
                symbol.status === 'TRADING' &&
                !symbol.symbol.includes('UP') &&
                !symbol.symbol.includes('DOWN') &&
                !symbol.symbol.includes('BULL') &&
                !symbol.symbol.includes('BEAR')
            )
            .map(symbol => symbol.symbol)
            .sort();
        
        console.log(`Found ${allSymbols.length} USDT trading pairs`);
        
        // Fetch initial 24hr ticker data
        await fetch24hrTickerData();
        
        // Start WebSocket connection
        connectWebSocket();
        
    } catch (error) {
        console.error('Error fetching symbols:', error);
        updateConnectionStatus('disconnected', 'Failed to fetch symbols');
    }
}

// Fetch 24hr ticker data for volume and price change info
async function fetch24hrTickerData() {
    try {
        const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
        const targetUrl = 'https://api.binance.com/api/v3/ticker/24hr';
        const response = await fetch(proxyUrl + targetUrl);
        const tickerData = await response.json();
        
        // Store ticker data for USDT pairs
        tickerData.forEach(ticker => {
            if (allSymbols.includes(ticker.symbol)) {
                const existing = coinData.get(ticker.symbol) || {};
                coinData.set(ticker.symbol, {
                    ...existing,
                    symbol: ticker.symbol,
                    price: parseFloat(ticker.lastPrice),
                    priceChange: parseFloat(ticker.priceChange),
                    priceChangePercent: parseFloat(ticker.priceChangePercent),
                    volume: parseFloat(ticker.volume),
                    quoteVolume: parseFloat(ticker.quoteVolume),
                    count: parseInt(ticker.count)
                });
            }
        });
        
        console.log(`Loaded 24hr ticker data for ${coinData.size} pairs`);
        
    } catch (error) {
        console.error('Error fetching 24hr ticker data:', error);
    }
}

// WebSocket connection management
function connectWebSocket() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
    }
    
    updateConnectionStatus('connecting', 'Connecting to Binance...');
    
    // Create streams for all USDT pairs
    const streams = allSymbols.map(symbol => 
        `${symbol.toLowerCase()}@kline_${currentTimeframe}`
    ).join('/');
    
    const wsUrl = `wss://stream.binance.com:9443/ws/${streams}`;
    
    try {
        ws = new WebSocket(wsUrl);
        
        ws.onopen = function() {
            console.log('WebSocket connected');
            isConnected = true;
            reconnectAttempts = 0;
            updateConnectionStatus('connected', 'Connected');
            
            // Fetch historical data for EMA calculations
            fetchHistoricalDataForAllSymbols();
        };
        
        ws.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                if (data.stream && data.data) {
                    handleKlineData(data.data);
                }
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };
        
        ws.onclose = function(event) {
            console.log('WebSocket closed:', event.code, event.reason);
            isConnected = false;
            updateConnectionStatus('disconnected', 'Disconnected');
            
            // Attempt to reconnect
            if (reconnectAttempts < maxReconnectAttempts) {
                setTimeout(() => {
                    reconnectAttempts++;
                    console.log(`Reconnection attempt ${reconnectAttempts}/${maxReconnectAttempts}`);
                    connectWebSocket();
                }, reconnectDelay * Math.pow(2, reconnectAttempts));
            } else {
                updateConnectionStatus('disconnected', 'Connection failed');
            }
        };
        
        ws.onerror = function(error) {
            console.error('WebSocket error:', error);
            updateConnectionStatus('disconnected', 'Connection error');
        };
        
    } catch (error) {
        console.error('Error creating WebSocket:', error);
        updateConnectionStatus('disconnected', 'Failed to connect');
    }
}

// Handle incoming kline (candlestick) data
function handleKlineData(klineData) {
    const symbol = klineData.s;
    const kline = klineData.k;
    
    if (!kline.x) return; // Only process closed candles
    
    const candlestick = {
        openTime: kline.t,
        closeTime: kline.T,
        open: parseFloat(kline.o),
        high: parseFloat(kline.h),
        low: parseFloat(kline.l),
        close: parseFloat(kline.c),
        volume: parseFloat(kline.v),
        quoteVolume: parseFloat(kline.q)
    };
    
    // Update historical data
    if (!historicalData.has(symbol)) {
        historicalData.set(symbol, []);
    }
    
    const history = historicalData.get(symbol);
    history.push(candlestick);
    
    // Keep only last 200 candles for EMA calculations
    if (history.length > 200) {
        history.shift();
    }
    
    // Update coin data with latest price
    const existing = coinData.get(symbol) || {};
    coinData.set(symbol, {
        ...existing,
        symbol: symbol,
        price: candlestick.close,
        lastUpdate: Date.now()
    });
    
    // Calculate technical indicators and update display
    calculateTechnicalIndicators(symbol);
    updateLastUpdateTime();
}

// Fetch historical candlestick data for EMA calculations
async function fetchHistoricalDataForAllSymbols() {
    updateConnectionStatus('connecting', 'Loading historical data...');
    
    const batchSize = 10; // Process symbols in batches to avoid rate limits
    const batches = [];
    
    for (let i = 0; i < allSymbols.length; i += batchSize) {
        batches.push(allSymbols.slice(i, i + batchSize));
    }
    
    let processedCount = 0;
    
    for (const batch of batches) {
        const promises = batch.map(symbol => fetchHistoricalData(symbol));
        await Promise.allSettled(promises);
        
        processedCount += batch.length;
        updateConnectionStatus('connecting', 
            `Loading data... ${processedCount}/${allSymbols.length}`);
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Calculate initial technical indicators for all symbols
    allSymbols.forEach(symbol => {
        calculateTechnicalIndicators(symbol);
    });
    
    updateConnectionStatus('connected', 'Connected');
    updateDisplay();
    
    // Set up periodic refresh
    setInterval(updateDisplay, 5000); // Update display every 5 seconds
    setInterval(refreshData, 300000); // Refresh data every 5 minutes
}

// Fetch historical data for a single symbol
async function fetchHistoricalData(symbol) {
    try {
        const limit = 100; // Get last 100 candles
        const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
        const targetUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${currentTimeframe}&limit=${limit}`;
        
        const response = await fetch(proxyUrl + targetUrl);
        const data = await response.json();
        
        const candles = data.map(candle => ({
            openTime: candle[0],
            closeTime: candle[6],
            open: parseFloat(candle[1]),
            high: parseFloat(candle[2]),
            low: parseFloat(candle[3]),
            close: parseFloat(candle[4]),
            volume: parseFloat(candle[5]),
            quoteVolume: parseFloat(candle[7])
        }));
        
        historicalData.set(symbol, candles);
        
    } catch (error) {
        console.error(`Error fetching historical data for ${symbol}:`, error);
    }
}

// Calculate technical indicators (EMA, Stoch RSI, MACD)
function calculateTechnicalIndicators(symbol) {
    const history = historicalData.get(symbol);
    if (!history || history.length < 50) return;
    
    const closes = history.map(candle => candle.close);
    const highs = history.map(candle => candle.high);
    const lows = history.map(candle => candle.low);
    
    // Calculate EMAs
    const ema9 = calculateEMA(closes, 9);
    const ema20 = calculateEMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);
    
    // Calculate Stochastic RSI
    const stochRSI = calculateStochRSI(closes, 14, 3, 3);
    
    // Calculate MACD
    const macd = calculateMACD(closes, 12, 26, 9);
    
    // Update coin data with indicators
    const existing = coinData.get(symbol) || {};
    coinData.set(symbol, {
        ...existing,
        ema9: ema9[ema9.length - 1],
        ema20: ema20[ema20.length - 1],
        ema50: ema50[ema50.length - 1],
        stochRSI: stochRSI,
        macd: macd,
        indicatorsCalculated: true
    });
    
    // Detect crosses and generate signals
    detectCrossesAndSignals(symbol, ema9, ema20, ema50, stochRSI, macd);
}

// EMA calculation
function calculateEMA(prices, period) {
    const ema = [];
    const multiplier = 2 / (period + 1);
    
    // Start with SMA for the first value
    let sum = 0;
    for (let i = 0; i < period && i < prices.length; i++) {
        sum += prices[i];
    }
    ema[period - 1] = sum / period;
    
    // Calculate EMA for the rest
    for (let i = period; i < prices.length; i++) {
        ema[i] = (prices[i] * multiplier) + (ema[i - 1] * (1 - multiplier));
    }
    
    return ema;
}

// Stochastic RSI calculation
function calculateStochRSI(prices, rsiPeriod = 14, stochPeriod = 14, smoothK = 3) {
    // First calculate RSI
    const rsi = calculateRSI(prices, rsiPeriod);
    
    if (rsi.length < stochPeriod) return { k: 0, d: 0 };
    
    // Calculate Stochastic of RSI
    const stochRSIValues = [];
    
    for (let i = stochPeriod - 1; i < rsi.length; i++) {
        const rsiSlice = rsi.slice(i - stochPeriod + 1, i + 1);
        const minRSI = Math.min(...rsiSlice);
        const maxRSI = Math.max(...rsiSlice);
        
        const stochRSI = maxRSI !== minRSI ? 
            (rsi[i] - minRSI) / (maxRSI - minRSI) * 100 : 50;
        
        stochRSIValues.push(stochRSI);
    }
    
    // Smooth %K
    const kValues = calculateSMA(stochRSIValues, smoothK);
    const dValues = calculateSMA(kValues, smoothK);
    
    return {
        k: kValues[kValues.length - 1] || 0,
        d: dValues[dValues.length - 1] || 0
    };
}

// RSI calculation helper
function calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return [];
    
    const gains = [];
    const losses = [];
    
    for (let i = 1; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        gains.push(change > 0 ? change : 0);
        losses.push(change < 0 ? Math.abs(change) : 0);
    }
    
    const rsi = [];
    let avgGain = gains.slice(0, period).reduce((a, b) => a + b) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b) / period;
    
    rsi[period - 1] = 100 - (100 / (1 + avgGain / avgLoss));
    
    for (let i = period; i < gains.length; i++) {
        avgGain = (avgGain * (period - 1) + gains[i]) / period;
        avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
        rsi[i] = 100 - (100 / (1 + avgGain / avgLoss));
    }
    
    return rsi;
}

// SMA calculation helper
function calculateSMA(values, period) {
    const sma = [];
    for (let i = period - 1; i < values.length; i++) {
        const sum = values.slice(i - period + 1, i + 1).reduce((a, b) => a + b);
        sma.push(sum / period);
    }
    return sma;
}

// MACD calculation
function calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    const emaFast = calculateEMA(prices, fastPeriod);
    const emaSlow = calculateEMA(prices, slowPeriod);
    
    const macdLine = [];
    const startIndex = Math.max(fastPeriod - 1, slowPeriod - 1);
    
    for (let i = startIndex; i < Math.min(emaFast.length, emaSlow.length); i++) {
        macdLine.push(emaFast[i] - emaSlow[i]);
    }
    
    const signalLine = calculateEMA(macdLine, signalPeriod);
    const histogram = [];
    
    const signalStartIndex = signalPeriod - 1;
    for (let i = signalStartIndex; i < macdLine.length && i - signalStartIndex < signalLine.length; i++) {
        histogram.push(macdLine[i] - signalLine[i - signalStartIndex]);
    }
    
    return {
        macd: macdLine[macdLine.length - 1] || 0,
        signal: signalLine[signalLine.length - 1] || 0,
        histogram: histogram[histogram.length - 1] || 0
    };
}

// Detect crosses and generate trading signals
function detectCrossesAndSignals(symbol, ema9Array, ema20Array, ema50Array, stochRSI, macd) {
    if (ema9Array.length < 2 || ema20Array.length < 2 || ema50Array.length < 2) return;
    
    const ema9Current = ema9Array[ema9Array.length - 1];
    const ema20Current = ema20Array[ema20Array.length - 1];
    const ema50Current = ema50Array[ema50Array.length - 1];
    
    const ema9Previous = ema9Array[ema9Array.length - 2];
    const ema20Previous = ema20Array[ema20Array.length - 2];
    
    let signal = 'NONE';
    let signalType = 'none';
    let explanation = 'No clear signal detected.';
    let confidence = 0;
    
    // Check for EMA crosses
    const ema9CrossedAbove20 = ema9Previous <= ema20Previous && ema9Current > ema20Current;
    const ema9CrossedBelow20 = ema9Previous >= ema20Previous && ema9Current < ema20Current;
    
    // Enhanced signal detection with multiple confirmations
    if (ema9CrossedAbove20) {
        if (ema20Current > ema50Current) {
            signal = 'BUY';
            signalType = 'bullish';
            explanation = 'Strong BUY: EMA 9 crossed above EMA 20, and EMA 20 is above EMA 50 (trend confirmation).';
            confidence = 85;
        } else {
            signal = 'POTENTIAL BUY';
            signalType = 'potential';
            explanation = 'Potential BUY: EMA 9 crossed above EMA 20, but waiting for EMA 20 to cross above EMA 50.';
            confidence = 60;
        }
    } else if (ema9CrossedBelow20) {
        if (ema20Current < ema50Current) {
            signal = 'SELL';
            signalType = 'bearish';
            explanation = 'Strong SELL: EMA 9 crossed below EMA 20, and EMA 20 is below EMA 50 (trend confirmation).';
            confidence = 85;
        } else {
            signal = 'POTENTIAL SELL';
            signalType = 'potential';
            explanation = 'Potential SELL: EMA 9 crossed below EMA 20, but waiting for EMA 20 to cross below EMA 50.';
            confidence = 60;
        }
    } else {
        // Check for EMA touching scenarios
        const ema9TouchingEma50 = Math.abs(ema9Current - ema50Current) / ema50Current < 0.002; // Within 0.2%
        
        if (ema9Current > ema20Current && ema9TouchingEma50) {
            signal = 'BUY';
            signalType = 'bullish';
            explanation = 'BUY: EMA 9 is above EMA 20 and touching EMA 50 (bullish bounce expected).';
            confidence = 75;
        } else if (ema9Current < ema20Current && ema9TouchingEma50) {
            signal = 'SELL';
            signalType = 'bearish';
            explanation = 'SELL: EMA 9 is below EMA 20 and touching EMA 50 (bearish rejection expected).';
            confidence = 75;
        } else {
            // Check for potential crosses (EMAs very close)
            const ema9_20Distance = Math.abs(ema9Current - ema20Current) / ema20Current;
            if (ema9_20Distance < 0.002) { // Within 0.2%
                if (ema9Current > ema20Current) {
                    signal = 'POTENTIAL BUY';
                    signalType = 'potential';
                    explanation = 'Potential BUY: EMA 9 and EMA 20 are very close, bullish cross may occur soon.';
                    confidence = 50;
                } else {
                    signal = 'POTENTIAL SELL';
                    signalType = 'potential';
                    explanation = 'Potential SELL: EMA 9 and EMA 20 are very close, bearish cross may occur soon.';
                    confidence = 50;
                }
            }
        }
    }
    
    // Enhance signal with Stoch RSI and MACD confirmations
    if (signal !== 'NONE' && signalType !== 'none') {
        let additionalConfirmations = [];
        
        // Stoch RSI confirmation
        if (signalType === 'bullish' && stochRSI.k > stochRSI.d && stochRSI.k < 80) {
            additionalConfirmations.push('Stoch RSI bullish');
            confidence += 10;
        } else if (signalType === 'bearish' && stochRSI.k < stochRSI.d && stochRSI.k > 20) {
            additionalConfirmations.push('Stoch RSI bearish');
            confidence += 10;
        }
        
        // MACD confirmation
        if (signalType === 'bullish' && macd.macd > macd.signal) {
            additionalConfirmations.push('MACD bullish');
            confidence += 10;
        } else if (signalType === 'bearish' && macd.macd < macd.signal) {
            additionalConfirmations.push('MACD bearish');
            confidence += 10;
        }
        
        if (additionalConfirmations.length > 0) {
            explanation += ` Additional confirmations: ${additionalConfirmations.join(', ')}.`;
        }
    }
    
    // Update coin data with signal information
    const existing = coinData.get(symbol) || {};
    coinData.set(symbol, {
        ...existing,
        signal: signal,
        signalType: signalType,
        explanation: explanation,
        confidence: Math.min(confidence, 100),
        lastSignalUpdate: Date.now()
    });
}

// Update connection status display
function updateConnectionStatus(status, text) {
    connectionStatus.className = `status-indicator ${status}`;
    connectionText.textContent = text;
}

// Update last update time
function updateLastUpdateTime() {
    lastUpdateTime = new Date();
    lastUpdateElement.textContent = lastUpdateTime.toLocaleTimeString();
}

// Update the main display
function updateDisplay() {
    const filteredCoins = applyFiltersToData();
    const sortedCoins = sortCoins(filteredCoins);
    
    updateStats(filteredCoins);
    renderCoinCards(sortedCoins);
    
    // Hide loading state and show content
    loadingState.style.display = 'none';
    
    if (sortedCoins.length === 0) {
        coinsGrid.style.display = 'none';
        noResultsState.style.display = 'flex';
    } else {
        noResultsState.style.display = 'none';
        coinsGrid.style.display = 'grid';
    }
}

// Apply filters to coin data
function applyFiltersToData() {
    const crossType = crossTypeFilter.value;
    const minVolume = parseFloat(volumeFilter.value) || 0;
    const searchTerm = searchFilter.value.toLowerCase().trim();
    
    return Array.from(coinData.values()).filter(coin => {
        // Filter by cross type
        if (crossType !== 'all') {
            if (crossType === 'bullish' && coin.signalType !== 'bullish') return false;
            if (crossType === 'bearish' && coin.signalType !== 'bearish') return false;
            if (crossType === 'potential' && coin.signalType !== 'potential') return false;
        }
        
        // Filter by minimum volume
        if (coin.quoteVolume < minVolume) return false;
        
        // Filter by search term
        if (searchTerm && !coin.symbol.toLowerCase().includes(searchTerm)) return false;
        
        // Only show coins with calculated indicators
        return coin.indicatorsCalculated;
    });
}

// Sort coins by signal priority
function sortCoins(coins) {
    return coins.sort((a, b) => {
        // Primary sort: signal type priority (bullish > bearish > potential > none)
        const signalPriority = { 'bullish': 4, 'bearish': 3, 'potential': 2, 'none': 1 };
        const aPriority = signalPriority[a.signalType] || 0;
        const bPriority = signalPriority[b.signalType] || 0;
        
        if (aPriority !== bPriority) {
            return bPriority - aPriority;
        }
        
        // Secondary sort: confidence level
        if (a.confidence !== b.confidence) {
            return (b.confidence || 0) - (a.confidence || 0);
        }
        
        // Tertiary sort: volume
        return (b.quoteVolume || 0) - (a.quoteVolume || 0);
    });
}

// Update statistics display
function updateStats(filteredCoins) {
    const total = filteredCoins.length;
    const bullish = filteredCoins.filter(coin => coin.signalType === 'bullish').length;
    const bearish = filteredCoins.filter(coin => coin.signalType === 'bearish').length;
    const potential = filteredCoins.filter(coin => coin.signalType === 'potential').length;
    
    totalPairsElement.textContent = total;
    bullishCountElement.textContent = bullish;
    bearishCountElement.textContent = bearish;
    potentialCountElement.textContent = potential;
}

// Render coin cards
function renderCoinCards(coins) {
    const template = document.getElementById('coinCardTemplate');
    coinsGrid.innerHTML = '';
    
    coins.forEach(coin => {
        const cardElement = template.content.cloneNode(true);
        const card = cardElement.querySelector('.coin-card');
        
        // Set card data and classes
        card.dataset.symbol = coin.symbol;
        card.classList.add(coin.signalType);
        
        if (coin.lastSignalUpdate && Date.now() - coin.lastSignalUpdate < 60000) {
            card.classList.add('active-cross');
        }
        
        // Populate card content
        card.querySelector('.coin-symbol').textContent = coin.symbol;
        card.querySelector('.coin-price').textContent = `$${coin.price?.toFixed(6) || '0.000000'}`;
        
        // Signal badge
        const signalBadge = card.querySelector('.signal-badge');
        const signalText = card.querySelector('.signal-text');
        signalBadge.className = `signal-badge ${coin.signalType}`;
        signalText.textContent = coin.signal || 'NONE';
        
        // Price change
        const changePercent = card.querySelector('.change-percent');
        const changeValue = card.querySelector('.change-value');
        const priceChangePercent = coin.priceChangePercent || 0;
        const priceChange = coin.priceChange || 0;
        
        changePercent.textContent = `${priceChangePercent >= 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%`;
        changePercent.className = `change-percent ${priceChangePercent >= 0 ? 'positive' : 'negative'}`;
        changeValue.textContent = `${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(6)}`;
        
        // Volume
        card.querySelector('.volume-value').textContent = formatVolume(coin.quoteVolume || 0);
        
        // EMA values
        card.querySelector('.ema-9').textContent = coin.ema9?.toFixed(6) || '0.000000';
        card.querySelector('.ema-20').textContent = coin.ema20?.toFixed(6) || '0.000000';
        card.querySelector('.ema-50').textContent = coin.ema50?.toFixed(6) || '0.000000';
        
        // Signal explanation
        card.querySelector('.explanation-text').textContent = coin.explanation || 'No analysis available.';
        
        coinsGrid.appendChild(cardElement);
    });
}

// Format volume for display
function formatVolume(volume) {
    if (volume >= 1e9) return `${(volume / 1e9).toFixed(2)}B`;
    if (volume >= 1e6) return `${(volume / 1e6).toFixed(2)}M`;
    if (volume >= 1e3) return `${(volume / 1e3).toFixed(2)}K`;
    return volume.toFixed(2);
}

// Event handlers
function handleTimeframeChange() {
    const newTimeframe = timeframeSelect.value;
    if (newTimeframe !== currentTimeframe) {
        currentTimeframe = newTimeframe;
        
        // Clear existing data
        historicalData.clear();
        coinData.forEach((coin, symbol) => {
            coinData.set(symbol, {
                ...coin,
                indicatorsCalculated: false
            });
        });
        
        // Reconnect WebSocket with new timeframe
        connectWebSocket();
    }
}

function handleRefresh() {
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
    
    // Refresh data
    refreshData().finally(() => {
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
    });
}

async function refreshData() {
    try {
        await fetch24hrTickerData();
        await fetchHistoricalDataForAllSymbols();
        updateDisplay();
    } catch (error) {
        console.error('Error refreshing data:', error);
    }
}

function applyFilters() {
    updateDisplay();
}

function clearAllFilters() {
    crossTypeFilter.value = 'bullish';
    volumeFilter.value = '';
    searchFilter.value = '';
    updateDisplay();
}

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Auto-refresh data every 5 minutes
setInterval(() => {
    if (isConnected) {
        refreshData();
    }
}, 300000);

