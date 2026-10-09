import React, { useState, useEffect, useMemo } from 'react';
import type { TickerData } from '../types/crypto';
import { CROSS_TOKENS } from '../config/crossPairs';
import { TOKENS } from '../config/tokens';
import { Plus, Trash2, TrendingUp, TrendingDown, Zap } from 'lucide-react';

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

export const PortfolioDcaPage: React.FC<PortfolioDcaPageProps> = ({ tickers }) => {
  // Store transactions per token ID: { sol: [...], zec: [...], ... }
  const [entriesMap, setEntriesMap] = useState<Record<string, SimpleTransaction[]>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load portfolio:', e);
    }
    // Default initial state for the 6 core tokens
    return {
      sol: [],
      sui: [],
      zec: [],
      mon: [],
      hype: [],
      pengu: [],
    };
  });

  // Save to localStorage whenever entries change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entriesMap));
    } catch (e) {
      console.error('Failed to save portfolio:', e);
    }
  }, [entriesMap]);

  // Form mode state per token: 'buy' | 'sell'
  const [formModes, setFormModes] = useState<Record<string, 'buy' | 'sell'>>({});

  // Form inputs state per token: { [tokenId]: { amount: string, price: string } }
  const [inputs, setInputs] = useState<Record<string, { amount: string; price: string }>>({});

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

  // Add an entry (Buy or Sell) for a specific token
  const handleAddEntry = (tokenId: string) => {
    const mode = getMode(tokenId);
    const currentInput = getInput(tokenId);
    const amount = parseFloat(currentInput.amount);
    let price = parseFloat(currentInput.price);

    // If price input is empty, fallback to current live ticker price
    const tokenConfig = TOKENS.find((t) => t.id === tokenId);
    const livePrice = tokenConfig ? tickers[tokenConfig.symbol]?.lastPrice : 0;
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

  // Reset all
  const handleResetAll = () => {
    if (window.confirm("Bghiti t-mseh ga3 les transactions?")) {
      const emptyState: Record<string, SimpleTransaction[]> = {
        sol: [],
        sui: [],
        zec: [],
        mon: [],
        hype: [],
        pengu: [],
      };
      setEntriesMap(emptyState);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  // 1-Click: Charger un exemple simple avec Buy & Sell
  const handleLoadSimpleExample = () => {
    const example: Record<string, SimpleTransaction[]> = {};
    CROSS_TOKENS.forEach((t) => {
      const live = tickers[t.symbol]?.lastPrice || 10;
      // 1 achat bas, 1 achat renfort, 1 vente partielle avec profit
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
    return CROSS_TOKENS.map((token) => {
      const tokenEntries = entriesMap[token.id] || [];
      const livePrice = tickers[token.symbol]?.lastPrice || 0;

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
  }, [entriesMap, tickers]);

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

  return (
    <div className="flex-1 bg-[#090d14] p-4 lg:p-6 space-y-6 max-w-5xl mx-auto w-full">
      {/* Top Simple Summary Bar */}
      <div className="bg-[#0e131d] border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
        <div>
          <h2 className="text-xl font-black text-white m-0 flex items-center gap-2">
            <span>📊 Suivi Simple des Achats (Buy) & Ventes (Sell)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Kteb les achates w les ventes dyalk, w l-application kat-7seb l-prix moyen w r-rba7 direct: <strong>SOL +X%</strong> wla <strong>ZEC -X%</strong>!
          </p>
        </div>

        {/* Global Result Pill */}
        <div className="flex items-center gap-3">
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
              className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-bold transition cursor-pointer"
            >
              ✨ Charger Exemple (Buy & Sell)
            </button>
          )}

          {(totalStats.totalInvested > 0 || totalStats.totalRealized !== 0) && (
            <button
              onClick={handleResetAll}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-700 transition cursor-pointer"
              title="Mseh kolchi"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* The 6 Token Cards - Ultra Clear & Simple */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tokenStats.map((item) => {
          const inputVal = getInput(item.token.id);
          const currentMode = getMode(item.token.id);

          return (
            <div
              key={item.token.id}
              className={`bg-[#0d111a] border rounded-2xl p-4 transition space-y-3 shadow-md ${
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
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-xs bg-gradient-to-br ${item.token.accentGradient}`}>
                    {item.token.baseAsset.slice(0, 3)}
                  </div>
                  <div>
                    <span className="font-bold text-white text-base">{item.token.baseAsset}</span>
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
    </div>
  );
};
