import React, { useEffect, useRef, useState } from 'react';
import type { TokenConfig, TickerData } from '../types/crypto';

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

  return (
    <div className="w-full border-b border-line bg-ground">
      <div className="mx-auto flex max-w-[1440px] items-center gap-1 overflow-x-auto px-4 py-2 no-scrollbar sm:px-6">
        {tokens.map((token) => {
          const ticker = tickers[token.symbol];
          const isSelected = token.id === selectedTokenId;
          const flash = flashStates[token.symbol];
          const priceChange = ticker?.priceChangePercent ?? 0;
          const isPositive = priceChange >= 0;

          const formattedPrice = ticker?.lastPrice !== undefined
            ? ticker.lastPrice < 1
              ? ticker.lastPrice.toFixed(token.precision)
              : ticker.lastPrice.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: token.precision,
                })
            : '—';

          return (
            <button
              key={token.id}
              onClick={() => onSelectToken(token)}
              className={`flex h-10 shrink-0 items-center gap-3 rounded-lg border px-3 text-sm transition-colors cursor-pointer select-none ${
                isSelected
                  ? 'border-line-strong bg-surface'
                  : 'border-transparent hover:bg-white/[0.04]'
              }`}
            >
              <span className={`font-semibold ${isSelected ? 'text-ink' : 'text-ink-mid'}`}>{token.baseAsset}</span>
              <span
                className={`font-mono tabular-nums transition-colors ${
                  flash === 'up' ? 'text-up' : flash === 'down' ? 'text-down' : 'text-ink'
                }`}
              >
                ${formattedPrice}
              </span>
              <span className={`font-mono text-xs tabular-nums ${isPositive ? 'text-up' : 'text-down'}`}>
                {isPositive ? '+' : ''}
                {priceChange.toFixed(2)}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
