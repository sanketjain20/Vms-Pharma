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
  FAILED: { label: "Failed", tone: "danger" },
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status];
  return <span className={`gst-badge gst-badge--${meta?.tone || "slate"}`}>{meta?.label || status || "—"}</span>;
}

const fmtMoney = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleString() : "—");

export default function EInvoice() {
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
    apiClient(`${API_BASE_URL}/api/EInvoice/GetAll/${page}/25?${params.toString()}`, { method: "GET" })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 200) {
          setRows(data.data?.content || []);
          setTotalPages(data.data?.totalPages || 1);
          setTotalElements(data.data?.totalElements ?? (data.data?.content || []).length);
        }
      })
      .catch((err) => console.error("Failed to load e-invoices:", err));
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async (uKey) => {
    setBusyUKey(uKey);
    setMessage("");
    try {
      const res = await apiClient(`${API_BASE_URL}/api/EInvoice/GenerateIrn/${uKey}`, { method: "POST" });
      const result = await res.json();
      setMessage(result.message || (res.ok ? "IRN generated." : "Failed to generate IRN."));
      setMessageTone(res.ok ? "success" : "danger");
      load();
    } catch (err) {
      setMessage("Failed to generate IRN: " + err.message);
      setMessageTone("danger");
    } finally {
      setBusyUKey(null);
    }
  };

  const handleCancel = async (uKey) => {
    const remarks = window.prompt("Reason for cancelling this IRN (required):");
    if (!remarks) return;
    setBusyUKey(uKey);
    setMessage("");
    try {
      const res = await apiClient(`${API_BASE_URL}/api/EInvoice/CancelIrn/${uKey}`, {
        method: "POST",
        body: JSON.stringify({ cancelReasonCode: "3", remarks }),
      });
      const result = await res.json();
      setMessage(result.message || (res.ok ? "IRN cancelled." : "Failed to cancel IRN."));
      setMessageTone(res.ok ? "success" : "danger");
      load();
    } catch (err) {
      setMessage("Failed to cancel IRN: " + err.message);
      setMessageTone("danger");
    } finally {
      setBusyUKey(null);
    }
  };

  return (
    <div className="i-container">
      <h2 className="i-title">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h11l5 5v11a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1z" />
          <path d="M15 4v5h5" />
          <path d="M8 12h6M8 15.5h6M8 8.5h3" />
        </svg>
        E-Invoices (IRN)
      </h2>

      <div className="dg-panel gst-panel">
        <div className="dg-panel-body gst-body">
          <section className="gst-section">
            <div className="gst-section-head">
              <h3 className="gst-section-title">All e-invoiced sales</h3>
              <span className="gst-count">{totalElements} invoice{totalElements === 1 ? "" : "s"}</span>
            </div>

            <div className="gst-toolbar">
              <input
                className="gst-search"
                placeholder="Search by invoice no, IRN, or retailer…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              />
            </div>

            {message && <div className={`gst-alert gst-alert--${messageTone}`}>{message}</div>}

            <div className="gst-table-wrap" style={{ marginTop: 14 }}>
              <table className="gst-table">
                <thead>
                  <tr>
                    <th>Invoice No</th><th>Retailer</th><th>Net Amount</th><th>Status</th>
                    <th>IRN</th><th>Ack Date</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.salesUKey}>
                      <td className="gst-cell-strong">{r.invoiceNumber}</td>
                      <td>{r.retailerName || "—"}</td>
                      <td>{fmtMoney(r.netAmount)}</td>
                      <td><StatusBadge status={r.irnStatus} /></td>
                      <td className="gst-cell-mono" title={r.irn || r.irpError || ""}>
                        {r.irn ? `${r.irn.slice(0, 16)}…` : (r.irpError ? "Failed" : "—")}
                      </td>
                      <td className="gst-cell-muted">{fmtDate(r.ackDate)}</td>
                      <td className="gst-actions">
                        {(r.irnStatus === "PENDING" || r.irnStatus === "FAILED") && (
                          <button className="gst-btn gst-btn--sm" disabled={busyUKey === r.salesUKey} onClick={() => handleGenerate(r.salesUKey)}>
                            {busyUKey === r.salesUKey ? "Working…" : "Generate"}
                          </button>
                        )}
                        {r.irnStatus === "GENERATED" && r.cancellable && (
                          <button className="gst-btn gst-btn--sm gst-btn--danger" disabled={busyUKey === r.salesUKey} onClick={() => handleCancel(r.salesUKey)}>
                            {busyUKey === r.salesUKey ? "Working…" : "Cancel"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr><td colSpan={7} className="gst-empty">No e-invoiced sales yet.</td></tr>
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
