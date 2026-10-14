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
  percent: "M19 5L5 19M7.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM16.5 20a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
};

const TABS = [
  { id: "profile", label: "Profile", icon: "user", title: "Profile", blurb: "How your shop appears across VMS." },
  { id: "password", label: "Password", icon: "lock", title: "Password", blurb: "Keep your account secure with a strong password." },
  { id: "tax", label: "Tax", icon: "percent", title: "Tax Configuration", blurb: "TDS on what you buy, and the retailer-TDS estimate on what you sell — settings for your business." },
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

/* ─── TDS/TCS rule block (Tax tab) ─────────────────────────── */
const TaxRuleBlock = ({ title, hint, rule, setRule, onSave, saving }) => (
  <div className="st-block">
    <div className="st-block-kicker">{title}</div>
    <Row label="Enable" hint={hint} first>
      <button
        type="button"
        className={`st-btn st-btn-sm ${rule.enabled ? "st-btn-primary" : "st-btn-ghost"}`}
        onClick={() => setRule((p) => ({ ...p, enabled: !p.enabled }))}
      >
        {rule.enabled ? "Enabled" : "Disabled"}
      </button>
    </Row>
    {rule.enabled && (
      <>
        <Row label="Section Code" hint="Confirm with your CA before changing this — don't guess at a renumbered section.">
          <input
            className="st-input"
            value={rule.sectionCode}
            onChange={(e) => setRule((p) => ({ ...p, sectionCode: e.target.value }))}
            placeholder={title === "TDS" ? "e.g. 194Q" : "e.g. 206C(1H)"}
          />
        </Row>
        <Row label="Threshold Amount (₹ / financial year)">
          <input
            className="st-input"
            type="number"
            min="0"
            value={rule.thresholdAmount}
            onChange={(e) => setRule((p) => ({ ...p, thresholdAmount: e.target.value }))}
            placeholder="5000000"
          />
        </Row>
        <Row label="Rate — party has PAN on file (%)">
          <input
            className="st-input"
            type="number"
            min="0"
            step="0.001"
            value={rule.ratePercent}
            onChange={(e) => setRule((p) => ({ ...p, ratePercent: e.target.value }))}
            placeholder="0.1"
          />
        </Row>
        <Row label="Rate — party has no PAN on file (%)">
          <input
            className="st-input"
            type="number"
            min="0"
            step="0.001"
            value={rule.ratePercentWithoutPan}
            onChange={(e) => setRule((p) => ({ ...p, ratePercentWithoutPan: e.target.value }))}
            placeholder={title === "TDS" ? "5" : "1"}
          />
        </Row>
        <Row label="Late deposit interest (%/month)" hint="Charged per month or part-month a deposit runs past its due date. Confirm with your CA before relying on this for an actual filing.">
          <input
            className="st-input"
            type="number"
            min="0"
            step="0.001"
            value={rule.lateDepositInterestRatePercent}
            onChange={(e) => setRule((p) => ({ ...p, lateDepositInterestRatePercent: e.target.value }))}
            placeholder="1.5"
          />
        </Row>
      </>
    )}
    <div className="st-stage-actions">
      <button className="st-btn st-btn-primary st-btn-sm" onClick={onSave} disabled={saving}>
        <Icon d={icons.save} size={13} /> {saving ? "Saving…" : `Save ${title} Settings`}
      </button>
    </div>
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

  // Admin (blank vendorPrefix, same convention the backend uses — see
  // SecurityUtil.getVendorPrefix) gets an extra "MFA Policy" tab; everyone
  // else only ever sees their own Two-step verification block in Security.
  const vmsUserVendorPrefix = (() => {
    try { return JSON.parse(localStorage.getItem("vmsUser") || "null")?.data?.vendorPrefix; }
    catch { return undefined; }
  })();
  const isAdmin = !vmsUserVendorPrefix;
  const tabs = isAdmin
    ? [...TABS, { id: "mfaPolicy", label: "MFA Policy", icon: "shield", title: "MFA Policy", blurb: "Control two-step verification across your entire VMS instance." }]
    : TABS;
  const activeIndex = tabs.findIndex((t) => t.id === tab);
  const active = tabs[activeIndex];

  /* profile state */
  const [shopName, setShopName] = useState("");
  const [origShopName, setOrigShopName] = useState("");
  const [gstin, setGstin] = useState("");
  const [origGstin, setOrigGstin] = useState("");
  const [pincode, setPincode] = useState("");
  const [origPincode, setOrigPincode] = useState("");
  const [drugLicenseNumber, setDrugLicenseNumber] = useState("");
  const [origDrugLicenseNumber, setOrigDrugLicenseNumber] = useState("");
  const [tan, setTan] = useState("");
  const [origTan, setOrigTan] = useState("");
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

  /* tax configuration state — TdsSetting/TcsSetting are separate backend
     resources from the vendor profile, so each saves independently rather
     than joining the profile save-bar (TAN is the exception: it lives on
     Vendors itself, saved through the same /UpdateVendorSetting call as
     GSTIN/PIN/Drug License, so it participates in that save-bar instead). */
  const emptyTaxRule = { enabled: false, sectionCode: "", thresholdAmount: "", ratePercent: "", ratePercentWithoutPan: "", lateDepositInterestRatePercent: "" };
  const [tds, setTds] = useState(emptyTaxRule);
  const [tcs, setTcs] = useState(emptyTaxRule);
  const [taxLoading, setTaxLoading] = useState(false);
  const [savingTds, setSavingTds] = useState(false);
  const [savingTcs, setSavingTcs] = useState(false);

  /* historical FY turnover backfill (Phase D) — party_turnover started as a
     brand-new empty table, so a party's turnover before TCS/TDS was enabled
     starts the threshold check from zero. One-time, vendor-triggered,
     previewable action; see Services/TaxTurnoverBackfillService's Javadoc. */
  const [backfillResult, setBackfillResult] = useState(null);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [applyingBackfill, setApplyingBackfill] = useState(false);

  const loadBackfillPreview = () => {
    setBackfillLoading(true);
    apiClient(`${API_BASE_URL}/api/TaxTurnoverBackfill/Preview`)
      .then((r) => r.json())
      .then((d) => {
        if (d.status === 200) setBackfillResult(d.data);
        else push(d.message || "Failed to load backfill preview", "error");
      })
      .catch(() => push("Failed to load backfill preview", "error"))
      .finally(() => setBackfillLoading(false));
  };

  const applyBackfill = () => {
    const totalParties = (backfillResult?.tcs?.rows?.length || 0) + (backfillResult?.tds?.rows?.length || 0);
    if (!window.confirm(
      `This will add historical turnover for ${totalParties} part${totalParties === 1 ? "y" : "ies"} to this ` +
      "financial year's threshold tracking. This mutates live tax ledger data and can't be undone. Continue?"
    )) return;

    setApplyingBackfill(true);
    apiClient(`${API_BASE_URL}/api/TaxTurnoverBackfill/Apply`, { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        if (d.status === 200) {
          setBackfillResult(d.data);
          push("Backfill applied successfully", "success");
        } else {
          push(d.message || "Failed to apply backfill", "error");
        }
      })
      .catch(() => push("Failed to apply backfill", "error"))
      .finally(() => setApplyingBackfill(false));
  };

  /* statutory return filing (Phase 7) — a filter-driven summary + filing
     checklist, not a government-submittable file; see
     StatutoryReturnCommonRepository's Javadoc on the backend for why. */
  const currentFinancialYear = (() => {
    const now = new Date();
    const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1; // getMonth() is 0-based; April = 3
    return `${startYear}-${startYear + 1}`;
  })();
  const [returnFilter, setReturnFilter] = useState({ taxType: "TDS", financialYear: currentFinancialYear, quarter: "Q1" });
  const [returnData, setReturnData] = useState(null);
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnExporting, setReturnExporting] = useState(false);
  const [markingFiled, setMarkingFiled] = useState(false);

  const loadStatutoryReturn = () => {
    setReturnLoading(true);
    setReturnData(null);
    apiClient(`${API_BASE_URL}/api/StatutoryReturn/Get`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(returnFilter),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.status === 200) setReturnData(d.data);
        else push(d.message || "Failed to load return data", "error");
      })
      .catch(() => push("Failed to load return data", "error"))
      .finally(() => setReturnLoading(false));
  };

  const exportStatutoryReturn = async () => {
    setReturnExporting(true);
    try {
      const res = await apiClient(`${API_BASE_URL}/api/StatutoryReturn/GenerateExcel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(returnFilter),
      });
      if (!res.ok) { push("Failed to export return summary", "error"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${returnFilter.taxType}_Return_${returnFilter.financialYear}_${returnFilter.quarter}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      push("Failed to export return summary", "error");
    } finally {
      setReturnExporting(false);
    }
  };

  const markStatutoryReturnFiled = () => {
    const acknowledgementNumber = window.prompt("Acknowledgement number (optional):", "") || "";
    setMarkingFiled(true);
    apiClient(`${API_BASE_URL}/api/StatutoryReturn/MarkFiled`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...returnFilter, acknowledgementNumber }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.status === 200) { push(d.message || "Marked as filed", "success"); loadStatutoryReturn(); }
        else push(d.message || "Failed to mark as filed", "error");
      })
      .catch(() => push("Failed to mark as filed", "error"))
      .finally(() => setMarkingFiled(false));
  };

  /* security state */
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState(false);
  const [revokingUKey, setRevokingUKey] = useState(null);
  const [signingOutAll, setSigningOutAll] = useState(false);

  /* two-step verification (MFA) state — see Services/MfaService and
     Controller/MfaController on the backend. */
  const [myMfa, setMyMfa] = useState(null);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaEnrollChallenge, setMfaEnrollChallenge] = useState(null);
  const [mfaEnrollCode, setMfaEnrollCode] = useState("");
  const [mfaEnabling, setMfaEnabling] = useState(false);
  const [mfaConfirming, setMfaConfirming] = useState(false);
  const [mfaDisabling, setMfaDisabling] = useState(null);
  const [revokingDeviceUKey, setRevokingDeviceUKey] = useState(null);

  /* admin MFA policy state (MFA Policy tab, admin only) */
  const [mfaPolicy, setMfaPolicy] = useState(null);
  const [mfaPolicyLoading, setMfaPolicyLoading] = useState(false);
  const [savingMfaPolicy, setSavingMfaPolicy] = useState(false);

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
          setTan(d.data.tan || ""); setOrigTan(d.data.tan || "");
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
      tan !== origTan ||
      (previewPhoto && previewPhoto !== origPhoto),
    [shopName, origShopName, gstin, origGstin, pincode, origPincode, drugLicenseNumber, origDrugLicenseNumber, tan, origTan, previewPhoto, origPhoto]
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
    setTan(origTan);
    setPreviewPhoto(null);
  };

  const handleSubmitAll = async () => {
    if (!shopName.trim()) { push("Shop name cannot be empty", "warn"); return; }
    if (pincode && !/^[0-9]{6}$/.test(pincode.trim())) { push("PIN code must be 6 digits", "warn"); return; }
    if (tan && !/^[A-Z]{4}[0-9]{5}[A-Z]$/.test(tan.toUpperCase().trim())) { push("TAN must be in the format ABCD12345E", "warn"); return; }
    let finalPhoto = previewPhoto || profilePhoto;
    if (finalPhoto?.startsWith("blob:")) finalPhoto = await blobToBase64(finalPhoto);
    if (shopName === origShopName && gstin === origGstin && pincode === origPincode
        && drugLicenseNumber === origDrugLicenseNumber && tan === origTan && finalPhoto === origPhoto) {
      push("No changes to save", "info"); return;
    }
    setSaving(true);
    const tanUpper = tan ? tan.toUpperCase().trim() : "";
    apiClient(`${API_BASE_URL}/api/Vendor/UpdateVendorSetting`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, shopName, gstin, pincode, drugLicenseNumber, tan: tanUpper, profilePicture: finalPhoto }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.status === 200) {
          push("Profile updated successfully", "success");
          setOrigShopName(shopName);
          setOrigGstin(gstin);
          setOrigPincode(pincode);
          setOrigDrugLicenseNumber(drugLicenseNumber);
          setTan(tanUpper); setOrigTan(tanUpper);
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

  const fetchMyMfa = useCallback(() => {
    setMfaLoading(true);
    const deviceToken = localStorage.getItem("vmsDeviceToken") || "";
    apiClient(`${API_BASE_URL}/api/Mfa/GetMyMfa`, {
      method: "GET",
      headers: deviceToken ? { "X-Device-Token": deviceToken } : {},
    })
      .then((r) => r.json())
      .then((d) => { if (d.status === 200) setMyMfa(d.data); })
      .catch(() => {})
      .finally(() => setMfaLoading(false));
  }, []);

  // Loaded lazily on first visit to the Security tab rather than on mount —
  // this data isn't needed for Profile/Password and changes per device/login.
  useEffect(() => {
    if (tab === "security") { fetchSessions(); fetchMyMfa(); }
  }, [tab, fetchSessions, fetchMyMfa]);

  // Loaded lazily on first visit to the (admin-only) MFA Policy tab.
  useEffect(() => {
    if (tab !== "mfaPolicy") return;
    setMfaPolicyLoading(true);
    apiClient(`${API_BASE_URL}/api/MfaSetting/Get`)
      .then((r) => r.json())
      .then((d) => {
        if (d.status === 200) setMfaPolicy(d.data);
        else push(d.message || "Failed to load MFA policy", "error");
      })
      .catch(() => push("Failed to load MFA policy", "error"))
      .finally(() => setMfaPolicyLoading(false));
  }, [tab]);

  const saveMfaPolicy = () => {
    if (!mfaPolicy) return;
    setSavingMfaPolicy(true);
    apiClient(`${API_BASE_URL}/api/MfaSetting/Save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mfaPolicy),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.status === 200) { setMfaPolicy(d.data); push("MFA policy saved", "success"); }
        else push(d.message || "Failed to save MFA policy", "error");
      })
      .catch(() => push("Failed to save MFA policy", "error"))
      .finally(() => setSavingMfaPolicy(false));
  };

  const handleEnableMfaMethod = (method) => {
    setMfaEnabling(true);
    apiClient(`${API_BASE_URL}/api/Mfa/EnableMethod`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.status === 200) {
          setMfaEnrollChallenge({ method, mfaToken: d.data.mfaToken, maskedTarget: d.data.maskedTarget });
          setMfaEnrollCode("");
          push(`Verification code sent to ${d.data.maskedTarget || "you"}`, "success");
        } else push(d.message || "Failed to start verification", "error");
      })
      .catch(() => push("Failed to start verification", "error"))
      .finally(() => setMfaEnabling(false));
  };

  const handleConfirmMfaCode = () => {
    if (!mfaEnrollChallenge || mfaEnrollCode.trim().length < 4) return;
    setMfaConfirming(true);
    apiClient(`${API_BASE_URL}/api/Mfa/ConfirmMethod`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mfaToken: mfaEnrollChallenge.mfaToken, code: mfaEnrollCode.trim() }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.status === 200) {
          push("Two-step verification enabled", "success");
          setMfaEnrollChallenge(null);
          setMfaEnrollCode("");
          fetchMyMfa();
        } else push(d.message || "Incorrect code", "error");
      })
      .catch(() => push("Failed to verify code", "error"))
      .finally(() => setMfaConfirming(false));
  };

  const handleResendMfaEnrollCode = () => {
    if (!mfaEnrollChallenge) return;
    apiClient(`${API_BASE_URL}/api/Mfa/ResendEnrollCode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mfaToken: mfaEnrollChallenge.mfaToken }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.status === 200) push("Verification code resent", "success");
        else push(d.message || "Failed to resend code", "error");
      })
      .catch(() => push("Failed to resend code", "error"));
  };

  const handleDisableMfaMethod = (method) => {
    const password = window.prompt("Enter your password to turn off two-step verification:");
    if (!password) return;
    setMfaDisabling(method);
    apiClient(`${API_BASE_URL}/api/Mfa/DisableMethod`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, password }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.status === 200) { push("Two-step verification turned off", "success"); fetchMyMfa(); }
        else push(d.message || "Incorrect password", "error");
      })
      .catch(() => push("Failed to turn off verification", "error"))
      .finally(() => setMfaDisabling(null));
  };

  const handleRevokeTrustedDevice = (uKey) => {
    setRevokingDeviceUKey(uKey);
    apiClient(`${API_BASE_URL}/api/Mfa/TrustedDevices/Revoke/${uKey}`, { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        if (d.status === 200) { push("Device forgotten", "success"); fetchMyMfa(); }
        else push(d.message || "Failed to forget device", "error");
      })
      .catch(() => push("Failed to forget device", "error"))
      .finally(() => setRevokingDeviceUKey(null));
  };

  const toRuleForm = (d) => ({
    enabled: !!d.enabled,
    sectionCode: d.sectionCode || "",
    thresholdAmount: d.thresholdAmount != null ? String(d.thresholdAmount) : "",
    ratePercent: d.ratePercent != null ? String(d.ratePercent) : "",
    ratePercentWithoutPan: d.ratePercentWithoutPan != null ? String(d.ratePercentWithoutPan) : "",
    lateDepositInterestRatePercent: d.lateDepositInterestRatePercent != null ? String(d.lateDepositInterestRatePercent) : "",
  });

  // Loaded lazily on first visit to the Tax tab, same reasoning as Security.
  useEffect(() => {
    if (tab !== "tax") return;
    setTaxLoading(true);
    Promise.all([
      apiClient(`${API_BASE_URL}/api/TdsSetting/Get`).then((r) => r.json()),
      apiClient(`${API_BASE_URL}/api/TcsSetting/Get`).then((r) => r.json()),
    ])
      .then(([tdsRes, tcsRes]) => {
        if (tdsRes.status === 200 && tdsRes.data) setTds(toRuleForm(tdsRes.data));
        if (tcsRes.status === 200 && tcsRes.data) setTcs(toRuleForm(tcsRes.data));
      })
      .catch(() => push("Failed to load tax configuration", "error"))
      .finally(() => setTaxLoading(false));
  }, [tab]);

  const saveTaxRule = (kind) => {
    const rule = kind === "tds" ? tds : tcs;
    const setSavingFlag = kind === "tds" ? setSavingTds : setSavingTcs;
    const endpoint = kind === "tds" ? "TdsSetting" : "TcsSetting";

    if (rule.thresholdAmount && isNaN(parseFloat(rule.thresholdAmount))) { push("Threshold must be a number", "warn"); return; }
    if (rule.ratePercent && isNaN(parseFloat(rule.ratePercent))) { push("Rate (with PAN) must be a number", "warn"); return; }
    if (rule.ratePercentWithoutPan && isNaN(parseFloat(rule.ratePercentWithoutPan))) { push("Rate (without PAN) must be a number", "warn"); return; }
    if (rule.lateDepositInterestRatePercent && isNaN(parseFloat(rule.lateDepositInterestRatePercent))) { push("Late deposit interest rate must be a number", "warn"); return; }

    setSavingFlag(true);
    apiClient(`${API_BASE_URL}/api/${endpoint}/Save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: rule.enabled,
        sectionCode: rule.sectionCode || null,
        thresholdAmount: rule.thresholdAmount !== "" ? parseFloat(rule.thresholdAmount) : null,
        ratePercent: rule.ratePercent !== "" ? parseFloat(rule.ratePercent) : null,
        ratePercentWithoutPan: rule.ratePercentWithoutPan !== "" ? parseFloat(rule.ratePercentWithoutPan) : null,
        lateDepositInterestRatePercent: rule.lateDepositInterestRatePercent !== "" ? parseFloat(rule.lateDepositInterestRatePercent) : null,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.status === 200) {
          push(`${kind.toUpperCase()} settings saved`, "success");
          if (d.data) (kind === "tds" ? setTds : setTcs)(toRuleForm(d.data));
        } else push(d.message || `Failed to save ${kind.toUpperCase()} settings`, "error");
      })
      .catch(() => push(`Failed to save ${kind.toUpperCase()} settings`, "error"))
      .finally(() => setSavingFlag(false));
  };

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
            {tabs.map((t) => (
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

          {tab === "tax" && (
            <div className="st-stage" key="tax-panel">
              <div className="st-block">
                <div className="st-block-kicker">Business identity</div>
                <Row label="TAN" hint="Required to actually deduct TDS with the government on your purchases. Saves together with your Profile changes, below." first>
                  <input
                    className="st-input"
                    value={tan}
                    onChange={(e) => setTan(e.target.value.toUpperCase().slice(0, 10))}
                    placeholder="e.g. ABCD12345E"
                  />
                </Row>
              </div>

              {taxLoading ? (
                <div className="st-block"><Row label="Loading tax configuration…" first /></div>
              ) : (
                <>
                  <TaxRuleBlock
                    title="TDS"
                    hint="Section 194Q — tax deducted from a supplier once their FY purchase total crosses the threshold."
                    rule={tds}
                    setRule={setTds}
                    onSave={() => saveTaxRule("tds")}
                    saving={savingTds}
                  />
                  <TaxRuleBlock
                    title="Retailer TDS (estimate)"
                    hint="206C(1H) TCS was withdrawn from 1 Apr 2025 — you no longer collect anything on a normal sale. This configures an informational estimate of what a retailer who has self-declared they deduct Section 194Q will withhold when paying you, once their FY purchases from you cross the threshold. Nothing here is added to an invoice, collected, or remitted by you."
                    rule={tcs}
                    setRule={setTcs}
                    onSave={() => saveTaxRule("tcs")}
                    saving={savingTcs}
                  />

                  <div className="st-block">
                    <div className="st-block-kicker">Return Filing</div>
                    <Row label="Return" hint="A Form 26Q (TDS) preparation summary — not a government-submittable file. TCS here is historical only (206C(1H) sales collected before it was withdrawn on 1 Apr 2025); it won't grow with new sales. Hand the export to your CA or filing software." first>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <select
                          className="st-input"
                          style={{ width: 90 }}
                          value={returnFilter.taxType}
                          onChange={(e) => setReturnFilter((p) => ({ ...p, taxType: e.target.value }))}
                        >
                          <option value="TDS">TDS</option>
                          <option value="TCS">TCS (historical)</option>
                        </select>
                        <input
                          className="st-input"
                          style={{ width: 120 }}
                          value={returnFilter.financialYear}
                          onChange={(e) => setReturnFilter((p) => ({ ...p, financialYear: e.target.value }))}
                          placeholder="2026-2027"
                        />
                        <select
                          className="st-input"
                          style={{ width: 80 }}
                          value={returnFilter.quarter}
                          onChange={(e) => setReturnFilter((p) => ({ ...p, quarter: e.target.value }))}
                        >
                          <option value="Q1">Q1</option>
                          <option value="Q2">Q2</option>
                          <option value="Q3">Q3</option>
                          <option value="Q4">Q4</option>
                        </select>
                        <button className="st-btn st-btn-primary st-btn-sm" onClick={loadStatutoryReturn} disabled={returnLoading}>
                          {returnLoading ? "Loading…" : "Load"}
                        </button>
                      </div>
                    </Row>

                    {returnData && (
                      <>
                        <Row label="Filing Status">
                          <span className={`st-pill ${returnData.filingStatus === "FILED" ? "st-pill-live" : ""}`}>
                            {returnData.filingStatus}
                          </span>
                          {returnData.acknowledgementNumber && (
                            <span style={{ marginLeft: 8, fontSize: 12, color: "var(--afx-text-3, #888)" }}>
                              ACK: {returnData.acknowledgementNumber}
                            </span>
                          )}
                        </Row>
                        <Row label="Summary">
                          <span>
                            {returnData.partyCount} part{returnData.partyCount === 1 ? "y" : "ies"} · Taxable ₹
                            {Number(returnData.totalTaxableAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })} ·
                            Tax ₹{Number(returnData.totalTaxAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })} ·
                            Deposited ₹{Number(returnData.totalDeposited).toLocaleString("en-IN", { minimumFractionDigits: 2 })} ·
                            Pending ₹{Number(returnData.totalPending).toLocaleString("en-IN", { minimumFractionDigits: 2 })} ·
                            Interest ₹{Number(returnData.totalInterest || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </span>
                        </Row>

                        {returnData.rows.length > 0 && (
                          <div style={{ overflowX: "auto", margin: "8px 0" }}>
                            <table className="st-return-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                              <thead>
                                <tr>
                                  {["PAN", "Name", "Section", "Txns", "Taxable", "Tax", "Deposited", "Pending", "Interest"].map((h) => (
                                    <th key={h} style={{ textAlign: "left", padding: "4px 8px", borderBottom: "1px solid var(--afx-border, #333)" }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {returnData.rows.map((row, i) => (
                                  <tr key={i}>
                                    <td style={{ padding: "4px 8px" }}>{row.partyPan || "—"}</td>
                                    <td style={{ padding: "4px 8px" }}>{row.partyName}</td>
                                    <td style={{ padding: "4px 8px" }}>{row.sectionCode}</td>
                                    <td style={{ padding: "4px 8px" }}>{row.transactionCount}</td>
                                    <td style={{ padding: "4px 8px" }}>₹{Number(row.totalTaxableAmount).toFixed(2)}</td>
                                    <td style={{ padding: "4px 8px" }}>₹{Number(row.totalTaxAmount).toFixed(2)}</td>
                                    <td style={{ padding: "4px 8px" }}>₹{Number(row.depositedAmount).toFixed(2)}</td>
                                    <td style={{ padding: "4px 8px" }}>₹{Number(row.pendingAmount).toFixed(2)}</td>
                                    <td style={{ padding: "4px 8px" }}>₹{Number(row.interestAmount || 0).toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        <div className="st-stage-actions">
                          <button className="st-btn st-btn-ghost st-btn-sm" onClick={exportStatutoryReturn} disabled={returnExporting}>
                            {returnExporting ? "Exporting…" : "Export Excel"}
                          </button>
                          {returnData.filingStatus !== "FILED" && (
                            <button className="st-btn st-btn-primary st-btn-sm" onClick={markStatutoryReturnFiled} disabled={markingFiled}>
                              {markingFiled ? "Saving…" : "Mark as Filed"}
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="st-block">
                    <div className="st-block-kicker">Historical Turnover Backfill</div>
                    <Row label="Backfill" hint="party_turnover started empty when TCS/TDS launched — this adds a party's already-happened, never-taxed turnover for the current financial year so the threshold check accounts for it going forward. One-time per financial year; doesn't retroactively charge tax on what it backfills." first>
                      <button className="st-btn st-btn-ghost st-btn-sm" onClick={loadBackfillPreview} disabled={backfillLoading}>
                        {backfillLoading ? "Loading…" : "Preview Backfill"}
                      </button>
                    </Row>

                    {backfillResult && (
                      <>
                        {["tcs", "tds"].map((kind) => {
                          const result = backfillResult[kind];
                          if (!result) return null;
                          return (
                            <Row key={kind} label={kind.toUpperCase()}>
                              {result.alreadyCompleted ? (
                                <span className="st-pill st-pill-live">
                                  Backfilled on {result.completedAt ? new Date(result.completedAt).toLocaleDateString("en-IN") : "—"}
                                </span>
                              ) : (
                                <span>
                                  {result.rows.length} part{result.rows.length === 1 ? "y" : "ies"} · ₹
                                  {Number(result.totalConsideration).toLocaleString("en-IN", { minimumFractionDigits: 2 })} to add
                                </span>
                              )}
                            </Row>
                          );
                        })}

                        {["tcs", "tds"].map((kind) => {
                          const result = backfillResult[kind];
                          if (!result || result.alreadyCompleted || result.rows.length === 0) return null;
                          return (
                            <div key={kind} style={{ overflowX: "auto", margin: "8px 0" }}>
                              <table className="st-return-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                                <thead>
                                  <tr>
                                    <th style={{ textAlign: "left", padding: "4px 8px", borderBottom: "1px solid var(--afx-border, #333)" }}>{kind.toUpperCase()} Party</th>
                                    <th style={{ textAlign: "left", padding: "4px 8px", borderBottom: "1px solid var(--afx-border, #333)" }}>Historical Consideration</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {result.rows.map((row, i) => (
                                    <tr key={i}>
                                      <td style={{ padding: "4px 8px" }}>{row.partyName}</td>
                                      <td style={{ padding: "4px 8px" }}>₹{Number(row.historicalConsideration).toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          );
                        })}

                        {!backfillResult.tcs?.alreadyCompleted && !backfillResult.tds?.alreadyCompleted &&
                          ((backfillResult.tcs?.rows?.length || 0) + (backfillResult.tds?.rows?.length || 0) > 0) && (
                          <div className="st-stage-actions">
                            <button className="st-btn st-btn-primary st-btn-sm" onClick={applyBackfill} disabled={applyingBackfill}>
                              {applyingBackfill ? "Applying…" : "Apply Backfill"}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {tab === "security" && (
            <div className="st-stage" key="security-panel">
              <div className="st-block">
                <div className="st-block-kicker">Two-step verification</div>
                {mfaLoading ? (
                  <Row label="Loading…" first />
                ) : !myMfa?.globalEnabled ? (
                  <Row label="Not turned on" hint="Your administrator hasn't turned on two-step verification for this VMS instance yet." first />
                ) : (
                  <>
                    {(myMfa.availableMethods || []).map((method, i) => {
                      const mine = (myMfa.methods || []).find((m) => m.method === method);
                      const isActive = mine?.status === "ACTIVE";
                      const isPending = mine?.status === "PENDING";
                      return (
                        <Row
                          key={method}
                          label={method === "EMAIL" ? "Email" : method}
                          hint={isActive ? `Verified · ${mine.maskedTarget || ""}` : undefined}
                          first={i === 0}
                        >
                          {isActive ? (
                            <button
                              className="st-btn st-btn-ghost st-btn-sm"
                              onClick={() => handleDisableMfaMethod(method)}
                              disabled={mfaDisabling === method}
                            >
                              {mfaDisabling === method ? "Turning off…" : "Turn off"}
                            </button>
                          ) : (
                            <button
                              className="st-btn st-btn-primary st-btn-sm"
                              onClick={() => handleEnableMfaMethod(method)}
                              disabled={mfaEnabling || (mfaEnrollChallenge && mfaEnrollChallenge.method !== method)}
                            >
                              {mfaEnabling ? "Sending…" : isPending ? "Finish setup" : "Enable"}
                            </button>
                          )}
                        </Row>
                      );
                    })}

                    {mfaEnrollChallenge && (
                      <div className="st-block" style={{ marginTop: 12 }}>
                        <div className="st-block-kicker">
                          Confirm {mfaEnrollChallenge.method === "EMAIL" ? "your email" : mfaEnrollChallenge.method}
                        </div>
                        <Row label={`Code sent to ${mfaEnrollChallenge.maskedTarget || "you"}`} first>
                          <input
                            className="st-input"
                            inputMode="numeric"
                            maxLength={8}
                            placeholder="Enter code"
                            value={mfaEnrollCode}
                            onChange={(e) => setMfaEnrollCode(e.target.value.replace(/\D/g, ""))}
                          />
                        </Row>
                        <div className="st-stage-actions">
                          <button className="st-btn st-btn-ghost st-btn-sm" onClick={() => { setMfaEnrollChallenge(null); setMfaEnrollCode(""); }}>
                            Cancel
                          </button>
                          <button className="st-btn st-btn-ghost st-btn-sm" onClick={handleResendMfaEnrollCode}>
                            Resend code
                          </button>
                          <button
                            className="st-btn st-btn-primary st-btn-sm"
                            onClick={handleConfirmMfaCode}
                            disabled={mfaConfirming || mfaEnrollCode.trim().length < 4}
                          >
                            {mfaConfirming ? "Verifying…" : "Confirm"}
                          </button>
                        </div>
                      </div>
                    )}

                    {myMfa.trustedDeviceEnabled && (myMfa.trustedDevices || []).length > 0 && (
                      <>
                        <div className="st-block-kicker" style={{ marginTop: 16 }}>Trusted browsers</div>
                        {myMfa.trustedDevices.map((d, i) => (
                          <Row key={d.uKey} label={d.browserLabel || "Unknown browser"} hint={d.ipAddress || ""} first={i === 0}>
                            {d.current ? (
                              <span className="st-pill st-pill-live">This browser</span>
                            ) : (
                              <button
                                className="st-btn st-btn-ghost st-btn-sm"
                                onClick={() => handleRevokeTrustedDevice(d.uKey)}
                                disabled={revokingDeviceUKey === d.uKey}
                              >
                                {revokingDeviceUKey === d.uKey ? "Forgetting…" : "Forget"}
                              </button>
                            )}
                          </Row>
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>

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

          {tab === "mfaPolicy" && (
            <div className="st-stage" key="mfaPolicy-panel">
              <div className="st-block">
                <div className="st-block-kicker">Two-step verification policy</div>
                {mfaPolicyLoading || !mfaPolicy ? (
                  <Row label="Loading…" first />
                ) : (
                  <>
                    <Row label="Enable" hint="Turns two-step verification on or off for every user in this VMS instance." first>
                      <button
                        type="button"
                        className={`st-btn st-btn-sm ${mfaPolicy.enabled ? "st-btn-primary" : "st-btn-ghost"}`}
                        onClick={() => setMfaPolicy((p) => ({ ...p, enabled: !p.enabled }))}
                      >
                        {mfaPolicy.enabled ? "Enabled" : "Disabled"}
                      </button>
                    </Row>
                    <Row label="Email verification">
                      <button
                        type="button"
                        className={`st-btn st-btn-sm ${mfaPolicy.emailEnabled ? "st-btn-primary" : "st-btn-ghost"}`}
                        onClick={() => setMfaPolicy((p) => ({ ...p, emailEnabled: !p.emailEnabled }))}
                      >
                        {mfaPolicy.emailEnabled ? "Enabled" : "Disabled"}
                      </button>
                    </Row>
                    <Row label="SMS verification" hint="Not available yet.">
                      <button type="button" className="st-btn st-btn-ghost st-btn-sm" disabled>Coming soon</button>
                    </Row>
                    <Row label="Authenticator app" hint="Not available yet.">
                      <button type="button" className="st-btn st-btn-ghost st-btn-sm" disabled>Coming soon</button>
                    </Row>

                    {mfaPolicy.enabled && (
                      <>
                        <Row label="Code length">
                          <input
                            className="st-input" type="number" min="4" max="8"
                            value={mfaPolicy.otpLength}
                            onChange={(e) => setMfaPolicy((p) => ({ ...p, otpLength: e.target.value === "" ? "" : parseInt(e.target.value, 10) }))}
                          />
                        </Row>
                        <Row label="Code expiry (seconds)">
                          <input
                            className="st-input" type="number" min="60" max="900"
                            value={mfaPolicy.otpExpirySeconds}
                            onChange={(e) => setMfaPolicy((p) => ({ ...p, otpExpirySeconds: e.target.value === "" ? "" : parseInt(e.target.value, 10) }))}
                          />
                        </Row>
                        <Row label="Resend cooldown (seconds)">
                          <input
                            className="st-input" type="number" min="30" max="600"
                            value={mfaPolicy.resendCooldownSeconds}
                            onChange={(e) => setMfaPolicy((p) => ({ ...p, resendCooldownSeconds: e.target.value === "" ? "" : parseInt(e.target.value, 10) }))}
                          />
                        </Row>
                        <Row label="Max resend attempts">
                          <input
                            className="st-input" type="number" min="1" max="10"
                            value={mfaPolicy.maxResendAttempts}
                            onChange={(e) => setMfaPolicy((p) => ({ ...p, maxResendAttempts: e.target.value === "" ? "" : parseInt(e.target.value, 10) }))}
                          />
                        </Row>
                        <Row label="Resend block duration (minutes)" hint="How long resending stays blocked once the max resend attempts is hit.">
                          <input
                            className="st-input" type="number" min="1" max="1440"
                            value={mfaPolicy.resendBlockMinutes}
                            onChange={(e) => setMfaPolicy((p) => ({ ...p, resendBlockMinutes: e.target.value === "" ? "" : parseInt(e.target.value, 10) }))}
                          />
                        </Row>
                        <Row label="Max failed attempts" hint="Locks the code out after this many wrong tries.">
                          <input
                            className="st-input" type="number" min="3" max="10"
                            value={mfaPolicy.maxFailedAttempts}
                            onChange={(e) => setMfaPolicy((p) => ({ ...p, maxFailedAttempts: e.target.value === "" ? "" : parseInt(e.target.value, 10) }))}
                          />
                        </Row>
                        <Row label="Lockout duration (minutes)">
                          <input
                            className="st-input" type="number" min="5" max="1440"
                            value={mfaPolicy.lockoutMinutes}
                            onChange={(e) => setMfaPolicy((p) => ({ ...p, lockoutMinutes: e.target.value === "" ? "" : parseInt(e.target.value, 10) }))}
                          />
                        </Row>
                        <Row label="Remember this browser" hint="Lets a user skip verification on a browser they've already verified on.">
                          <button
                            type="button"
                            className={`st-btn st-btn-sm ${mfaPolicy.trustedDeviceEnabled ? "st-btn-primary" : "st-btn-ghost"}`}
                            onClick={() => setMfaPolicy((p) => ({ ...p, trustedDeviceEnabled: !p.trustedDeviceEnabled }))}
                          >
                            {mfaPolicy.trustedDeviceEnabled ? "Allowed" : "Not allowed"}
                          </button>
                        </Row>
                        {mfaPolicy.trustedDeviceEnabled && (
                          <Row label="Remembered for (days)" hint="0 asks for verification on every login.">
                            <input
                              className="st-input" type="number" min="0" max="90"
                              value={mfaPolicy.trustedDeviceDays}
                              onChange={(e) => setMfaPolicy((p) => ({ ...p, trustedDeviceDays: e.target.value === "" ? "" : parseInt(e.target.value, 10) }))}
                            />
                          </Row>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
              <div className="st-stage-actions">
                <button className="st-btn st-btn-primary st-btn-sm" onClick={saveMfaPolicy} disabled={savingMfaPolicy || !mfaPolicy}>
                  <Icon d={icons.save} size={13} /> {savingMfaPolicy ? "Saving…" : "Save MFA Policy"}
                </button>
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
