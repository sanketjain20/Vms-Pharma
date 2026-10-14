import React, { useEffect, useMemo, useRef, useState } from "react";
import { getMeta, setMeta } from "./repDb";
import { repApi } from "./repSync";
import RepAvatar from "./RepAvatar";
import { resizeToSquareDataUrl } from "./repImage";

// ───────────── accent colours (a rep-app feature the office app doesn't have) ─────────────

export const ACCENTS = [
  { key: "teal", label: "Teal", swatch: "#14b8a6" },
  { key: "ocean", label: "Ocean", swatch: "#0ea5e9" },
  { key: "violet", label: "Violet", swatch: "#8b5cf6" },
  { key: "rose", label: "Rose", swatch: "#f43f5e" },
  { key: "amber", label: "Amber", swatch: "#f59e0b" },
  { key: "graphite", label: "Graphite", swatch: "#94a3b8" },
];
export const DEFAULT_ACCENT = "teal";

const accentKey = (vendorId) => `vmsRepAccent:${vendorId ?? "anon"}`;

export function readAccent(vendorId) {
  try {
    const v = localStorage.getItem(accentKey(vendorId));
    return ACCENTS.some((a) => a.key === v) ? v : DEFAULT_ACCENT;
  } catch {
    return DEFAULT_ACCENT;
  }
}

export function saveAccent(vendorId, key) {
  try {
    localStorage.setItem(accentKey(vendorId), key);
  } catch {
    // private mode etc.: the choice still applies for this session
  }
}

// ───────────── password rules (mirrors the server: 8+ chars, a letter and a number) ─────────────

export function passwordStrength(pw) {
  if (!pw) return { score: 0, label: "" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) score++;
  return { score, label: ["Too weak", "Weak", "Fair", "Good", "Strong"][score] };
}

export function validateNewPassword(current, next, confirm) {
  if (!current || !next || !confirm) return "Fill in all three password fields.";
  if (next.length < 8) return "New password must be at least 8 characters.";
  if (!/[A-Za-z]/.test(next) || !/[0-9]/.test(next)) return "New password must contain at least one letter and one number.";
  if (next !== confirm) return "New passwords don't match.";
  if (next === current) return "New password must be different from your current one.";
  return null;
}

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");

const eyeIcon = (open) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {open ? (
      <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>
    ) : (
      <><path d="M3 3l18 18M10.6 6.2A9.9 9.9 0 0112 6c6.5 0 10 6 10 6a17 17 0 01-3.2 3.9M6.6 7.6A16.7 16.7 0 002 12s3.5 6 10 6a9.7 9.7 0 003.4-.6" /><path d="M9.9 9.9a3 3 0 004.2 4.2" /></>
    )}
  </svg>
);

function PasswordField({ id, label, value, onChange, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="ra-field">
      <label className="ra-label" htmlFor={id}>{label}</label>
      <div className="ra-pw">
        <input id={id} className="ra-input ra-input--eye" type={show ? "text" : "password"} value={value} autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)} />
        <button type="button" className="ra-eye" aria-label={`${show ? "Hide" : "Show"} ${label.toLowerCase()}`} onClick={() => setShow((s) => !s)}>
          {eyeIcon(show)}
        </button>
      </div>
    </div>
  );
}

// ───────────── the screen ─────────────

