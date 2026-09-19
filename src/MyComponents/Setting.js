import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "../Styles/Setting.css";
import API_BASE_URL from "../Config/api.config";
import apiClient from "../Config/apiClient";

/* ─── Helpers ──────────────────────────────────────────────── */
const blobToBase64 = async (blobUrl) => {
  const res = await fetch(blobUrl);
  const blob = await res.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
};

const compressAndStore = (base64String) => {
  try {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const MAX = 80;
      const ratio = Math.min(MAX / img.width, MAX / img.height);
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const compressed = canvas.toDataURL("image/jpeg", 0.7);
      localStorage.setItem("profilePhoto", compressed);
      window.dispatchEvent(new CustomEvent("profilePhotoUpdated", { detail: compressed }));
    };
    img.src = base64String.startsWith("data:") ? base64String : `data:image/jpeg;base64,${base64String}`;
  } catch (e) { console.error("Compression error:", e); }
};

const getPasswordStrength = (pw) => {
  if (!pw) return -1;
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return 0;
  if (score <= 2) return 1;
  return 2;
};

/* ─── Icons ────────────────────────────────────────────────── */
const Icon = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const icons = {
  user: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z",
  lock: "M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  camera: "M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z M12 17a4 4 0 100-8 4 4 0 000 8z",
  eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 12a3 3 0 100-6 3 3 0 000 6z",
  eyeoff: "M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22",
  check: "M20 6L9 17l-5-5",
  save: "M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2zM17 21v-8H7v8M7 3v5h8",
  trash: "M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2",
  logout: "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
  edit: "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  chevron: "M9 18l6-6-6-6",
  arrowLeft: "M19 12H5M12 19l-7-7 7-7",
};

const TABS = [
  { id: "profile", label: "Profile", icon: "user", title: "Profile", blurb: "How your shop appears across VMS." },
  { id: "password", label: "Password", icon: "lock", title: "Password", blurb: "Keep your account secure with a strong password." },
  { id: "security", label: "Security", icon: "shield", title: "Security", blurb: "Review active sessions and manage account safety." },
];

/* ─── Toast system ─────────────────────────────────────────── */
let toastId = 0;
const useToast = () => {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((msg, type = "info") => {
    const id = ++toastId;
    setToasts((p) => [...p, { id, msg, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
  }, []);
  return { toasts, push };
};

const ToastStack = ({ toasts }) => (
  <div className="st-toast">
    {toasts.map((t) => (
      <div key={t.id} className={`st-toast-item ${t.type}`}>
        <span className="st-toast-dot" />
        {t.msg}
      </div>
    ))}
  </div>
);

/* ─── Row primitives ───────────────────────────────────────── */
const Row = ({ label, hint, children, first }) => (
  <div className={`st-row${first ? " no-border" : ""}`}>
    <div className="st-row-info">
      <span className="st-row-name">{label}</span>
      {hint && <span className="st-row-hint">{hint}</span>}
    </div>
    <div className="st-row-control">{children}</div>
  </div>
);

const EyeInput = ({ value, onChange, placeholder, show, onToggle }) => (
  <div className="st-eyefield">
    <input className="st-input with-eye" type={show ? "text" : "password"} placeholder={placeholder} value={value} onChange={onChange} />
    <button className="st-eye" type="button" onClick={onToggle} aria-label={show ? "Hide password" : "Show password"}>
      <Icon d={show ? icons.eye : icons.eyeoff} size={15} />
    </button>
  </div>
);

const StrengthMeter = ({ password }) => {
  const level = getPasswordStrength(password);
  const labels = ["Weak", "Fair", "Strong"];
  const cls = ["w0", "w1", "w2"];
  return (
    <div className="st-strength">
      <div className="st-strength-bars">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`st-strength-bar ${level >= 0 && i <= level ? `active-${level}` : ""}`} />
        ))}
      </div>
      {level >= 0 && <span className={`st-strength-tag ${cls[level]}`}>{labels[level]}</span>}
    </div>
  );
};

