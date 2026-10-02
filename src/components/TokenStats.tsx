import React from 'react';
import type { TokenConfig, TickerData } from '../types/crypto';
import { ArrowUpRight, ArrowDownRight, ExternalLink } from 'lucide-react';

interface TokenStatsProps {
  token: TokenConfig;
  ticker?: TickerData;
}

export const TokenStats: React.FC<TokenStatsProps> = ({ token, ticker }) => {
  const lastPrice = ticker?.lastPrice ?? 0;
  const high = ticker?.highPrice ?? 0;
  const low = ticker?.lowPrice ?? 0;
  const priceChange = ticker?.priceChange ?? 0;
  const priceChangePcnt = ticker?.priceChangePercent ?? 0;
  const isPositive = priceChangePcnt >= 0;
  const volume = ticker?.volume ?? 0;
  const quoteVolume = ticker?.quoteVolume ?? 0;

  // Calculate percentage along 24h range
  const rangeSpan = high - low;
  const rangePercent = rangeSpan > 0 ? Math.min(Math.max(((lastPrice - low) / rangeSpan) * 100, 0), 100) : 50;

  // External exchange link
  const getExchangeUrl = () => {
    if (token.exchange === 'binance') {
      return `https://www.binance.com/en/trade/${token.baseAsset}_${token.quoteAsset}?type=spot`;
    }
    return `https://www.bybit.com/trade/spot/${token.baseAsset}/${token.quoteAsset}`;
  };

  return (
    <div className="bg-[#0e121b] border-b border-slate-800 p-4 lg:p-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Token identity and Big Price */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg bg-gradient-to-br ${token.accentGradient}`}
            >
              {token.baseAsset.slice(0, 3)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-tight m-0">
                  {token.name}
                </h2>
                <span className="text-xs font-mono font-semibold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md">
                  {token.displaySymbol}
                </span>
                <span
                  className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                    token.exchange === 'binance'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  }`}
                >
                  {token.exchange}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-md line-clamp-1">
                {token.description}
              </p>
            </div>
          </div>

          <div className="h-10 w-[1px] bg-slate-800 hidden sm:block" />

          {/* Current Live Price */}
          <div>
            <div className="text-2xl lg:text-3xl font-black font-mono tracking-tight text-white flex items-baseline gap-2">
              <span>
                ${lastPrice < 1
                  ? lastPrice.toFixed(token.precision)
                  : lastPrice.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: token.precision,
                    })}
              </span>
              <span className="text-xs font-normal text-slate-400 font-sans">USD</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={`text-xs font-mono font-bold flex items-center gap-0.5 px-2 py-0.5 rounded-md ${
                  isPositive
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                {isPositive ? '+' : ''}
                {priceChangePcnt.toFixed(2)}%
              </span>
              <span className="text-xs font-mono text-slate-400">
                {isPositive ? '+' : ''}${priceChange.toFixed(token.precision)}
              </span>
            </div>
          </div>
        </div>

        {/* 24h Metrics & Range Gauge */}
        <div className="flex flex-wrap items-center gap-4 lg:gap-6">
          {/* Range Slider */}
          <div className="min-w-[190px] flex-1 sm:flex-initial">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
              <span>24h L: ${low < 1 ? low.toFixed(token.precision) : low.toFixed(2)}</span>
              <span>24h H: ${high < 1 ? high.toFixed(token.precision) : high.toFixed(2)}</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full relative overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400 rounded-full"
                style={{ width: '100%' }}
              />
              <div
                className="absolute top-0 bottom-0 w-1.5 bg-white shadow-md rounded-full -translate-x-1/2"
                style={{ left: `${rangePercent}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono mt-1">
              <span>Low</span>
              <span className="text-slate-300 font-medium">Position: {rangePercent.toFixed(0)}%</span>
              <span>High</span>
            </div>
          </div>

          {/* 24h Volume */}
          <div className="bg-[#0b0e14] px-3.5 py-2 rounded-xl border border-slate-800/80 min-w-[120px]">
            <div className="text-[11px] text-slate-400 font-medium">24h Vol ({token.baseAsset})</div>
            <div className="text-sm font-bold font-mono text-slate-200 mt-0.5">
              {volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>

          {/* 24h Turnover (USDT) */}
          <div className="bg-[#0b0e14] px-3.5 py-2 rounded-xl border border-slate-800/80 min-w-[130px]">
            <div className="text-[11px] text-slate-400 font-medium">24h Turnover (USDT)</div>
            <div className="text-sm font-bold font-mono text-slate-200 mt-0.5">
              ${quoteVolume > 1_000_000
                ? `${(quoteVolume / 1_000_000).toFixed(2)}M`
                : quoteVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>

          {/* External Exchange Link */}
          <a
            href={getExchangeUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700/60 transition"
            title={`Open ${token.symbol} on ${token.exchange}`}
          >
            <span>Trade</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
