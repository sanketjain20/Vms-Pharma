import React, { useEffect, useState } from "react";
import CustomChart from "../CommonComponent/CustomChart";
import "../../Styles/Dashboard/Dashboard.css";

const Dashboard = () => {
  const [todayChartData, setTodayChartData] = useState([]);
  const [DaywiseChartData, setDaywiseChartData] = useState([]); 
  const [weeklyApiChartData, setWeeklyApiChartData] = useState([]);
  const [monthlyChartData, setMonthlyChartData] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // chart type state for all cards
  const [todayChartType, setTodayChartType] = useState("bar");
  const [daywiseChartType, setDaywiseChartType] = useState("bar");
  const [weeklyChartType, setWeeklyChartType] = useState("bar");
  const [monthlyChartType, setMonthlyChartType] = useState("bar");
  const [orderStatusChartType, setOrderStatusChartType] = useState("bar");

  const [summary, setSummary] = useState({
    todaySalesAmount: 0,
    todayOrders: 0,
    yesterdaySalesAmount: 0,
    orderGrowthPercentage: 0,
  });

  // ================= TODAY DASHBOARD =================
  useEffect(() => {
    fetch("http://localhost:8080/api/Sales/dashboard", {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.json())
      .then((json) => {
        const data = json?.data;
        if (!data) return;

        setTodayChartData(Array.isArray(data.chartData) ? data.chartData : []);

        setSummary({
          todaySalesAmount: data.totalSalesAmount ?? 0,
          todayOrders: data.totalOrders ?? 0,
          yesterdaySalesAmount: data.previousPeriodSales ?? 0,
          orderGrowthPercentage: data.growthPercentage ?? 0,
        });
      })
      .catch((err) => {
        console.error("Dashboard API failed:", err);
      });
  }, []);

  // ================= DayWise SALES =================
  useEffect(() => {
    fetch("http://localhost:8080/api/Sales/dashboardDayWise", {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.json())
      .then((json) => {
        const weeklyData = json?.data ?? [];
        setDaywiseChartData(Array.isArray(weeklyData) ? weeklyData : []);
      })
      .catch((err) => {
        console.error("Weekly Sales API failed:", err);
      });
  }, []);

  // ================= WEEKLY SALES (API) =================
  useEffect(() => {
    fetch("http://localhost:8080/api/Sales/dashboardWeekly", {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.json())
      .then((json) => {
        const weeklyData = json?.data ?? [];
        setWeeklyApiChartData(Array.isArray(weeklyData) ? weeklyData : []);
      })
      .catch((err) => {
        console.error("Weekly API failed:", err);
      });
  }, []);

  // ================= MONTHLY SALES (YEAR-WISE) =================
  useEffect(() => {
    fetch(`http://localhost:8080/api/Sales/dashboardMonthly/${selectedYear}`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.json())
      .then((json) => {
        const monthlyData = json?.data ?? [];
        setMonthlyChartData(Array.isArray(monthlyData) ? monthlyData : []);
      })
      .catch((err) => {
        console.error("Monthly API failed:", err);
      });
  }, [selectedYear]);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);

  // helper dropdown component for chart type
  const ChartTypeSelector = ({ chartType, setChartType, showYear = false }) => (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
      <label>Chart Type:</label>
      <select value={chartType} onChange={(e) => setChartType(e.target.value)}>
        <option value="bar">Bar</option>
        <option value="line">Line</option>
        <option value="pie">Pie</option>
      </select>

      {/* year selector only for monthly chart */}
      {showYear && (
        <>
          <label style={{ marginLeft: "15px" }}>Year:</label>
          <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
            {Array.from({ length: 5 }, (_, i) => {
              const year = new Date().getFullYear() - i;
              return <option key={year} value={year}>{year}</option>;
            })}
          </select>
        </>
      )}
    </div>
  );

  return (
    <div className="dashboard-container">

      {/* 🔥 TODAY SUMMARY CARDS */}
      <div className="summary-card">
        <h4>Today's Sales</h4>
        <p>{formatCurrency(summary.todaySalesAmount)}</p>
        <span className="sub-text">Total revenue earned today</span>
      </div>

      <div className="summary-card">
        <h4>Today's Orders</h4>
        <p>{summary.todayOrders}</p>
        <span className="sub-text">Orders placed today</span>
      </div>

      <div className="summary-card">
        <h4>Order Growth</h4>
        <p className={summary.orderGrowthPercentage >= 0 ? "positive" : "negative"}>
          {summary.orderGrowthPercentage}%
        </p>
        <span className="sub-text">Compared to previous period</span>
      </div>

      {/* 📊 TODAY SALES CHART */}
      <div className="d-card">
        <ChartTypeSelector chartType={todayChartType} setChartType={setTodayChartType} />
        <CustomChart
          data={todayChartData}
          xKey="label"
          yKey="value"
          xLabel="Hour"
          yLabel="Sales (₹)"
          chartTitle="Today's Sales Trend"
          barColor="yellow"
          chartType={todayChartType}
        />
      </div>

      {/* 🔥 DayWise (NOW DYNAMIC) */}
      <div className="d-card">
        <ChartTypeSelector chartType={daywiseChartType} setChartType={setDaywiseChartType} />
        <CustomChart
          data={DaywiseChartData}
          xKey="label"
          yKey="value"
          xLabel="Day"
          yLabel="Sales (₹)"
          chartTitle="Day-Wise Sales"
          barColor="#f28e2b"
          chartType={daywiseChartType}
        />
      </div>

      {/* Weekly */}
      <div className="d-card">
        <ChartTypeSelector chartType={weeklyChartType} setChartType={setWeeklyChartType} />
        <CustomChart
          data={weeklyApiChartData}
          xKey="label"
          yKey="value"
          xLabel="Week"
          yLabel="Sales (₹)"
          chartTitle="Weekly Sales"
          barColor="#59a14f"
          chartType={weeklyChartType}
        />
      </div>

      {/* Monthly / Revenue */}
      <div className="d-card">
        <ChartTypeSelector chartType={monthlyChartType} setChartType={setMonthlyChartType} showYear={true} />
        <CustomChart
          data={monthlyChartData}
          xKey="label"
          yKey="value"
          xLabel="Month"
          yLabel="Revenue (₹)"
          chartTitle="Monthly Overview"
          barColor="#af7aa1"
          chartType={monthlyChartType}
        />
      </div>

      {/* Order Status */}
      <div className="d-card">
        <ChartTypeSelector chartType={orderStatusChartType} setChartType={setOrderStatusChartType} />
        <CustomChart
          data={[
            { label: "Completed", value: 320 },
            { label: "Pending", value: 120 },
            { label: "Cancelled", value: 45 },
          ]}
          xKey="label"
          yKey="value"
          xLabel="Status"
          yLabel="Orders"
          chartTitle="Order Status"
          barColor="#4e79a7"
          chartType={orderStatusChartType}
        />
      </div>

    </div>
  );
};

export default Dashboard;
