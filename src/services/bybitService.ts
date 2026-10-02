import type { CandleData, TickerData, TradeItem, OrderBookData, Stats30d } from '../types/crypto';

const getBaseUrl = () => {
  return 'https://api.bybit.com';
};

const getProxyUrl = () => {
  return '/api/bybit';
};

async function fetchBybitWithFallback(endpoint: string) {
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

export async function fetchBybit30dStats(symbol: string, category: 'spot' | 'linear' = 'spot'): Promise<Stats30d | null> {
  try {
    const data = await fetchBybitWithFallback(
      `/v5/market/kline?category=${category}&symbol=${symbol}&interval=D&limit=30`
    );
    const rawList = data?.result?.list || [];
    if (!Array.isArray(rawList) || rawList.length === 0) return null;

    let high30d = 0;
    let low30d = Infinity;
    for (const item of rawList) {
      const h = parseFloat(item[2]);
      const l = parseFloat(item[3]);
      if (h > high30d) high30d = h;
      if (l < low30d) low30d = l;
    }

    // Bybit returns newest first, so index 0 is latest, last index is 30 days ago
    const lastPrice = parseFloat(rawList[0][4]);
    const firstOpen = parseFloat(rawList[rawList.length - 1][1]);
    const dropFromHighPct = high30d > 0 ? ((lastPrice - high30d) / high30d) * 100 : 0;
    const change30dPct = firstOpen > 0 ? ((lastPrice - firstOpen) / firstOpen) * 100 : 0;

    return {
      high30d,
      low30d,
      dropFromHighPct,
      change30dPct,
    };
  } catch (err) {
    console.error(`Error fetching Bybit 30d stats for ${symbol}:`, err);
    return null;
  }
}

export async function fetchBybitTickers(symbols: string[], category: 'spot' | 'linear' = 'spot'): Promise<TickerData[]> {
  try {
    const data = await fetchBybitWithFallback(`/v5/market/tickers?category=${category}`);
    const list = data?.result?.list || [];
    const symbolSet = new Set(symbols);
    const filtered = list.filter((item: { symbol: string }) => symbolSet.has(item.symbol));

    return filtered.map((item: {
      symbol: string;
      lastPrice: string;
      prevPrice24h: string;
      price24hPcnt: string;
      highPrice24h: string;
      lowPrice24h: string;
      volume24h: string;
      turnover24h: string;
    }): TickerData => {
      const last = parseFloat(item.lastPrice || '0');
      const prev = parseFloat(item.prevPrice24h || '0');
      const change = last - prev;
      const changePcnt = parseFloat(item.price24hPcnt || '0') * 100;

      return {
        symbol: item.symbol,
        exchange: 'bybit',
        lastPrice: last,
        priceChange: change,
        priceChangePercent: changePcnt,
        highPrice: parseFloat(item.highPrice24h || '0'),
        lowPrice: parseFloat(item.lowPrice24h || '0'),
        volume: parseFloat(item.volume24h || '0'),
        quoteVolume: parseFloat(item.turnover24h || '0'),
        timestamp: Date.now(),
      };
    });
  } catch (err) {
    console.error('Error fetching Bybit tickers:', err);
    return [];
  }
}

export async function fetchBybitKlines(
  symbol: string,
  interval: string = '60',
  category: 'spot' | 'linear' = 'spot',
  limit: number = 200
): Promise<CandleData[]> {
  try {
    const data = await fetchBybitWithFallback(
      `/v5/market/kline?category=${category}&symbol=${symbol}&interval=${interval}&limit=${limit}`
    );
    const rawList = data?.result?.list || [];
    
    // Bybit returns newest first, so reverse to chronological order
    const candles: CandleData[] = rawList.slice().reverse().map((item: string[]): CandleData => ({
      time: Math.floor(parseInt(item[0], 10) / 1000),
      open: parseFloat(item[1]),
      high: parseFloat(item[2]),
      low: parseFloat(item[3]),
      close: parseFloat(item[4]),
      volume: parseFloat(item[5]),
    }));

    return candles;
  } catch (err) {
    console.error(`Error fetching Bybit klines for ${symbol}:`, err);
    return [];
  }
}

export async function fetchBybitTrades(symbol: string, category: 'spot' | 'linear' = 'spot', limit: number = 30): Promise<TradeItem[]> {
  try {
    const data = await fetchBybitWithFallback(`/v5/market/recent-trade?category=${category}&symbol=${symbol}&limit=${limit}`);
    const list = data?.result?.list || [];
    return list.map((item: {
      execId: string;
      price: string;
      size: string;
      side: string;
      time: string;
    }): TradeItem => ({
      id: item.execId,
      price: parseFloat(item.price),
      qty: parseFloat(item.size),
      time: parseInt(item.time, 10),
      side: item.side.toLowerCase() === 'buy' ? 'buy' : 'sell',
    }));
  } catch (err) {
    console.error(`Error fetching Bybit trades for ${symbol}:`, err);
    return [];
  }
}

export async function fetchBybitOrderBook(symbol: string, category: 'spot' | 'linear' = 'spot', limit: number = 15): Promise<OrderBookData> {
  try {
    const data = await fetchBybitWithFallback(`/v5/market/orderbook?category=${category}&symbol=${symbol}&limit=${limit}`);
    const res = data?.result || {};
    
    let bidTotal = 0;
    const bids = (res.b || []).map((entry: [string, string]) => {
      const price = parseFloat(entry[0]);
      const size = parseFloat(entry[1]);
      bidTotal += size;
      return { price, size, total: bidTotal };
    });

    let askTotal = 0;
    const asks = (res.a || []).map((entry: [string, string]) => {
      const price = parseFloat(entry[0]);
      const size = parseFloat(entry[1]);
      askTotal += size;
      return { price, size, total: askTotal };
    });

    return { bids, asks };
  } catch (err) {
    console.error(`Error fetching Bybit orderbook for ${symbol}:`, err);
    return { bids: [], asks: [] };
  }
}

export class BybitWebSocketManager {
  private ws: WebSocket | null = null;
  private onTickerUpdate: ((ticker: Partial<TickerData> & { symbol: string }) => void) | null = null;
  private onCandleUpdate: ((candle: CandleData & { symbol: string }) => void) | null = null;
  private symbols: string[] = [];
  private activeInterval: string = '60';
  private pingInterval: any = null;

  constructor(symbols: string[], onTicker: (t: any) => void, onCandle?: (c: any) => void) {
    this.symbols = symbols;
    this.onTickerUpdate = onTicker;
    this.onCandleUpdate = onCandle || null;
  }

  public connect(interval: string = '60') {
    this.activeInterval = interval;
    this.disconnect();

    const url = 'wss://stream.bybit.com/v5/public/spot';

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        const tickerArgs = this.symbols.map(s => `tickers.${s}`);
        const klineArgs = this.symbols.map(s => `kline.${this.activeInterval}.${s}`);

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ op: 'subscribe', args: [...tickerArgs, ...klineArgs] }));
        }

        this.pingInterval = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ op: 'ping' }));
          }
        }, 20000);
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const topic = payload.topic || '';
          const data = payload.data;

          if (topic.startsWith('tickers.') && data) {
            const symbol = topic.replace('tickers.', '');
            if (this.onTickerUpdate) {
              const last = parseFloat(data.lastPrice || '0');
              const prev = parseFloat(data.prevPrice24h || '0');
              this.onTickerUpdate({
                symbol,
                exchange: 'bybit',
                ...(data.lastPrice ? { lastPrice: last } : {}),
                ...(data.prevPrice24h && last ? { priceChange: last - prev } : {}),
                ...(data.price24hPcnt ? { priceChangePercent: parseFloat(data.price24hPcnt) * 100 } : {}),
                ...(data.highPrice24h ? { highPrice: parseFloat(data.highPrice24h) } : {}),
                ...(data.lowPrice24h ? { lowPrice: parseFloat(data.lowPrice24h) } : {}),
                ...(data.volume24h ? { volume: parseFloat(data.volume24h) } : {}),
                ...(data.turnover24h ? { quoteVolume: parseFloat(data.turnover24h) } : {}),
                timestamp: payload.ts || Date.now(),
              });
            }
          } else if (topic.startsWith('kline.') && Array.isArray(data) && data[0] && this.onCandleUpdate) {
            const parts = topic.split('.');
            const symbol = parts[2];
            const k = data[0];
            this.onCandleUpdate({
              symbol,
              time: Math.floor(parseInt(k.start, 10) / 1000),
              open: parseFloat(k.open),
              high: parseFloat(k.high),
              low: parseFloat(k.low),
              close: parseFloat(k.close),
              volume: parseFloat(k.volume),
            });
          }
        } catch (err) {
          console.error('Error handling Bybit WS message:', err);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('Bybit WebSocket error, will reconnect...', err);
      };

      this.ws.onclose = () => {
        if (this.pingInterval) clearInterval(this.pingInterval);
        setTimeout(() => {
          if (this.ws && this.ws.readyState === WebSocket.CLOSED) {
            this.connect(this.activeInterval);
          }
        }, 3000);
      };
    } catch (e) {
      console.warn('Bybit WebSocket initialization error:', e);
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
