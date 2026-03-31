"use client";

import { useEffect, useRef, useState } from "react";
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

  ctx.fillStyle = "#0F172A";
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
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  for (let g = 0; g <= 5; g++) {
    const y = PAD.top + (g / 5) * cH;
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(PAD.left + cW, y);
    ctx.stroke();
    const val = max - (g / 5) * range;
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "11px monospace";
    ctx.textAlign = "right";
    ctx.fillText(val.toFixed(2), PAD.left - 8, y + 4);
  }

  // Price line
  ctx.beginPath();
  ctx.strokeStyle = "rgba(96,165,250,0.8)";
  ctx.lineWidth = 1.5;
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
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`SMA(${smaPeriod})`, PAD.left + 4, PAD.top + 14);
  }

  // EMA overlay
  if (indicator === "EMA") {
    ctx.beginPath();
    ctx.strokeStyle = "#A78BFA";
    ctx.lineWidth = 1.5;
    ema.forEach((e, i) => {
      i === 0 ? ctx.moveTo(toX(e.index), toY(e.value)) : ctx.lineTo(toX(e.index), toY(e.value));
    });
    ctx.stroke();
    ctx.fillStyle = "#A78BFA";
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`EMA(${smaPeriod})`, PAD.left + 4, PAD.top + 14);
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

    ctx.fillStyle = "rgba(15,23,42,0.9)";
    ctx.fillRect(PAD.left, rsiTop, cW, rsiH);
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.strokeRect(PAD.left, rsiTop, cW, rsiH);

    // Overbought/oversold lines
    [30, 70].forEach((level) => {
      const y = rsiTop + rsiH - (level / 100) * rsiH;
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = level === 70 ? "rgba(239,68,68,0.4)" : "rgba(16,185,129,0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(PAD.left + cW, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = level === 70 ? "rgba(239,68,68,0.6)" : "rgba(16,185,129,0.6)";
      ctx.font = "9px monospace";
      ctx.textAlign = "right";
      ctx.fillText(level.toString(), PAD.left - 4, y + 3);
    });

    ctx.beginPath();
    ctx.strokeStyle = "#A78BFA";
    ctx.lineWidth = 1.5;
    rsi.forEach((r, i) => {
      const x = toX(r.index);
      const y = rsiTop + rsiH - (r.value / 100) * rsiH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = "#A78BFA";
    ctx.font = "9px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`RSI(${period})`, PAD.left + 4, rsiTop + 10);
  }

  // Trade markers
  trades.forEach((t) => {
    const x = toX(t.index);
    const y = toY(t.price);
    ctx.beginPath();
    if (t.type === "BUY") {
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#10B981";
    } else {
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#EF4444";
    }
    ctx.fill();
    ctx.strokeStyle = "#0F172A";
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
    <div
      className="min-h-screen bg-slate-950 text-white flex flex-col"
      style={{ fontFamily: "monospace" }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-bold text-lg">JTRADE</span>
          <span className="text-white/30 text-sm">/ Strategy Builder</span>
        </div>
        <div className="flex gap-4">
          <a href="/charts" className="text-white/40 hover:text-white text-sm transition">Charts</a>
          <a href="/portfolio" className="text-white/40 hover:text-white text-sm transition">Portfolio</a>
          <a href="/patterns" className="text-white/40 hover:text-white text-sm transition">Patterns</a>
          <a href="/dashboard" className="text-white/40 hover:text-white text-sm transition">Dashboard</a>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* Left sidebar — strategy config */}
        <div className="w-72 flex-shrink-0 border-r border-white/10 flex flex-col overflow-y-auto">
          <div className="px-4 py-3 border-b border-white/10">
            <p className="text-white/60 text-xs uppercase tracking-widest">Strategy Config</p>
          </div>

          <div className="p-4 space-y-4">

            {/* Asset */}
            <div>
              <label className="text-white/40 text-xs mb-1 block">Asset</label>
              <select
                value={selectedAsset.id}
                onChange={(e) => {
                  const a = DEFAULT_ASSETS.find((a) => a.id === e.target.value);
                  if (a) setSelectedAsset(a);
                }}
                className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {DEFAULT_ASSETS.map((a) => (
                  <option key={a.id} value={a.id}>{a.symbol} — {a.name}</option>
                ))}
              </select>
            </div>

            {/* Indicator */}
            <div>
              <label className="text-white/40 text-xs mb-1 block">Indicator</label>
              <div className="grid grid-cols-2 gap-2">
                {(["SMA", "EMA", "BB", "RSI"] as const).map((ind) => (
                  <button
                    key={ind}
                    onClick={() => setIndicator(ind)}
                    className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                      indicator === ind
                        ? "border-blue-500 bg-blue-500/20 text-blue-400"
                        : "border-white/10 bg-white/5 text-white/40 hover:text-white/60"
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
                <label className="text-white/40 text-xs mb-1 block">
                  Period — {smaPeriod} days
                </label>
                <input
                  type="range"
                  min={5}
                  max={50}
                  value={smaPeriod}
                  onChange={(e) => setSmaPeriod(parseInt(e.target.value))}
                  className="w-full accent-blue-500"
                />
                <div className="flex justify-between text-white/20 text-[10px] mt-1">
                  <span>5</span><span>50</span>
                </div>
              </div>
            )}

            {indicator === "BB" && (
              <div>
                <label className="text-white/40 text-xs mb-1 block">
                  BB Period — {period} days
                </label>
                <input
                  type="range"
                  min={5}
                  max={50}
                  value={period}
                  onChange={(e) => setPeriod(parseInt(e.target.value))}
                  className="w-full accent-blue-500"
                />
              </div>
            )}

            {indicator === "RSI" && (
              <>
                <div>
                  <label className="text-white/40 text-xs mb-1 block">
                    RSI Period — {period} days
                  </label>
                  <input
                    type="range"
                    min={5}
                    max={30}
                    value={period}
                    onChange={(e) => setPeriod(parseInt(e.target.value))}
                    className="w-full accent-purple-500"
                  />
                </div>
                <div>
                  <label className="text-white/40 text-xs mb-1 block">
                    Overbought — {rsiOverbought}
                  </label>
                  <input
                    type="range"
                    min={60}
                    max={90}
                    value={rsiOverbought}
                    onChange={(e) => setRsiOverbought(parseInt(e.target.value))}
                    className="w-full accent-red-500"
                  />
                </div>
                <div>
                  <label className="text-white/40 text-xs mb-1 block">
                    Oversold — {rsiOversold}
                  </label>
                  <input
                    type="range"
                    min={10}
                    max={40}
                    value={rsiOversold}
                    onChange={(e) => setRsiOversold(parseInt(e.target.value))}
                    className="w-full accent-green-500"
                  />
                </div>
              </>
            )}

            {/* Strategy description */}
            <div className="bg-slate-900 rounded-lg p-3 border border-white/10">
              <p className="text-white/40 text-[10px] uppercase tracking-widest mb-2">
                Active Strategy
              </p>
              <p className="text-white/70 text-xs leading-relaxed">
                {indicator === "SMA" && `BUY when price crosses above SMA(${smaPeriod}). SELL when price crosses below SMA(${smaPeriod}).`}
                {indicator === "EMA" && `BUY when price crosses above EMA(${smaPeriod}). SELL when price crosses below EMA(${smaPeriod}).`}
                {indicator === "BB" && `BUY when price touches lower Bollinger Band. SELL when price touches upper Bollinger Band.`}
                {indicator === "RSI" && `BUY when RSI crosses above ${rsiOversold} (oversold). SELL when RSI crosses below ${rsiOverbought} (overbought).`}
              </p>
            </div>

            {/* Buttons */}
            <button
              onClick={handleRunBacktest}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg transition text-sm"
            >
              ▶ Run Backtest
            </button>
            <button
              onClick={handleRegen}
              className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 font-bold py-2 rounded-lg transition text-sm"
            >
              ↺ Generate New Data
            </button>
          </div>
        </div>

        {/* Main area */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Chart */}
          <div className="flex-1 p-4">
            <div
              className="w-full h-full rounded-2xl overflow-hidden border border-white/10 bg-slate-900"
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
            <div className="p-4 border-t border-white/10">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                {[
                  { label: "Final Value", value: fmt(result.finalValue), color: "#60A5FA" },
                  {
                    label: "Total Return",
                    value: `${result.totalReturn >= 0 ? "+" : ""}${fmt(result.totalReturn)}`,
                    color: result.totalReturn >= 0 ? "#34D399" : "#F87171",
                  },
                  {
                    label: "Return %",
                    value: `${result.totalReturnPct >= 0 ? "+" : ""}${result.totalReturnPct}%`,
                    color: result.totalReturnPct >= 0 ? "#34D399" : "#F87171",
                  },
                  { label: "Total Trades", value: result.totalTrades.toString(), color: "#F59E0B" },
                  { label: "Win Rate", value: `${result.winRate}%`, color: result.winRate >= 50 ? "#34D399" : "#F87171" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-slate-800 rounded-xl p-3 border border-white/10">
                    <p className="text-white/40 text-[10px] uppercase tracking-widest mb-1">{label}</p>
                    <p className="text-lg font-bold font-mono" style={{ color }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Trade log */}
              {result.trades.length > 0 && (
                <div className="bg-slate-800 rounded-xl border border-white/10 p-4 max-h-40 overflow-y-auto">
                  <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Trade Log</p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-white/30 border-b border-white/10">
                        <th className="text-left pb-2">Type</th>
                        <th className="text-right pb-2">Price</th>
                        <th className="text-left pb-2 pl-4">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.trades.map((t, i) => (
                        <tr key={i} className="border-b border-white/5">
                          <td className="py-1.5">
                            <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                              t.type === "BUY"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-red-500/20 text-red-400"
                            }`}>
                              {t.type}
                            </span>
                          </td>
                          <td className="py-1.5 text-right font-mono text-white/70">
                            {fmt(t.price)}
                          </td>
                          <td className="py-1.5 pl-4 text-white/40">{t.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {result.trades.length === 0 && (
                <div className="bg-slate-800 rounded-xl border border-white/10 p-4 text-center">
                  <p className="text-white/30 text-sm">
                    No trades were triggered with this strategy on the current data.
                    Try adjusting the parameters or generating new data.
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