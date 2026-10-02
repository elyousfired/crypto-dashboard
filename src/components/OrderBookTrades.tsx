import React, { useState } from 'react';
import type { TradeItem, OrderBookData, TokenConfig } from '../types/crypto';
import { ArrowDown, ArrowUp, X } from 'lucide-react';

interface OrderBookTradesProps {
  token: TokenConfig;
  trades: TradeItem[];
  orderBook: OrderBookData;
  onClose?: () => void;
}

export const OrderBookTrades: React.FC<OrderBookTradesProps> = ({
  token,
  trades,
  orderBook,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'trades' | 'orderbook'>('trades');

  const maxBidTotal = orderBook.bids.length > 0 ? orderBook.bids[orderBook.bids.length - 1].total : 1;
  const maxAskTotal = orderBook.asks.length > 0 ? orderBook.asks[orderBook.asks.length - 1].total : 1;
  const maxTotal = Math.max(maxBidTotal, maxAskTotal, 1);

  const bestBid = orderBook.bids[0]?.price ?? 0;
  const bestAsk = orderBook.asks[0]?.price ?? 0;
  const spread = bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : 0;
  const spreadPercent = bestBid > 0 ? (spread / bestBid) * 100 : 0;

  return (
    <div className="w-full bg-[#0d111a] border-l border-slate-800 flex flex-col h-full">
      {/* Tabs & Close button */}
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2 bg-slate-900/60">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('trades')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'trades'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Market Trades
          </button>
          <button
            onClick={() => setActiveTab('orderbook')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'orderbook'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Order Book
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">
            Live Stream
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Masquer le panneau Order Book"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 text-xs font-mono">
        {activeTab === 'trades' ? (
          <div>
            <div className="grid grid-cols-3 text-slate-400 font-semibold pb-2 border-b border-slate-800/80 mb-2 px-1">
              <span>Price ({token.quoteAsset})</span>
              <span className="text-right">Size ({token.baseAsset})</span>
              <span className="text-right">Time</span>
            </div>

            <div className="space-y-1">
              {trades.length === 0 ? (
                <div className="text-center py-10 text-slate-500">
                  Waiting for trade data...
                </div>
              ) : (
                trades.slice(0, 30).map((trade) => {
                  const date = new Date(trade.time);
                  const timeStr = date.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  });

                  return (
                    <div
                      key={trade.id}
                      className="grid grid-cols-3 px-1 py-1 rounded hover:bg-slate-800/40 transition"
                    >
                      <span
                        className={`font-semibold flex items-center gap-1 ${
                          trade.side === 'buy' ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {trade.side === 'buy' ? (
                          <ArrowUp className="w-3 h-3 inline" />
                        ) : (
                          <ArrowDown className="w-3 h-3 inline" />
                        )}
                        ${trade.price < 1 ? trade.price.toFixed(token.precision) : trade.price.toFixed(2)}
                      </span>
                      <span className="text-right text-slate-300">
                        {trade.qty < 1 ? trade.qty.toFixed(4) : trade.qty.toFixed(2)}
                      </span>
                      <span className="text-right text-slate-400">{timeStr}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <div>
            {/* Order Book Column Titles */}
            <div className="grid grid-cols-3 text-slate-400 font-semibold pb-2 border-b border-slate-800/80 mb-2 px-1">
              <span>Price ({token.quoteAsset})</span>
              <span className="text-right">Size</span>
              <span className="text-right">Total</span>
            </div>

            {/* Asks (Sells - Red) */}
            <div className="space-y-0.5 mb-2">
              {orderBook.asks.slice(0, 10).reverse().map((ask, idx) => {
                const depthPercent = Math.min((ask.total / maxTotal) * 100, 100);
                return (
                  <div
                    key={`ask-${idx}`}
                    className="relative grid grid-cols-3 px-1 py-0.5 rounded overflow-hidden"
                  >
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-rose-500/15 pointer-events-none transition-all duration-300"
                      style={{ width: `${depthPercent}%` }}
                    />
                    <span className="text-rose-400 font-medium z-10">
                      ${ask.price < 1 ? ask.price.toFixed(token.precision) : ask.price.toFixed(2)}
                    </span>
                    <span className="text-right text-slate-300 z-10">
                      {ask.size.toFixed(2)}
                    </span>
                    <span className="text-right text-slate-400 z-10">
                      {ask.total.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Spread Bar */}
            <div className="my-2 py-1.5 px-2 bg-slate-900/90 rounded border border-slate-800 flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-medium">Spread</span>
              <div className="flex items-center gap-2">
                <span className="text-white font-bold font-mono">
                  ${spread < 1 ? spread.toFixed(token.precision) : spread.toFixed(2)}
                </span>
                <span className="text-indigo-400 font-mono">
                  ({spreadPercent.toFixed(3)}%)
                </span>
              </div>
            </div>

            {/* Bids (Buys - Green) */}
            <div className="space-y-0.5">
              {orderBook.bids.slice(0, 10).map((bid, idx) => {
                const depthPercent = Math.min((bid.total / maxTotal) * 100, 100);
                return (
                  <div
                    key={`bid-${idx}`}
                    className="relative grid grid-cols-3 px-1 py-0.5 rounded overflow-hidden"
                  >
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-emerald-500/15 pointer-events-none transition-all duration-300"
                      style={{ width: `${depthPercent}%` }}
                    />
                    <span className="text-emerald-400 font-medium z-10">
                      ${bid.price < 1 ? bid.price.toFixed(token.precision) : bid.price.toFixed(2)}
                    </span>
                    <span className="text-right text-slate-300 z-10">
                      {bid.size.toFixed(2)}
                    </span>
                    <span className="text-right text-slate-400 z-10">
                      {bid.total.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
