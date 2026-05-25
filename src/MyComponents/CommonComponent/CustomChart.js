import React, { useRef, useEffect, useState } from "react";
import { useCanvasThemeKey, getChartTheme } from "../../utils/canvasTheme";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LabelList,
  Legend,
} from "recharts";

/* ─────────────────────────────────────────
   MULTI-SERIES CUSTOM TOOLTIP
───────────────────────────────────────── */
const CustomTooltip = ({ active, payload, label, lineLabels }) => {
  if (!active || !payload || !payload.length) return null;
  const t = getChartTheme();

  const fmt = (val) =>
    typeof val === "number" && val > 999
      ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val)
      : val;

  return (
    <div style={{
      background: t.tooltipBg,
      border: t.tooltipBorder,
      borderRadius: 12,
      padding: "12px 16px",
      boxShadow: "0 20px 50px rgba(15, 23, 42, 0.15)",
      backdropFilter: "blur(24px)",
      fontFamily: "'JetBrains Mono', monospace",
      zIndex: 9999,
      minWidth: 160,
    }}>
      <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: t.tooltipLabel, marginBottom: 8 }}>
        {label}
      </div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: i < payload.length - 1 ? 6 : 0 }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: p.color || p.fill,
            flexShrink: 0,
            boxShadow: `0 0 6px ${p.color || p.fill}`,
          }} />
          <span style={{ fontSize: 10, color: t.tooltipMuted, flex: 1 }}>
            {lineLabels?.[i] || p.name || p.dataKey}
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, color: t.tooltipValue, fontFamily: "'Oxanium', sans-serif" }}>
            {fmt(p.value)}
          </span>
        </div>
      ))}
      <div style={{ width: "100%", height: 1, background: "linear-gradient(to right, rgba(59,130,246,0.5), transparent)", marginTop: 10 }} />
    </div>
  );
};

/* ─────────────────────────────────────────
   PIE LABELS
───────────────────────────────────────── */
const RADIAN = Math.PI / 180;

function computePieLabels(data, yKey, xKey, cx, cy, outerRadius, pieColors) {
  if (!data || data.length === 0) return [];
  const total = data.reduce((s, d) => s + (Number(d[yKey]) || 0), 0);
  if (total === 0) return [];

  let startAngle = 0;
  const slices = data.map((d, i) => {
    const value = Number(d[yKey]) || 0;
    const pct = value / total;
    const sweep = pct * 360;
    const mid = startAngle + sweep / 2;
    startAngle += sweep;
    return { name: d[xKey], value, pct, mid, color: pieColors[i % pieColors.length] };
  });

  const spokeR = outerRadius + 14;
  const elbowR = outerRadius + 30;
  const textOffsetX = 8;
  const MIN_LABEL_GAP = 18;

  const labels = slices.map((s) => {
    const rad = -s.mid * RADIAN;
    const sx = cx + spokeR * Math.cos(rad);
    const sy = cy + spokeR * Math.sin(rad);
    const ex = cx + elbowR * Math.cos(rad);
    const ey = cy + elbowR * Math.sin(rad);
    const isRight = ex >= cx;
    const textX = ex + (isRight ? textOffsetX : -textOffsetX);
    return { ...s, sx, sy, ex, ey, isRight, textX, rawY: ey };
  });

  const spread = (group) => {
    for (let pass = 0; pass < 8; pass++) {
      for (let i = 1; i < group.length; i++) {
        const prev = group[i - 1];
        const curr = group[i];
        const gap = curr.rawY - prev.rawY;
        if (gap < MIN_LABEL_GAP) {
          const push = (MIN_LABEL_GAP - gap) / 2;
          prev.rawY -= push;
          curr.rawY += push;
        }
      }
    }
  };

  const right = labels.filter(l => l.isRight).sort((a, b) => a.rawY - b.rawY);
  const left  = labels.filter(l => !l.isRight).sort((a, b) => a.rawY - b.rawY);
  spread(right);
  spread(left);

  return [...right, ...left];
}

