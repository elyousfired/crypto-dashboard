import type { CandleData, TickerData, TradeItem, OrderBookData, Stats30d } from '../types/crypto';

// Try direct first, fallback to Vite proxy if needed
const getBaseUrl = () => {
  return 'https://api.binance.com';
};

const getProxyUrl = () => {
  return '/api/binance';
};

async function fetchWithFallback(endpoint: string) {
  try {
    const res = await fetch(`${getBaseUrl()}${endpoint}`);
    if (res.ok) return await res.json();
    throw new Error(`Direct fetch failed with status ${res.status}`);
  } catch {
    const res = await fetch(`${getProxyUrl()}${endpoint}`);
    if (!res.ok) throw new Error(`Proxy fetch failed with status ${res.status}`);
    return await res.json();
  }
}

export async function fetchBinance30dStats(symbol: string): Promise<Stats30d | null> {
  try {
    const data = await fetchWithFallback(`/api/v3/klines?symbol=${symbol}&interval=1d&limit=30`);
    if (!Array.isArray(data) || data.length === 0) return null;

    let high30d = 0;
    let low30d = Infinity;
    for (const item of data) {
      const h = parseFloat(item[2] as string);
      const l = parseFloat(item[3] as string);
      if (h > high30d) high30d = h;
      if (l < low30d) low30d = l;
    }

    const lastPrice = parseFloat(data[data.length - 1][4] as string);
    const firstOpen = parseFloat(data[0][1] as string);
    const dropFromHighPct = high30d > 0 ? ((lastPrice - high30d) / high30d) * 100 : 0;
    const change30dPct = firstOpen > 0 ? ((lastPrice - firstOpen) / firstOpen) * 100 : 0;

    return {
      high30d,
      low30d,
      dropFromHighPct,
      change30dPct,
    };
  } catch (err) {
    console.error(`Error fetching Binance 30d stats for ${symbol}:`, err);
    return null;
  }
}

export async function fetchBinanceTickers(symbols: string[]): Promise<TickerData[]> {
  try {
    const data = await fetchWithFallback('/api/v3/ticker/24hr');
    const symbolSet = new Set(symbols);
    const filtered = data.filter((item: { symbol: string }) => symbolSet.has(item.symbol));

    return filtered.map((item: {
      symbol: string;
      lastPrice: string;
      priceChange: string;
      priceChangePercent: string;
      highPrice: string;
      lowPrice: string;
      volume: string;
      quoteVolume: string;
      closeTime: number;
    }): TickerData => ({
      symbol: item.symbol,
      exchange: 'binance',
      lastPrice: parseFloat(item.lastPrice),
      priceChange: parseFloat(item.priceChange),
      priceChangePercent: parseFloat(item.priceChangePercent),
      highPrice: parseFloat(item.highPrice),
      lowPrice: parseFloat(item.lowPrice),
      volume: parseFloat(item.volume),
      quoteVolume: parseFloat(item.quoteVolume),
      timestamp: item.closeTime,
    }));
  } catch (err) {
    console.error('Error fetching Binance tickers:', err);
    return [];
  }
}

