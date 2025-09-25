// Global variables
let webSockets = [];
let reconnectAttempts = 0;
let maxReconnectAttempts = 5;
let reconnectDelay = 1000;
let isConnected = false;
let currentTimeframe = '5m';
let allSymbols = [];
let coinData = new Map();
let historicalData = new Map();
let lastUpdateTime = null;
let useMockData = false;

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

// Mock data for demonstration when CORS is blocked
const mockSymbols = [
    'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'XRPUSDT', 'SOLUSDT', 
    'DOGEUSDT', 'DOTUSDT', 'KAVAUSDT', 'LTCUSDT', 'AVAXUSDT', 'LINKUSDT',
    'ATOMUSDT', 'UNIUSDT', 'ETCUSDT', 'XLMUSDT', 'BCHUSDT', 'FILUSDT',
    'TRXUSDT', 'FTMUSDT', 'MANAUSDT', 'SANDUSDT', 'AXSUSDT', 'CHZUSDT',
    'ALGOUSDT', 'VETUSDT', 'EOSUSDT', 'XTZUSDT', 'NEOUSDT', 'QTUMUSDT',
    'ICXUSDT', 'ONTUSDT', 'ZILUSDT', 'KNCUSDT', 'ZRXUSDT', 'BATUSDT',
    'IOSTUSDT', 'OMGUSDT', 'THETAUSDT', 'ENJUSDT', 'MITHUSDT', 'HOTUSDT',
    'VTHOUSDT', 'DENTUSDT', 'NANOUSDT', 'ANKRUSDT', 'ONEUSDT', 'FTTUSDT',
    'CHRUSDT', 'COMPUSDT', 'SNXUSDT', 'MKRUSDT', 'DAIUSDT', 'KAVAUSDT',
    'BANDUSDT', 'RLCUSDT', 'WAVESUSDT', 'BALUSDT', 'YFIUSDT', 'LENDUSDT',
    'SRMUSDT', 'BZRXUSDT', 'CRVUSDT', 'SUSHIUSDT', 'EGLDUSDT', 'PAXGUSDT',
    'JSTUSDT', 'UNFIUSDT', 'AVAXUSDT', 'HNTUSDT', 'FLMUSDT', 'NEARUSDT',
    'OCEANUSDT', 'INJUSDT', 'ALPHAUSDT', 'AAVEUSDT', 'GRTUSDT', '1INCHUSDT',
    'REEFUSDT', 'SXPUSDT', 'LITUSDT', 'BADGERUSDT', 'PERPUSDT', 'TWTUSDT',
    'XECUSDT', 'GALAUSDT', 'CELOUSDT', 'ARUSDT', 'LUNAUSDT', 'ENSUSDT',
    'GMTUSDT', 'APEUSDT', 'OPUSDT', 'APTUSDT', 'LDOUSDT', 'SSVUSDT',
    'ARBUSD', 'PEPEUSDT', 'SUIUSDT', 'SEIUSDT', 'CYBERUSDT', 'MEMEUSDT',
    'TIAUSDT', 'ORDIUSDT', 'JTOUSDT', 'BONKUSDT', 'WIFUSDT', 'ENAUSDT',
    'WUSDT', 'TNSRUSDT', 'OMNIUSDT', 'REZUSDT', 'IOUSDT', 'NOTUSDT'
];

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
});

function initializeApp() {
    console.log('Initializing Binance Market Watch...');
    
    // Add CORS notice
    addCorsNotice();
    
    // Try to fetch real data first, fallback to mock data
    fetchAllUSDTSymbols();
}

