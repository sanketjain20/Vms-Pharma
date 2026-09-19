import React, { useEffect, useState, useCallback } from "react";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import "../../Styles/Inventory.css";
import "../../Styles/DynamicGrid.css";
import "../../Styles/GstShared/GstListPage.css";

const STATUS_META = {
  PENDING: { label: "Pending", tone: "accent" },
  GENERATED: { label: "Generated", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
  EXPIRED: { label: "Expired", tone: "warning" },
  FAILED: { label: "Failed", tone: "danger" },
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status];
  return <span className={`gst-badge gst-badge--${meta?.tone || "slate"}`}>{meta?.label || status || "—"}</span>;
}

function SupplyTypeBadge({ type }) {
  if (type === "O") return <span className="gst-badge gst-badge--accent">Outward (Sales)</span>;
  if (type === "I") return <span className="gst-badge gst-badge--slate">Inward (Purchase)</span>;
  return <span className="gst-badge gst-badge--slate">{type || "—"}</span>;
}

const fmtDate = (d) => (d ? new Date(d).toLocaleString() : "—");

export default function EwayBill() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [busyUKey, setBusyUKey] = useState(null);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState("info");

  const load = useCallback(() => {
    const params = new URLSearchParams({ page, size: 25 });
    if (search) params.set("search", search);
    apiClient(`${API_BASE_URL}/api/EwayBill/GetAll/${page}/25?${params.toString()}`, { method: "GET" })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 200) {
          setRows(data.data?.content || []);
          setTotalPages(data.data?.totalPages || 1);
          setTotalElements(data.data?.totalElements ?? (data.data?.content || []).length);
        }
      })
      .catch((err) => console.error("Failed to load e-way bills:", err));
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const handleCancel = async (uKey) => {
    const remarks = window.prompt("Reason for cancelling this e-way bill (required):");
    if (!remarks) return;
    setBusyUKey(uKey);
    setMessage("");
    try {
      const res = await apiClient(`${API_BASE_URL}/api/EwayBill/Cancel/${uKey}`, {
        method: "POST",
        body: JSON.stringify({ cancelReasonCode: "3", remarks }),
      });
      const result = await res.json();
      setMessage(result.message || (res.ok ? "E-way bill cancelled." : "Failed to cancel."));
      setMessageTone(res.ok ? "success" : "danger");
      load();
    } catch (err) {
      setMessage("Failed to cancel: " + err.message);
      setMessageTone("danger");
    } finally {
      setBusyUKey(null);
    }
  };

  const handleExtend = async (uKey) => {
    const remainingDistanceKm = window.prompt("Remaining distance to travel (km):", "50");
    if (!remainingDistanceKm) return;
    const currentPincode = window.prompt("Current location PIN code (optional):", "");
    setBusyUKey(uKey);
    setMessage("");
    try {
      const res = await apiClient(`${API_BASE_URL}/api/EwayBill/Extend/${uKey}`, {
        method: "POST",
        body: JSON.stringify({ remainingDistanceKm: Number(remainingDistanceKm), currentPincode: currentPincode || null }),
      });
      const result = await res.json();
      setMessage(result.message || (res.ok ? "Validity extended." : "Failed to extend."));
      setMessageTone(res.ok ? "success" : "danger");
      load();
    } catch (err) {
      setMessage("Failed to extend: " + err.message);
      setMessageTone("danger");
    } finally {
      setBusyUKey(null);
    }
  };

  return (
    <div className="i-container">
      <h2 className="i-title">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="14" height="10" rx="1.5" />
          <path d="M16 10h3.5l2.5 3v4H16z" />
          <circle cx="7" cy="19" r="1.6" />
          <circle cx="17.5" cy="19" r="1.6" />
        </svg>
        E-Way Bills
      </h2>

      <div className="dg-panel gst-panel">
        <div className="dg-panel-body gst-body">
          <section className="gst-section">
            <div className="gst-section-head">
              <h3 className="gst-section-title">All generated e-way bills</h3>
              <span className="gst-count">{totalElements} bill{totalElements === 1 ? "" : "s"}</span>
            </div>

            <div className="gst-toolbar">
              <input
                className="gst-search"
                placeholder="Search by e-way bill no or document no…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              />
            </div>

            {message && <div className={`gst-alert gst-alert--${messageTone}`}>{message}</div>}

            <div className="gst-table-wrap" style={{ marginTop: 14 }}>
              <table className="gst-table">
                <thead>
                  <tr>
                    <th>E-Way Bill No</th><th>Type</th><th>Doc No</th><th>From → To GSTIN</th>
                    <th>Distance</th><th>Status</th><th>Valid Upto</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.uKey}>
                      <td className="gst-cell-mono gst-cell-strong">{r.ewayBillNo || "—"}</td>
                      <td><SupplyTypeBadge type={r.supplyType} /></td>
                      <td>{r.docNo}</td>
                      <td className="gst-cell-mono">{r.fromGstin || "URP"} → {r.toGstin || "URP"}</td>
                      <td>{r.transportDistanceKm != null ? `${r.transportDistanceKm} km` : "—"}</td>
                      <td>
                        <StatusBadge status={r.status} />
                        {r.errorMessage && <div className="gst-cell-muted" title={r.errorMessage}>⚠ {r.errorMessage}</div>}
                      </td>
                      <td className="gst-cell-muted">{fmtDate(r.validUpto)}</td>
                      <td className="gst-actions">
                        {r.status === "GENERATED" && r.extendable && (
                          <button className="gst-btn gst-btn--sm" disabled={busyUKey === r.uKey} onClick={() => handleExtend(r.uKey)}>
                            {busyUKey === r.uKey ? "Working…" : "Extend"}
                          </button>
                        )}
                        {r.status === "GENERATED" && r.cancellable && (
                          <button className="gst-btn gst-btn--sm gst-btn--danger" disabled={busyUKey === r.uKey} onClick={() => handleCancel(r.uKey)}>
                            {busyUKey === r.uKey ? "Working…" : "Cancel"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr><td colSpan={8} className="gst-empty">No e-way bills generated yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="gst-pager">
              <button className="gst-btn gst-btn--sm gst-btn--ghost" disabled={page <= 0} onClick={() => setPage((p) => p - 1)}>Prev</button>
              <span className="gst-pager-info">{page + 1} / {totalPages}</span>
              <button className="gst-btn gst-btn--sm gst-btn--ghost" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
