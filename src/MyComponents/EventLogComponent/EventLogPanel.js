import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../Styles/EventLog/EventLog.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import { ReportEntity } from "../Enums/ReportEntity";
import { toAuditModuleKey } from "./moduleKeyMap";

const ACTION_BADGE = {
  UPDATE: "",
  ENABLE: "evl-badge--success",
  DISABLE: "evl-badge--danger",
  STATUS_CHANGED: "evl-badge--warning",
  DELETE: "evl-badge--danger",
  PAYMENT_COLLECTED: "evl-badge--success",
  PAYMENT_MADE: "evl-badge--success",
  PAYMENT_REVERSED: "evl-badge--danger",
  RETURN_PROCESSED: "evl-badge--warning",
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

/* Real per-browser marks (not a generic badge) — the backend label is
   already browser-only (e.g. "Chrome 128", no OS/device — see
   UserAgentParser). Each icon below reproduces that browser's own logo
   shape/colors, not an arbitrary letter-in-a-circle. */
function ChromeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" {...props}>
      <path d="M12 12 L12 2 A10 10 0 0 1 20.66 17 Z" fill="#EA4335" />
      <path d="M12 12 L20.66 17 A10 10 0 0 1 3.34 17 Z" fill="#34A853" />
      <path d="M12 12 L3.34 17 A10 10 0 0 1 12 2 Z" fill="#FBBC05" />
      <circle cx="12" cy="12" r="6.4" fill="#fff" />
      <circle cx="12" cy="12" r="4.6" fill="#4285F4" />
    </svg>
  );
}

function FirefoxIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" {...props}>
      <defs>
        <radialGradient id="evlFf" cx="35%" cy="20%" r="85%">
          <stop offset="0%" stopColor="#FFE900" />
          <stop offset="45%" stopColor="#FF9100" />
          <stop offset="100%" stopColor="#E2352D" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill="url(#evlFf)" />
      <path
        d="M6 9c1.5-3 5-4 8-2.3-2.6-.6-5.2.5-6.2 3-.9 2.3.1 4.6 2.4 5.6-3-.2-5.3-2.8-4.2-6.3z"
        fill="rgba(255,255,255,0.35)"
      />
    </svg>
  );
}

function EdgeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" {...props}>
      <defs>
        <linearGradient id="evlEdge" x1="2" y1="4" x2="22" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0F5FC4" />
          <stop offset="55%" stopColor="#1B9DE2" />
          <stop offset="100%" stopColor="#35C880" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill="url(#evlEdge)" />
      <path
        d="M5 14.5c1-5.2 6.5-8 11.2-6-4.3-.9-8 1.6-8.4 5.4-.4 3.6 2.4 6 5.7 6 2.6 0 4.6-1.3 5.5-3.3-1.2 3.7-4.8 6-8.7 5-3-.8-4.9-3.6-4.3-7.1z"
        fill="rgba(255,255,255,0.92)"
      />
    </svg>
  );
}

function SafariIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" {...props}>
      <defs>
        <linearGradient id="evlSafariRing" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38C6F4" />
          <stop offset="100%" stopColor="#0A84D8" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="9.3" fill="#fff" stroke="url(#evlSafariRing)" strokeWidth="1.6" />
      <polygon points="12,4.5 13.4,12 12,19.5 10.6,12" fill="#e5e9ee" />
      <polygon points="12,4.5 13.4,12 12,12" fill="#FF3B30" />
      <polygon points="12,4.5 10.6,12 12,12" fill="#FF6259" />
      <polygon points="12,19.5 13.4,12 12,12" fill="#3B4A57" />
      <polygon points="12,19.5 10.6,12 12,12" fill="#5B6D7C" />
      <circle cx="12" cy="12" r="0.9" fill="#8a94a0" />
    </svg>
  );
}

function OperaIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" {...props}>
      <defs>
        <linearGradient id="evlOpera" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF1B2D" />
          <stop offset="100%" stopColor="#A70014" />
        </linearGradient>
      </defs>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C7.8 2 5 6.5 5 12s2.8 10 7 10 7-4.5 7-10S16.2 2 12 2Zm0 4.2c1.9 0 3.6 2.6 3.6 5.8s-1.7 5.8-3.6 5.8-3.6-2.6-3.6-5.8 1.7-5.8 3.6-5.8Z"
        fill="url(#evlOpera)"
      />
    </svg>
  );
}

function GenericBrowserIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="9.3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.7 12h18.6M12 2.7v18.6" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <path
        d="M6.3 6.3c2.2 2 2.2 9.4 0 11.4m11.4-11.4c-2.2 2-2.2 9.4 0 11.4"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.5"
      />
    </svg>
  );
}

const BROWSER_ICONS = [
  { match: "Edge", Icon: EdgeIcon },
  { match: "Opera", Icon: OperaIcon },
  { match: "Chrome", Icon: ChromeIcon },
  { match: "Firefox", Icon: FirefoxIcon },
  { match: "Safari", Icon: SafariIcon },
];

function BrowserIcon({ label }) {
  const found = BROWSER_ICONS.find((b) => label?.startsWith(b.match));
  const Icon = found ? found.Icon : GenericBrowserIcon;
  return <Icon className="evl-browser-icon" style={{ color: "var(--evl-text-3)" }} />;
}

const relativeTime = (value) => {
  if (!value) return "";
  const diffMs = Date.now() - new Date(value).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
};

