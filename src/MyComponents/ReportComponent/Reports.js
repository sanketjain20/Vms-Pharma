import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../Styles/Report/Report.css";

export default function ReportsDashboard() {
  const moduleId = 7;

  const apiUrl = "http://localhost:8080/api/Reports/GetAllReports";
  const accessApi = `http://localhost:8080/api/Access/GetUserModuleAccess/${moduleId}`;

  const [search, setSearch] = useState("");
  const [reports, setReports] = useState([]);
  const [allowedReportKeys, setAllowedReportKeys] = useState([]);

  const navigate = useNavigate(); // ✅ ADDED

  // 1️⃣ Fetch report access
  useEffect(() => {
    fetch(accessApi, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.json())
      .then((response) => {
        if (response.status === 200 && Array.isArray(response.data)) {
          const splitPermissions = response.data
            .flatMap((p) => p.split("/"))
            .map((s) => s.toLowerCase());

          setAllowedReportKeys(splitPermissions);
        }
      })
      .catch((err) =>
        console.error("Error fetching report access:", err)
      );
  }, [accessApi]);

  // 2️⃣ Fetch all reports
  useEffect(() => {
    fetch(apiUrl, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((response) => {
        if (response.status === 200 && response.data) {
          const dataObj = response.data;

          const list =
            Array.isArray(dataObj)
              ? dataObj
              : typeof dataObj === "object"
              ? Object.values(dataObj).find((v) => Array.isArray(v)) || []
              : [];

          const activeReports = list.filter((r) => !r.disabled);
          setReports(activeReports);
        }
      })
      .catch((error) =>
        console.error("Error fetching reports:", error)
      );
  }, [apiUrl]);

  // 3️⃣ Apply access + search filter
  const filteredReports = reports.filter((r) => {
    const reportName = r.name.toLowerCase();

    const hasAccess =
      allowedReportKeys.length === 0 ||
      allowedReportKeys.some((key) => reportName.includes(key));

    const matchesSearch = reportName.includes(search.toLowerCase());

    return hasAccess && matchesSearch;
  });

  // ✅ ADDED: generate handler
  const handleGenerate = (reportName) => {
    navigate("/master/reports/open", {
      state: { reportName },
    });
  };

  return (
    <div className="r-container">
    <div className="dashboard-container">
      <div className="header-section">
        <h1>Reports</h1>
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
        {filteredReports.length === 0 ? (
          <div className="state-text">No reports found</div>
        ) : (
          filteredReports.map((report) => (
            <div key={report.reportCode} className="report-glass-card">
              <div className="report-info">
                <h2>{report.name}</h2>
                <p>{report.description}</p>
              </div>
              <button
                className="generate-btn"
                onClick={() => handleGenerate(report.name)} // ✅ ONLY CHANGE
              >
                Open Report
              </button>
            </div>
          ))
        )}
      </div>
    </div>
    </div>
  );
}
