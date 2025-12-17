import React, { useState } from "react";
import "../../Styles/Report/Report.css";

const REPORTS = [
  { id: "product-sales", title: "Product Sales Report", description: "View sales based on products, quantity, and revenue" },
  { id: "vendor-sales", title: "Vendor Sales Report", description: "Analyze sales performance vendor-wise" },
  { id: "overall-sales", title: "Overall Sales Report", description: "Complete overview of total sales and revenue" },
  { id: "payment-report", title: "Payment Report", description: "Track paid, unpaid, and pending payments" },
  { id: "date-wise", title: "Date-wise Report", description: "Filter reports by specific date range" },
  { id: "custom", title: "Custom Report", description: "Create custom report with your own filters" },
];

export default function ReportsDashboard() {
  const [search, setSearch] = useState("");

  const filteredReports = REPORTS.filter((r) =>
    r.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="dashboard-container">
      <div className="header-section">
        <h1>Reports Dashboard</h1>
        <p>Explore and generate insights from various reports</p>
        <input
          type="text"
          placeholder="Search report..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input-report"
        />
      </div>

      <div className="reports-list">
        {filteredReports.map((report) => (
          <div key={report.id} className="report-glass-card">
            <div className="report-info">
              <h2>{report.title}</h2>
              <p>{report.description}</p>
            </div>
            <button className="generate-btn">Generate</button>
          </div>
        ))}
      </div>
    </div>
  );
}
