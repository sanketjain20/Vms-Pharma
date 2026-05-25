import React, { useEffect, useMemo, useState } from "react";
import "../../Styles/Inventory/ExpiryAlert.css";

const API_URL = "http://localhost:8080/api/Inventory/ExpiryAlerts";

const WINDOWS = [
  { key: "30", label: "30 Days", maxDays: 30, color: "#dd6c2a" },
  { key: "60", label: "60 Days", maxDays: 60, color: "#dad611" },
  { key: "90", label: "90 Days", maxDays: 90, color: "#3b82f6" },
];

const fmtDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const daysUntil = (value) => {
  if (!value) return null;
  const expiry = new Date(value);
  if (Number.isNaN(expiry.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);

  return Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
};

const unwrapPayload = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.data?.content)) return payload.data.content;
  if (payload?.data && typeof payload.data === "object") {
    return Object.values(payload.data).flatMap((value) => Array.isArray(value) ? value : []);
  }
  return [];
};

const normalizeBatch = (row) => {
  const expiryDate = row.expiryDate || row.expiryDateSnapshot || row.expDate || row.expiry;
  const remainingDays = row.daysToExpiry ?? row.daysUntilExpiry ?? row.remainingDays ?? daysUntil(expiryDate);

  return {
    ...row,
    expiryDate,
    remainingDays,
    productName: row.productName || row.product || row.itemName || "-",
    productCode: row.productCode || row.inventoryCode || row.itemCode || "",
    batchNumber: row.batchNumber || row.batchNo || row.batchCode || "-",
    quantity: row.availableQuantity ?? row.currentQuantity ?? row.quantity ?? row.qty ?? 0,
    supplierName: row.supplierName || row.supplier || row.vendorName || "-",
  };
};

const getWindowKey = (days) => {
  if (days == null) return null;
  if (days < 0) return "expired";
  if (days <= 30) return "30";
  if (days <= 60) return "60";
  if (days <= 90) return "90";
  return null;
};

const statusFor = (days) => {
  if (days == null) return { label: "Unknown", className: "unknown" };
  if (days < 0) return { label: "Expired", className: "expired" };
  if (days <= 30) return { label: "Critical", className: "critical" };
  if (days <= 60) return { label: "Warning", className: "warning" };
  return { label: "Watch", className: "watch" };
};

export default function ExpiryAlert() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeWindow, setActiveWindow] = useState("30");
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
          .map(normalizeBatch)
          .filter((row) => getWindowKey(row.remainingDays));
        setRows(nextRows);
      })
      .catch((err) => {
        setRows([]);
        setError(err.message || "Failed to load expiry alerts.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const buckets = useMemo(() => {
    return rows.reduce((acc, row) => {
      const key = getWindowKey(row.remainingDays);
      if (!key) return acc;
      if (!acc[key]) acc[key] = [];
      acc[key].push(row);
      return acc;
    }, { expired: [], 30: [], 60: [], 90: [] });
  }, [rows]);

  const filteredRows = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    const windowRows = buckets[activeWindow] || [];
    if (!term) return windowRows;

    return windowRows.filter((row) => [
      row.productName,
      row.productCode,
      row.batchNumber,
      row.supplierName,
    ].some((value) => String(value || "").toLowerCase().includes(term)));
  }, [activeWindow, buckets, searchText]);

  const totalActiveAlerts = WINDOWS.reduce((sum, item) => sum + (buckets[item.key]?.length || 0), 0);

  return (
    <div className="ea-root">
      <div className="ea-header">
        <div>
          <div className="ea-badge"><span /> Pharma Compliance</div>
          <h1 className="ea-title"><span></span> Expiry Alerts</h1>
          <p className="ea-subtitle">Batch-wise inventory expiring within 30, 60 and 90 days.</p>
        </div>
        <button className="ea-refresh" onClick={loadAlerts} disabled={loading}>
          {loading ? "Refreshing" : "Refresh"}
        </button>
      </div>

      <div className="ea-summary">
        <button
          className={`ea-card ea-card-expired ${activeWindow === "expired" ? "active" : ""}`}
          onClick={() => setActiveWindow("expired")}
        >
          <span className="ea-card-label">Expired</span>
          <strong>{buckets.expired?.length || 0}</strong>
          <span className="ea-card-note">Immediate action</span>
        </button>

        {WINDOWS.map((item) => (
          <button
            key={item.key}
            className={`ea-card ${activeWindow === item.key ? "active" : ""}`}
            style={{ "--ea-card-color": item.color }}
            onClick={() => setActiveWindow(item.key)}
          >
            <span className="ea-card-label">{item.label}</span>
            <strong>{buckets[item.key]?.length || 0}</strong>
            <span className="ea-card-note">Expiring batches</span>
          </button>
        ))}
      </div>

      <div className="ea-panel">
        <div className="ea-toolbar">
          <div>
            <span className="ea-panel-kicker">{totalActiveAlerts} active alerts</span>
            <h2>{activeWindow === "expired" ? "Expired Batches" : `Expiring In ${activeWindow} Days`}</h2>
          </div>
          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search product, batch, supplier"
          />
        </div>

        {loading && <div className="ea-state">Loading expiry alerts...</div>}
        {!loading && error && <div className="ea-state ea-error">{error}</div>}
        {!loading && !error && filteredRows.length === 0 && (
          <div className="ea-state">No batches found for this window.</div>
        )}

        {!loading && !error && filteredRows.length > 0 && (
          <div className="ea-table-wrap">
            <table className="ea-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Batch No</th>
                  <th>Expiry Date</th>
                  <th>Days Left</th>
                  <th>Qty</th>
                  <th>Supplier</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => {
                  const status = statusFor(row.remainingDays);
                  return (
                    <tr key={row.batchId || row.uKey || `${row.batchNumber}-${index}`}>
                      <td>
                        <div className="ea-product">
                          <strong>{row.productName}</strong>
                          {row.productCode && <span>{row.productCode}</span>}
                        </div>
                      </td>
                      <td><span className="ea-batch">{row.batchNumber}</span></td>
                      <td>{fmtDate(row.expiryDate)}</td>
                      <td className={row.remainingDays < 0 ? "ea-negative" : ""}>
                        {row.remainingDays == null ? "-" : row.remainingDays}
                      </td>
                      <td>{row.quantity}</td>
                      <td>{row.supplierName}</td>
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
