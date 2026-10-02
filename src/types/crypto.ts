export type Exchange = 'binance' | 'bybit';

export interface TokenConfig {
  id: string;
  name: string;
  symbol: string;
  displaySymbol: string;
  baseAsset: string;
  quoteAsset: string;
  exchange: Exchange;
  bybitCategory?: 'spot' | 'linear';
  precision: number;
  color: string;
  accentGradient: string;
  description: string;
}

export interface TickerData {
  symbol: string;
  exchange: Exchange;
  lastPrice: number;
  prevPrice?: number;
  priceChange: number;
  priceChangePercent: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  quoteVolume: number;
  timestamp: number;
}

export interface CandleData {
  time: number; // in seconds for lightweight-charts
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradeItem {
  id: string;
  price: number;
  qty: number;
  time: number;
  side: 'buy' | 'sell';
}

export interface OrderBookEntry {
  price: number;
  size: number;
  total: number;
}

export interface OrderBookData {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
}

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
export type ChartType = 'candlestick' | 'line' | 'area';
export type ViewMode = 'focus' | 'grid' | 'compare';

export interface Stats30d {
  high30d: number;
  low30d: number;
  dropFromHighPct: number; // Negative percentage representing dip/drawdown from 30D High
  change30dPct: number;    // Net percentage change over the 30-day period
}


