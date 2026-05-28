import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../Styles/Setting.css";
import API_BASE_URL from "../Config/api.config";


/* ─── Helpers ──────────────────────────────────────────────── */
const blobToBase64 = async (blobUrl) => {
  const res  = await fetch(blobUrl);
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
      const MAX    = 80;
      const ratio  = Math.min(MAX / img.width, MAX / img.height);
      canvas.width  = Math.round(img.width  * ratio);
      canvas.height = Math.round(img.height * ratio);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const compressed = canvas.toDataURL("image/jpeg", 0.7);
      localStorage.setItem("profilePhoto", compressed);
      window.dispatchEvent(new CustomEvent("profilePhotoUpdated", { detail: compressed }));
    };
    img.src = base64String.startsWith("data:")
      ? base64String
      : `data:image/jpeg;base64,${base64String}`;
  } catch (e) { console.error("Compression error:", e); }
};

const getPasswordStrength = (pw) => {
  if (!pw) return -1;
  let score = 0;
  if (pw.length >= 8)  score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return 0;
  if (score <= 2) return 1;
  return 2;
};

/* ─── Icon Components ──────────────────────────────────────── */
const Icon = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const icons = {
  user:    "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z",
  lock:    "M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4",
  bell:    "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0",
  shield:  "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  upload:  "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12",
  eye:     "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 12a3 3 0 100-6 3 3 0 000 6z",
  eyeoff:  "M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22",
  check:   "M20 6L9 17l-5-5",
  save:    "M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2zM17 21v-8H7v8M7 3v5h8",
  trash:   "M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2",
  logout:  "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
  edit:    "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
};

/* ─── Sub-components ───────────────────────────────────────── */
const NavBtn = ({ icon, label, active, onClick }) => (
  <button className={`s-nav-btn ${active ? "active" : ""}`} onClick={onClick}>
    <Icon d={icons[icon]} size={15} />
    {label}
  </button>
);

const Field = ({ label, children }) => (
  <div className="s-field">
    <label className="s-label">{label}</label>
    {children}
  </div>
);

const EyeInput = ({ value, onChange, placeholder, show, onToggle }) => (
  <div className="s-input-wrap">
    <input
      className="s-input with-eye"
      type={show ? "text" : "password"}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
    />
    <button className="s-eye" type="button" onClick={onToggle}>
      <Icon d={show ? icons.eye : icons.eyeoff} />
    </button>
  </div>
);

const StrengthMeter = ({ password }) => {
  const level  = getPasswordStrength(password);
  const labels = ["Weak", "Fair", "Strong"];
  const cls    = ["w0",   "w1",   "w2"];
  return (
    <div className="s-strength">
      <div className="s-strength-bars">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`s-strength-bar ${level >= 0 && i <= level ? `active-${level}` : ""}`}
          />
        ))}
      </div>
      {level >= 0 && (
        <span className={`s-strength-label ${cls[level]}`}>{labels[level]}</span>
      )}
    </div>
  );
};

/* ─── Toast System ─────────────────────────────────────────── */
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
  <div className="s-toast">
    {toasts.map((t) => (
      <div key={t.id} className={`s-toast-item ${t.type}`}>
        <div className="s-toast-icon" />
        {t.msg}
      </div>
    ))}
  </div>
);