/* ─── Main component ───────────────────────────────────────── */
export default function Settings() {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const { toasts, push } = useToast();

  const [tab, setTab] = useState("profile");
  const activeIndex = TABS.findIndex((t) => t.id === tab);
  const active = TABS[activeIndex];

  /* profile state */
  const [shopName, setShopName] = useState("");
  const [origShopName, setOrigShopName] = useState("");
  const [gstin, setGstin] = useState("");
  const [origGstin, setOrigGstin] = useState("");
  const [pincode, setPincode] = useState("");
  const [origPincode, setOrigPincode] = useState("");
  const [drugLicenseNumber, setDrugLicenseNumber] = useState("");
  const [origDrugLicenseNumber, setOrigDrugLicenseNumber] = useState("");
  const [email, setEmail] = useState("");
  const [profilePhoto, setProfilePhoto] = useState("https://via.placeholder.com/140");
  const [origPhoto, setOrigPhoto] = useState("https://via.placeholder.com/140");
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [saving, setSaving] = useState(false);

  /* password state */
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [conPw, setConPw] = useState("");
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showCon, setShowCon] = useState(false);

  /* security state */
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState(false);
  const [revokingUKey, setRevokingUKey] = useState(null);
  const [signingOutAll, setSigningOutAll] = useState(false);

  useEffect(() => {
    apiClient(`${API_BASE_URL}/api/Vendor/SettingDetails`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.status === 200) {
          setShopName(d.data.shopName); setOrigShopName(d.data.shopName);
          setGstin(d.data.gstin || ""); setOrigGstin(d.data.gstin || "");
          setPincode(d.data.pincode || ""); setOrigPincode(d.data.pincode || "");
          setDrugLicenseNumber(d.data.drugLicenseNumber || ""); setOrigDrugLicenseNumber(d.data.drugLicenseNumber || "");
          setEmail(d.data.email);
          if (d.data.profilePhoto) {
            setProfilePhoto(d.data.profilePhoto);
            setOrigPhoto(d.data.profilePhoto);
            compressAndStore(d.data.profilePhoto);
          }
        } else push(d.message || "Failed to load settings", "error");
      })
      .catch(() => {});
  }, []);

  const isDirty = useMemo(
    () =>
      shopName !== origShopName ||
      gstin !== origGstin ||
      pincode !== origPincode ||
      drugLicenseNumber !== origDrugLicenseNumber ||
      (previewPhoto && previewPhoto !== origPhoto),
    [shopName, origShopName, gstin, origGstin, pincode, origPincode, drugLicenseNumber, origDrugLicenseNumber, previewPhoto, origPhoto]
  );

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPreviewPhoto(URL.createObjectURL(file));
  };

  const discardProfileChanges = () => {
    setShopName(origShopName);
    setGstin(origGstin);
    setPincode(origPincode);
    setDrugLicenseNumber(origDrugLicenseNumber);
    setPreviewPhoto(null);
  };

  const handleSubmitAll = async () => {
    if (!shopName.trim()) { push("Shop name cannot be empty", "warn"); return; }
    if (pincode && !/^[0-9]{6}$/.test(pincode.trim())) { push("PIN code must be 6 digits", "warn"); return; }
    let finalPhoto = previewPhoto || profilePhoto;
    if (finalPhoto?.startsWith("blob:")) finalPhoto = await blobToBase64(finalPhoto);
    if (shopName === origShopName && gstin === origGstin && pincode === origPincode
        && drugLicenseNumber === origDrugLicenseNumber && finalPhoto === origPhoto) {
      push("No changes to save", "info"); return;
    }
    setSaving(true);
    apiClient(`${API_BASE_URL}/api/Vendor/UpdateVendorSetting`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, shopName, gstin, pincode, drugLicenseNumber, profilePicture: finalPhoto }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.status === 200) {
          push("Profile updated successfully", "success");
          setOrigShopName(shopName);
          setOrigGstin(gstin);
          setOrigPincode(pincode);
          setOrigDrugLicenseNumber(drugLicenseNumber);
          setProfilePhoto(finalPhoto);
          setOrigPhoto(finalPhoto);
          setPreviewPhoto(null);
        } else push(d.message || "Update failed", "error");
      })
      .catch(() => push("Update failed — please try again", "error"))
      .finally(() => setSaving(false));
  };

  const handlePasswordUpdate = () => {
    if (!curPw || !newPw || !conPw) { push("All password fields are required", "warn"); return; }
    if (newPw !== conPw) { push("New passwords do not match", "error"); return; }
    if (getPasswordStrength(newPw) < 1) { push("Password is too weak", "warn"); return; }
    apiClient(`${API_BASE_URL}/api/Vendor/UpdatePassword`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, oldPassword: curPw, newPassword: newPw }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.status === 200) {
          push("Password updated", "success");
          setCurPw(""); setNewPw(""); setConPw("");
        } else push(d.message || "Password update failed", "error");
      })
      .catch(() => push("Password update failed", "error"));
  };

  const fetchSessions = useCallback(() => {
    setSessionsLoading(true);
    setSessionsError(false);
    apiClient(`${API_BASE_URL}/api/auth/Sessions`, { method: "GET" })
      .then((r) => r.json())
      .then((d) => {
        if (d.status === 200) setSessions(d.data || []);
        else { setSessionsError(true); push(d.message || "Failed to load sessions", "error"); }
      })
      .catch(() => setSessionsError(true))
      .finally(() => setSessionsLoading(false));
  }, [push]);

  // Loaded lazily on first visit to the Security tab rather than on mount —
  // this data isn't needed for Profile/Password and changes per device/login.
  useEffect(() => {
    if (tab === "security") fetchSessions();
  }, [tab, fetchSessions]);

  const handleRevokeSession = (uKey) => {
    setRevokingUKey(uKey);
    apiClient(`${API_BASE_URL}/api/auth/Sessions/Revoke/${uKey}`, { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        if (d.status === 200) {
          setSessions((prev) => prev.filter((s) => s.uKey !== uKey));
          push("Session signed out", "success");
        } else push(d.message || "Failed to sign out session", "error");
      })
      .catch(() => push("Failed to sign out session", "error"))
      .finally(() => setRevokingUKey(null));
  };

  const handleSignOutEverywhere = () => {
    if (!window.confirm("End all active sessions across every device, including this one?")) return;
    setSigningOutAll(true);
    apiClient(`${API_BASE_URL}/api/auth/SignOutEverywhere`, { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        if (d.status === 200) {
          localStorage.removeItem("vmsUser");
          localStorage.removeItem("modules");
          navigate("/");
        } else { push(d.message || "Failed to sign out all sessions", "error"); setSigningOutAll(false); }
      })
      .catch(() => { push("Failed to sign out all sessions", "error"); setSigningOutAll(false); });
  };

  const formatSessionTime = (iso) => {
    if (!iso) return "";
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 2) return "Active now";
    if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
    return new Date(iso).toLocaleDateString();
  };

  return (
    <div className="st-root">
      <div className="st-layout">
        <aside className="st-side">
          <div className="st-side-glow" aria-hidden="true" />

          <button className="st-side-back" onClick={() => navigate("/home")}>
            <Icon d={icons.arrowLeft} size={14} /> Dashboard
          </button>

          <div className="st-avatar-block">
            <button className="st-avatar-wrap" onClick={() => fileRef.current.click()} aria-label="Change profile photo">
              <img src={previewPhoto || profilePhoto} alt="Shop avatar" className="st-avatar" />
              <span className="st-avatar-edit"><Icon d={icons.camera} size={15} /></span>
            </button>
            <input type="file" ref={fileRef} accept="image/*" style={{ display: "none" }} onChange={handlePhotoChange} />
            <div className="st-side-name">{shopName || "Your Shop"}</div>
            <div className="st-side-email">{email || "email@example.com"}</div>
          </div>

          <nav className="st-nav">
            <span className="st-nav-indicator" style={{ transform: `translateY(${activeIndex * 48}px)` }} />
            {TABS.map((t) => (
              <button key={t.id} className={`st-nav-btn${tab === t.id ? " is-active" : ""}`} onClick={() => setTab(t.id)}>
                <Icon d={icons[t.icon]} size={15} />
                {t.label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="st-main">
          <header className="st-main-head" key={`head-${tab}`}>
            <span className="st-eyebrow">SETTINGS</span>
            <h1>{active.title}</h1>
            <p>{active.blurb}</p>
          </header>

          {tab === "profile" && (
            <div className="st-stage" key="profile-panel">
              <div className="st-block">
                <Row label="Shop photo" hint="Shown on invoices and across your shop's workspace." first>
                  <div className="st-photo-control">
                    <img src={previewPhoto || profilePhoto} alt="" className="st-photo-thumb" />
                    <button className="st-btn st-btn-ghost st-btn-sm" onClick={() => fileRef.current.click()}>
                      <Icon d={icons.camera} size={14} /> Upload new
                    </button>
                  </div>
                </Row>
                <Row label="Shop name" hint="This is how your shop appears to your team.">
                  <input className="st-input" value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="Your shop name" />
                </Row>
                <Row label="GSTIN" hint="Printed on every tax invoice you issue.">
                  <input className="st-input" value={gstin} onChange={(e) => setGstin(e.target.value)} placeholder="e.g. 27ABCDE1234F1Z5" />
                </Row>
                <Row label="PIN Code" hint="Required to generate an e-invoice IRN or e-way bill — the IRP rejects requests without it.">
                  <input
                    className="st-input"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                    placeholder="e.g. 400001"
                    inputMode="numeric"
                  />
                </Row>
                <Row label="Drug License Number" hint="Required on wholesale invoices under the Drugs & Cosmetics Rules.">
                  <input className="st-input" value={drugLicenseNumber} onChange={(e) => setDrugLicenseNumber(e.target.value)} placeholder="e.g. MH-MUM-2024-WD-1234" />
                </Row>
                <Row label="Email address" hint="Contact support to change your sign-in email.">
                  <input className="st-input" value={email} disabled placeholder="email@example.com" />
                </Row>
              </div>
            </div>
          )}

          {tab === "password" && (
            <div className="st-stage" key="password-panel">
              <div className="st-block">
                <Row label="Current password" first>
                  <EyeInput value={curPw} onChange={(e) => setCurPw(e.target.value)} placeholder="Enter current password" show={showCur} onToggle={() => setShowCur((s) => !s)} />
                </Row>
                <Row label="New password" hint="Use at least 8 characters, mixing case, numbers, and symbols.">
                  <EyeInput value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Enter new password" show={showNew} onToggle={() => setShowNew((s) => !s)} />
                  <StrengthMeter password={newPw} />
                </Row>
                <Row label="Confirm new password">
                  <EyeInput value={conPw} onChange={(e) => setConPw(e.target.value)} placeholder="Confirm new password" show={showCon} onToggle={() => setShowCon((s) => !s)} />
                  {conPw && newPw && (
                    <span className={`st-match ${conPw === newPw ? "ok" : "bad"}`}>
                      {conPw === newPw ? "Passwords match" : "Passwords do not match"}
                    </span>
                  )}
                </Row>
              </div>
              <div className="st-stage-actions">
                <button className="st-btn st-btn-ghost" onClick={() => { setCurPw(""); setNewPw(""); setConPw(""); }}>Clear</button>
                <button className="st-btn st-btn-primary" onClick={handlePasswordUpdate}>
                  <Icon d={icons.check} size={15} /> Update password
                </button>
              </div>
            </div>
          )}

          {tab === "security" && (
            <div className="st-stage" key="security-panel">
              <div className="st-block">
                <div className="st-block-kicker">Active sessions</div>
                {sessionsLoading ? (
                  <Row label="Loading sessions…" first />
                ) : sessionsError ? (
                  <Row label="Couldn't load sessions" hint="Check your connection and try again." first>
                    <button className="st-btn st-btn-ghost st-btn-sm" onClick={fetchSessions}>Retry</button>
                  </Row>
                ) : sessions.length === 0 ? (
                  <Row label="No active sessions" first />
                ) : (
                  sessions.map((s, i) => (
                    <Row
                      key={s.uKey}
                      label={s.browserLabel || "Unknown device"}
                      hint={`${s.ipAddress || "Unknown location"} · ${formatSessionTime(s.lastActiveAt)}`}
                      first={i === 0}
                    >
                      {s.current
                        ? <span className="st-pill st-pill-live">This device</span>
                        : (
                          <button
                            className="st-btn st-btn-ghost st-btn-sm"
                            onClick={() => handleRevokeSession(s.uKey)}
                            disabled={revokingUKey === s.uKey}
                          >
                            {revokingUKey === s.uKey ? "Signing out…" : "Revoke"}
                          </button>
                        )}
                    </Row>
                  ))
                )}
              </div>

              <div className="st-block st-block-danger">
                <div className="st-block-kicker danger">Danger zone</div>
                <Row label="Sign out everywhere" hint="End all active sessions across every device, including this one." first>
                  <button className="st-btn st-btn-danger" onClick={handleSignOutEverywhere} disabled={signingOutAll}>
                    <Icon d={icons.logout} size={14} /> {signingOutAll ? "Signing out…" : "Sign out all"}
                  </button>
                </Row>
                <Row label="Delete account" hint="Not available yet — contact support to close your account.">
                  <button className="st-btn st-btn-danger" disabled title="Account deletion isn't available from Settings yet">
                    <Icon d={icons.trash} size={14} /> Delete
                  </button>
                </Row>
              </div>
            </div>
          )}
        </section>
      </div>

      <div className={`st-savebar${isDirty ? " is-visible" : ""}`}>
        <span>You have unsaved changes</span>
        <div className="st-savebar-actions">
          <button className="st-btn st-btn-ghost st-btn-sm" onClick={discardProfileChanges}>Discard</button>
          <button className="st-btn st-btn-primary st-btn-sm" onClick={handleSubmitAll} disabled={saving}>
            <Icon d={icons.save} size={14} /> {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      <ToastStack toasts={toasts} />
    </div>
  );
}
