import React, { useEffect, useMemo, useState } from "react";
import { FaFileExcel, FaUpload, FaDownload, FaCheckCircle } from "react-icons/fa";
import { toast } from "react-toastify";
import "../../Styles/BulkUpload/BulkUpload.css";
import "../../Styles/MargImport/MargImport.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import MargImportHistory from "./MargImportHistory";

// The order a business should load its data in: parties and items first, because outstanding and stock refer to them.
const STEP_ORDER = ["PARTIES", "ITEMS", "OUTSTANDING", "STOCK"];

const PARTY_KINDS = [
  { value: "RETAILER", label: "Retailers (Sundry Debtors)" },
  { value: "SUPPLIER", label: "Suppliers (Sundry Creditors)" },
];

const FILTERS = [
  { key: "ALL", label: "All" },
  { key: "ERROR", label: "Errors" },
  { key: "WARN", label: "Warnings" },
  { key: "CREATE", label: "New" },
  { key: "UPDATE", label: "Updates" },
  { key: "SKIP", label: "Skipped" },
];

const ACTION_LABEL = { CREATE: "New", UPDATE: "Update", SKIP: "Skip", ERROR: "Error" };

// What to call a row in the tables: the party / item name, plus the batch for stock rows.
export const rowLabel = (values = {}) => {
  const name = values.name || values.party || values.item || "-";
  return values.batch ? `${name} (batch ${values.batch})` : name;
};

export const matchesFilter = (row, filter) => {
  if (filter === "ALL") return true;
  if (filter === "WARN") return (row.warnings || []).length > 0;
  return row.action === filter;
};

