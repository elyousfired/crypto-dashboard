import React, { useEffect, useRef, useState } from 'react';
import type { TokenConfig, TickerData } from '../types/crypto';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface TickerBarProps {
  tokens: TokenConfig[];
  tickers: Record<string, TickerData>;
  selectedTokenId: string;
  onSelectToken: (token: TokenConfig) => void;
}

export const TickerBar: React.FC<TickerBarProps> = ({
  tokens,
  tickers,
  selectedTokenId,
  onSelectToken,
}) => {
  // Store previous prices to trigger flash effect
  const prevPricesRef = useRef<Record<string, number>>({});
  const [flashStates, setFlashStates] = useState<Record<string, 'up' | 'down' | null>>({});

  useEffect(() => {
    const newFlashes: Record<string, 'up' | 'down' | null> = {};
    let hasChange = false;

    tokens.forEach((t) => {
      const ticker = tickers[t.symbol];
      if (ticker) {
        const prev = prevPricesRef.current[t.symbol];
        if (prev !== undefined && prev !== ticker.lastPrice) {
          newFlashes[t.symbol] = ticker.lastPrice > prev ? 'up' : 'down';
          hasChange = true;
        }
        prevPricesRef.current[t.symbol] = ticker.lastPrice;
      }
    });

    if (hasChange) {
      setFlashStates((prev) => ({ ...prev, ...newFlashes }));
      const timer = setTimeout(() => {
        setFlashStates({});
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [tickers, tokens]);

  const [categoryFilter, setCategoryFilter] = useState<'all' | 'solana'>('all');

  const visibleTokens = tokens.filter((t) => {
    if (categoryFilter === 'solana') return t.category === 'solana';
    return true;
  });

  return (
    <div className="w-full bg-[#0e121b] border-b border-slate-800/80 px-4 py-2.5 overflow-x-auto no-scrollbar flex items-center gap-3">
      {/* Quick Filter Pills */}
      <div className="flex items-center gap-1 bg-[#090d14] p-1 rounded-xl border border-slate-800 flex-shrink-0">
        <button
          onClick={() => setCategoryFilter('all')}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
            categoryFilter === 'all'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Tous ({tokens.length})
        </button>
        <button
          onClick={() => setCategoryFilter('solana')}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
            categoryFilter === 'solana'
              ? 'bg-purple-600/40 text-emerald-300 border border-emerald-500/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>🪐 Solana (5)</span>
        </button>
      </div>

      <div className="h-6 w-[1px] bg-slate-800 flex-shrink-0" />

      {/* Tokens List */}
      <div className="flex items-center gap-3 min-w-max">
        {visibleTokens.map((token) => {
          const ticker = tickers[token.symbol];
          const isSelected = token.id === selectedTokenId;
          const flash = flashStates[token.symbol];
          const priceChange = ticker?.priceChangePercent ?? 0;
          const isPositive = priceChange >= 0;

          // Format price with proper precision
          const formattedPrice = ticker?.lastPrice !== undefined
            ? ticker.lastPrice < 1
              ? ticker.lastPrice.toFixed(token.precision)
              : ticker.lastPrice.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: token.precision,
                })
            : '---';

          return (
            <button
              key={token.id}
              onClick={() => onSelectToken(token)}
              className={`flex items-center gap-3 px-3.5 py-2 rounded-xl text-left border transition-all cursor-pointer select-none ${
                isSelected
                  ? 'bg-slate-800/90 border-indigo-500 shadow-md shadow-indigo-500/10 ring-1 ring-indigo-500/40'
                  : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700'
              } ${
                flash === 'up'
                  ? 'ring-2 ring-emerald-500/60 bg-emerald-950/30'
                  : flash === 'down'
                  ? 'ring-2 ring-rose-500/60 bg-rose-950/30'
                  : ''
              }`}
            >
              {/* Token symbol & exchange */}
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm text-slate-100 tracking-tight">
                    {token.baseAsset}
                  </span>
                  <span
                    className={`text-[9px] uppercase px-1.5 py-0.2 rounded font-semibold tracking-wider ${
                      token.exchange === 'binance'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    }`}
                  >
                    {token.exchange}
                  </span>
                  {token.category === 'solana' && (
                    <span className="text-[9px] uppercase px-1.5 py-0.2 rounded font-semibold tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      SOL
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                  {token.name}
                </div>
              </div>

              {/* Price & Change */}
              <div className="text-right">
                <div className="text-sm font-semibold font-mono tracking-tight text-white">
                  ${formattedPrice}
                </div>
                <div
                  className={`text-[11px] font-mono font-medium flex items-center justify-end gap-0.5 ${
                    isPositive ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {isPositive ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
                  <span>
                    {isPositive ? '+' : ''}
                    {priceChange.toFixed(2)}%
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