function addCorsNotice() {
    const notice = document.createElement('div');
    notice.id = 'corsNotice';
    notice.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: linear-gradient(135deg, #f0b90b, #ffd700);
        color: #000;
        padding: 10px;
        text-align: center;
        font-weight: 600;
        z-index: 1000;
        font-size: 14px;
        display: none;
    `;
    notice.innerHTML = `
        ⚠️ CORS Restriction Detected - Using Demo Mode. 
        <a href="#" onclick="showCorsInstructions()" style="color: #000; text-decoration: underline;">
            Click here for instructions to enable live data
        </a>
    `;
    document.body.insertBefore(notice, document.body.firstChild);
}

function showCorsNotice() {
    const notice = document.getElementById('corsNotice');
    if (notice) {
        notice.style.display = 'block';
        // Adjust header position
        document.querySelector('.header').style.marginTop = '50px';
    }
}

function hideCorsNotice() {
    const notice = document.getElementById('corsNotice');
    if (notice) {
        notice.style.display = 'none';
        document.querySelector('.header').style.marginTop = '0';
    }
}

function showCorsInstructions() {
    alert(`To enable live data from Binance API:

1. BROWSER EXTENSION METHOD (Recommended):
   - Install "CORS Unblock" or "Disable CORS" browser extension
   - Enable the extension for this page
   - Refresh the page

2. CHROME FLAGS METHOD:
   - Close all Chrome windows
   - Start Chrome with: --disable-web-security --user-data-dir="c:/temp"
   - Navigate back to this page

3. LOCAL PROXY METHOD:
   - Run: npm install -g cors-anywhere
   - Start proxy: cors-anywhere
   - The app will automatically use the local proxy

4. PRODUCTION DEPLOYMENT:
   - Deploy this app to a web server
   - The server can make API calls without CORS restrictions

Currently running in DEMO MODE with simulated data.`);
}

function setupEventListeners() {
    timeframeSelect.addEventListener('change', handleTimeframeChange);
    refreshBtn.addEventListener('click', handleRefresh);
    crossTypeFilter.addEventListener('change', applyFilters);
    volumeFilter.addEventListener('input', debounce(applyFilters, 500));
    searchFilter.addEventListener('input', debounce(applyFilters, 300));
    clearFiltersBtn.addEventListener('click', clearAllFilters);
    
    // Make showCorsInstructions globally available
    window.showCorsInstructions = showCorsInstructions;
}

// Fetch all USDT trading pairs from Binance
async function fetchAllUSDTSymbols() {
    try {
        updateConnectionStatus('connecting', 'Fetching symbols...');
        
        // Try multiple approaches for CORS
        let response;
        let data;
        
        try {
            // Method 1: Direct API call
            response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
            data = await response.json();
        } catch (corsError) {
            console.log('Direct API call failed, trying alternative methods...');
            
            try {
                // Method 2: Try local CORS proxy if available
                response = await fetch('http://localhost:8080/https://api.binance.com/api/v3/ticker/24hr');
                data = await response.json();
            } catch (proxyError) {
                console.log('Local proxy not available, using mock data...');
                throw new Error('CORS_BLOCKED');
            }
        }
        
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
        hideCorsNotice();
        
        // Fetch initial 24hr ticker data
        await fetch24hrTickerData();
        
        // Start WebSocket connection
        connectWebSocket();
        
    } catch (error) {
        console.error("Error fetching symbols:", error);
        
        // If CORS is blocked, use mock data
        if (error.message === "CORS_BLOCKED") {
            useMockData = true;
            allSymbols = mockSymbols;
            showCorsNotice();
            updateConnectionStatus("connecting", "Demo Mode - Generating mock data...");
            generateMockData();
            simulateWebSocketConnection();
        } else {
            updateConnectionStatus("disconnected", "Failed to fetch symbols");
        }
    }
}

// Generate mock data for demonstration
function generateMockData() {
    allSymbols.forEach(symbol => {
        const basePrice = Math.random() * 1000 + 10; // Random price between 10-1010
        const priceChange = (Math.random() - 0.5) * basePrice * 0.1; // ±10% change
        const volume = Math.random() * 1000000 + 100000; // Random volume
        
        coinData.set(symbol, {
            symbol: symbol,
            price: basePrice,
            priceChange: priceChange,
            priceChangePercent: (priceChange / basePrice) * 100,
            volume: volume,
            quoteVolume: volume * basePrice,
            count: Math.floor(Math.random() * 10000) + 1000,
            lastUpdate: Date.now()
        });
        
        // Generate mock historical data
        const candles = [];
        let currentPrice = basePrice;
        
        for (let i = 0; i < 100; i++) {
            const change = (Math.random() - 0.5) * currentPrice * 0.02; // ±2% change per candle
            const open = currentPrice;
            const close = currentPrice + change;
            const high = Math.max(open, close) * (1 + Math.random() * 0.01);
            const low = Math.min(open, close) * (1 - Math.random() * 0.01);
            
            candles.push({
                openTime: Date.now() - (100 - i) * 300000, // 5 minutes apart
                closeTime: Date.now() - (99 - i) * 300000,
                open: open,
                high: high,
                low: low,
                close: close,
                volume: Math.random() * 1000 + 100,
                quoteVolume: (Math.random() * 1000 + 100) * currentPrice
            });
            
            currentPrice = close;
        }
        
        historicalData.set(symbol, candles);
    });
    
    console.log(`Generated mock data for ${allSymbols.length} pairs`);
}

// Simulate WebSocket connection for demo mode
function simulateWebSocketConnection() {
    updateConnectionStatus('connected', 'Connected (Demo Mode)');
    
    // Calculate initial technical indicators for all symbols
    allSymbols.forEach(symbol => {
        calculateTechnicalIndicators(symbol);
    });
    
    updateDisplay();
    
    // Set up periodic updates for demo mode
    setInterval(() => {
        // Simulate price updates for all symbols
        allSymbols.forEach(symbol => {
            const coin = coinData.get(symbol);
            if (coin) {
                const change = (Math.random() - 0.5) * coin.price * 0.001; // ±0.1% change
                coin.price += change;
                coin.priceChange += change;
                coin.priceChangePercent = (coin.priceChange / (coin.price - coin.priceChange)) * 100;
                coin.lastUpdate = Date.now();
                
                // Update historical data
                const history = historicalData.get(symbol);
                if (history && history.length > 0) {
                    const lastCandle = history[history.length - 1];
                    const newCandle = {
                        ...lastCandle,
                        openTime: Date.now() - 300000,
                        closeTime: Date.now(),
                        close: coin.price,
                        high: Math.max(lastCandle.high, coin.price),
                        low: Math.min(lastCandle.low, coin.price)
                    };
                    
                    history.push(newCandle);
                    if (history.length > 200) {
                        history.shift();
                    }
                }
                
                // Recalculate indicators
                calculateTechnicalIndicators(symbol);
            }
        });
        
        updateDisplay();
        updateLastUpdateTime();
    }, 5000); // Update every 5 seconds
    
    // Set up periodic refresh
    setInterval(updateDisplay, 5000);
}

// Fetch 24hr ticker data for volume and price change info
async function fetch24hrTickerData() {
    if (useMockData) return; // Skip if using mock data
    
    try {
        let response;
        let tickerData;
        
        try {
            response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
            tickerData = await response.json();
        } catch (corsError) {
            try {
                response = await fetch('http://localhost:8080/https://api.binance.com/api/v3/ticker/24hr');
                tickerData = await response.json();
            } catch (proxyError) {
                console.log('Cannot fetch ticker data, using existing data');
                return;
            }
        }
        
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
    if (useMockData) {
        simulateWebSocketConnection();
        return;
    }
    
    // Close existing connections
    webSockets.forEach(ws => ws.close());
    webSockets = [];
    
    updateConnectionStatus("connecting", "Connecting to Binance...");
    
    const maxStreamsPerConnection = 10; // Binance limit is 1024, but keeping it lower for stability
    const totalSymbols = allSymbols.length;
    let connectedCount = 0;

    for (let i = 0; i < totalSymbols; i += maxStreamsPerConnection) {
        const symbolsBatch = allSymbols.slice(i, i + maxStreamsPerConnection);
        const streams = symbolsBatch.map(symbol => 
            `${symbol.toLowerCase()}@kline_${currentTimeframe}`
        ).join("/");
        
        const wsUrl = `wss://stream.binance.com:9443/ws/${streams}`;
        
        try {
            const ws = new WebSocket(wsUrl);
            webSockets.push(ws);
            
            ws.onopen = function() {
                console.log(`WebSocket batch connected for ${symbolsBatch.length} symbols`);
                connectedCount += symbolsBatch.length;
                if (connectedCount >= totalSymbols) {
                    isConnected = true;
                    reconnectAttempts = 0;
                    updateConnectionStatus("connected", "Connected");
                    fetchHistoricalDataForAllSymbols();
                }
            };
            
            ws.onmessage = function(event) {
                try {
                    const data = JSON.parse(event.data);
                    if (data.stream && data.data) {
                        handleKlineData(data.data);
                    }
                } catch (error) {
                    console.error("Error parsing WebSocket message:", error);
                }
            };
            
            ws.onclose = function(event) {
                console.log(`WebSocket batch closed:`, event.code, event.reason);
                isConnected = false;
                updateConnectionStatus("disconnected", "Disconnected");
                
                // Attempt to reconnect (simplified for multiple connections)
                if (reconnectAttempts < maxReconnectAttempts) {
                    setTimeout(() => {
                        reconnectAttempts++;
                        console.log(`Reconnection attempt ${reconnectAttempts}/${maxReconnectAttempts}`);
                        connectWebSocket(); // Reconnect all
                    }, reconnectDelay * Math.pow(2, reconnectAttempts));
                } else {
                    updateConnectionStatus("disconnected", "Connection failed");
                }
            };
            
            ws.onerror = function(error) {
                console.error("WebSocket error:", error);
                updateConnectionStatus("disconnected", "Connection error");
            };
            
        } catch (error) {
            console.error("Error creating WebSocket:", error);
            updateConnectionStatus("disconnected", "Failed to connect");
        }
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
    if (useMockData) return; // Skip if using mock data
    
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
        updateConnectionStatus("connecting", 
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
    if (useMockData) return; // Skip if using mock data
    
    try {
        const limit = 100; // Get last 100 candles
        let response;
        let data;
        
        try {
            const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${currentTimeframe}&limit=${limit}`;
            response = await fetch(url);
            data = await response.json();
        } catch (corsError) {
            try {
                const proxyUrl = `http://localhost:8080/https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${currentTimeframe}&limit=${limit}`;
                response = await fetch(proxyUrl);
                data = await response.json();
            } catch (proxyError) {
                console.log(`Cannot fetch historical data for ${symbol}`);
                return;
            }
        }
        
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
        
        if (useMockData) {
            // Regenerate mock data for new timeframe
            generateMockData();
            allSymbols.forEach(symbol => {
                calculateTechnicalIndicators(symbol);
            });
            updateDisplay();
        } else {
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
        if (useMockData) {
            generateMockData();
            allSymbols.forEach(symbol => {
                calculateTechnicalIndicators(symbol);
            });
        } else {
            await fetch24hrTickerData();
            await fetchHistoricalDataForAllSymbols();
        }
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
    if (isConnected || useMockData) {
        refreshData();
    }
}, 300000);

