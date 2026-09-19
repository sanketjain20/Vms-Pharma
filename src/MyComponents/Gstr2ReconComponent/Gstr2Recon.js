import React, { useEffect, useState, useCallback } from "react";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import "../../Styles/Inventory.css";
import "../../Styles/DynamicGrid.css";
import "../../Styles/GstShared/GstListPage.css";

const STATUS_META = {
  EXACT_MATCH: { label: "Exact Match", tone: "success" },
  VALUE_MISMATCH: { label: "Value Mismatch", tone: "danger" },
  DATE_MISMATCH: { label: "Date Mismatch", tone: "warning" },
  TAX_SPLIT_MISMATCH: { label: "Tax Split Mismatch", tone: "warning" },
  DUPLICATE_IN_BOOKS: { label: "Duplicate In Books", tone: "danger" },
  DUPLICATE_IN_PORTAL: { label: "Duplicate In Portal", tone: "danger" },
  MISSING_IN_BOOKS: { label: "Missing In Books", tone: "danger" },
  MISSING_IN_PORTAL: { label: "Missing In Portal", tone: "danger" },
  ITC_INELIGIBLE: { label: "ITC Ineligible", tone: "warning" },
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status];
  return <span className={`gst-badge gst-badge--${meta?.tone || "slate"}`}>{meta?.label || status || "—"}</span>;
}

function ParseStatusBadge({ status, error }) {
  if (status === "PARSED") return <span className="gst-badge gst-badge--success">Parsed</span>;
  if (status === "PARSE_FAILED") return <span className="gst-badge gst-badge--danger" title={error}>Parse Failed</span>;
  return <span className="gst-badge gst-badge--slate">{status || "Pending"}</span>;
}

function ResolutionBadge({ status }) {
  if (status === "ACCEPTED") return <span className="gst-badge gst-badge--success">Accepted</span>;
  if (status === "REJECTED") return <span className="gst-badge gst-badge--danger">Rejected</span>;
  return <span className="gst-badge gst-badge--accent">Open</span>;
}

const fmtMoney = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleString() : "—");

