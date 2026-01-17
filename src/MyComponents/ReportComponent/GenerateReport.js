import React, { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import "../../Styles/Report/GenerateReport.css";
import { VmsEntity } from "../Enums/VmsEntity.js";

export default function GenerateReport() {
  const location = useLocation();
  const { moduleId, reportName, filters: initialFilters } = location.state || {};

  const [fields, setFields] = useState([]);       // display headers
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState([]); // actual data rows
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalInvoice, setModalInvoice] = useState(null);
  const tableRef = useRef(null);

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
      payload[key] = initialFilters[key] && initialFilters[key].trim() !== "" ? initialFilters[key] : null;
    });

    payload.page = page;
    payload.pageSize = pageSize;

    let apiUrl = "";
    switch (moduleId) {
      case VmsEntity.Vendor: apiUrl = "http://localhost:8080/api/Vendor/GetVendorReport"; break;
      case VmsEntity.ProductType: apiUrl = "http://localhost:8080/api/ProductType/GetProductTypeReport"; break;
      case VmsEntity.Product: apiUrl = "http://localhost:8080/api/Product/GetProductReport"; break;
      case VmsEntity.Inventory: apiUrl = "http://localhost:8080/api/Inventory/GetInventoryReport"; break;
      case VmsEntity.Sales: apiUrl = "http://localhost:8080/api/Sales/GetSaleReport"; break;
      case VmsEntity.Roles: apiUrl = "http://localhost:8080/api/Roles/GetRoleReport"; break;
      case VmsEntity.Reports: apiUrl = "http://localhost:8080/api/Reports/GetReportData"; break;
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
        if (d.status === 200) setReportData(d.data);
      });
  }, [moduleId, initialFilters, page, pageSize]);

  /* =========================
     RESIZER LOGIC
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

  if (!moduleId) {
    return (
      <div className="r-container">
        <p className="gen-error-text">
          Module information missing. Please go back and generate the report again.
        </p>
      </div>
    );
  }

  /* =========================
     DYNAMIC KEY HELPER
     Converts header labels to camelCase for API keys
  ========================= */
  const toCamelCase = (str) => {
    return str
      .replace(/\s(.)/g, (_, g) => g.toUpperCase())
      .replace(/\s/g, "")
      .replace(/^(.)/, (_, g) => g.toLowerCase())
      .replace(/[()₹]/g, ""); // remove special chars
  };

  /* =========================
     GROUP DATA BY INVOICE NUMBER
  ========================= */
  const invoiceMap = new Map();
  let lastInvoiceKey = null;

  reportData.forEach((row) => {
    let invoiceKey = row.invoiceNumber || lastInvoiceKey;
    if (!invoiceKey) invoiceKey = `null-${Math.random()}`; // for first null row
    lastInvoiceKey = row.invoiceNumber || lastInvoiceKey;

    if (!invoiceMap.has(invoiceKey)) {
      invoiceMap.set(invoiceKey, []);
    }
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

      {loading ? (
        <p className="gen-loading-text">Loading columns...</p>
      ) : (
        <>
          <div className={`gen-table-wrapper ${modalInvoice ? "blurred" : ""}`} ref={tableRef}>
            <div className="gen-table">
              {/* Header */}
              <div className="gen-table-header-row">
                {fields.map((field, i) => (
                  <div key={i} className="gen-table-header-cell" style={{ width: "170px" }}>
                    {field}
                  </div>
                ))}
              </div>

              {/* Body */}
              {paginatedKeys.length ? (
                paginatedKeys.map((key, gIndex) => {
                  const items = invoiceMap.get(key);
                  const hasMultiple = items.length > 1;
                  const invoiceNumber = items[0].invoiceNumber || "—";

                  return (
                    <React.Fragment key={gIndex}>
                      {/* Invoice Row */}
                      <div
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
                              {fIndex === 0 && hasMultiple
                                ? <>
                                    {items[0][keyField] ?? "—"}
                                    <span style={{ marginLeft: "auto" }}>▾</span>
                                  </>
                                : items[0][keyField] ?? "—"}
                            </div>
                          );
                        })}
                      </div>
                    </React.Fragment>
                  );
                })
              ) : (
                <div className="gen-table-body-row">
                  {fields.map((_, i) => (
                    <div key={i} className="gen-table-body-cell" style={{ width: "150px" }}>—</div>
                  ))}
                </div>
              )}
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

          {/* Modal Popup for multiple items */}
          {modalInvoice && (
            <div className="gen-modal-overlay">
              <div className="gen-modal-content">
                <h3>Invoice: {modalInvoice[0].invoiceNumber || "—"}</h3>
                <table className="gen-modal-table">
                  <thead>
                    <tr>{fields.map((field, i) => <th key={i}>{field}</th>)}</tr>
                  </thead>
                  <tbody>
                    {modalInvoice.map((row, i) => (
                      <tr key={i}>
                        {fields.map((field, j) => {
                          const keyField = toCamelCase(field);
                          return <td key={j}>{row[keyField] ?? "—"}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button className="gen-modal-close" onClick={closeModal}>Close</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
