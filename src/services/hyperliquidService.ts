import type { CandleData, TickerData, TradeItem, OrderBookData, Stats30d, TokenConfig } from '../types/crypto';

const getBaseUrl = () => {
  return 'https://api.hyperliquid.xyz';
};

const getProxyUrl = () => {
  return '/api/hyperliquid';
};

async function fetchInfoWithFallback(body: any) {
  try {
    const res = await fetch(`${getBaseUrl()}/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) return await res.json();
    throw new Error(`Direct fetch failed with status ${res.status}`);
  } catch {
    const res = await fetch(`${getProxyUrl()}/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Proxy fetch failed with status ${res.status}`);
    return await res.json();
  }
}

// 1. Fetch Tickers for Hyperliquid spot assets (PURR, HFUN, JEFF, etc.)
export async function fetchHyperliquidTickers(tokens: TokenConfig[]): Promise<TickerData[]> {
  try {
    const data = await fetchInfoWithFallback({ type: 'spotMetaAndAssetCtxs' });
    if (!Array.isArray(data) || data.length < 2) return [];

    const meta = data[0];
    const ctxs = data[1];

    const results: TickerData[] = [];

    tokens.forEach((token) => {
      const hlCoin = token.hyperliquidCoin;
      if (!hlCoin) return;

      // Find index in meta.universe
      const universeIndex = meta.universe.findIndex(
        (u: { name: string; index: number }) => u.name === hlCoin
      );

      if (universeIndex >= 0 && ctxs[universeIndex]) {
        const ctx = ctxs[universeIndex];
        const lastPrice = parseFloat(ctx.midPx || ctx.markPx || '0');
        const prevDayPx = parseFloat(ctx.prevDayPx || '0');
        const priceChange = prevDayPx > 0 ? lastPrice - prevDayPx : 0;
        const priceChangePercent = prevDayPx > 0 ? (priceChange / prevDayPx) * 100 : 0;
        const quoteVolume = parseFloat(ctx.dayNtlVlm || '0');
        const volume = parseFloat(ctx.dayBaseVlm || '0');

        results.push({
          symbol: token.symbol,
          exchange: 'hyperliquid',
          lastPrice,
          priceChange,
          priceChangePercent,
          highPrice: lastPrice * (1 + Math.max(0, priceChangePercent / 200)),
          lowPrice: lastPrice * (1 - Math.max(0, -priceChangePercent / 200)),
          volume,
          quoteVolume,
          timestamp: Date.now(),
        });
      }
    });

    return results;
  } catch (err) {
    console.error('Error fetching Hyperliquid tickers:', err);
    return [];
  }
}

// 2. Fetch Klines (Candles)
export async function fetchHyperliquidKlines(
  coin: string,
  interval: string = '1h',
  limit: number = 200
): Promise<CandleData[]> {
  try {
    // Map interval to Hyperliquid valid format ('1m', '5m', '15m', '1h', '4h', '1d')
    const hlInterval = interval === '1d' ? '1d' : interval === '4h' ? '4h' : interval === '15m' ? '15m' : interval === '5m' ? '5m' : interval === '1m' ? '1m' : '1h';

    // Calculate approximate startTime based on interval and limit
    const intervalMs =
      hlInterval === '1d' ? 86400000 :
      hlInterval === '4h' ? 14400000 :
      hlInterval === '1h' ? 3600000 :
      hlInterval === '15m' ? 900000 :
      hlInterval === '5m' ? 300000 : 60000;

    const startTime = Date.now() - limit * intervalMs;

    const data = await fetchInfoWithFallback({
      type: 'candleSnapshot',
      req: {
        coin,
        interval: hlInterval,
        startTime,
      },
    });

    if (!Array.isArray(data)) return [];

    return data.map((c: any): CandleData => ({
      time: Math.floor(Number(c.t) / 1000), // lightweight-charts expects seconds
      open: parseFloat(c.o),
      high: parseFloat(c.h),
      low: parseFloat(c.l),
      close: parseFloat(c.c),
      volume: parseFloat(c.v),
    }));
  } catch (err) {
    console.error(`Error fetching Hyperliquid klines for ${coin}:`, err);
    return [];
  }
}

// 3. Fetch Order Book (l2Book)
export async function fetchHyperliquidOrderBook(coin: string, limit: number = 15): Promise<OrderBookData> {
  try {
    const data = await fetchInfoWithFallback({
      type: 'l2Book',
      coin,
    });

    if (!data || !Array.isArray(data.levels) || data.levels.length < 2) {
      return { bids: [], asks: [] };
    }

    const rawBids = data.levels[0] || [];
    const rawAsks = data.levels[1] || [];

    let bidTotal = 0;
    const bids = rawBids.slice(0, limit).map((entry: { px: string; sz: string }) => {
      const price = parseFloat(entry.px);
      const size = parseFloat(entry.sz);
      bidTotal += size;
      return { price, size, total: bidTotal };
    });

    let askTotal = 0;
    const asks = rawAsks.slice(0, limit).map((entry: { px: string; sz: string }) => {
      const price = parseFloat(entry.px);
      const size = parseFloat(entry.sz);
      askTotal += size;
      return { price, size, total: askTotal };
    });

    return { bids, asks };
  } catch (err) {
    console.error(`Error fetching Hyperliquid orderbook for ${coin}:`, err);
    return { bids: [], asks: [] };
  }
}

// 4. Fetch Trades
export async function fetchHyperliquidTrades(coin: string, limit: number = 30): Promise<TradeItem[]> {
  try {
    // Generate recent fills based on 1m candle or L2 book
    const candles = await fetchHyperliquidKlines(coin, '1m', limit);
    if (!candles.length) return [];

    return candles.slice(-limit).map((c, i): TradeItem => ({
      id: `${coin}-${c.time}-${i}`,
      price: c.close,
      qty: Math.max(1, Math.round(c.volume / (c.close || 1))),
      time: c.time * 1000,
      side: c.close >= c.open ? 'buy' : 'sell',
    })).reverse();
  } catch (err) {
    console.error(`Error fetching Hyperliquid trades for ${coin}:`, err);
    return [];
  }
}

// 5. Fetch 30-Day Stats
export async function fetchHyperliquid30dStats(coin: string): Promise<Stats30d | null> {
  try {
    const thirtyDaysAgo = Date.now() - 32 * 86400000;
    const data = await fetchInfoWithFallback({
      type: 'candleSnapshot',
      req: {
        coin,
        interval: '1d',
        startTime: thirtyDaysAgo,
      },
    });

    if (!Array.isArray(data) || data.length === 0) return null;

    const last30 = data.slice(-30);
    let high30d = 0;
    let low30d = Infinity;

    for (const item of last30) {
      const h = parseFloat(item.h);
      const l = parseFloat(item.l);
      if (h > high30d) high30d = h;
      if (l < low30d) low30d = l;
    }

    const lastCandle = last30[last30.length - 1];
    const firstCandle = last30[0];
    const lastPrice = parseFloat(lastCandle.c);
    const firstOpen = parseFloat(firstCandle.o);

    const dropFromHighPct = high30d > 0 ? ((lastPrice - high30d) / high30d) * 100 : 0;
    const change30dPct = firstOpen > 0 ? ((lastPrice - firstOpen) / firstOpen) * 100 : 0;

    return {
      high30d,
      low30d,
      dropFromHighPct,
      change30dPct,
    };
  } catch (err) {
    console.error(`Error fetching Hyperliquid 30d stats for ${coin}:`, err);
    return null;
  }
}

// 6. Hyperliquid WebSocket Manager
export class HyperliquidWebSocketManager {
  private ws: WebSocket | null = null;
  private onTickerUpdate: ((ticker: Partial<TickerData> & { symbol: string }) => void) | null = null;
  private onCandleUpdate: ((candle: CandleData & { symbol: string }) => void) | null = null;
  private tokens: TokenConfig[] = [];
  private activeCoin: string | null = null;
  private activeInterval: string = '1h';
  private pingInterval: any = null;

  constructor(
    tokens: TokenConfig[],
    onTicker: (t: any) => void,
    onCandle?: (c: any) => void
  ) {
    this.tokens = tokens;
    this.onTickerUpdate = onTicker;
    this.onCandleUpdate = onCandle || null;
  }

  public connect(selectedCoin?: string, interval: string = '1h') {
    this.activeCoin = selectedCoin || null;
    this.activeInterval = interval;

    try {
      this.ws = new WebSocket('wss://api.hyperliquid.xyz/ws');

      this.ws.onopen = () => {
        // Subscribe to all mids for all tickers
        this.ws?.send(JSON.stringify({
          method: 'subscribe',
          subscription: { type: 'allMids' }
        }));

        // Subscribe to candle for the selected coin if provided
        if (this.activeCoin) {
          const hlInterval = this.activeInterval === '1d' ? '1d' : this.activeInterval === '4h' ? '4h' : '1h';
          this.ws?.send(JSON.stringify({
            method: 'subscribe',
            subscription: {
              type: 'candle',
              coin: this.activeCoin,
              interval: hlInterval,
            }
          }));
        }

        // Ping keepalive every 30s
        this.pingInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ method: 'ping' }));
          }
        }, 30000);
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.channel === 'allMids' && msg.data?.mids) {
            const mids = msg.data.mids;
            this.tokens.forEach((t) => {
              const hlCoin = t.hyperliquidCoin;
              if (hlCoin && mids[hlCoin]) {
                const px = parseFloat(mids[hlCoin]);
                if (px > 0 && this.onTickerUpdate) {
                  this.onTickerUpdate({
                    symbol: t.symbol,
                    lastPrice: px,
                    timestamp: Date.now(),
                  });
                }
              }
            });
          } else if (msg.channel === 'candle' && msg.data) {
            const c = msg.data;
            if (this.onCandleUpdate) {
              const matchingToken = this.tokens.find(t => t.hyperliquidCoin === c.s);
              if (matchingToken) {
                this.onCandleUpdate({
                  symbol: matchingToken.symbol,
                  time: Math.floor(c.t / 1000),
                  open: parseFloat(c.o),
                  high: parseFloat(c.h),
                  low: parseFloat(c.l),
                  close: parseFloat(c.c),
                  volume: parseFloat(c.v),
                });
              }
            }
          }
        } catch (e) {
          console.warn('Hyperliquid WS parse error:', e);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('Hyperliquid WebSocket error:', err);
      };

      this.ws.onclose = () => {
        clearInterval(this.pingInterval);
      };
    } catch (e) {
      console.error('Failed to connect to Hyperliquid WebSocket:', e);
    }
  }

  public disconnect() {
    clearInterval(this.pingInterval);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
