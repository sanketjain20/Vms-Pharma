import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../../Styles/JobScheduler/JobSchedulerView.css";

// --- Simple Layout Parts ---

const Section = ({ title, children }) => (
  <div className="dark-section">
    <h2>{title}</h2>
    <div className="section-grid">{children}</div>
  </div>
);

const Field = ({ label, value, full }) => (
  <div className={`field ${full ? "full" : ""}`}>
    <label>{label}</label>
    <div className="value">{value || "Not Set"}</div>
  </div>
);

export default function JobSchedulerView() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);

  // Changes time to 12-hour format (e.g., 2:00 PM)
  const formatTime = (time) => {
    if (!time) return "-";
    const [hours, minutes] = time.split(":");
    let h = parseInt(hours, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${minutes} ${ampm}`;
  };

  // Changes date to a readable format
  const formatDate = (date) => {
    if (!date) return "Never";
    return new Date(date).toLocaleString();
  };

  useEffect(() => {
    const fetchJob = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `http://localhost:8080/api/SystemJob/GetJobById/${id}`,
          { credentials: "include" }
        );
        const result = await res.json();
        if (result.status === 200) {
          setJob(result.data);
        }
      } catch (error) {
        console.error("Error loading job details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchJob();
  }, [id]);

  // 1. What the vendor sees while waiting
  if (loading) {
    return (
      <div className="dark-page">
        <div className="status-message">Loading Job Details...</div>
      </div>
    );
  }

  // 2. What the vendor sees if something goes wrong
  if (!job) {
    return (
      <div className="dark-page">
        <div className="status-message">
          <p>We couldn't find that job record.</p>
          <button className="back-btn" onClick={() => navigate(-1)}>Go Back</button>
        </div>
      </div>
    );
  }

  // 3. The Main Premium View
  return (
    <div className="dark-page">
      <div className="dark-header">
        <div>
          <h1>{job.jobName}</h1>
          <span className="job-code-sub">Code: {job.jobCode}</span>
        </div>
        <button className="back-btn" onClick={() => navigate(-1)}>
          ← Back to List
        </button>
      </div>

      <div className="view-content-wrapper">
        <Section title="General Information">
          <Field label="Job Identity" value={job.jobCode} />
          <Field label="Job Name" value={job.jobName} />
          <Field full label="What this job does" value={job.jobDescription} />
          <Field
            label="Current Status"
            value={
              <span className={job.enabled ? "badge on" : "badge off"}>
                {job.enabled ? "RUNNING" : "STOPPED"}
              </span>
            }
          />
        </Section>

        <Section title="Schedule Timing">
          <Field label="Repeats" value={job.frequency} />
          <Field label="Scheduled Time" value={formatTime(job.runTime)} />
          <Field label="Last Successful Run" value={formatDate(job.lastRunAt)} />
          <Field label="Next Scheduled Run" value={formatDate(job.nextRunAt)} />
        </Section>

        <Section title="Contact Info">
          <Field label="Email on Success" value={job.successEmail} />
          <Field label="Email on Failure" value={job.failureEmail} />
        </Section>

        <Section title="History">
          <Field label="First Created" value={formatDate(job.createdAt)} />
          <Field label="Last Updated" value={formatDate(job.updatedAt)} />
        </Section>
      </div>
    </div>
  );
}