const PieLabelsOverlay = ({ data, yKey, xKey, cx, cy, outerRadius, pieColors }) => {
  if (!cx || !cy || !outerRadius) return null;
  const labels = computePieLabels(data, yKey, xKey, cx, cy, outerRadius, pieColors);

  return (
    <g>
      {labels.map((l, i) => {
        const shortName = l.name && l.name.length > 14 ? l.name.slice(0, 13) + "…" : (l.name || "");
        const pctStr = `${(l.pct * 100).toFixed(1)}%`;
        const valStr = l.value > 999999
          ? `₹${(l.value / 1000000).toFixed(1)}M`
          : l.value > 999
          ? `₹${(l.value / 1000).toFixed(1)}k`
          : String(l.value);

        return (
          <g key={i}>
            <line x1={l.sx} y1={l.sy} x2={l.ex} y2={l.rawY} stroke={l.color} strokeWidth={1} strokeOpacity={0.5} />
            <line x1={l.ex} y1={l.rawY} x2={l.textX} y2={l.rawY} stroke={l.color} strokeWidth={1} strokeOpacity={0.5} />
            <circle cx={l.ex} cy={l.rawY} r={2} fill={l.color} fillOpacity={0.8} />
            <text
              x={l.textX + (l.isRight ? 2 : -2)}
              y={l.rawY - 6}
              textAnchor={l.isRight ? "start" : "end"}
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fill: "rgba(210,215,230,0.95)", fontWeight: 600, letterSpacing: "0.03em" }}
            >
              {shortName}
            </text>
            <text
              x={l.textX + (l.isRight ? 2 : -2)}
              y={l.rawY + 7}
              textAnchor={l.isRight ? "start" : "end"}
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, fill: l.color, letterSpacing: "0.02em" }}
            >
              {valStr} · {pctStr}
            </text>
          </g>
        );
      })}
    </g>
  );
};

/* ─────────────────────────────────────────
   PARTICLE CANVAS BG
───────────────────────────────────────── */
const ChartCanvas3D = ({ color }) => {
  const ref = useRef();
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const pts = Array.from({ length: 28 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: 0.6 + Math.random() * 1.2,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      alpha: 0.15 + Math.random() * 0.25,
    }));
    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pts.forEach((p) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `${color}${Math.round(p.alpha * 255).toString(16).padStart(2, "0")}`;
        ctx.fill();
      });
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 70) {
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.strokeStyle = `${color}${Math.round((1 - dist / 70) * 0.12 * 255).toString(16).padStart(2, "0")}`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [color]);
  return (
    <canvas ref={ref} style={{
      position: "absolute", inset: 0, width: "100%", height: "100%",
      pointerEvents: "none", borderRadius: 14, opacity: 0.5,
    }} />
  );
};

/* ─────────────────────────────────────────
   ANIMATED BAR SHAPE
───────────────────────────────────────── */
const AnimatedBar = (props) => {
  const { fill, x, y, width, height } = props;
  const [animH, setAnimH] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnimH(height), 60);
    return () => clearTimeout(t);
  }, [height]);
  return (
    <rect
      x={x} y={y + (height - animH)}
      width={width} height={animH}
      fill={fill} rx={4}
      style={{ transition: "height 0.55s cubic-bezier(0.34,1.4,0.64,1), y 0.55s cubic-bezier(0.34,1.4,0.64,1)" }}
    />
  );
};

/* ─────────────────────────────────────────
   MULTI-SERIES LEGEND (inline, compact)
───────────────────────────────────────── */
const SeriesLegend = ({ keys, colors, labels }) => (
  <div style={{
    display: "flex", gap: 16, flexWrap: "wrap",
    padding: "6px 14px 2px",
    borderBottom: `1px solid ${getChartTheme().legendBorder}`,
  }}>
    {keys.map((k, i) => (
      <div key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{
          width: 10, height: 10, borderRadius: 2,
          background: colors[i % colors.length],
          boxShadow: `0 0 6px ${colors[i % colors.length]}`,
          display: "inline-block",
        }} />
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          color: colors[i % colors.length],
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}>
          {labels?.[i] || k}
        </span>
      </div>
    ))}
  </div>
);