export async function fetchBinanceKlines(symbol: string, interval: string = '1h', limit: number = 200): Promise<CandleData[]> {
  try {
    const data = await fetchWithFallback(`/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
    return data.map((item: (string | number)[]): CandleData => ({
      time: Math.floor(Number(item[0]) / 1000), // convert ms to seconds
      open: parseFloat(item[1] as string),
      high: parseFloat(item[2] as string),
      low: parseFloat(item[3] as string),
      close: parseFloat(item[4] as string),
      volume: parseFloat(item[5] as string),
    }));
  } catch (err) {
    console.error(`Error fetching Binance klines for ${symbol}:`, err);
    return [];
  }
}

export async function fetchBinanceTrades(symbol: string, limit: number = 30): Promise<TradeItem[]> {
  try {
    const data = await fetchWithFallback(`/api/v3/trades?symbol=${symbol}&limit=${limit}`);
    return data.map((item: {
      id: number;
      price: string;
      qty: string;
      time: number;
      isBuyerMaker: boolean;
    }): TradeItem => ({
      id: String(item.id),
      price: parseFloat(item.price),
      qty: parseFloat(item.qty),
      time: item.time,
      side: item.isBuyerMaker ? 'sell' : 'buy',
    })).reverse();
  } catch (err) {
    console.error(`Error fetching Binance trades for ${symbol}:`, err);
    return [];
  }
}

export async function fetchBinanceOrderBook(symbol: string, limit: number = 15): Promise<OrderBookData> {
  try {
    const data = await fetchWithFallback(`/api/v3/depth?symbol=${symbol}&limit=${limit}`);
    let bidTotal = 0;
    const bids = (data.bids || []).map((entry: [string, string]) => {
      const price = parseFloat(entry[0]);
      const size = parseFloat(entry[1]);
      bidTotal += size;
      return { price, size, total: bidTotal };
    });

    let askTotal = 0;
    const asks = (data.asks || []).map((entry: [string, string]) => {
      const price = parseFloat(entry[0]);
      const size = parseFloat(entry[1]);
      askTotal += size;
      return { price, size, total: askTotal };
    });

    return { bids, asks };
  } catch (err) {
    console.error(`Error fetching Binance orderbook for ${symbol}:`, err);
    return { bids: [], asks: [] };
  }
}

export class BinanceWebSocketManager {
  private ws: WebSocket | null = null;
  private onTickerUpdate: ((ticker: Partial<TickerData> & { symbol: string }) => void) | null = null;
  private onCandleUpdate: ((candle: CandleData & { symbol: string }) => void) | null = null;
  private symbols: string[] = [];
  private activeInterval: string = '1h';
  private pingInterval: any = null;

  constructor(symbols: string[], onTicker: (t: any) => void, onCandle?: (c: any) => void) {
    this.symbols = symbols.map(s => s.toLowerCase());
    this.onTickerUpdate = onTicker;
    this.onCandleUpdate = onCandle || null;
  }

  public connect(interval: string = '1h') {
    this.activeInterval = interval;
    this.disconnect();

    const streams = [
      ...this.symbols.map(s => `${s}@ticker`),
      ...this.symbols.map(s => `${s}@kline_${this.activeInterval}`),
    ];

    const streamUrl = `wss://stream.binance.com:9443/stream?streams=${streams.join('/')}`;
    
    try {
      this.ws = new WebSocket(streamUrl);

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const stream = payload.stream as string;
          const data = payload.data;

          if (stream.includes('@ticker')) {
            const symbol = data.s;
            if (this.onTickerUpdate) {
              this.onTickerUpdate({
                symbol,
                exchange: 'binance',
                lastPrice: parseFloat(data.c),
                priceChange: parseFloat(data.p),
                priceChangePercent: parseFloat(data.P),
                highPrice: parseFloat(data.h),
                lowPrice: parseFloat(data.l),
                volume: parseFloat(data.v),
                quoteVolume: parseFloat(data.q),
                timestamp: data.E,
              });
            }
          } else if (stream.includes('@kline') && this.onCandleUpdate) {
            const k = data.k;
            this.onCandleUpdate({
              symbol: data.s,
              time: Math.floor(k.t / 1000),
              open: parseFloat(k.o),
              high: parseFloat(k.h),
              low: parseFloat(k.l),
              close: parseFloat(k.c),
              volume: parseFloat(k.v),
            });
          }
        } catch (err) {
          console.error('Error handling Binance WS message:', err);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('Binance WebSocket error, will reconnect...', err);
      };

      this.ws.onclose = () => {
        setTimeout(() => {
          if (this.ws && this.ws.readyState === WebSocket.CLOSED) {
            this.connect(this.activeInterval);
          }
        }, 3000);
      };
    } catch (e) {
      console.warn('Binance WebSocket initialization error:', e);
    }
  }

  public disconnect() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }
}
