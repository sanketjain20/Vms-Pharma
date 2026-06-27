import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaDownload, FaPlus, FaRedo, FaSearch, FaExclamationTriangle, FaInbox } from "react-icons/fa";
import { toast } from "react-toastify";
import "../../Styles/BulkUpload/BulkUpload.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

const TABLE_COLUMNS = 6;

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getFileNameFromDisposition = (disposition, fallback) => {
  if (!disposition) return fallback;
  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) return decodeURIComponent(utfMatch[1].replace(/"/g, ""));
  const plainMatch = disposition.match(/filename="?([^"]+)"?/i);
  return plainMatch?.[1] || fallback;
};

export default function BulkUploadTransactions() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [downloadingKey, setDownloadingKey] = useState("");
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);

  const fetchTransactions = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await apiClient(`${API_BASE_URL}/api/bulk-upload/transactions`, {
        method: "GET",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || (payload.status && payload.status !== 200)) {
        throw new Error(payload.message || "Failed to fetch bulk upload transactions.");
      }
      const rows = Array.isArray(payload.data)
        ? payload.data
        : Array.isArray(payload.data?.content)
          ? payload.data.content
          : [];
      setTransactions(rows);
    } catch (error) {
      const message = error.message || "Failed to fetch bulk upload transactions.";
      toast.error(message);
      setLoadError(message);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const filteredTransactions = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter((row) =>
      [
        row.transactionCode,
        row.uploadName,
        row.moduleName,
        row.fileName,
        row.status,
      ].some((value) => String(value || "").toLowerCase().includes(q))
    );
  }, [transactions, searchText]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / size));
  const pagedTransactions = filteredTransactions.slice(page * size, page * size + size);

  useEffect(() => {
    if (page > totalPages - 1) setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);

  const downloadOutput = async (row, isSuccess) => {
    const buttonKey = `${row.jobId}-${isSuccess ? "success" : "failure"}`;
    setDownloadingKey(buttonKey);
    try {
      const params = new URLSearchParams({ jobId: row.jobId });
      params.set("isSuccess", String(Boolean(isSuccess)));

      const response = await apiClient(
        `${API_BASE_URL}/api/bulk-upload/download?${params.toString()}`,
        { method: "GET" }
      );

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || "Failed to download output file.");
      }

      const blob = await response.blob();
      const fallbackName = `${row.transactionCode || "bulk-upload"}-${isSuccess ? "success" : "failure"}.xlsx`;
      const fileName = getFileNameFromDisposition(
        response.headers.get("Content-Disposition"),
        fallbackName
      );

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("File downloaded successfully.");
    } catch (error) {
      toast.error(error.message || "Failed to download output file.");
    } finally {
      setDownloadingKey("");
    }
  };

  const statusClass = (status = "") => {
    const normalized = status.toLowerCase();

    if (normalized.includes("partially processed")) {
      return "bulkup-status-warning";
    }

    if (normalized.includes("processed")) {
      return "bulkup-status-success";
    }


    if (normalized.includes("failed")) {
      return "bulkup-status-failure";
    }

    return "bulkup-status-pending";
  };

  const getStatus = (row) => {
    if (row.isSuccess && row.isFailure) {
      return "Partially Processed";
    }

    if (row.isSuccess && !row.isFailure) {
      return "Processed";
    }

    if (!row.isSuccess && row.isFailure) {
      return "Failed";
    }

    return "Processing";
  };
  return (
    <div className="bulkup-page">
      <div className="bulkup-header">
        <div>
          <div className="bulkup-eyebrow">
            <span className="bulkup-dot" />
            Bulk Uploads
          </div>
          <h2 className="bulkup-title">Transactions</h2>
          <div className="bulkup-title-rule" />
        </div>
        <div className="bulkup-header-actions">
          <button className="bulkup-btn bulkup-btn-ghost" onClick={fetchTransactions} disabled={loading}>
            <FaRedo className={loading ? "bulkup-spin" : ""} />
            Refresh
          </button>
          <button className="bulkup-btn bulkup-btn-primary" onClick={() => navigate("/master/bulk-upload/masters")}>
            <FaPlus />
            Add Bulk Data Upload
          </button>
        </div>
      </div>

      <div className="bulkup-stats">
        <div className="bulkup-stat-card">
          <span>Total Jobs</span>
          <strong>{transactions.length}</strong>
        </div>
        <div className="bulkup-stat-card bulkup-green">
          <span>Success Files</span>
          <strong>{transactions.filter((row) => row.isSuccess).length}</strong>
        </div>
        <div className="bulkup-stat-card bulkup-red">
          <span>Failure Files</span>
          <strong>{transactions.filter((row) => row.isFailure).length}</strong>
        </div>
      </div>

      <div className="bulkup-grid-shell">
        <div className="bulkup-toolbar">
          <div className="bulkup-search">
            <FaSearch />
            <input
              value={searchText}
              onChange={(event) => {
                setSearchText(event.target.value);
                setPage(0);
              }}
              placeholder="Search transactions"
            />
          </div>
          <div className="bulkup-record-count">{filteredTransactions.length} records</div>
        </div>

        <div className="bulkup-table-wrap">
          <table className="bulkup-table">
            <thead>
              <tr>
                <th>Transaction Code</th>
                <th>Upload Name</th>
                <th>File Name</th>
                <th>Status</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`} className="bulkup-skeleton-row">
                    {Array.from({ length: TABLE_COLUMNS }).map((__, colIdx) => (
                      <td key={colIdx}>
                        <span className="bulkup-skeleton-bar" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : loadError ? (
                <tr>
                  <td colSpan={TABLE_COLUMNS} className="bulkup-empty">
                    <div className="bulkup-empty-state bulkup-empty-state-error">
                      <FaExclamationTriangle className="bulkup-empty-icon" />
                      <span className="bulkup-empty-title">Couldn't load transactions</span>
                      <span className="bulkup-empty-sub">{loadError}</span>
                      <button className="bulkup-btn bulkup-btn-sm bulkup-btn-primary" onClick={fetchTransactions}>
                        <FaRedo /> Retry
                      </button>
                    </div>
                  </td>
                </tr>
              ) : pagedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={TABLE_COLUMNS} className="bulkup-empty">
                    <div className="bulkup-empty-state">
                      <FaInbox className="bulkup-empty-icon" />
                      <span className="bulkup-empty-title">No bulk upload transactions found</span>
                      <span className="bulkup-empty-sub">
                        {searchText ? "Try a different search term." : "Run a bulk upload to see it appear here."}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                pagedTransactions.map((row) => (
                  <tr key={row.jobId || row.transactionCode}>
                    <td className="bulkup-code">{row.transactionCode || "-"}</td>
                    <td>{row.uploadName || "-"}</td>
                    <td title={row.fileName}>{row.fileName || "-"}</td>
                    <td>
                      <span className={`bulkup-status ${statusClass(getStatus(row))}`}>
                        <span className="bulkup-status-dot" />
                        {getStatus(row)}
                      </span>
                    </td>
                    <td>{formatDateTime(row.createdAt)}</td>
                    <td>
                      <div className="bulkup-actions">
                        {row.isSuccess && (
                          <button
                            className="bulkup-action bulkup-action-success"
                            title="Download success file"
                            disabled={downloadingKey === `${row.jobId}-success`}
                            onClick={() => downloadOutput(row, true)}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              height="20"
                              viewBox="0 -960 960 960"
                              width="20"
                              fill="#6dbd3b"
                            >
                              <path d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z" />
                            </svg>
                          </button>
                        )}
                        {row.isFailure && (
                          <button
                            className="bulkup-action bulkup-action-failure"
                            title="Download failure file"
                            disabled={downloadingKey === `${row.jobId}-failure`}
                            onClick={() => downloadOutput(row, false)}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              height="20"
                              viewBox="0 -960 960 960"
                              width="20"
                              fill="#d1473b"
                            >
                              <path d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z" />
                            </svg>
                          </button>
                        )}
                        {!row.isSuccess && !row.isFailure && <span className="bulkup-no-action">-</span>}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="bulkup-pagination">
          <button disabled={page === 0} onClick={() => setPage(0)}>First</button>
          <button disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>Prev</button>
          <span>{page + 1} / {totalPages}</span>
          <button disabled={page + 1 >= totalPages} onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}>Next</button>
          <button disabled={page + 1 >= totalPages} onClick={() => setPage(totalPages - 1)}>Last</button>
          <select value={size} onChange={(event) => { setSize(Number(event.target.value)); setPage(0); }}>
            {[10, 25, 50, 100].map((option) => (
              <option key={option} value={option}>{option} / page</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}