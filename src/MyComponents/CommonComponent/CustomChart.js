import React, { useState } from "react";
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
} from "recharts";

/* ─────────────────────────────────────────
   Premium, minimal chart primitives for the dashboard.
   No particle canvases, no leader-line pie labels, no permanent
   value chips floating over bars — a calm plot area, a clean glass
   tooltip on hover, and a donut that pairs with a legend list
   instead of drawing lines across the card. The card's own chrome
   (background / border / radius) now lives entirely in Dashboard.css
   (.db-chart-card) — this component only ever renders the plot.
───────────────────────────────────────── */

const formatCompact = (v) => {
  const n = Number(v) || 0;
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}₹${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}k`;
  return String(n);
};

const formatCurrencyFull = (v) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v || 0);

const truncate = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + "…" : s || "");

/* ─────────────────────────────────────────
   TOOLTIP — small glass card, no glow theatrics
───────────────────────────────────────── */
const ChartTooltip = ({ active, payload, label, lineLabels }) => {
  if (!active || !payload || !payload.length) return null;
  const ct = getChartTheme();
  const fmt = (val) => (typeof val === "number" && Math.abs(val) > 999 ? formatCurrencyFull(val) : val);

  return (
    <div
      style={{
        background: ct.tooltipBg,
        border: ct.tooltipBorder,
        borderRadius: 12,
        padding: "10px 13px",
        boxShadow: "0 16px 40px rgba(0,0,0,0.28)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        fontFamily: "'Inter', sans-serif",
        minWidth: 150,
      }}
    >
      {label !== undefined && (
        <div style={{ fontSize: 10.5, fontWeight: 600, color: ct.tooltipLabel, marginBottom: 7 }}>{label}</div>
      )}
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: i ? 5 : 0 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: p.color || p.fill, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: ct.tooltipMuted, flex: 1 }}>{lineLabels?.[i] || p.name || p.dataKey}</span>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: ct.tooltipValue, fontFamily: "'Sora', sans-serif" }}>
            {fmt(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

/* ─────────────────────────────────────────
   MULTI-SERIES LEGEND — quiet pill chips
───────────────────────────────────────── */
const SeriesLegend = ({ keys, colors, labels }) => (
  <div style={{ display: "flex", gap: 14, flexWrap: "wrap", padding: "2px 2px 12px" }}>
    {keys.map((k, i) => {
      const c = colors[i % colors.length];
      return (
        <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 500 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: c, flexShrink: 0 }} />
          <span style={{ color: "var(--db-text-2)" }}>{labels?.[i] || k}</span>
        </span>
      );
    })}
  </div>
);

/* ─────────────────────────────────────────
   BAR CHART
───────────────────────────────────────── */
const BarChartInner = ({ data, xKey, yKey, barColor, lineColors, lineLabels, formatYAxis, yAxisMax, gradId }) => {
  const ct = getChartTheme();
  const isMulti = Array.isArray(yKey);
  const keys = isMulti ? yKey : [yKey];
  const colors = isMulti ? lineColors || ["#6366f1", "#10b981"] : [barColor];
  const count = data.length;

  const formatX = (v) => {
    if (!v) return "";
    const s = String(v);
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) return s.slice(0, s.lastIndexOf("/"));
    return s.length > 7 ? s.slice(0, 6) + "…" : s;
  };

  return (
    <>
      {isMulti && <SeriesLegend keys={keys} colors={colors} labels={lineLabels} />}
      <div style={{ height: 272 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 12, right: 8, bottom: 4, left: 0 }} barCategoryGap={isMulti ? "30%" : count > 20 ? "24%" : "42%"} barGap={4}>
            <defs>
              {keys.map((k, i) => (
                <linearGradient key={k} id={`${gradId}-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors[i]} stopOpacity={0.95} />
                  <stop offset="100%" stopColor={colors[i]} stopOpacity={0.5} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke={ct.gridStroke} strokeDasharray="0" />
            <XAxis
              dataKey={xKey}
              tickFormatter={formatX}
              interval={count > 16 ? Math.ceil(count / 12) : 0}
              axisLine={false}
              tickLine={false}
              tick={{ fill: ct.tickFill, fontSize: 10.5, fontFamily: "'Inter', sans-serif" }}
              padding={{ left: 10, right: 10 }}
              dy={4}
            />
            <YAxis
              domain={[0, yAxisMax]}
              tickFormatter={formatYAxis}
              axisLine={false}
              tickLine={false}
              tickCount={4}
              tick={{ fill: ct.tickFill, fontSize: 10.5, fontFamily: "'Inter', sans-serif" }}
              width={44}
            />
            <Tooltip content={<ChartTooltip lineLabels={lineLabels} />} cursor={{ fill: ct.gridStroke }} />
            {keys.map((k, i) => (
              <Bar
                key={k}
                dataKey={k}
                name={lineLabels?.[i] || k}
                fill={`url(#${gradId}-${i})`}
                radius={[5, 5, 2, 2]}
                maxBarSize={isMulti ? 20 : count > 30 ? 14 : 34}
                animationDuration={500}
                animationEasing="ease-out"
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
};

/* ─────────────────────────────────────────
   AREA / LINE CHART — soft gradient fill, quiet grid
───────────────────────────────────────── */
const AreaChartInner = ({ data, xKey, yKey, barColor, lineColors, lineLabels, formatYAxis, yAxisMax, gradId }) => {
  const ct = getChartTheme();
  const isMulti = Array.isArray(yKey);
  const keys = isMulti ? yKey : [yKey];
  const colors = isMulti ? lineColors || ["#6366f1", "#10b981", "#f59e0b"] : [barColor];
  const count = data.length;

  const formatX = (v) => {
    if (!v) return "";
    const s = String(v);
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) return s.slice(0, s.lastIndexOf("/"));
    return s.length > 7 ? s.slice(0, 6) + "…" : s;
  };

  return (
    <>
      {isMulti && <SeriesLegend keys={keys} colors={colors} labels={lineLabels} />}
      <div style={{ height: 272 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 12, right: 8, bottom: 4, left: 0 }}>
            <defs>
              {keys.map((k, i) => (
                <linearGradient key={k} id={`${gradId}-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="4%" stopColor={colors[i]} stopOpacity={0.32} />
                  <stop offset="100%" stopColor={colors[i]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke={ct.gridStroke} strokeDasharray="0" />
            <XAxis
              dataKey={xKey}
              tickFormatter={formatX}
              interval={Math.max(0, Math.ceil(count / 9) - 1)}
              axisLine={false}
              tickLine={false}
              tick={{ fill: ct.tickFill, fontSize: 10.5, fontFamily: "'Inter', sans-serif" }}
              padding={{ left: 10, right: 10 }}
              dy={4}
            />
            <YAxis
              domain={[0, yAxisMax]}
              tickFormatter={formatYAxis}
              axisLine={false}
              tickLine={false}
              tickCount={4}
              tick={{ fill: ct.tickFill, fontSize: 10.5, fontFamily: "'Inter', sans-serif" }}
              width={44}
            />
            <Tooltip content={<ChartTooltip lineLabels={lineLabels} />} cursor={{ stroke: ct.gridStroke, strokeWidth: 1 }} />
            {keys.map((k, i) => (
              <Area
                key={k}
                type="monotone"
                dataKey={k}
                name={lineLabels?.[i] || k}
                stroke={colors[i]}
                strokeWidth={2.25}
                fill={`url(#${gradId}-${i})`}
                dot={false}
                activeDot={{ r: 4.5, fill: colors[i], stroke: ct.tooltipBg, strokeWidth: 2 }}
                isAnimationActive={true}
                animationDuration={600}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </>
  );
};

/* ─────────────────────────────────────────
   DONUT — clean ring + side legend list (no leader lines)
───────────────────────────────────────── */
const DonutChartInner = ({ data, xKey, yKey, pieColors }) => {
  const ct = getChartTheme();
  const [activeIndex, setActiveIndex] = useState(null);
  const total = data.reduce((s, d) => s + (Number(d[yKey]) || 0), 0);

  const rows = data
    .map((d, i) => ({ name: d[xKey], value: Number(d[yKey]) || 0, color: pieColors[i % pieColors.length], index: i }))
    .filter(r => r.value > 0)
    .sort((a, b) => b.value - a.value);

  const active = activeIndex !== null ? data.find((_, i) => i === activeIndex) : null;
  const activeVal = active ? Number(active[yKey]) || 0 : total;
  const activeName = active ? active[xKey] : "Total";

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, minHeight: 272 }}>
      <div style={{ position: "relative", flex: "1 1 200px", minWidth: 180, height: 236 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey={yKey}
              nameKey={xKey}
              cx="50%"
              cy="50%"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={data.length > 1 ? 2 : 0}
              startAngle={90}
              endAngle={-270}
              strokeWidth={0}
              isAnimationActive={true}
              animationDuration={550}
              onMouseEnter={(_, idx) => setActiveIndex(idx)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill={pieColors[i % pieColors.length]}
                  style={{ opacity: activeIndex !== null && activeIndex !== i ? 0.32 : 1, transition: "opacity .18s", cursor: "pointer" }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none", textAlign: "center", padding: "0 30px" }}>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: active ? active.color || ct.tooltipMuted : ct.tooltipMuted }}>
            {truncate(String(activeName), 14)}
          </span>
          <span style={{ fontFamily: "'Sora', sans-serif", fontSize: 19, fontWeight: 700, color: ct.tooltipValue, marginTop: 3 }}>
            {formatCompact(activeVal)}
          </span>
        </div>
      </div>

      <div style={{ flex: "1 1 160px", minWidth: 150, maxHeight: 236, overflowY: "auto", padding: "2px 4px" }}>
        {rows.map(r => {
          const pct = total ? (r.value / total) * 100 : 0;
          return (
            <div
              key={r.index}
              onMouseEnter={() => setActiveIndex(r.index)}
              onMouseLeave={() => setActiveIndex(null)}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "6px 4px",
                borderRadius: 8, cursor: "pointer",
                background: activeIndex === r.index ? "var(--db-row-hover)" : "transparent",
                transition: "background .15s",
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: r.color, flexShrink: 0 }} />
              <span title={r.name} style={{ fontSize: 11.5, color: "var(--db-text-1)", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "help" }}>
                {r.name}
              </span>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 10.5, fontWeight: 600, color: "var(--db-text-2)" }}>
                {pct.toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────
   SHELL
───────────────────────────────────────── */
const CustomChart = ({
  data = [],
  xKey,
  yKey,
  barColor = "#6366f1",
  chartType = "bar",
  lineColors,
  lineLabels,
  pieColors = [
    "#6366f1", "#10b981", "#f59e0b", "#ec4899",
    "#06b6d4", "#8b5cf6", "#f43f5e", "#84cc16",
    "#fb923c", "#22d3ee", "#a78bfa", "#34d399",
  ],
}) => {
  useCanvasThemeKey();
  const ct = getChartTheme();

  if (!data || data.length === 0) {
    return (
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          minHeight: 240, border: `1px dashed var(--db-border2)`, borderRadius: 12,
          fontFamily: "'Inter', sans-serif", fontSize: 12, color: ct.emptyColor,
        }}
      >
        No data available
      </div>
    );
  }

  const isMulti = Array.isArray(yKey);
  const keys = isMulti ? yKey : [yKey];
  const MULTI_COLORS = lineColors || ["#6366f1", "#10b981", "#f59e0b", "#8b5cf6", "#f43f5e"];

  const maxValue = isMulti
    ? Math.max(...data.flatMap((d) => keys.map((k) => Number(d[k]) || 0)))
    : Math.max(...data.map((d) => Number(d[yKey]) || 0));
  const yAxisMax = Math.ceil((maxValue || 1) * 1.25);

  const formatYAxis = (v) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v));
  const gradId = `dbc-${barColor.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <div style={{ width: "100%", padding: "14px 16px" }}>
      {chartType === "bar" && (
        <BarChartInner data={data} xKey={xKey} yKey={yKey} barColor={barColor} lineColors={MULTI_COLORS} lineLabels={lineLabels} formatYAxis={formatYAxis} yAxisMax={yAxisMax} gradId={gradId} />
      )}
      {chartType === "line" && (
        <AreaChartInner data={data} xKey={xKey} yKey={yKey} barColor={barColor} lineColors={MULTI_COLORS} lineLabels={lineLabels} formatYAxis={formatYAxis} yAxisMax={yAxisMax} gradId={gradId} />
      )}
      {chartType === "pie" && (
        <DonutChartInner data={data} xKey={xKey} yKey={Array.isArray(yKey) ? yKey[0] : yKey} pieColors={pieColors} />
      )}
    </div>
  );
};

export default CustomChart;
