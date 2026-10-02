import React, { useState, useMemo } from 'react';
import type { TokenConfig, TickerData, Stats30d } from '../types/crypto';
import {
  ArrowUpRight,
  ArrowDownRight,
  ArrowUpDown,
  Search,
  LineChart,
  Layers,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Flame,
} from 'lucide-react';

interface TopResult {
  token: TokenConfig;
  ticker: TickerData;
}

interface DeepestDipResult {
  token: TokenConfig;
  stat: Stats30d;
}

interface MarketTable24hProps {
  tokens: TokenConfig[];
  tickers: Record<string, TickerData>;
  stats30dMap?: Record<string, Stats30d>;
  onSelectToken: (token: TokenConfig) => void;
}

type SortField =
  | 'name'
  | 'lastPrice'
  | 'priceChangePercent'
  | 'highPrice'
  | 'lowPrice'
  | 'quoteVolume'
  | 'volume'
  | 'drop30d';

type SortDirection = 'asc' | 'desc';

export const MarketTable24h: React.FC<MarketTable24hProps> = ({
  tokens,
  tickers,
  stats30dMap = {},
  onSelectToken,
}) => {
  const [exchangeFilter, setExchangeFilter] = useState<'all' | 'solana' | 'binance' | 'bybit'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('quoteVolume');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  // Handle sorting toggles
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  // Filter and sort items
  const filteredAndSortedTokens = useMemo(() => {
    return tokens
      .filter((token) => {
        // Exchange / Category filter
        if (exchangeFilter === 'solana' && token.category !== 'solana') {
          return false;
        }
        if (exchangeFilter === 'binance' && token.exchange !== 'binance') {
          return false;
        }
        if (exchangeFilter === 'bybit' && token.exchange !== 'bybit') {
          return false;
        }
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            token.name.toLowerCase().includes(q) ||
            token.baseAsset.toLowerCase().includes(q) ||
            token.symbol.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        const tickA = tickers[a.symbol];
        const tickB = tickers[b.symbol];
        const statA = stats30dMap[a.symbol];
        const statB = stats30dMap[b.symbol];

        let valA: number = 0;
        let valB: number = 0;

        if (sortField === 'name') {
          return sortDir === 'asc'
            ? a.baseAsset.localeCompare(b.baseAsset)
            : b.baseAsset.localeCompare(a.baseAsset);
        }

        if (sortField === 'lastPrice') {
          valA = tickA?.lastPrice ?? 0;
          valB = tickB?.lastPrice ?? 0;
        } else if (sortField === 'priceChangePercent') {
          valA = tickA?.priceChangePercent ?? 0;
          valB = tickB?.priceChangePercent ?? 0;
        } else if (sortField === 'highPrice') {
          valA = tickA?.highPrice ?? 0;
          valB = tickB?.highPrice ?? 0;
        } else if (sortField === 'lowPrice') {
          valA = tickA?.lowPrice ?? 0;
          valB = tickB?.lowPrice ?? 0;
        } else if (sortField === 'quoteVolume') {
          valA = tickA?.quoteVolume ?? 0;
          valB = tickB?.quoteVolume ?? 0;
        } else if (sortField === 'volume') {
          valA = tickA?.volume ?? 0;
          valB = tickB?.volume ?? 0;
        } else if (sortField === 'drop30d') {
          // Compare drop from 30D High
          valA = statA?.dropFromHighPct ?? 0;
          valB = statB?.dropFromHighPct ?? 0;
        }

        return sortDir === 'asc' ? valA - valB : valB - valA;
      });
  }, [tokens, tickers, stats30dMap, exchangeFilter, searchQuery, sortField, sortDir]);

  // Aggregate stats
  const totalTurnover = useMemo(() => {
    return Object.values(tickers).reduce((sum, t) => sum + (t.quoteVolume || 0), 0);
  }, [tickers]);

  const topGainer = useMemo<TopResult | null>(() => {
    let best: TopResult | null = null;
    tokens.forEach((token) => {
      const ticker = tickers[token.symbol];
      if (ticker) {
        if (!best || ticker.priceChangePercent > best.ticker.priceChangePercent) {
          best = { token, ticker };
        }
      }
    });
    return best;
  }, [tokens, tickers]);

  // Deepest 30-Day Drawdown Token (Deepest monthly dip)
  const deepestMonthlyDip = useMemo<DeepestDipResult | null>(() => {
    let deepest: DeepestDipResult | null = null;
    tokens.forEach((token) => {
      const stat = stats30dMap[token.symbol];
      if (stat) {
        if (!deepest || stat.dropFromHighPct < deepest.stat.dropFromHighPct) {
          deepest = { token, stat };
        }
      }
    });
    return deepest;
  }, [tokens, stats30dMap]);

  return (
    <div className="bg-[#0b0e14] border-t border-slate-800 p-4 lg:p-6 space-y-4">
      {/* Header & Quick Stats Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Layers className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight m-0">
              Tableau des Marchés • 24h & Écart Sommet Mensuel (30D High)
            </h2>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Live Binance & Bybit
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Indicateur clé: Mesure du recul par rapport au plus haut du mois (30D High) pour détecter les plus grands rabais (Dips).
          </p>
        </div>

        {/* Aggregate Mini KPI Cards */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Total 24h Turnover */}
          <div className="flex items-center gap-2 bg-[#0e131d] px-3 py-1.5 rounded-xl border border-slate-800">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="text-[10px] text-slate-400">Total Volume 24h</div>
              <div className="text-xs font-bold font-mono text-white">
                ${(totalTurnover / 1_000_000).toFixed(2)}M USDT
              </div>
            </div>
          </div>

          {/* Top Gainer 24h */}
          {topGainer && (
            <div className="flex items-center gap-2 bg-[#0e131d] px-3 py-1.5 rounded-xl border border-slate-800">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <div>
                <div className="text-[10px] text-slate-400">Top 24h Gainer</div>
                <div className="text-xs font-bold font-mono text-emerald-400">
                  {topGainer.token.baseAsset} +{topGainer.ticker.priceChangePercent.toFixed(2)}%
                </div>
              </div>
            </div>
          )}

          {/* Deepest 30-Day Dip */}
          {deepestMonthlyDip && (
            <div className="flex items-center gap-2 bg-[#0e131d] px-3 py-1.5 rounded-xl border border-slate-800">
              <Flame className="w-4 h-4 text-rose-400" />
              <div>
                <div className="text-[10px] text-slate-400">Plus Grand Dip 30J</div>
                <div className="text-xs font-bold font-mono text-rose-400">
                  {deepestMonthlyDip.token.baseAsset} {deepestMonthlyDip.stat.dropFromHighPct.toFixed(1)}% vs Max
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0d121c] p-3 rounded-xl border border-slate-800/80">
        {/* Exchange Filter Pills */}
        <div className="flex items-center gap-1.5 bg-[#090d14] p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setExchangeFilter('all')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
              exchangeFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Tous ({tokens.length})
          </button>
          <button
            onClick={() => setExchangeFilter('solana')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              exchangeFilter === 'solana'
                ? 'bg-purple-600/30 text-emerald-300 border border-emerald-500/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>🪐 Solana Hub ({tokens.filter((t) => t.category === 'solana').length})</span>
          </button>
          <button
            onClick={() => setExchangeFilter('binance')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              exchangeFilter === 'binance'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>Binance</span>
          </button>
          <button
            onClick={() => setExchangeFilter('bybit')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              exchangeFilter === 'bybit'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>Bybit</span>
          </button>
        </div>

        {/* Search input */}
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher token (ex: SOL, Sui...)"
            className="w-full bg-[#090d14] border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#0d111a] shadow-lg">
        <table className="w-full text-left text-xs font-mono">
          {/* Table Header */}
          <thead className="bg-[#090d14] text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 select-none">
            <tr>
              <th className="py-3 px-4 font-semibold">#</th>
              <th
                onClick={() => handleSort('name')}
                className="py-3 px-4 font-semibold cursor-pointer hover:text-slate-200 transition"
              >
                <div className="flex items-center gap-1">
                  <span>Token / Marché</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>

              {/* Dernier Prix column with Monthly Peak highlight */}
              <th
                onClick={() => handleSort('lastPrice')}
                className="py-3 px-4 font-semibold text-right cursor-pointer hover:text-slate-200 transition"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Dernier Prix ($)</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>

              {/* Dedicated Column: Écart vs Max Chhar (30D High Drawdown) */}
              <th
                onClick={() => handleSort('drop30d')}
                className="py-3 px-4 font-semibold text-right cursor-pointer hover:text-slate-200 transition bg-indigo-950/20 border-x border-indigo-500/20"
              >
                <div className="flex items-center justify-end gap-1 text-indigo-300">
                  <Flame className="w-3 h-3 text-amber-400" />
                  <span>Écart Sommet 30J (Max Chhar)</span>
                  <ArrowUpDown className="w-3 h-3 text-indigo-400" />
                </div>
              </th>

              <th
                onClick={() => handleSort('priceChangePercent')}
                className="py-3 px-4 font-semibold text-right cursor-pointer hover:text-slate-200 transition"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Variation 24h (%)</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>
              <th
                onClick={() => handleSort('highPrice')}
                className="py-3 px-4 font-semibold text-right cursor-pointer hover:text-slate-200 transition hidden md:table-cell"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>24h High ($)</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>
              <th
                onClick={() => handleSort('lowPrice')}
                className="py-3 px-4 font-semibold text-right cursor-pointer hover:text-slate-200 transition hidden md:table-cell"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>24h Low ($)</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>
              <th className="py-3 px-4 font-semibold text-center hidden lg:table-cell min-w-[140px]">
                Plage 24h
              </th>
              <th
                onClick={() => handleSort('quoteVolume')}
                className="py-3 px-4 font-semibold text-right cursor-pointer hover:text-slate-200 transition"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Volume 24h (USDT)</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>
              <th className="py-3 px-4 font-semibold text-center">Action</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-800/60">
            {filteredAndSortedTokens.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-8 text-center text-slate-500">
                  Aucun token trouvé correspondant à votre recherche.
                </td>
              </tr>
            ) : (
              filteredAndSortedTokens.map((token, index) => {
                const ticker = tickers[token.symbol];
                const stat30 = stats30dMap[token.symbol];

                const price = ticker?.lastPrice ?? 0;
                const changePcnt = ticker?.priceChangePercent ?? 0;
                const changeAbs = ticker?.priceChange ?? 0;
                const high = ticker?.highPrice ?? 0;
                const low = ticker?.lowPrice ?? 0;
                const quoteVol = ticker?.quoteVolume ?? 0;
                const isPos = changePcnt >= 0;

                // 24h range percentage
                const span = high - low;
                const rangePct = span > 0 ? Math.min(Math.max(((price - low) / span) * 100, 0), 100) : 50;

                return (
                  <tr
                    key={token.id}
                    onClick={() => onSelectToken(token)}
                    className="hover:bg-slate-800/50 transition cursor-pointer group"
                  >
                    {/* Index */}
                    <td className="py-3.5 px-4 text-slate-500 font-semibold">{index + 1}</td>

                    {/* Token */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-md bg-gradient-to-br ${token.accentGradient}`}
                        >
                          {token.baseAsset.slice(0, 3)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-100 text-sm">{token.baseAsset}</span>
                            <span
                              className={`text-[9px] uppercase px-1.5 py-0.2 rounded font-semibold ${
                                token.exchange === 'binance'
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                              }`}
                            >
                              {token.exchange}
                            </span>
                            {token.category === 'solana' && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                {token.ecosystemRole?.split('&')[0] || 'Solana'}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 font-sans mt-0.5">
                            {token.name}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Dernier Prix ($) with 30D peak drawdown label */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="text-sm font-bold text-white font-mono">
                        ${price < 1
                          ? price.toFixed(token.precision)
                          : price.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: token.precision,
                            })}
                      </div>
                      <div className="flex items-center justify-end gap-1.5 mt-0.5">
                        <span className="text-[10px] text-slate-500 font-mono">
                          {isPos ? '+' : ''}${changeAbs.toFixed(token.precision)}
                        </span>
                        {stat30 && (
                          <span
                            className="text-[9px] font-mono px-1 py-0.2 rounded font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30"
                            title={`A3la prix had chhar (30D High): $${stat30.high30d}. Khasser: ${stat30.dropFromHighPct.toFixed(2)}%`}
                          >
                            {stat30.dropFromHighPct.toFixed(1)}% vs 30D High
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Dedicated Column: Écart Sommet 30 Jours (Max Chhar) */}
                    <td className="py-3.5 px-4 text-right bg-indigo-950/10 border-x border-indigo-500/20">
                      {stat30 ? (
                        <div>
                          <div className="text-xs font-bold font-mono text-rose-400 flex items-center justify-end gap-0.5">
                            <TrendingDown className="w-3.5 h-3.5 text-rose-400 inline" />
                            <span>{stat30.dropFromHighPct.toFixed(2)}%</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Sommet: ${stat30.high30d < 1 ? stat30.high30d.toFixed(token.precision) : stat30.high30d.toLocaleString()}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-[10px]">Calcul...</span>
                      )}
                    </td>

                    {/* 24h Change */}
                    <td className="py-3.5 px-4 text-right">
                      <span
                        className={`inline-flex items-center gap-0.5 px-2.5 py-1 rounded-md text-xs font-bold font-mono ${
                          isPos
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {isPos ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                        {isPos ? '+' : ''}{changePcnt.toFixed(2)}%
                      </span>
                    </td>

                    {/* 24h High */}
                    <td className="py-3.5 px-4 text-right text-emerald-400 font-semibold hidden md:table-cell">
                      ${high < 1 ? high.toFixed(token.precision) : high.toFixed(2)}
                    </td>

                    {/* 24h Low */}
                    <td className="py-3.5 px-4 text-right text-rose-400 font-semibold hidden md:table-cell">
                      ${low < 1 ? low.toFixed(token.precision) : low.toFixed(2)}
                    </td>

                    {/* 24h Range Bar */}
                    <td className="py-3.5 px-4 hidden lg:table-cell">
                      <div className="w-full">
                        <div className="w-full h-1.5 bg-slate-800 rounded-full relative overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400 rounded-full"
                            style={{ width: '100%' }}
                          />
                          <div
                            className="absolute top-0 bottom-0 w-1.5 bg-white rounded-full -translate-x-1/2"
                            style={{ left: `${rangePct}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[9px] text-slate-500 mt-1">
                          <span>Low</span>
                          <span className="text-slate-300 font-medium">{rangePct.toFixed(0)}%</span>
                          <span>High</span>
                        </div>
                      </div>
                    </td>

                    {/* 24h Volume USDT */}
                    <td className="py-3.5 px-4 text-right text-slate-200 font-bold">
                      ${quoteVol > 1_000_000
                        ? `${(quoteVol / 1_000_000).toFixed(2)}M`
                        : quoteVol.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectToken(token);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600/20 group-hover:bg-indigo-600 text-indigo-300 group-hover:text-white transition font-semibold text-[11px] flex items-center gap-1 mx-auto"
                      >
                        <LineChart className="w-3.5 h-3.5" />
                        <span>Chart</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
