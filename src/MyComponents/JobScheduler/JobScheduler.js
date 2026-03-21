import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../../Styles/JobScheduler/JobScheduler.css";

/* ── Canvas background ────────────────────────────────────── */
function JobCanvas() {
  const cvRef = useRef(null);
  useEffect(() => {
    const cv = cvRef.current;
    const ctx = cv.getContext("2d");
    let W, H, raf, t = 0;
    const stars = Array.from({ length: 130 }, () => ({
      x: Math.random() * 2200, y: Math.random() * 3000,
      r: Math.random() * 1.1 + 0.2,
      a: Math.random() * 0.65 + 0.15,
      tw: Math.random() * 2.5 + 0.8, tp: Math.random() * Math.PI * 2,
    }));
    let shooters = [];
    const addS = () => shooters.push({
      x: Math.random() * (W || 1200) * 0.8, y: Math.random() * (H || 700) * 0.5,
      vx: Math.random() * 7 + 3, vy: Math.random() * 3 + 1,
      len: Math.random() * 110 + 50, a: 1, hue: Math.random() * 60 + 190,
    });
    const si = setInterval(addS, 2600);
    const resize = () => { W = cv.width = window.innerWidth; H = cv.height = window.innerHeight; };
    resize(); window.addEventListener("resize", resize);
    const drawGrid = () => {
      ctx.strokeStyle = "rgba(255,255,255,0.02)"; ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    };
    const loop = () => {
      ctx.clearRect(0, 0, W, H); t += 0.006;
      const bg = ctx.createRadialGradient(W * 0.3, H * 0.2, 0, W * 0.5, H * 0.5, Math.max(W, H));
bg.addColorStop(0, "rgba(0,0,0,1)");
bg.addColorStop(.6, "rgba(0,0,0,1)");
bg.addColorStop(1, "rgba(0,0,0,1)");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      drawGrid();
      for (const p of stars) {
        const tw = .5 + .5 * Math.sin(t * p.tw + p.tp);
        ctx.beginPath(); ctx.arc(p.x % W, p.y % H, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${p.a * tw})`; ctx.fill();
      }
      const n1 = ctx.createRadialGradient(W * .15, H * .25, 0, W * .15, H * .25, W * .35);
      n1.addColorStop(0, "rgba(255,255,255,0.03)"); n1.addColorStop(1, "transparent");
      ctx.fillStyle = n1; ctx.fillRect(0, 0, W, H);
      const n2 = ctx.createRadialGradient(W * .85, H * .7, 0, W * .85, H * .7, W * .3);
      n2.addColorStop(0, "rgba(255,255,255,0.02)"); n2.addColorStop(1, "transparent");
      ctx.fillStyle = n2; ctx.fillRect(0, 0, W, H);
      shooters = shooters.filter(s => s.a > .01);
      for (const s of shooters) {
        const g = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * (s.len / 10), s.y - s.vy * (s.len / 10));
        g.addColorStop(0, `hsla(${s.hue},100%,80%,${s.a})`); g.addColorStop(1, "transparent");
        ctx.save(); ctx.strokeStyle = g; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * (s.len / 10), s.y - s.vy * (s.len / 10));
        ctx.stroke(); ctx.restore();
        s.x += s.vx; s.y += s.vy; s.a -= .019;
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => { cancelAnimationFrame(raf); clearInterval(si); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={cvRef} className="js-canvas" />;
}

/* ── Confirm Modal ────────────────────────────────────────── */
function ConfirmModal({ jobName, onConfirm, onCancel }) {
  return (
    <div className="js-modal-overlay">
      <div className="js-modal">
        <div className="js-modal-corner js-mc-tl" /><div className="js-modal-corner js-mc-tr" />
        <div className="js-modal-corner js-mc-bl" /><div className="js-modal-corner js-mc-br" />
        <div className="js-modal-icon">
          <svg width="28" height="28" viewBox="0 -960 960 960" fill="currentColor">
            <path d="m612-292 56-56-148-148v-184h-80v216l172 172ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/>
          </svg>
        </div>
        <h3 className="js-modal-title">Execute Job?</h3>
        {jobName && <p className="js-modal-job">{jobName}</p>}
        <p className="js-modal-desc">This will manually trigger the job immediately. Continue?</p>
        <div className="js-modal-actions">
          <button className="js-modal-cancel" onClick={onCancel}>Cancel</button>
          <button className="js-modal-confirm" onClick={onConfirm}>
            <svg width="13" height="13" viewBox="0 -960 960 960" fill="currentColor">
              <path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/>
            </svg>
            Yes, Execute
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Table Row ────────────────────────────────────────────── */
function JobRow({ job, runningId, onView, onEdit, onToggle, onRunRequest }) {
  const rowRef = useRef(null);

  const handleMove = (e) => {
    const el = rowRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    el.style.transform = `rotateX(${-dy * 3}deg) translateY(-2px)`;
  };
  const handleLeave = () => { if (rowRef.current) rowRef.current.style.transform = ""; };

  const formatTime = (time) => {
    if (!time) return "—";
    const [h, m] = time.split(":");
    let hr = parseInt(h, 10);
    const ampm = hr >= 12 ? "PM" : "AM";
    hr = hr % 12 || 12;
    return m === "00" ? `${hr} ${ampm}` : `${hr}:${m} ${ampm}`;
  };

  return (
    <tr ref={rowRef} className="js-row" onMouseMove={handleMove} onMouseLeave={handleLeave}>
      <td><span className="js-code">{job.jobCode}</span></td>
      <td className="js-name">{job.jobName}</td>
      <td><span className="js-freq">{job.frequency}</span></td>
      <td className="js-time">{formatTime(job.runTime)}</td>
      <td>
        <span className={`js-status ${job.enabled ? "js-enabled" : "js-disabled"}`}>
          <span className="js-status-dot" />
          {job.enabled ? "Enabled" : "Disabled"}
        </span>
      </td>
      <td className="js-last-run">
        {job.lastRunAt ? new Date(job.lastRunAt).toLocaleString() : "—"}
      </td>
      <td>
        <div className="js-actions">
          <button className="js-btn js-btn-view"   onClick={() => onView(job.id)}>View</button>
          <button className="js-btn js-btn-edit"   onClick={() => onEdit(job.id)}>Edit</button>
          <button className="js-btn js-btn-toggle" onClick={() => onToggle(job)}>
            {job.enabled ? "Disable" : "Enable"}
          </button>
          <button
            className="js-btn js-btn-run"
            onClick={() => onRunRequest(job.id)}
            disabled={runningId === job.id}
          >
            {runningId === job.id
              ? <><span className="js-spin" />Running…</>
              : <>Run Now</>
            }
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ── Main ─────────────────────────────────────────────────── */
export default function JobSchedulerPage() {
  const [jobs, setJobs]             = useState([]);
  const [loading, setLoading]       = useState(false);
  const [search, setSearch]         = useState("");
  const [runningId, setRunningId]   = useState(null);
  const [confirmRunId, setConfirmRunId] = useState(null);
  const [loaded, setLoaded]         = useState(false);

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
      const res    = await fetch("http://localhost:8080/api/SystemJob/GetAllJobs", { credentials: "include" });
      const result = await res.json();
      if (result.status === 200) { setJobs(result.data || []); setTimeout(() => setLoaded(true), 80); }
      else throw new Error(result.message);
    } catch (e) { toast.error(e.message || "Failed to load jobs"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchJobs(); }, []);

  const toggleJob = async (job) => {
    setLoading(true);
    try {
      const res    = await fetch(`http://localhost:8080/api/SystemJob/ToggleJob/${job.id}`, { method: "PUT", credentials: "include" });
      const result = await res.json();
      if (result.status === 200) { toast.success(result.message || "Job status updated"); fetchJobs(); }
      else throw new Error(result.message);
    } catch (e) { toast.error(e.message || "Failed to update job status"); }
    finally { setLoading(false); }
  };

  const executeRunNow = async (id) => {
    setConfirmRunId(null);
    setRunningId(id);
    try {
      const res    = await fetch(`http://localhost:8080/api/SystemJob/RunJob/${id}`, { method: "POST", credentials: "include" });
      const result = await res.json();
      if (result.status === 200) { toast.success(result.message || "Job executed successfully"); fetchJobs(); }
      else throw new Error(result.message);
    } catch (e) { toast.error(e.message || "Execution failed"); }
    finally { setRunningId(null); }
  };

  const filtered = jobs.filter(
    j => j.jobName.toLowerCase().includes(search.toLowerCase()) ||
         j.jobCode.toLowerCase().includes(search.toLowerCase())
  );

  const confirmJob = jobs.find(j => j.id === confirmRunId);

  return (
    <div className="js-page">
      <JobCanvas />
      <div className="js-orb js-orb-a" />
      <div className="js-orb js-orb-b" />

      <ToastContainer position="top-right" autoClose={3000} theme="dark" />

      <div className="js-inner">

        {/* ── Header ─────────────────────────────────────── */}
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
                  <path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56Z"/>
                </svg>
                <input
                  className="js-search"
                  type="text"
                  placeholder="Search by name or code..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <button className="js-refresh-btn" onClick={fetchJobs}>
                <svg width="14" height="14" viewBox="0 -960 960 960" fill="currentColor">
                  <path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z"/>
                </svg>
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* ── Divider ────────────────────────────────────── */}
        <div className="js-divider" />

        {/* ── Table ──────────────────────────────────────── */}
        {loading && !jobs.length ? (
          <div className="js-loading">
            <span className="js-loading-spin" />
            <span>Loading jobs…</span>
          </div>
        ) : (
          <div className="js-table-wrap">
            <table className="js-table">
              <thead>
                <tr>
                  {["Job Code","Job Name","Frequency","Run Time","Status","Last Run","Actions"].map(h => (
                    <th key={h} className="js-th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={loaded ? "loaded" : ""}>
                {filtered.length > 0 ? filtered.map((job, i) => (
                  <JobRow
                    key={job.id}
                    job={job}
                    runningId={runningId}
                    onView={id => navigate(`/master/job-scheduler/view/${id}`)}
                    onEdit={id => navigate(`/master/job-scheduler/edit/${id}`)}
                    onToggle={toggleJob}
                    onRunRequest={id => setConfirmRunId(id)}
                  />
                )) : (
                  <tr><td colSpan="7" className="js-no-data">No jobs found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Confirm Modal ──────────────────────────────── */}
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
