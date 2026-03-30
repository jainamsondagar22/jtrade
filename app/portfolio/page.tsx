"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
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
  label, value, sub, color = "white",
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-white/10">
      <p className="text-white/40 text-xs uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-xl font-bold font-mono`} style={{ color }}>
        {value}
      </p>
      {sub && <p className="text-white/30 text-xs mt-1">{sub}</p>}
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

  const handleBuy = useCallback(async () => {
    if (!user || !portfolio) return;
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      setMessage("Please enter a valid quantity.");
      return;
    }
    const asset = DEFAULT_ASSETS.find((a) => a.symbol === symbol);
    if (!asset) return;
    const price = prices[symbol] ?? ASSET_SEEDS[asset.id].price;
    setLoading(true);
    const result = await buyStock(user.uid, symbol, asset.name, qty, price);
    setMessage(result.message);
    const updated = await getPortfolio(user.uid);
    setPortfolio(updated);
    setLoading(false);
  }, [user, portfolio, symbol, quantity, prices]);

  const handleSell = useCallback(async () => {
    if (!user || !portfolio) return;
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      setMessage("Please enter a valid quantity.");
      return;
    }
    const price = prices[symbol] ?? 0;
    setLoading(true);
    const result = await sellStock(user.uid, symbol, qty, price);
    setMessage(result.message);
    const updated = await getPortfolio(user.uid);
    setPortfolio(updated);
    setLoading(false);
  }, [user, portfolio, symbol, quantity, prices]);

  if (!portfolio) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <p className="text-white/50 font-mono">Loading portfolio...</p>
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
      <div
        className="min-h-screen bg-slate-950 text-white"
        style={{ fontFamily: "monospace" }}
      >
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold text-lg">JTRADE</span>
            <span className="text-white/30 text-sm">/ Portfolio Simulator</span>
          </div>
          <div className="flex gap-4">
            <a href="/dashboard" className="text-white/40 hover:text-white text-sm transition">
              Dashboard
            </a>
            <a href="/charts" className="text-white/40 hover:text-white text-sm transition">
              Charts
            </a>
          </div>
        </div>

        <div className="max-w-6xl mx-auto p-6 space-y-6">

          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Total Value"
              value={fmt(totalValue)}
              sub="Cash + Holdings"
              color="#60A5FA"
            />
            <StatCard
              label="Cash Available"
              value={fmt(portfolio.cash)}
              sub="Buying power"
              color="#34D399"
            />
            <StatCard
              label="Unrealized P&L"
              value={fmt(totalPnL)}
              sub="Open positions"
              color={totalPnL >= 0 ? "#34D399" : "#F87171"}
            />
            <StatCard
              label="Total Return"
              value={`${totalReturn >= 0 ? "+" : ""}${totalReturnPct}%`}
              sub={fmt(totalReturn)}
              color={totalReturn >= 0 ? "#34D399" : "#F87171"}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            
            <div className="bg-slate-800 rounded-xl border border-white/10 p-5">
              <h2 className="text-white font-bold text-sm uppercase tracking-widest mb-4">
                Execute Trade
              </h2>

              <div className="space-y-3">
                <div>
                  <label className="text-white/40 text-xs mb-1 block">Asset</label>
                  <select
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {DEFAULT_ASSETS.map((a) => (
                      <option key={a.symbol} value={a.symbol}>
                        {a.symbol} — {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-white/40 text-xs mb-1 block">
                    Current Price
                  </label>
                  <div className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-emerald-400 font-mono text-sm">
                    {prices[symbol] ? fmt(prices[symbol]) : "Loading..."}
                  </div>
                </div>

                <div>
                  <label className="text-white/40 text-xs mb-1 block">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="bg-slate-900 rounded-lg px-3 py-2 text-xs text-white/40">
                  Est. Total:{" "}
                  <span className="text-white font-mono">
                    {prices[symbol]
                      ? fmt(prices[symbol] * parseInt(quantity || "0") * 1.001)
                      : "-"}
                  </span>{" "}
                  (inc. 0.1% fee)
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    onClick={handleBuy}
                    disabled={loading}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2 rounded-lg transition text-sm"
                  >
                    BUY
                  </button>
                  <button
                    onClick={handleSell}
                    disabled={loading}
                    className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-2 rounded-lg transition text-sm"
                  >
                    SELL
                  </button>
                </div>

                {message && (
                  <p className="text-center text-xs text-yellow-400 pt-1">{message}</p>
                )}
              </div>
            </div>

            
            <div className="bg-slate-800 rounded-xl border border-white/10 p-5">
              <h2 className="text-white font-bold text-sm uppercase tracking-widest mb-4">
                Asset Allocation
              </h2>
              <div className="space-y-3">
                
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-white/60">Cash</span>
                    <span className="text-white font-mono">
                      {((portfolio.cash / totalForAlloc) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-blue-400"
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
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-white/60">{p.symbol}</span>
                        <span className="text-white font-mono">{pct}%</span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: color }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] mt-0.5">
                        <span className="text-white/30">
                          {p.quantity} shares @ {fmt(p.avgCost)}
                        </span>
                        <span className={pnl >= 0 ? "text-emerald-400" : "text-red-400"}>
                          {pnl >= 0 ? "+" : ""}{fmt(pnl)}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {portfolio.positions.length === 0 && (
                  <p className="text-white/20 text-xs text-center py-4">
                    No positions yet. Buy a stock to get started.
                  </p>
                )}
              </div>
            </div>
          </div>

          
          {portfolio.positions.length > 0 && (
            <div className="bg-slate-800 rounded-xl border border-white/10 p-5">
              <h2 className="text-white font-bold text-sm uppercase tracking-widest mb-4">
                Current Holdings
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-white/40 text-xs border-b border-white/10">
                      <th className="text-left pb-2">Symbol</th>
                      <th className="text-right pb-2">Qty</th>
                      <th className="text-right pb-2">Avg Cost</th>
                      <th className="text-right pb-2">Current</th>
                      <th className="text-right pb-2">Value</th>
                      <th className="text-right pb-2">P&L</th>
                      <th className="text-right pb-2">P&L %</th>
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
                        <tr key={p.symbol} className="border-b border-white/5 hover:bg-white/5 transition">
                          <td className="py-3 font-bold text-white">{p.symbol}</td>
                          <td className="py-3 text-right text-white/70">{p.quantity}</td>
                          <td className="py-3 text-right text-white/70 font-mono">{fmt(p.avgCost)}</td>
                          <td className="py-3 text-right font-mono text-white">{fmt(currentPrice)}</td>
                          <td className="py-3 text-right font-mono text-white">{fmt(value)}</td>
                          <td className={`py-3 text-right font-mono ${isUp ? "text-emerald-400" : "text-red-400"}`}>
                            {isUp ? "+" : ""}{fmt(pnl)}
                          </td>
                          <td className={`py-3 text-right font-mono ${isUp ? "text-emerald-400" : "text-red-400"}`}>
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
            <div className="bg-slate-800 rounded-xl border border-white/10 p-5">
              <h2 className="text-white font-bold text-sm uppercase tracking-widest mb-4">
                Trade History
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-white/40 text-xs border-b border-white/10">
                      <th className="text-left pb-2">Time</th>
                      <th className="text-left pb-2">Type</th>
                      <th className="text-left pb-2">Symbol</th>
                      <th className="text-right pb-2">Qty</th>
                      <th className="text-right pb-2">Price</th>
                      <th className="text-right pb-2">Fee</th>
                      <th className="text-right pb-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...portfolio.trades].reverse().map((t: Trade) => (
                      <tr key={t.id} className="border-b border-white/5 hover:bg-white/5 transition">
                        <td className="py-2 text-white/40 text-xs">
                          {new Date(t.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                            t.type === "BUY"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-red-500/20 text-red-400"
                          }`}>
                            {t.type}
                          </span>
                        </td>
                        <td className="py-2 font-bold text-white">{t.symbol}</td>
                        <td className="py-2 text-right text-white/70">{t.quantity}</td>
                        <td className="py-2 text-right font-mono text-white/70">{fmt(t.price)}</td>
                        <td className="py-2 text-right font-mono text-red-400">-{fmt(t.fee)}</td>
                        <td className="py-2 text-right font-mono text-white">{fmt(t.total)}</td>
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