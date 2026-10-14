import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FaDownload, FaFileExcel, FaInbox, FaRedo, FaSearch } from "react-icons/fa";
import { toast } from "react-toastify";
import "../../Styles/BulkUpload/BulkUpload.css";
import "../../Styles/MargImport/MargImport.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

const TYPE_LABEL = { PARTIES: "Party master", ITEMS: "Item master", OUTSTANDING: "Outstanding", STOCK: "Stock" };
const KIND_LABEL = { RETAILER: "Retailers", SUPPLIER: "Suppliers" };

export const importLabel = (row) => {
  const base = TYPE_LABEL[row.type] || row.type || "-";
  return row.partyKind ? `${base} (${KIND_LABEL[row.partyKind] || row.partyKind})` : base;
};

export const statusClass = (status = "") => {
  if (status === "Processed") return "bulkup-status-success";
  if (status === "Partially Processed") return "bulkup-status-warning";
  if (status === "Failed") return "bulkup-status-failure";
  return "bulkup-status-pending";
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};

export default function MargImportHistory() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [downloading, setDownloading] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient(`${API_BASE_URL}/api/MargImport/History`, { method: "GET" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Failed to load the import history");
      setRows(Array.isArray(payload.data) ? payload.data : []);
    } catch (err) {
      toast.error(err.message || "Failed to load the import history");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.transactionCode, r.fileName, importLabel(r), r.status, r.createdBy].some((v) =>
        String(v || "").toLowerCase().includes(q)
      )
    );
  }, [rows, search]);

  const download = async (row, kind) => {
    const key = `${row.id}-${kind}`;
    setDownloading(key);
    try {
      const response = await apiClient(`${API_BASE_URL}/api/MargImport/History/${row.id}/File/${kind}`, { method: "GET" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || "Failed to download the file");
      }
      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = kind === "source" ? row.fileName : `${row.transactionCode}_${kind === "success" ? "Success" : "Failure"}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      toast.error(err.message || "Failed to download the file");
    } finally {
      setDownloading("");
    }
  };

  return (
    <div className="bulkup-grid-shell" aria-label="Import history">
      <div className="bulkup-toolbar">
        <div className="bulkup-search">
          <FaSearch />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by code, file or status..." />
        </div>
        <div className="bulkup-record-count">{visible.length} records</div>
        <button className="bulkup-btn bulkup-btn-ghost bulkup-btn-sm" onClick={load} disabled={loading}>
          <FaRedo /> Refresh
        </button>
      </div>

      <div className="bulkup-table-wrap">
        <table className="bulkup-table">
          <thead>
            <tr>
              <th>Transaction Code</th>
              <th>Import</th>
              <th>File Name</th>
              <th>Status</th>
              <th>Result</th>
              <th>Imported By</th>
              <th>Created At</th>
              <th>Files</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="bulkup-empty">Loading...</td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={8} className="bulkup-empty">
                  <div className="bulkup-empty-state">
                    <FaInbox className="bulkup-empty-icon" />
                    <span className="bulkup-empty-title">No imports found</span>
                    <span className="bulkup-empty-sub">
                      {search ? "Try a different search term." : "Import a Marg file to see it appear here."}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              visible.map((row) => (
                <tr key={row.id}>
                  <td className="bulkup-code">{row.transactionCode}</td>
                  <td>{importLabel(row)}</td>
                  <td title={row.fileName}>{row.fileName || "-"}</td>
                  <td>
                    <span className={`bulkup-status ${statusClass(row.status)}`}>
                      <span className="bulkup-status-dot" />
                      {row.status}
                    </span>
                  </td>
                  <td className="marg-history-result">
                    <span title="Created">{row.createdCount} new</span>
                    <span title="Updated">{row.updatedCount} updated</span>
                    <span title="Skipped">{row.skippedCount} skipped</span>
                    <span title="Failed" className={row.failedCount ? "marg-history-failed" : ""}>{row.failedCount} failed</span>
                  </td>
                  <td>{row.createdBy || "-"}</td>
                  <td>{formatDateTime(row.createdAt)}</td>
                  <td>
                    <div className="bulkup-actions">
                      <button
                        className="bulkup-btn bulkup-btn-sm"
                        title="Download the uploaded file"
                        disabled={downloading === `${row.id}-source`}
                        onClick={() => download(row, "source")}
                      >
                        <FaFileExcel /> Uploaded
                      </button>
                      {row.hasSuccessFile && (
                        <button
                          className="bulkup-btn bulkup-btn-sm"
                          title="Download the rows that were imported or skipped"
                          disabled={downloading === `${row.id}-success`}
                          onClick={() => download(row, "success")}
                        >
                          <FaDownload /> Success
                        </button>
                      )}
                      {row.hasFailureFile && (
                        <button
                          className="bulkup-btn bulkup-btn-sm"
                          title="Download the rows that failed, with the reason"
                          disabled={downloading === `${row.id}-failure`}
                          onClick={() => download(row, "failure")}
                        >
                          <FaDownload /> Failure
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
