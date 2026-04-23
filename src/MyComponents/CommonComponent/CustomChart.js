import React, { useRef, useEffect, useState, useCallback } from "react";
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
} from "recharts";

/* ─────────────────────────────────────────
   CUSTOM TOOLTIP
───────────────────────────────────────── */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const val = payload[0].value;
  const formatted =
    typeof val === "number" && val > 999
      ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(val)
      : val;
  return (
    <div style={{
      background: "rgba(5,6,12,0.97)",
      border: "1px solid rgba(59,130,246,0.3)",
      borderRadius: 10,
      padding: "10px 14px",
      boxShadow: "0 16px 40px rgba(0,0,0,0.9)",
      backdropFilter: "blur(20px)",
      fontFamily: "'JetBrains Mono', monospace",
      zIndex: 9999,
    }}>
      <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#525667", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#e6e8f0", fontFamily: "'Oxanium', sans-serif" }}>
        {formatted}
      </div>
      <div style={{ width: "100%", height: 1, background: "linear-gradient(to right, rgba(59,130,246,0.5), transparent)", marginTop: 8 }} />
    </div>
  );
};

/* ─────────────────────────────────────────
   PIE LABELS — computed outside recharts
   Strategy: compute all label positions in JS,
   detect collisions, push them apart vertically,
   then render as SVG overlay on top of the pie.
───────────────────────────────────────── */
const RADIAN = Math.PI / 180;

