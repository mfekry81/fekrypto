# Binance Real-time USDT Coins Market Watch

This project aims to create a real-time market watch application for Binance USDT coin pairs, featuring WebSocket integration, technical analysis indicators (EMA, Stoch RSI, MACD), and dynamic UI updates.

## Technologies Used:

*   **Frontend:** HTML5, CSS3 (for styling and responsive design), JavaScript (for logic and UI manipulation)
*   **Real-time Data:** Binance WebSocket API
*   **Technical Analysis:** Custom JavaScript implementations for EMA, Stoch RSI, and MACD calculations.
*   **Charting (Optional, for future enhancement):** Chart.js or ApexCharts (if visual charts are added)

## Project Structure:

```
binance_market_watch/
├── index.html
├── style.css
├── script.js
├── README.md
└── assets/
    └── (for images, icons, etc.)
```

## Features:

*   **Real-time Data:** Connects to Binance WebSocket to get live candlestick data.
*   **Technical Indicators:** Calculates EMA (9, 20, 50), Stoch RSI, and MACD.
*   **Cross Detection:** Detects bullish, bearish, and potential EMA crosses.
*   **Dynamic UI:** Color-coded cards, visual alerts, real-time stats bar.
*   **Filtering & Sorting:** Filter by cross type, volume, search by symbol, sort by signal strength.
*   **Responsive Design:** Works on desktop and mobile.
*   **Dark Theme:** Modern dark theme with Binance-inspired golden accents.

## Setup and Run:

This is a static HTML application. To run it:

1.  Clone this repository (or download the files).
2.  Open `index.html` in your web browser.

**Note:** Due to browser security policies (CORS), you might need to run this application through a local web server if you encounter issues with WebSocket connections. A simple way to do this is using Python:

```bash
python3 -m http.server 8000
```

Then, navigate to `http://localhost:8000` in your browser.

## Future Enhancements:

*   Integration of charting libraries for visual representation of data.
*   User authentication and personalized settings.
*   Backend for storing user preferences or historical data beyond WebSocket limits.