// A cell that starts with = + - @ (or a tab / carriage return) is run as a formula when the CSV is opened in Excel, and these
// values come straight from the uploaded file, so they are prefixed with an apostrophe to keep them plain text.
export const csvCell = (value) => {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

// The failed rows as a CSV the user can fix and re-upload.
export const failuresToCsv = (failures = []) => {
  const lines = [["Row", "Name", "Problem"].map(csvCell).join(",")];
  failures.forEach((f) => lines.push([f.rowNumber, rowLabel(f.values), f.message].map(csvCell).join(",")));
  return lines.join("\n");
};

async function readJson(response) {
  return response.json().catch(() => ({}));
}

export default function MargImport() {
  const [guides, setGuides] = useState([]);
  const [type, setType] = useState("PARTIES");
  const [partyKind, setPartyKind] = useState("RETAILER");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [view, setView] = useState("import"); // import | history

  useEffect(() => {
    (async () => {
      try {
        const response = await apiClient(`${API_BASE_URL}/api/MargImport/Guides`, { method: "GET" });
        const payload = await readJson(response);
        if (!response.ok) throw new Error(payload.message || "Failed to load import guides");
        const list = Array.isArray(payload.data) ? payload.data : [];
        list.sort((a, b) => STEP_ORDER.indexOf(a.type) - STEP_ORDER.indexOf(b.type));
        setGuides(list);
      } catch (err) {
        toast.error(err.message || "Failed to load import guides");
      }
    })();
  }, []);

  const guide = useMemo(() => guides.find((g) => g.type === type) || null, [guides, type]);
  const needsPartyKind = !!guide?.needsPartyKind;

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setFilter("ALL");
  };

  const chooseType = (next) => {
    if (next === type) return;
    setType(next);
    reset();
  };

  const choosePartyKind = (next) => {
    setPartyKind(next);
    setFile(null);
    setPreview(null);
    setResult(null);
  };

  const kindParam = needsPartyKind ? `?partyKind=${partyKind}` : "";

  const checkFile = async () => {
    if (!file) {
      toast.warning("Please select a file first");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    if (needsPartyKind) formData.append("partyKind", partyKind);

    setChecking(true);
    setPreview(null);
    setResult(null);
    try {
      const response = await apiClient(`${API_BASE_URL}/api/MargImport/Preview/${type}`, {
        method: "POST",
        body: formData,
        busyLabel: "Checking file...",
      });
      const payload = await readJson(response);
      if (!response.ok) throw new Error(payload.message || "Could not check the file");
      setPreview(payload.data);
      setFilter(payload.data.errorCount > 0 ? "ERROR" : "ALL");
    } catch (err) {
      toast.error(err.message || "Could not check the file");
    } finally {
      setChecking(false);
    }
  };

  const runImport = async () => {
    if (!preview) return;
    const body = new URLSearchParams({ importKey: preview.importKey });
    setImporting(true);
    try {
      const response = await apiClient(`${API_BASE_URL}/api/MargImport/Commit/${type}${kindParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        busyLabel: "Importing...",
      });
      const payload = await readJson(response);
      if (!response.ok) throw new Error(payload.message || "Import failed");
      setResult(payload.data);
      setPreview(null);
      if (payload.data.failedCount > 0) toast.warning(payload.message);
      else toast.success(payload.message || "Import complete");
    } catch (err) {
      toast.error(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const downloadSample = async () => {
    try {
      const response = await apiClient(`${API_BASE_URL}/api/MargImport/Sample/${type}`, { method: "GET" });
      if (!response.ok) {
        const payload = await readJson(response);
        throw new Error(payload.message || "Could not download the sample file");
      }
      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = `Marg_${type}_Sample.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      toast.error(err.message || "Could not download the sample file");
    }
  };

  const downloadFailures = () => {
    const blob = new Blob([failuresToCsv(result?.failures)], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.download = `marg-${type.toLowerCase()}-failed-rows.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const visibleRows = useMemo(
    () => (preview?.rows || []).filter((row) => matchesFilter(row, filter)),
    [preview, filter]
  );

  const importable = preview ? preview.createCount + preview.updateCount : 0;

  return (
    <div className="bulkup-page marg-page">
      <div className="bulkup-header">
        <div>
          <div className="bulkup-eyebrow">Switch to VMS</div>
          <h2 className="bulkup-title">Import from Marg</h2>
          <div className="bulkup-title-rule" />
        </div>
      </div>

      <div className="marg-views" role="group" aria-label="Page section">
        <button
          className={`marg-filter ${view === "import" ? "marg-filter-active" : ""}`}
          aria-pressed={view === "import"}
          onClick={() => setView("import")}
        >
          New import
        </button>
        <button
          className={`marg-filter ${view === "history" ? "marg-filter-active" : ""}`}
          aria-pressed={view === "history"}
          onClick={() => setView("history")}
        >
          History
        </button>
      </div>

      {view === "history" && <MargImportHistory />}

      {view === "import" && (
        <>
      {/* STEP 1 - what to import */}
      <div className="marg-steps" role="tablist" aria-label="What to import">
        {guides.map((g, index) => (
          <button
            key={g.type}
            role="tab"
            aria-selected={g.type === type}
            className={`marg-step ${g.type === type ? "marg-step-active" : ""}`}
            onClick={() => chooseType(g.type)}
          >
            <span className="marg-step-no">{index + 1}</span>
            <span className="marg-step-title">{g.title}</span>
          </button>
        ))}
      </div>

      {guide && (
        <div className="bulkup-grid-shell marg-panel">
          <p className="marg-desc">{guide.description}</p>

          {needsPartyKind && (
            <div className="marg-kind" role="radiogroup" aria-label="Party type">
              {PARTY_KINDS.map((k) => (
                <button
                  key={k.value}
                  role="radio"
                  aria-checked={partyKind === k.value}
                  className={`marg-kind-btn ${partyKind === k.value ? "marg-kind-active" : ""}`}
                  onClick={() => choosePartyKind(k.value)}
                >
                  {k.label}
                </button>
              ))}
            </div>
          )}

          <button className="bulkup-btn bulkup-btn-ghost marg-sample-btn" onClick={downloadSample}>
            <FaDownload /> Download sample file
          </button>

          <details className="marg-columns">
            <summary>Columns read from the file</summary>
            <ul>
              {guide.fields.map((f) => (
                <li key={f.key}>
                  <strong>{f.label}</strong>
                  {f.required ? <span className="marg-req"> required</span> : null}
                  <span className="marg-alias"> - {f.acceptedHeaders.slice(0, 4).join(", ")}</span>
                </li>
              ))}
            </ul>
          </details>

          {/* STEP 2 - upload */}
          {!result && (
            <div className="marg-upload">
              <label className="bulkup-dropzone">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => {
                    setFile(e.target.files?.[0] || null);
                    setPreview(null);
                  }}
                />
                <FaFileExcel className="bulkup-dropzone-icon" />
                <span className="bulkup-dropzone-title">{file?.name || "Choose the Marg export"}</span>
                <span className="bulkup-dropzone-sub">.xlsx, .xls or .csv</span>
              </label>
              <button className="bulkup-btn bulkup-btn-primary" disabled={!file || checking} onClick={checkFile}>
                <FaUpload /> {checking ? "Checking..." : "Check file"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP 3 - preview */}
      {preview && (
        <div className="bulkup-grid-shell marg-panel" aria-label="Preview">
          <h3 className="marg-h">Check before importing</h3>
          <div className="marg-stats">
            <Stat label="Rows" value={preview.totalRows} />
            <Stat label="New" value={preview.createCount} tone="good" />
            <Stat label="Updates" value={preview.updateCount} tone="info" />
            <Stat label="Skipped" value={preview.skipCount} />
            <Stat label="Errors" value={preview.errorCount} tone={preview.errorCount ? "bad" : undefined} />
          </div>

          <details className="marg-columns">
            <summary>How the columns were read</summary>
            <ul>
              {Object.entries(preview.mapping).map(([key, header]) => {
                const field = guide?.fields.find((f) => f.key === key);
                return (
                  <li key={key}>
                    <strong>{field?.label || key}</strong> {" <- "}
                    {header ? <code>{header}</code> : <span className="marg-alias">not in file</span>}
                  </li>
                );
              })}
            </ul>
          </details>

          <div className="marg-filters" role="group" aria-label="Filter rows">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                className={`marg-filter ${filter === f.key ? "marg-filter-active" : ""}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="bulkup-table-wrap">
            <table className="bulkup-table">
              <thead>
                <tr>
                  <th style={{ width: "8%" }}>Row</th>
                  <th style={{ width: "10%" }}>Result</th>
                  <th style={{ width: "30%" }}>Name</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="bulkup-empty">No rows to show</td>
                  </tr>
                ) : (
                  visibleRows.map((row) => (
                    <tr key={row.rowNumber}>
                      <td>{row.rowNumber}</td>
                      <td>
                        <span className={`marg-badge marg-badge-${row.action.toLowerCase()}`}>
                          {ACTION_LABEL[row.action]}
                        </span>
                      </td>
                      <td>{rowLabel(row.values)}</td>
                      <td>
                        {row.message}
                        {(row.warnings || []).map((w) => (
                          <div key={w} className="marg-warning">{w}</div>
                        ))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {preview.rowsTruncated && (
            <p className="marg-note">
              Showing every row with a problem and the first rows of the rest; all {preview.totalRows} rows are
              imported.
            </p>
          )}

          <div className="marg-actions">
            <button className="bulkup-btn bulkup-btn-ghost" onClick={reset}>Start over</button>
            <button className="bulkup-btn bulkup-btn-primary" disabled={importing || importable === 0} onClick={runImport}>
              <FaCheckCircle /> {importing ? "Importing..." : `Import ${importable} row${importable === 1 ? "" : "s"}`}
            </button>
          </div>
          {preview.errorCount > 0 && importable > 0 && (
            <p className="marg-note">Rows with errors are left out; the rest are imported.</p>
          )}
        </div>
      )}

      {/* STEP 4 - result */}
      {result && (
        <div className="bulkup-grid-shell marg-panel" aria-label="Result">
          <h3 className="marg-h">Import finished</h3>
          <div className="marg-stats">
            <Stat label="Created" value={result.createdCount} tone="good" />
            <Stat label="Updated" value={result.updatedCount} tone="info" />
            <Stat label="Skipped" value={result.skippedCount} />
            <Stat label="Failed" value={result.failedCount} tone={result.failedCount ? "bad" : undefined} />
          </div>

          {result.failedCount > 0 && (
            <>
              <div className="bulkup-table-wrap">
                <table className="bulkup-table">
                  <thead>
                    <tr>
                      <th style={{ width: "8%" }}>Row</th>
                      <th style={{ width: "30%" }}>Name</th>
                      <th>Problem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.failures.map((f) => (
                      <tr key={f.rowNumber}>
                        <td>{f.rowNumber}</td>
                        <td>{rowLabel(f.values)}</td>
                        <td>{f.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {result.failuresTruncated && (
                <p className="marg-note">Only the first {result.failures.length} failed rows are listed.</p>
              )}
            </>
          )}

          <div className="marg-actions">
            {result.failedCount > 0 && (
              <button className="bulkup-btn bulkup-btn-ghost" onClick={downloadFailures}>
                <FaDownload /> Download failed rows
              </button>
            )}
            <button className="bulkup-btn bulkup-btn-ghost" onClick={() => setView("history")}>View history</button>
            <button className="bulkup-btn bulkup-btn-primary" onClick={reset}>Import another file</button>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className={`marg-stat ${tone ? `marg-stat-${tone}` : ""}`}>
      <div className="marg-stat-value">{value}</div>
      <div className="marg-stat-label">{label}</div>
    </div>
  );
}
