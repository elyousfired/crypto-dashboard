import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { TickerData, TokenConfig } from '../types/crypto';
import { CROSS_TOKENS } from '../config/crossPairs';
import { TOKENS } from '../config/tokens';
import { Plus, Trash2, ChevronDown, X, Repeat } from 'lucide-react';
import { AccumulationCurvesSection } from './AccumulationCurvesSection';

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
const pnlColor = (v: number) => (v > 0 ? 'text-emerald-400' : v < 0 ? 'text-rose-400' : 'text-zinc-400');
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

  const inputCls =
    'w-full bg-[#0b0d11] border border-white/[0.08] rounded-md px-3 py-2 text-sm text-zinc-100 tabular-nums placeholder-zinc-600 focus:border-zinc-500 focus:outline-none transition';

  return (
    <div className="flex-1 bg-[#0b0d11] px-4 lg:px-8 py-6 space-y-6 max-w-6xl mx-auto w-full text-zinc-300">
      {/* ===== Page header ===== */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100 tracking-tight">Portfolio</h1>
          <p className="text-xs text-zinc-500 mt-1">
            {basketTokens.length} actifs · Prix moyen pondéré · Prise de profit et rotation
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!hasAnyData && (
            <button
              onClick={handleLoadSimpleExample}
              className="px-3 py-1.5 rounded-md text-xs font-medium text-zinc-400 hover:text-zinc-100 border border-white/[0.08] hover:border-white/20 transition cursor-pointer"
            >
              Charger un exemple
            </button>
          )}
          {hasAnyData && (
            <button
              onClick={handleResetAll}
              className="p-2 rounded-md text-zinc-500 hover:text-rose-400 border border-white/[0.08] hover:border-rose-500/30 transition cursor-pointer"
              title="Supprimer toutes les transactions"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => setShowAddTokenBar((prev) => !prev)}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-100 text-zinc-900 hover:bg-white transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Ajouter un actif
          </button>
        </div>
      </div>

      {/* ===== Add token panel ===== */}
      {showAddTokenBar && (
        <div className="rounded-lg border border-white/[0.08] bg-[#0f1217] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <input
              autoFocus
              type="text"
              placeholder="Symbole (ex : BTC, ETH, NEAR)"
              value={newSymbolInput}
              onChange={(e) => setNewSymbolInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddTokenToBasket(newSymbolInput);
                if (e.key === 'Escape') setShowAddTokenBar(false);
              }}
              className={`${inputCls} uppercase`}
            />
            <button
              onClick={() => handleAddTokenToBasket(newSymbolInput)}
              className="px-4 py-2 rounded-md text-sm font-medium bg-zinc-100 text-zinc-900 hover:bg-white transition cursor-pointer shrink-0"
            >
              Ajouter
            </button>
            <button
              onClick={() => setShowAddTokenBar(false)}
              className="p-2 rounded-md text-zinc-500 hover:text-zinc-200 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center flex-wrap gap-1.5">
            {POPULAR_SUGGESTIONS.map((sym) => {
              const inBasket = basketTokens.some(
                (t) => t.id === sym.toLowerCase() || t.baseAsset.toUpperCase() === sym
              );
              return (
                <button
                  key={sym}
                  disabled={inBasket}
                  onClick={() => handleAddTokenToBasket(sym)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium border transition ${
                    inBasket
                      ? 'border-transparent text-zinc-700 cursor-not-allowed'
                      : 'border-white/[0.08] text-zinc-400 hover:text-zinc-100 hover:border-white/20 cursor-pointer'
                  }`}
                >
                  {sym}
                </button>
              );
            })}
            {basketTokens.length !== 6 && (
              <button
                onClick={handleResetDefaultBasket}
                className="ml-auto text-[11px] text-zinc-500 hover:text-zinc-300 cursor-pointer"
              >
                Restaurer le panier par défaut
              </button>
            )}
          </div>
        </div>
      )}

      {/* ===== Summary KPIs ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/[0.06] rounded-lg overflow-hidden border border-white/[0.06]">
        {[
          { label: 'Valeur actuelle', value: fmtUsd(totalStats.totalValue), sub: null, color: 'text-zinc-100' },
          { label: 'Capital investi', value: fmtUsd(totalStats.totalInvested), sub: null, color: 'text-zinc-100' },
          {
            label: 'P&L latent',
            value: hasAnyData ? fmtSignedUsd(totalStats.unrealized) : '—',
            sub: hasAnyData ? fmtPct(totalStats.unrealizedPct) : null,
            color: hasAnyData ? pnlColor(totalStats.unrealized) : 'text-zinc-500',
          },
          {
            label: 'Profit réalisé',
            value: hasAnyData ? fmtSignedUsd(totalStats.totalRealized) : '—',
            sub: hasAnyData ? `Total ${fmtSignedUsd(totalStats.netPnlUsd)}` : null,
            color: hasAnyData ? pnlColor(totalStats.totalRealized) : 'text-zinc-500',
          },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-[#0f1217] px-5 py-4">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">{kpi.label}</div>
            <div className={`mt-1.5 text-xl font-semibold tabular-nums ${kpi.color}`}>{kpi.value}</div>
            <div className="mt-0.5 h-4 text-xs tabular-nums text-zinc-500">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* ===== Positions table ===== */}
      <section className="rounded-lg border border-white/[0.06] bg-[#0f1217] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-zinc-100 tracking-tight">Positions</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-zinc-500 border-b border-white/[0.06]">
                <th className="text-left font-medium px-5 py-2.5">Actif</th>
                <th className="text-right font-medium px-3 py-2.5">Prix</th>
                <th className="text-right font-medium px-3 py-2.5">Prix moyen</th>
                <th className="text-right font-medium px-3 py-2.5">Unités</th>
                <th className="text-right font-medium px-3 py-2.5">Investi</th>
                <th className="text-right font-medium px-3 py-2.5">Valeur</th>
                <th className="text-right font-medium px-3 py-2.5">P&L vs moyen</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {tokenStats.map((item) => {
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
                      className={`border-b border-white/[0.04] cursor-pointer transition ${
                        isOpen ? 'bg-white/[0.03]' : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-zinc-800 text-zinc-300 text-[10px] font-semibold flex items-center justify-center">
                            {item.token.baseAsset.slice(0, 3)}
                          </div>
                          <div>
                            <div className="font-medium text-zinc-100 leading-tight">{item.token.baseAsset}</div>
                            <div className="text-[11px] text-zinc-500 leading-tight">{item.token.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        <div className="text-zinc-200">{fmtPrice(item.livePrice)}</div>
                        {change24h !== undefined && (
                          <div className={`text-[11px] ${pnlColor(change24h)}`}>{fmtPct(change24h)}</div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-zinc-300">
                        {item.hasEntries ? fmtPrice(item.avgPrice) : '—'}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-zinc-300">
                        {item.hasEntries ? fmtUnits(item.coins) : '—'}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-zinc-300">
                        {item.hasEntries ? fmtUsd(item.invested) : '—'}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-zinc-100">
                        {item.hasEntries ? fmtUsd(item.currentValue) : '—'}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {item.hasEntries ? (
                          <>
                            <div className={`font-medium ${pnlColor(item.pnlPct)}`}>{fmtPct(item.pnlPct)}</div>
                            <div className={`text-[11px] ${pnlColor(item.unrealizedPnl)}`}>
                              {fmtSignedUsd(item.unrealizedPnl)}
                            </div>
                          </>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="pr-4 py-3 text-right">
                        <ChevronDown
                          className={`w-4 h-4 text-zinc-500 inline transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        />
                      </td>
                    </tr>

                    {/* ===== Expanded detail ===== */}
                    {isOpen && (
                      <tr className="border-b border-white/[0.06] bg-white/[0.015]">
                        <td colSpan={8} className="px-5 py-5">
                          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                            {/* Left: order form + rotation */}
                            <div className="lg:col-span-2 space-y-4">
                              <div className="inline-flex p-0.5 rounded-md border border-white/[0.08] bg-[#0b0d11]">
                                {(['buy', 'sell'] as const).map((m) => (
                                  <button
                                    key={m}
                                    onClick={() => setMode(item.token.id, m)}
                                    className={`px-4 py-1 rounded text-xs font-medium transition cursor-pointer ${
                                      mode === m ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                                    }`}
                                  >
                                    {m === 'buy' ? 'Achat' : 'Vente'}
                                  </button>
                                ))}
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <label className="space-y-1">
                                  <span className="text-[11px] text-zinc-500">Montant (USD)</span>
                                  <input
                                    type="number"
                                    step="any"
                                    value={inputVal.amount}
                                    onChange={(e) => updateInput(item.token.id, 'amount', e.target.value)}
                                    className={inputCls}
                                  />
                                </label>
                                <label className="space-y-1">
                                  <span className="text-[11px] text-zinc-500 flex justify-between">
                                    <span>Prix</span>
                                    {item.livePrice > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => updateInput(item.token.id, 'price', item.livePrice.toString())}
                                        className="text-zinc-500 hover:text-zinc-200 cursor-pointer"
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

                              <button
                                onClick={() => handleAddEntry(item.token.id)}
                                className="w-full py-2 rounded-md text-sm font-medium bg-zinc-100 text-zinc-900 hover:bg-white transition cursor-pointer"
                              >
                                {mode === 'buy' ? `Enregistrer l'achat` : 'Enregistrer la vente'}
                              </button>

                              {canRotate && (
                                <div className="rounded-md border border-white/[0.08] p-3 space-y-2.5">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-zinc-400 flex items-center gap-1.5">
                                      <Repeat className="w-3.5 h-3.5" />
                                      Rotation du profit
                                    </span>
                                    <span className={`tabular-nums font-medium ${pnlColor(item.unrealizedPnl)}`}>
                                      {fmtSignedUsd(item.unrealizedPnl)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <select
                                      value={reinvestTargetToken[item.token.id] || otherTokens[0]?.id}
                                      onChange={(e) =>
                                        setReinvestTargetToken((prev) => ({ ...prev, [item.token.id]: e.target.value }))
                                      }
                                      className="flex-1 bg-[#0b0d11] border border-white/[0.08] rounded-md px-2 py-1.5 text-xs text-zinc-200 focus:outline-none cursor-pointer"
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
                                      onClick={() =>
                                        handleReinvestProfit(item.token.id, item.unrealizedPnl, item.livePrice)
                                      }
                                      className="px-3 py-1.5 rounded-md text-xs font-medium border border-white/[0.12] text-zinc-200 hover:bg-white/[0.06] transition cursor-pointer"
                                    >
                                      Exécuter
                                    </button>
                                  </div>
                                  <p className="text-[11px] text-zinc-600">
                                    Vend uniquement le profit et l'achète sur l'actif choisi. Le capital reste en place.
                                  </p>
                                </div>
                              )}

                              <div className="flex items-center justify-between pt-1 text-[11px]">
                                <span className="text-zinc-500">
                                  Réalisé{' '}
                                  <span className={`tabular-nums ${pnlColor(item.realizedProfit)}`}>
                                    {item.hasEntries ? fmtSignedUsd(item.realizedProfit) : '—'}
                                  </span>
                                </span>
                                <button
                                  onClick={() => handleRemoveTokenFromBasket(item.token)}
                                  className="text-zinc-600 hover:text-rose-400 transition cursor-pointer"
                                >
                                  Retirer l'actif
                                </button>
                              </div>
                            </div>

                            {/* Right: transaction history */}
                            <div className="lg:col-span-3">
                              <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-2">
                                Historique · {item.entries.length}
                              </div>
                              {item.entries.length === 0 ? (
                                <div className="h-24 flex items-center justify-center rounded-md border border-dashed border-white/[0.08] text-xs text-zinc-600">
                                  Aucune transaction
                                </div>
                              ) : (
                                <div className="max-h-64 overflow-y-auto rounded-md border border-white/[0.06]">
                                  <table className="w-full text-xs">
                                    <thead className="sticky top-0 bg-[#12151b]">
                                      <tr className="text-zinc-500">
                                        <th className="text-left font-medium px-3 py-2">Date</th>
                                        <th className="text-left font-medium px-3 py-2">Type</th>
                                        <th className="text-right font-medium px-3 py-2">Montant</th>
                                        <th className="text-right font-medium px-3 py-2">Prix</th>
                                        <th className="text-right font-medium px-3 py-2">Unités</th>
                                        <th className="w-8" />
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {[...item.entries].reverse().map((entry) => {
                                        const isBuy = entry.type === 'buy';
                                        const units = entry.price > 0 ? entry.amountUsd / entry.price : 0;
                                        return (
                                          <tr key={entry.id} className="border-t border-white/[0.04] group">
                                            <td className="px-3 py-2 text-zinc-500 tabular-nums">{fmtDate(entry.timestamp)}</td>
                                            <td className="px-3 py-2">
                                              <span className={isBuy ? 'text-emerald-400' : 'text-rose-400'}>
                                                {isBuy ? 'Achat' : 'Vente'}
                                              </span>
                                            </td>
                                            <td className="px-3 py-2 text-right tabular-nums text-zinc-200">
                                              {fmtUsd(entry.amountUsd)}
                                            </td>
                                            <td className="px-3 py-2 text-right tabular-nums text-zinc-300">
                                              {fmtPrice(entry.price)}
                                            </td>
                                            <td className="px-3 py-2 text-right tabular-nums text-zinc-400">
                                              {isBuy ? '+' : '−'}{fmtUnits(units)}
                                            </td>
                                            <td className="px-2 py-2 text-right">
                                              <button
                                                onClick={() => handleDeleteEntry(item.token.id, entry.id)}
                                                className="text-zinc-700 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                                                title="Supprimer"
                                              >
                                                <X className="w-3.5 h-3.5" />
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
      </section>

      {/* ===== Accumulation curves ===== */}
      <AccumulationCurvesSection tokensData={accumulationData} />
    </div>
  );
};
