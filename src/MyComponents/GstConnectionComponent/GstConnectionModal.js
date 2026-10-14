import React, { useCallback, useEffect, useState } from "react";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import { SECRET_FIELDS, credentialProblem, credentialRequest, formFrom } from "./gstHelpers";
import "../../Styles/GstShared/GstConnection.css";

const CHANNELS = [
  ["EINVOICE", "E-invoice"],
  ["EWAYBILL", "E-way bill"],
];

async function call(path, options = {}) {
  const res = await apiClient(`${API_BASE_URL}${path}`, { headers: { "Content-Type": "application/json" }, ...options });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // non-JSON error body
  }
  return { ok: json?.status === 200, message: json?.message || (res.ok ? "Done." : "Request failed."), data: json?.data };
}

/**
 * Where the business's GST provider credentials are saved (encrypted on the server, never shown again) and the
 * connection is tested. Which server the system talks to (STUB / SANDBOX / PRODUCTION) is a server setting, shown
 * here so nobody saves production credentials thinking they are testing.
 */
export default function GstConnectionModal({ onClose, onSaved }) {
  const [channel, setChannel] = useState("EINVOICE");
  const [saved, setSaved] = useState({});
  const [forms, setForms] = useState({});
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [creds, st] = await Promise.all([call("/api/Gst/Credentials"), call("/api/Gst/Status")]);
    if (creds.ok) {
      const byType = Object.fromEntries((creds.data || []).map((c) => [c.credentialType, c]));
      setSaved(byType);
      setForms(Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, formFrom(v)])));
    } else {
      setMessage({ text: creds.message, tone: "danger" });
    }
    if (st.ok) setStatus(st.data);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const form = forms[channel] || formFrom(null);
  const set = (patch) => setForms((prev) => ({ ...prev, [channel]: { ...form, ...patch } }));
  const label = CHANNELS.find(([k]) => k === channel)[1];

  const save = async () => {
    const problem = credentialProblem(form, saved[channel]);
    if (problem) return setMessage({ text: problem, tone: "danger" });
    setBusy(true);
    try {
      const r = await call("/api/Gst/Credentials", { method: "PUT", body: JSON.stringify(credentialRequest(channel, form)) });
      setMessage({ text: r.ok ? `${label} credentials saved.` : r.message, tone: r.ok ? "success" : "danger" });
      if (r.ok) {
        await load(); // secrets go back to blank: they are never sent back to the browser
        if (onSaved) onSaved();
      }
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    try {
      const r = await call(`/api/Gst/TestConnection/${channel}`, { method: "POST" });
      if (!r.ok) return setMessage({ text: r.message, tone: "danger" });
      setMessage({ text: r.data.message, tone: r.data.success ? (r.data.mode === "STUB" ? "info" : "success") : "danger" });
    } finally {
      setBusy(false);
    }
  };

  const mismatch = status && status.mode !== "STUB" && form.environment && form.environment !== status.mode;

  return (
    <div className="gst-modal-back" onClick={onClose}>
      <div className="dg-panel gst-modal" role="dialog" aria-modal="true" aria-label="GST connection" onClick={(e) => e.stopPropagation()}>
        <div className="gst-modal-head">
          <h3 className="gst-section-title">GST connection</h3>
          <button type="button" className="gst-btn gst-btn--sm gst-btn--ghost" onClick={onClose}>Close</button>
        </div>

        {status && (
          <p className="gst-section-hint" data-testid="gst-current-mode">
            The system is in <strong>{status.mode}</strong> mode. {status.mode === "STUB"
              ? "Nothing is sent to the GST portal, so credentials are not used yet. You can save them now for later."
              : `Only ${status.mode} credentials are used; credentials saved for the other environment are ignored.`}
          </p>
        )}

        <div className="fr-tabs" role="tablist" aria-label="Channel">
          {CHANNELS.map(([key, text]) => (
            <button key={key} type="button" role="tab" aria-selected={channel === key} className={`fr-tab ${channel === key ? "is-active" : ""}`}
              onClick={() => { setChannel(key); setMessage(null); }}>{text}</button>
          ))}
        </div>

        {message && <div className={`gst-alert gst-alert--${message.tone}`} role="status">{message.text}</div>}

        <div className="gst-form">
          <label className="fr-label" htmlFor="gst-gstin">Business GSTIN</label>
          <input id="gst-gstin" className="gst-search" value={form.gstin} maxLength={15} placeholder="15-character GSTIN" onChange={(e) => set({ gstin: e.target.value.toUpperCase() })} />

          <label className="fr-label" htmlFor="gst-env">Environment these credentials are for</label>
          <select id="gst-env" className="gst-search" value={form.environment} onChange={(e) => set({ environment: e.target.value })}>
            <option value="SANDBOX">SANDBOX (test)</option>
            <option value="PRODUCTION">PRODUCTION (real)</option>
          </select>
          {mismatch && (
            <div className="gst-alert gst-alert--warning" role="alert">
              The system is in {status.mode} mode, so these {form.environment} credentials will not be used until the mode is changed.
            </div>
          )}

          {SECRET_FIELDS.map(([key, savedKey, text]) => (
            <React.Fragment key={key}>
              <label className="fr-label" htmlFor={`gst-${key}`}>{text}</label>
              <input id={`gst-${key}`} className="gst-search" type={key === "password" || key === "clientSecret" ? "password" : "text"} autoComplete="off"
                value={form[key]} placeholder={saved[channel]?.[savedKey] ? "Saved — leave blank to keep" : ""} onChange={(e) => set({ [key]: e.target.value })} />
            </React.Fragment>
          ))}

          <label className="gst-check">
            <input type="checkbox" checked={form.enabled} onChange={(e) => set({ enabled: e.target.checked })} /> Enabled
          </label>
        </div>

        <div className="fr-actions">
          <button type="button" className="gst-btn gst-btn--success" disabled={busy} onClick={save}>Save</button>
          <button type="button" className="gst-btn" disabled={busy} onClick={test}>Test connection</button>
        </div>
        <p className="gst-section-hint">Secrets are encrypted on the server and cannot be shown again. Never share them in chat or email.</p>
      </div>
    </div>
  );
}