/* ─────────────────────────────────────────
   BAR CHART — single + multi-series
───────────────────────────────────────── */
const BarChartInner = ({ data, xKey, yKey, barColor, lineColors, lineLabels, formatYAxis, yAxisMax, gradId }) => {
  const ct = getChartTheme();
  const isMulti = Array.isArray(yKey);
  const keys = isMulti ? yKey : [yKey];
  const colors = isMulti ? (lineColors || ["#3b82f6", "#10b981"]) : [barColor];
  const count = data.length;

  const PX_PER_BAR = Math.max(isMulti ? 40 : 24, Math.min(56, 700 / Math.max(count, 1)));
  const LEFT_W = 50;
  const RIGHT_P = 16;
  const computedW = count * PX_PER_BAR + LEFT_W + RIGHT_P;
  const needsScroll = computedW > 700;
  const tickInterval = Math.max(0, Math.ceil(count / 15) - 1);

  const formatX = (v) => {
    if (!v) return "";
    const s = String(v);
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) return s.slice(0, s.lastIndexOf("/"));
    if (s.length > 6) return s.slice(0, 6) + "…";
    return s;
  };

  const sharedProps = {
    data,
    margin: { top: 24, right: RIGHT_P, bottom: 64, left: 0 },
    barCategoryGap: isMulti ? "25%" : (count > 30 ? "20%" : "35%"),
    barGap: 3,
  };

  const ChartContent = ({ width: fixedW }) => {
    const chartEl = fixedW
      ? <BarChart width={fixedW} height={280} {...sharedProps}>{innerContent}</BarChart>
      : <BarChart {...sharedProps}>{innerContent}</BarChart>;

    return chartEl;
  };

  const innerContent = (
    <>
      <defs>
        {keys.map((k, i) => (
          <linearGradient key={k} id={`${gradId}-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors[i]} stopOpacity={1} />
            <stop offset="100%" stopColor={colors[i]} stopOpacity={0.3} />
          </linearGradient>
        ))}
      </defs>
      <CartesianGrid vertical={false} stroke={ct.gridStroke} strokeDasharray="3 3" />
      <XAxis
        dataKey={xKey}
        tickFormatter={formatX}
        interval={needsScroll ? 0 : tickInterval}
        angle={-45}
        textAnchor="end"
        height={64}
        axisLine={false}
        tickLine={false}
        tick={{ fill: ct.tickFill, fontSize: count > 25 ? 9 : 10, fontFamily: "'JetBrains Mono', monospace" }}
        padding={{ left: 12, right: 12 }}
      />
      <YAxis
        domain={[0, yAxisMax]}
        tickFormatter={formatYAxis}
        axisLine={false}
        tickLine={false}
        tick={{ fill: ct.tickFill, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
        width={LEFT_W}
      />
      <Tooltip content={<CustomTooltip lineLabels={lineLabels} />} cursor={{ fill: ct.gridStroke }} />
      {keys.map((k, i) => (
        <Bar
          key={k}
          dataKey={k}
          name={lineLabels?.[i] || k}
          fill={`url(#${gradId}-${i})`}
          radius={[4, 4, 0, 0]}
          maxBarSize={isMulti ? (count > 20 ? 14 : 24) : (count > 40 ? 12 : count > 20 ? 20 : 38)}
        >
          {!isMulti && count <= 25 && (
            <LabelList
              dataKey={k}
              position="top"
              formatter={(v) =>
                v >= 1_000_000 ? `₹${(v / 1_000_000).toFixed(1)}M`
                : v >= 1000 ? `₹${(v / 1000).toFixed(1)}k`
                : String(v)
              }
              style={{ fill: `${colors[i]}dd`, fontSize: 8, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}
            />
          )}
        </Bar>
      ))}
    </>
  );

  return (
    <div style={{ width: "100%" }}>
      {isMulti && (
        <SeriesLegend keys={keys} colors={colors} labels={lineLabels} />
      )}
      <div style={{
        overflowX: needsScroll ? "auto" : "hidden",
        overflowY: "hidden",
        paddingBottom: 2,
        scrollbarWidth: "thin",
        scrollbarColor: `${colors[0]}44 rgba(255,255,255,0.04)`,
      }}>
        <div style={{ width: needsScroll ? computedW : "100%", height: 280 }}>
          {needsScroll ? (
            <BarChart width={computedW} height={280} {...sharedProps}>
              {innerContent}
            </BarChart>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart {...sharedProps}>
                {innerContent}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      {needsScroll && (
        <div style={{
          textAlign: "center", fontSize: 9, color: `${colors[0]}88`,
          fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em",
          paddingTop: 6, paddingBottom: 4,
        }}>
          ← SCROLL TO SEE ALL {count} ITEMS →
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────
   PIE CHART
───────────────────────────────────────── */
const PieChartInner = ({ data, xKey, yKey, pieColors }) => {
  const [dims, setDims] = useState({ cx: 0, cy: 0, outerRadius: 0, width: 0, height: 0 });
  const containerRef = useRef(null);
  const count = data.length;

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      const margin = { left: 90, right: 90, top: 30, bottom: 30 };
      const pieW = width - margin.left - margin.right;
      const pieH = height - margin.top - margin.bottom;
      const maxR = Math.min(pieW, pieH) / 2;
      const scaleF = count > 15 ? 0.52 : count > 8 ? 0.62 : 0.70;
      const outerRadius = Math.max(50, maxR * scaleF);
      setDims({ cx: width / 2, cy: height / 2, outerRadius, width, height });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [count]);

  const containerH = Math.max(340, 280 + count * 12);

  return (
    <div ref={containerRef} style={{ width: "100%", height: containerH, position: "relative" }}>
      <div style={{ position: "absolute", inset: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              {pieColors.map((c, i) => (
                <radialGradient key={i} id={`pieG-${i}`} cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={c} stopOpacity={1} />
                  <stop offset="100%" stopColor={c} stopOpacity={0.5} />
                </radialGradient>
              ))}
            </defs>
            <Tooltip content={<CustomTooltip />} />
            <Pie
              data={data}
              dataKey={yKey}
              nameKey={xKey}
              cx={dims.cx || "50%"}
              cy={dims.cy || "50%"}
              outerRadius={dims.outerRadius || "42%"}
              innerRadius={dims.outerRadius ? dims.outerRadius * 0.40 : "18%"}
              paddingAngle={count > 15 ? 1 : count > 8 ? 2 : 3}
              labelLine={false}
              label={false}
              strokeWidth={0}
              isAnimationActive={true}
            >
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill={`url(#pieG-${i % pieColors.length})`}
                  stroke="rgba(0,0,0,0.5)"
                  strokeWidth={1.5}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      {dims.outerRadius > 0 && (
        <svg
          style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}
          width={dims.width}
          height={dims.height}
        >
          <PieLabelsOverlay
            data={data} yKey={yKey} xKey={xKey}
            cx={dims.cx} cy={dims.cy} outerRadius={dims.outerRadius}
            pieColors={pieColors}
          />
        </svg>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────
   LINE / AREA CHART — single + multi-series
───────────────────────────────────────── */
const LineChartInner = ({ data, xKey, yKey, barColor, lineColors, lineLabels, formatYAxis, yAxisMax, gradId }) => {
  const ct = getChartTheme();
  const isMulti = Array.isArray(yKey);
  const keys = isMulti ? yKey : [yKey];
  const MULTI_COLORS = lineColors || ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#f43f5e"];
  const colors = isMulti ? MULTI_COLORS : [barColor];
  const count = data.length;
  const tickInterval = Math.max(0, Math.ceil(count / 10) - 1);

  const formatX = (v) => {
    if (!v) return "";
    const s = String(v);
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) return s.slice(0, s.lastIndexOf("/"));
    if (s.length > 7) return s.slice(0, 6) + "…";
    return s;
  };

  return (
    <>
      {isMulti && (
        <SeriesLegend keys={keys} colors={colors} labels={lineLabels} />
      )}
      <div style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 20, right: 16, bottom: 56, left: 0 }}>
            <defs>
              {keys.map((k, i) => (
                <linearGradient key={k} id={`${gradId}-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={colors[i]} stopOpacity={0.28} />
                  <stop offset="95%" stopColor={colors[i]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>

            <CartesianGrid vertical={false} stroke={ct.gridStroke} strokeDasharray="3 3" />
            <XAxis
              dataKey={xKey}
              tickFormatter={formatX}
              interval={tickInterval}
              angle={-38}
              textAnchor="end"
              height={56}
              axisLine={false}
              tickLine={false}
              tick={{ fill: ct.tickFill, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
              padding={{ left: 12, right: 12 }}
            />
            <YAxis
              domain={[0, yAxisMax]}
              tickFormatter={formatYAxis}
              axisLine={false}
              tickLine={false}
              tick={{ fill: ct.tickFill, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
              width={50}
            />
            <Tooltip
              content={<CustomTooltip lineLabels={lineLabels} />}
              cursor={{ stroke: `${colors[0]}55`, strokeWidth: 1 }}
            />

            {keys.map((k, i) => (
              <Area
                key={k}
                type="monotone"
                dataKey={k}
                name={lineLabels?.[i] || k}
                stroke={colors[i]}
                strokeWidth={2.5}
                fill={`url(#${gradId}-${i})`}
                dot={count <= 50 ? { r: 3.5, fill: colors[i], strokeWidth: 0 } : false}
                activeDot={{ r: 6, fill: colors[i], stroke: "rgba(0,0,0,0.5)", strokeWidth: 2 }}
                isAnimationActive={true}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </>
  );
};

/* ─────────────────────────────────────────
   SHELL WRAPPER
───────────────────────────────────────── */
const CustomChart = ({
  data = [],
  xKey,
  yKey,
  chartTitle = "",
  barColor = "#3b82f6",
  chartType = "bar",
  lineColors,
  lineLabels,
  pieColors = [
    "#ec4899", "#10b981", "#f59e0b", "#8b5cf6",
    "#f43f5e", "#06b6d4", "#3b82f6", "#84cc16",
    "#fb923c", "#a78bfa", "#34d399", "#f472b6",
    "#facc15", "#38bdf8", "#4ade80", "#e879f9",
    "#818cf8", "#fb7185", "#fbbf24", "#2dd4bf",
  ],
}) => {
  useCanvasThemeKey();
  const ct = getChartTheme();

  if (!data || data.length === 0) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: 260, background: ct.shellBg, borderRadius: 14,
        border: ct.shellBorder,
        fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
        color: ct.emptyColor, letterSpacing: "0.1em",
      }}>
        NO DATA
      </div>
    );
  }

  const isMulti = Array.isArray(yKey);
  const keys = isMulti ? yKey : [yKey];
  const MULTI_COLORS = lineColors || ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#f43f5e"];

  const maxValue = isMulti
    ? Math.max(...data.flatMap(d => keys.map(k => Number(d[k]) || 0)))
    : Math.max(...data.map(d => Number(d[yKey]) || 0));
  const yAxisMax = Math.ceil(maxValue * 1.28);

  const glowHex = barColor.startsWith("#") ? barColor : "#3b82f6";
  const gradId = `bG-${barColor.replace(/[^a-z0-9]/gi, "")}`;

  const formatYAxis = (v) =>
    v >= 1_000_000 ? `₹${(v / 1_000_000).toFixed(1)}M`
    : v >= 1000    ? `₹${(v / 1000).toFixed(0)}k`
    : String(v);

  return (
    <div style={{
      position: "relative",
      width: "100%",
      background: ct.shellBg,
      borderRadius: 14,
      border: ct.shellBorder,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      boxShadow: "inset 0 1px 0 rgba(15, 23, 42, 0.04)",
    }}>
      <ChartCanvas3D color={glowHex} />

      
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 1, zIndex: 1, pointerEvents: "none",
        background: `linear-gradient(to right, transparent, ${glowHex}66 40%, ${glowHex}aa 50%, ${glowHex}66 60%, transparent)`,
      }} />

      {chartTitle && (
        <div style={{
          position: "relative", zIndex: 2,
          padding: "14px 18px 4px",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <div style={{ width: 3, height: 14, background: barColor, borderRadius: 2, boxShadow: `0 0 8px ${barColor}` }} />
          <span style={{ fontFamily: "'Oxanium', sans-serif", fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em", color: "#bcc0d0" }}>
            {chartTitle}
          </span>
        </div>
      )}

      <div style={{
        position: "relative", zIndex: 2,
        height: chartType !== "pie" ? undefined : undefined,
        padding: chartType === "pie" ? "8px 4px 12px" : "8px 8px 4px",
        overflow: chartType === "pie" ? "visible" : "hidden",
      }}>
        {chartType === "bar" && (
          <BarChartInner
            data={data} xKey={xKey} yKey={yKey}
            barColor={barColor}
            lineColors={MULTI_COLORS}
            lineLabels={lineLabels}
            formatYAxis={formatYAxis}
            yAxisMax={yAxisMax} gradId={gradId}
          />
        )}
        {chartType === "line" && (
          <LineChartInner
            data={data} xKey={xKey} yKey={yKey}
            barColor={barColor}
            lineColors={MULTI_COLORS}
            lineLabels={lineLabels}
            formatYAxis={formatYAxis}
            yAxisMax={yAxisMax}
            gradId={`lG-${barColor.replace(/[^a-z0-9]/gi, "")}`}
          />
        )}
        {chartType === "pie" && (
          <PieChartInner
            data={data} xKey={xKey} yKey={Array.isArray(yKey) ? yKey[0] : yKey}
            pieColors={pieColors}
          />
        )}
      </div>

      
      <div style={{
        position: "absolute",
        bottom: 0, left: "20%", right: "20%", height: 1, zIndex: 1, pointerEvents: "none",
        background: `linear-gradient(to right, transparent, ${glowHex}55, transparent)`,
      }} />
    </div>
  );
};

export default CustomChart;