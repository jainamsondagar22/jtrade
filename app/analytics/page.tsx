"use client";

import { useEffect, useRef, useState } from "react";
import TopNav from "@/components/TopNav";
import { DEFAULT_ASSETS, ASSET_SEEDS, generateOHLC, OHLC } from "@/lib/assetData";
import { calcSMA, calcEMA, calcRSI, calcBollingerBands } from "@/lib/indicators";

const TIME_RANGES = [15, 30, 60, 100];

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function fmtPct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

// ── Stat Card ────────────────────────────────────────────────
function StatCard({ label, value, sub, color = "#111827" }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex flex-col justify-center">
      <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1.5">{label}</p>
      <p className="text-2xl font-extrabold font-mono tracking-tight" style={{ color }}>{value}</p>
      {sub && <p className="text-gray-400 font-medium text-xs mt-1.5">{sub}</p>}
    </div>
  );
}

// ── Price + MA Canvas ────────────────────────────────────────
function drawPriceChart(
  canvas: HTMLCanvasElement,
  candles: OHLC[],
  showSMA: boolean,
  showEMA: boolean,
  showBB: boolean,
  smaPeriod: number
) {
  const ctx = canvas.getContext("2d");
  if (!ctx || candles.length === 0) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  const PAD = { top: 20, right: 20, bottom: 36, left: 68 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);

  const prices = candles.map((c) => c.close);
  const sma = calcSMA(prices, smaPeriod);
  const ema = calcEMA(prices, smaPeriod);
  const bb = calcBollingerBands(prices, smaPeriod);

  let allVals = [...prices];
  if (showBB) bb.forEach((b) => allVals.push(b.upper, b.lower));

  const min = Math.min(...allVals) * 0.997;
  const max = Math.max(...allVals) * 1.003;
  const range = max - min || 1;

  const toY = (v: number) => PAD.top + cH - ((v - min) / range) * cH;
  const toX = (i: number) => PAD.left + (i / (prices.length - 1)) * cW;

  // Grid
  for (let g = 0; g <= 4; g++) {
    const y = PAD.top + (g / 4) * cH;
    ctx.strokeStyle = "rgba(0,0,0,0.05)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + cW, y); ctx.stroke();
    const val = max - (g / 4) * range;
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.font = "10px Inter, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(val.toFixed(2), PAD.left - 6, y + 3);
  }

  // BB shading
  if (showBB && bb.length > 0) {
    ctx.beginPath();
    bb.forEach((b, i) => i === 0 ? ctx.moveTo(toX(b.index), toY(b.upper)) : ctx.lineTo(toX(b.index), toY(b.upper)));
    [...bb].reverse().forEach((b) => ctx.lineTo(toX(b.index), toY(b.lower)));
    ctx.closePath();
    ctx.fillStyle = "rgba(245,158,11,0.04)";
    ctx.fill();

    const drawLine = (vals: number[], color: string) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      bb.forEach((b, i) => i === 0 ? ctx.moveTo(toX(b.index), toY(vals[i])) : ctx.lineTo(toX(b.index), toY(vals[i])));
      ctx.stroke();
    };
    drawLine(bb.map((b) => b.upper), "rgba(239,68,68,0.7)");
    drawLine(bb.map((b) => b.middle), "rgba(245,158,11,0.7)");
    drawLine(bb.map((b) => b.lower), "rgba(16,185,129,0.7)");
  }

  // Price area
  const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + cH);
  grad.addColorStop(0, "rgba(59,130,246,0.15)");
  grad.addColorStop(1, "rgba(59,130,246,0)");
  ctx.beginPath();
  prices.forEach((p, i) => i === 0 ? ctx.moveTo(toX(i), toY(p)) : ctx.lineTo(toX(i), toY(p)));
  ctx.lineTo(toX(prices.length - 1), PAD.top + cH);
  ctx.lineTo(PAD.left, PAD.top + cH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Price line
  ctx.beginPath();
  ctx.strokeStyle = "#3B82F6";
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  prices.forEach((p, i) => i === 0 ? ctx.moveTo(toX(i), toY(p)) : ctx.lineTo(toX(i), toY(p)));
  ctx.stroke();

  // SMA
  if (showSMA && sma.length > 0) {
    ctx.beginPath();
    ctx.strokeStyle = "#F59E0B";
    ctx.lineWidth = 1.5;
    sma.forEach((s, i) => i === 0 ? ctx.moveTo(toX(s.index), toY(s.value)) : ctx.lineTo(toX(s.index), toY(s.value)));
    ctx.stroke();
    ctx.fillStyle = "#F59E0B";
    ctx.font = "bold 10px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`SMA(${smaPeriod})`, PAD.left + 4, PAD.top + 12);
  }

  // EMA
  if (showEMA && ema.length > 0) {
    ctx.beginPath();
    ctx.strokeStyle = "#8B5CF6";
    ctx.lineWidth = 1.5;
    ema.forEach((e, i) => i === 0 ? ctx.moveTo(toX(e.index), toY(e.value)) : ctx.lineTo(toX(e.index), toY(e.value)));
    ctx.stroke();
    ctx.fillStyle = "#8B5CF6";
    ctx.font = "bold 10px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`EMA(${smaPeriod})`, PAD.left + 4, PAD.top + 26);
  }

  // X labels
  [0, 0.25, 0.5, 0.75, 1].forEach((frac) => {
    const idx = Math.floor(frac * (candles.length - 1));
    const x = toX(idx);
    const label = new Date(candles[idx].time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.font = "10px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, x, H - 12);
  });
}

// ── RSI Canvas ───────────────────────────────────────────────
function drawRSIChart(canvas: HTMLCanvasElement, prices: number[], period: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  const PAD = { top: 12, right: 20, bottom: 28, left: 40 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);

  const rsi = calcRSI(prices, period);
  if (rsi.length === 0) return;

  const toY = (v: number) => PAD.top + cH - (v / 100) * cH;
  const toX = (i: number) => PAD.left + ((i - rsi[0].index) / (prices.length - 1 - rsi[0].index)) * cW;

  // Zones
  ctx.fillStyle = "rgba(239,68,68,0.05)";
  ctx.fillRect(PAD.left, toY(100), cW, toY(70) - toY(100));
  ctx.fillStyle = "rgba(16,185,129,0.05)";
  ctx.fillRect(PAD.left, toY(30), cW, toY(0) - toY(30));

  // Reference lines
  [30, 50, 70].forEach((level) => {
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = level === 50 ? "rgba(0,0,0,0.15)" : level === 70 ? "rgba(239,68,68,0.4)" : "rgba(16,185,129,0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD.left, toY(level));
    ctx.lineTo(PAD.left + cW, toY(level));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.font = "9px Inter, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(level.toString(), PAD.left - 4, toY(level) + 3);
  });

  // RSI line
  ctx.beginPath();
  ctx.strokeStyle = "#8B5CF6";
  ctx.lineWidth = 2;
  rsi.forEach((r, i) => i === 0 ? ctx.moveTo(toX(r.index), toY(r.value)) : ctx.lineTo(toX(r.index), toY(r.value)));
  ctx.stroke();

  // Current value dot
  const last = rsi[rsi.length - 1];
  ctx.beginPath();
  ctx.arc(toX(last.index), toY(last.value), 4.5, 0, Math.PI * 2);
  ctx.fillStyle = "#8B5CF6";
  ctx.fill();

  // X labels
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.font = "bold 9px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("RSI", PAD.left + cW / 2, H - 8);
}

// ── Volume Canvas ─────────────────────────────────────────────
function drawVolumeChart(canvas: HTMLCanvasElement, candles: OHLC[]) {
  const ctx = canvas.getContext("2d");
  if (!ctx || candles.length === 0) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  const PAD = { top: 12, right: 20, bottom: 28, left: 68 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);

  const vols = candles.map((c) => c.volume);
  const maxVol = Math.max(...vols);
  const barW = Math.max(2, cW / candles.length - 1);

  const toX = (i: number) => PAD.left + (i / (candles.length - 1)) * cW;
  const toH = (v: number) => (v / maxVol) * cH;

  vols.forEach((v, i) => {
    const x = toX(i);
    const h = toH(v);
    const isUp = candles[i].close >= candles[i].open;
    ctx.fillStyle = isUp ? "rgba(16,185,129,0.7)" : "rgba(239,68,68,0.7)";
    ctx.fillRect(x - barW / 2, PAD.top + cH - h, barW, h);
  });

  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.font = "bold 9px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("VOLUME", PAD.left + cW / 2, H - 8);

  const maxLabel = (maxVol / 1000000).toFixed(1) + "M";
  ctx.textAlign = "right";
  ctx.fillText(maxLabel, PAD.left - 4, PAD.top + 8);
}

// ── Volatility Canvas ─────────────────────────────────────────
function drawVolatilityChart(canvas: HTMLCanvasElement, prices: number[]) {
  const ctx = canvas.getContext("2d");
  if (!ctx || prices.length < 2) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  const PAD = { top: 12, right: 20, bottom: 28, left: 52 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);

  // Rolling 10-period volatility
  const volSeries: number[] = [];
  for (let i = 10; i < prices.length; i++) {
    const slice = prices.slice(i - 10, i);
    const mean = slice.reduce((a, b) => a + b, 0) / 10;
    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / 10;
    volSeries.push(Math.sqrt(variance));
  }

  if (volSeries.length === 0) return;

  const minV = Math.min(...volSeries);
  const maxV = Math.max(...volSeries) || 1;
  const toY = (v: number) => PAD.top + cH - ((v - minV) / (maxV - minV || 1)) * cH;
  const toX = (i: number) => PAD.left + (i / (volSeries.length - 1)) * cW;

  const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + cH);
  grad.addColorStop(0, "rgba(251,191,36,0.2)");
  grad.addColorStop(1, "rgba(251,191,36,0)");
  ctx.beginPath();
  volSeries.forEach((v, i) => i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v)));
  ctx.lineTo(toX(volSeries.length - 1), PAD.top + cH);
  ctx.lineTo(PAD.left, PAD.top + cH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  ctx.strokeStyle = "#F59E0B";
  ctx.lineWidth = 2;
  volSeries.forEach((v, i) => i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v)));
  ctx.stroke();

  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.font = "bold 9px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("VOLATILITY", PAD.left + cW / 2, H - 8);
}

