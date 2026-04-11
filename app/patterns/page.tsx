"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import TopNav from "@/components/TopNav";
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

  // Background - White theme
  ctx.fillStyle = "#FFFFFF";
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
  ctx.strokeStyle = "rgba(0,0,0,0.05)";
  ctx.lineWidth = 1;
  for (let g = 0; g <= 5; g++) {
    const y = PAD.top + (g / 5) * cH;
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(PAD.left + cW, y);
    ctx.stroke();
    const val = globalMax - (g / 5) * priceRange;
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.font = "11px Inter, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(val.toFixed(2), PAD.left - 8, y + 4);
  }

  // X axis labels
  [0, 0.25, 0.5, 0.75, 1].forEach((frac) => {
    const idx = Math.floor(frac * (candles.length - 1));
    const x = toX(idx);
    const label = new Date(candles[idx].time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.font = "11px Inter, sans-serif";
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
    ctx.lineWidth = 1.5;
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
      ctx.font = "bold 11px Inter, sans-serif";
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

    ctx.fillStyle = "#FFFFFF"; // Tooltip bg
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(Math.max(8, boxX), Math.max(8, boxY), boxW, boxH, 8);
    ctx.fill();
    ctx.shadowColor = "rgba(0,0,0,0.1)";
    ctx.shadowBlur = 10;
    ctx.stroke();
    // remove shadow for text
    ctx.shadowBlur = 0;

    ctx.fillStyle = p.color;
    ctx.font = "bold 12px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(p.type, Math.max(16, boxX + 10), Math.max(24, boxY + 20));

    ctx.fillStyle = "rgba(0,0,0,0.6)"; // text light mapped
    ctx.font = "10px Inter, sans-serif";
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
    <div className="min-h-screen bg-slate-50 text-gray-900 flex flex-col font-sans">

      <TopNav />

      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white shadow-sm shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-extrabold text-lg tracking-tight">Pattern Recognition Engine</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsLive((v) => !v)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold border transition-all active:scale-95 ${
              isLive
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-gray-200 bg-gray-50 text-gray-400"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-emerald-500 animate-pulse" : "bg-gray-300"}`} />
            {isLive ? "LIVE SCANNING" : "SCAN PAUSED"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* Chart */}
        <div className="flex-1 relative p-6">

          {/* Asset selector */}
          <div className="flex items-center gap-3 mb-4">
            {DEFAULT_ASSETS.map((a) => (
              <button
                key={a.id}
                onClick={() => setSelectedAsset(a)}
                className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all active:scale-95 shadow-sm ${
                  selectedAsset.id === a.id
                    ? "bg-white"
                    : "text-gray-500 border-gray-200 bg-white hover:text-gray-900"
                }`}
                style={selectedAsset.id === a.id ? { borderColor: a.color, color: a.color, backgroundColor: a.color + "10" } : {}}
              >
                {a.symbol}
              </button>
            ))}
          </div>

          <div
            className="w-full rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-sm cursor-crosshair pb-1"
            style={{ minHeight: 420 }}
          >
            <canvas
              ref={canvasRef}
              className="w-full bg-white"
              style={{ minHeight: 420, height: "calc(100vh - 280px)" }}
              onClick={handleCanvasClick}
            />
          </div>

          <div className="flex justify-between mt-3">
            <p className="text-gray-400 text-xs font-medium">Click on a pattern marker to see details</p>
            <p className="text-gray-400 text-xs font-mono font-bold bg-white px-2 py-0.5 rounded border border-gray-200">TICK #{tick.toString().padStart(4, "0")}</p>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="w-80 flex-shrink-0 border-l border-gray-200 bg-white flex flex-col z-0">

          {/* Pattern filters */}
          <div className="px-5 py-4 border-b border-gray-100 bg-slate-50/50">
            <div className="flex justify-between items-center mb-3">
              <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Active Filters</p>
              <span className="text-gray-400 text-xs font-bold">{visibleCount} detected</span>
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
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-all font-medium ${
                      active
                        ? "border-gray-200 bg-white shadow-sm"
                        : "border-gray-100 bg-gray-50 opacity-50 text-gray-400 hover:opacity-100"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: active ? color : "#D1D5DB" }}
                      />
                      <span className={active ? "text-gray-900" : "text-gray-500"}>{type}</span>
                    </div>
                    <span
                      className="font-bold font-mono text-sm"
                      style={{ color: count > 0 && active ? color : "rgba(0,0,0,0.3)" }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recent detections */}
          <div className="flex-1 overflow-y-auto p-5">
            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-3">
              Recent Activity
            </p>
            {patterns.filter((p) => activeFilters.includes(p.type)).length === 0 ? (
              <p className="text-gray-400 text-xs font-medium border border-dashed border-gray-200 rounded-lg p-4 text-center">No patterns detected yet.</p>
            ) : (
              <div className="space-y-3">
                {[...patterns]
                  .filter((p) => activeFilters.includes(p.type))
                  .slice(-8)
                  .reverse()
                  .map((p, i) => (
                    <div
                      key={i}
                      className="px-4 py-3 rounded-xl border border-gray-200 bg-white shadow-sm cursor-pointer hover:border-gray-300 transition-all hover:shadow"
                      onClick={() => setTooltip({ index: p.index, pattern: p })}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className="text-xs font-extrabold"
                          style={{ color: p.color }}
                        >
                          {p.type}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold tracking-wider ${
                          p.signal === "bullish"
                            ? "bg-emerald-100 text-emerald-700"
                            : p.signal === "bearish"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}>
                          {p.signal.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-gray-500 text-xs leading-relaxed font-medium">
                        {p.description.slice(0, 60)}...
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="p-5 border-t border-gray-100 bg-slate-50/50">
            <p className="text-gray-400 text-xs leading-relaxed font-semibold">
              <span className="text-emerald-500">▲</span> Bullish signal — below candle{"\n"}
              <span className="text-red-500">▼</span> Bearish signal — above candle{"\n"}
              Click any marker to see explanation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}