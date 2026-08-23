import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../Styles/Report/Report.css";
import LedgerCanvas from "./LedgerCanvas";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

/* ── Per-volume spine colour, cycling like packaging lot bands ──────── */
const ACCENTS = [
  "#d4af37", "#3b82f6", "#10b981", "#ef4444", "#8b5cf6", "#f59e0b",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#14b8a6", "#a855f7",
];
const getAccent = (i) => ACCENTS[i % ACCENTS.length];

/* ── One shelved report, rendered as a small closed volume ──────────── */
function Volume({ report, index, onOpen }) {
  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    e.currentTarget.style.setProperty("--lg-tx", px.toFixed(3));
    e.currentTarget.style.setProperty("--lg-ty", py.toFixed(3));
  };
  const handleLeave = (e) => {
    e.currentTarget.style.setProperty("--lg-tx", 0);
    e.currentTarget.style.setProperty("--lg-ty", 0);
  };

  const accent = getAccent(index);
  const marks = Array.from({ length: 14 }, (_, i) => ((index * 11 + i * 7) % 3) + 1);

  return (
    <div
      className="lg-volume is-shelved"
      style={{ "--lg-accent": accent, "--lg-i": index }}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(report.name)}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(report.name); }}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      <div className="lg-volume-leaf">
        <span className="lg-volume-emboss">VOL · {String(index + 1).padStart(2, "0")}</span>
        <h3 className="lg-volume-heading">{report.name}</h3>
        <p className="lg-volume-blurb">{report.description}</p>
        <div className="lg-volume-marks">
          {marks.map((w, i) => <span key={i} style={{ width: `${w * 2}px` }} />)}
        </div>
      </div>

      <div className="lg-volume-face">
        <div className="lg-volume-spine" />
        <div className="lg-volume-stitch" />
        <div className="lg-volume-cover">
          <div className="lg-volume-cover-mark">{String(index + 1).padStart(2, "0")}</div>
          <div className="lg-volume-cover-heading">{report.name}</div>
          <div className="lg-volume-cover-note">Tap to open</div>
        </div>
      </div>

      <button className="lg-volume-open" onClick={(e) => { e.stopPropagation(); onOpen(report.name); }}>
        <span>Open</span>
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
          <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

/* ── One report in the manifest / index list view ────────────────────── */
function Entry({ report, index, onOpen }) {
  const accent = getAccent(index);

  return (
    <div
      className="lg-entry is-shelved"
      style={{ "--lg-accent": accent, "--lg-i": index }}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(report.name)}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(report.name); }}
    >
      <span className="lg-entry-folio">{String(index + 1).padStart(2, "0")}</span>
      <div className="lg-entry-body">
        <h3>{report.name}</h3>
        <p>{report.description}</p>
      </div>
      <button className="lg-entry-go" onClick={(e) => { e.stopPropagation(); onOpen(report.name); }}>
        Open
      </button>
      <span className="lg-entry-rule" />
    </div>
  );
}

/* ── Volumes / Index toggle ───────────────────────────────────────────── */
function ModeToggle({ mode, onChange }) {
  return (
    <div className="lg-mode">
      <button className={`lg-mode-key ${mode === "shelf" ? "active" : ""}`} onClick={() => onChange("shelf")}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
          <rect x="1" y="2" width="4" height="12" rx="1" />
          <rect x="6" y="2" width="4" height="12" rx="1" />
          <rect x="11" y="2" width="4" height="12" rx="1" />
        </svg>
        <span>Volumes</span>
      </button>
      <button className={`lg-mode-key ${mode === "index" ? "active" : ""}`} onClick={() => onChange("index")}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
          <rect x="1" y="2" width="14" height="2.5" rx="1.25" />
          <rect x="1" y="6.75" width="14" height="2.5" rx="1.25" />
          <rect x="1" y="11.5" width="14" height="2.5" rx="1.25" />
        </svg>
        <span>Index</span>
      </button>
      <div className={`lg-mode-glide ${mode}`} />
    </div>
  );
}

const roleId = localStorage.getItem("roleId");

