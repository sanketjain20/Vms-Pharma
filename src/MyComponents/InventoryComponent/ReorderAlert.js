import React, { useEffect, useMemo, useState } from "react";
import "../../Styles/Inventory/ExpiryAlert.css";
import API_BASE_URL from "../../Config/api.config";
const API_URL = `${API_BASE_URL}/api/Inventory/ReorderAlerts`;

const fmtNumber = (value) => {
  const number = Number(value);
  if (Number.isNaN(number)) return value ?? "-";
  return number.toLocaleString("en-IN");
};

const unwrapPayload = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.data?.content)) return payload.data.content;
  if (payload?.data && typeof payload.data === "object") {
    return Object.values(payload.data).flatMap((value) => (Array.isArray(value) ? value : []));
  }
  return [];
};

const normalizeAlert = (row) => {
  const currentStock =
    row.currentStock ??
    row.availableQuantity ??
    row.currentQuantity ??
    row.quantity ??
    row.qty ??
    row.stock ??
    0;
  const reorderLevel =
    row.reorderLevel ??
    row.reorderPoint ??
    row.minimumStock ??
    row.minStock ??
    row.threshold ??
    0;
  const shortage =
    row.shortage ??
    row.requiredQuantity ??
    row.reorderQuantity ??
    Math.max(Number(reorderLevel || 0) - Number(currentStock || 0), 0);

  return {
    ...row,
    productName: row.productName || row.product || row.itemName || "-",
    productCode: row.productCode || row.inventoryCode || row.itemCode || "",
    currentStock,
    reorderLevel,
    shortage,
    supplierName: row.supplierName || row.supplier || row.vendorName || "-",
    unit: row.unit || row.uom || row.packSize || "",
  };
};

const statusFor = (row) => {
  const stock = Number(row.currentStock || 0);
  const level = Number(row.reorderLevel || 0);

  if (stock <= 0) return { label: "Out Of Stock", className: "expired" };
  if (stock <= level * 0.5) return { label: "Critical", className: "critical" };
  return { label: "Reorder", className: "warning" };
};

export default function ReorderAlert() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchText, setSearchText] = useState("");

  const loadAlerts = () => {
    setLoading(true);
    setError("");

    fetch(API_URL, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then(async (res) => {
        const payload = await res.json().catch(() => null);
        if (!res.ok) throw new Error(payload?.message || `HTTP ${res.status}`);
        return payload;
      })
      .then((payload) => {
        const nextRows = unwrapPayload(payload)
          .map(normalizeAlert)
          .filter((row) => Number(row.currentStock || 0) <= Number(row.reorderLevel || 0));
        setRows(nextRows);
      })
      .catch((err) => {
        setRows([]);
        setError(err.message || "Failed to load reorder alerts.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const buckets = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        const stock = Number(row.currentStock || 0);
        const level = Number(row.reorderLevel || 0);
        if (stock <= 0) acc.out.push(row);
        else if (stock <= level * 0.5) acc.critical.push(row);
        else acc.reorder.push(row);
        return acc;
      },
      { all: rows, out: [], critical: [], reorder: [] }
    );
  }, [rows]);

  const filteredRows = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    const filterRows = activeFilter === "all" ? rows : buckets[activeFilter] || [];
    if (!term) return filterRows;

    return filterRows.filter((row) =>
      [row.productName, row.productCode, row.supplierName, row.unit].some((value) =>
        String(value || "").toLowerCase().includes(term)
      )
    );
  }, [activeFilter, buckets, rows, searchText]);

  return (
    <div className="ea-root">
      <div className="ea-header">
        <div>
          <div className="ea-badge"><span /> Inventory Control</div>
          <h1 className="ea-title"><span></span> Reorder Alerts</h1>
          <p className="ea-subtitle">Products at or below reorder level from live inventory stock.</p>
        </div>
        <button className="ea-refresh" onClick={loadAlerts} disabled={loading}>
          {loading ? "Refreshing" : "Refresh"}
        </button>
      </div>

      <div className="ea-summary">
        <button className={`ea-card ${activeFilter === "all" ? "active" : ""}`} onClick={() => setActiveFilter("all")}>
          <span className="ea-card-label">All Alerts</span>
          <strong>{rows.length}</strong>
          <span className="ea-card-note">Needs reorder</span>
        </button>
        <button className={`ea-card ea-card-expired ${activeFilter === "out" ? "active" : ""}`} onClick={() => setActiveFilter("out")}>
          <span className="ea-card-label">Out Of Stock</span>
          <strong>{buckets.out.length}</strong>
          <span className="ea-card-note">Immediate purchase</span>
        </button>
        <button className={`ea-card ${activeFilter === "critical" ? "active" : ""}`} style={{ "--ea-card-color": "#ef4444" }} onClick={() => setActiveFilter("critical")}>
          <span className="ea-card-label">Critical</span>
          <strong>{buckets.critical.length}</strong>
          <span className="ea-card-note">Below half level</span>
        </button>
        <button className={`ea-card ${activeFilter === "reorder" ? "active" : ""}`} style={{ "--ea-card-color": "#f59e0b" }} onClick={() => setActiveFilter("reorder")}>
          <span className="ea-card-label">Reorder</span>
          <strong>{buckets.reorder.length}</strong>
          <span className="ea-card-note">Below threshold</span>
        </button>
      </div>

      <div className="ea-panel">
        <div className="ea-toolbar">
          <div>
            <span className="ea-panel-kicker">{rows.length} low stock alerts</span>
            <h2>Low Stock Products</h2>
          </div>
          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search product, code, supplier"
          />
        </div>

        {loading && <div className="ea-state">Loading reorder alerts...</div>}
        {!loading && error && <div className="ea-state ea-error">{error}</div>}
        {!loading && !error && filteredRows.length === 0 && (
          <div className="ea-state">No low stock products found.</div>
        )}

        {!loading && !error && filteredRows.length > 0 && (
          <div className="ea-table-wrap">
            <table className="ea-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Current Stock</th>
                  <th>Reorder Level</th>
                  <th>Shortage</th>
                  <th>Unit</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => {
                  const status = statusFor(row);
                  return (
                    <tr key={row.inventoryId || row.productId || row.uKey || `${row.productName}-${index}`}>
                      <td>
                        <div className="ea-product">
                          <strong>{row.productName}</strong>
                          {row.productCode && <span>{row.productCode}</span>}
                        </div>
                      </td>
                      <td className={Number(row.currentStock || 0) <= 0 ? "ea-negative" : ""}>
                        {fmtNumber(row.currentStock)}
                      </td>
                      <td>{fmtNumber(row.reorderLevel)}</td>
                      <td>{fmtNumber(row.shortage)}</td>
                      <td>{row.unit || "-"}</td>
                      <td><span className={`ea-status ${status.className}`}>{status.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
