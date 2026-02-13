import React, { useEffect, useState, useRef } from "react";
import CustomChart from "../CommonComponent/CustomChart";
import "../../Styles/Dashboard/Dashboard.css";
import GridSelect from "../CommonComponent/YearMonthGrid";

const Dashboard = () => {
  const [todayChartData, setTodayChartData] = useState([]);
  const [DaywiseChartData, setDaywiseChartData] = useState([]);
  const [weeklyApiChartData, setWeeklyApiChartData] = useState([]);
  const [monthlyChartData, setMonthlyChartData] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const [todayChartType, setTodayChartType] = useState("bar");
  const [daywiseChartType, setDaywiseChartType] = useState("bar");
  const [weeklyChartType, setWeeklyChartType] = useState("bar");
  const [monthlyChartType, setMonthlyChartType] = useState("bar");
  const [orderStatusChartType, setOrderStatusChartType] = useState("bar");

  const [orderStatusData, setOrderStatusData] = useState([]);
  const [orderStatusMonth, setOrderStatusMonth] = useState(new Date().getMonth() + 1);
  const [orderStatusYear, setOrderStatusYear] = useState(new Date().getFullYear());

  const [daywiseMonth, setDaywiseMonth] = useState(new Date().getMonth() + 1);
  const [daywiseYear, setDaywiseYear] = useState(new Date().getFullYear());

  const [weeklyMonth, setWeeklyMonth] = useState(new Date().getMonth() + 1);
  const [weeklyYear, setWeeklyYear] = useState(new Date().getFullYear());

  const [openFilter, setOpenFilter] = useState(null);

  const [summary, setSummary] = useState({
  todaySalesAmount: 0,
  todayOrders: 0,
  yesterdaySalesAmount: 0,
  orderGrowthPercentage: 0,
});


  const monthOptions = [
    { label: "Jan", value: 1 }, { label: "Feb", value: 2 },
    { label: "Mar", value: 3 }, { label: "Apr", value: 4 },
    { label: "May", value: 5 }, { label: "Jun", value: 6 },
    { label: "Jul", value: 7 }, { label: "Aug", value: 8 },
    { label: "Sep", value: 9 }, { label: "Oct", value: 10 },
    { label: "Nov", value: 11 }, { label: "Dec", value: 12 }
  ];

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);

  // ================= GLOBAL CLOSE HANDLERS =================
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest(".filter-menu")) {
        setOpenFilter(null);
      }
    };

    const handleEsc = (e) => {
      if (e.key === "Escape") setOpenFilter(null);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  // ================= FILTER MENU =================
  const FilterMenu = ({ id, children }) => (
    <div className="filter-menu" style={{ position: "relative" }}>
      <button
        onClick={() => setOpenFilter(openFilter === id ? null : id)}
        style={{
          background: "#222",
          border: "1px solid #555",
          borderRadius: "8px",
          padding: "6px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg"
          height="20px"
          viewBox="0 -960 960 960"
          width="20px"
          fill="#ffffff">
          <path d="M440-520v-280h440v280H440ZM80-160v-280h400v280H80Zm0-360v-280h280v280H80Zm440-80h280v-120H520v120ZM160-240h240v-120H160v120Zm0-360h120v-120H160v120Zm360 0ZM400-360ZM280-600ZM680-80l-12-60q-12-5-22.5-10.5T624-164l-58 18-40-68 46-40q-2-13-2-26t2-26l-46-40 40-68 58 18q11-8 21.5-13.5T668-420l12-60h80l12 60q12 5 22.5 10.5T816-396l58-18 40 68-46 40q2 13 2 26t-2 26l46 40-40 68-58-18q-11 8-21.5 13.5T772-140l-12 60h-80Zm96.5-143.5Q800-247 800-280t-23.5-56.5Q753-360 720-360t-56.5 23.5Q640-313 640-280t23.5 56.5Q687-200 720-200t56.5-23.5Z" />
        </svg>
      </button>


      <div
        style={{
          position: "absolute",
          top: "42px",
          left: "50",
          background: "#111",
          border: "1px solid #444",
          borderRadius: "8px",
          padding: "12px",
          zIndex: 100,
          minWidth: "190px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          opacity: openFilter === id ? 1 : 0,
          transform: openFilter === id ? "translateY(0px)" : "translateY(-8px)",
          pointerEvents: openFilter === id ? "auto" : "none",
          transition: "all 0.25s ease"
        }}
      >
        {children}
      </div>
    </div>
  );

  // ================= API CALLS (UNCHANGED) =================
useEffect(() => {
  fetch("http://localhost:8080/api/Sales/dashboard", { credentials: "include" })
    .then(res => res.json())
    .then(json => {
      const data = json?.data;
      setTodayChartData(data?.chartData || []);

      // 🔥 summary card data
      setSummary({
        todaySalesAmount: data?.totalSalesAmount ?? 0,
        todayOrders: data?.totalOrders ?? 0,
        yesterdaySalesAmount: data?.previousPeriodSales ?? 0,
        orderGrowthPercentage: data?.growthPercentage ?? 0,
      });
    });
}, []);

  useEffect(() => {
    fetch(`http://localhost:8080/api/Sales/dashboardDayWise/${daywiseMonth}/${daywiseYear}`, { credentials: "include" })
      .then(res => res.json())
      .then(json => setDaywiseChartData(json?.data || []));
  }, [daywiseMonth, daywiseYear]);

  useEffect(() => {
    fetch(`http://localhost:8080/api/Sales/dashboardWeekly/${weeklyMonth}/${weeklyYear}`, { credentials: "include" })
      .then(res => res.json())
      .then(json => setWeeklyApiChartData(json?.data || []));
  }, [weeklyMonth, weeklyYear]);

  useEffect(() => {
    fetch(`http://localhost:8080/api/Sales/dashboardMonthly/${selectedYear}`, { credentials: "include" })
      .then(res => res.json())
      .then(json => setMonthlyChartData(json?.data || []));
  }, [selectedYear]);

  useEffect(() => {
    fetch(`http://localhost:8080/api/Sales/orderStatusSummary/weekly/${orderStatusMonth}/${orderStatusYear}`, { credentials: "include" })
      .then(res => res.json())
      .then(json => setOrderStatusData(json?.data || []));
  }, [orderStatusMonth, orderStatusYear]);

  return (
    <div className="dashboard-container">
{/* 🔥 SUMMARY CARDS */}
<div className="summary-wrapper">
  <div className="summary-card">
    <h3>Today's Sales</h3>
    <p>{formatCurrency(summary.todaySalesAmount)}</p>
    <span>Total revenue earned today</span>
  </div>

  <div className="summary-card">
    <h3>Today's Orders</h3>
    <p>{summary.todayOrders}</p>
    <span>Orders placed today</span>
  </div>

  <div className="summary-card">
    <h3>Order Growth</h3>
    <p className={summary.orderGrowthPercentage >= 0 ? "positive" : "negative"}>
      {summary.orderGrowthPercentage}%
    </p>
    <span>Compared to previous period</span>
  </div>
</div>

      {/* TODAY */}
      <div className="d-card">
        <FilterMenu id="today">
          <label>Chart Type</label>
          <select value={todayChartType} onChange={e => setTodayChartType(e.target.value)}>
            <option value="bar">Bar</option>
            <option value="line">Line</option>
            <option value="pie">Pie</option>
          </select>
        </FilterMenu>
        <CustomChart data={todayChartData} xKey="label" yKey="value" xLabel="Hour" yLabel="Sales (₹)" chartTitle="Today's Sales Trend" barColor="yellow" chartType={todayChartType} />
      </div>

      {/* DAYWISE */}
      <div className="d-card">
        <FilterMenu id="daywise">
          <label>Chart Type</label>
          <select value={daywiseChartType} onChange={e => setDaywiseChartType(e.target.value)}>
            <option value="bar">Bar</option>
            <option value="line">Line</option>
            <option value="pie">Pie</option>
          </select>
          <GridSelect label="Month" type="month" value={daywiseMonth} onChange={setDaywiseMonth} options={monthOptions} />
          <GridSelect label="Year" type="year" value={daywiseYear} onChange={setDaywiseYear} />
        </FilterMenu>
        <CustomChart data={DaywiseChartData} xKey="label" yKey="value" xLabel="Day" yLabel="Sales (₹)" chartTitle="Day-Wise Sales" barColor="#f28e2b" chartType={daywiseChartType} />
      </div>

      {/* WEEKLY */}
      <div className="d-card">
        <FilterMenu id="weekly">
          <label>Chart Type</label>
          <select value={weeklyChartType} onChange={e => setWeeklyChartType(e.target.value)}>
            <option value="bar">Bar</option>
            <option value="line">Line</option>
            <option value="pie">Pie</option>
          </select>
          <GridSelect label="Month" type="month" value={weeklyMonth} onChange={setWeeklyMonth} options={monthOptions} />
          <GridSelect label="Year" type="year" value={weeklyYear} onChange={setWeeklyYear} />
        </FilterMenu>
        <CustomChart data={weeklyApiChartData} xKey="label" yKey="value" xLabel="Week" yLabel="Sales (₹)" chartTitle="Weekly Sales" barColor="#59a14f" chartType={weeklyChartType} />
      </div>

      {/* MONTHLY */}
      <div className="d-card">
        <FilterMenu id="monthly">
          <label>Chart Type</label>
          <select value={monthlyChartType} onChange={e => setMonthlyChartType(e.target.value)}>
            <option value="bar">Bar</option>
            <option value="line">Line</option>
            <option value="pie">Pie</option>
          </select>
          <GridSelect label="Year" type="year" value={selectedYear} onChange={setSelectedYear} />
        </FilterMenu>
        <CustomChart data={monthlyChartData} xKey="label" yKey="value" xLabel="Month" yLabel="Revenue (₹)" chartTitle="Monthly Overview" barColor="#af7aa1" chartType={monthlyChartType} />
      </div>

      {/* ORDER STATUS */}
      <div className="d-card">
        <FilterMenu id="status">
          <label>Chart Type</label>
          <select value={orderStatusChartType} onChange={e => setOrderStatusChartType(e.target.value)}>
            <option value="bar">Bar</option>
            <option value="line">Line</option>
            <option value="pie">Pie</option>
          </select>
          <GridSelect label="Month" type="month" value={orderStatusMonth} onChange={setOrderStatusMonth} options={monthOptions} />
          <GridSelect label="Year" type="year" value={orderStatusYear} onChange={setOrderStatusYear} />
        </FilterMenu>
        <CustomChart data={orderStatusData} xKey="label" yKey="value" xLabel="Status" yLabel="Orders" chartTitle="Order Status Overview" barColor="#328ae7" chartType={orderStatusChartType} />
      </div>

    </div>
  );
};

export default Dashboard;
