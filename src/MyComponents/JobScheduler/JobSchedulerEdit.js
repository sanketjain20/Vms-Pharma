import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../../Styles/JobScheduler/JobSchedulerEdit.css";

/* ── Layout helpers ───────────────────────────────────────── */
const Section = ({ title, icon, children, delay = 0 }) => (
  <div className="jse-section" style={{ animationDelay: `${delay}s` }}>
    <div className="jse-section-head">
      <span className="jse-section-icon">{icon}</span>
      <span className="jse-section-title">{title}</span>
    </div>
    <div className="jse-grid">{children}</div>
  </div>
);

const Field = ({ label, children, full }) => (
  <div className={`jse-field ${full ? "jse-field-full" : ""}`}>
    <label className="jse-label">{label}</label>
    {children}
  </div>
);

/* ── Constants ────────────────────────────────────────────── */
const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const formatDate = (d) => (d ? new Date(d).toLocaleString() : "Never");

/* ── Main ─────────────────────────────────────────────────── */
export default function JobSchedulerEdit() {
  const { id }    = useParams();
  const navigate  = useNavigate();

  const [job, setJob]                 = useState(null);
  const [selectedDays, setSelectedDays] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);

  /* Fetch */
  useEffect(() => {
    (async () => {
      try {
        const res    = await fetch(`http://localhost:8080/api/SystemJob/GetJobById/${id}`, { credentials: "include" });
        const result = await res.json();
        if (result.status === 200) {
          const j = result.data;
          setJob({ ...j, runTime: j.runTime?.substring(0, 5) || "", intervalDays: j.intervalDays || "" });
          if (j.daysOfWeek) setSelectedDays(j.daysOfWeek.split(","));
        }
      } finally { setLoading(false); }
    })();
  }, [id]);

  /* Clear irrelevant values on frequency change */
  useEffect(() => {
    if (!job) return;
    if (job.frequency === "DAILY")    { setSelectedDays([]); setJob(p => ({ ...p, intervalDays: "" })); }
    if (job.frequency === "WEEKLY")   { setJob(p => ({ ...p, intervalDays: "" })); }
    if (job.frequency === "INTERVAL") { setSelectedDays([]); }
  }, [job?.frequency]);

  const change    = (key, val) => setJob(p => ({ ...p, [key]: val }));
  const toggleDay = (day) => setSelectedDays(p => p.includes(day) ? p.filter(d => d !== day) : [...p, day]);

  /* Save */
  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        jobDescription: job.jobDescription,
        frequency:      job.frequency,
        runTime:        job.runTime,
        daysOfWeek:     job.frequency === "WEEKLY"   ? selectedDays.join(",") : null,
        intervalDays:   job.frequency === "INTERVAL" ? Number(job.intervalDays) : null,
        enabled:        job.enabled,
        successEmail:   job.successEmail,
        failureEmail:   job.failureEmail,
      };
      const res    = await fetch(`http://localhost:8080/api/SystemJob/UpdateJob/${id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      navigate("/master/job-scheduler", {
        state: { toastMessage: result.status === 200 ? "Job updated successfully" : result.message },
      });
    } catch {
      navigate("/master/job-scheduler", { state: { toastMessage: "Update failed" } });
    } finally { setSaving(false); }
  };

  /* States */
  if (loading) return (
    <div className="jse-page">
      <div className="jse-center">
        <span className="jse-spin" />
        <span className="jse-loading-text">Loading Job…</span>
      </div>
    </div>
  );

  if (!job) return (
    <div className="jse-page">
      <div className="jse-center">
        <p className="jse-loading-text">Job not found.</p>
        <button className="jse-cancel-btn" onClick={() => navigate(-1)}>← Go Back</button>
      </div>
    </div>
  );

  return (
    <div className="jse-page">

      {/* subtle bg grid */}
      <div className="jse-grid-bg" />

      <div className="jse-inner">

        {/* ── Header ─────────────────────────────────────── */}
        <div className="jse-header">
          <div className="jse-header-left">
            <div className="jse-eyebrow">
              <span className="jse-eyebrow-dot" />
              Edit Job Configuration
            </div>
            <h1 className="jse-title">
              <span className="jse-title-dim">{job.jobName}</span>
            </h1>
            <div className="jse-sub-row">
              <span className="jse-code-pill">{job.jobCode}</span>
              <span className="jse-job-name">Edit Job Configuration</span>
            </div>
          </div>
          <button className="jse-cancel-btn" onClick={() => navigate(-1)}>
            <svg width="13" height="13" viewBox="0 -960 960 960" fill="currentColor">
              <path d="M400-80 80-400l320-320 57 56-224 224h647v80H233l224 224-57 56Z"/>
            </svg>
            Cancel
          </button>
        </div>

        {/* ── Divider ────────────────────────────────────── */}
        <div className="jse-divider" />

        {/* ── Sections ───────────────────────────────────── */}

        {/* General */}
        <Section title="General Information" delay={0.05}
          icon={<svg width="15" height="15" viewBox="0 -960 960 960" fill="currentColor"><path d="M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/></svg>}
        >
          <Field label="Job Code">
            <div className="jse-value">{job.jobCode}</div>
          </Field>
          <Field label="Job Name">
            <div className="jse-value">{job.jobName}</div>
          </Field>
          <Field label="Description" full>
            <textarea
              className="jse-input"
              value={job.jobDescription || ""}
              onChange={e => change("jobDescription", e.target.value)}
            />
          </Field>
          <Field label="Current Status">
            <span className={`jse-badge ${job.enabled ? "jse-badge-on" : "jse-badge-off"}`}>
              <span className="jse-badge-dot" />
              {job.enabled ? "Running" : "Stopped"}
            </span>
          </Field>
          <Field label="Change Status">
            <select className="jse-input jse-select" value={job.enabled} onChange={e => change("enabled", e.target.value === "true")}>
              <option value={true}>Running</option>
              <option value={false}>Stopped</option>
            </select>
          </Field>
        </Section>

        {/* Schedule */}
        <Section title="Schedule & Timing" delay={0.12}
          icon={<svg width="15" height="15" viewBox="0 -960 960 960" fill="currentColor"><path d="m612-292 56-56-148-148v-184h-80v216l172 172ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/></svg>}
        >
          <Field label="Frequency">
            <select className="jse-input jse-select" value={job.frequency} onChange={e => change("frequency", e.target.value)}>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="INTERVAL">Interval</option>
            </select>
          </Field>
          <Field label="Run Time">
            <input type="time" className="jse-input" value={job.runTime} onChange={e => change("runTime", e.target.value)} />
          </Field>

          {job.frequency === "WEEKLY" && (
            <Field label="Days of Week" full>
              <div className="jse-days">
                {DAYS.map(day => (
                  <div
                    key={day}
                    className={`jse-day ${selectedDays.includes(day) ? "active" : ""}`}
                    onClick={() => toggleDay(day)}
                  >
                    {day}
                  </div>
                ))}
              </div>
            </Field>
          )}

          {job.frequency === "INTERVAL" && (
            <Field label="Interval (Days)">
              <input
                type="number" className="jse-input"
                value={job.intervalDays || ""}
                onChange={e => change("intervalDays", e.target.value)}
              />
            </Field>
          )}

          <Field label="Last Run">
            <div className="jse-value">{formatDate(job.lastRunAt)}</div>
          </Field>
          <Field label="Next Run">
            <div className="jse-value">{formatDate(job.nextRunAt)}</div>
          </Field>
        </Section>

        {/* Notifications */}
        <Section title="Notifications" delay={0.19}
          icon={<svg width="15" height="15" viewBox="0 -960 960 960" fill="currentColor"><path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm320-280L160-640v400h640v-400L480-440Zm0-80 320-200H160l320 200Z"/></svg>}
        >
          <Field label="Success Email">
            <input className="jse-input" value={job.successEmail || ""} onChange={e => change("successEmail", e.target.value)} />
          </Field>
          <Field label="Failure Email">
            <input className="jse-input" value={job.failureEmail || ""} onChange={e => change("failureEmail", e.target.value)} />
          </Field>
        </Section>

        {/* History */}
        <Section title="Audit Trail" delay={0.26}
          icon={<svg width="15" height="15" viewBox="0 -960 960 960" fill="currentColor"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm80-80h160v-80H280v80Zm0-160h400v-80H280v80Zm0-160h400v-80H280v80Z"/></svg>}
        >
          <Field label="Created At">
            <div className="jse-value">{formatDate(job.createdAt)}</div>
          </Field>
          <Field label="Last Updated">
            <div className="jse-value">{formatDate(job.updatedAt)}</div>
          </Field>
        </Section>

        {/* ── Save bar ───────────────────────────────────── */}
        <div className="jse-save-bar">
          <button className="jse-cancel-btn" onClick={() => navigate(-1)}>Discard Changes</button>
          <button className="jse-save-btn" onClick={save} disabled={saving}>
            {saving
              ? <><span className="jse-spin jse-spin-sm" />Saving…</>
              : <><svg width="14" height="14" viewBox="0 -960 960 960" fill="currentColor"><path d="M840-680v480q0 33-23.5 56.5T760-120H200q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h480l160 160Zm-80 34L646-760H200v560h560v-446ZM480-240q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35ZM240-560h360v-160H240v160Z"/></svg>Save Changes</>
            }
          </button>
        </div>

      </div>
    </div>
  );
}
