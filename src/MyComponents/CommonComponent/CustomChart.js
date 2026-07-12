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
  Sector,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

/* ─────────────────────────────────────────
   SHARED VALUE FORMATTERS
───────────────────────────────────────── */
const formatCompact = (v) => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1_000_000) return `₹${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return String(n);
};

const formatCurrencyFull = (v) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v || 0);

const truncate = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + "…" : s || "");

/* ─────────────────────────────────────────
   MULTI-SERIES CUSTOM TOOLTIP (bar / line)
───────────────────────────────────────── */
const CustomTooltip = ({ active, payload, label, lineLabels }) => {
  if (!active || !payload || !payload.length) return null;
  const t = getChartTheme();
  const accent = payload[0]?.color || payload[0]?.fill || "#3b82f6";

  const fmt = (val) => (typeof val === "number" && val > 999 ? formatCurrencyFull(val) : val);

  return (
    <div
      style={{
        position: "relative",
        background: t.tooltipBg,
        border: t.tooltipBorder,
        borderRadius: 13,
        padding: "12px 16px 12px 14px",
        boxShadow: "0 22px 55px rgba(15, 23, 42, 0.18)",
        backdropFilter: "blur(26px)",
        WebkitBackdropFilter: "blur(26px)",
        fontFamily: "'JetBrains Mono', monospace",
        zIndex: 9999,
        minWidth: 170,
        overflow: "hidden",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: 3,
          background: accent,
          boxShadow: `0 0 8px ${accent}`,
        }}
      />
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: t.tooltipLabel,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      {payload.map((p, i) => (
        <div
          key={i}
          style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: i < payload.length - 1 ? 6 : 0 }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: p.color || p.fill,
              flexShrink: 0,
              boxShadow: `0 0 6px ${p.color || p.fill}`,
            }}
          />
          <span style={{ fontSize: 10, color: t.tooltipMuted, flex: 1 }}>
            {lineLabels?.[i] || p.name || p.dataKey}
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, color: t.tooltipValue, fontFamily: "'Oxanium', sans-serif" }}>
            {fmt(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

/* ─────────────────────────────────────────
   PIE LABELS  —  collision-aware leader lines
   (NOTE: no floating Tooltip is used on the pie anymore —
   hover detail now lives in the donut's center label, so it
   can never collide with these leader-line labels.)
───────────────────────────────────────── */
const RADIAN = Math.PI / 180;
const PIE_COMPACT_THRESHOLD = 0.035;

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
    return { name: d[xKey], value, pct, mid, color: pieColors[i % pieColors.length], index: i };
  });

  const visible = slices
    .filter((s) => s.value > 0)
    .map((s) => ({ ...s, compact: s.pct < PIE_COMPACT_THRESHOLD }));

  const spokeR = outerRadius + 14;
  const elbowR = outerRadius + 30;
  const textOffsetX = 8;

  const positioned = visible.map((s) => {
    const rad = -s.mid * RADIAN;
    const sx = cx + spokeR * Math.cos(rad);
    const sy = cy + spokeR * Math.sin(rad);
    const ex = cx + elbowR * Math.cos(rad);
    const ey = cy + elbowR * Math.sin(rad);
    const isRight = ex >= cx;
    const textX = ex + (isRight ? textOffsetX : -textOffsetX);
    return { ...s, sx, sy, ex, ey, isRight, textX, rawY: ey };
  });

  const rowHeight = (s) => (s.compact ? 13 : 19);

  const spread = (group) => {
    group.sort((a, b) => a.rawY - b.rawY);
    for (let pass = 0; pass < 12; pass++) {
      for (let i = 1; i < group.length; i++) {
        const prev = group[i - 1];
        const curr = group[i];
        const minGap = (rowHeight(prev) + rowHeight(curr)) / 2 + 3;
        const gap = curr.rawY - prev.rawY;
        if (gap < minGap) {
          const push = (minGap - gap) / 2;
          prev.rawY -= push;
          curr.rawY += push;
        }
      }
    }
  };

  const right = positioned.filter((l) => l.isRight);
  const left = positioned.filter((l) => !l.isRight);
  spread(right);
  spread(left);

  return [...right, ...left];
}

const PieLabelsOverlay = ({ data, yKey, xKey, cx, cy, outerRadius, pieColors, activeIndex, onHover, onLeave }) => {
  if (!cx || !cy || !outerRadius) return null;
  const ct = getChartTheme();
  const labels = computePieLabels(data, yKey, xKey, cx, cy, outerRadius, pieColors);

  const primaryFill = ct.tickFill || "rgba(210,215,230,0.95)";

  return (
    <g>
      {labels.map((l, i) => {
        const isActive = activeIndex === l.index;
        const dim = activeIndex !== null && !isActive;
        const shortName = truncate(l.name, 17);
        const pctStr = `${(l.pct * 100).toFixed(1)}%`;
        const valStr = formatCompact(l.value);

        return (
          <g
            key={i}
            style={{ cursor: "pointer", opacity: dim ? 0.35 : 1, transition: "opacity .18s" }}
            onMouseEnter={() => onHover && onHover(l.index)}
            onMouseLeave={() => onLeave && onLeave()}
          >
            <line
              x1={l.sx}
              y1={l.sy}
              x2={l.ex}
              y2={l.rawY}
              stroke={l.color}
              strokeWidth={isActive ? 1.6 : 1}
              strokeOpacity={isActive ? 0.9 : 0.55}
            />
            <line
              x1={l.ex}
              y1={l.rawY}
              x2={l.textX}
              y2={l.rawY}
              stroke={l.color}
              strokeWidth={isActive ? 1.6 : 1}
              strokeOpacity={isActive ? 0.9 : 0.55}
            />
            <circle cx={l.ex} cy={l.rawY} r={isActive ? 2.6 : 2} fill={l.color} fillOpacity={0.95} />

            {/* generous invisible hit-area so hover is easy to trigger */}
            <rect
              x={l.isRight ? l.textX - 4 : l.textX - 90}
              y={l.rawY - 10}
              width={94}
              height={20}
              fill="transparent"
            />

            {l.compact ? (
              <text
                x={l.textX + (l.isRight ? 2 : -2)}
                y={l.rawY + 3}
                textAnchor={l.isRight ? "start" : "end"}
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 8.5,
                  fill: l.color,
                  fontWeight: 700,
                  letterSpacing: "0.02em",
                }}
              >
                {`${shortName} · ${pctStr}`}
              </text>
            ) : (
              <>
                <text
                  x={l.textX + (l.isRight ? 2 : -2)}
                  y={l.rawY - 6}
                  textAnchor={l.isRight ? "start" : "end"}
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 9,
                    fill: primaryFill,
                    fontWeight: 600,
                    letterSpacing: "0.03em",
                  }}
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
              </>
            )}
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
        p.x += p.vx;
        p.y += p.vy;
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
          const dx = pts[i].x - pts[j].x,
            dy = pts[i].y - pts[j].y;
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
    <canvas
      ref={ref}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", borderRadius: 14, opacity: 0.5 }}
    />
  );
};

/* ─────────────────────────────────────────
   MULTI-SERIES LEGEND — pill-chip style
   (background chip instead of bare dot+text so contrast
   holds up on both light and dark surfaces)
───────────────────────────────────────── */
const SeriesLegend = ({ keys, colors, labels }) => {
  const ct = getChartTheme();
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        padding: "8px 14px 10px",
        borderBottom: `1px solid ${ct.legendBorder || "rgba(255,255,255,0.08)"}`,
      }}
    >
      {keys.map((k, i) => {
        const c = colors[i % colors.length];
        return (
          <div
            key={k}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "3px 10px 3px 7px",
              borderRadius: 100,
              background: `${c}1a`,
              border: `1px solid ${c}40`,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: c,
                boxShadow: `0 0 6px ${c}`,
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9.5,
                fontWeight: 600,
                color: c,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              {labels?.[i] || k}
            </span>
          </div>
        );
      })}
    </div>
  );
};

/* ─────────────────────────────────────────
   BAR LABEL — collision-aware + always-readable
   Two problems fixed here:
   1) Text used to be filled with the bar's own color, so a
      pastel/light bar (or a color close to the card background)
      made the number unreadable. Labels now render on a small
      pill chip using the theme's text/surface tokens, so they
      stay legible no matter what color the bar is or which
      theme (light/dark) is active. The bar's color survives as
      a small dot, so you can still tell which series a label
      belongs to at a glance.
   2) When a bar's value sits close to its neighbor's (so both
      labels would land at nearly the same height) every other
      one of that pair is bumped to a second tier with a short
      connector tick, so close values read as two clean rows
      instead of overlapping text.
───────────────────────────────────────── */
const makeBarLabelRenderer = ({ data, yKey, color, maxValue, count, ct }) => (props) => {
  const { x, y, width, value, index } = props;
  if (value === undefined || value === null || value === 0) return null;

  const threshold = (maxValue || 1) * 0.08; // values within ~8% of range count as "close"
  const prevVal = index > 0 ? Number(data[index - 1]?.[yKey]) || 0 : null;
  const nextVal = index < count - 1 ? Number(data[index + 1]?.[yKey]) || 0 : null;

  const closeToPrev = prevVal !== null && Math.abs(value - prevVal) <= threshold;
  const closeToNext = nextVal !== null && Math.abs(value - nextVal) <= threshold;
  const isCluster = closeToPrev || closeToNext;
  const stagger = isCluster && index % 2 === 1;

  const dy = stagger ? 17 : 0;
  const text = formatCompact(value);
  const fontSize = count > 16 ? 8 : 8.5;
  const textColor = ct.tooltipValue || "#e4e6f0";
  const chipBg = ct.tooltipBg || "rgba(20,22,32,0.92)";
  const chipBorderColor = "rgba(128,134,156,0.38)";

  const chipW = Math.max(34, text.length * (fontSize * 0.62) + 18);
  const chipH = 15;
  const cx = x + width / 2;
  const cy = y - 11 - dy;

  return (
    <g>
      {stagger && (
        <line x1={cx} y1={y - 4} x2={cx} y2={cy + chipH / 2} stroke={color} strokeOpacity={0.5} strokeWidth={1} />
      )}
      <rect
        x={cx - chipW / 2}
        y={cy - chipH / 2}
        width={chipW}
        height={chipH}
        rx={7.5}
        fill={chipBg}
        stroke={chipBorderColor}
        strokeWidth={1}
      />
      <circle cx={cx - chipW / 2 + 9} cy={cy} r={2.6} fill={color} />
      <text
        x={cx + 4}
        y={cy + 3}
        textAnchor="middle"
        style={{ fontFamily: "'JetBrains Mono', monospace", fontSize, fontWeight: 700, fill: textColor }}
      >
        {text}
      </text>
    </g>
  );
};

/* ─────────────────────────────────────────
   BAR CHART — single + multi-series
───────────────────────────────────────── */
const BarChartInner = ({ data, xKey, yKey, barColor, lineColors, lineLabels, formatYAxis, yAxisMax, gradId }) => {
  const ct = getChartTheme();
  const isMulti = Array.isArray(yKey);
  const keys = isMulti ? yKey : [yKey];
  const colors = isMulti ? lineColors || ["#3b82f6", "#10b981"] : [barColor];
  const count = data.length;

  const PX_PER_BAR = Math.max(isMulti ? 40 : 24, Math.min(56, 700 / Math.max(count, 1)));
  const LEFT_W = 50;
  const RIGHT_P = 16;
  const computedW = count * PX_PER_BAR + LEFT_W + RIGHT_P;
  const needsScroll = computedW > 700;
  const tickInterval = Math.max(0, Math.ceil(count / 15) - 1);

  const maxValue = isMulti
    ? Math.max(...data.flatMap((d) => keys.map((k) => Number(d[k]) || 0)))
    : Math.max(...data.map((d) => Number(d[yKey]) || 0));

  const formatX = (v) => {
    if (!v) return "";
    const s = String(v);
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) return s.slice(0, s.lastIndexOf("/"));
    if (s.length > 6) return s.slice(0, 6) + "…";
    return s;
  };

  const sharedProps = {
    data,
    margin: { top: 30, right: RIGHT_P, bottom: 64, left: 0 },
    barCategoryGap: isMulti ? "28%" : count > 30 ? "22%" : "38%",
    barGap: 4,
  };

  const innerContent = (
    <>
      <defs>
        {keys.map((k, i) => (
          <React.Fragment key={k}>
            <linearGradient id={`${gradId}-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors[i]} stopOpacity={1} />
              <stop offset="55%" stopColor={colors[i]} stopOpacity={0.62} />
              <stop offset="100%" stopColor={colors[i]} stopOpacity={0.22} />
            </linearGradient>
            <linearGradient id={`${gradId}-active-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors[i]} stopOpacity={1} />
              <stop offset="100%" stopColor={colors[i]} stopOpacity={0.55} />
            </linearGradient>
          </React.Fragment>
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
          radius={[6, 6, 1, 1]}
          maxBarSize={isMulti ? (count > 20 ? 14 : 24) : count > 40 ? 12 : count > 20 ? 20 : 38}
          activeBar={{
            fill: `url(#${gradId}-active-${i})`,
            stroke: colors[i],
            strokeWidth: 1.5,
            filter: `drop-shadow(0 0 8px ${colors[i]}aa)`,
          }}
          animationDuration={550}
          animationEasing="ease-out"
          label={
            !isMulti && count <= 25
              ? makeBarLabelRenderer({ data, yKey: k, color: colors[i], maxValue, count, ct })
              : undefined
          }
        />
      ))}
    </>
  );

  return (
    <div style={{ width: "100%" }}>
      {isMulti && <SeriesLegend keys={keys} colors={colors} labels={lineLabels} />}
      <div
        style={{
          overflowX: needsScroll ? "auto" : "hidden",
          overflowY: "hidden",
          paddingBottom: 2,
          scrollbarWidth: "thin",
          scrollbarColor: `${colors[0]}44 rgba(255,255,255,0.04)`,
        }}
      >
        <div style={{ width: needsScroll ? computedW : "100%", height: 280 }}>
          {needsScroll ? (
            <BarChart width={computedW} height={280} {...sharedProps}>
              {innerContent}
            </BarChart>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart {...sharedProps}>{innerContent}</BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      {needsScroll && (
        <div
          style={{
            textAlign: "center",
            fontSize: 9,
            color: `${colors[0]}88`,
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: "0.1em",
            paddingTop: 6,
            paddingBottom: 4,
          }}
        >
          ← SCROLL TO SEE ALL {count} ITEMS →
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────
   PIE CHART — donut with center detail label
   (replaces the old cursor-tooltip; the center of the donut
   is dead space the leader-line labels never reach, so hover
   info can never collide with them again)
───────────────────────────────────────── */
const PieActiveShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 7}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{ filter: "drop-shadow(0 0 10px rgba(0,0,0,0.25))" }}
      />
    </g>
  );
};

const PieCenterLabel = ({ cx, cy, ct, active, totalLabel, totalValue, innerRadius }) => {
  if (!cx || !cy) return null;
  const ringR = innerRadius ? innerRadius * 0.88 : 38;
  const bgR = innerRadius ? innerRadius * 0.97 : 42;
  // Always a solid, theme-correct disc behind the text — this is what was
  // missing before. Without it, the donut's colored slice (or its glow)
  // showed straight through the "transparent" center, so a pink slice +
  // pink-ish label text effectively disappeared into itself. Now there's
  // always a neutral surface behind the number, and the number itself is
  // always rendered in a fixed high-contrast color, never the slice color.
  const discFill = ct.shellBg || ct.tooltipBg || "rgba(8,9,16,0.96)";
  const valueColor = ct.tooltipValue || "#101828";

  return (
    <g style={{ pointerEvents: "none" }}>
      <circle cx={cx} cy={cy} r={bgR} fill={discFill} />
      <circle
        cx={cx}
        cy={cy}
        r={ringR}
        fill="transparent"
        stroke={active ? active.color : "rgba(128,134,156,0.35)"}
        strokeOpacity={active ? 0.45 : 0.5}
        strokeWidth={1}
        strokeDasharray="2 4"
      />
      <text
        x={cx}
        y={cy + (active ? -10 : -6)}
        textAnchor="middle"
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: active ? 9 : 8.5,
          fontWeight: 600,
          fill: active ? active.color : ct.tooltipMuted || "#8a90aa",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {active ? truncate(active.name, 15) : totalLabel}
      </text>
      <text
        x={cx}
        y={cy + (active ? 12 : 16)}
        textAnchor="middle"
        style={{
          fontFamily: "'Oxanium', sans-serif",
          fontSize: active ? 15 : 17,
          fontWeight: 700,
          fill: valueColor,
        }}
      >
        {active ? formatCompact(active.value) : formatCompact(totalValue)}
      </text>
      {active && (
        <text
          x={cx}
          y={cy + 28}
          textAnchor="middle"
          style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, fontWeight: 600, fill: active.color }}
        >
          {(active.pct * 100).toFixed(1)}%
        </text>
      )}
    </g>
  );
};

