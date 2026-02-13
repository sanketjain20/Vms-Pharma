import React from "react";
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
} from "recharts";

const CustomChart = ({
  data,
  xKey,
  yKey,
  xLabel = "",
  yLabel = "",
  chartTitle = "",
  barColor = "#3d3c3c",
  chartType = "bar",
  pieColors = ["#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f"],
}) => {

  // 🔹 Calculate dynamic Y-axis max with +20% headroom
  const maxValue = Math.max(...data.map(item => Number(item[yKey]) || 0));
  const xAxisMaxValue = Math.max(...data.map(item => Number(item[xKey]) || 0));
  const yAxisMax = Math.ceil(maxValue * 1.2);
  const xAxisMax=  Math.ceil(xAxisMaxValue * 1.5);
  const formatXAxis = (value) => {
    if (!value) return "";
    const str = String(value);
    return str.length > 8 ? str.substring(0, 8) + "…" : str; // show first 8 chars
  };

  return (
    <div style={{ width: "100%", height: 300 }}>
      {chartTitle && (
        <h3 style={{ textAlign: "center", marginBottom: 10 }}>{chartTitle}</h3>
      )}
      <ResponsiveContainer>
        {chartType === "bar" ? (
          <BarChart data={data}>
            <XAxis
              dataKey={xKey}
              tickFormatter={formatXAxis}
              interval={0}
              angle={-15}
              padding={{ left: 20, right: 20 }}
              textAnchor="end"
              axisLine={false}
              tickLine={false}
              style={{ fontWeight: "bold", fill: "#fff", fontSize: 12 }}
              label={{
                value: xLabel,
                position: "insideBottom",
                offset: -18,
                style: { fontWeight: "bold", fontSize: 16, fill: "#fff" },
              }}
            />

            <YAxis
              domain={[0, yAxisMax]}   // ✅ Added dynamic max
              tick={false}
              axisLine={false}
              label={{
                value: yLabel,
                angle: -90,
                position: "insideLeft",
                style: { fontWeight: "bold", fontSize: 16, fill: "#fff" },
              }}
            />
            <CartesianGrid vertical={false} horizontal={false} />
            <Tooltip
              formatter={(value) =>
                new Intl.NumberFormat("en-IN", {
                  style: "currency",
                  currency: "INR",
                }).format(value)
              }
              contentStyle={{
                backgroundColor: "#222",
                border: "1px solid #555",
                color: "#fff",
              }}
            />
            <Legend formatter={() => ""} />
            <Bar dataKey={yKey} fill={barColor} radius={[6, 6, 0, 0]}>
              <LabelList
                dataKey={yKey}
                position="top"
                style={{ fill: "#fff", fontWeight: "bold" }}
              />
            </Bar>
          </BarChart>
        ) : chartType === "line" ? (
          <LineChart data={data}>
            <XAxis
              dataKey={xKey}
              tickFormatter={formatXAxis}
              interval={0}
              angle={-15}
              padding={{ left: 20, right: 20 }}
              textAnchor="end"
              axisLine={false}
              tickLine={false}
              style={{ fontWeight: "bold", fill: "#fff", fontSize: 12 }}
              label={{
                value: xLabel,
                position: "insideBottom",
                offset: -18,
                style: { fontWeight: "bold", fontSize: 16, fill: "#fff" },
              }}
            />

            <YAxis
              domain={[0, yAxisMax]}   // ✅ Added dynamic max
              tick={false}
              axisLine={false}
              label={{
                value: yLabel,
                angle: -90,
                position: "insideLeft",
                style: { fontWeight: "bold", fontSize: 16, fill: "#fff" },
              }}
            />
            <CartesianGrid vertical={false} horizontal={false} />
            <Tooltip
              formatter={(value) =>
                new Intl.NumberFormat("en-IN", {
                  style: "currency",
                  currency: "INR",
                }).format(value)
              }
              contentStyle={{
                backgroundColor: "#222",
                border: "1px solid #555",
                color: "#fff",
              }}
            />
            <Legend formatter={() => ""} />
            <Line
              type="monotone"
              dataKey={yKey}
              stroke={barColor}
              strokeWidth={3}
              dot={{ r: 5 }}
            />
          </LineChart>
        ) : (
          <PieChart>
            <Tooltip
              formatter={(value) =>
                new Intl.NumberFormat("en-IN", {
                  style: "currency",
                  currency: "INR",
                }).format(value)
              }
              contentStyle={{
                backgroundColor: "#222",
                border: "1px solid #555",
                color: "#fff",
              }}
            />
            <Legend formatter={() => ""} />
            <Pie
              data={data}
              dataKey={yKey}
              nameKey={xKey}
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={({ name, percent }) =>
                `${name}: ${(percent * 100).toFixed(0)}%`
              }
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={pieColors[index % pieColors.length]}
                />
              ))}
            </Pie>
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  );
};

export default CustomChart;
