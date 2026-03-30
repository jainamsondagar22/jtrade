
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { OHLC, ASSET_SEEDS, DEFAULT_ASSETS, generateOHLC } from "@/lib/assetData";
import { detectPatterns, DetectedPattern, PatternType } from "@/lib/patternRecognition";

const POINTS = 60;
const REFRESH_MS = 2000;

const ALL_PATTERNS: PatternType[] = [
  "Doji",
  "Hammer",
  "Shooting Star",
  "Bullish Engulfing",
  "Bearish Engulfing",
  "Morning Star",
  "Evening Star",
];

function drawPatternChart(
  canvas: HTMLCanvasElement,
  candles: OHLC[],
  patterns: DetectedPattern[],
  activeFilters: PatternType[],
  tooltip: { index: number; pattern: DetectedPattern } | null
) {
  const ctx = canvas.getContext("2d");
  if (!ctx || candles.length === 0) return;

  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  const PAD = { top: 40, right: 20, bottom: 48, left: 72 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  // Background
  ctx.fillStyle = "#0F172A";
  ctx.fillRect(0, 0, W, H);

  // Price range
  let globalMin = Infinity;
  let globalMax = -Infinity;
  candles.forEach((c) => {
    globalMin = Math.min(globalMin, c.low);
    globalMax = Math.max(globalMax, c.high);
  });
  const priceRange = globalMax - globalMin || 1;
  const toY = (v: number) => PAD.top + cH - ((v - globalMin) / priceRange) * cH;
  const toX = (i: number) => PAD.left + (i / (candles.length - 1)) * cW;
  const candleW = Math.max(3, cW / candles.length - 2);

  // Grid
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  for (let g = 0; g <= 5; g++) {
    const y = PAD.top + (g / 5) * cH;
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(PAD.left + cW, y);
    ctx.stroke();
    const val = globalMax - (g / 5) * priceRange;
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "11px monospace";
    ctx.textAlign = "right";
    ctx.fillText(val.toFixed(2), PAD.left - 8, y + 4);
  }

  // X axis labels
  [0, 0.25, 0.5, 0.75, 1].forEach((frac) => {
    const idx = Math.floor(frac * (candles.length - 1));
    const x = toX(idx);
    const label = new Date(candles[idx].time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillText(label, x, H - 12);
  });

  // Pattern highlight backgrounds
  const visiblePatterns = patterns.filter((p) => activeFilters.includes(p.type));
  visiblePatterns.forEach((p) => {
    const x = toX(p.index);
    ctx.fillStyle = p.color + "18";
    ctx.fillRect(x - candleW * 2, PAD.top, candleW * 4, cH);
  });

  // Candlesticks
  candles.forEach((candle, i) => {
    const x = toX(i);
    const isUp = candle.close >= candle.open;
    const color = isUp ? "#10B981" : "#EF4444";

    // Wick
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, toY(candle.high));
    ctx.lineTo(x, toY(candle.low));
    ctx.stroke();

    // Body
    const bodyTop = toY(Math.max(candle.open, candle.close));
    const bodyBot = toY(Math.min(candle.open, candle.close));
    ctx.fillStyle = color;
    ctx.fillRect(x - candleW / 2, bodyTop, candleW, Math.max(1, bodyBot - bodyTop));
  });

  // Pattern markers — coloured triangles above/below candles
  visiblePatterns.forEach((p) => {
    const x = toX(p.index);
    const candle = candles[p.index];
    const isActive = tooltip?.index === p.index;

    if (p.signal === "bullish" || p.signal === "neutral") {
      // Triangle below candle pointing up
      const y = toY(candle.low) + 14;
      ctx.beginPath();
      ctx.moveTo(x, y - 10);
      ctx.lineTo(x - 6, y);
      ctx.lineTo(x + 6, y);
      ctx.closePath();
      ctx.fillStyle = p.color;
      ctx.fill();
    } else {
      // Triangle above candle pointing down
      const y = toY(candle.high) - 14;
      ctx.beginPath();
      ctx.moveTo(x, y + 10);
      ctx.lineTo(x - 6, y);
      ctx.lineTo(x + 6, y);
      ctx.closePath();
      ctx.fillStyle = p.color;
      ctx.fill();
    }

    // Pattern label
    if (isActive) {
      ctx.fillStyle = p.color;
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center";
      ctx.fillText(p.type, x, p.signal === "bearish" ? toY(candle.high) - 28 : toY(candle.low) + 30);
    }
  });

  // Tooltip box
  if (tooltip) {
    const p = tooltip.pattern;
    const x = toX(tooltip.index);
    const candle = candles[tooltip.index];
    const boxW = 220;
    const boxH = 64;
    const boxX = Math.min(x - boxW / 2, W - boxW - 8);
    const boxY = p.signal === "bearish"
      ? toY(candle.high) - boxH - 36
      : toY(candle.low) + 36;

    ctx.fillStyle = "#1E293B";
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(Math.max(8, boxX), Math.max(8, boxY), boxW, boxH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = p.color;
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "left";
    ctx.fillText(p.type, Math.max(16, boxX + 10), Math.max(24, boxY + 20));

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "10px monospace";
    const words = p.description.split(" ");
    let line = "";
    let lineY = Math.max(24, boxY + 36);
    words.forEach((word) => {
      const test = line + word + " ";
      if (ctx.measureText(test).width > boxW - 20) {
        ctx.fillText(line, Math.max(16, boxX + 10), lineY);
        line = word + " ";
        lineY += 14;
      } else {
        line = test;
      }
    });
    ctx.fillText(line, Math.max(16, boxX + 10), lineY);
  }
}

export default function PatternsPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedAsset, setSelectedAsset] = useState(DEFAULT_ASSETS[1]); // BTC default
  const [candles, setCandles] = useState<OHLC[]>([]);
  const [patterns, setPatterns] = useState<DetectedPattern[]>([]);
  const [activeFilters, setActiveFilters] = useState<PatternType[]>([...ALL_PATTERNS]);
  const [tooltip, setTooltip] = useState<{ index: number; pattern: DetectedPattern } | null>(null);
  const [isLive, setIsLive] = useState(true);
  const [tick, setTick] = useState(0);

  // Seed initial candles
  useEffect(() => {
    const seed = ASSET_SEEDS[selectedAsset.id];
    const initial = generateOHLC(seed.price, POINTS, seed.volatility, seed.trend);
    setCandles(initial);
    setPatterns(detectPatterns(initial));
  }, [selectedAsset]);

  // Live tick
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      setCandles((prev) => {
        if (prev.length === 0) return prev;
        const seed = ASSET_SEEDS[selectedAsset.id];
        const lastClose = prev[prev.length - 1].close;
        const newCandle = generateOHLC(lastClose, 1, seed.volatility, seed.trend)[0];
        const updated = [...prev.slice(1), { ...newCandle, time: new Date().toISOString() }];
        setPatterns(detectPatterns(updated));
        return updated;
      });
      setTick((t) => t + 1);
    }, REFRESH_MS);
    return () => clearInterval(interval);
  }, [isLive, selectedAsset]);

  // Redraw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || candles.length === 0) return;
    drawPatternChart(canvas, candles, patterns, activeFilters, tooltip);
  }, [candles, patterns, activeFilters, tooltip, tick]);

  // Resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      if (candles.length > 0) drawPatternChart(canvas, candles, patterns, activeFilters, tooltip);
    });
    ro.observe(canvas.parentElement!);
    return () => ro.disconnect();
  }, [candles, patterns, activeFilters, tooltip]);

  // Canvas click — show tooltip for nearest pattern
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || candles.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const PAD_LEFT = 72;
    const cW = canvas.clientWidth - PAD_LEFT - 20;
    const clickIndex = Math.round(((clickX - PAD_LEFT) / cW) * (candles.length - 1));
    const visiblePatterns = patterns.filter((p) => activeFilters.includes(p.type));
    const hit = visiblePatterns.find((p) => Math.abs(p.index - clickIndex) <= 2);
    if (hit) {
      setTooltip(tooltip?.index === hit.index ? null : { index: hit.index, pattern: hit });
    } else {
      setTooltip(null);
    }
  }, [candles, patterns, activeFilters, tooltip]);

  const toggleFilter = useCallback((type: PatternType) => {
    setActiveFilters((prev) =>
      prev.includes(type) ? prev.filter((f) => f !== type) : [...prev, type]
    );
  }, []);

  const visibleCount = patterns.filter((p) => activeFilters.includes(p.type)).length;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col" style={{ fontFamily: "monospace" }}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-bold text-lg">JTRADE</span>
          <span className="text-white/30 text-sm">/ Pattern Recognition</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="/charts" className="text-white/40 hover:text-white text-sm transition">Charts</a>
          <a href="/portfolio" className="text-white/40 hover:text-white text-sm transition">Portfolio</a>
          <a href="/dashboard" className="text-white/40 hover:text-white text-sm transition">Dashboard</a>
          <button
            onClick={() => setIsLive((v) => !v)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
              isLive
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                : "border-white/10 bg-white/5 text-white/40"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-emerald-400 animate-pulse" : "bg-white/30"}`} />
            {isLive ? "LIVE" : "PAUSED"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* Chart */}
        <div className="flex-1 relative p-4">

          {/* Asset selector */}
          <div className="flex items-center gap-3 mb-3">
            {DEFAULT_ASSETS.map((a) => (
              <button
                key={a.id}
                onClick={() => setSelectedAsset(a)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                  selectedAsset.id === a.id
                    ? "text-white border-white/30 bg-white/10"
                    : "text-white/30 border-white/10 hover:text-white/60"
                }`}
                style={selectedAsset.id === a.id ? { borderColor: a.color, color: a.color, backgroundColor: a.color + "22" } : {}}
              >
                {a.symbol}
              </button>
            ))}
          </div>

          <div
            className="w-full rounded-2xl overflow-hidden border border-white/10 bg-slate-900 cursor-crosshair"
            style={{ minHeight: 420 }}
          >
            <canvas
              ref={canvasRef}
              className="w-full"
              style={{ minHeight: 420, height: "calc(100vh - 280px)" }}
              onClick={handleCanvasClick}
            />
          </div>

          <div className="flex justify-between mt-2">
            <p className="text-white/20 text-xs">Click on a pattern marker to see details</p>
            <p className="text-white/20 text-xs font-mono">TICK #{tick.toString().padStart(4, "0")}</p>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="w-72 flex-shrink-0 border-l border-white/10 flex flex-col">

          {/* Pattern filters */}
          <div className="px-4 py-3 border-b border-white/10">
            <div className="flex justify-between items-center mb-3">
              <p className="text-white/60 text-xs uppercase tracking-widest">Pattern Filters</p>
              <span className="text-white/30 text-xs">{visibleCount} detected</span>
            </div>
            <div className="space-y-2">
              {ALL_PATTERNS.map((type) => {
                const count = patterns.filter((p) => p.type === type).length;
                const active = activeFilters.includes(type);
                const info = patterns.find((p) => p.type === type);
                const color = info?.color ?? "#888";
                return (
                  <button
                    key={type}
                    onClick={() => toggleFilter(type)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition-all ${
                      active
                        ? "border-white/10 bg-white/5"
                        : "border-white/5 bg-white/[0.02] opacity-40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: active ? color : "#444" }}
                      />
                      <span className="text-white">{type}</span>
                    </div>
                    <span
                      className="font-bold font-mono"
                      style={{ color: count > 0 ? color : "rgba(255,255,255,0.2)" }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recent detections */}
          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-white/60 text-xs uppercase tracking-widest mb-3">
              Recent Detections
            </p>
            {patterns.filter((p) => activeFilters.includes(p.type)).length === 0 ? (
              <p className="text-white/20 text-xs">No patterns detected yet.</p>
            ) : (
              <div className="space-y-2">
                {[...patterns]
                  .filter((p) => activeFilters.includes(p.type))
                  .slice(-8)
                  .reverse()
                  .map((p, i) => (
                    <div
                      key={i}
                      className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 cursor-pointer hover:bg-white/10 transition"
                      onClick={() => setTooltip({ index: p.index, pattern: p })}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className="text-xs font-bold"
                          style={{ color: p.color }}
                        >
                          {p.type}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          p.signal === "bullish"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : p.signal === "bearish"
                            ? "bg-red-500/20 text-red-400"
                            : "bg-yellow-500/20 text-yellow-400"
                        }`}>
                          {p.signal.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-white/30 text-[10px] leading-relaxed">
                        {p.description.slice(0, 60)}...
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="p-4 border-t border-white/10">
            <p className="text-white/20 text-xs leading-relaxed">
              ▲ Bullish signal — green triangle below candle{"\n"}
              ▼ Bearish signal — red triangle above candle{"\n"}
              Click any marker to see explanation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}