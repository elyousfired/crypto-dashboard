import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { TickerData, TokenConfig } from '../types/crypto';
import { CROSS_TOKENS } from '../config/crossPairs';
import { TOKENS } from '../config/tokens';
import { Plus, Trash2, TrendingUp, TrendingDown, Zap, Repeat, X, PlusCircle, Sparkles } from 'lucide-react';
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

  // Reinvest profit drawer state per token
  const [showReinvestDrawer, setShowReinvestDrawer] = useState<Record<string, boolean>>({});
  const [reinvestTargetToken, setReinvestTargetToken] = useState<Record<string, string>>({});

  // Form inputs state per token: { [tokenId]: { amount: string, price: string } }
  const [inputs, setInputs] = useState<Record<string, { amount: string; price: string }>>({});

  // Add Token Modal / Input State
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
    const clean = rawSymbol.trim().toUpperCase().replace(/USDT$/, '').replace(/\/USDT$/, '');
    if (!clean) return;

    const lowerId = clean.toLowerCase();

    // Check if already in basket
    if (basketTokens.some((t) => t.id === lowerId || t.baseAsset.toUpperCase() === clean)) {
      alert(`Token ${clean} aslan kayn f l-basket dyalk!`);
      return;
    }

    // Look up in pre-configured TOKENS first
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
      color: '#6366F1',
      accentGradient: 'from-indigo-500 to-purple-500',
      description: `Token ${clean} f l-basket`,
    };

    setBasketTokens((prev) => [...prev, newToken]);
    setNewSymbolInput('');
    setShowAddTokenBar(false);

    // Fetch price immediately
    fetchPriceForSymbol(newToken.symbol);
  };

  // Remove Token from Basket
  const handleRemoveTokenFromBasket = (token: TokenConfig) => {
    if (basketTokens.length <= 1) {
      alert("Khas yb9a au moins token wa7ed f l-basket!");
      return;
    }

    const txCount = (entriesMap[token.id] || []).length;
    const confirmMsg = txCount > 0
      ? `Bghiti t-7eyed ${token.baseAsset} mn l-basket? (${txCount} transactions dyalo ghadi y-tms7o)`
      : `Bghiti t-7eyed ${token.baseAsset} mn l-basket?`;

    if (window.confirm(confirmMsg)) {
      setBasketTokens((prev) => prev.filter((t) => t.id !== token.id));
      setEntriesMap((prev) => {
        const copy = { ...prev };
        delete copy[token.id];
        return copy;
      });
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
      alert("Kteb ch7al b dollar (ex: 10)");
      return;
    }

    if (isNaN(price) || price <= 0) {
      alert("Kteb l-prix (ex: 118)");
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

    // Reset input price
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

    // 1. Sell profit from winning token
    const sellTx: SimpleTransaction = {
      id: `tx-profit-sell-${Date.now()}`,
      type: 'sell',
      amountUsd: profitUsd,
      price: fromLivePrice,
      timestamp: Date.now(),
    };

    // 2. Buy target token with that profit
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

    setShowReinvestDrawer((prev) => ({ ...prev, [fromTokenId]: false }));
  };

  // Reset all transactions
  const handleResetAll = () => {
    if (window.confirm("Bghiti t-mseh ga3 les transactions?")) {
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
    if (window.confirm("Bghiti trje3 l-basket l-asliyya fiha les 6 tokens (SOL, SUI, ZEC, MON, HYPE, PENGU)?")) {
      setBasketTokens(CROSS_TOKENS);
      localStorage.removeItem(BASKET_STORAGE_KEY);
    }
  };

  // 1-Click: Charger un exemple simple avec Buy & Sell
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
        entries: tokenEntries,
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

    const netPnlUsd = (totalValue - totalInvested) + totalRealized;
    const netPnlPct = totalInvested > 0 ? (netPnlUsd / totalInvested) * 100 : 0;

    return {
      totalInvested,
      totalValue,
      totalRealized,
      netPnlUsd,
      netPnlPct,
      isProfit: netPnlUsd >= 0,
    };
  }, [tokenStats]);

  // Prepare Accumulation Curve Data (Option B) for each token
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

  return (
    <div className="flex-1 bg-[#090d14] p-4 lg:p-6 space-y-6 max-w-5xl mx-auto w-full">
      {/* Top Header & Basket Controls Bar */}
      <div className="bg-[#0e131d] border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-white m-0 flex items-center gap-2">
              <span>🧺 Mon Basket de Trading & DCA</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-mono font-bold">
                {basketTokens.length} Tokens
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Gérer les achats, ventes partielles (profit shaving) w suivi d'accumulation des unités en direct.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center flex-wrap gap-2.5">
            {/* Add Token Button */}
            <button
              onClick={() => setShowAddTokenBar((prev) => !prev)}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-indigo-950/40 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Zid Token f L-Basket</span>
            </button>

            {/* Global Result Pill */}
            {totalStats.totalInvested > 0 || totalStats.totalRealized !== 0 ? (
              <div className={`px-4 py-2 rounded-xl border flex items-center gap-2 font-mono ${
                totalStats.isProfit
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}>
                <span className="text-xs text-slate-400 font-sans">Total:</span>
                <span className="text-lg font-black">
                  {totalStats.isProfit ? '+' : ''}{totalStats.netPnlPct.toFixed(1)}%
                </span>
                <span className="text-xs font-semibold">
                  ({totalStats.isProfit ? '+' : ''}${totalStats.netPnlUsd.toFixed(2)})
                </span>
              </div>
            ) : (
              <button
                onClick={handleLoadSimpleExample}
                className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-bold transition cursor-pointer flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Charger Exemple</span>
              </button>
            )}

            {(totalStats.totalInvested > 0 || totalStats.totalRealized !== 0) && (
              <button
                onClick={handleResetAll}
                className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-700 transition cursor-pointer"
                title="Mseh ga3 les transactions"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Expandable Add Token Box */}
        {showAddTokenBar && (
          <div className="bg-[#090d14] border border-indigo-500/30 rounded-xl p-3.5 space-y-3 transition animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <PlusCircle className="w-4 h-4 text-indigo-400" />
                <span>Kteb Smiya d Token li bghiti t-zid f l-basket:</span>
              </span>
              <button
                onClick={() => setShowAddTokenBar(false)}
                className="text-slate-500 hover:text-white p-1 text-xs cursor-pointer"
              >
                ✕ Fermer
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Exemple: BTC, ETH, JUP, DOGE, NEAR, AVAX..."
                value={newSymbolInput}
                onChange={(e) => setNewSymbolInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddTokenToBasket(newSymbolInput);
                }}
                className="flex-1 bg-[#0d121c] border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
              <button
                onClick={() => handleAddTokenToBasket(newSymbolInput)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition cursor-pointer shrink-0"
              >
                Zid Token
              </button>
            </div>

            {/* Quick Popular Suggestions */}
            <div className="flex items-center flex-wrap gap-1.5 pt-1">
              <span className="text-[11px] text-slate-500 font-medium">Suggestions sra3:</span>
              {POPULAR_SUGGESTIONS.map((sym) => {
                const isAlreadyInBasket = basketTokens.some(
                  (t) => t.id === sym.toLowerCase() || t.baseAsset.toUpperCase() === sym
                );
                return (
                  <button
                    key={sym}
                    disabled={isAlreadyInBasket}
                    onClick={() => handleAddTokenToBasket(sym)}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold transition cursor-pointer ${
                      isAlreadyInBasket
                        ? 'bg-slate-800/40 text-slate-600 border border-slate-800 cursor-not-allowed'
                        : 'bg-slate-800 hover:bg-indigo-600/30 text-indigo-300 border border-slate-700 hover:border-indigo-500/40'
                    }`}
                  >
                    +{sym}
                  </button>
                );
              })}
              {basketTokens.length !== 6 && (
                <button
                  onClick={handleResetDefaultBasket}
                  className="ml-auto text-[10px] text-slate-500 hover:text-amber-400 underline cursor-pointer"
                >
                  Rje3 l 6 tokens l-asliyin
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* The Dynamic Token Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tokenStats.map((item) => {
          const inputVal = getInput(item.token.id);
          const currentMode = getMode(item.token.id);
          const otherTokens = basketTokens.filter((t) => t.id !== item.token.id);

          return (
            <div
              key={item.token.id}
              className={`bg-[#0d111a] border rounded-2xl p-4 transition space-y-3 shadow-md relative group ${
                item.hasEntries
                  ? item.isProfit
                    ? 'border-emerald-500/40 ring-1 ring-emerald-500/20'
                    : 'border-rose-500/40 ring-1 ring-rose-500/20'
                  : 'border-slate-800'
              }`}
            >
              {/* Token Header + Big Result (% Gain/Loss) */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-xs bg-gradient-to-br ${item.token.accentGradient || 'from-indigo-500 to-purple-600'}`}>
                    {item.token.baseAsset.slice(0, 3)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-base">{item.token.baseAsset}</span>
                      {/* Remove Token Button */}
                      <button
                        onClick={() => handleRemoveTokenFromBasket(item.token)}
                        className="text-slate-600 hover:text-rose-400 p-0.5 transition cursor-pointer text-xs rounded hover:bg-rose-950/30"
                        title="7eyed had token mn l-basket"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span className="text-[11px] text-slate-400 block font-mono">
                      Prix Live: ${item.livePrice < 1 ? item.livePrice.toFixed(4) : item.livePrice.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* BIG RESULT BADGE (SOL +1.5% / ZEC -1.2%) */}
                {item.hasEntries ? (
                  <div className={`text-right px-3 py-1 rounded-xl font-mono ${
                    item.isProfit
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                  }`}>
                    <div className="text-xl font-black flex items-center justify-end gap-1">
                      {item.isProfit ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      <span>{item.isProfit ? '+' : ''}{item.pnlPct.toFixed(1)}%</span>
                    </div>
                    <div className="text-[10px] font-bold">
                      {item.isProfit ? '+' : ''}${item.totalPnlUsd.toFixed(2)} Total
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-slate-500 font-mono italic">
                    Ma zedti 7ta opération
                  </span>
                )}
              </div>

              {/* Price Details Bar */}
              {item.hasEntries && (
                <div className="bg-[#090d14] rounded-xl p-2.5 flex items-center justify-between text-xs font-mono border border-slate-800/80">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Prix Moyen (Avg)</span>
                    <strong className="text-indigo-300">
                      ${item.avgPrice < 1 ? item.avgPrice.toFixed(4) : item.avgPrice.toFixed(2)}
                    </strong>
                  </div>
                  <div className="text-center">
                    <span className="text-[10px] text-slate-500 block uppercase">Jetons Restants</span>
                    <strong className="text-slate-200">
                      {item.coins < 1 ? item.coins.toFixed(4) : item.coins.toFixed(2)} ({item.invested.toFixed(1)}$)
                    </strong>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block uppercase">Profit Vendu (Cash)</span>
                    <strong className={item.realizedProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {item.realizedProfit >= 0 ? '+' : ''}${item.realizedProfit.toFixed(2)}
                    </strong>
                  </div>
                </div>
              )}

              {/* One-Click Quick Reinvest Profit Button (If token is in profit) */}
              {item.hasEntries && item.unrealizedPnl >= 0.05 && (
                <div className="bg-gradient-to-r from-emerald-950/40 via-indigo-950/20 to-[#0e131d] border border-emerald-500/30 rounded-xl p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                      <Repeat className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Rbahti +${item.unrealizedPnl.toFixed(2)} (+{item.pnlPct.toFixed(1)}%) !</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowReinvestDrawer((prev) => ({ ...prev, [item.token.id]: !prev[item.token.id] }))}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 text-[11px] font-bold border border-emerald-500/40 transition cursor-pointer"
                    >
                      {showReinvestDrawer[item.token.id] ? 'Fermer' : '🔄 Swapi r-rba7 f token kher'}
                    </button>
                  </div>

                  {showReinvestDrawer[item.token.id] && otherTokens.length > 0 && (
                    <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">Chri b dak r-rba7 (${item.unrealizedPnl.toFixed(2)}):</span>
                        <select
                          value={reinvestTargetToken[item.token.id] || otherTokens[0]?.id}
                          onChange={(e) => setReinvestTargetToken((prev) => ({ ...prev, [item.token.id]: e.target.value }))}
                          className="bg-[#090d14] text-xs font-bold text-white border border-slate-700 rounded-lg px-2 py-1 focus:outline-none cursor-pointer"
                        >
                          {otherTokens.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.baseAsset}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleReinvestProfit(item.token.id, item.unrealizedPnl, item.livePrice)}
                        className="px-3 py-1 rounded-lg bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-1 shadow-md cursor-pointer"
                      >
                        <Zap className="w-3 h-3 text-amber-300" />
                        <span>⚡ Swapi db</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Ultra-Simple Form with Buy / Sell Toggle */}
              <div className="pt-1 space-y-2">
                {/* BUY / SELL Switcher */}
                <div className="flex items-center gap-1 bg-[#090d14] p-0.5 rounded-lg border border-slate-800 w-fit">
                  <button
                    type="button"
                    onClick={() => setMode(item.token.id, 'buy')}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                      currentMode === 'buy'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>🟢 Achat (Buy)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode(item.token.id, 'sell')}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                      currentMode === 'sell'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>🔴 Vente (Sell)</span>
                  </button>
                </div>

                {/* Input Boxes + Add Button */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-2 text-xs text-slate-500 font-mono">$</span>
                    <input
                      type="number"
                      step="any"
                      placeholder={currentMode === 'buy' ? "Montant d'achat ($)" : "Montant vendu ($)"}
                      value={inputVal.amount}
                      onChange={(e) => updateInput(item.token.id, 'amount', e.target.value)}
                      className="w-full bg-[#090d14] border border-slate-800 rounded-xl pl-6 pr-2 py-1.5 text-xs font-mono text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-2 text-xs text-slate-500 font-mono">$</span>
                    <input
                      type="number"
                      step="any"
                      placeholder={currentMode === 'buy' ? "Prix d'achat" : "Prix de vente"}
                      value={inputVal.price}
                      onChange={(e) => updateInput(item.token.id, 'price', e.target.value)}
                      className="w-full bg-[#090d14] border border-slate-800 rounded-xl pl-6 pr-2 py-1.5 text-xs font-mono text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <button
                    onClick={() => handleAddEntry(item.token.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-white font-bold text-xs flex items-center gap-1 transition cursor-pointer shrink-0 shadow-md ${
                      currentMode === 'buy'
                        ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/50'
                        : 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/50'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{currentMode === 'buy' ? 'Zid Chira' : 'Zid Bay3'}</span>
                  </button>
                </div>

                {/* Quick Helper: Click to set price to current live market price */}
                {item.livePrice > 0 && !inputVal.price && (
                  <button
                    type="button"
                    onClick={() => updateInput(item.token.id, 'price', item.livePrice.toString())}
                    className="text-[10px] text-slate-500 hover:text-indigo-400 flex items-center gap-1 cursor-pointer transition"
                  >
                    <Zap className="w-2.5 h-2.5 text-amber-400" />
                    <span>Cliki bach t3mmer b le prix actuel (${item.livePrice < 1 ? item.livePrice.toFixed(4) : item.livePrice.toFixed(2)})</span>
                  </button>
                )}
              </div>

              {/* List of past transactions (Both BUY and SELL with clear badges) */}
              {item.entries.length > 0 && (
                <div className="pt-2 border-t border-slate-800/60">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase block mb-1.5">
                    Historique ({item.entries.length} opérations) :
                  </span>
                  <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                    {item.entries.map((entry, idx) => {
                      const isBuy = entry.type === 'buy';

                      return (
                        <div
                          key={entry.id}
                          className="bg-[#090d14] px-2.5 py-1 rounded-lg border border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-300"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-500 font-mono">#{idx + 1}</span>
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              isBuy
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-rose-500/20 text-rose-300'
                            }`}>
                              {isBuy ? '🟢 BUY' : '🔴 SELL'}
                            </span>
                            <strong className="text-white">${entry.amountUsd.toFixed(1)}</strong>
                            <span className="text-slate-500">à</span>
                            <span className="text-indigo-300">${entry.price < 1 ? entry.price.toFixed(4) : entry.price.toFixed(2)}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDeleteEntry(item.token.id, entry.id)}
                              className="text-slate-500 hover:text-rose-400 p-0.5 transition cursor-pointer"
                              title="Mseh had l'opération"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Option B: Bottom Dedicated Section for Accumulation Mini Curves */}
      <AccumulationCurvesSection tokensData={accumulationData} />
    </div>
  );
};
