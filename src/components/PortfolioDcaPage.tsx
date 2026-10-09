import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { TickerData, TokenConfig } from '../types/crypto';
import { CROSS_TOKENS } from '../config/crossPairs';
import { TOKENS } from '../config/tokens';
import { Plus, Trash2, ChevronDown, X, Repeat } from 'lucide-react';
import { AccumulationCurvesSection } from './AccumulationCurvesSection';
import { PortfolioCompareChart } from './PortfolioCompareChart';

interface PortfolioDcaPageProps {
  tickers: Record<string, TickerData>;
}

export interface SimpleTransaction {
  id: string;
  type: 'buy' | 'sell';
  amountUsd: number; // Montant en dollar
  price: number;     // Prix d'achat ou de vente
  timestamp: number;
}

const STORAGE_KEY = 'apex_simple_dca_portfolio_v4';
const BASKET_STORAGE_KEY = 'apex_custom_basket_tokens_v2';

const POPULAR_SUGGESTIONS = ['BTC', 'ETH', 'JUP', 'MET', 'PUMP', 'DOGE', 'NEAR', 'AVAX'];

// ---------- Formatting helpers ----------
const fmtPrice = (p: number) => {
  if (!p) return '—';
  if (p < 0.01) return p.toFixed(6);
  if (p < 1) return p.toFixed(4);
  return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtUsd = (v: number) =>
  `$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtSignedUsd = (v: number) => `${v >= 0 ? '+' : '−'}${fmtUsd(v)}`;
const fmtPct = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}%`;
const fmtUnits = (u: number) => (u === 0 ? '0' : u < 1 ? u.toFixed(4) : u < 1000 ? u.toFixed(2) : u.toFixed(0));
const pnlColor = (v: number) => (v > 0 ? 'text-up' : v < 0 ? 'text-down' : 'text-ink-dim');
const fmtDate = (ts: number) =>
  new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) +
  ' ' +
  new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