// ── Main Page ─────────────────────────────────────────────────
export default function AnalyticsPage() {
  const priceCanvasRef = useRef<HTMLCanvasElement>(null);
  const rsiCanvasRef = useRef<HTMLCanvasElement>(null);
  const volCanvasRef = useRef<HTMLCanvasElement>(null);
  const volatilityCanvasRef = useRef<HTMLCanvasElement>(null);

  const [selectedAsset, setSelectedAsset] = useState(DEFAULT_ASSETS[0]);
  const [candles, setCandles] = useState<OHLC[]>([]);
  const [timeRange, setTimeRange] = useState(60);
  const [smaPeriod, setSmaPeriod] = useState(20);
  const [rsiPeriod, setRsiPeriod] = useState(14);
  const [isLive, setIsLive] = useState(true);
  const [tick, setTick] = useState(0);

  const [showSMA, setShowSMA] = useState(true);
  const [showEMA, setShowEMA] = useState(true);
  const [showBB, setShowBB] = useState(false);
  const [showRSI, setShowRSI] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [showVolatility, setShowVolatility] = useState(true);

  // Seed candles
  useEffect(() => {
    const seed = ASSET_SEEDS[selectedAsset.id];
    setCandles(generateOHLC(seed.price, timeRange, seed.volatility, seed.trend));
  }, [selectedAsset, timeRange]);

  // Live tick
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      setCandles((prev) => {
        if (prev.length === 0) return prev;
        const seed = ASSET_SEEDS[selectedAsset.id];
        const lastClose = prev[prev.length - 1].close;
        const newCandle = generateOHLC(lastClose, 1, seed.volatility, seed.trend)[0];
        return [...prev.slice(1), { ...newCandle, time: new Date().toISOString() }];
      });
      setTick((t) => t + 1);
    }, 2000);
    return () => clearInterval(interval);
  }, [isLive, selectedAsset]);

  // Redraw all charts
  useEffect(() => {
    if (candles.length === 0) return;
    const prices = candles.map((c) => c.close);
    if (priceCanvasRef.current) drawPriceChart(priceCanvasRef.current, candles, showSMA, showEMA, showBB, smaPeriod);
    if (rsiCanvasRef.current && showRSI) drawRSIChart(rsiCanvasRef.current, prices, rsiPeriod);
    if (volCanvasRef.current && showVolume) drawVolumeChart(volCanvasRef.current, candles);
    if (volatilityCanvasRef.current && showVolatility) drawVolatilityChart(volatilityCanvasRef.current, prices);
  }, [candles, showSMA, showEMA, showBB, showRSI, showVolume, showVolatility, smaPeriod, rsiPeriod, tick]);

  // Computed stats
  const prices = candles.map((c) => c.close);
  const last = prices[prices.length - 1] ?? 0;
  const first = prices[0] ?? 0;
  const high = candles.length > 0 ? Math.max(...candles.map((c) => c.high)) : 0;
  const low = candles.length > 0 ? Math.min(...candles.map((c) => c.low)) : 0;
  const mean = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (prices.length || 1);
  const stdDev = Math.sqrt(variance);
  const priceChange = last - first;
  const priceChangePct = first !== 0 ? (priceChange / first) * 100 : 0;
  const rsiValues = calcRSI(prices, rsiPeriod);
  const currentRSI = rsiValues[rsiValues.length - 1]?.value ?? 0;
  const smaValues = calcSMA(prices, smaPeriod);
  const currentSMA = smaValues[smaValues.length - 1]?.value ?? 0;
  const emaValues = calcEMA(prices, smaPeriod);
  const currentEMA = emaValues[emaValues.length - 1]?.value ?? 0;

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900 flex flex-col font-sans">
      <TopNav />

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="font-extrabold text-lg tracking-tight">Market Analytics</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsLive((v) => !v)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold border transition-all active:scale-95 ${
              isLive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-gray-50 text-gray-400"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-emerald-500 animate-pulse" : "bg-gray-300"}`} />
            {isLive ? "LIVE DATA" : "PAUSED"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* Left sidebar */}
        <div className="w-72 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col overflow-y-auto">
          <div className="px-5 py-4 border-b border-gray-100 bg-slate-50/50">
            <p className="text-gray-500 text-xs uppercase font-bold tracking-widest">Dashboard Controls</p>
          </div>
          <div className="p-5 space-y-6">

            {/* Asset */}
            <div>
              <label className="text-gray-600 font-bold text-xs mb-1.5 block">Target Asset</label>
              <select
                value={selectedAsset.id}
                onChange={(e) => {
                  const a = DEFAULT_ASSETS.find((a) => a.id === e.target.value);
                  if (a) setSelectedAsset(a);
                }}
                className="w-full bg-slate-50 border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all hover:bg-white cursor-pointer"
              >
                {DEFAULT_ASSETS.map((a) => (
                  <option key={a.id} value={a.id}>{a.symbol} — {a.name}</option>
                ))}
              </select>
            </div>

            {/* Time Range */}
            <div>
              <label className="text-gray-600 font-bold text-xs mb-1.5 block">Sample Time Range</label>
              <div className="grid grid-cols-4 gap-1.5">
                {TIME_RANGES.map((r) => (
                  <button
                    key={r}
                    onClick={() => setTimeRange(r)}
                    className={`py-2 rounded-lg text-xs font-bold border transition-all active:scale-95 shadow-sm ${
                      timeRange === r
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-white text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* SMA Period */}
            <div>
              <label className="text-gray-600 font-bold text-xs mb-1.5 block">Moving Avg Period — {smaPeriod}</label>
              <input
                type="range" min={5} max={50} value={smaPeriod}
                onChange={(e) => setSmaPeriod(parseInt(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-yellow-500"
              />
            </div>

            {/* RSI Period */}
            <div>
              <label className="text-gray-600 font-bold text-xs mb-1.5 block">Oscillator Period — {rsiPeriod}</label>
              <input
                type="range" min={5} max={30} value={rsiPeriod}
                onChange={(e) => setRsiPeriod(parseInt(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>

            {/* Indicator Toggles */}
            <div className="pt-2 border-t border-gray-100">
              <label className="text-gray-600 font-bold text-xs mb-3 block">Visible Modules</label>
              <div className="space-y-2">
                {[
                  { label: `SMA(${smaPeriod})`, state: showSMA, set: setShowSMA, color: "#F59E0B" },
                  { label: `EMA(${smaPeriod})`, state: showEMA, set: setShowEMA, color: "#8B5CF6" },
                  { label: "Bollinger Bands", state: showBB, set: setShowBB, color: "#F59E0B" },
                  { label: "RSI Momentum", state: showRSI, set: setShowRSI, color: "#8B5CF6" },
                  { label: "Volume Graph", state: showVolume, set: setShowVolume, color: "#3B82F6" },
                  { label: "Volatility Graph", state: showVolatility, set: setShowVolatility, color: "#F59E0B" },
                ].map(({ label, state, set, color }) => (
                  <button
                    key={label}
                    onClick={() => set((v: boolean) => !v)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                      state ? "border-gray-200 bg-white shadow-sm" : "border-transparent bg-gray-50 text-gray-400 hover:bg-gray-100"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: state ? color : "#CBD5E1" }} />
                      <span className={state ? "text-gray-900" : "text-gray-400"}>{label}</span>
                    </div>
                    <span className={`text-[10px] font-bold tracking-wider ${state ? "text-emerald-600" : "text-transparent"}`}>
                      ON
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <StatCard label="Live Asset Price" value={fmt(last)} color="#111827" />
            <StatCard
              label="Net Change"
              value={fmtPct(priceChangePct)}
              sub={`${priceChange >= 0 ? "+" : ""}${fmt(priceChange)}`}
              color={priceChange >= 0 ? "#059669" : "#DC2626"}
            />
            <StatCard label="Period High" value={fmt(high)} color="#059669" />
            <StatCard label="Period Low" value={fmt(low)} color="#DC2626" />
            <StatCard
              label={`SMA Limit (${smaPeriod})`}
              value={fmt(currentSMA)}
              sub={last > currentSMA ? "▲ Tracking above" : "▼ Tracking below"}
              color="#D97706"
            />
            <StatCard
              label="RSI Force"
              value={currentRSI.toFixed(1)}
              sub={currentRSI > 70 ? "Overbought Level" : currentRSI < 30 ? "Oversold Level" : "Neutral Base"}
              color={currentRSI > 70 ? "#DC2626" : currentRSI < 30 ? "#059669" : "#7C3AED"}
            />
          </div>

          {/* Second stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="True Mean Price" value={fmt(mean)} color="#475569" />
            <StatCard label="Standard Deviation" value={fmt(stdDev)} sub="Price dispersion metric" color="#475569" />
            <StatCard label={`EMA Line (${smaPeriod})`} value={fmt(currentEMA)} color="#7C3AED" />
            <StatCard
              label="General Trend"
              value={last > currentSMA ? "BULLISH" : "BEARISH"}
              sub="Based on moving average"
              color={last > currentSMA ? "#059669" : "#DC2626"}
            />
          </div>

          {/* Price chart */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
              <p className="text-gray-500 font-bold text-xs uppercase tracking-widest">
                Aggregated Chart — {selectedAsset.symbol}
              </p>
              <p className="text-gray-400 text-xs font-mono font-bold bg-white px-2 py-0.5 rounded border border-gray-200 shadow-sm">TICK #{tick.toString().padStart(4, "0")}</p>
            </div>
            <div className="p-4">
              <canvas ref={priceCanvasRef} className="w-full rounded-lg border border-gray-100" style={{ height: 300 }} />
            </div>
          </div>

          {/* Sub charts grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {showRSI && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                <div className="px-5 py-3 border-b border-gray-100 bg-slate-50/50">
                  <p className="text-gray-500 font-bold text-xs uppercase tracking-widest">Oscillator RSI({rsiPeriod})</p>
                </div>
                <div className="p-4 flex-1">
                 <canvas ref={rsiCanvasRef} className="w-full rounded-lg border border-gray-100" style={{ height: 160 }} />
                </div>
              </div>
            )}
            {showVolume && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                <div className="px-5 py-3 border-b border-gray-100 bg-slate-50/50">
                  <p className="text-gray-500 font-bold text-xs uppercase tracking-widest">Market Volume</p>
                </div>
                <div className="p-4 flex-1">
                 <canvas ref={volCanvasRef} className="w-full rounded-lg border border-gray-100" style={{ height: 160 }} />
                </div>
              </div>
            )}
            {showVolatility && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                <div className="px-5 py-3 border-b border-gray-100 bg-slate-50/50">
                  <p className="text-gray-500 font-bold text-xs uppercase tracking-widest">Market Volatility</p>
                </div>
                <div className="p-4 flex-1">
                 <canvas ref={volatilityCanvasRef} className="w-full rounded-lg border border-gray-100" style={{ height: 160 }} />
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}