"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopNav from "@/components/TopNav";
import {
  Portfolio, Position, Trade,
  initPortfolio, getPortfolio,
  buyStock, sellStock,
  calcPortfolioValue, calcUnrealizedPnL, calcTotalUnrealizedPnL,
} from "@/lib/portfolioService";
import { ASSET_SEEDS, DEFAULT_ASSETS } from "@/lib/assetData";


function getLivePrices(): Record<string, number> {
  const prices: Record<string, number> = {};
  DEFAULT_ASSETS.forEach((asset) => {
    const seed = ASSET_SEEDS[asset.id];
    const change = (Math.random() - 0.5) * 2 * seed.volatility;
    prices[asset.symbol] = parseFloat(
      (seed.price * (1 + change / 100)).toFixed(2)
    );
  });
  return prices;
}


function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}


function StatCard({
  label, value, sub, color = "currentColor",
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
      <p className="text-gray-500 text-xs uppercase tracking-widest font-semibold mb-1">{label}</p>
      <p className="text-2xl font-bold tracking-tight font-mono" style={{ color }}>
        {value}
      </p>
      {sub && <p className="text-gray-400 text-xs mt-1 font-medium">{sub}</p>}
    </div>
  );
}

export default function PortfolioPage() {
  const { user } = useAuth();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [symbol, setSymbol] = useState("AAPL");
  const [quantity, setQuantity] = useState("1");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  
  useEffect(() => {
    if (!user) return;
    initPortfolio(user.uid).then(() => {
      getPortfolio(user.uid).then((p) => setPortfolio(p));
    });
  }, [user]);

  
  useEffect(() => {
    setPrices(getLivePrices());
    const interval = setInterval(() => {
      setPrices(getLivePrices());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // executes buy order
  async function handleBuyOrder() {
    if (!user || !portfolio) return;
    const parsedQty = parseInt(quantity);
    
    if (isNaN(parsedQty) || parsedQty <= 0) {
      setMessage("Valid quantity required.");
      return;
    }
    
    const targetAsset = DEFAULT_ASSETS.find((a) => a.symbol === symbol);
    if (!targetAsset) return;
    
    const currPrice = prices[symbol] ?? ASSET_SEEDS[targetAsset.id].price;
    
    try {
      setLoading(true);
      const res = await buyStock(user.uid, symbol, targetAsset.name, parsedQty, currPrice);
      setMessage(res.message);
      
      // refetch to sync
      const updatedPort = await getPortfolio(user.uid);
      setPortfolio(updatedPort);
    } catch (err) {
      console.error(err);
      setMessage("Trade failed.");
    } finally {
      setLoading(false);
    }
  }

  // executes sell order
  async function handleSellOrder() {
    if (!user || !portfolio) return;
    const parsedQty = parseInt(quantity);
    
    if (isNaN(parsedQty) || parsedQty <= 0) {
      setMessage("Valid quantity required.");
      return;
    }
    
    const currPrice = prices[symbol] ?? 0;
    
    try {
      setLoading(true);
      const res = await sellStock(user.uid, symbol, parsedQty, currPrice);
      setMessage(res.message);
      
      const updatedPort = await getPortfolio(user.uid);
      setPortfolio(updatedPort);
    } catch (err) {
      console.error(err);
      setMessage("Trade failed.");
    } finally {
      setLoading(false);
    }
  }

  if (!portfolio) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
          <p className="text-gray-500 font-medium">Loading portfolio...</p>
        </div>
      </ProtectedRoute>
    );
  }

  const totalValue = calcPortfolioValue({
    ...portfolio,
    positions: portfolio.positions.map((p) => ({
      ...p,
      currentPrice: prices[p.symbol] ?? p.currentPrice,
    })),
  });

  const totalPnL = calcTotalUnrealizedPnL({
    ...portfolio,
    positions: portfolio.positions.map((p) => ({
      ...p,
      currentPrice: prices[p.symbol] ?? p.currentPrice,
    })),
  });

  const totalReturn = totalValue - portfolio.totalDeposited;
  const totalReturnPct = ((totalReturn / portfolio.totalDeposited) * 100).toFixed(2);

  
  const holdingsValue = portfolio.positions.reduce(
    (sum, p) => sum + (prices[p.symbol] ?? p.currentPrice) * p.quantity, 0
  );
  const totalForAlloc = holdingsValue + portfolio.cash;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-50 text-gray-900 font-sans flex flex-col">
        <TopNav />

        <div className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-8">

          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Portfolio Simulator</h1>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Total Value"
              value={fmt(totalValue)}
              sub="Cash + Holdings"
              color="#111827"
            />
            <StatCard
              label="Cash Available"
              value={fmt(portfolio.cash)}
              sub="Buying power"
              color="#111827"
            />
            <StatCard
              label="Unrealized P&L"
              value={fmt(totalPnL)}
              sub="Open positions"
              color={totalPnL >= 0 ? "#059669" : "#DC2626"}
            />
            <StatCard
              label="Total Return"
              value={`${totalReturn >= 0 ? "+" : ""}${totalReturnPct}%`}
              sub={fmt(totalReturn)}
              color={totalReturn >= 0 ? "#059669" : "#DC2626"}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 col-span-1">
              <h2 className="text-gray-900 font-bold tracking-tight mb-4 text-lg">
                Execute Trade
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="text-gray-600 font-medium text-xs mb-1.5 block">Asset Symbol</label>
                  <select
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    className="w-full bg-slate-50 border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 font-medium transition-all"
                  >
                    {DEFAULT_ASSETS.map((a) => (
                      <option key={a.symbol} value={a.symbol}>
                        {a.symbol} — {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-gray-600 font-medium text-xs mb-1.5 block">
                    Current Price
                  </label>
                  <div className="bg-slate-50 border border-gray-200 rounded-lg px-4 py-2.5 text-emerald-600 font-mono text-sm font-bold">
                    {prices[symbol] ? fmt(prices[symbol]) : "Loading..."}
                  </div>
                </div>

                <div>
                  <label className="text-gray-600 font-medium text-xs mb-1.5 block">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full bg-slate-50 border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 font-medium transition-all"
                  />
                </div>

                <div className="bg-gray-100 rounded-lg px-4 py-3 text-xs text-gray-500 font-medium">
                  Estimated Total:{" "}
                  <span className="text-gray-900 font-mono font-bold">
                    {prices[symbol]
                      ? fmt(prices[symbol] * parseInt(quantity || "0") * 1.001)
                      : "-"}
                  </span>{" "}
                  (inc. 0.1% fee)
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={handleBuyOrder}
                    disabled={loading}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg transition-all text-sm active:scale-95 shadow-sm"
                  >
                    BUY
                  </button>
                  <button
                    onClick={handleSellOrder}
                    disabled={loading}
                    className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg transition-all text-sm active:scale-95 shadow-sm"
                  >
                    SELL
                  </button>
                </div>

                {message && (
                  <p className="text-center text-sm font-medium text-gray-900 pt-2 bg-gray-100 py-2 rounded-lg border border-gray-200">{message}</p>
                )}
              </div>
            </div>

            
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 col-span-1 md:col-span-2">
              <h2 className="text-gray-900 font-bold tracking-tight mb-4 text-lg">
                Asset Allocation
              </h2>
              <div className="space-y-4">
                
                <div>
                  <div className="flex justify-between text-xs mb-1.5 font-bold text-gray-700">
                    <span>CASH BALANCE</span>
                    <span className="font-mono text-gray-900">
                      {((portfolio.cash / totalForAlloc) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 border border-gray-200 overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${(portfolio.cash / totalForAlloc) * 100}%` }}
                    />
                  </div>
                </div>

                
                {portfolio.positions.map((p) => {
                  const currentPrice = prices[p.symbol] ?? p.currentPrice;
                  const posValue = currentPrice * p.quantity;
                  const pct = ((posValue / totalForAlloc) * 100).toFixed(1);
                  const asset = DEFAULT_ASSETS.find((a) => a.symbol === p.symbol);
                  const color = asset?.color ?? "#888";
                  const pnl = calcUnrealizedPnL({ ...p, currentPrice });
                  return (
                    <div key={p.symbol}>
                      <div className="flex justify-between text-xs mb-1.5 font-bold text-gray-700">
                        <span>{p.symbol}</span>
                        <span className="font-mono text-gray-900">{pct}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-3 border border-gray-200 overflow-hidden">
                        <div
                          className="h-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: color }}
                        />
                      </div>
                      <div className="flex justify-between text-xs mt-1 font-medium text-gray-500">
                        <span>
                          {p.quantity} shares @ {fmt(p.avgCost)}
                        </span>
                        <span className={`font-mono font-bold ${pnl >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {pnl >= 0 ? "+" : ""}{fmt(pnl)}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {portfolio.positions.length === 0 && (
                  <p className="text-gray-400 text-sm text-center py-4 font-medium border border-dashed border-gray-200 rounded-xl mt-4">
                    No positions yet. Buy a stock to get started.
                  </p>
                )}
              </div>
            </div>
          </div>

          
          {portfolio.positions.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100">
                <h2 className="text-gray-900 font-bold tracking-tight text-lg">
                  Current Holdings
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-gray-600">
                  <thead className="bg-slate-50 border-b border-gray-200">
                    <tr className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
                      <th className="text-left py-3 px-5">Symbol</th>
                      <th className="text-right py-3 px-5">Qty</th>
                      <th className="text-right py-3 px-5">Avg Cost</th>
                      <th className="text-right py-3 px-5">Current</th>
                      <th className="text-right py-3 px-5">Value</th>
                      <th className="text-right py-3 px-5">P&L</th>
                      <th className="text-right py-3 px-5">P&L %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.positions.map((p) => {
                      const currentPrice = prices[p.symbol] ?? p.currentPrice;
                      const value = currentPrice * p.quantity;
                      const pnl = calcUnrealizedPnL({ ...p, currentPrice });
                      const pnlPct = (((currentPrice - p.avgCost) / p.avgCost) * 100).toFixed(2);
                      const isUp = pnl >= 0;
                      return (
                        <tr key={p.symbol} className="border-b border-gray-100 hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-5 font-bold text-gray-900">{p.symbol}</td>
                          <td className="py-3 px-5 text-right font-medium">{p.quantity}</td>
                          <td className="py-3 px-5 text-right font-mono text-gray-500">{fmt(p.avgCost)}</td>
                          <td className="py-3 px-5 text-right font-mono font-semibold text-gray-900">{fmt(currentPrice)}</td>
                          <td className="py-3 px-5 text-right font-mono font-semibold text-gray-900">{fmt(value)}</td>
                          <td className={`py-3 px-5 text-right font-mono font-bold ${isUp ? "text-emerald-600" : "text-red-600"}`}>
                            {isUp ? "+" : ""}{fmt(pnl)}
                          </td>
                          <td className={`py-3 px-5 text-right font-mono font-bold ${isUp ? "text-emerald-600" : "text-red-600"}`}>
                            {isUp ? "+" : ""}{pnlPct}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          
          {portfolio.trades.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-8">
              <div className="p-5 border-b border-gray-100">
                <h2 className="text-gray-900 font-bold tracking-tight text-lg">
                  Trade History
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-gray-600 mb-4">
                  <thead className="bg-slate-50 border-b border-gray-200">
                    <tr className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
                      <th className="text-left py-3 px-5">Time</th>
                      <th className="text-left py-3 px-5">Type</th>
                      <th className="text-left py-3 px-5">Symbol</th>
                      <th className="text-right py-3 px-5">Qty</th>
                      <th className="text-right py-3 px-5">Price</th>
                      <th className="text-right py-3 px-5">Fee</th>
                      <th className="text-right py-3 px-5">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...portfolio.trades].reverse().map((t: Trade) => (
                      <tr key={t.id} className="border-b border-gray-100 hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-5 text-gray-400 font-medium text-xs">
                          {new Date(t.timestamp).toLocaleString()}
                        </td>
                        <td className="py-3 px-5">
                          <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-md border ${
                            t.type === "BUY"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          }`}>
                            {t.type}
                          </span>
                        </td>
                        <td className="py-3 px-5 font-bold text-gray-900">{t.symbol}</td>
                        <td className="py-3 px-5 text-right font-medium">{t.quantity}</td>
                        <td className="py-3 px-5 text-right font-mono text-gray-600">{fmt(t.price)}</td>
                        <td className="py-3 px-5 text-right font-mono text-red-500 font-medium">-{fmt(t.fee)}</td>
                        <td className="py-3 px-5 text-right font-mono font-bold text-gray-900">{fmt(t.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </ProtectedRoute>
  );
}