import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import "../../Styles/JobScheduler/JobScheduler.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

/* ── helpers ──────────────────────────────────────────────── */
const formatTime = (time) => {
  if (!time) return "—";
  const [h, m] = time.split(":");
  let hr = parseInt(h, 10);
  const ampm = hr >= 12 ? "PM" : "AM";
  hr = hr % 12 || 12;
  return m === "00" ? `${hr} ${ampm}` : `${hr}:${m} ${ampm}`;
};
const formatDateShort = (d) => (d ? new Date(d).toLocaleString() : "—");

/* ── Confirm Modal ────────────────────────────────────────── */
function ConfirmModal({ jobName, onConfirm, onCancel }) {
  return (
    <div className="js-modal-overlay" onClick={onCancel}>
      <div className="js-modal" onClick={(e) => e.stopPropagation()}>
        <div className="js-modal-icon">
          <svg width="26" height="26" viewBox="0 -960 960 960" fill="currentColor">
            <path d="m612-292 56-56-148-148v-184h-80v216l172 172ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z" />
          </svg>
        </div>
        <h3 className="js-modal-title">Execute Job?</h3>
        {jobName && <p className="js-modal-job">{jobName}</p>}
        <p className="js-modal-desc">This will manually trigger the job immediately. Continue?</p>
        <div className="js-modal-actions">
          <button className="js-modal-cancel" onClick={onCancel}>Cancel</button>
          <button className="js-modal-confirm" onClick={onConfirm}>
            <svg width="13" height="13" viewBox="0 -960 960 960" fill="currentColor">
              <path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z" />
            </svg>
            Yes, Execute
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Status badge ─────────────────────────────────────────── */
function StatusBadge({ enabled }) {
  return (
    <span className={`js-status ${enabled ? "js-status--on" : "js-status--off"}`}>
      <span className="js-status-dot" />
      {enabled ? "Enabled" : "Disabled"}
    </span>
  );
}

/* ── Actions (shared by row + card) ──────────────────────────*/
function JobActions({ job, runningId, onView, onEdit, onToggle, onRunRequest }) {
  return (
    <div className="js-actions">
      <button className="js-btn js-btn--view" onClick={() => onView(job.id)}>View</button>
      <button className="js-btn js-btn--edit" onClick={() => onEdit(job.id)}>Edit</button>
      <button className="js-btn js-btn--toggle" onClick={() => onToggle(job)}>
        {job.enabled ? "Disable" : "Enable"}
      </button>
      <button
        className="js-btn js-btn--run"
        onClick={() => onRunRequest(job.id)}
        disabled={runningId === job.id}
      >
        {runningId === job.id ? (
          <>
            <span className="js-spin" />
            Running…
          </>
        ) : (
          "Run Now"
        )}
      </button>
    </div>
  );
}

/* ── Table row (desktop / tablet) ────────────────────────────*/
function JobRow({ job, ...actionProps }) {
  return (
    <tr className="js-row">
      <td><span className="js-code">{job.jobCode}</span></td>
      <td className="js-name">{job.jobName}</td>
      <td><span className="js-freq">{job.frequency}</span></td>
      <td className="js-time">{formatTime(job.runTime)}</td>
      <td><StatusBadge enabled={job.enabled} /></td>
      <td className="js-last-run">{formatDateShort(job.lastRunAt)}</td>
      <td><JobActions job={job} {...actionProps} /></td>
    </tr>
  );
}

/* ── Card (phone / narrow tablet) ────────────────────────────*/
function JobCard({ job, ...actionProps }) {
  return (
    <div className="js-card">
      <div className="js-card-top">
        <div className="js-card-heading">
          <span className="js-code">{job.jobCode}</span>
          <span className="js-card-name">{job.jobName}</span>
        </div>
        <StatusBadge enabled={job.enabled} />
      </div>
      <div className="js-card-meta">
        <div className="js-card-meta-item">
          <span className="js-card-meta-label">Frequency</span>
          <span className="js-card-meta-value">{job.frequency}</span>
        </div>
        <div className="js-card-meta-item">
          <span className="js-card-meta-label">Run Time</span>
          <span className="js-card-meta-value">{formatTime(job.runTime)}</span>
        </div>
        <div className="js-card-meta-item js-card-meta-item--full">
          <span className="js-card-meta-label">Last Run</span>
          <span className="js-card-meta-value">{formatDateShort(job.lastRunAt)}</span>
        </div>
      </div>
      <JobActions job={job} {...actionProps} />
    </div>
  );
}

/* ── Main ─────────────────────────────────────────────────── */
export default function JobSchedulerPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [runningId, setRunningId] = useState(null);
  const [confirmRunId, setConfirmRunId] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state?.toastMessage) {
      toast.success(location.state.toastMessage);
      navigate(location.pathname, { replace: true });
    }
  }, [location, navigate]);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await apiClient(`${API_BASE_URL}/api/SystemJob/GetAllJobs`);
      const result = await res.json();
      if (result.status === 200) setJobs(result.data || []);
      else throw new Error(result.message);
    } catch (e) {
      toast.error(e.message || "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchJobs(); }, []);

  // Enable/Disable from the grid: there is no /ToggleJob endpoint on the
  // backend, only GetAllJobs / GetJobById / UpdateJob / RunJob. UpdateJob is a
  // full replace, so rebuild the whole payload from the row's own data
  // (already present from GetAllJobs) with just `enabled` flipped.
  const toggleJob = async (job) => {
    setLoading(true);
    try {
      const payload = {
        jobDescription: job.jobDescription,
        frequency: job.frequency,
        runTime: job.runTime,
        daysOfWeek: job.daysOfWeek,
        intervalDays: job.intervalDays,
        enabled: !job.enabled,
        successEmail: job.successEmail,
        failureEmail: job.failureEmail,
      };
      const res = await apiClient(`${API_BASE_URL}/api/SystemJob/UpdateJob/${job.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (result.status === 200) {
        toast.success(result.message || "Job status updated");
        fetchJobs();
      } else throw new Error(result.message);
    } catch (e) {
      toast.error(e.message || "Failed to update job status");
    } finally {
      setLoading(false);
    }
  };

  const executeRunNow = async (id) => {
    setConfirmRunId(null);
    setRunningId(id);
    try {
      const res = await apiClient(`${API_BASE_URL}/api/SystemJob/RunJob/${id}`, { method: "POST" });
      const result = await res.json();
      if (result.status === 200) {
        toast.success(result.message || "Job executed successfully");
        fetchJobs();
      } else throw new Error(result.message);
    } catch (e) {
      toast.error(e.message || "Execution failed");
    } finally {
      setRunningId(null);
    }
  };

  const filtered = jobs.filter(
    (j) =>
      j.jobName.toLowerCase().includes(search.toLowerCase()) ||
      j.jobCode.toLowerCase().includes(search.toLowerCase())
  );

  const confirmJob = jobs.find((j) => j.id === confirmRunId);

  const actionProps = {
    runningId,
    onView: (id) => navigate(`/master/job-scheduler/view/${id}`),
    onEdit: (id) => navigate(`/master/job-scheduler/edit/${id}`),
    onToggle: toggleJob,
    onRunRequest: (id) => setConfirmRunId(id),
  };

  return (
    <div className="js-page">
      <div className="js-orb js-orb-a" />
      <div className="js-orb js-orb-b" />

      <div className="js-inner">
        <div className="js-header">
          <div className="js-header-left">
            <div className="js-eyebrow">
              <span className="js-eyebrow-dot" />
              System Automation
            </div>
            <h1 className="js-title">
              <span className="js-title-dim">Job</span> Scheduler
            </h1>
            <p className="js-subtitle">Manage, monitor and execute scheduled system jobs</p>
          </div>

          <div className="js-header-right">
            <div className="js-count-pill">
              <span className="js-count-num">{filtered.length}</span>
              <span className="js-count-label">Jobs</span>
            </div>
            <div className="js-topbar">
              <div className="js-search-wrap">
                <svg className="js-search-icon" width="13" height="13" viewBox="0 -960 960 960" fill="currentColor">
                  <path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56Z" />
                </svg>
                <input
                  className="js-search"
                  type="text"
                  placeholder="Search by name or code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button className="js-refresh-btn" onClick={fetchJobs} disabled={loading}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 -960 960 960"
                  fill="currentColor"
                  className={loading ? "js-spin-icon" : ""}
                >
                  <path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z" />
                </svg>
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="js-divider" />

        {loading && !jobs.length ? (
          <div className="js-loading">
            <span className="js-loading-spin" />
            <span>Loading jobs…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="js-empty">
            <svg width="30" height="30" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="12" stroke="currentColor" strokeWidth="1.4" opacity="0.35" />
              <path d="M10 14h8M14 10v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.55" />
            </svg>
            <p>No jobs found</p>
          </div>
        ) : (
          <>
            <div className="js-table-wrap">
              <table className="js-table">
                <thead>
                  <tr>
                    {["Job Code", "Job Name", "Frequency", "Run Time", "Status", "Last Run", "Actions"].map((h) => (
                      <th key={h} className="js-th">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((job) => (
                    <JobRow key={job.id} job={job} {...actionProps} />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="js-cards">
              {filtered.map((job) => (
                <JobCard key={job.id} job={job} {...actionProps} />
              ))}
            </div>
          </>
        )}
      </div>

      {confirmRunId && (
        <ConfirmModal
          jobName={confirmJob?.jobName}
          onConfirm={() => executeRunNow(confirmRunId)}
          onCancel={() => setConfirmRunId(null)}
        />
      )}
    </div>
  );
}
