import React, { useCallback, useEffect, useMemo, useState } from "react";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import "../../Styles/Inventory.css";
import "../../Styles/DynamicGrid.css";
import "../../Styles/GstShared/GstListPage.css";
import "../../Styles/FieldRep/FieldRep.css";
import PerformanceTab from "./FieldRepPerformance";
import DormantTab from "./FieldRepDormant";
import FieldPager from "./FieldPager";
import useLocalPaging from "./useLocalPaging";
import useModuleActions from "../../utils/useModuleActions";

const FIELD_REP_MODULE_ID = 31;

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const dayLabel = (d) => (d ? d.charAt(0) + d.slice(1).toLowerCase() : "Any day");
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString() : "—");
const isoDate = (d) => d.toISOString().slice(0, 10);

/** One place for the fetch + envelope handling every call here shares. */
async function call(path, options = {}) {
  const res = await apiClient(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // a non-JSON error body — fall through to the generic message
  }
  return {
    ok: json?.status === 200,
    message: json?.message || (res.ok ? "Done." : "Request failed."),
    data: json?.data,
  };
}

export default function FieldRep() {
  const [tab, setTab] = useState("reps");

  return (
    <div className="i-container">
      <h2 className="i-title">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="7" r="3.2" />
          <path d="M5.5 20a6.5 6.5 0 0113 0" />
          <path d="M19 4l1.6 1.6L23 3" />
        </svg>
        Field Reps
      </h2>

      <div className="dg-panel gst-panel">
        <div className="dg-panel-body gst-body">
          <div className="fr-tabs" role="tablist">
            <button role="tab" aria-selected={tab === "reps"} className={`fr-tab ${tab === "reps" ? "is-active" : ""}`} onClick={() => setTab("reps")}>
              Reps &amp; Beats
            </button>
            <button role="tab" aria-selected={tab === "visits"} className={`fr-tab ${tab === "visits" ? "is-active" : ""}`} onClick={() => setTab("visits")}>
              Visit History
            </button>
            <button role="tab" aria-selected={tab === "performance"} className={`fr-tab ${tab === "performance" ? "is-active" : ""}`} onClick={() => setTab("performance")}>
              Performance
            </button>
            <button role="tab" aria-selected={tab === "dormant"} className={`fr-tab ${tab === "dormant" ? "is-active" : ""}`} onClick={() => setTab("dormant")}>
              Not visited
            </button>
          </div>

          {tab === "reps" ? <RepsTab /> : tab === "visits" ? <VisitsTab /> : tab === "dormant" ? <DormantTab /> : <PerformanceTab />}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Reps & beats ───────────────────────── */

function RepsTab() {
  const [reps, setReps] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "" });
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  const [selected, setSelected] = useState(null);
  const [beat, setBeat] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [assign, setAssign] = useState({ retailerId: "", visitDay: "" });
  const { can } = useModuleActions(FIELD_REP_MODULE_ID);

  const repPaging = useLocalPaging(reps, (r) => `${r.name} ${r.email} ${r.phone || ""}`);
  const beatPaging = useLocalPaging(beat, (b) => `${b.shopName} ${b.retailerCode || ""} ${b.ownerName || ""} ${b.phone || ""}`);

  const say = (text, ok) => setMessage({ text, tone: ok ? "success" : "danger" });

  const loadReps = useCallback(async () => {
    const r = await call("/api/FieldRep/GetAll");
    if (r.ok) setReps(r.data || []);
  }, []);

  const loadBeat = useCallback(async (rep) => {
    const r = await call(`/api/FieldRep/GetBeat/${rep.uKey}`);
    setBeat(r.ok ? r.data || [] : []);
  }, []);

  useEffect(() => { loadReps(); }, [loadReps]);

  const addRep = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      say("Name and email are required.", false);
      return;
    }
    setBusy(true);
    try {
      const r = await call("/api/FieldRep/Add", { method: "POST", body: JSON.stringify(form) });
      say(r.ok ? "Field rep created — they've been emailed a link to set their password." : r.message, r.ok);
      if (r.ok) {
        setForm({ name: "", email: "", phone: "", address: "" });
        setShowForm(false);
        loadReps();
      }
    } finally {
      setBusy(false);
    }
  };

  const toggleRep = async (rep) => {
    const r = await call(`/api/FieldRep/Toggle/${rep.uKey}/${!rep.disabled}`, { method: "PUT" });
    say(r.message, r.ok);
    if (r.ok) loadReps();
  };

  const openBeat = async (rep) => {
    setSelected(rep);
    setAssign({ retailerId: "", visitDay: "" });
    await loadBeat(rep);
    if (retailers.length === 0) {
      const r = await call("/api/Retailer/Dropdown");
      setRetailers(r.ok ? r.data || [] : []);
    }
  };

  const assignRetailer = async () => {
    if (!assign.retailerId) {
      say("Pick a retailer to add to this beat.", false);
      return;
    }
    const r = await call("/api/FieldRep/AssignBeat", {
      method: "POST",
      body: JSON.stringify({ repUKey: selected.uKey, retailerId: Number(assign.retailerId), visitDay: assign.visitDay || null }),
    });
    say(r.message, r.ok);
    if (r.ok) {
      setAssign({ retailerId: "", visitDay: "" });
      await loadBeat(selected);
      loadReps();
    }
  };

  const removeBeat = async (entry) => {
    const r = await call(`/api/FieldRep/RemoveBeat/${entry.beatUKey}`, { method: "DELETE" });
    say(r.message, r.ok);
    if (r.ok) {
      await loadBeat(selected);
      loadReps();
    }
  };

  const assignable = useMemo(() => {
    const taken = new Set(beat.map((b) => b.retailerId));
    return retailers.filter((r) => !taken.has(r.id));
  }, [retailers, beat]);

  return (
    <section className="gst-section">
      <div className="gst-section-head">
        <h3 className="gst-section-title">Your field reps</h3>
        <div className="fr-inline">
          <span className="gst-count">{reps.length} rep{reps.length === 1 ? "" : "s"}</span>
          {can("Add") && (
            <button className="gst-btn gst-btn--primary gst-btn--sm" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Close" : "+ Add rep"}
            </button>
          )}
        </div>
      </div>

      {message && <div className={`gst-alert gst-alert--${message.tone}`}>{message.text}</div>}

      {showForm && can("Add") && (
        <div className="fr-form">
          <div className="fr-field">
            <label className="fr-label" htmlFor="fr-name">Name</label>
            <input id="fr-name" className="gst-search" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="fr-field">
            <label className="fr-label" htmlFor="fr-email">Email (their login)</label>
            <input id="fr-email" type="email" className="gst-search" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="fr-field">
            <label className="fr-label" htmlFor="fr-phone">Phone</label>
            <input id="fr-phone" className="gst-search" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="fr-field">
            <label className="fr-label" htmlFor="fr-address">Address</label>
            <input id="fr-address" className="gst-search" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="fr-form-actions">
            <button className="gst-btn gst-btn--primary" disabled={busy} onClick={addRep}>
              {busy ? "Creating…" : "Create rep"}
            </button>
          </div>
        </div>
      )}

      <div className="fr-search-row">
        <input className="gst-search" type="search" placeholder="Search name, email or phone…" aria-label="Search field reps"
          value={repPaging.searchInput} onChange={(e) => repPaging.setSearchInput(e.target.value)} />
      </div>

      <div className="gst-table-wrap">
        <table className="gst-table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Phone</th><th>Retailers on beat</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {repPaging.pageRows.map((rep) => (
              <tr key={rep.uKey} className={selected?.uKey === rep.uKey ? "fr-row-selected" : ""}>
                <td className="gst-cell-strong">{rep.name}</td>
                <td>{rep.email}</td>
                <td>{rep.phone || "—"}</td>
                <td>{rep.retailerCount}</td>
                <td>
                  <span className={`gst-badge gst-badge--${rep.disabled ? "danger" : "success"}`}>{rep.disabled ? "Disabled" : "Active"}</span>
                </td>
                <td className="gst-actions">
                  <button className="gst-btn gst-btn--sm" onClick={() => openBeat(rep)}>Beat</button>
                  {can("Disable") && (
                    <button className={`gst-btn gst-btn--sm ${rep.disabled ? "" : "gst-btn--danger"}`} onClick={() => toggleRep(rep)}>
                      {rep.disabled ? "Enable" : "Disable"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {reps.length === 0 && (
              <tr><td colSpan={6} className="gst-empty">No field reps yet — add one to start taking orders in the field.</td></tr>
            )}
            {reps.length > 0 && repPaging.total === 0 && (
              <tr><td colSpan={6} className="gst-empty">No reps match your search.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <FieldPager page={repPaging.page} totalPages={repPaging.totalPages} onChange={repPaging.setPage} label="Field reps pages" />

      {selected && (
        <div className="fr-sub">
          <div className="fr-sub-head">
            <h4 className="fr-sub-title">Beat for {selected.name}</h4>
            <button className="gst-btn gst-btn--sm gst-btn--ghost" onClick={() => setSelected(null)}>Close</button>
          </div>

          {can("Add") && <div className="fr-inline" style={{ marginBottom: 12 }}>
            <select className="gst-select" aria-label="Retailer to add" value={assign.retailerId} onChange={(e) => setAssign({ ...assign, retailerId: e.target.value })}>
              <option value="">Select retailer…</option>
              {assignable.map((r) => (
                <option key={r.id} value={r.id}>{r.shopName}{r.ownerName ? ` · ${r.ownerName}` : ""}</option>
              ))}
            </select>
            <select className="gst-select" aria-label="Visit day" value={assign.visitDay} onChange={(e) => setAssign({ ...assign, visitDay: e.target.value })}>
              <option value="">Any day</option>
              {DAYS.map((d) => <option key={d} value={d}>{dayLabel(d)}</option>)}
            </select>
            <button className="gst-btn gst-btn--primary gst-btn--sm" onClick={assignRetailer}>Add to beat</button>
          </div>}

          <div className="fr-search-row">
            <input className="gst-search" type="search" placeholder="Search retailer, code or owner…" aria-label="Search beat retailers"
              value={beatPaging.searchInput} onChange={(e) => beatPaging.setSearchInput(e.target.value)} />
          </div>

          <div className="gst-table-wrap">
            <table className="gst-table">
              <thead>
                <tr><th>Retailer</th><th>Code</th><th>Owner</th><th>Phone</th><th>Visit day</th><th></th></tr>
              </thead>
              <tbody>
                {beatPaging.pageRows.map((b) => (
                  <tr key={b.beatUKey}>
                    <td className="gst-cell-strong">{b.shopName}</td>
                    <td className="gst-cell-mono">{b.retailerCode}</td>
                    <td>{b.ownerName || "—"}</td>
                    <td>{b.phone || "—"}</td>
                    <td>{dayLabel(b.visitDay)}</td>
                    <td className="gst-actions">
                      {can("Disable") && <button className="gst-btn gst-btn--sm gst-btn--danger" onClick={() => removeBeat(b)}>Remove</button>}
                    </td>
                  </tr>
                ))}
                {beat.length === 0 && (
                  <tr><td colSpan={6} className="gst-empty">No retailers assigned yet.</td></tr>
                )}
                {beat.length > 0 && beatPaging.total === 0 && (
                  <tr><td colSpan={6} className="gst-empty">No retailers match your search.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <FieldPager page={beatPaging.page} totalPages={beatPaging.totalPages} onChange={beatPaging.setPage} label="Beat retailers pages" />
        </div>
      )}
    </section>
  );
}

/* ───────────────────────── Visit history ───────────────────────── */

function VisitsTab() {
  const today = useMemo(() => new Date(), []);
  const [from, setFrom] = useState(isoDate(new Date(today.getTime() - 7 * 86400000)));
  const [to, setTo] = useState(isoDate(today));
  const [repUKey, setRepUKey] = useState("");
  const [reps, setReps] = useState([]);
  const [visits, setVisits] = useState([]);
  const [error, setError] = useState("");
  const paging = useLocalPaging(visits, (v) => `${v.repName} ${v.retailerName || ""} ${v.note || ""}`);

  useEffect(() => {
    call("/api/FieldRep/GetAll").then((r) => r.ok && setReps(r.data || []));
  }, []);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ from, to });
    if (repUKey) params.set("repUKey", repUKey);
    const r = await call(`/api/FieldRep/Visits?${params.toString()}`);
    setError(r.ok ? "" : r.message);
    setVisits(r.ok ? r.data || [] : []);
  }, [from, to, repUKey]);

  useEffect(() => { load(); }, [load]);

  return (
    <section className="gst-section">
      <div className="gst-section-head">
        <h3 className="gst-section-title">GPS check-ins</h3>
        <span className="gst-count">{visits.length} visit{visits.length === 1 ? "" : "s"}</span>
      </div>

      <div className="gst-toolbar">
        <div className="fr-inline">
          <label className="fr-label" htmlFor="fr-from">From</label>
          <input id="fr-from" type="date" className="gst-search" value={from} onChange={(e) => setFrom(e.target.value)} />
          <label className="fr-label" htmlFor="fr-to">To</label>
          <input id="fr-to" type="date" className="gst-search" value={to} onChange={(e) => setTo(e.target.value)} />
          <select className="gst-select" aria-label="Filter by rep" value={repUKey} onChange={(e) => setRepUKey(e.target.value)}>
            <option value="">All reps</option>
            {reps.map((r) => <option key={r.uKey} value={r.uKey}>{r.name}</option>)}
          </select>
        </div>
      </div>

      <div className="fr-search-row">
        <input className="gst-search" type="search" placeholder="Search rep, retailer or note…" aria-label="Search visits"
          value={paging.searchInput} onChange={(e) => paging.setSearchInput(e.target.value)} />
      </div>

      {error && <div className="gst-alert gst-alert--danger">{error}</div>}

      <div className="gst-table-wrap" style={{ marginTop: 14 }}>
        <table className="gst-table">
          <thead>
            <tr><th>When</th><th>Rep</th><th>Retailer</th><th>Location</th><th>Accuracy</th><th>Note</th></tr>
          </thead>
          <tbody>
            {paging.pageRows.map((v) => (
              <tr key={v.uKey}>
                <td className="gst-cell-muted">{fmtDateTime(v.capturedAt)}</td>
                <td className="gst-cell-strong">{v.repName}</td>
                <td>{v.retailerName}</td>
                <td>
                  <a className="fr-map-link" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps?q=${v.latitude},${v.longitude}`}>
                    {Number(v.latitude).toFixed(5)}, {Number(v.longitude).toFixed(5)}
                  </a>
                </td>
                <td>{v.accuracyM != null ? `±${Math.round(v.accuracyM)} m` : "—"}</td>
                <td>{v.note || "—"}</td>
              </tr>
            ))}
            {visits.length === 0 && (
              <tr><td colSpan={6} className="gst-empty">No check-ins in this period.</td></tr>
            )}
            {visits.length > 0 && paging.total === 0 && (
              <tr><td colSpan={6} className="gst-empty">No check-ins match your search.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <FieldPager page={paging.page} totalPages={paging.totalPages} onChange={paging.setPage} label="Visit history pages" />
    </section>
  );
}