/* ── Main ──────────────────────────────────────────────────────────────── */
export default function ReportsDashboard() {
  const moduleId = 7;
  const apiUrl    = `${API_BASE_URL}/api/Reports/GetAllReports`;
  const accessApi = `${API_BASE_URL}/api/Access/GetUserModuleAccess/${moduleId}/${roleId}`;

  const [search, setSearch] = useState("");
  const [reports, setReports] = useState([]);
  const [allowedReportKeys, setAllowedReportKeys] = useState([]);
  const [mode, setMode] = useState(() => localStorage.getItem("rpt-view") === "list" ? "index" : "shelf");
  const [pinned, setPinned] = useState(false);
  const [turningTo, setTurningTo] = useState(null);
  const navigate = useNavigate();

  const handleModeChange = (m) => {
    setMode(m);
    localStorage.setItem("rpt-view", m === "index" ? "list" : "grid");
  };

  useEffect(() => {
    const onScroll = () => setPinned(window.scrollY > 160);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    apiClient(accessApi, { method: "GET", headers: { "Content-Type": "application/json" } })
      .then(r => r.json())
      .then(res => {
        if (res.status === 200 && Array.isArray(res.data))
          setAllowedReportKeys(res.data.flatMap(p => p.split("/")).map(s => s.toLowerCase()));
      })
      .catch(err => console.error("Access fetch error:", err));
  }, [accessApi]);

  useEffect(() => {
    apiClient(apiUrl, { method: "GET", headers: { "Content-Type": "application/json" } })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(res => {
        if (res.status === 200 && res.data) {
          const dataObj = res.data;
          const list = Array.isArray(dataObj)
            ? dataObj
            : typeof dataObj === "object"
              ? Object.values(dataObj).find(v => Array.isArray(v)) || []
              : [];
          setReports(list.filter(r => !r.disabled));
        }
      })
      .catch(err => console.error("Reports fetch error:", err));
  }, [apiUrl]);

  const filtered = useMemo(() => reports.filter(r => {
    const name = r.name.toLowerCase();
    const access = allowedReportKeys.length === 0 || allowedReportKeys.some(k => name.includes(k));
    const match = name.includes(search.toLowerCase());
    return access && match;
  }), [reports, allowedReportKeys, search]);

  const handleOpen = (name) => {
    if (turningTo) return;
    setTurningTo(name);
  };

  const handleTurnEnd = (e) => {
    if (e.target !== e.currentTarget) return;
    navigate("/master/reports/open", { state: { reportName: turningTo } });
  };

  return (
    <div className="lg-desk">
      <LedgerCanvas variant="shelf" />

      <div className="lg-inner">
        <div className="lg-masthead">
          <div>
            <div className="lg-masthead-stamp"><span /> Reports Ledger · Live</div>
            <h1 className="lg-masthead-heading">Business <em>Reports</em></h1>
            <p className="lg-masthead-note">Every volume on the shelf — sales, purchase, inventory and finance, bound and ready to open.</p>
          </div>
          <div className="lg-tally">
            <span className="lg-tally-num">{String(filtered.length).padStart(2, "0")}</span>
            <span className="lg-tally-lbl">Available<br />Volumes</span>
          </div>
        </div>

        <div className={`lg-console ${pinned ? "is-pinned" : ""}`}>
          <div className="lg-seek">
            <svg width="14" height="14" viewBox="0 -960 960 960" fill="currentColor">
              <path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z" />
            </svg>
            <input
              type="text"
              placeholder="Search the shelf..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="lg-console-num">
            <b>{filtered.length}</b>
            <span>Shown</span>
          </div>

          <ModeToggle mode={mode} onChange={handleModeChange} />
        </div>

        {filtered.length === 0 ? (
          <div className="lg-void">
            <svg width="34" height="34" viewBox="0 -960 960 960" fill="currentColor">
              <path d="M320-240h320v-80H320v80Zm0-160h320v-80H320v80ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520Z" />
            </svg>
            <strong>No volumes found</strong>
            {search && <span>Try a different search term</span>}
          </div>
        ) : mode === "shelf" ? (
          <div className="lg-shelf">
            {filtered.map((report, i) => (
              <Volume key={report.reportCode} report={report} index={i} onOpen={handleOpen} />
            ))}
          </div>
        ) : (
          <div className="lg-index">
            {filtered.map((report, i) => (
              <Entry key={report.reportCode} report={report} index={i} onOpen={handleOpen} />
            ))}
          </div>
        )}
      </div>

      {turningTo && (
        <div className="lg-turn" aria-hidden="true">
          <div className="lg-turn-sheet" onAnimationEnd={handleTurnEnd}>
            <span className="lg-turn-mark">{turningTo}</span>
          </div>
        </div>
      )}
    </div>
  );
}
