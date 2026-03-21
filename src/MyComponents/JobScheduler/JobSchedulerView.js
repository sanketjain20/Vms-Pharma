import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../../Styles/JobScheduler/JobSchedulerView.css";

/* ── Field ────────────────────────────────────────────────── */
function Field({ label, value, full }) {
  return (
    <div className={`jsv-field ${full ? "jsv-field-full" : ""}`}>
      <div className="jsv-field-label">{label}</div>
      <div className="jsv-field-value">{value ?? "Not Set"}</div>
    </div>
  );
}

/* ── Section ──────────────────────────────────────────────── */
function Section({ title, icon, children }) {
  return (
    <div className="jsv-section">
      <div className="jsv-section-head">
        <span className="jsv-section-icon">{icon}</span>
        <span className="jsv-section-title">{title}</span>
      </div>
      <div className="jsv-section-grid">{children}</div>
    </div>
  );
}

/* ── Main ─────────────────────────────────────────────────── */
export default function JobSchedulerView() {
  const { id }      = useParams();
  const navigate    = useNavigate();
  const [job, setJob]       = useState(null);
  const [loading, setLoading] = useState(true);

  const formatTime = (time) => {
    if (!time) return "—";
    const [h, m] = time.split(":");
    let hr = parseInt(h, 10);
    const ampm = hr >= 12 ? "PM" : "AM";
    hr = hr % 12 || 12;
    return `${hr}:${m} ${ampm}`;
  };

  const formatDate = (date) => {
    if (!date) return "Never";
    return new Date(date).toLocaleString();
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res    = await fetch(`http://localhost:8080/api/SystemJob/GetJobById/${id}`, { credentials: "include" });
        const result = await res.json();
        if (result.status === 200) setJob(result.data);
      } catch (e) { console.error("Error loading job:", e); }
      finally { setLoading(false); }
    };
    load();
  }, [id]);

  /* Loading */
  if (loading) return (
    <div className="jsv-page">
      <div className="jsv-center">
        <span className="jsv-loading-text">Loading Job Details…</span>
      </div>
    </div>
  );

  /* Not found */
  if (!job) return (
    <div className="jsv-page">
      <div className="jsv-center">
        <div className="jsv-not-found">
          <p>Job record not found.</p>
          <button className="jsv-back-btn" onClick={() => navigate(-1)}>← Go Back</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="jsv-page">
      <div className="jsv-inner">

        {/* ── Header ─────────────────────────────────────── */}
        <div className="jsv-header">
          <div className="jsv-header-left">
            <div className="jsv-eyebrow">
              <span className="jsv-eyebrow-dot" />
              Job Details
            </div>
            <h1 className="jsv-title">{job.jobName}</h1>
            <div className="jsv-code-row">
              <span className="jsv-code-pill">{job.jobCode}</span>
              <span className={`jsv-status-badge ${job.enabled ? "jsv-enabled" : "jsv-disabled"}`}>
                <span className="jsv-status-dot" />
                {job.enabled ? "Running" : "Stopped"}
              </span>
            </div>
          </div>
          <button className="jsv-back-btn" onClick={() => navigate(-1)}>
            <svg width="13" height="13" viewBox="0 -960 960 960" fill="currentColor">
              <path d="M400-80 80-400l320-320 57 56-224 224h647v80H233l224 224-57 56Z"/>
            </svg>
            Back to List
          </button>
        </div>

        <div className="jsv-divider" />

        {/* ── Sections ───────────────────────────────────── */}
        <div className="jsv-sections">

          <Section
            title="General Information"
            icon={<svg width="14" height="14" viewBox="0 -960 960 960" fill="currentColor"><path d="M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/></svg>}
          >
            <Field label="Job Code" value={job.jobCode} />
            <Field label="Job Name" value={job.jobName} />
            <Field label="Status" value={
              <span className={`jsv-field-badge ${job.enabled ? "jsv-fb-green" : "jsv-fb-red"}`}>
                {job.enabled ? "ENABLED" : "DISABLED"}
              </span>
            } />
            <Field label="Description" value={job.jobDescription} full />
          </Section>

          <Section
            title="Schedule & Timing"
            icon={<svg width="14" height="14" viewBox="0 -960 960 960" fill="currentColor"><path d="m612-292 56-56-148-148v-184h-80v216l172 172ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/></svg>}
          >
            <Field label="Frequency"           value={job.frequency} />
            <Field label="Scheduled Time"      value={formatTime(job.runTime)} />
            <Field label="Last Successful Run" value={formatDate(job.lastRunAt)} />
            <Field label="Next Scheduled Run"  value={formatDate(job.nextRunAt)} />
          </Section>

          <Section
            title="Notifications"
            icon={<svg width="14" height="14" viewBox="0 -960 960 960" fill="currentColor"><path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm320-280L160-640v400h640v-400L480-440Zm0-80 320-200H160l320 200Z"/></svg>}
          >
            <Field label="Email on Success" value={job.successEmail} />
            <Field label="Email on Failure" value={job.failureEmail} />
          </Section>

          <Section
            title="Audit Trail"
            icon={<svg width="14" height="14" viewBox="0 -960 960 960" fill="currentColor"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm80-80h160v-80H280v80Zm0-160h400v-80H280v80Zm0-160h400v-80H280v80Z"/></svg>}
          >
            <Field label="Created At"   value={formatDate(job.createdAt)} />
            <Field label="Last Updated" value={formatDate(job.updatedAt)} />
          </Section>

        </div>
      </div>
    </div>
  );
}