export default function RepSettings({
  user, db, api = repApi, online, accent, onAccent, photo, onPhotoChange, onProfileSaved, processImage = resizeToSquareDataUrl,
}) {
  const [profile, setProfile] = useState(null);
  const [profileNote, setProfileNote] = useState(null);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwMsg, setPwMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMsg, setPhotoMsg] = useState(null);
  const fileRef = useRef(null);

  // Show what we last knew straight away (works offline), then refresh when there is a connection.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cached = await getMeta(db, "profile", null);
        if (alive && cached) setProfile(cached);
      } catch {
        // no cache is fine
      }
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      const r = await api.profile();
      if (!alive) return;
      if (r.ok && r.data) {
        setProfile(r.data);
        setProfileNote(null);
        try { await setMeta(db, "profile", r.data); } catch { /* cache is best-effort */ }
        if (onProfileSaved) onProfileSaved();
      } else if (!r.networkError) {
        setProfileNote(r.message || "Couldn't refresh your details.");
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, api]);

  // What to show before/without the server copy: the details from the login.
  const shown = useMemo(() => ({
    name: profile?.name || user?.name,
    email: profile?.email,
    phone: profile?.phone,
    address: profile?.address || user?.address,
    company: profile?.company || user?.shopName,
    memberSince: profile?.memberSince,
    retailerCount: profile?.retailerCount,
  }), [profile, user]);

  const strength = passwordStrength(next);

  const rows = [
    ["Name", shown.name],
    ["Login email", shown.email],
    ["Phone", shown.phone],
    ["Address", shown.address],
    ["Company", shown.company],
    ["Member since", shown.memberSince ? fmtDate(shown.memberSince) : null],
    ["Retailers on your beat", shown.retailerCount],
  ];

  const pickPhoto = () => fileRef.current && fileRef.current.click();

  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // so choosing the same photo again still fires
    if (!file) return;
    setPhotoMsg(null);
    if (!online) return setPhotoMsg({ text: "You need a connection to change your photo.", tone: "warn" });
    setPhotoBusy(true);
    try {
      let dataUrl;
      try {
        dataUrl = await processImage(file);
      } catch (err) {
        return setPhotoMsg({ text: err.message || "Couldn't use that photo.", tone: "bad" });
      }
      const r = await api.updatePhoto({ photo: dataUrl });
      if (r.ok) {
        if (onPhotoChange) await onPhotoChange(dataUrl);
        setPhotoMsg({ text: "Photo updated.", tone: "ok" });
      } else if (r.networkError) {
        setPhotoMsg({ text: "Couldn't reach the server. Your photo was not changed.", tone: "warn" });
      } else {
        setPhotoMsg({ text: r.message || "Couldn't update your photo.", tone: "bad" });
      }
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async () => {
    setPhotoMsg(null);
    if (!online) return setPhotoMsg({ text: "You need a connection to change your photo.", tone: "warn" });
    setPhotoBusy(true);
    try {
      const r = await api.updatePhoto({ photo: null });
      if (r.ok) {
        if (onPhotoChange) await onPhotoChange(null);
        setPhotoMsg({ text: "Photo removed.", tone: "ok" });
      } else if (r.networkError) {
        setPhotoMsg({ text: "Couldn't reach the server. Your photo was not changed.", tone: "warn" });
      } else {
        setPhotoMsg({ text: r.message || "Couldn't remove your photo.", tone: "bad" });
      }
    } finally {
      setPhotoBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setPwMsg(null);
    const problem = validateNewPassword(current, next, confirm);
    if (problem) return setPwMsg({ text: problem, tone: "bad" });
    if (!online) return setPwMsg({ text: "You need a connection to change your password.", tone: "warn" });
    setSaving(true);
    try {
      const r = await api.changePassword({ currentPassword: current, newPassword: next });
      if (r.ok) {
        setCurrent(""); setNext(""); setConfirm("");
        setPwMsg({ text: "Password updated. Use the new one next time you log in.", tone: "ok" });
      } else if (r.networkError) {
        setPwMsg({ text: "Couldn't reach the server. Your password was not changed.", tone: "warn" });
      } else {
        setPwMsg({ text: r.message || "Couldn't update your password.", tone: "bad" });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="ra-page-head">
        <h2 className="ra-page-title">Settings</h2>
        <div className="ra-page-sub">Your details, your password, and how the app looks.</div>
      </div>

      <div className="ra-settings">
        <section className="ra-card ra-set-card">
          <div className="ra-profile-head">
            <button type="button" className="ra-avatar-edit" aria-label="Change profile photo" onClick={pickPhoto} disabled={photoBusy}>
              <RepAvatar photo={photo} name={shown.name} size={76} />
              <span className="ra-avatar-cam" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" /><circle cx="12" cy="13" r="3.5" /></svg>
              </span>
            </button>
            <div style={{ minWidth: 0 }}>
              <h3 className="ra-card-title">{shown.name || "Field rep"}</h3>
              <div className="ra-muted">Field rep{shown.company ? ` · ${shown.company}` : ""}</div>
            </div>
          </div>

          <div className="ra-photo-actions">
            <button type="button" className="ra-btn ra-btn--sm" onClick={pickPhoto} disabled={photoBusy}>
              {photoBusy ? "Saving photo…" : photo ? "Change photo" : "Add photo"}
            </button>
            {photo && !photoBusy && (
              <button type="button" className="ra-btn ra-btn--sm ra-btn--ghost" onClick={removePhoto}>Remove photo</button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="ra-file" aria-label="Choose profile photo" onChange={onFile} />
          </div>
          {photoMsg && <p className={`ra-toast ra-toast--${photoMsg.tone}`} role="status" style={{ marginTop: 12 }}>{photoMsg.text}</p>}


          <dl className="ra-details" aria-label="Your details">
            {rows.map(([label, value]) => (
              <div className="ra-detail" key={label}>
                <dt>{label}</dt>
                <dd>{value === null || value === undefined || value === "" ? "—" : value}</dd>
              </div>
            ))}
          </dl>
          <p className="ra-muted ra-note">
            These details are managed by your office. To change anything other than your password, ask them.
            {!profile && " Showing what this phone knows — connect to refresh."}
          </p>
          {profileNote && <p className="ra-toast ra-toast--warn" role="status">{profileNote}</p>}
        </section>

        <form className="ra-card ra-set-card" onSubmit={submit} noValidate>
          <h3 className="ra-card-title">Change password</h3>
          <p className="ra-muted" style={{ margin: "4px 0 0" }}>At least 8 characters, with a letter and a number.</p>

          <PasswordField id="ra-pw-current" label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" />
          <PasswordField id="ra-pw-new" label="New password" value={next} onChange={setNext} autoComplete="new-password" />
          {next && (
            <div className="ra-strength" aria-live="polite">
              <div className={`ra-strength-bar level-${strength.score}`}><span /><span /><span /><span /></div>
              <span className="ra-muted">{strength.label}</span>
            </div>
          )}
          <PasswordField id="ra-pw-confirm" label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" />

          {pwMsg && <p className={`ra-toast ra-toast--${pwMsg.tone}`} role="alert" style={{ marginTop: 14 }}>{pwMsg.text}</p>}
          {!online && <p className="ra-muted" style={{ marginTop: 10 }}>You're offline — you can change your password once you're back online.</p>}

          <button type="submit" className="ra-btn ra-btn--primary ra-btn--block" style={{ marginTop: 14 }} disabled={saving}>
            {saving ? "Updating…" : "Update password"}
          </button>
        </form>

        <section className="ra-card ra-set-card ra-set-wide">
          <h3 className="ra-card-title">Accent colour</h3>
          <p className="ra-muted" style={{ margin: "4px 0 12px" }}>Pick the colour that suits you — buttons, highlights and the footer glow follow it. Saved on this phone.</p>
          <div className="ra-swatches" role="radiogroup" aria-label="Accent colour">
            {ACCENTS.map((a) => (
              <button key={a.key} type="button" role="radio" aria-checked={accent === a.key} aria-label={a.label}
                className={`ra-swatch ${accent === a.key ? "is-active" : ""}`} onClick={() => onAccent(a.key)}>
                <span className="ra-swatch-dot" style={{ background: a.swatch }} />
                <span className="ra-swatch-label">{a.label}</span>
              </button>
            ))}
          </div>
          {accent !== DEFAULT_ACCENT && (
            <button type="button" className="ra-btn ra-btn--sm ra-btn--ghost" style={{ marginTop: 12 }} onClick={() => onAccent(DEFAULT_ACCENT)}>
              Reset to default
            </button>
          )}
        </section>
      </div>
    </>
  );
}