const PieChartInner = ({ data, xKey, yKey, pieColors }) => {
  const ct = getChartTheme();
  const [dims, setDims] = useState({ cx: 0, cy: 0, outerRadius: 0, width: 0, height: 0 });
  const [activeIndex, setActiveIndex] = useState(null);
  const containerRef = useRef(null);
  const count = data.length;

  const total = data.reduce((s, d) => s + (Number(d[yKey]) || 0), 0);
  const activeItem =
    activeIndex !== null && data[activeIndex]
      ? {
          name: data[activeIndex][xKey],
          value: Number(data[activeIndex][yKey]) || 0,
          pct: (Number(data[activeIndex][yKey]) || 0) / (total || 1),
          color: pieColors[activeIndex % pieColors.length],
        }
      : null;

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      const margin = { left: 100, right: 100, top: 30, bottom: 30 };
      const pieW = width - margin.left - margin.right;
      const pieH = height - margin.top - margin.bottom;
      const maxR = Math.min(pieW, pieH) / 2;
      const scaleF = count > 15 ? 0.5 : count > 8 ? 0.6 : 0.68;
      const outerRadius = Math.max(50, maxR * scaleF);
      setDims({ cx: width / 2, cy: height / 2, outerRadius, width, height });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [count]);

  const containerH = Math.max(360, 300 + count * 14);

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
            {/* No <Tooltip> here on purpose — detail now renders in the
                donut's center label so it never overlaps the leader-line
                labels drawn outside the pie's radius. */}
            <Pie
              data={data}
              dataKey={yKey}
              nameKey={xKey}
              cx={dims.cx || "50%"}
              cy={dims.cy || "50%"}
              outerRadius={dims.outerRadius || "42%"}
              innerRadius={dims.outerRadius ? dims.outerRadius * 0.4 : "18%"}
              paddingAngle={count > 15 ? 1 : count > 8 ? 2 : 3}
              labelLine={false}
              label={false}
              strokeWidth={0}
              isAnimationActive={true}
              activeIndex={activeIndex === null ? undefined : activeIndex}
              activeShape={PieActiveShape}
              onMouseEnter={(_, idx) => setActiveIndex(idx)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill={`url(#pieG-${i % pieColors.length})`}
                  stroke="rgba(0,0,0,0.5)"
                  strokeWidth={1.5}
                  style={{ opacity: activeIndex !== null && activeIndex !== i ? 0.45 : 1, transition: "opacity .18s" }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      {dims.outerRadius > 0 && (
        <svg style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }} width={dims.width} height={dims.height}>
          <g style={{ pointerEvents: "auto" }}>
            <PieLabelsOverlay
              data={data}
              yKey={yKey}
              xKey={xKey}
              cx={dims.cx}
              cy={dims.cy}
              outerRadius={dims.outerRadius}
              pieColors={pieColors}
              activeIndex={activeIndex}
              onHover={setActiveIndex}
              onLeave={() => setActiveIndex(null)}
            />
          </g>
          <PieCenterLabel cx={dims.cx} cy={dims.cy} ct={ct} active={activeItem} totalLabel="TOTAL" totalValue={total} innerRadius={dims.outerRadius * 0.4} />
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
      {isMulti && <SeriesLegend keys={keys} colors={colors} labels={lineLabels} />}
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
    "#8811e9", "#10b981", "#f59e0b", "#CD7F32",
    "#84cc16", "#06b6d4", "#3b82f6", "#f43f5e",
    "#fb923c", "#a78bfa", "#34d399", "#f472b6",
    "#facc15", "#38bdf8", "#4ade80", "#e879f9",
    "#818cf8", "#fb7185", "#fbbf24", "#2dd4bf",
  ],
}) => {
  useCanvasThemeKey();
  const ct = getChartTheme();

  if (!data || data.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 260,
          background: ct.shellBg,
          borderRadius: 14,
          border: ct.shellBorder,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          color: ct.emptyColor,
          letterSpacing: "0.1em",
        }}
      >
        NO DATA
      </div>
    );
  }

  const isMulti = Array.isArray(yKey);
  const keys = isMulti ? yKey : [yKey];
  const MULTI_COLORS = lineColors || ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#f43f5e"];

  const maxValue = isMulti
    ? Math.max(...data.flatMap((d) => keys.map((k) => Number(d[k]) || 0)))
    : Math.max(...data.map((d) => Number(d[yKey]) || 0));
  const yAxisMax = Math.ceil(maxValue * 1.28);

  const glowHex = barColor.startsWith("#") ? barColor : "#3b82f6";
  const gradId = `bG-${barColor.replace(/[^a-z0-9]/gi, "")}`;

  const formatYAxis = (v) => (v >= 1_000_000 ? `₹${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : String(v));

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        background: ct.shellBg,
        borderRadius: 14,
        border: ct.shellBorder,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: "inset 0 1px 0 rgba(15, 23, 42, 0.04)",
      }}
    >
      <ChartCanvas3D color={glowHex} />

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          zIndex: 1,
          pointerEvents: "none",
          background: `linear-gradient(to right, transparent, ${glowHex}66 40%, ${glowHex}aa 50%, ${glowHex}66 60%, transparent)`,
        }}
      />

      {chartTitle && (
        <div style={{ position: "relative", zIndex: 2, padding: "14px 18px 4px", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 3, height: 14, background: barColor, borderRadius: 2, boxShadow: `0 0 8px ${barColor}` }} />
          <span style={{ fontFamily: "'Oxanium', sans-serif", fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em", color: ct.tooltipValue }}>
            {chartTitle}
          </span>
        </div>
      )}

      <div
        style={{
          position: "relative",
          zIndex: 2,
          padding: chartType === "pie" ? "8px 4px 12px" : "8px 8px 4px",
          overflow: chartType === "pie" ? "visible" : "hidden",
        }}
      >
        {chartType === "bar" && (
          <BarChartInner
            data={data}
            xKey={xKey}
            yKey={yKey}
            barColor={barColor}
            lineColors={MULTI_COLORS}
            lineLabels={lineLabels}
            formatYAxis={formatYAxis}
            yAxisMax={yAxisMax}
            gradId={gradId}
          />
        )}
        {chartType === "line" && (
          <LineChartInner
            data={data}
            xKey={xKey}
            yKey={yKey}
            barColor={barColor}
            lineColors={MULTI_COLORS}
            lineLabels={lineLabels}
            formatYAxis={formatYAxis}
            yAxisMax={yAxisMax}
            gradId={`lG-${barColor.replace(/[^a-z0-9]/gi, "")}`}
          />
        )}
        {chartType === "pie" && (
          <PieChartInner data={data} xKey={xKey} yKey={Array.isArray(yKey) ? yKey[0] : yKey} pieColors={pieColors} />
        )}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: "20%",
          right: "20%",
          height: 1,
          zIndex: 1,
          pointerEvents: "none",
          background: `linear-gradient(to right, transparent, ${glowHex}55, transparent)`,
        }}
      />
    </div>
  );
};

export default CustomChart;