// components/CustomChart.jsx
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
  chartType = "bar", // "bar" | "line" | "pie"
  pieColors = ["#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f"], // standard 5 colors
}) => {
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
              label={{
                value: xLabel,
                position: "insideBottom",
                offset: -18,
                style: { fontWeight: "bold", fontSize: 16, fill: "#fefffd" },
              }}
            />
            <YAxis
              label={{
                value: yLabel,
                angle: -90,
                position: "insideLeft",
                offset: 3,
                style: { fontWeight: "bold", fontSize: 16, fill: "#f8f4f4" },
              }}
            />
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
            <Bar dataKey={yKey} fill={barColor}>
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
              label={{
                value: xLabel,
                position: "insideBottom",
                offset: -18,
                style: { fontWeight: "bold", fontSize: 16, fill: "#fefffd" },
              }}
            />
            <YAxis
              label={{
                value: yLabel,
                angle: -90,
                position: "insideLeft",
                offset: 3,
                style: { fontWeight: "bold", fontSize: 16, fill: "#f8f4f4" },
              }}
            />
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
              type="linear"
              dataKey={yKey}
              stroke={barColor}
              strokeWidth={2}
              dot={{ r: 5 }}
            >
              <LabelList
                dataKey={yKey}
                position="top"
                style={{ fill: "#fff", fontWeight: "bold" }}
              />
            </Line>
          </LineChart>
        ) : (
          // Pie Chart
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
              fill={barColor}
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