export const PortfolioDcaPage: React.FC<PortfolioDcaPageProps> = ({ tickers }) => {
  // 1. Dynamic Basket Tokens (defaults to the 6 core tokens: SOL, SUI, ZEC, MON, HYPE, PENGU)
  const [basketTokens, setBasketTokens] = useState<TokenConfig[]>(() => {
    try {
      const saved = localStorage.getItem(BASKET_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load basket tokens:', e);
    }
    return CROSS_TOKENS;
  });

  // Save basket tokens to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(BASKET_STORAGE_KEY, JSON.stringify(basketTokens));
    } catch (e) {
      console.error('Failed to save basket tokens:', e);
    }
  }, [basketTokens]);

  // 2. Custom Tickers for tokens added outside default config (e.g. BTC, ETH)
  const [customTickers, setCustomTickers] = useState<Record<string, TickerData>>({});

  // Fetch ticker from Binance public API
  const fetchPriceForSymbol = useCallback(async (symbol: string) => {
    try {
      const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
      if (res.ok) {
        const data = await res.json();
        setCustomTickers((prev) => ({
          ...prev,
          [symbol]: {
            symbol,
            exchange: 'binance',
            lastPrice: parseFloat(data.lastPrice),
            priceChange: parseFloat(data.priceChange),
            priceChangePercent: parseFloat(data.priceChangePercent),
            highPrice: parseFloat(data.highPrice),
            lowPrice: parseFloat(data.lowPrice),
            volume: parseFloat(data.volume),
            quoteVolume: parseFloat(data.quoteVolume),
            timestamp: Date.now(),
          },
        }));
      }
    } catch (err) {
      console.warn(`Could not fetch Binance ticker for ${symbol}:`, err);
    }
  }, []);

  // Keep custom tickers updated
  useEffect(() => {
    const checkAndFetch = () => {
      basketTokens.forEach((t) => {
        if (!tickers[t.symbol]) {
          fetchPriceForSymbol(t.symbol);
        }
      });
    };

    checkAndFetch();
    const interval = setInterval(checkAndFetch, 10000);
    return () => clearInterval(interval);
  }, [basketTokens, tickers, fetchPriceForSymbol]);

  // Helper to get real-time price
  const getLivePrice = useCallback(
    (token: TokenConfig): number => {
      return tickers[token.symbol]?.lastPrice || customTickers[token.symbol]?.lastPrice || 0;
    },
    [tickers, customTickers]
  );

  const get24hChange = useCallback(
    (token: TokenConfig): number | undefined => {
      return tickers[token.symbol]?.priceChangePercent ?? customTickers[token.symbol]?.priceChangePercent;
    },
    [tickers, customTickers]
  );

  // 3. Transactions map per token ID: { sol: [...], zec: [...], ... }
  const [entriesMap, setEntriesMap] = useState<Record<string, SimpleTransaction[]>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load portfolio entries:', e);
    }
    // Default initial empty state for 6 core tokens
    return {
      sol: [],
      sui: [],
      zec: [],
      mon: [],
      hype: [],
      pengu: [],
    };
  });

  // Save entries to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entriesMap));
    } catch (e) {
      console.error('Failed to save portfolio:', e);
    }
  }, [entriesMap]);

  // Form mode state per token: 'buy' | 'sell'
  const [formModes, setFormModes] = useState<Record<string, 'buy' | 'sell'>>({});

  // Reinvest target per token
  const [reinvestTargetToken, setReinvestTargetToken] = useState<Record<string, string>>({});

  // Form inputs state per token: { [tokenId]: { amount: string, price: string } }
  const [inputs, setInputs] = useState<Record<string, { amount: string; price: string }>>({});

  // Expanded row in positions table
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Add Token input state
  const [showAddTokenBar, setShowAddTokenBar] = useState<boolean>(false);
  const [newSymbolInput, setNewSymbolInput] = useState<string>('');

  const getMode = (tokenId: string): 'buy' | 'sell' => {
    return formModes[tokenId] || 'buy';
  };

  const setMode = (tokenId: string, mode: 'buy' | 'sell') => {
    setFormModes((prev) => ({ ...prev, [tokenId]: mode }));
  };

  const getInput = (tokenId: string) => {
    return inputs[tokenId] || { amount: '10', price: '' };
  };

  const updateInput = (tokenId: string, field: 'amount' | 'price', value: string) => {
    setInputs((prev) => ({
      ...prev,
      [tokenId]: {
        ...getInput(tokenId),
        [field]: value,
      },
    }));
  };

  // Add Token to Basket
  const handleAddTokenToBasket = (rawSymbol: string) => {
    const clean = rawSymbol.trim().toUpperCase().replace(/\/?USDT$/, '');
    if (!clean) return;

    const lowerId = clean.toLowerCase();

    if (basketTokens.some((t) => t.id === lowerId || t.baseAsset.toUpperCase() === clean)) {
      alert(`${clean} est déjà dans le panier.`);
      return;
    }

    const found = TOKENS.find((t) => t.id === lowerId || t.baseAsset.toUpperCase() === clean);

    const newToken: TokenConfig = found || {
      id: lowerId,
      name: clean,
      symbol: `${clean}USDT`,
      displaySymbol: `${clean} / USDT`,
      baseAsset: clean,
      quoteAsset: 'USDT',
      exchange: 'binance',
      precision: 2,
      color: '#71717a',
      accentGradient: 'from-zinc-600 to-zinc-700',
      description: `${clean}`,
    };

    setBasketTokens((prev) => [...prev, newToken]);
    setNewSymbolInput('');
    setShowAddTokenBar(false);
    fetchPriceForSymbol(newToken.symbol);
  };

  // Remove Token from Basket
  const handleRemoveTokenFromBasket = (token: TokenConfig) => {
    if (basketTokens.length <= 1) {
      alert('Le panier doit contenir au moins un actif.');
      return;
    }

    const txCount = (entriesMap[token.id] || []).length;
    const confirmMsg = txCount > 0
      ? `Retirer ${token.baseAsset} du panier ? Ses ${txCount} transactions seront supprimées.`
      : `Retirer ${token.baseAsset} du panier ?`;

    if (window.confirm(confirmMsg)) {
      setBasketTokens((prev) => prev.filter((t) => t.id !== token.id));
      setEntriesMap((prev) => {
        const copy = { ...prev };
        delete copy[token.id];
        return copy;
      });
      if (expandedId === token.id) setExpandedId(null);
    }
  };

  // Add an entry (Buy or Sell) for a specific token
  const handleAddEntry = (tokenId: string) => {
    const mode = getMode(tokenId);
    const currentInput = getInput(tokenId);
    const amount = parseFloat(currentInput.amount);
    let price = parseFloat(currentInput.price);

    const tokenConfig = basketTokens.find((t) => t.id === tokenId);
    const livePrice = tokenConfig ? getLivePrice(tokenConfig) : 0;

    if ((isNaN(price) || price <= 0) && livePrice && livePrice > 0) {
      price = livePrice;
    }

    if (isNaN(amount) || amount <= 0) {
      alert('Montant invalide (ex : 10).');
      return;
    }

    if (isNaN(price) || price <= 0) {
      alert('Prix invalide (ex : 118).');
      return;
    }

    const newTx: SimpleTransaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: mode,
      amountUsd: amount,
      price,
      timestamp: Date.now(),
    };

    setEntriesMap((prev) => ({
      ...prev,
      [tokenId]: [...(prev[tokenId] || []), newTx],
    }));

    updateInput(tokenId, 'price', '');
  };

  // Delete a specific entry
  const handleDeleteEntry = (tokenId: string, entryId: string) => {
    setEntriesMap((prev) => ({
      ...prev,
      [tokenId]: (prev[tokenId] || []).filter((e) => e.id !== entryId),
    }));
  };

  // One-Click: Reinvest Profit from winning token into a lagging token
  const handleReinvestProfit = (fromTokenId: string, profitUsd: number, fromLivePrice: number) => {
    if (profitUsd <= 0.05) return;

    const availableTargets = basketTokens.filter((t) => t.id !== fromTokenId);
    const targetTokenId = reinvestTargetToken[fromTokenId] || (availableTargets[0]?.id || 'zec');
    const targetToken = basketTokens.find((t) => t.id === targetTokenId);
    if (!targetToken) return;

    const toLivePrice = getLivePrice(targetToken) || 1;

    const sellTx: SimpleTransaction = {
      id: `tx-profit-sell-${Date.now()}`,
      type: 'sell',
      amountUsd: profitUsd,
      price: fromLivePrice,
      timestamp: Date.now(),
    };

    const buyTx: SimpleTransaction = {
      id: `tx-profit-buy-${Date.now() + 1}`,
      type: 'buy',
      amountUsd: profitUsd,
      price: toLivePrice,
      timestamp: Date.now() + 1,
    };

    setEntriesMap((prev) => ({
      ...prev,
      [fromTokenId]: [...(prev[fromTokenId] || []), sellTx],
      [targetTokenId]: [...(prev[targetTokenId] || []), buyTx],
    }));
  };

  // Reset all transactions
  const handleResetAll = () => {
    if (window.confirm('Supprimer toutes les transactions ?')) {
      const emptyState: Record<string, SimpleTransaction[]> = {};
      basketTokens.forEach((t) => {
        emptyState[t.id] = [];
      });
      setEntriesMap(emptyState);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  // Reset Basket to Default 6 Tokens
  const handleResetDefaultBasket = () => {
    if (window.confirm('Restaurer le panier par défaut (SOL, SUI, ZEC, MON, HYPE, PENGU) ?')) {
      setBasketTokens(CROSS_TOKENS);
      localStorage.removeItem(BASKET_STORAGE_KEY);
    }
  };

  // Load a simple example with Buy & Sell
  const handleLoadSimpleExample = () => {
    const example: Record<string, SimpleTransaction[]> = {};
    basketTokens.forEach((t) => {
      const live = getLivePrice(t) || 10;
      example[t.id] = [
        { id: `ex-${t.id}-1`, type: 'buy', amountUsd: 15, price: live * 0.94, timestamp: Date.now() - 172800000 },
        { id: `ex-${t.id}-2`, type: 'buy', amountUsd: 10, price: live * 0.98, timestamp: Date.now() - 86400000 },
        { id: `ex-${t.id}-3`, type: 'sell', amountUsd: 8, price: live * 1.05, timestamp: Date.now() - 3600000 },
      ];
    });
    setEntriesMap(example);
  };

  // Calculate statistics for each token taking both BUY and SELL into account
  const tokenStats = useMemo(() => {
    return basketTokens.map((token) => {
      const tokenEntries = entriesMap[token.id] || [];
      const livePrice = getLivePrice(token);

      let coins = 0;
      let invested = 0; // Coût de revient de la position restante
      let totalBoughtUsd = 0;
      let totalSoldUsd = 0;
      let realizedProfit = 0;
      let avgBuyPrice = 0;

      // Trier chronologiquement
      const sortedTxs = [...tokenEntries].sort((a, b) => a.timestamp - b.timestamp);

      sortedTxs.forEach((tx) => {
        if (tx.type === 'buy') {
          const q = tx.price > 0 ? tx.amountUsd / tx.price : 0;
          coins += q;
          invested += tx.amountUsd;
          totalBoughtUsd += tx.amountUsd;
          avgBuyPrice = coins > 0 ? invested / coins : 0;
        } else if (tx.type === 'sell') {
          const q = tx.price > 0 ? tx.amountUsd / tx.price : 0;
          totalSoldUsd += tx.amountUsd;
          const costOfSold = q * avgBuyPrice;
          const profit = tx.amountUsd - costOfSold;
          realizedProfit += profit;
          coins = Math.max(0, coins - q);
          invested = Math.max(0, coins * avgBuyPrice);
        }
      });

      const currentValue = coins * livePrice;
      const unrealizedPnl = currentValue - invested;
      const totalPnlUsd = realizedProfit + unrealizedPnl;

      // PnL % sur la position restante par rapport au prix moyen
      const pnlPct = avgBuyPrice > 0 && livePrice > 0
        ? ((livePrice - avgBuyPrice) / avgBuyPrice) * 100
        : (totalBoughtUsd > 0 ? (totalPnlUsd / totalBoughtUsd) * 100 : 0);

      const isProfit = totalPnlUsd >= 0;

      return {
        token,
        entries: sortedTxs,
        hasEntries: tokenEntries.length > 0,
        coins,
        invested,
        totalBoughtUsd,
        totalSoldUsd,
        realizedProfit,
        avgBuyPrice,
        avgPrice: avgBuyPrice,
        livePrice,
        currentValue,
        unrealizedPnl,
        totalPnlUsd,
        pnlPct,
        isProfit,
      };
    });
  }, [basketTokens, entriesMap, getLivePrice]);

  // Global total stats
  const totalStats = useMemo(() => {
    let totalInvested = 0;
    let totalValue = 0;
    let totalRealized = 0;

    tokenStats.forEach((s) => {
      if (s.hasEntries) {
        totalInvested += s.invested;
        totalValue += s.currentValue;
        totalRealized += s.realizedProfit;
      }
    });

    const unrealized = totalValue - totalInvested;
    const netPnlUsd = unrealized + totalRealized;
    const netPnlPct = totalInvested > 0 ? (netPnlUsd / totalInvested) * 100 : 0;
    const unrealizedPct = totalInvested > 0 ? (unrealized / totalInvested) * 100 : 0;

    return {
      totalInvested,
      totalValue,
      totalRealized,
      unrealized,
      unrealizedPct,
      netPnlUsd,
      netPnlPct,
      isProfit: netPnlUsd >= 0,
    };
  }, [tokenStats]);

  // Prepare Accumulation Curve Data for each token
  const accumulationData = useMemo(() => {
    return basketTokens.map((token) => {
      const tokenEntries = entriesMap[token.id] || [];
      const sortedTxs = [...tokenEntries].sort((a, b) => a.timestamp - b.timestamp);

      let units = 0;
      let initialUnits = 0;
      let totalBoughtUnits = 0;
      let totalSoldUnits = 0;
      const historyPoints: { timestamp: number; units: number; type: 'buy' | 'sell' }[] = [];

      sortedTxs.forEach((tx) => {
        const q = tx.price > 0 ? tx.amountUsd / tx.price : 0;
        if (tx.type === 'buy') {
          units += q;
          totalBoughtUnits += q;
          if (initialUnits === 0) {
            initialUnits = q;
          }
        } else if (tx.type === 'sell') {
          units = Math.max(0, units - q);
          totalSoldUnits += q;
        }

        historyPoints.push({
          timestamp: tx.timestamp,
          units,
          type: tx.type,
        });
      });

      const unitsGrowthPct = initialUnits > 0
        ? ((units - initialUnits) / initialUnits) * 100
        : 0;

      return {
        token,
        entries: tokenEntries,
        currentUnits: units,
        totalBoughtUnits,
        totalSoldUnits,
        initialUnits,
        unitsGrowthPct,
        historyPoints,
      };
    });
  }, [basketTokens, entriesMap]);

  const hasAnyData = totalStats.totalInvested > 0 || totalStats.totalRealized !== 0;

  // Search + sort (toolbar)
  const [search, setSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<'value' | 'pnl' | 'name'>('value');

  const visibleStats = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? tokenStats.filter(
          (s) => s.token.baseAsset.toLowerCase().includes(q) || s.token.name.toLowerCase().includes(q)
        )
      : tokenStats;
    const sorted = [...filtered];
    if (sortBy === 'value') sorted.sort((a, b) => b.currentValue - a.currentValue);
    if (sortBy === 'pnl') sorted.sort((a, b) => (b.hasEntries ? b.pnlPct : -1e9) - (a.hasEntries ? a.pnlPct : -1e9));
    if (sortBy === 'name') sorted.sort((a, b) => a.token.baseAsset.localeCompare(b.token.baseAsset));
    return sorted;
  }, [tokenStats, search, sortBy]);

  const inputCls =
    'h-10 w-full rounded-lg border border-line-strong bg-well px-3 text-sm text-ink tabular-nums outline-none transition-colors placeholder:text-ink-faint focus:border-accent';

  const btnPrimary =
    'inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-bold text-ground transition-colors hover:bg-accent-bright active:translate-y-px cursor-pointer';
  const btnSecondary =
    'inline-flex items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-2 cursor-pointer';

  const chartPath =
    'M-30 190 C45 176 72 212 126 190 C184 166 206 92 274 114 C330 132 348 180 410 157 C476 133 490 56 554 75 C618 94 632 144 692 114 C738 90 776 42 824 54';

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-4 pt-6 pb-16 sm:px-6 lg:pt-8">
      {/* ===== Hero ===== */}
      <section className="relative min-h-[220px] overflow-hidden rounded-xl border border-line bg-surface sm:min-h-[270px] sm:rounded-2xl">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-full opacity-35 sm:w-[78%] sm:opacity-55 lg:w-[62%] lg:opacity-100">
          <svg viewBox="0 0 760 270" preserveAspectRatio="none" className="h-full w-full" aria-hidden="true">
            <defs>
              <linearGradient id="pf-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#69aac1" stopOpacity="0.19" />
                <stop offset="100%" stopColor="#69aac1" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="pf-fade" x1="0" x2="1">
                <stop offset="0%" stopColor="white" stopOpacity="0" />
                <stop offset="24%" stopColor="white" />
                <stop offset="100%" stopColor="white" />
              </linearGradient>
              <mask id="pf-mask">
                <rect width="760" height="270" fill="url(#pf-fade)" />
              </mask>
            </defs>
            <g mask="url(#pf-mask)">
              <path d={`${chartPath} L824 270 L-30 270 Z`} fill="url(#pf-area)" />
              <path d={chartPath} fill="none" stroke="#69aac1" strokeOpacity="0.16" strokeWidth="8" />
              <path d={chartPath} fill="none" stroke="#a4c5cf" strokeLinecap="round" strokeWidth="2.5" />
              <circle r="4.5" fill="#a4c5cf">
                <animateMotion dur="8s" path={chartPath} repeatCount="indefinite" />
              </circle>
              <circle r="11" fill="none" stroke="#a4c5cf" strokeOpacity="0.34">
                <animateMotion dur="8s" path={chartPath} repeatCount="indefinite" />
                <animate attributeName="r" dur="1.6s" values="7;15;7" repeatCount="indefinite" />
                <animate attributeName="stroke-opacity" dur="1.6s" values="0.5;0;0.5" repeatCount="indefinite" />
              </circle>
            </g>
          </svg>
        </div>

        <div className="relative z-10 flex min-h-[220px] max-w-[640px] flex-col items-start justify-center px-5 py-8 sm:min-h-[270px] sm:px-12 sm:py-10">
          <span className="text-sm text-ink-dim">Valeur du portfolio</span>
          <h1 className="mt-2 text-[34px] leading-[1.05] font-extrabold tracking-[-0.045em] text-ink tabular-nums sm:text-6xl sm:tracking-[-0.055em]">
            {fmtUsd(totalStats.totalValue)}
          </h1>
          <p className="mt-3 text-sm text-ink-dim">
            {hasAnyData ? (
              <>
                <span className={`font-semibold tabular-nums ${pnlColor(totalStats.netPnlUsd)}`}>
                  {fmtSignedUsd(totalStats.netPnlUsd)} ({fmtPct(totalStats.netPnlPct)})
                </span>{' '}
                P&L total · {basketTokens.length} actifs
              </>
            ) : (
              <>Enregistrez vos achats et ventes : le prix moyen et le P&L sont calculés automatiquement.</>
            )}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <button onClick={() => setShowAddTokenBar((v) => !v)} className={`${btnPrimary} h-10`}>
              <Plus className="h-4 w-4" />
              Ajouter un actif
            </button>
            {!hasAnyData ? (
              <button onClick={handleLoadSimpleExample} className={`${btnSecondary} h-10`}>
                Charger un exemple
              </button>
            ) : (
              <button onClick={handleResetAll} className={`${btnSecondary} h-10 !px-3 text-ink-dim hover:!text-down`} title="Supprimer toutes les transactions">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ===== Add token panel ===== */}
      {showAddTokenBar && (
        <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <input
              autoFocus
              type="text"
              placeholder="Symbole : BTC, ETH, NEAR…"
              value={newSymbolInput}
              onChange={(e) => setNewSymbolInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddTokenToBasket(newSymbolInput);
                if (e.key === 'Escape') setShowAddTokenBar(false);
              }}
              className={`${inputCls} !h-11 uppercase`}
            />
            <button onClick={() => handleAddTokenToBasket(newSymbolInput)} className={`${btnPrimary} h-11 shrink-0`}>
              Ajouter
            </button>
            <button
              onClick={() => setShowAddTokenBar(false)}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-dim hover:text-ink cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-sm text-ink-dim">Populaires</span>
            {POPULAR_SUGGESTIONS.map((sym) => {
              const inBasket = basketTokens.some(
                (t) => t.id === sym.toLowerCase() || t.baseAsset.toUpperCase() === sym
              );
              return (
                <button
                  key={sym}
                  disabled={inBasket}
                  onClick={() => handleAddTokenToBasket(sym)}
                  className={`h-9 rounded-lg border px-3 text-sm font-medium transition-colors ${
                    inBasket
                      ? 'border-line text-ink-faint/50 cursor-not-allowed'
                      : 'border-line-strong text-ink-dim hover:border-accent/50 hover:bg-white/[0.04] hover:text-ink cursor-pointer'
                  }`}
                >
                  {sym}
                </button>
              );
            })}
            {basketTokens.length !== 6 && (
              <button onClick={handleResetDefaultBasket} className="ml-auto text-sm text-ink-dim hover:text-ink cursor-pointer">
                Panier par défaut
              </button>
            )}
          </div>
        </div>
      )}

      {/* ===== KPI cards ===== */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Capital investi', value: fmtUsd(totalStats.totalInvested), sub: `${tokenStats.filter((s) => s.hasEntries).length} positions ouvertes`, color: 'text-ink' },
          {
            label: 'P&L latent',
            value: hasAnyData ? fmtSignedUsd(totalStats.unrealized) : '—',
            sub: hasAnyData ? fmtPct(totalStats.unrealizedPct) : 'vs prix moyen',
            color: hasAnyData ? pnlColor(totalStats.unrealized) : 'text-ink-faint',
          },
          {
            label: 'Profit réalisé',
            value: hasAnyData ? fmtSignedUsd(totalStats.totalRealized) : '—',
            sub: 'Ventes encaissées',
            color: hasAnyData ? pnlColor(totalStats.totalRealized) : 'text-ink-faint',
          },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-line bg-surface p-5">
            <div className="text-sm text-ink-dim">{kpi.label}</div>
            <div className={`mt-2 text-2xl font-bold tracking-[-0.03em] tabular-nums ${kpi.color}`}>{kpi.value}</div>
            <div className="mt-1 text-xs text-ink-faint tabular-nums">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* ===== Toolbar: search + sort ===== */}
      <div className="flex flex-col gap-3 border-b border-line pb-5 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block w-full lg:max-w-sm">
          <svg viewBox="0 0 24 24" className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-ink-dim" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            placeholder="Rechercher un actif"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputCls} !h-11 pl-10`}
          />
        </label>
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
          <span className="mr-2 shrink-0 text-sm text-ink-dim">Trier</span>
          {([
            ['value', 'Valeur'],
            ['pnl', 'P&L %'],
            ['name', 'Nom'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setSortBy(id)}
              className={`h-9 shrink-0 rounded-lg px-3 text-sm font-medium transition-colors cursor-pointer ${
                sortBy === id ? 'bg-line-strong text-ink-mid' : 'text-ink-dim hover:bg-white/[0.04] hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ===== Positions table ===== */}
      <section>
        <h2 className="text-lg font-semibold tracking-tight text-ink">Positions</h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-line bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-dim">
                  <th className="px-5 py-3 font-medium">Actif</th>
                  <th className="px-3 py-3 text-right font-medium">Prix</th>
                  <th className="px-3 py-3 text-right font-medium">Prix moyen</th>
                  <th className="px-3 py-3 text-right font-medium">Unités</th>
                  <th className="px-3 py-3 text-right font-medium">Investi</th>
                  <th className="px-3 py-3 text-right font-medium">Valeur</th>
                  <th className="px-3 py-3 text-right font-medium">P&L vs moyen</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {visibleStats.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-sm text-ink-faint">
                      Aucun actif ne correspond à « {search} ».
                    </td>
                  </tr>
                )}
                {visibleStats.map((item) => {
                  const isOpen = expandedId === item.token.id;
                  const change24h = get24hChange(item.token);
                  const inputVal = getInput(item.token.id);
                  const mode = getMode(item.token.id);
                  const otherTokens = basketTokens.filter((t) => t.id !== item.token.id);
                  const canRotate = item.hasEntries && item.unrealizedPnl >= 0.05 && otherTokens.length > 0;

                  return (
                    <React.Fragment key={item.token.id}>
                      <tr
                        onClick={() => setExpandedId(isOpen ? null : item.token.id)}
                        className={`border-b border-line/70 cursor-pointer transition-colors last:border-b-0 ${
                          isOpen ? 'bg-surface-2' : 'hover:bg-white/[0.025]'
                        }`}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-3 text-[11px] font-semibold text-ink-mid">
                              {item.token.baseAsset.slice(0, 3)}
                            </div>
                            <div>
                              <div className="font-semibold leading-tight text-ink">{item.token.baseAsset}</div>
                              <div className="text-xs leading-tight text-ink-faint">{item.token.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3.5 text-right font-mono tabular-nums">
                          <div className="text-ink">{fmtPrice(item.livePrice)}</div>
                          {change24h !== undefined && (
                            <div className={`text-xs ${pnlColor(change24h)}`}>{fmtPct(change24h)}</div>
                          )}
                        </td>
                        <td className="px-3 py-3.5 text-right font-mono tabular-nums text-ink-mid">
                          {item.hasEntries ? fmtPrice(item.avgPrice) : '—'}
                        </td>
                        <td className="px-3 py-3.5 text-right font-mono tabular-nums text-ink-mid">
                          {item.hasEntries ? fmtUnits(item.coins) : '—'}
                        </td>
                        <td className="px-3 py-3.5 text-right font-mono tabular-nums text-ink-mid">
                          {item.hasEntries ? fmtUsd(item.invested) : '—'}
                        </td>
                        <td className="px-3 py-3.5 text-right font-mono tabular-nums text-ink">
                          {item.hasEntries ? fmtUsd(item.currentValue) : '—'}
                        </td>
                        <td className="px-3 py-3.5 text-right font-mono tabular-nums">
                          {item.hasEntries ? (
                            <>
                              <div className={`font-semibold ${pnlColor(item.pnlPct)}`}>{fmtPct(item.pnlPct)}</div>
                              <div className={`text-xs ${pnlColor(item.unrealizedPnl)}`}>{fmtSignedUsd(item.unrealizedPnl)}</div>
                            </>
                          ) : (
                            <span className="text-ink-faint">—</span>
                          )}
                        </td>
                        <td className="pr-4 py-3.5 text-right">
                          <ChevronDown className={`inline h-4 w-4 text-ink-dim transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </td>
                      </tr>

                      {/* ===== Expanded detail ===== */}
                      {isOpen && (
                        <tr className="border-b border-line bg-well">
                          <td colSpan={8} className="px-5 py-6">
                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                              {/* Order form + rotation */}
                              <div className="space-y-4 lg:col-span-2">
                                <div className="inline-flex gap-1 rounded-lg border border-line-strong bg-surface p-1">
                                  {(['buy', 'sell'] as const).map((m) => (
                                    <button
                                      key={m}
                                      onClick={() => setMode(item.token.id, m)}
                                      className={`h-8 rounded-md px-4 text-sm font-medium transition-colors cursor-pointer ${
                                        mode === m ? 'bg-line-strong text-ink' : 'text-ink-dim hover:text-ink'
                                      }`}
                                    >
                                      {m === 'buy' ? 'Achat' : 'Vente'}
                                    </button>
                                  ))}
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                  <label className="space-y-1.5">
                                    <span className="block text-xs text-ink-dim">Montant (USD)</span>
                                    <input
                                      type="number"
                                      step="any"
                                      value={inputVal.amount}
                                      onChange={(e) => updateInput(item.token.id, 'amount', e.target.value)}
                                      className={inputCls}
                                    />
                                  </label>
                                  <label className="space-y-1.5">
                                    <span className="flex justify-between text-xs text-ink-dim">
                                      <span>Prix</span>
                                      {item.livePrice > 0 && (
                                        <button
                                          type="button"
                                          onClick={() => updateInput(item.token.id, 'price', item.livePrice.toString())}
                                          className="text-accent hover:text-accent-bright cursor-pointer"
                                        >
                                          Marché
                                        </button>
                                      )}
                                    </span>
                                    <input
                                      type="number"
                                      step="any"
                                      placeholder={item.livePrice ? fmtPrice(item.livePrice) : ''}
                                      value={inputVal.price}
                                      onChange={(e) => updateInput(item.token.id, 'price', e.target.value)}
                                      onKeyDown={(e) => e.key === 'Enter' && handleAddEntry(item.token.id)}
                                      className={inputCls}
                                    />
                                  </label>
                                </div>

                                <button onClick={() => handleAddEntry(item.token.id)} className={`${btnPrimary} h-10 w-full`}>
                                  {mode === 'buy' ? `Enregistrer l'achat` : 'Enregistrer la vente'}
                                </button>

                                {canRotate && (
                                  <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="flex items-center gap-2 text-ink-mid">
                                        <Repeat className="h-4 w-4" />
                                        Rotation du profit
                                      </span>
                                      <span className={`font-mono font-semibold tabular-nums ${pnlColor(item.unrealizedPnl)}`}>
                                        {fmtSignedUsd(item.unrealizedPnl)}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <select
                                        value={reinvestTargetToken[item.token.id] || otherTokens[0]?.id}
                                        onChange={(e) =>
                                          setReinvestTargetToken((prev) => ({ ...prev, [item.token.id]: e.target.value }))
                                        }
                                        className="h-10 flex-1 rounded-lg border border-line-strong bg-well px-3 text-sm text-ink outline-none focus:border-accent cursor-pointer"
                                      >
                                        {otherTokens.map((t) => {
                                          const s = tokenStats.find((x) => x.token.id === t.id);
                                          return (
                                            <option key={t.id} value={t.id}>
                                              {t.baseAsset}
                                              {s?.hasEntries ? `  (${fmtPct(s.pnlPct)})` : ''}
                                            </option>
                                          );
                                        })}
                                      </select>
                                      <button
                                        onClick={() => handleReinvestProfit(item.token.id, item.unrealizedPnl, item.livePrice)}
                                        className={`${btnSecondary} h-10`}
                                      >
                                        Exécuter
                                      </button>
                                    </div>
                                    <p className="text-xs text-ink-faint">
                                      Vend uniquement le profit et le réinvestit sur l'actif choisi. Le capital reste en place.
                                    </p>
                                  </div>
                                )}

                                <div className="flex items-center justify-between pt-1 text-xs">
                                  <span className="text-ink-dim">
                                    Réalisé{' '}
                                    <span className={`font-mono tabular-nums ${pnlColor(item.realizedProfit)}`}>
                                      {item.hasEntries ? fmtSignedUsd(item.realizedProfit) : '—'}
                                    </span>
                                  </span>
                                  <button
                                    onClick={() => handleRemoveTokenFromBasket(item.token)}
                                    className="text-ink-faint transition-colors hover:text-down cursor-pointer"
                                  >
                                    Retirer l'actif
                                  </button>
                                </div>
                              </div>

                              {/* Transaction history */}
                              <div className="lg:col-span-3">
                                <div className="mb-2 text-xs text-ink-dim">Historique · {item.entries.length}</div>
                                {item.entries.length === 0 ? (
                                  <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-line-strong text-sm text-ink-faint">
                                    Aucune transaction
                                  </div>
                                ) : (
                                  <div className="max-h-72 overflow-y-auto rounded-xl border border-line">
                                    <table className="w-full text-xs">
                                      <thead className="sticky top-0 bg-surface">
                                        <tr className="text-ink-dim">
                                          <th className="px-3 py-2.5 text-left font-medium">Date</th>
                                          <th className="px-3 py-2.5 text-left font-medium">Type</th>
                                          <th className="px-3 py-2.5 text-right font-medium">Montant</th>
                                          <th className="px-3 py-2.5 text-right font-medium">Prix</th>
                                          <th className="px-3 py-2.5 text-right font-medium">Unités</th>
                                          <th className="w-8" />
                                        </tr>
                                      </thead>
                                      <tbody className="font-mono">
                                        {[...item.entries].reverse().map((entry) => {
                                          const isBuy = entry.type === 'buy';
                                          const units = entry.price > 0 ? entry.amountUsd / entry.price : 0;
                                          return (
                                            <tr key={entry.id} className="group border-t border-line/70">
                                              <td className="px-3 py-2.5 text-ink-faint tabular-nums">{fmtDate(entry.timestamp)}</td>
                                              <td className="px-3 py-2.5 font-sans">
                                                <span className={isBuy ? 'text-up' : 'text-down'}>{isBuy ? 'Achat' : 'Vente'}</span>
                                              </td>
                                              <td className="px-3 py-2.5 text-right tabular-nums text-ink">{fmtUsd(entry.amountUsd)}</td>
                                              <td className="px-3 py-2.5 text-right tabular-nums text-ink-mid">{fmtPrice(entry.price)}</td>
                                              <td className="px-3 py-2.5 text-right tabular-nums text-ink-dim">
                                                {isBuy ? '+' : '−'}
                                                {fmtUnits(units)}
                                              </td>
                                              <td className="px-2 py-2.5 text-right">
                                                <button
                                                  onClick={() => handleDeleteEntry(item.token.id, entry.id)}
                                                  className="text-ink-faint opacity-0 transition hover:text-down group-hover:opacity-100 cursor-pointer"
                                                  title="Supprimer"
                                                >
                                                  <X className="h-3.5 w-3.5" />
                                                </button>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ===== Accumulation curves ===== */}
      <AccumulationCurvesSection tokensData={accumulationData} />

      {/* ===== Multi-Token Performance Comparison Chart (% Gain/Loss) ===== */}
      <PortfolioCompareChart tokens={basketTokens} />
    </div>
  );
};
