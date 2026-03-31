"use client";

import { useEffect, useRef, useState } from "react";
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
function StatCard({ label, value, sub, color = "#fff" }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-white/10">
      <p className="text-white/40 text-[10px] uppercase tracking-widest mb-1">{label}</p>
      <p className="text-lg font-bold font-mono" style={{ color }}>{value}</p>
      {sub && <p className="text-white/30 text-xs mt-1">{sub}</p>}
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

  ctx.fillStyle = "#0F172A";
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
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + cW, y); ctx.stroke();
    const val = max - (g / 4) * range;
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "10px monospace";
    ctx.textAlign = "right";
    ctx.fillText(val.toFixed(2), PAD.left - 6, y + 3);
  }

  // BB shading
  if (showBB && bb.length > 0) {
    ctx.beginPath();
    bb.forEach((b, i) => i === 0 ? ctx.moveTo(toX(b.index), toY(b.upper)) : ctx.lineTo(toX(b.index), toY(b.upper)));
    [...bb].reverse().forEach((b) => ctx.lineTo(toX(b.index), toY(b.lower)));
    ctx.closePath();
    ctx.fillStyle = "rgba(245,158,11,0.07)";
    ctx.fill();

    const drawLine = (vals: number[], color: string) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      bb.forEach((b, i) => i === 0 ? ctx.moveTo(toX(b.index), toY(vals[i])) : ctx.lineTo(toX(b.index), toY(vals[i])));
      ctx.stroke();
    };
    drawLine(bb.map((b) => b.upper), "rgba(239,68,68,0.6)");
    drawLine(bb.map((b) => b.middle), "rgba(245,158,11,0.6)");
    drawLine(bb.map((b) => b.lower), "rgba(16,185,129,0.6)");
  }

  // Price area
  const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + cH);
  grad.addColorStop(0, "rgba(96,165,250,0.2)");
  grad.addColorStop(1, "rgba(96,165,250,0)");
  ctx.beginPath();
  prices.forEach((p, i) => i === 0 ? ctx.moveTo(toX(i), toY(p)) : ctx.lineTo(toX(i), toY(p)));
  ctx.lineTo(toX(prices.length - 1), PAD.top + cH);
  ctx.lineTo(PAD.left, PAD.top + cH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Price line
  ctx.beginPath();
  ctx.strokeStyle = "#60A5FA";
  ctx.lineWidth = 2;
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
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`SMA(${smaPeriod})`, PAD.left + 4, PAD.top + 12);
  }

  // EMA
  if (showEMA && ema.length > 0) {
    ctx.beginPath();
    ctx.strokeStyle = "#A78BFA";
    ctx.lineWidth = 1.5;
    ema.forEach((e, i) => i === 0 ? ctx.moveTo(toX(e.index), toY(e.value)) : ctx.lineTo(toX(e.index), toY(e.value)));
    ctx.stroke();
    ctx.fillStyle = "#A78BFA";
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`EMA(${smaPeriod})`, PAD.left + 4, PAD.top + 24);
  }

  // X labels
  [0, 0.25, 0.5, 0.75, 1].forEach((frac) => {
    const idx = Math.floor(frac * (candles.length - 1));
    const x = toX(idx);
    const label = new Date(candles[idx].time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText(label, x, H - 8);
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

  ctx.fillStyle = "#0F172A";
  ctx.fillRect(0, 0, W, H);

  const rsi = calcRSI(prices, period);
  if (rsi.length === 0) return;

  const toY = (v: number) => PAD.top + cH - (v / 100) * cH;
  const toX = (i: number) => PAD.left + ((i - rsi[0].index) / (prices.length - 1 - rsi[0].index)) * cW;

  // Zones
  ctx.fillStyle = "rgba(239,68,68,0.06)";
  ctx.fillRect(PAD.left, toY(100), cW, toY(70) - toY(100));
  ctx.fillStyle = "rgba(16,185,129,0.06)";
  ctx.fillRect(PAD.left, toY(30), cW, toY(0) - toY(30));

  // Reference lines
  [30, 50, 70].forEach((level) => {
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = level === 50 ? "rgba(255,255,255,0.1)" : level === 70 ? "rgba(239,68,68,0.4)" : "rgba(16,185,129,0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD.left, toY(level));
    ctx.lineTo(PAD.left + cW, toY(level));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "9px monospace";
    ctx.textAlign = "right";
    ctx.fillText(level.toString(), PAD.left - 4, toY(level) + 3);
  });

  // RSI line
  ctx.beginPath();
  ctx.strokeStyle = "#A78BFA";
  ctx.lineWidth = 1.5;
  rsi.forEach((r, i) => i === 0 ? ctx.moveTo(toX(r.index), toY(r.value)) : ctx.lineTo(toX(r.index), toY(r.value)));
  ctx.stroke();

  // Current value dot
  const last = rsi[rsi.length - 1];
  ctx.beginPath();
  ctx.arc(toX(last.index), toY(last.value), 4, 0, Math.PI * 2);
  ctx.fillStyle = "#A78BFA";
  ctx.fill();

  // X labels
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.font = "9px monospace";
  ctx.textAlign = "center";
  ctx.fillText("RSI", PAD.left + cW / 2, H - 4);
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

  ctx.fillStyle = "#0F172A";
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
    ctx.fillStyle = isUp ? "rgba(16,185,129,0.5)" : "rgba(239,68,68,0.5)";
    ctx.fillRect(x - barW / 2, PAD.top + cH - h, barW, h);
  });

  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.font = "9px monospace";
  ctx.textAlign = "center";
  ctx.fillText("VOLUME", PAD.left + cW / 2, H - 4);

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

  ctx.fillStyle = "#0F172A";
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
  grad.addColorStop(0, "rgba(251,191,36,0.3)");
  grad.addColorStop(1, "rgba(251,191,36,0)");
  ctx.beginPath();
  volSeries.forEach((v, i) => i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v)));
  ctx.lineTo(toX(volSeries.length - 1), PAD.top + cH);
  ctx.lineTo(PAD.left, PAD.top + cH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  ctx.strokeStyle = "#FBB724";
  ctx.lineWidth = 1.5;
  volSeries.forEach((v, i) => i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v)));
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.font = "9px monospace";
  ctx.textAlign = "center";
  ctx.fillText("VOLATILITY", PAD.left + cW / 2, H - 4);
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
    <div className="min-h-screen bg-slate-950 text-white flex flex-col" style={{ fontFamily: "monospace" }}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-bold text-lg">JTRADE</span>
          <span className="text-white/30 text-sm">/ Analytics Dashboard</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="/strategies" className="text-white/40 hover:text-white text-sm transition">Strategies</a>
          <a href="/patterns" className="text-white/40 hover:text-white text-sm transition">Patterns</a>
          <a href="/portfolio" className="text-white/40 hover:text-white text-sm transition">Portfolio</a>
          <a href="/dashboard" className="text-white/40 hover:text-white text-sm transition">Dashboard</a>
          <button
            onClick={() => setIsLive((v) => !v)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
              isLive ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400" : "border-white/10 bg-white/5 text-white/40"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-emerald-400 animate-pulse" : "bg-white/30"}`} />
            {isLive ? "LIVE" : "PAUSED"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* Left sidebar */}
        <div className="w-64 flex-shrink-0 border-r border-white/10 overflow-y-auto">
          <div className="px-4 py-3 border-b border-white/10">
            <p className="text-white/60 text-xs uppercase tracking-widest">Controls</p>
          </div>
          <div className="p-4 space-y-5">

            {/* Asset */}
            <div>
              <label className="text-white/40 text-xs mb-2 block">Asset</label>
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

            {/* Time Range */}
            <div>
              <label className="text-white/40 text-xs mb-2 block">Time Range</label>
              <div className="grid grid-cols-4 gap-1">
                {TIME_RANGES.map((r) => (
                  <button
                    key={r}
                    onClick={() => setTimeRange(r)}
                    className={`py-1.5 rounded text-xs font-bold border transition-all ${
                      timeRange === r
                        ? "border-blue-500 bg-blue-500/20 text-blue-400"
                        : "border-white/10 bg-white/5 text-white/40 hover:text-white/60"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* SMA Period */}
            <div>
              <label className="text-white/40 text-xs mb-1 block">MA Period — {smaPeriod}</label>
              <input
                type="range" min={5} max={50} value={smaPeriod}
                onChange={(e) => setSmaPeriod(parseInt(e.target.value))}
                className="w-full accent-yellow-500"
              />
            </div>

            {/* RSI Period */}
            <div>
              <label className="text-white/40 text-xs mb-1 block">RSI Period — {rsiPeriod}</label>
              <input
                type="range" min={5} max={30} value={rsiPeriod}
                onChange={(e) => setRsiPeriod(parseInt(e.target.value))}
                className="w-full accent-purple-500"
              />
            </div>

            {/* Indicator Toggles */}
            <div>
              <label className="text-white/40 text-xs mb-2 block">Indicators</label>
              <div className="space-y-2">
                {[
                  { label: `SMA(${smaPeriod})`, state: showSMA, set: setShowSMA, color: "#F59E0B" },
                  { label: `EMA(${smaPeriod})`, state: showEMA, set: setShowEMA, color: "#A78BFA" },
                  { label: "Bollinger Bands", state: showBB, set: setShowBB, color: "#F59E0B" },
                  { label: "RSI Panel", state: showRSI, set: setShowRSI, color: "#A78BFA" },
                  { label: "Volume Panel", state: showVolume, set: setShowVolume, color: "#60A5FA" },
                  { label: "Volatility Panel", state: showVolatility, set: setShowVolatility, color: "#FBB724" },
                ].map(({ label, state, set, color }) => (
                  <button
                    key={label}
                    onClick={() => set((v: boolean) => !v)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition-all ${
                      state ? "border-white/10 bg-white/5" : "border-white/5 bg-white/[0.02] opacity-40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: state ? color : "#444" }} />
                      <span className="text-white">{label}</span>
                    </div>
                    <span className={`text-[10px] font-bold ${state ? "text-emerald-400" : "text-white/20"}`}>
                      {state ? "ON" : "OFF"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <StatCard label="Last Price" value={fmt(last)} color="#60A5FA" />
            <StatCard
              label="Change"
              value={fmtPct(priceChangePct)}
              sub={`${priceChange >= 0 ? "+" : ""}${fmt(priceChange)}`}
              color={priceChange >= 0 ? "#34D399" : "#F87171"}
            />
            <StatCard label="Period High" value={fmt(high)} color="#34D399" />
            <StatCard label="Period Low" value={fmt(low)} color="#F87171" />
            <StatCard
              label={`SMA(${smaPeriod})`}
              value={fmt(currentSMA)}
              sub={last > currentSMA ? "▲ Price above" : "▼ Price below"}
              color="#F59E0B"
            />
            <StatCard
              label="RSI"
              value={currentRSI.toFixed(1)}
              sub={currentRSI > 70 ? "Overbought" : currentRSI < 30 ? "Oversold" : "Neutral"}
              color={currentRSI > 70 ? "#F87171" : currentRSI < 30 ? "#34D399" : "#A78BFA"}
            />
          </div>

          {/* Second stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Mean Price" value={fmt(mean)} color="#94A3B8" />
            <StatCard label="Std Deviation" value={fmt(stdDev)} sub="Price dispersion" color="#94A3B8" />
            <StatCard label={`EMA(${smaPeriod})`} value={fmt(currentEMA)} color="#A78BFA" />
            <StatCard
              label="Trend"
              value={last > currentSMA ? "BULLISH" : "BEARISH"}
              sub="Based on SMA"
              color={last > currentSMA ? "#34D399" : "#F87171"}
            />
          </div>

          {/* Price chart */}
          <div className="bg-slate-900 rounded-2xl border border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between">
              <p className="text-white/60 text-xs uppercase tracking-widest">
                Price Chart — {selectedAsset.symbol}
              </p>
              <p className="text-white/20 text-xs font-mono">TICK #{tick.toString().padStart(4, "0")}</p>
            </div>
            <canvas ref={priceCanvasRef} className="w-full" style={{ height: 260 }} />
          </div>

          {/* Sub charts grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {showRSI && (
              <div className="bg-slate-900 rounded-2xl border border-white/10 overflow-hidden">
                <div className="px-4 py-2 border-b border-white/10">
                  <p className="text-white/60 text-xs uppercase tracking-widest">RSI({rsiPeriod})</p>
                </div>
                <canvas ref={rsiCanvasRef} className="w-full" style={{ height: 140 }} />
              </div>
            )}
            {showVolume && (
              <div className="bg-slate-900 rounded-2xl border border-white/10 overflow-hidden">
                <div className="px-4 py-2 border-b border-white/10">
                  <p className="text-white/60 text-xs uppercase tracking-widest">Volume</p>
                </div>
                <canvas ref={volCanvasRef} className="w-full" style={{ height: 140 }} />
              </div>
            )}
            {showVolatility && (
              <div className="bg-slate-900 rounded-2xl border border-white/10 overflow-hidden">
                <div className="px-4 py-2 border-b border-white/10">
                  <p className="text-white/60 text-xs uppercase tracking-widest">Volatility</p>
                </div>
                <canvas ref={volatilityCanvasRef} className="w-full" style={{ height: 140 }} />
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}