/*
  Compute label layout for N slices.
  Returns array of {x, y, anchor, name, pct, value, lineStart, lineEnd}
  where lineStart is the spoke origin on the pie edge and lineEnd is the elbow.
*/
function computePieLabels(data, yKey, xKey, cx, cy, outerRadius, pieColors) {
  if (!data || data.length === 0) return [];

  const total = data.reduce((s, d) => s + (Number(d[yKey]) || 0), 0);
  if (total === 0) return [];

  // Build angle info for each slice
  let startAngle = 0; // degrees, 0 = right, going clockwise
  const slices = data.map((d, i) => {
    const value = Number(d[yKey]) || 0;
    const pct = value / total;
    const sweep = pct * 360;
    const mid = startAngle + sweep / 2;
    startAngle += sweep;
    return { name: d[xKey], value, pct, mid, color: pieColors[i % pieColors.length] };
  });

  // Spoke end radius (just outside pie)
  const spokeR = outerRadius + 12;
  // Elbow radius (where line bends toward text)
  const elbowR = outerRadius + 28;
  // Text starts at this offset from elbow
  const textOffsetX = 8;
  // Line anchor is on elbow
  const MIN_LABEL_GAP = 18; // px vertical minimum between label centres

  // Compute raw positions
  const labels = slices.map((s) => {
    const rad = -s.mid * RADIAN; // recharts uses clockwise from top
    const sx = cx + spokeR * Math.cos(rad);
    const sy = cy + spokeR * Math.sin(rad);
    const ex = cx + elbowR * Math.cos(rad);
    const ey = cy + elbowR * Math.sin(rad);
    const isRight = ex >= cx;
    const textX = ex + (isRight ? textOffsetX : -textOffsetX);
    return { ...s, sx, sy, ex, ey, isRight, textX, rawY: ey };
  });

  // Separate into left and right groups
  const right = labels.filter(l => l.isRight).sort((a, b) => a.rawY - b.rawY);
  const left  = labels.filter(l => !l.isRight).sort((a, b) => a.rawY - b.rawY);

  // Push apart vertically within each group to avoid overlap
  const spread = (group) => {
    for (let pass = 0; pass < 5; pass++) {
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

  spread(right);
  spread(left);

  return [...right, ...left];
}

/* Custom pie label renderer using SVG overlay */
const PieLabelsOverlay = ({ data, yKey, xKey, cx, cy, outerRadius, pieColors, width, height }) => {
  if (!cx || !cy || !outerRadius) return null;

  const labels = computePieLabels(data, yKey, xKey, cx, cy, outerRadius, pieColors);

  return (
    <g>
      {labels.map((l, i) => {
        const shortName = l.name && l.name.length > 14 ? l.name.slice(0, 13) + "…" : (l.name || "");
        const pctStr = `${(l.pct * 100).toFixed(1)}%`;
        // Value formatted
        const valStr = l.value > 999999
          ? `₹${(l.value / 1000000).toFixed(1)}M`
          : l.value > 999
          ? `₹${(l.value / 1000).toFixed(1)}k`
          : String(l.value);

        return (
          <g key={i}>
            {/* Spoke from pie edge to elbow */}
            <line
              x1={l.sx} y1={l.sy}
              x2={l.ex} y2={l.rawY}
              stroke={l.color}
              strokeWidth={1}
              strokeOpacity={0.5}
            />
            {/* Horizontal tick from elbow to text */}
            <line
              x1={l.ex} y1={l.rawY}
              x2={l.textX} y2={l.rawY}
              stroke={l.color}
              strokeWidth={1}
              strokeOpacity={0.5}
            />
            {/* Dot at elbow */}
            <circle cx={l.ex} cy={l.rawY} r={2} fill={l.color} fillOpacity={0.8} />

            {/* Name */}
            <text
              x={l.textX + (l.isRight ? 2 : -2)}
              y={l.rawY - 6}
              textAnchor={l.isRight ? "start" : "end"}
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9,
                fill: "rgba(210,215,230,0.95)",
                fontWeight: 600,
                letterSpacing: "0.03em",
              }}
            >
              {shortName}
            </text>

            {/* Value + pct */}
            <text
              x={l.textX + (l.isRight ? 2 : -2)}
              y={l.rawY + 7}
              textAnchor={l.isRight ? "start" : "end"}
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 8,
                fill: l.color,
                letterSpacing: "0.02em",
              }}
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
   ANIMATED BAR
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
   BAR CHART — scrollable when many items
───────────────────────────────────────── */
const BarChartInner = ({ data, xKey, yKey, barColor, formatYAxis, yAxisMax, gradId }) => {
  const count = data.length;

  // How many px per bar slot — ensures bars are never squished
  const PX_PER_BAR = Math.max(24, Math.min(56, 700 / Math.max(count, 1)));
  const LEFT_W = 50;
  const RIGHT_P = 16;
  const computedW = count * PX_PER_BAR + LEFT_W + RIGHT_P;
  // Scroll when content is wider than container
  const needsScroll = computedW > 700;

  // X tick interval — show at most 15 ticks
  const tickInterval = Math.max(0, Math.ceil(count / 15) - 1);

  const formatX = (v) => {
    if (!v) return "";
    const s = String(v);
    // Shorten date strings: "3/28/2026" → "3/28"
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) return s.slice(0, s.lastIndexOf("/"));
    // Shorten month names: "January" → "Jan"
    if (s.length > 6) return s.slice(0, 6) + "…";
    return s;
  };

  const chartEl = (
    <BarChart
      data={data}
      margin={{ top: 24, right: RIGHT_P, bottom: 64, left: 0 }}
      barCategoryGap={count > 30 ? "20%" : "35%"}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={barColor} stopOpacity={1} />
          <stop offset="100%" stopColor={barColor} stopOpacity={0.3} />
        </linearGradient>
      </defs>

      <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />

      <XAxis
        dataKey={xKey}
        tickFormatter={formatX}
        interval={tickInterval}
        angle={-45}
        textAnchor="end"
        height={64}
        axisLine={false}
        tickLine={false}
        tick={{ fill: "#5a5f78", fontSize: count > 25 ? 9 : 10, fontFamily: "'JetBrains Mono', monospace" }}
        padding={{ left: 12, right: 12 }}
      />

      <YAxis
        domain={[0, yAxisMax]}
        tickFormatter={formatYAxis}
        axisLine={false}
        tickLine={false}
        tick={{ fill: "#383a4d", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
        width={LEFT_W}
      />

      <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />

      <Bar
        dataKey={yKey}
        fill={`url(#${gradId})`}
        radius={[5, 5, 0, 0]}
        shape={<AnimatedBar fill={`url(#${gradId})`} />}
        maxBarSize={count > 40 ? 12 : count > 20 ? 20 : 38}
      >
        {count <= 25 && (
          <LabelList
            dataKey={yKey}
            position="top"
            formatter={(v) =>
              v >= 1_000_000 ? `₹${(v / 1_000_000).toFixed(1)}M`
              : v >= 1000 ? `₹${(v / 1000).toFixed(1)}k`
              : String(v)
            }
            style={{
              fill: `${barColor}dd`,
              fontSize: 8,
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
            }}
          />
        )}
      </Bar>
    </BarChart>
  );

  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          overflowX: needsScroll ? "auto" : "hidden",
          overflowY: "hidden",
          paddingBottom: 2,
          // Custom scrollbar
          scrollbarWidth: "thin",
          scrollbarColor: `${barColor}44 rgba(255,255,255,0.04)`,
        }}
      >
        <div style={{ width: needsScroll ? computedW : "100%", height: 280 }}>
          {needsScroll ? (
            <BarChart
              width={computedW}
              height={280}
              data={data}
              margin={{ top: 24, right: RIGHT_P, bottom: 64, left: 0 }}
              barCategoryGap={count > 30 ? "20%" : "35%"}
            >
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={barColor} stopOpacity={1} />
                  <stop offset="100%" stopColor={barColor} stopOpacity={0.3} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
              <XAxis
                dataKey={xKey}
                tickFormatter={formatX}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={64}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#5a5f78", fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }}
                padding={{ left: 12, right: 12 }}
              />
              <YAxis
                domain={[0, yAxisMax]}
                tickFormatter={formatYAxis}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#383a4d", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
                width={LEFT_W}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar
                dataKey={yKey}
                fill={`url(#${gradId})`}
                radius={[5, 5, 0, 0]}
                shape={<AnimatedBar fill={`url(#${gradId})`} />}
                maxBarSize={count > 40 ? 14 : count > 20 ? 22 : 38}
              />
            </BarChart>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {chartEl}
            </ResponsiveContainer>
          )}
        </div>
      </div>
      {needsScroll && (
        <div style={{
          textAlign: "center",
          fontSize: 9,
          color: `${barColor}88`,
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: "0.1em",
          paddingTop: 6,
          paddingBottom: 4,
        }}>
          ← SCROLL TO SEE ALL {count} ITEMS →
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────
   PIE CHART — label collision resolved
   Uses custom SVG overlay for labels so we
   can fully control collision avoidance.
───────────────────────────────────────── */
const PieChartInner = ({ data, xKey, yKey, pieColors }) => {
  const [dims, setDims] = useState({ cx: 0, cy: 0, outerRadius: 0, width: 0, height: 0 });
  const containerRef = useRef(null);
  const count = data.length;

  // Measure container so we can compute absolute label positions
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      // Leave margins for labels
      const margin = { left: 90, right: 90, top: 30, bottom: 30 };
      const pieW = width - margin.left - margin.right;
      const pieH = height - margin.top - margin.bottom;
      const maxR = Math.min(pieW, pieH) / 2;
      // Scale outerRadius: smaller pie when more slices (more label space needed)
      const scaleF = count > 15 ? 0.52 : count > 8 ? 0.62 : 0.70;
      const outerRadius = Math.max(50, maxR * scaleF);
      setDims({
        cx: width / 2,
        cy: height / 2,
        outerRadius,
        width,
        height,
      });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [count]);

  // Height scales with item count to give label room
  const containerH = Math.max(340, 280 + count * 12);

  return (
    <div ref={containerRef} style={{ width: "100%", height: containerH, position: "relative" }}>
      {/* Recharts pie — no built-in labels */}
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

      {/* Custom SVG labels overlay — drawn on top with collision avoidance */}
      {dims.outerRadius > 0 && (
        <svg
          style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}
          width={dims.width}
          height={dims.height}
        >
          <PieLabelsOverlay
            data={data}
            yKey={yKey}
            xKey={xKey}
            cx={dims.cx}
            cy={dims.cy}
            outerRadius={dims.outerRadius}
            pieColors={pieColors}
            width={dims.width}
            height={dims.height}
          />
        </svg>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────
   LINE / AREA CHART
───────────────────────────────────────── */
const LineChartInner = ({ data, xKey, yKey, barColor, formatYAxis, yAxisMax, gradId }) => {
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
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 20, right: 16, bottom: 56, left: 0 }}>
        <defs>
  {Array.isArray(yKey) ? (
    yKey.map((_, i) => (
      <linearGradient key={i} id={`${gradId}-${i}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor={["#3b82f6", "#10b981"][i % 2]} stopOpacity={0.25} />
        <stop offset="95%" stopColor={["#3b82f6", "#10b981"][i % 2]} stopOpacity={0} />
      </linearGradient>
    ))
  ) : (
    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor={barColor} stopOpacity={0.25} />
      <stop offset="95%" stopColor={barColor} stopOpacity={0} />
    </linearGradient>
  )}
</defs>

        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />

        <XAxis
          dataKey={xKey}
          tickFormatter={formatX}
          interval={tickInterval}
          angle={-38}
          textAnchor="end"
          height={56}
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#5a5f78", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
          padding={{ left: 12, right: 12 }}
        />

        <YAxis
          domain={[0, yAxisMax]}
          tickFormatter={formatYAxis}
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#383a4d", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
          width={50}
        />

        <Tooltip content={<CustomTooltip />} cursor={{ stroke: `${barColor}55`, strokeWidth: 1 }} />

        {Array.isArray(yKey) ? (
  yKey.map((key, i) => (
    <Area
      key={key}
      type="monotone"
      dataKey={key}
      stroke={["#3b82f6", "#10b981"][i % 2]}   // sales = blue, purchase = green
      strokeWidth={2.5}
      fill={`url(#${gradId}-${i})`}
      dot={data.length <= 50 ? { r: 3.5 } : false}
      activeDot={{ r: 6 }}
      isAnimationActive={true}
    />
  ))
) : (
  <Area
    type="monotone"
    dataKey={yKey}
    stroke={barColor}
    strokeWidth={2.5}
    fill={`url(#${gradId})`}
  />
)}
      </AreaChart>
    </ResponsiveContainer>
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
  pieColors = [
    "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6",
    "#f43f5e", "#06b6d4", "#ec4899", "#84cc16",
    "#fb923c", "#a78bfa", "#34d399", "#f472b6",
    "#facc15", "#38bdf8", "#4ade80", "#e879f9",
    "#818cf8", "#fb7185", "#fbbf24", "#2dd4bf",
  ],
}) => {
  if (!data || data.length === 0) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: 260, background: "rgba(4,5,10,0.85)", borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.045)",
        fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
        color: "rgba(80,90,110,0.8)", letterSpacing: "0.1em",
      }}>
        NO DATA
      </div>
    );
  }

const maxValue = Array.isArray(yKey)
  ? Math.max(...data.flatMap(d => yKey.map(k => Number(d[k]) || 0)))
  : Math.max(...data.map(d => Number(d[yKey]) || 0));
  const yAxisMax = Math.ceil(maxValue * 1.28);
  const glowHex = barColor.startsWith("#") ? barColor : "#3b82f6";
  const gradId  = `bG-${barColor.replace(/[^a-z0-9]/gi, "")}`;

  const formatYAxis = (v) =>
    v >= 1_000_000 ? `₹${(v / 1_000_000).toFixed(1)}M`
    : v >= 1000    ? `₹${(v / 1000).toFixed(0)}k`
    : String(v);

  // Heights: pie needs extra room for labels; bar/line fixed
  const bodyH = chartType === "pie" ? "auto" : 300;

  return (
    <div style={{
      position: "relative",
      width: "100%",
      background: "rgba(4,5,10,0.85)",
      borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.05)",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
    }}>

      <ChartCanvas3D color={glowHex} />

      {/* Top shimmer line */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 1, zIndex: 1, pointerEvents: "none",
        background: `linear-gradient(to right, transparent, ${glowHex}66 40%, ${glowHex}aa 50%, ${glowHex}66 60%, transparent)`,
      }} />

      {/* Title */}
      {chartTitle && (
        <div style={{
          position: "relative", zIndex: 2,
          padding: "14px 18px 4px",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <div style={{
            width: 3, height: 14,
            background: barColor, borderRadius: 2,
            boxShadow: `0 0 8px ${barColor}`,
          }} />
          <span style={{
            fontFamily: "'Oxanium', sans-serif",
            fontSize: 13, fontWeight: 600,
            letterSpacing: "-0.01em", color: "#bcc0d0",
          }}>
            {chartTitle}
          </span>
        </div>
      )}

      {/* Chart body */}
      <div style={{
        position: "relative", zIndex: 2,
        height: chartType !== "pie" ? bodyH : undefined,
        padding: chartType === "pie" ? "8px 4px 12px" : "8px 8px 4px",
        overflow: chartType === "pie" ? "visible" : "hidden",
      }}>
        {chartType === "bar" && (
          <BarChartInner
            data={data} xKey={xKey} yKey={yKey}
            barColor={barColor} formatYAxis={formatYAxis}
            yAxisMax={yAxisMax} gradId={gradId}
          />
        )}
        {chartType === "line" && (
          <div style={{ height: "100%" }}>
            <LineChartInner
              data={data} xKey={xKey} yKey={yKey}
              barColor={barColor} formatYAxis={formatYAxis}
              yAxisMax={yAxisMax} gradId={`lG-${barColor.replace(/[^a-z0-9]/gi, "")}`}
            />
          </div>
        )}
        {chartType === "pie" && (
          <PieChartInner
            data={data} xKey={xKey} yKey={yKey}
            pieColors={pieColors}
          />
        )}
      </div>

      {/* Bottom glow */}
      <div style={{
        position: "absolute",
        bottom: 0, left: "20%", right: "20%", height: 1, zIndex: 1, pointerEvents: "none",
        background: `linear-gradient(to right, transparent, ${glowHex}55, transparent)`,
      }} />
    </div>
  );
};

export default CustomChart;