export default function Gstr2Recon() {
  const [imports, setImports] = useState([]);
  const [returnType, setReturnType] = useState("GSTR2B");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState("info");

  const [activeRunUKey, setActiveRunUKey] = useState(null);
  const [runSummary, setRunSummary] = useState(null);
  const [results, setResults] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [running, setRunning] = useState(false);

  const loadImports = useCallback(() => {
    apiClient(`${API_BASE_URL}/api/Gstr2Recon/GetImports`, { method: "GET" })
      .then((res) => res.json())
      .then((data) => { if (data.status === 200) setImports(data.data || []); })
      .catch((err) => console.error("Failed to load GSTR-2 imports:", err));
  }, []);

  useEffect(() => { loadImports(); }, [loadImports]);

  const loadResults = useCallback((runUKey, status, pageNum) => {
    const params = new URLSearchParams({ page: pageNum, size: 25 });
    if (status) params.set("status", status);
    apiClient(`${API_BASE_URL}/api/Gstr2Recon/GetResults/${runUKey}?${params.toString()}`, { method: "GET" })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 200) {
          setResults(data.data?.content || []);
          setTotalPages(data.data?.totalPages || 1);
        }
      })
      .catch((err) => console.error("Failed to load reconciliation results:", err));
  }, []);

  useEffect(() => {
    if (activeRunUKey) loadResults(activeRunUKey, statusFilter, page);
  }, [activeRunUKey, statusFilter, page, loadResults]);

  const handleUpload = async () => {
    if (!file) { setMessage("Choose a file first."); setMessageTone("warning"); return; }
    setUploading(true);
    setMessage("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("returnType", returnType);
      const res = await apiClient(`${API_BASE_URL}/api/Gstr2Recon/Upload`, { method: "POST", body: formData });
      const result = await res.json();
      setMessage(result.message || (res.ok ? "Uploaded." : "Upload failed."));
      setMessageTone(res.ok ? "success" : "danger");
      loadImports();
      setFile(null);
    } catch (err) {
      setMessage("Upload failed: " + err.message);
      setMessageTone("danger");
    } finally {
      setUploading(false);
    }
  };

  const handleRunRecon = async (importUKey) => {
    setRunning(true);
    setMessage("");
    try {
      const res = await apiClient(`${API_BASE_URL}/api/Gstr2Recon/RunRecon/${importUKey}`, { method: "POST" });
      const result = await res.json();
      setMessage(result.message || (res.ok ? "Reconciliation run completed." : "Run failed."));
      setMessageTone(res.ok ? "success" : "danger");
      if (res.ok && result.data) {
        setRunSummary(result.data);
        setActiveRunUKey(result.data.uKey);
        setStatusFilter("");
        setPage(0);
      }
      loadImports();
    } catch (err) {
      setMessage("Run failed: " + err.message);
      setMessageTone("danger");
    } finally {
      setRunning(false);
    }
  };

  const handleResolve = async (resultUKey, resolutionStatus) => {
    try {
      const res = await apiClient(`${API_BASE_URL}/api/Gstr2Recon/ResolveResult/${resultUKey}`, {
        method: "POST",
        body: JSON.stringify({ resolutionStatus }),
      });
      if (res.ok) loadResults(activeRunUKey, statusFilter, page);
    } catch (err) {
      console.error("Failed to resolve result:", err);
    }
  };

  const handleExport = () => {
    if (!activeRunUKey) return;
    window.open(`${API_BASE_URL}/api/Gstr2Recon/ExportResults/${activeRunUKey}`, "_blank");
  };

  return (
    <div className="i-container">
      <h2 className="i-title">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h11l5 5v11a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1z" />
          <path d="M15 4v5h5" />
          <path d="M8 13l2.5 2.5L16 10" />
        </svg>
        GSTR-2A / GSTR-2B Reconciliation
      </h2>

      <div className="dg-panel gst-panel">
        <div className="dg-panel-body gst-body">

          {/* ── Upload ────────────────────────────────────────── */}
          <section className="gst-section">
            <div className="gst-section-head">
              <h3 className="gst-section-title">Upload a portal export</h3>
              <span className="gst-section-hint">JSON only — export GSTR-2A/2B from the GST portal</span>
            </div>
            <div className="gst-upload-row">
              <select className="gst-select" value={returnType} onChange={(e) => setReturnType(e.target.value)}>
                <option value="GSTR2B">GSTR-2B (recommended)</option>
                <option value="GSTR2A">GSTR-2A (informational)</option>
              </select>
              <label className="gst-file-input">
                <input type="file" accept=".json" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                <span>{file ? file.name : "Choose file…"}</span>
              </label>
              <button className="gst-btn gst-btn--primary" disabled={uploading} onClick={handleUpload}>
                {uploading ? "Uploading…" : "Upload"}
              </button>
            </div>
            {message && <div className={`gst-alert gst-alert--${messageTone}`}>{message}</div>}
          </section>

          {/* ── Imports ───────────────────────────────────────── */}
          <section className="gst-section">
            <div className="gst-section-head">
              <h3 className="gst-section-title">Uploaded files</h3>
              <span className="gst-count">{imports.length} file{imports.length === 1 ? "" : "s"}</span>
            </div>
            <div className="gst-table-wrap">
              <table className="gst-table">
                <thead>
                  <tr>
                    <th>File</th><th>Type</th><th>Uploaded</th><th>Status</th><th>Rows</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {imports.map((imp) => (
                    <tr key={imp.uKey}>
                      <td className="gst-cell-strong">{imp.fileName}</td>
                      <td>{imp.returnType}</td>
                      <td className="gst-cell-muted">{fmtDate(imp.uploadedAt)}</td>
                      <td><ParseStatusBadge status={imp.parseStatus} error={imp.parseError} /></td>
                      <td>{imp.rowCount ?? "—"}</td>
                      <td className="gst-actions">
                        {imp.parseStatus === "PARSED" && (
                          <button className="gst-btn gst-btn--sm" disabled={running} onClick={() => handleRunRecon(imp.uKey)}>
                            {running ? "Running…" : "Run Reconciliation"}
                          </button>
                        )}
                        {imp.latestRunUKey && (
                          <button
                            className="gst-btn gst-btn--sm gst-btn--ghost"
                            onClick={() => { setActiveRunUKey(imp.latestRunUKey); setStatusFilter(""); setPage(0); }}
                          >
                            View Results
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {imports.length === 0 && (
                    <tr><td colSpan={6} className="gst-empty">No files uploaded yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Results ───────────────────────────────────────── */}
          {activeRunUKey && (
            <section className="gst-section">
              <div className="gst-section-head">
                <h3 className="gst-section-title">Reconciliation results</h3>
                <div className="gst-toolbar">
                  <select className="gst-select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}>
                    <option value="">All statuses</option>
                    {Object.entries(STATUS_META).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}
                  </select>
                  <button className="gst-btn gst-btn--sm gst-btn--ghost" onClick={handleExport}>
                    Export to Excel
                  </button>
                </div>
              </div>

              {runSummary && (
                <div className="gst-stats">
                  <div className="gst-stat gst-stat--success">
                    <span className="gst-stat-label">ITC Matched</span>
                    <span className="gst-stat-value">{fmtMoney(runSummary.totalItcMatched)}</span>
                  </div>
                  <div className="gst-stat gst-stat--warning">
                    <span className="gst-stat-label">ITC At Risk</span>
                    <span className="gst-stat-value">{fmtMoney(runSummary.totalItcAtRisk)}</span>
                  </div>
                  <div className="gst-stat gst-stat--danger">
                    <span className="gst-stat-label">Missing In Books</span>
                    <span className="gst-stat-value">{runSummary.missingInBooksCount ?? 0}</span>
                  </div>
                  <div className="gst-stat gst-stat--danger">
                    <span className="gst-stat-label">Missing In Portal</span>
                    <span className="gst-stat-value">{runSummary.missingInPortalCount ?? 0}</span>
                  </div>
                </div>
              )}

              <div className="gst-table-wrap">
                <table className="gst-table">
                  <thead>
                    <tr>
                      <th>Status</th><th>Book Invoice</th><th>Portal Invoice</th><th>Portal GSTIN</th>
                      <th>ITC Amount</th><th>Resolution</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.uKey}>
                        <td><StatusBadge status={r.matchStatus} /></td>
                        <td className="gst-cell-mono">{r.bookInvoiceNumber || "—"}</td>
                        <td className="gst-cell-mono">{r.portalInvoiceNumber || "—"}</td>
                        <td className="gst-cell-mono">{r.portalSupplierGstin || "—"}</td>
                        <td className="gst-cell-strong">{fmtMoney(r.itcAmount)}</td>
                        <td><ResolutionBadge status={r.resolutionStatus} /></td>
                        <td className="gst-actions">
                          {r.resolutionStatus === "OPEN" && (
                            <>
                              <button className="gst-btn gst-btn--sm gst-btn--success" onClick={() => handleResolve(r.uKey, "ACCEPTED")}>Accept</button>
                              <button className="gst-btn gst-btn--sm gst-btn--danger" onClick={() => handleResolve(r.uKey, "REJECTED")}>Reject</button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                    {results.length === 0 && (
                      <tr><td colSpan={7} className="gst-empty">No results for this filter.</td></tr>
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
          )}

        </div>
      </div>
    </div>
  );
}
