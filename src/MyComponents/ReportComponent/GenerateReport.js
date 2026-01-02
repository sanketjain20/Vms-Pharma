import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { VmsEntity } from "../Enums/VmsEntity.js";
import { runReportByModule } from "./ReportService.js";
import "../../Styles/Report/GenerateReport.css";

/* =========================
   UTILS
========================= */
function toCamelCase(str) {
  return str
    .replace(/\s(.)/g, (_, g) => g.toUpperCase())
    .replace(/\s/g, "")
    .replace(/^(.)/, (_, g) => g.toLowerCase());
}

function getModuleIdByReportName(reportName) {
  if (!reportName) return null;
  const name = reportName.toLowerCase();

  if (name.includes("vendor")) return VmsEntity.Vendor;
  if (name.includes("producttype")) return VmsEntity.ProductType;
  if (name.includes("product")) return VmsEntity.Product;
  if (name.includes("inventory")) return VmsEntity.Inventory;
  if (name.includes("sales")) return VmsEntity.Sales;
  if (name.includes("role")) return VmsEntity.Roles;
  if (name.includes("report")) return VmsEntity.Reports;

  return null;
}

/* =========================
   CUSTOM DROPDOWN
========================= */
function Dropdown({
  label,
  options,
  value,
  isOpen,
  dropdownKey,
  setOpenKey,
  onChange
}) {
  const ref = useRef();
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpenKey(null);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [setOpenKey]);

  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="custom-dropdown" ref={ref}>
      <div
        className="dropdown-selected"
        onClick={(e) => {
          e.stopPropagation();
          setOpenKey(isOpen ? null : dropdownKey);
        }}
      >
        {value || `Select ${label}`}
        <span className="dropdown-arrow">▾</span>
      </div>

      {isOpen && (
        <div className="dropdown-menu">
          <input
            type="text"
            placeholder={`Search ${label}...`}
            value={searchTerm}
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="dropdown-search"
          />

          <div
            className="dropdown-item clear"
            onMouseDown={(e) => {
              e.stopPropagation();
              onChange("");
              setSearchTerm("");
              setOpenKey(null);
            }}
          >
            Clear
          </div>

          {filteredOptions.map((opt, i) => (
            <div
              key={i}
              className="dropdown-item"
              onMouseDown={(e) => {
                e.stopPropagation();
                onChange(opt);
                setSearchTerm("");
                setOpenKey(null);
              }}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================
   MAIN COMPONENT
========================= */
export default function GenerateReport() {
  const location = useLocation();
  const navigate = useNavigate();
  const reportName = location.state?.reportName;

  const [filters, setFilters] = useState([]);
  const [filterOptions, setFilterOptions] = useState({});
  const [selectedFilters, setSelectedFilters] = useState({});
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);

  const [openKey, setOpenKey] = useState(null);

  const moduleId = getModuleIdByReportName(reportName);

  /* =========================
     FETCH FILTERS
  ========================= */
  useEffect(() => {
    if (!moduleId) return;

    fetch(
      `http://localhost:8080/api/Filters/GetFiltersByModule/${moduleId}`,
      { credentials: "include" }
    )
      .then((r) => r.json())
      .then((d) => {
        if (d.status === 200) setFilters(d.data);
        setLoading(false);
      });
  }, [moduleId]);

  /* =========================
     FETCH OPTIONS
  ========================= */
  useEffect(() => {
    const map = {
      [VmsEntity.Product]:
        "http://localhost:8080/api/Product/GetFilterData",
      [VmsEntity.ProductType]:
        "http://localhost:8080/api/ProductType/GetFilterData"
    };

    if (!map[moduleId]) return;

    fetch(map[moduleId], { credentials: "include" })
      .then((r) => r.json())
      .then((d) => d.status === 200 && setFilterOptions(d.data));
  }, [moduleId]);

  /* =========================
     FILTER CHANGE
  ========================= */
  const handleFilterChange = (name, val) => {
    const key = toCamelCase(name);

    setSelectedFilters((p) => {
      if (!val) {
        const copy = { ...p };
        delete copy[key];
        return copy;
      }
      return { ...p, [key]: val };
    });
  };

  /* =========================
     RUN REPORT
  ========================= */
  const handleRunReport = async () => {
    setReportLoading(true);
    const blob = await runReportByModule(moduleId, selectedFilters);

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportName}.xlsx`;
    a.click();

    URL.revokeObjectURL(url);
    setReportLoading(false);
  };

  /* =========================
     UI
  ========================= */
  return (
    <div className="r-container">
      <div className="gen-dashboard-container">
        <div className="gen-filters-section">
          {loading ? (
            <p>Loading...</p>
          ) : (
            filters.map((f, i) => {
              const key = toCamelCase(f);

              return (
                <div
                  key={i}
                  className={`gen-filter-item ${openKey === key ? "active" : ""
                    }`}
                >
                  <label>{f}</label>

                  {filterOptions[key] ? (
                    <Dropdown
                      label={f}
                      options={filterOptions[key]}
                      value={selectedFilters[key]}
                      isOpen={openKey === key}
                      dropdownKey={key}
                      setOpenKey={setOpenKey}
                      onChange={(v) => handleFilterChange(f, v)}
                    />
                  ) : (
                    <input
                      type={f.toLowerCase().includes("date") ? "date" : "text"}
                      value={
                        f.toLowerCase().includes("date") && selectedFilters[key]
                          ? selectedFilters[key].split("T")[0]
                          : selectedFilters[key] || ""
                      }
                      onChange={(e) =>
                        handleFilterChange(
                          f,
                          f.toLowerCase().includes("date") && e.target.value
                            ? `${e.target.value}T00:00:00`
                            : e.target.value
                        )
                      }
                    />


                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="gen-report-panel">
          <h1>{reportName}</h1>
          {reportLoading && <p>Generating Report...</p>}

          <div className="gen-report-buttons">
            <button
              className="gen-generate-btn"
              onClick={handleRunReport}
            >
              Download
            </button>

            <button
              className="gen-back-btn"
              onClick={() => navigate(-1)}
            >
              ← Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
