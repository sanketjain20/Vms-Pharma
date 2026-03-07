import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../../Styles/JobScheduler/JobScheduler.css";
  import { useLocation } from "react-router-dom";

export default function JobSchedulerPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [runningId, setRunningId] = useState(null);

  // ✅ NEW: confirmation modal state
  const [confirmRunId, setConfirmRunId] = useState(null);

const location = useLocation();
const navigate = useNavigate();

useEffect(() => {
  if (location.state?.toastMessage) {
    toast.success(location.state.toastMessage);

    // ✅ Clear state so it doesn't show again
    navigate(location.pathname, { replace: true });
  }
}, [location, navigate]);

  const formatTime = (time) => {
    if (!time) return "-";
    const [hours, minutes] = time.split(":");
    let h = parseInt(hours, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return minutes === "00" ? `${h} ${ampm}` : `${h}:${minutes} ${ampm}`;
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      setLoading(true);

      const res = await fetch(
        "http://localhost:8080/api/SystemJob/GetAllJobs",
        { credentials: "include" }
      );

      const result = await res.json();

      if (result.status === 200) {
        setJobs(result.data || []);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      toast.error(error.message || "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  };

  const openView = (id) => {
    navigate(`/master/job-scheduler/view/${id}`);
  };

  const openEdit = (id) => {
    navigate(`/master/job-scheduler/edit/${id}`);
  };

  const toggleJob = async (job) => {
    try {
      setLoading(true);

      const res = await fetch(
        `http://localhost:8080/api/SystemJob/ToggleJob/${job.id}`,
        {
          method: "PUT",
          credentials: "include",
        }
      );

      const result = await res.json();

      if (result.status === 200) {
        toast.success(result.message || "Job status updated");
        fetchJobs();
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      toast.error(error.message || "Failed to update job status");
    } finally {
      setLoading(false);
    }
  };

  // ✅ REAL RUN FUNCTION (no confirm here)
  const executeRunNow = async (id) => {
  // ✅ CLOSE MODAL IMMEDIATELY
  setConfirmRunId(null);

  try {
    setRunningId(id);

    const res = await fetch(
      `http://localhost:8080/api/SystemJob/RunJob/${id}`,
      {
        method: "POST",
        credentials: "include",
      }
    );

    const result = await res.json();

    if (result.status === 200) {
      toast.success(result.message || "Job executed successfully ⚡");
      fetchJobs();
    } else {
      throw new Error(result.message);
    }

  } catch (error) {
    toast.error(error.message || "Execution failed");
  } finally {
    setRunningId(null);
  }
};

  const filteredJobs = jobs.filter(
    (job) =>
      job.jobName.toLowerCase().includes(search.toLowerCase()) ||
      job.jobCode.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="scheduler-container">
      <h2 className="title">Job Scheduler Management</h2>

      <div className="top-bar">
        <input
          type="text"
          placeholder="Search by Job Name or Code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="job-search-input"
        />
        <button onClick={fetchJobs} className="refresh-btn">
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="loading">Loading jobs...</p>
      ) : (
        <div className="table-wrapper">
          <table className="job-table">
            <thead>
              <tr>
                <th>Job Code</th>
                <th>Job Name</th>
                <th>Frequency</th>
                <th>Run Time</th>
                <th>Status</th>
                <th>Last Run</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.length > 0 ? (
                filteredJobs.map((job) => (
                  <tr key={job.id}>
                    <td><strong>{job.jobCode}</strong></td>
                    <td>{job.jobName}</td>
                    <td>{job.frequency}</td>
                    <td>{formatTime(job.runTime)}</td>

                    <td>
                      <span
                        className={
                          job.enabled ? "status enabled" : "status disabled"
                        }
                      >
                        {job.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </td>

                    <td>
                      {job.lastRunAt
                        ? new Date(job.lastRunAt).toLocaleString()
                        : "-"}
                    </td>

                    <td className="actions">
                      <button
                        className="job-view-btn"
                        onClick={() => openView(job.id)}
                      >
                        View
                      </button>

                      <button
                        className="edit-btn"
                        onClick={() => openEdit(job.id)}
                      >
                        Edit
                      </button>

                      <button
                        className="toggle-btn"
                        onClick={() => toggleJob(job)}
                      >
                        {job.enabled ? "Disable" : "Enable"}
                      </button>

                      <button
                        className="run-btn"
                        onClick={() => setConfirmRunId(job.id)}
                        disabled={runningId === job.id}
                      >
                        {runningId === job.id ? "Running..." : "Run Now"}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="no-data">
                    No jobs found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ✅ CUSTOM CONFIRM MODAL */}
      {confirmRunId && (
        <div className="modal-overlay">
          <div className="confirm-modal">
            <h3>Execute Job?</h3>
            <p>Are you sure you want to execute this job manually?</p>
            <div className="modal-buttons">
              <button
                className="cancel-btn"
                onClick={() => setConfirmRunId(null)}
              >
                Cancel
              </button>
              <button
                className="confirm-btn"
                onClick={() => executeRunNow(confirmRunId)}
              >
                Yes, Execute
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
}