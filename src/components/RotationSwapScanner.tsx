import React, { useState, useMemo } from 'react';
import type { TokenConfig, TickerData } from '../types/crypto';
import {
  Repeat,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ExternalLink,
  Zap,
} from 'lucide-react';

interface RotationSwapScannerProps {
  tokens: TokenConfig[];
  tickers: Record<string, TickerData>;
  onSelectToken: (token: TokenConfig) => void;
}

export const RotationSwapScanner: React.FC<RotationSwapScannerProps> = ({
  tokens,
  tickers,
  onSelectToken,
}) => {
  const [swapAmount, setSwapAmount] = useState<number>(1000); // in USD

  // Calculate rotation rankings
  // Top Strongest (Top Gainer / Highest 24h Range) vs Deepest Dump (Top Loser / Lowest 24h Range)
  const rotationAnalysis = useMemo(() => {
    const list = tokens
      .map((token) => {
        const ticker = tickers[token.symbol];
        const last = ticker?.lastPrice ?? 0;
        const changePcnt = ticker?.priceChangePercent ?? 0;
        const high = ticker?.highPrice ?? 0;
        const low = ticker?.lowPrice ?? 0;
        const span = high - low;
        const rangePct = span > 0 ? Math.min(Math.max(((last - low) / span) * 100, 0), 100) : 50;

        // Upside potential if token rebounds back to its 24h High
        const upsideToHighPct = last > 0 && high > last ? ((high - last) / last) * 100 : 0;
        // Upside potential if token rebounds to 24h Mid-range
        const midPrice = (high + low) / 2;
        const upsideToMidPct = last > 0 && midPrice > last ? ((midPrice - last) / last) * 100 : 0;

        return {
          token,
          ticker,
          lastPrice: last,
          changePcnt,
          rangePct,
          upsideToHighPct,
          upsideToMidPct,
        };
      })
      .filter((item) => item.lastPrice > 0);

    if (list.length < 2) return null;

    // Sort by 24h change descending: index 0 is strongest (Sell candidate), last index is deepest dump (Buy candidate)
    const sortedByChange = [...list].sort((a, b) => b.changePcnt - a.changePcnt);
    const strongest = sortedByChange[0]; // Best performer to sell/take profit
    const deepestDump = sortedByChange[sortedByChange.length - 1]; // Deepest dip to buy

    // Performance spread
    const spreadPct = strongest.changePcnt - deepestDump.changePcnt;

    // Potential profit if buying deepest dump and it rebounds to 24h High
    const estimatedProfitHigh = (swapAmount * deepestDump.upsideToHighPct) / 100;
    const estimatedProfitMid = (swapAmount * deepestDump.upsideToMidPct) / 100;

    // Top 3 alternative swap pairs
    const alternativeOpportunities = [];
    for (let i = 0; i < Math.min(sortedByChange.length, 3); i++) {
      const sellCandidate = sortedByChange[i];
      const buyCandidate = sortedByChange[sortedByChange.length - 1 - i];
      if (sellCandidate.token.id !== buyCandidate.token.id) {
        alternativeOpportunities.push({
          sell: sellCandidate,
          buy: buyCandidate,
          spread: sellCandidate.changePcnt - buyCandidate.changePcnt,
          potentialReboundPct: buyCandidate.upsideToHighPct,
        });
      }
    }

    return {
      strongest,
      deepestDump,
      spreadPct,
      estimatedProfitHigh,
      estimatedProfitMid,
      alternativeOpportunities,
    };
  }, [tokens, tickers, swapAmount]);

  if (!rotationAnalysis) return null;

  const {
    strongest,
    deepestDump,
    spreadPct,
    estimatedProfitHigh,
    estimatedProfitMid,
    alternativeOpportunities,
  } = rotationAnalysis;

  const getExchangeUrl = (token: TokenConfig) => {
    if (token.exchange === 'binance') {
      return `https://www.binance.com/en/trade/${token.baseAsset}_${token.quoteAsset}?type=spot`;
    }
    return `https://www.bybit.com/trade/spot/${token.baseAsset}/${token.quoteAsset}`;
  };

  return (
    <div className="bg-[#0b0e14] border-t border-slate-800 p-4 lg:p-6 space-y-4">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Zap className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight m-0">
              Scanner de Rotation & Arbitrage de Basket (Swap Profitable)
            </h2>
            <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm shadow-emerald-500/20">
              Optimal Swap Signal
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Stratégie de Rotation: Vendre le token le plus fort / en pump et racheter le token le plus bas / en dump pour capter le rebond.
          </p>
        </div>

        {/* Swap Simulation Capital Input */}
        <div className="flex items-center gap-2 bg-[#0d121c] p-1.5 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400 font-semibold pl-2">Montant du Swap:</span>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">$</span>
            <input
              type="number"
              value={swapAmount}
              onChange={(e) => setSwapAmount(Math.max(Number(e.target.value) || 0, 10))}
              className="w-24 bg-[#090d14] border border-slate-700 rounded-lg pl-6 pr-2 py-1 text-xs text-white font-mono font-bold focus:outline-none focus:border-indigo-500"
            />
          </div>
          <span className="text-xs text-slate-500 font-mono pr-1">USDT</span>
        </div>
      </div>

      {/* Main Rotation Flash Recommendation Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 bg-gradient-to-r from-slate-900/90 via-[#0d121c] to-slate-900/90 border border-indigo-500/30 rounded-2xl p-4 lg:p-5 shadow-xl relative overflow-hidden">
        {/* Glow decoration */}
        <div className="absolute -right-20 -top-20 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-60 h-60 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Left: SELL Token (Overbought / Top Performer) */}
        <div className="lg:col-span-4 bg-[#090d14]/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                <TrendingDown className="w-3 h-3" />
                <span>1. VENDRE / SWAP DEPUIS</span>
              </span>
              <span className="text-xs text-slate-400 font-mono">Le + Fort</span>
            </div>

            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-base shadow-lg bg-gradient-to-br ${strongest.token.accentGradient}`}
              >
                {strongest.token.baseAsset.slice(0, 3)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-white">{strongest.token.baseAsset}</span>
                  <span className="text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                    {strongest.token.exchange}
                  </span>
                </div>
                <div className="text-xs text-slate-400">{strongest.token.name}</div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-slate-400">Prix Actuel</div>
                <div className="text-base font-bold font-mono text-white">
                  ${strongest.lastPrice < 1 ? strongest.lastPrice.toFixed(strongest.token.precision) : strongest.lastPrice.toFixed(2)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-slate-400">Variation 24h</div>
                <div
                  className={`text-base font-bold font-mono ${
                    strongest.changePcnt >= 0 ? 'text-emerald-400' : 'text-slate-200'
                  }`}
                >
                  {strongest.changePcnt >= 0 ? '+' : ''}{strongest.changePcnt.toFixed(2)}%
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => onSelectToken(strongest.token)}
            className="mt-4 w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition"
          >
            Examiner la charte {strongest.token.baseAsset}
          </button>
        </div>

        {/* Center: Arrow & Spread Metrics */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center p-3 text-center">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-md mb-2">
            <Repeat className="w-6 h-6 animate-pulse" />
          </div>

          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Écart de Performance (Spread)
          </div>
          <div className="text-3xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 my-1">
            +{spreadPct.toFixed(2)}%
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <span>Rotation Recommandée</span>
            <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
          </div>

          {/* Profit estimates box */}
          <div className="mt-3 w-full bg-[#090d14]/80 border border-slate-800 rounded-xl p-3 text-left">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-400">Profit Rebond (24h High):</span>
              <span className="font-bold font-mono text-emerald-400">
                +{deepestDump.upsideToHighPct.toFixed(2)}% (+${estimatedProfitHigh.toFixed(2)})
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Profit Rebond (Mid-Range):</span>
              <span className="font-bold font-mono text-cyan-400">
                +{deepestDump.upsideToMidPct.toFixed(2)}% (+${estimatedProfitMid.toFixed(2)})
              </span>
            </div>
          </div>
        </div>

        {/* Right: BUY Token (Oversold / Deepest Dump) */}
        <div className="lg:col-span-4 bg-[#090d14]/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                <span>2. ACHETER / ROTATER VERS</span>
              </span>
              <span className="text-xs text-rose-400 font-mono font-bold">Deep Dip</span>
            </div>

            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-base shadow-lg bg-gradient-to-br ${deepestDump.token.accentGradient}`}
              >
                {deepestDump.token.baseAsset.slice(0, 3)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-white">{deepestDump.token.baseAsset}</span>
                  <span className="text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                    {deepestDump.token.exchange}
                  </span>
                </div>
                <div className="text-xs text-slate-400">{deepestDump.token.name}</div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-slate-400">Prix d'Achat (Dip)</div>
                <div className="text-base font-bold font-mono text-emerald-400">
                  ${deepestDump.lastPrice < 1 ? deepestDump.lastPrice.toFixed(deepestDump.token.precision) : deepestDump.lastPrice.toFixed(2)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-slate-400">Dip 24h</div>
                <div className="text-base font-bold font-mono text-rose-400">
                  {deepestDump.changePcnt.toFixed(2)}%
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() => onSelectToken(deepestDump.token)}
              className="flex-1 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition"
            >
              Examiner {deepestDump.token.baseAsset}
            </button>
            <a
              href={getExchangeUrl(deepestDump.token)}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Exécuter sur l'Exchange"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Alternative Swap Opportunities List */}
      <div>
        <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-300">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Autres Paires de Rotation Disponibles dans le Basket:</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {alternativeOpportunities.map((item, idx) => (
            <div
              key={idx}
              className="bg-[#0d121c] border border-slate-800 hover:border-slate-700 rounded-xl p-3 transition flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <div className="text-xs font-mono font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                  {item.sell.token.baseAsset} ({item.sell.changePcnt >= 0 ? '+' : ''}{item.sell.changePcnt.toFixed(1)}%)
                </div>
                <ArrowRight className="w-3 h-3 text-slate-500" />
                <div className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  {item.buy.token.baseAsset} ({item.buy.changePcnt.toFixed(1)}%)
                </div>
              </div>

              <div className="text-right">
                <div className="text-[10px] text-slate-400 font-mono">Spread: +{item.spread.toFixed(2)}%</div>
                <div className="text-xs font-bold font-mono text-emerald-400">
                  +{item.potentialReboundPct.toFixed(1)}% Rebond
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
