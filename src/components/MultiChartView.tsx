import React, { useEffect, useRef } from 'react';
import {
  createChart,
  CandlestickSeries,
  ColorType,
} from 'lightweight-charts';
import type {
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
} from 'lightweight-charts';
import type { TokenConfig, TickerData, CandleData } from '../types/crypto';
import { ArrowUpRight, ArrowDownRight, Maximize2 } from 'lucide-react';

interface MiniChartProps {
  token: TokenConfig;
  ticker?: TickerData;
  candles: CandleData[];
  onSelect: () => void;
}

const MiniChartCard: React.FC<MiniChartProps> = ({
  token,
  ticker,
  candles,
  onSelect,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  const priceChange = ticker?.priceChangePercent ?? 0;
  const isPositive = priceChange >= 0;

  useEffect(() => {
    if (!chartContainerRef.current) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: 220,
      layout: {
        background: { type: ColorType.Solid, color: '#090d14' },
        textColor: '#64748b',
        fontSize: 10,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      },
      grid: {
        vertLines: { color: 'rgba(30, 41, 59, 0.2)' },
        horzLines: { color: 'rgba(30, 41, 59, 0.2)' },
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#1e293b',
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => {
      if (chartRef.current && container) {
        chartRef.current.applyOptions({
          width: container.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current || candles.length === 0) return;

    const sorted = [...candles].sort((a, b) => a.time - b.time);
    const seen = new Set<number>();
    const unique = sorted.filter(c => {
      if (seen.has(c.time)) return false;
      seen.add(c.time);
      return true;
    });

    seriesRef.current.setData(
      unique.map(c => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  return (
    <div className="bg-[#0b0e14] border border-slate-800/80 rounded-2xl overflow-hidden hover:border-slate-700 transition shadow-lg flex flex-col">
      {/* Header */}
      <div className="p-3.5 border-b border-slate-800/80 bg-slate-900/50 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs bg-gradient-to-br ${token.accentGradient}`}
          >
            {token.baseAsset.slice(0, 2)}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-white text-sm">{token.baseAsset}</span>
              <span
                className={`text-[9px] uppercase px-1.5 py-0.2 rounded font-semibold ${
                  token.exchange === 'binance'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                }`}
              >
                {token.exchange}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">{token.name}</div>
          </div>
        </div>

        {/* Price & Action */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-bold font-mono text-white">
              ${ticker?.lastPrice !== undefined
                ? ticker.lastPrice < 1
                  ? ticker.lastPrice.toFixed(token.precision)
                  : ticker.lastPrice.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: token.precision,
                    })
                : '---'}
            </div>
            <div
              className={`text-[11px] font-mono font-medium flex items-center justify-end gap-0.5 ${
                isPositive ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              <span>
                {isPositive ? '+' : ''}
                {priceChange.toFixed(2)}%
              </span>
            </div>
          </div>

          <button
            onClick={onSelect}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            title="Open in Focus Mode"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div ref={chartContainerRef} className="w-full h-[220px]" />
    </div>
  );
};

interface MultiChartViewProps {
  tokens: TokenConfig[];
  tickers: Record<string, TickerData>;
  multiCandles: Record<string, CandleData[]>;
  onSelectToken: (token: TokenConfig) => void;
}

export const MultiChartView: React.FC<MultiChartViewProps> = ({
  tokens,
  tickers,
  multiCandles,
  onSelectToken,
}) => {
  const isPureSolanaPage = tokens.length > 0 && tokens.every((t) => t.category === 'solana');
  const isPureHyperliquidPage = tokens.length > 0 && tokens.every((t) => t.category === 'hyperliquid');

  if (isPureSolanaPage) {
    return (
      <div className="p-4 lg:p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
          <h2 className="text-lg font-bold text-white m-0">
            Multi-Charts : Écosystème Solana (5 Tokens)
          </h2>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
            100% Solana Exclusif
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          {tokens.map((token) => (
            <MiniChartCard
              key={token.id}
              token={token}
              ticker={tickers[token.symbol]}
              candles={multiCandles[token.symbol] || []}
              onSelect={() => onSelectToken(token)}
            />
          ))}
        </div>
      </div>
    );
  }

  if (isPureHyperliquidPage) {
    return (
      <div className="p-4 lg:p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-400 shadow-sm shadow-teal-400/50" />
          <h2 className="text-lg font-bold text-white m-0">
            Multi-Charts : Écosystème Hyperliquid (5 Tokens)
          </h2>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
            100% Hyperliquid Exclusif
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          {tokens.map((token) => (
            <MiniChartCard
              key={token.id}
              token={token}
              ticker={tickers[token.symbol]}
              candles={multiCandles[token.symbol] || []}
              onSelect={() => onSelectToken(token)}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-8">
      {/* Section 1: Binance Markets */}

      {/* Section 2: Binance Altcoins (Sui, Zcash, Pengu) */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50" />
          <h2 className="text-lg font-bold text-white m-0">
            Binance Markets (Sui, Zcash, Pengu)
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tokens
            .filter((t) => t.exchange === 'binance' && t.category !== 'solana')
            .map((token) => (
              <MiniChartCard
                key={token.id}
                token={token}
                ticker={tickers[token.symbol]}
                candles={multiCandles[token.symbol] || []}
                onSelect={() => onSelectToken(token)}
              />
            ))}
        </div>
      </div>

      {/* Section 3: Bybit High-Beta Markets (Monad, Hyperliquid, Hyperlane) */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50" />
          <h2 className="text-lg font-bold text-white m-0">
            Bybit Markets (Monad, Hyperliquid, Hyperlane)
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tokens
            .filter((t) => t.exchange === 'bybit')
            .map((token) => (
              <MiniChartCard
                key={token.id}
                token={token}
                ticker={tickers[token.symbol]}
                candles={multiCandles[token.symbol] || []}
                onSelect={() => onSelectToken(token)}
              />
            ))}
        </div>
      </div>
    </div>
  );
};