/* ─── Main Component ───────────────────────────────────────── */
export default function Settings() {
  const navigate = useNavigate();
  const fileRef  = useRef(null);
  const { toasts, push } = useToast();

  const [tab, setTab] = useState("profile");

  /* profile state */
  const [shopName, setShopName]                 = useState("");
  const [origShopName, setOrigShopName]         = useState("");
  const [editingShop, setEditingShop]           = useState(false);
  const [email, setEmail]                       = useState("");
  const [profilePhoto, setProfilePhoto]         = useState("https://via.placeholder.com/140");
  const [origPhoto, setOrigPhoto]               = useState("https://via.placeholder.com/140");
  const [previewPhoto, setPreviewPhoto]         = useState(null);

  /* password state */
  const [curPw, setCurPw]   = useState("");
  const [newPw, setNewPw]   = useState("");
  const [conPw, setConPw]   = useState("");
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showCon, setShowCon] = useState(false);

  /* fetch */
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/Vendor/SettingDetails`, {
      method: "GET", credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.status === 200) {
          setShopName(d.data.shopName);   setOrigShopName(d.data.shopName);
          setEmail(d.data.email);
          if (d.data.profilePhoto) {
            setProfilePhoto(d.data.profilePhoto);
            setOrigPhoto(d.data.profilePhoto);
            compressAndStore(d.data.profilePhoto);
          }
        } else push(d.message || "Failed to load settings", "error");
      })
      .catch(() => push("Unable to fetch settings", "error"));
  }, []);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPreviewPhoto(URL.createObjectURL(file));
    push("Photo selected — save to apply", "info");
  };

  const handleShopSave = () => {
    if (!shopName.trim()) { push("Shop name cannot be empty", "warn"); return; }
    setEditingShop(false);
    push("Shop name updated — save to apply", "info");
  };

  const handleSubmitAll = async () => {
    let finalPhoto = previewPhoto || profilePhoto;
    if (finalPhoto?.startsWith("blob:")) finalPhoto = await blobToBase64(finalPhoto);
    if (shopName === origShopName && finalPhoto === origPhoto) {
      push("No changes to save", "info"); return;
    }
    fetch(`${API_BASE_URL}/api/Vendor/UpdateVendorSetting`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, shopName, profilePicture: finalPhoto }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.status === 200) {
          push("Profile updated successfully", "success");
          setOrigShopName(shopName);
          setProfilePhoto(finalPhoto);
          setOrigPhoto(finalPhoto);
          setPreviewPhoto(null);
        } else push(d.message || "Update failed", "error");
      })
      .catch(() => push("Update failed — please try again", "error"));
  };

  const handlePasswordUpdate = () => {
    if (!curPw || !newPw || !conPw) { push("All password fields are required", "warn"); return; }
    if (newPw !== conPw)            { push("New passwords do not match", "error"); return; }
    if (getPasswordStrength(newPw) < 1) { push("Password is too weak", "warn"); return; }
    fetch(`${API_BASE_URL}/api/Vendor/UpdatePassword`, {
      method: "PUT", credentials: "include",
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

  /* ── Render ── */
  return (
    <div className="s-root">
      <div className="s-blob-1" /><div className="s-blob-2" />

      <div className="s-inner">
        
        <div className="s-head">
          <div className="s-eyebrow">
            <div className="s-eyebrow-dot" />
            Account Settings
          </div>
          <h1 className="s-title">Manage your <span>Profile</span></h1>
          <p className="s-subtitle">Update your shop info, avatar, and security settings.</p>
        </div>

        
        <nav className="s-nav">
          <NavBtn icon="user"   label="Profile"   active={tab==="profile"}  onClick={() => setTab("profile")}  />
          <NavBtn icon="lock"   label="Password"  active={tab==="password"} onClick={() => setTab("password")} />
          <NavBtn icon="shield" label="Security"  active={tab==="security"} onClick={() => setTab("security")} />
        </nav>

        
        <div className={`s-panel ${tab === "profile" ? "visible" : ""}`}>
          <div className="s-card">
            <div className="s-card-head">
              <div className="s-card-icon blue"><Icon d={icons.user} /></div>
              <span className="s-card-label">Profile Information</span>
            </div>
            <div className="s-card-body">
              
              <div className="s-avatar-section">
                <div className="s-avatar-ring">
                  <img src={previewPhoto || profilePhoto} alt="Avatar" className="s-avatar" />
                </div>
                <div className="s-avatar-info">
                  <div className="s-avatar-name">{shopName || "Your Shop"}</div>
                  <div className="s-avatar-email">{email || "email@example.com"}</div>
                </div>
                <button className="s-upload-btn" onClick={() => fileRef.current.click()}>
                  <Icon d={icons.upload} />
                  Change Photo
                </button>
                <input type="file" ref={fileRef} accept="image/*"
                       style={{ display: "none" }} onChange={handlePhotoChange} />
              </div>

              
              <div className="s-grid">
                <Field label="Shop Name">
                  <div className="s-input-wrap">
                    <input
                      className={`s-input has-suffix`}
                      value={shopName}
                      disabled={!editingShop}
                      onChange={(e) => setShopName(e.target.value)}
                      placeholder="Your shop name"
                    />
                    <div className="s-suffix">
                      {!editingShop
                        ? <button className="s-edit-btn" onClick={() => setEditingShop(true)}>Edit</button>
                        : <button className="s-edit-btn save" onClick={handleShopSave}>Save</button>
                      }
                    </div>
                  </div>
                </Field>

                <Field label="Email Address">
                  <input className="s-input" value={email} disabled placeholder="email@example.com" />
                </Field>
              </div>
            </div>
          </div>

          <div className="s-actions">
            <button className="s-btn s-btn-ghost" onClick={() => navigate("/home")}>Cancel</button>
            <button className="s-btn s-btn-primary" onClick={handleSubmitAll}>
              <Icon d={icons.save} />
              Save Changes
            </button>
          </div>
        </div>

        
        <div className={`s-panel ${tab === "password" ? "visible" : ""}`}>
          <div className="s-card">
            <div className="s-card-head">
              <div className="s-card-icon purple"><Icon d={icons.lock} /></div>
              <span className="s-card-label">Change Password</span>
            </div>
            <div className="s-card-body">
              <div className="s-grid">
                <Field label="Current Password">
                  <EyeInput value={curPw} onChange={(e) => setCurPw(e.target.value)}
                            placeholder="Enter current password"
                            show={showCur} onToggle={() => setShowCur(!showCur)} />
                </Field>

                <div />

                <Field label="New Password">
                  <EyeInput value={newPw} onChange={(e) => setNewPw(e.target.value)}
                            placeholder="Enter new password"
                            show={showNew} onToggle={() => setShowNew(!showNew)} />
                  <StrengthMeter password={newPw} />
                </Field>

                <Field label="Confirm New Password">
                  <EyeInput value={conPw} onChange={(e) => setConPw(e.target.value)}
                            placeholder="Confirm new password"
                            show={showCon} onToggle={() => setShowCon(!showCon)} />
                  {conPw && newPw && (
                    <div style={{ fontSize: 11, marginTop: 4,
                                  color: conPw === newPw ? "var(--accent-c)" : "var(--accent-danger)" }}>
                      {conPw === newPw ? "✓ Passwords match" : "✗ Passwords do not match"}
                    </div>
                  )}
                </Field>
              </div>

              <div className="s-actions">
                <button className="s-btn s-btn-ghost" onClick={() => { setCurPw(""); setNewPw(""); setConPw(""); }}>
                  Clear
                </button>
                <button className="s-btn s-btn-primary" onClick={handlePasswordUpdate}>
                  <Icon d={icons.check} />
                  Update Password
                </button>
              </div>
            </div>
          </div>
        </div>

        
        <div className={`s-panel ${tab === "security" ? "visible" : ""}`}>
          <div className="s-card">
            <div className="s-card-head">
              <div className="s-card-icon green"><Icon d={icons.bell} /></div>
              <span className="s-card-label">Login Activity</span>
            </div>
            <div className="s-card-body">
              {[
                { device: "Chrome on Windows", loc: "Delhi, IN", time: "Active now",  dot: "var(--accent-c)" },
                { device: "Safari on iPhone",  loc: "Delhi, IN", time: "2 hours ago", dot: "var(--text-3)" },
                { device: "Firefox on Mac",    loc: "Mumbai, IN",time: "3 days ago",  dot: "var(--text-3)" },
              ].map((s) => (
                <div key={s.device} style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                                             padding:"13px 0", borderBottom:"1px solid var(--border-sub)" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:s.dot, flexShrink:0 }} />
                    <div>
                      <div style={{ fontSize:13, fontWeight:500, color:"var(--text-1)" }}>{s.device}</div>
                      <div style={{ fontSize:11, color:"var(--text-2)", marginTop:2 }}>{s.loc} · {s.time}</div>
                    </div>
                  </div>
                  {s.time !== "Active now" && (
                    <button className="s-edit-btn" style={{ color:"var(--accent-danger)", borderColor:"rgba(248,113,113,0.3)" }}>
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="s-card s-danger-zone">
            <div className="s-card-head">
              <div className="s-card-icon" style={{ background:"rgba(248,113,113,0.1)", color:"var(--accent-danger)" }}>
                <Icon d={icons.shield} />
              </div>
              <span className="s-card-label" style={{ color:"var(--accent-danger)", opacity:0.8 }}>Danger Zone</span>
            </div>
            <div className="s-danger-item">
              <div className="s-danger-text">
                <p>Sign out everywhere</p>
                <span>End all active sessions across devices</span>
              </div>
              <button className="s-btn s-btn-danger" style={{ padding:"9px 18px", fontSize:12 }}>
                <Icon d={icons.logout} />
                Sign Out All
              </button>
            </div>
            <div className="s-danger-item">
              <div className="s-danger-text">
                <p>Delete Account</p>
                <span>Permanently remove your account and all data</span>
              </div>
              <button className="s-btn s-btn-danger" style={{ padding:"9px 18px", fontSize:12 }}>
                <Icon d={icons.trash} />
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>


      <ToastStack toasts={toasts} />
    </div>
  );
}