export default function EventLogPanel({ moduleName, uKey, onClose, closing }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  // Every event starts closed — the user opens whichever one they want to
  // inspect. Keyed by event uKey so more than one can be open at once.
  const [openEvents, setOpenEvents] = useState(() => new Set());
  const moduleKey = toAuditModuleKey(moduleName);

  const toggleEvent = (eventKey) => {
    setOpenEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventKey)) next.delete(eventKey);
      else next.add(eventKey);
      return next;
    });
  };

  useEffect(() => {
    if (!moduleKey || !uKey) {
      setError("Event log is not available for this record.");
      return;
    }
    apiClient(`${API_BASE_URL}/api/EventLog/GetRecordEvents/${moduleKey}/${uKey}`, { method: "GET" })
      .then((r) => r.json())
      .then((json) => {
        if (json?.status === 200) setData(json.data);
        else setError(json?.message || "Failed to load event log.");
      })
      .catch((err) => setError(err.message));
  }, [moduleKey, uKey]);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const openAuditReport = () => {
    navigate("/master/reports/generate", {
      state: {
        moduleId: ReportEntity.AuditLog,
        reportName: "Audit Log",
        filters: { module: moduleKey || "", record: uKey || "" },
      },
    });
  };

  return (
    <div className={`evl-panel ${closing ? "evl-panel-closing" : ""}`} role="dialog" aria-label="Event log">
      <div className="evl-sheet-handle"><span /></div>
      <div className="evl-panel-header">
        <div>
          <div className="evl-eyebrow"><span className="evl-eyebrow-dot" />Event Log</div>
          <h3 className="evl-panel-title">Record History</h3>
          {data?.moduleName && <p className="evl-panel-sub">{formatModuleLabel(data.moduleName)}</p>}
        </div>
        <button type="button" className="evl-close" onClick={onClose} title="Close">
          <svg width="10" height="10" viewBox="0 0 11 11" fill="none">
            <path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          ESC
        </button>
      </div>

      <div className="evl-panel-body">
        {error && !data && (
          <div className="evl-error">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
              <path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            {error}
          </div>
        )}

        {!data && !error && (
          <div className="evl-loading">
            <div className="evl-loader-ring" />
            Loading history…
          </div>
        )}

        {data && (
          <>
            {data.createdAt && (
              <div className="evl-origin">
                <span className="evl-origin-icon">
                  <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
                    <path d="M6 1l1.4 2.9L10.5 4.3 8.2 6.5l.6 3.2L6 8.2 3.2 9.7l.6-3.2L1.5 4.3l3.1-.4L6 1z"
                      stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
                  </svg>
                </span>
                <div>
                  Created by <strong style={{ color: "var(--evl-text-1)" }}>{data.createdByName || "Unknown"}</strong>
                  {" "}on {formatDateTime(data.createdAt)}
                </div>
              </div>
            )}

            {(!data.events || data.events.length === 0) && (
              <div className="evl-empty">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M4 4h16v13H8l-4 4V4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
                No changes recorded yet for this record.
              </div>
            )}

            {data.events && data.events.length > 0 && (
              <div className="evl-timeline">
                {data.events.map((ev) => {
                  const isOpen = openEvents.has(ev.uKey);
                  const hasChanges = ev.changes && ev.changes.length > 0;
                  return (
                    <div className={`evl-event ${isOpen ? "evl-event-open" : ""}`} key={ev.uKey}>
                      <button
                        type="button"
                        className="evl-event-trigger"
                        onClick={() => hasChanges && toggleEvent(ev.uKey)}
                        aria-expanded={isOpen}
                        disabled={!hasChanges}
                      >
                        <div className="evl-event-head">
                          <div className="evl-event-head-left">
                            {hasChanges && (
                              <svg className="evl-event-chevron" width="10" height="10" viewBox="0 0 10 10" fill="none">
                                <path d="M3 1.5L7.5 5 3 8.5" stroke="currentColor" strokeWidth="1.6"
                                  strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                            <span className={`evl-badge ${ACTION_BADGE[ev.actionType] || ""}`}>{ev.actionLabel}</span>
                          </div>
                          <span className="evl-event-time" title={formatDateTime(ev.performedAt)}>
                            {relativeTime(ev.performedAt)}
                          </span>
                        </div>
                        <div className="evl-event-actor">{ev.performedByName || "Unknown user"}</div>
                        <div className="evl-event-meta">
                          <span>{formatDateTime(ev.performedAt)}</span>
                          {ev.browserLabel && (
                            <span className="evl-browser" title={ev.userAgent || ""}>
                              <BrowserIcon label={ev.browserLabel} />
                              {ev.browserLabel}
                            </span>
                          )}
                        </div>
                      </button>

                      {isOpen && hasChanges && (
                        <div className="evl-grid-wrap">
                          <div className="evl-grid-scroll">
                            <table className="evl-grid">
                              <thead>
                                <tr>
                                  <th>Field</th>
                                  <th>Old value</th>
                                  <th>New value</th>
                                </tr>
                              </thead>
                              <tbody>
                                {ev.changes.map((c, i) => (
                                  <tr key={i}>
                                    <td data-label="Field" className="evl-grid-field">
                                      {c.fieldLabel || c.fieldName}
                                    </td>
                                    <td data-label="Old value">
                                      {c.oldValue == null ? (
                                        <span className="evl-grid-empty">—</span>
                                      ) : (
                                        <span className="evl-grid-old">{c.oldValue}</span>
                                      )}
                                    </td>
                                    <td data-label="New value">
                                      {c.newValue == null ? (
                                        <span className="evl-grid-empty">—</span>
                                      ) : (
                                        <span className="evl-grid-new">{c.newValue}</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <div className="evl-panel-footer">
        <button type="button" className="evl-report-link" onClick={openAuditReport}>
          Open audit log report
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function formatModuleLabel(moduleKey) {
  return moduleKey
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
