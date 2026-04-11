"use client";

import { useEffect, useRef, useState } from "react";
import TopNav from "@/components/TopNav";
import { DEFAULT_ASSETS, ASSET_SEEDS, generateOHLC } from "@/lib/assetData";
import {
  calcSMA, calcEMA, calcBollingerBands, calcRSI,
  runBacktest, BacktestResult, BacktestTrade,
} from "@/lib/indicators";

const POINTS = 100;

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function drawStrategyChart(
  canvas: HTMLCanvasElement,
  prices: number[],
  indicator: string,
  period: number,
  smaPeriod: number,
  trades: BacktestTrade[]
) {
  const ctx = canvas.getContext("2d");
  if (!ctx || prices.length === 0) return;

  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  const PAD = { top: 24, right: 20, bottom: 48, left: 72 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  // Background white
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);

  let allValues = [...prices];

  const sma = calcSMA(prices, smaPeriod);
  const ema = calcEMA(prices, smaPeriod);
  const bb = calcBollingerBands(prices, period);

  if (indicator === "BB") {
    bb.forEach((b) => { allValues.push(b.upper, b.lower); });
  }

  const min = Math.min(...allValues) * 0.995;
  const max = Math.max(...allValues) * 1.005;
  const range = max - min || 1;

  const toY = (v: number) => PAD.top + cH - ((v - min) / range) * cH;
  const toX = (i: number) => PAD.left + (i / (prices.length - 1)) * cW;

  // Grid
  ctx.strokeStyle = "rgba(0,0,0,0.05)";
  ctx.lineWidth = 1;
  for (let g = 0; g <= 5; g++) {
    const y = PAD.top + (g / 5) * cH;
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(PAD.left + cW, y);
    ctx.stroke();
    const val = max - (g / 5) * range;
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.font = "11px Inter, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(val.toFixed(2), PAD.left - 8, y + 4);
  }

  // Price line
  ctx.beginPath();
  ctx.strokeStyle = "#3b82f6";
  ctx.lineWidth = 2;
  prices.forEach((p, i) => {
    i === 0 ? ctx.moveTo(toX(i), toY(p)) : ctx.lineTo(toX(i), toY(p));
  });
  ctx.stroke();

  // SMA overlay
  if (indicator === "SMA") {
    ctx.beginPath();
    ctx.strokeStyle = "#F59E0B";
    ctx.lineWidth = 1.5;
    sma.forEach((s, i) => {
      i === 0 ? ctx.moveTo(toX(s.index), toY(s.value)) : ctx.lineTo(toX(s.index), toY(s.value));
    });
    ctx.stroke();
    ctx.fillStyle = "#F59E0B";
    ctx.font = "bold 10px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`SMA(${smaPeriod})`, PAD.left + 8, PAD.top + 14);
  }

  // EMA overlay
  if (indicator === "EMA") {
    ctx.beginPath();
    ctx.strokeStyle = "#8B5CF6";
    ctx.lineWidth = 1.5;
    ema.forEach((e, i) => {
      i === 0 ? ctx.moveTo(toX(e.index), toY(e.value)) : ctx.lineTo(toX(e.index), toY(e.value));
    });
    ctx.stroke();
    ctx.fillStyle = "#8B5CF6";
    ctx.font = "bold 10px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`EMA(${smaPeriod})`, PAD.left + 8, PAD.top + 14);
  }

  // Bollinger Bands overlay
  if (indicator === "BB") {
    const drawBBLine = (vals: number[], color: string) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      bb.forEach((b, i) => {
        const y = toY(vals[i]);
        i === 0 ? ctx.moveTo(toX(b.index), y) : ctx.lineTo(toX(b.index), y);
      });
      ctx.stroke();
    };
    drawBBLine(bb.map((b) => b.upper), "#EF4444");
    drawBBLine(bb.map((b) => b.middle), "#F59E0B");
    drawBBLine(bb.map((b) => b.lower), "#10B981");

    // Shaded band area
    ctx.beginPath();
    bb.forEach((b, i) => {
      i === 0 ? ctx.moveTo(toX(b.index), toY(b.upper)) : ctx.lineTo(toX(b.index), toY(b.upper));
    });
    [...bb].reverse().forEach((b) => ctx.lineTo(toX(b.index), toY(b.lower)));
    ctx.closePath();
    ctx.fillStyle = "rgba(245,158,11,0.05)";
    ctx.fill();
  }

  // RSI sub-chart
  if (indicator === "RSI") {
    const rsi = calcRSI(prices, period);
    const rsiH = 60;
    const rsiTop = H - PAD.bottom - rsiH - 8;

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillRect(PAD.left, rsiTop, cW, rsiH);
    ctx.strokeStyle = "rgba(0,0,0,0.1)";
    ctx.strokeRect(PAD.left, rsiTop, cW, rsiH);

    // Overbought/oversold lines
    [30, 70].forEach((level) => {
      const y = rsiTop + rsiH - (level / 100) * rsiH;
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = level === 70 ? "rgba(239,68,68,0.7)" : "rgba(16,185,129,0.7)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(PAD.left + cW, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = level === 70 ? "rgba(239,68,68,0.9)" : "rgba(16,185,129,0.9)";
      ctx.font = "9px Inter, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(level.toString(), PAD.left - 4, y + 3);
    });

    ctx.beginPath();
    ctx.strokeStyle = "#8B5CF6";
    ctx.lineWidth = 1.5;
    rsi.forEach((r, i) => {
      const x = toX(r.index);
      const y = rsiTop + rsiH - (r.value / 100) * rsiH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = "#8B5CF6";
    ctx.font = "bold 9px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`RSI(${period})`, PAD.left + 4, rsiTop + 10);
  }

  // Trade markers
  trades.forEach((t) => {
    const x = toX(t.index);
    const y = toY(t.price);
    ctx.beginPath();
    if (t.type === "BUY") {
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#10B981";
    } else {
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#EF4444";
    }
    ctx.fill();
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
}

export default function StrategiesPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedAsset, setSelectedAsset] = useState(DEFAULT_ASSETS[0]);
  const [prices, setPrices] = useState<number[]>([]);
  const [indicator, setIndicator] = useState<"SMA" | "EMA" | "BB" | "RSI">("SMA");
  const [period, setPeriod] = useState(14);
  const [smaPeriod, setSmaPeriod] = useState(20);
  const [rsiOverbought, setRsiOverbought] = useState(70);
  const [rsiOversold, setRsiOversold] = useState(30);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [hasRun, setHasRun] = useState(false);

  // Generate price data when asset changes
  useEffect(() => {
    const seed = ASSET_SEEDS[selectedAsset.id];
    const candles = generateOHLC(seed.price, POINTS, seed.volatility, seed.trend);
    const p = candles.map((c) => c.close);
    setPrices(p);
    setResult(null);
    setHasRun(false);
  }, [selectedAsset]);

  // Redraw chart
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || prices.length === 0) return;
    const trades = result?.trades ?? [];
    drawStrategyChart(canvas, prices, indicator, period, smaPeriod, trades);
  }, [prices, indicator, period, smaPeriod, result]);

  // Resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      if (prices.length > 0) {
        drawStrategyChart(canvas, prices, indicator, period, smaPeriod, result?.trades ?? []);
      }
    });
    ro.observe(canvas.parentElement!);
    return () => ro.disconnect();
  }, [prices, indicator, period, smaPeriod, result]);

  const handleRunBacktest = () => {
    if (prices.length === 0) return;
    const backtestResult = runBacktest(prices, {
      indicator,
      buyCondition: "",
      sellCondition: "",
      period,
      rsiOverbought,
      rsiOversold,
      smaPeriod,
    });
    setResult(backtestResult);
    setHasRun(true);
  };

  const handleRegen = () => {
    const seed = ASSET_SEEDS[selectedAsset.id];
    const candles = generateOHLC(seed.price, POINTS, seed.volatility, seed.trend);
    setPrices(candles.map((c) => c.close));
    setResult(null);
    setHasRun(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900 flex flex-col font-sans">
      <TopNav />
      
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white shadow-sm z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="font-extrabold text-lg tracking-tight">Strategy Builder</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* Left sidebar — strategy config */}
        <div className="w-80 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col overflow-y-auto">
          <div className="px-5 py-4 border-b border-gray-100 bg-slate-50/50">
            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Strategy Config</p>
          </div>

          <div className="p-5 space-y-6">

            {/* Asset */}
            <div>
              <label className="text-gray-600 font-bold text-xs mb-1.5 block">Asset</label>
              <select
                value={selectedAsset.id}
                onChange={(e) => {
                  const a = DEFAULT_ASSETS.find((a) => a.id === e.target.value);
                  if (a) setSelectedAsset(a);
                }}
                className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer shadow-sm hover:border-gray-300"
              >
                {DEFAULT_ASSETS.map((a) => (
                  <option key={a.id} value={a.id}>{a.symbol} — {a.name}</option>
                ))}
              </select>
            </div>

            {/* Indicator */}
            <div>
              <label className="text-gray-600 font-bold text-xs mb-1.5 block">Indicator</label>
              <div className="grid grid-cols-2 gap-2">
                {(["SMA", "EMA", "BB", "RSI"] as const).map((ind) => (
                  <button
                    key={ind}
                    onClick={() => setIndicator(ind)}
                    className={`py-2 rounded-lg text-sm font-bold border transition-all active:scale-95 shadow-sm ${
                      indicator === ind
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-white text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                    }`}
                  >
                    {ind}
                  </button>
                ))}
              </div>
            </div>

            {/* Period */}
            {(indicator === "SMA" || indicator === "EMA") && (
              <div>
                <label className="text-gray-600 font-bold text-xs mb-1.5 block">
                  Period — {smaPeriod} days
                </label>
                <input
                  type="range"
                  min={5}
                  max={50}
                  value={smaPeriod}
                  onChange={(e) => setSmaPeriod(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-gray-400 font-bold text-[10px] mt-1.5">
                  <span>5</span><span>50</span>
                </div>
              </div>
            )}

            {indicator === "BB" && (
              <div>
                <label className="text-gray-600 font-bold text-xs mb-1.5 block">
                  BB Period — {period} days
                </label>
                <input
                  type="range"
                  min={5}
                  max={50}
                  value={period}
                  onChange={(e) => setPeriod(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
            )}

            {indicator === "RSI" && (
              <div className="space-y-4">
                <div>
                  <label className="text-gray-600 font-bold text-xs mb-1.5 block">
                    RSI Period — {period} days
                  </label>
                  <input
                    type="range"
                    min={5}
                    max={30}
                    value={period}
                    onChange={(e) => setPeriod(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  />
                </div>
                <div>
                  <label className="text-gray-600 font-bold text-xs mb-1.5 block">
                    Overbought Threshold — {rsiOverbought}
                  </label>
                  <input
                    type="range"
                    min={60}
                    max={90}
                    value={rsiOverbought}
                    onChange={(e) => setRsiOverbought(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-500"
                  />
                </div>
                <div>
                  <label className="text-gray-600 font-bold text-xs mb-1.5 block">
                    Oversold Threshold — {rsiOversold}
                  </label>
                  <input
                    type="range"
                    min={10}
                    max={40}
                    value={rsiOversold}
                    onChange={(e) => setRsiOversold(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>
              </div>
            )}

            {/* Strategy description */}
            <div className="bg-slate-50 rounded-xl p-4 border border-gray-200">
              <p className="text-gray-500 font-bold text-[10px] uppercase tracking-widest mb-2">
                Active Strategy
              </p>
              <p className="text-gray-700 font-semibold text-sm leading-relaxed">
                {indicator === "SMA" && `BUY when price crosses above SMA(${smaPeriod}). SELL when price crosses below SMA(${smaPeriod}).`}
                {indicator === "EMA" && `BUY when price crosses above EMA(${smaPeriod}). SELL when price crosses below EMA(${smaPeriod}).`}
                {indicator === "BB" && `BUY when price touches lower Bollinger Band. SELL when price touches upper Bollinger Band.`}
                {indicator === "RSI" && `BUY when RSI crosses above ${rsiOversold} (oversold). SELL when RSI crosses below ${rsiOverbought} (overbought).`}
              </p>
            </div>

            {/* Buttons */}
            <div className="space-y-3 pt-2">
              <button
                onClick={handleRunBacktest}
                className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-3 rounded-xl shadow-lg shadow-gray-900/20 transition-all active:scale-95 text-sm"
              >
                ▶ Run Strategy Backtest
              </button>
              <button
                onClick={handleRegen}
                className="w-full bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-bold py-3 rounded-xl transition-all active:scale-95 text-sm shadow-sm"
              >
                ↺ Generate New Market Data
              </button>
            </div>
          </div>
        </div>

        {/* Main area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">

          {/* Chart */}
          <div className="flex-1 p-6">
            <div
              className="w-full h-full rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-sm"
              style={{ minHeight: 320 }}
            >
              <canvas
                ref={canvasRef}
                className="w-full h-full"
                style={{ minHeight: 320 }}
              />
            </div>
          </div>

          {/* Results */}
          {hasRun && result && (
            <div className="p-6 border-t border-gray-200 bg-white">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                {[
                  { label: "Final Value", value: fmt(result.finalValue), color: "#111827" },
                  {
                    label: "Total Return",
                    value: `${result.totalReturn >= 0 ? "+" : ""}${fmt(result.totalReturn)}`,
                    color: result.totalReturn >= 0 ? "#059669" : "#DC2626",
                  },
                  {
                    label: "Return %",
                    value: `${result.totalReturnPct >= 0 ? "+" : ""}${result.totalReturnPct}%`,
                    color: result.totalReturnPct >= 0 ? "#059669" : "#DC2626",
                  },
                  { label: "Total Trades", value: result.totalTrades.toString(), color: "#111827" },
                  { label: "Win Rate", value: `${result.winRate}%`, color: result.winRate >= 50 ? "#059669" : "#DC2626" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-slate-50 rounded-xl p-4 border border-gray-200">
                    <p className="text-gray-500 font-bold text-[10px] uppercase tracking-widest mb-1.5">{label}</p>
                    <p className="text-xl font-extrabold font-mono tracking-tight" style={{ color }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Trade log */}
              {result.trades.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm max-h-56 overflow-y-auto overflow-hidden">
                  <div className="sticky top-0 bg-slate-50 border-b border-gray-200 px-4 py-3">
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Trade Log Activity</p>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 font-semibold text-xs border-b border-gray-100 uppercase tracking-wider bg-white">
                        <th className="text-left pb-2 pt-2 px-4">Type</th>
                        <th className="text-right pb-2 pt-2 px-4">Price Executed</th>
                        <th className="text-left pb-2 pt-2 pl-4">Trigger Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.trades.map((t, i) => (
                        <tr key={i} className="border-b border-gray-100 hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-4 font-semibold">
                            <span className={`font-bold px-2 py-0.5 rounded-md border text-[10px] tracking-wider ${
                              t.type === "BUY"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-red-50 text-red-700 border-red-200"
                            }`}>
                              {t.type}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-gray-900 border-r border-gray-50">
                            {fmt(t.price)}
                          </td>
                          <td className="py-2.5 pl-4 px-4 font-medium text-gray-600">{t.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {result.trades.length === 0 && (
                <div className="bg-slate-50 rounded-xl border border-dashed border-gray-200 p-6 text-center">
                  <p className="text-gray-500 font-medium text-sm">
                    No trades were triggered with this strategy on the current price data.<br/>
                    Try adjusting the dynamic parameters on the left or generating new random market data.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}