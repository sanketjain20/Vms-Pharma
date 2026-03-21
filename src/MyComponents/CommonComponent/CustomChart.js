import React, { useRef, useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  LabelList,
  Area,
  AreaChart,
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
      boxShadow: "0 16px 40px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.03)",
      backdropFilter: "blur(20px)",
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#525667", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#e6e8f0", fontFamily: "'Oxanium', sans-serif", letterSpacing: "-0.01em" }}>
        {formatted}
      </div>
      <div style={{ width: "100%", height: 1, background: "linear-gradient(to right, rgba(59,130,246,0.5), transparent)", marginTop: 8 }} />
    </div>
  );
};

/* ─────────────────────────────────────────
   CUSTOM PIE LABEL
───────────────────────────────────────── */
const renderPieLabel = ({ cx, cy, midAngle, outerRadius, name, percent }) => {
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 28;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x} y={y}
      fill="rgba(200,205,220,0.8)"
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.06em" }}
    >
      {name}: {(percent * 100).toFixed(0)}%
    </text>
  );
};

/* ─────────────────────────────────────────
   ANIMATED ENTRY WRAPPER
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
      x={x}
      y={y + (height - animH)}
      width={width}
      height={animH}
      fill={fill}
      rx={5}
      style={{ transition: "height 0.6s cubic-bezier(0.34,1.56,0.64,1), y 0.6s cubic-bezier(0.34,1.56,0.64,1)" }}
    />
  );
};

/* ─────────────────────────────────────────
   CHART WRAPPER — 3D CANVAS PARTICLE BG
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

      // Connect nearby dots
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
    <canvas
      ref={ref}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        borderRadius: 14,
        opacity: 0.6,
      }}
    />
  );
};

/* ─────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────── */
const CustomChart = ({
  data = [],
  xKey,
  yKey,
  xLabel = "",
  yLabel = "",
  chartTitle = "",
  barColor = "#3b82f6",
  chartType = "bar",
  pieColors = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#f43f5e", "#06b6d4", "#ec4899"],
}) => {
  const maxValue = Math.max(...data.map((d) => Number(d[yKey]) || 0));
  const yAxisMax = Math.ceil(maxValue * 1.25);

  const formatXAxis = (v) => {
    if (!v) return "";
    const s = String(v);
    return s.length > 9 ? s.substring(0, 9) + "…" : s;
  };

  const formatYAxis = (v) =>
    v >= 1000
      ? `₹${(v / 1000).toFixed(0)}k`
      : String(v);

  // Derive a muted glow color for canvas particles
  const glowHex = barColor.startsWith("#") ? barColor : "#3b82f6";

  const sharedXAxis = (
    <XAxis
      dataKey={xKey}
      tickFormatter={formatXAxis}
      interval={0}
      angle={-14}
      padding={{ left: 16, right: 16 }}
      textAnchor="end"
      axisLine={false}
      tickLine={false}
      tick={{ fill: "#525667", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}
    />
  );

  const sharedYAxis = (
    <YAxis
      domain={[0, yAxisMax]}
      tickFormatter={formatYAxis}
      axisLine={false}
      tickLine={false}
      tick={{ fill: "#383a4d", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
      width={44}
    />
  );

  const sharedGrid = (
    <CartesianGrid
      vertical={false}
      stroke="rgba(255,255,255,0.03)"
      strokeDasharray="4 4"
    />
  );

  return (
    <div style={{
      position: "relative",
      width: "100%",
      height: "100%",
      minHeight: 320,
      background: "rgba(4,5,10,0.85)",
      borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.045)",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
    }}>

      {/* Particle canvas BG */}
      <ChartCanvas3D color={glowHex} />

      {/* Top shimmer line */}
      <div style={{
        position: "absolute",
        top: 0, left: 0, right: 0,
        height: 1,
        background: `linear-gradient(to right, transparent, ${glowHex}66 40%, ${glowHex}aa 50%, ${glowHex}66 60%, transparent)`,
        zIndex: 1,
      }} />

      {/* Chart title */}
      {chartTitle && (
        <div style={{
          position: "relative",
          zIndex: 2,
          padding: "14px 18px 0",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          <div style={{
            width: 3, height: 14,
            background: barColor,
            borderRadius: 2,
            boxShadow: `0 0 8px ${barColor}`,
            flexShrink: 0,
          }} />
          <span style={{
            fontFamily: "'Oxanium', sans-serif",
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: "#bcc0d0",
          }}>
            {chartTitle}
          </span>
        </div>
      )}

      {/* Chart body */}
      <div style={{ position: "relative", zIndex: 2, flex: 1, padding: "12px 8px 8px" }}>
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "bar" ? (
            <BarChart data={data} barCategoryGap="32%">
              {sharedXAxis}
              {sharedYAxis}
              {sharedGrid}
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.025)" }} />
              <defs>
                <linearGradient id={`barGrad-${barColor.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={barColor} stopOpacity={1} />
                  <stop offset="100%" stopColor={barColor} stopOpacity={0.4} />
                </linearGradient>
              </defs>
              <Bar
                dataKey={yKey}
                fill={`url(#barGrad-${barColor.replace("#","")})`}
                radius={[6, 6, 0, 0]}
                shape={<AnimatedBar fill={`url(#barGrad-${barColor.replace("#","")})`} />}
              >
                <LabelList
                  dataKey={yKey}
                  position="top"
                  formatter={(v) => (v > 999 ? `₹${(v / 1000).toFixed(1)}k` : v)}
                  style={{ fill: `${barColor}cc`, fontSize: 9, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          ) : chartType === "line" ? (
            <AreaChart data={data}>
              <defs>
                <linearGradient id={`areaGrad-${barColor.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={barColor} stopOpacity={0.22} />
                  <stop offset="95%" stopColor={barColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              {sharedXAxis}
              {sharedYAxis}
              {sharedGrid}
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: `${barColor}44`, strokeWidth: 1 }} />
              <Area
                type="monotone"
                dataKey={yKey}
                stroke={barColor}
                strokeWidth={2.5}
                fill={`url(#areaGrad-${barColor.replace("#","")})`}
                dot={{ r: 4, fill: barColor, stroke: "#000", strokeWidth: 2 }}
                activeDot={{ r: 6, fill: barColor, stroke: "#fff", strokeWidth: 1.5, boxShadow: `0 0 10px ${barColor}` }}
              />
            </AreaChart>
          ) : (
            <PieChart>
              <Tooltip content={<CustomTooltip />} />
              <defs>
                {pieColors.map((c, i) => (
                  <radialGradient key={i} id={`pieGrad-${i}`} cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor={c} stopOpacity={1} />
                    <stop offset="100%" stopColor={c} stopOpacity={0.6} />
                  </radialGradient>
                ))}
              </defs>
              <Pie
                data={data}
                dataKey={yKey}
                nameKey={xKey}
                cx="50%"
                cy="50%"
                outerRadius="65%"
                innerRadius="30%"
                paddingAngle={3}
                labelLine={false}
                label={renderPieLabel}
                strokeWidth={0}
              >
                {data.map((_, i) => (
                  <Cell
                    key={`cell-${i}`}
                    fill={`url(#pieGrad-${i % pieColors.length})`}
                    stroke="rgba(0,0,0,0.4)"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Bottom glow bar */}
      <div style={{
        position: "absolute",
        bottom: 0, left: "20%", right: "20%",
        height: 1,
        background: `linear-gradient(to right, transparent, ${glowHex}55, transparent)`,
        zIndex: 1,
      }} />
    </div>
  );
};

export default CustomChart;
