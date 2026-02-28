import React, { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import "../../Styles/Report/GenerateReport.css";
import { ReportEntity } from "../Enums/ReportEntity.js";

export default function GenerateReport() {
  const location = useLocation();
  const { moduleId, reportName, filters: initialFilters } = location.state || {};

  const [fields, setFields] = useState([]);       // display headers
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState([]); // actual data rows
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalInvoice, setModalInvoice] = useState(null);
  const [summary, setSummary] = useState(null);


  const tableRef = useRef(null);
  const modalTableRef = useRef(null); // ✅ ADDED

  /* =========================
     FETCH FIELD NAMES
  ========================= */
  useEffect(() => {
    if (!moduleId) return;

    fetch(`http://localhost:8080/api/Reports/GetFieldByModuleId/${moduleId}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.status === 200) setFields(d.data);
        setLoading(false);
      });
  }, [moduleId]);

  /* =========================
     FETCH REPORT DATA
  ========================= */
  useEffect(() => {
    if (!moduleId || !initialFilters) return;

    const payload = {};
    Object.keys(initialFilters).forEach((key) => {
      payload[key] =
        initialFilters[key] && initialFilters[key].trim() !== ""
          ? initialFilters[key]
          : null;
    });

    payload.page = page;
    payload.pageSize = pageSize;

    let apiUrl = "";
    switch (moduleId) {
      case ReportEntity.Vendor: apiUrl = "http://localhost:8080/api/Vendor/GetVendorReport"; break;
      case ReportEntity.ProductType: apiUrl = "http://localhost:8080/api/ProductType/GetProductTypeReport"; break;
      case ReportEntity.Product: apiUrl = "http://localhost:8080/api/Product/GetProductReport"; break;
      case ReportEntity.Inventory: apiUrl = "http://localhost:8080/api/Inventory/GetInventoryReport"; break;
      case ReportEntity.Sales: apiUrl = "http://localhost:8080/api/Sales/GetSaleReport"; break;
      case ReportEntity.Roles: apiUrl = "http://localhost:8080/api/Roles/GetRoleReport"; break;
      case ReportEntity.Reports: apiUrl = "http://localhost:8080/api/Reports/GetReportData"; break;
      case ReportEntity.Revenue : apiUrl = "http://localhost:8080/api/Reports/RevenueReportData"; break;
      case ReportEntity.StockMovement : apiUrl = "http://localhost:8080/api/Inventory/GetInvMovementReport"; break;
      default: apiUrl = ""; break;
    }

    if (!apiUrl) return;

    fetch(apiUrl, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .then((d) => {
  if (d.status !== 200) return;

  // 🟡 Revenue special handling
  if (moduleId === ReportEntity.Revenue) {
    setSummary(d.data.summaryDto);
    setReportData(d.data.revenueDto || []);
  } else {
    setReportData(d.data);
  }
});
  }, [moduleId, initialFilters, page, pageSize]);

  /* =========================
     RESIZER LOGIC (MAIN TABLE)
  ========================= */
  useEffect(() => {
    if (!tableRef.current) return;

    const headers = tableRef.current.querySelectorAll(".gen-table-header-cell");

    headers.forEach((header, index) => {
      const resizer = document.createElement("div");
      resizer.className = "resizer";
      header.appendChild(resizer);

      let startX, startWidth;

      const onMouseMove = (e) => {
        const newWidth = startWidth + (e.pageX - startX);
        header.style.width = newWidth + "px";

        const bodyCells = tableRef.current.querySelectorAll(
          `.gen-table-body-cell:nth-child(${index + 1})`
        );
        bodyCells.forEach((cell) => (cell.style.width = newWidth + "px"));
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      resizer.addEventListener("mousedown", (e) => {
        e.preventDefault();
        startX = e.pageX;
        startWidth = header.offsetWidth;
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
      });
    });
  }, [fields, reportData]);

  /* =========================
     RESIZER LOGIC (MODAL TABLE)
     ✅ ADDED — DOES NOT TOUCH EXISTING CODE
  ========================= */
  useEffect(() => {
    if (!modalInvoice || !modalTableRef.current) return;

    const headers = modalTableRef.current.querySelectorAll(".gen-table-header-cell");

    headers.forEach((header, index) => {
      const resizer = document.createElement("div");
      resizer.className = "resizer";
      header.appendChild(resizer);

      let startX, startWidth;

      const onMouseMove = (e) => {
        const newWidth = startWidth + (e.pageX - startX);
        header.style.width = newWidth + "px";

        const bodyCells = modalTableRef.current.querySelectorAll(
          `.gen-table-body-cell:nth-child(${index + 1})`
        );
        bodyCells.forEach((cell) => (cell.style.width = newWidth + "px"));
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      resizer.addEventListener("mousedown", (e) => {
        e.preventDefault();
        startX = e.pageX;
        startWidth = header.offsetWidth;
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
      });
    });
  }, [modalInvoice, fields]);

  if (!moduleId) {
    return (
      <div className="r-container">
        <p className="gen-error-text">
          Module information missing. Please go back and generate the report again.
        </p>
      </div>
    );
  }

  const toCamelCase = (str) => {
    return str
      .replace(/\s(.)/g, (_, g) => g.toUpperCase())
      .replace(/\s/g, "")
      .replace(/^(.)/, (_, g) => g.toLowerCase())
      .replace(/[()₹]/g, "");
  };

  const invoiceMap = new Map();
  let lastInvoiceKey = null;

  reportData.forEach((row) => {
    let invoiceKey = row.invoiceNumber || lastInvoiceKey;
    if (!invoiceKey) invoiceKey = `null-${Math.random()}`;
    lastInvoiceKey = row.invoiceNumber || lastInvoiceKey;

    if (!invoiceMap.has(invoiceKey)) invoiceMap.set(invoiceKey, []);
    invoiceMap.get(invoiceKey).push(row);
  });

  const invoiceKeys = Array.from(invoiceMap.keys());
  const totalPages = Math.ceil(invoiceKeys.length / pageSize);
  const paginatedKeys = invoiceKeys.slice((page - 1) * pageSize, page * pageSize);

  const openModal = (invoiceItems) => setModalInvoice(invoiceItems);
  const closeModal = () => setModalInvoice(null);

  return (
    <div className="r-container">
      <h1 className="gen-report-title">{reportName}</h1>
{moduleId === ReportEntity.Revenue && summary && (
  <div className="rev-summary">
    <div className="rev-card">Revenue(₹): {summary.totalRevenue}</div>
    <div className="rev-card">Profit(₹): {summary.totalProfit}</div>
    <div className="rev-card">Discount(₹): {summary.totalDiscount}</div>
    <div className="rev-card">Tax(₹): {summary.totalTax}</div>
    <div className="rev-card">Net Profit(₹): {summary.netProfit}</div>
    <div className="rev-card">Profit Margin: {summary.profitMargin}%</div>
    <div className="rev-card">Net Margin: {summary.netProfitMargin}%</div>
  </div>
)}

      {loading ? (
        <p className="gen-loading-text">Loading columns...</p>
      ) : (
        <>
          <div className={`gen-table-wrapper ${modalInvoice ? "blurred" : ""}`} ref={tableRef}>
            <div className="gen-table">
              <div className="gen-table-header-row">
                {fields.map((field, i) => (
                  <div key={i} className="gen-table-header-cell" style={{ width: "170px" }}>
                    {field}
                  </div>
                ))}
              </div>

              {paginatedKeys.length ? (
                paginatedKeys.map((key, gIndex) => {
                  const items = invoiceMap.get(key);
                  const hasMultiple = items.length > 1;

                  return (
                    <div
                      key={gIndex}
                      className="gen-table-body-row invoice-row"
                      style={{ fontWeight: "bold", cursor: hasMultiple ? "pointer" : "default" }}
                      onClick={() => hasMultiple && openModal(items)}
                    >
                      {fields.map((field, fIndex) => {
                        const keyField = toCamelCase(field);
                        return (
                          <div
                            key={fIndex}
                            className="gen-table-body-cell"
                            style={{
                              width: "170px",
                              display: fIndex === 0 && hasMultiple ? "flex" : undefined,
                              justifyContent: fIndex === 0 && hasMultiple ? "space-between" : undefined,
                            }}
                          >
                            {items[0][keyField] ?? "—"}
                            {fIndex === 0 && hasMultiple && <span>▾</span>}
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              ) : null}
            </div>
          </div>

          {/* Pagination Controls */}
          <div className="gen-pagination">
            <button disabled={page === 1} onClick={() => setPage((p) => Math.max(p - 1, 1))}>← Previous</button>
            <span>Page {page} of {totalPages || 1}</span>
            <button disabled={page === totalPages || totalPages === 0} onClick={() => setPage((p) => Math.min(p + 1, totalPages))}>Next →</button>
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
              {[5, 10, 20, 50].map((size) => (<option key={size} value={size}>{size} per page</option>))}
            </select>
          </div>
          {modalInvoice && (
            <div className="gen-modal-overlay">
              <div className="gen-modal-content">
                <h3>Invoice: {modalInvoice[0].invoiceNumber || "—"}</h3>

                <div className="gen-table-wrapper" ref={modalTableRef}>
                  <div className="gen-table">
                    <div className="gen-table-header-row">
                      {fields.map((field, i) => (
                        <div key={i} className="gen-table-header-cell" style={{ width: "170px" }}>
                          {field}
                        </div>
                      ))}
                    </div>

                    {modalInvoice.map((row, rIndex) => (
                      <div key={rIndex} className="gen-table-body-row">
                        {fields.map((field, cIndex) => {
                          const keyField = toCamelCase(field);
                          return (
                            <div
                              key={cIndex}
                              className="gen-table-body-cell"
                              style={{ width: "170px" }}
                            >
                              {row[keyField] ?? "—"}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                <button className="gen-modal-close" onClick={closeModal}>
                  Close
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
