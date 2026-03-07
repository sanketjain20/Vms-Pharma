import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../../Styles/JobScheduler/JobSchedulerEdit.css";

// Layout
const Section = ({ title, children }) => (
  <div className="ed-section">
    <h2>{title}</h2>
    <div className="ed-grid">{children}</div>
  </div>
);

const Field = ({ label, children, full }) => (
  <div className={`ed-field ${full ? "ed-full" : ""}`}>
    <label>{label}</label>
    {children}
  </div>
);

// Helpers
const formatDate = (date) =>
  date ? new Date(date).toLocaleString() : "Never";

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export default function JobSchedulerEdit() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [job, setJob] = useState(null);
  const [selectedDays, setSelectedDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load Job
  const fetchJob = async () => {
    try {
      const res = await fetch(
        `http://localhost:8080/api/SystemJob/GetJobById/${id}`,
        { credentials: "include" }
      );
      const result = await res.json();

      if (result.status === 200) {
        const j = result.data;

        setJob({
          ...j,
          runTime: j.runTime?.substring(0, 5) || "",
          intervalDays: j.intervalDays || ""
        });

        if (j.daysOfWeek) {
          setSelectedDays(j.daysOfWeek.split(","));
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJob();
  }, [id]);

  // Clear irrelevant values when frequency changes
  useEffect(() => {
    if (!job) return;

    if (job.frequency === "DAILY") {
      setSelectedDays([]);
      setJob((p) => ({ ...p, intervalDays: "" }));
    }

    if (job.frequency === "WEEKLY") {
      setJob((p) => ({ ...p, intervalDays: "" }));
    }

    if (job.frequency === "INTERVAL") {
      setSelectedDays([]);
    }
  }, [job?.frequency]);

  const change = (key, value) =>
    setJob((p) => ({ ...p, [key]: value }));

  const toggleDay = (day) => {
    setSelectedDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day]
    );
  };

  // Save
  const save = async () => {
    try {
      setSaving(true);

      const payload = {
        jobDescription: job.jobDescription,
        frequency: job.frequency,
        runTime: job.runTime,
        daysOfWeek:
          job.frequency === "WEEKLY"
            ? selectedDays.join(",")
            : null,
        intervalDays:
          job.frequency === "INTERVAL"
            ? Number(job.intervalDays)
            : null,
        enabled: job.enabled,
        successEmail: job.successEmail,
        failureEmail: job.failureEmail
      };

      const res = await fetch(
        `http://localhost:8080/api/SystemJob/UpdateJob/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload)
        }
      );

      const result = await res.json();

      if (result.status === 200) {
        // ✅ Immediately go to list page and pass toast message
        navigate("/master/job-scheduler", {
          state: { toastMessage: "Job Updated Successfully ✅" }
        });
      } else {
        navigate("/master/job-scheduler", {
          state: { toastMessage: result.message }
        });
      }

    } catch {
      navigate("/master/job-scheduler", {
        state: { toastMessage: "Update failed ❌" }
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="ed-page">Loading...</div>;
  if (!job) return <div className="ed-page">Job not found</div>;

  return (
    <div className="ed-page">
      {/* HEADER */}
      <div className="ed-header">
        <div>
          <h1>Edit Job</h1>
          <span className="ed-job-sub">
            {job.jobName} ({job.jobCode})
          </span>
        </div>
        <button className="ed-btn" onClick={() => navigate(-1)}>
          Cancel
        </button>
      </div>

      <div className="ed-wrapper">

        {/* GENERAL */}
        <Section title="General Info">
          <Field label="Job Code">
            <div className="ed-value">{job.jobCode}</div>
          </Field>

          <Field label="Job Name">
            <div className="ed-value">{job.jobName}</div>
          </Field>

          <Field label="Description" full>
            <textarea
              className="ed-input"
              value={job.jobDescription || ""}
              onChange={(e) =>
                change("jobDescription", e.target.value)
              }
            />
          </Field>

          <Field label="Current Status">
            <span className={`ed-badge ${job.enabled ? "on" : "off"}`}>
              {job.enabled ? "RUNNING" : "STOPPED"}
            </span>
          </Field>

          <Field label="Change Status">
            <select
              className="ed-input"
              value={job.enabled}
              onChange={(e) =>
                change("enabled", e.target.value === "true")
              }
            >
              <option value={true}>RUNNING</option>
              <option value={false}>STOPPED</option>
            </select>
          </Field>
        </Section>

        {/* SCHEDULING */}
        <Section title="Schedule Timing">
          <Field label="Frequency">
            <select
              className="ed-input"
              value={job.frequency}
              onChange={(e) => change("frequency", e.target.value)}
            >
              <option value="DAILY">DAILY</option>
              <option value="WEEKLY">WEEKLY</option>
              <option value="INTERVAL">INTERVAL</option>
            </select>
          </Field>

          <Field label="Run Time">
            <input
              type="time"
              className="ed-input"
              value={job.runTime}
              onChange={(e) => change("runTime", e.target.value)}
            />
          </Field>

          {job.frequency === "WEEKLY" && (
            <Field label="Days Of Week" full>
              <div className="ed-days">
                {DAYS.map((day) => (
                  <div
                    key={day}
                    className={`ed-day ${selectedDays.includes(day) ? "active" : ""}`}
                    onClick={() => toggleDay(day)}
                  >
                    {day}
                  </div>
                ))}
              </div>
            </Field>
          )}

          {job.frequency === "INTERVAL" && (
            <Field label="Interval Days">
              <input
                type="number"
                className="ed-input"
                value={job.intervalDays || ""}
                onChange={(e) =>
                  change("intervalDays", e.target.value)
                }
              />
            </Field>
          )}

          <Field label="Last Run">
            <div className="ed-value">{formatDate(job.lastRunAt)}</div>
          </Field>

          <Field label="Next Run">
            <div className="ed-value">{formatDate(job.nextRunAt)}</div>
          </Field>
        </Section>

        {/* EMAILS */}
        <Section title="Notifications">
          <Field label="Success Email">
            <input
              className="ed-input"
              value={job.successEmail || ""}
              onChange={(e) =>
                change("successEmail", e.target.value)
              }
            />
          </Field>

          <Field label="Failure Email">
            <input
              className="ed-input"
              value={job.failureEmail || ""}
              onChange={(e) =>
                change("failureEmail", e.target.value)
              }
            />
          </Field>
        </Section>

        {/* HISTORY */}
        <Section title="History">
          <Field label="Created At">
            <div className="ed-value">
              {formatDate(job.createdAt)}
            </div>
          </Field>

          <Field label="Updated At">
            <div className="ed-value">
              {formatDate(job.updatedAt)}
            </div>
          </Field>
        </Section>

        {/* SAVE */}
        <div style={{ marginTop: 30 }}>
          <button className="ed-save" onClick={save}>
            {saving ? "Saving..." : "💾 Save Changes"}
          </button>
        </div>

      </div>
    </div>
  );
}