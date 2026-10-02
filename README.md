# ⚡ Apex Terminal — Binance & Bybit Real-Time Crypto Dashboard

A high-performance crypto trading & analytics dashboard built with **React 19**, **Vite**, **Tailwind CSS**, and TradingView's **Lightweight Charts v5**, integrating live market data directly from **Binance** and **Bybit**.

---

## 🚀 Supported Tokens

### 🟡 Binance Markets
- **SUI** (`SUI / USDT`) — Sui Network
- **SOL** (`SOL / USDT`) — Solana
- **ZEC** (`ZEC / USDT`) — Zcash
- **PENGU** (`PENGU / USDT`) — Pudgy Penguins

### 🔵 Bybit Markets
- **MON** (`MON / USDT`) — Monad Ecosystem (Spot & Linear)
- **HYPE** (`HYPE / USDT`) — Hyperliquid
- **HYPER** (`HYPER / USDT`) — Hyperlane

---

## ✨ Features

1. **Dual-Exchange Real-Time WebSocket Streaming**:
   - Direct WebSockets to Binance (`wss://stream.binance.com:9443`) and Bybit (`wss://stream.bybit.com/v5/public/spot`).
   - Live tick animations with green/red flashes on price movements.
   - Real-time candle updates without full reload.

2. **TradingView Lightweight Charts v5**:
   - Candlestick, Line, and Area Mountain charts.
   - Interactive crosshair with full OHLCV inspector.
   - Multi-timeframe switching: `1m`, `5m`, `15m`, `1H`, `4H`, `1D`.
   - Technical Indicators:
     - **MA (7 / 25 / 99)**: Triple Moving Average overlay.
     - **BOLL (20, 2)**: Bollinger Bands with dynamic volatility channels.
     - **VOL**: Volume histogram bars colored by price direction.

3. **Live Order Book & Trade Feed**:
   - Real-time Market Trades table with timestamps, buy/sell indicators, and size.
   - Order Book depth visualization with proportional depth bars and live spread calculation.

4. **Multi-Chart Matrix View**:
   - Compare all 7 tokens simultaneously in a high-density grid.
   - Instant 1-click switch into full Focus Mode for in-depth analysis.

5. **24h Metrics & Range Gauge**:
   - Visual 24h High/Low range position slider.
   - 24h volume and USDT turnover counter.

---

## 🛠️ Quick Start

```bash
cd crypto-dashboard
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.
