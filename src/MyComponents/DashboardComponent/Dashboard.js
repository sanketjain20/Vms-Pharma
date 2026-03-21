import React, { useEffect, useState, useRef } from "react";
import CustomChart from "../CommonComponent/CustomChart";
import "../../Styles/Dashboard/Dashboard.css";
import GridSelect from "../CommonComponent/YearMonthGrid";
import { FaRupeeSign, FaShoppingCart } from "react-icons/fa";
import { MdTrendingUp, MdTrendingDown } from "react-icons/md";

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

  const [topProduct, setTopProduct] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [deadStockData, setDeadStockData] = useState([]);
  const [showDeadStock, setShowDeadStock] = useState(false);
  const [showLowStockList, setShowLowStockList] = useState(false);
  const [topProductPeriod, setTopProductPeriod] = useState("MONTHLY");

  const [summary, setSummary] = useState({
    todaySalesAmount: 0,
    todayOrders: 0,
    yesterdaySalesAmount: 0,
    orderGrowthPercentage: 0,
  });

  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

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

  /* 3D CANVAS BACKGROUND */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const orbs = Array.from({ length: 5 }, (_, i) => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: 120 + Math.random() * 200,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
      hue: [215, 225, 205, 235, 210][i],
      alpha: 0.022 + Math.random() * 0.03,
    }));

    let tick = 0;

    const draw = () => {
      tick++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Perspective grid
      const horizon = canvas.height * 0.5;
      const vanishX = canvas.width / 2;
      const gridCount = 14;
      const speed = (tick * 0.25) % (canvas.height / gridCount);

      ctx.save();
      ctx.globalAlpha = 0.05;
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 0.5;

      for (let i = 0; i <= gridCount; i++) {
        const y = horizon + speed + (i * (canvas.height - horizon)) / gridCount;
        if (y > canvas.height) continue;
        const spread = ((y - horizon) / (canvas.height - horizon)) * canvas.width * 1.4;
        ctx.beginPath();
        ctx.moveTo(vanishX - spread / 2, y);
        ctx.lineTo(vanishX + spread / 2, y);
        ctx.stroke();
      }

      for (let i = 0; i <= 18; i++) {
        const t = i / 18;
        const bx = vanishX - canvas.width * 0.7 + t * canvas.width * 1.4;
        ctx.beginPath();
        ctx.moveTo(vanishX, horizon);
        ctx.lineTo(bx, canvas.height + 10);
        ctx.stroke();
      }
      ctx.restore();

      orbs.forEach((orb) => {
        orb.x += orb.vx;
        orb.y += orb.vy;
        if (orb.x < -orb.r) orb.x = canvas.width + orb.r;
        if (orb.x > canvas.width + orb.r) orb.x = -orb.r;
        if (orb.y < -orb.r) orb.y = canvas.height + orb.r;
        if (orb.y > canvas.height + orb.r) orb.y = -orb.r;

        const g = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.r);
        g.addColorStop(0, `hsla(${orb.hue}, 75%, 55%, ${orb.alpha})`);
        g.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
      });

      for (let y = 0; y < canvas.height; y += 4) {
        ctx.fillStyle = "rgba(0,0,0,0.032)";
        ctx.fillRect(0, y, canvas.width, 1);
      }

      const vig = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, canvas.height * 0.1,
        canvas.width / 2, canvas.height / 2, canvas.height * 0.9
      );
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(0,0,0,0.75)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  /* CLOSE FILTER ON OUTSIDE CLICK */
  useEffect(() => {
    const handle = (e) => { if (!e.target.closest(".filter-menu")) setOpenFilter(null); };
    const esc = (e) => { if (e.key === "Escape") setOpenFilter(null); };
    document.addEventListener("mousedown", handle);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", handle); document.removeEventListener("keydown", esc); };
  }, []);

  /* FILTER MENU COMPONENT */
  const FilterMenu = ({ id, children }) => (
    <div className="filter-menu">
      <button className="filter-gear-btn" onClick={() => setOpenFilter(openFilter === id ? null : id)}>
        <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor">
          <path d="M440-520v-280h440v280H440ZM80-160v-280h400v280H80Zm0-360v-280h280v280H80Zm440-80h280v-120H520v120ZM160-240h240v-120H160v120Zm0-360h120v-120H160v120Zm360 0ZM400-360ZM280-600ZM680-80l-12-60q-12-5-22.5-10.5T624-164l-58 18-40-68 46-40q-2-13-2-26t2-26l-46-40 40-68 58 18q11-8 21.5-13.5T668-420l12-60h80l12 60q12 5 22.5 10.5T816-396l58-18 40 68-46 40q2 13 2 26t-2 26l46 40-40 68-58-18q-11 8-21.5 13.5T772-140l-12 60h-80Zm96.5-143.5Q800-247 800-280t-23.5-56.5Q753-360 720-360t-56.5 23.5Q640-313 640-280t23.5 56.5Q687-200 720-200t56.5-23.5Z" />
        </svg>
      </button>
      <div className={`filter-panel ${openFilter === id ? "open" : ""}`}>
        {children}
      </div>
    </div>
  );

  /* API CALLS */
  useEffect(() => {
    fetch("http://localhost:8080/api/Sales/dashboard", { credentials: "include" })
      .then(r => r.json())
      .then(json => {
        const data = json?.data;
        setTodayChartData(data?.chartData || []);
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
      .then(r => r.json()).then(json => setDaywiseChartData(json?.data || []));
  }, [daywiseMonth, daywiseYear]);

  useEffect(() => {
    fetch(`http://localhost:8080/api/Sales/dashboardWeekly/${weeklyMonth}/${weeklyYear}`, { credentials: "include" })
      .then(r => r.json()).then(json => setWeeklyApiChartData(json?.data || []));
  }, [weeklyMonth, weeklyYear]);

  useEffect(() => {
    fetch(`http://localhost:8080/api/Sales/dashboardMonthly/${selectedYear}`, { credentials: "include" })
      .then(r => r.json()).then(json => setMonthlyChartData(json?.data || []));
  }, [selectedYear]);

  useEffect(() => {
    fetch(`http://localhost:8080/api/Sales/orderStatusSummary/weekly/${orderStatusMonth}/${orderStatusYear}`, { credentials: "include" })
      .then(r => r.json()).then(json => setOrderStatusData(json?.data || []));
  }, [orderStatusMonth, orderStatusYear]);

  useEffect(() => {
    fetch(`http://localhost:8080/api/Sales/TopSaleProduct/${topProductPeriod}`, { credentials: "include" })
      .then(r => r.json()).then(json => setTopProduct(json?.data || null));
  }, [topProductPeriod]);

  useEffect(() => {
    fetch("http://localhost:8080/api/Product/DeadStock", { credentials: "include" })
      .then(r => r.json()).then(json => setDeadStockData(json?.data || []));
  }, []);

  useEffect(() => {
    fetch("http://localhost:8080/api/Inventory/LowStockProduct", { credentials: "include" })
      .then(r => r.json()).then(json => setLowStock(json?.data || []));
  }, []);

  return (
    <div className="dashboard-container">
      {/* 3D Canvas BG */}
      <canvas ref={canvasRef} className="dash-bg-canvas" />
      <div className="dash-noise" />
      <div className="dash-top-beam" />

      <div className="dash-content">

        {/* ── PAGE HEADER ── */}
        <div className="dash-page-header">
          <div className="dash-header-left">
            <div className="dash-badge">
              <span className="dash-badge-dot" />
              Analytics Overview
            </div>
            <h1 className="dash-title">
              <span className="dash-title-acc"></span> DASHBOARD
            </h1>
          </div>
          <div className="dash-header-rule" />
        </div>

        {/* ── SUMMARY CARDS ROW ── */}
        <div className="summary-row">

          {/* Sales */}
          <div className="s-card s-blue" style={{ animationDelay: "0s" }}>
            <div className="s-card-top-line" />
            <div className="s-card-corner tl" /><div className="s-card-corner tr" />
            <div className="s-card-corner bl" /><div className="s-card-corner br" />
            <div className="s-icon-wrap blue-glow">
              <FaRupeeSign />
            </div>
            <div className="s-body">
              <span className="s-label">Today's Sales</span>
              <span className="s-value">{formatCurrency(summary.todaySalesAmount)}</span>
              <span className="s-sub">Total revenue earned today</span>
            </div>
          </div>

          {/* Orders */}
          <div className="s-card s-violet" style={{ animationDelay: "0.08s" }}>
            <div className="s-card-top-line" />
            <div className="s-card-corner tl" /><div className="s-card-corner tr" />
            <div className="s-card-corner bl" /><div className="s-card-corner br" />
            <div className="s-icon-wrap violet-glow">
              <FaShoppingCart />
            </div>
            <div className="s-body">
              <span className="s-label">Today's Orders</span>
              <span className="s-value">{summary.todayOrders}</span>
              <span className="s-sub">Orders placed today</span>
            </div>
          </div>

          {/* Growth */}
          <div className={`s-card ${summary.orderGrowthPercentage >= 0 ? "s-green" : "s-red"}`} style={{ animationDelay: "0.16s" }}>
            <div className="s-card-top-line" />
            <div className="s-card-corner tl" /><div className="s-card-corner tr" />
            <div className="s-card-corner bl" /><div className="s-card-corner br" />
            <div className={`s-icon-wrap ${summary.orderGrowthPercentage >= 0 ? "green-glow" : "red-glow"}`}>
              {summary.orderGrowthPercentage >= 0 ? <MdTrendingUp /> : <MdTrendingDown />}
            </div>
            <div className="s-body">
              <span className="s-label">Order Growth</span>
              <span className={`s-value ${summary.orderGrowthPercentage >= 0 ? "positive" : "negative"}`}>
                {summary.orderGrowthPercentage >= 0 ? "+" : ""}{summary.orderGrowthPercentage}%
              </span>
              <span className="s-sub">Compared to previous period</span>
            </div>
          </div>

          {/* Top Product */}
          <div className="s-card s-amber insight-card" style={{ animationDelay: "0.24s" }}>
            <div className="s-card-top-line" />
            <div className="s-card-corner tl" /><div className="s-card-corner tr" />
            <div className="s-card-corner bl" /><div className="s-card-corner br" />
            <div className="insight-gear">
              <FilterMenu id="top-product-settings">
                <label>Period</label>
                <select value={topProductPeriod} onChange={(e) => setTopProductPeriod(e.target.value)}>
                  <option value="MONTHLY">Monthly</option>
                  <option value="YEARLY">Yearly</option>
                </select>
              </FilterMenu>
            </div>
            <div className="s-icon-wrap amber-glow">🏆</div>
            <div className="s-body">
              <span className="s-label">Top Product · {topProductPeriod === "MONTHLY" ? "Month" : "Year"}</span>
              <span className="s-value small-val">{topProduct?.productName || "No Data"}</span>
              <span className="s-sub">{topProduct ? `${topProduct.totalSold} units sold` : "No sales yet"}</span>
            </div>
          </div>

          {/* Dead Stock */}
          <div className="s-card s-rose expand-card" style={{ animationDelay: "0.32s" }}>
            <div className="s-card-top-line" />
            <div className="s-card-corner tl" /><div className="s-card-corner tr" />
            <div className="s-card-corner bl" /><div className="s-card-corner br" />
            <div className="s-icon-wrap rose-glow">📉</div>
            <div className="s-body">
              <span className="s-label">Dead Stock</span>
              <span className="s-value">{deadStockData.length}</span>
              <span className="s-sub">Products with low sales</span>
              <button className="s-expand-btn" onClick={() => setShowDeadStock(!showDeadStock)}>
                {showDeadStock ? "Hide" : "View Details"}
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d={showDeadStock ? "M2 7L5 4L8 7" : "M2 4L5 7L8 4"} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            {showDeadStock && (
              <div className="s-expand-list">
                {deadStockData.map((item, i) => (
                  <div key={i} className="s-expand-row">
                    <span>{item.productName}</span>
                    <span className="s-expand-badge rose">Sold: {item.totalSold}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Low Stock */}
          <div className="s-card s-yellow expand-card" style={{ animationDelay: "0.4s" }}>
            <div className="s-card-top-line" />
            <div className="s-card-corner tl" /><div className="s-card-corner tr" />
            <div className="s-card-corner bl" /><div className="s-card-corner br" />
            <div className="s-icon-wrap yellow-glow">⚠️</div>
            <div className="s-body">
              <span className="s-label">Low Stock Alerts</span>
              <span className="s-value">{lowStock.length}</span>
              <span className="s-sub">Items below reorder level</span>
              <button className="s-expand-btn" onClick={() => setShowLowStockList(!showLowStockList)}>
                {showLowStockList ? "Hide" : "View Details"}
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d={showLowStockList ? "M2 7L5 4L8 7" : "M2 4L5 7L8 4"} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            {showLowStockList && (
              <div className="s-expand-list">
                {lowStock.map((item, i) => (
                  <div key={i} className="s-expand-row">
                    <span>{item.productName}</span>
                    <span className="s-expand-badge yellow">Qty: {item.currentQuantity} / {item.reorderLevel}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* ── CHART SECTION HEADER ── */}
        <div className="charts-section-header">
          <div className="section-label">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="1" y="6" width="2" height="5" rx="0.5" fill="currentColor"/>
              <rect x="5" y="3" width="2" height="8" rx="0.5" fill="currentColor"/>
              <rect x="9" y="1" width="2" height="10" rx="0.5" fill="currentColor"/>
            </svg>
            Analytics Charts
          </div>
        </div>

        {/* ── CHARTS GRID ── */}
        <div className="charts-grid">

          {/* TODAY */}
          <div className="d-card" style={{ animationDelay: "0.1s" }}>
            <div className="d-card-header">
              <div className="d-card-title-row">
                <span className="d-card-dot blue" />
                <span className="d-card-label">Today's Trend</span>
              </div>
              <FilterMenu id="today">
                <label>Chart Type</label>
                <select value={todayChartType} onChange={e => setTodayChartType(e.target.value)}>
                  <option value="bar">Bar</option>
                  <option value="line">Line</option>
                  <option value="pie">Pie</option>
                </select>
              </FilterMenu>
            </div>
            <div className="d-card-body">
              <CustomChart data={todayChartData} xKey="label" yKey="value" xLabel="Hour" yLabel="Sales (₹)" chartTitle="Today's Sales Trend" barColor="#3b82f6" chartType={todayChartType} />
            </div>
          </div>

          {/* DAYWISE */}
          <div className="d-card" style={{ animationDelay: "0.18s" }}>
            <div className="d-card-header">
              <div className="d-card-title-row">
                <span className="d-card-dot amber" />
                <span className="d-card-label">Day-Wise Sales</span>
              </div>
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
            </div>
            <div className="d-card-body">
              <CustomChart data={DaywiseChartData} xKey="label" yKey="value" xLabel="Day" yLabel="Sales (₹)" chartTitle="Day-Wise Sales" barColor="#f59e0b" chartType={daywiseChartType} />
            </div>
          </div>

          {/* WEEKLY */}
          <div className="d-card" style={{ animationDelay: "0.26s" }}>
            <div className="d-card-header">
              <div className="d-card-title-row">
                <span className="d-card-dot green" />
                <span className="d-card-label">Weekly Sales</span>
              </div>
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
            </div>
            <div className="d-card-body">
              <CustomChart data={weeklyApiChartData} xKey="label" yKey="value" xLabel="Week" yLabel="Sales (₹)" chartTitle="Weekly Sales" barColor="#10b981" chartType={weeklyChartType} />
            </div>
          </div>

          {/* MONTHLY */}
          <div className="d-card" style={{ animationDelay: "0.34s" }}>
            <div className="d-card-header">
              <div className="d-card-title-row">
                <span className="d-card-dot violet" />
                <span className="d-card-label">Monthly Overview</span>
              </div>
              <FilterMenu id="monthly">
                <label>Chart Type</label>
                <select value={monthlyChartType} onChange={e => setMonthlyChartType(e.target.value)}>
                  <option value="bar">Bar</option>
                  <option value="line">Line</option>
                  <option value="pie">Pie</option>
                </select>
                <GridSelect label="Year" type="year" value={selectedYear} onChange={setSelectedYear} />
              </FilterMenu>
            </div>
            <div className="d-card-body">
              <CustomChart data={monthlyChartData} xKey="label" yKey="value" xLabel="Month" yLabel="Revenue (₹)" chartTitle="Monthly Overview" barColor="#8b5cf6" chartType={monthlyChartType} />
            </div>
          </div>

          {/* ORDER STATUS */}
          <div className="d-card" style={{ animationDelay: "0.42s" }}>
            <div className="d-card-header">
              <div className="d-card-title-row">
                <span className="d-card-dot sky" />
                <span className="d-card-label">Order Status</span>
              </div>
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
            </div>
            <div className="d-card-body">
              <CustomChart data={orderStatusData} xKey="label" yKey="value" xLabel="Status" yLabel="Orders" chartTitle="Order Status Overview" barColor="#06b6d4" chartType={orderStatusChartType} />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Dashboard;
