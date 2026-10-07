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

  const isSolanaPage = tokens.length > 0 && tokens.every((t) => t.category === 'solana');
  const isHyperliquidPage = tokens.length > 0 && tokens.every((t) => t.category === 'hyperliquid');

  return (
    <div className="w-full bg-[#0e121b] border-b border-slate-800/80 px-4 py-2.5 overflow-x-auto no-scrollbar flex items-center gap-3">
      {/* Page Badge Indicator */}
      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold flex-shrink-0 select-none ${
        isSolanaPage
          ? 'bg-gradient-to-r from-purple-950/60 to-emerald-950/60 text-emerald-300 border-emerald-500/30'
          : isHyperliquidPage
          ? 'bg-gradient-to-r from-teal-950/60 to-cyan-950/60 text-teal-300 border-teal-500/30'
          : 'bg-slate-900 border-slate-800 text-slate-300'
      }`}>
        <span className={`w-2 h-2 rounded-full ${
          isSolanaPage ? 'bg-emerald-400 animate-pulse' : isHyperliquidPage ? 'bg-teal-400 animate-pulse' : 'bg-indigo-400'
        }`} />
        <span>
          {isSolanaPage
            ? '🪐 Écosystème Solana (5)'
            : isHyperliquidPage
            ? '⚡ Écosystème Hyperliquid (5)'
            : '🌐 Marchés Globaux (7)'}
        </span>
      </div>

      <div className="h-6 w-[1px] bg-slate-800 flex-shrink-0" />

      {/* Tokens List */}
      <div className="flex items-center gap-3 min-w-max">
        {tokens.map((token) => {
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
                        : token.exchange === 'hyperliquid'
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
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
                  {token.category === 'hyperliquid' && (
                    <span className="text-[9px] uppercase px-1.5 py-0.2 rounded font-semibold tracking-wider bg-teal-500/20 text-teal-300 border border-teal-500/30">
                      HYPE
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
