import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../../Styles/Login/ForgotPassword.css";

/* ── Step indicator ───────────────────────────────────────── */
const STEPS = ["email", "code", "password"];
const STEP_LABELS = ["Email", "Verify", "Reset"];

function StepDots({ current }) {
  return (
    <div className="fp-steps">
      {STEPS.map((s, i) => (
        <React.Fragment key={s}>
          <div className={`fp-step-dot ${current === s ? "active" : STEPS.indexOf(current) > i ? "done" : ""}`}>
            {STEPS.indexOf(current) > i
              ? <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              : <span>{i + 1}</span>
            }
          </div>
          {i < STEPS.length - 1 && (
            <div className={`fp-step-line ${STEPS.indexOf(current) > i ? "done" : ""}`} />
          )}
        </React.Fragment>
      ))}
      <div className="fp-step-labels">
        {STEP_LABELS.map((l, i) => (
          <span key={l} className={`fp-step-label ${current === STEPS[i] ? "active" : ""}`}>{l}</span>
        ))}
      </div>
    </div>
  );
}

/* ── OTP boxes ────────────────────────────────────────────── */
function OtpBoxes({ value, onChange }) {
  const refs = useRef([]);
  const digits = value.padEnd(6, "").split("").slice(0, 6);

  const handleKey = (e, i) => {
    if (e.key === "Backspace") {
      const next = value.slice(0, i > 0 && !value[i] ? i - 1 : i);
      onChange(next);
      if (i > 0 && !value[i]) refs.current[i - 1]?.focus();
    }
  };

  const handleChange = (e, i) => {
    const ch = e.target.value.replace(/\D/g, "").slice(-1);
    if (!ch) return;
    const arr = value.padEnd(6, "").split("");
    arr[i] = ch;
    const next = arr.join("").replace(/\s/g, "").slice(0, 6);
    onChange(next);
    if (i < 5) refs.current[i + 1]?.focus();
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) { onChange(pasted); refs.current[Math.min(pasted.length, 5)]?.focus(); }
    e.preventDefault();
  };

  return (
    <div className="fp-otp-row">
      {[0,1,2,3,4,5].map(i => (
        <input
          key={i}
          ref={el => refs.current[i] = el}
          className={`fp-otp-box ${digits[i] && digits[i] !== " " ? "filled" : ""}`}
          type="text" inputMode="numeric"
          maxLength={1}
          value={digits[i] !== " " ? digits[i] : ""}
          onChange={e => handleChange(e, i)}
          onKeyDown={e => handleKey(e, i)}
          onPaste={handlePaste}
        />
      ))}
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────── */
export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep]                     = useState("email");
  const [email, setEmail]                   = useState("");
  const [code, setCode]                     = useState("");
  const [password, setPassword]             = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass]             = useState(false);
  const [showConfirm, setShowConfirm]       = useState(false);
  const [loading, setLoading]               = useState(false);
  const emailRef = useRef(null);

  useEffect(() => { emailRef.current?.focus(); }, []);

  const sendCode = async () => {
    if (!email.trim()) { toast.error("Please enter your email"); return; }
    setLoading(true);
    try {
      const res  = await fetch("http://localhost:8080/api/auth/SendVerificationCode", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (data.status !== 200) { toast.error(data.message || "Failed to send code"); return; }
      toast.success("Verification code sent to your email");
      setStep("code");
    } catch { toast.error("Server error. Please try again."); }
    finally { setLoading(false); }
  };

  const verifyCode = async () => {
    if (code.length !== 6) { toast.error("Enter the 6-digit code"); return; }
    setLoading(true);
    try {
      const res  = await fetch("http://localhost:8080/api/auth/VerifyCode", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), otp: code.trim() }),
      });
      const data = await res.json();
      if (data.status !== 200) { toast.error(data.message || "Invalid code"); return; }
      toast.success("Code verified");
      setStep("password");
    } catch { toast.error("Server error. Please try again."); }
    finally { setLoading(false); }
  };

  const resetPassword = async () => {
    if (!password || !confirmPassword) { toast.error("Please fill all fields"); return; }
    if (password !== confirmPassword)  { toast.error("Passwords do not match"); return; }
    setLoading(true);
    try {
      const res  = await fetch("http://localhost:8080/api/auth/ResetPassword", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (data.status !== 200) { toast.error(data.message || "Failed to reset password"); return; }
      toast.success("Password reset successfully!");
      setTimeout(() => navigate("/"), 1500);
    } catch { toast.error("Server error. Please try again."); }
    finally { setLoading(false); }
  };

  /* eye toggle SVG */
  const EyeOpen  = () => <svg width="16" height="16" viewBox="0 -960 960 960" fill="currentColor"><path d="M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-146 0-266-81.5T40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200Z"/></svg>;
  const EyeClose = () => <svg width="16" height="16" viewBox="0 -960 960 960" fill="currentColor"><path d="m644-428-58-58q9-47-27-88t-93-32l-58-58q17-8 34.5-12t36.5-4q75 0 127.5 52.5T660-500q0 19-4 36.5T644-428Zm128 126-58-56q38-29 67.5-63.5T832-500q-50-101-143.5-160.5T480-720q-29 0-57 4t-55 12l-62-62q41-17 84-25.5t90-8.5q151 0 269 83.5T920-500q-23 59-60.5 109.5T772-302Zm20 246L624-222q-35 11-70.5 16.5T480-200q-151 0-269-83.5T40-500q21-53 53-98.5t73-81.5L56-792l56-56 736 736-56 56Z"/></svg>;

  return (
    <div className="fp-page">
      <ToastContainer position="top-right" autoClose={3000} theme="dark" />

      {/* Background grid */}
      <div className="fp-grid" />
      {/* Orbs */}
      <div className="fp-orb fp-orb-a" />
      <div className="fp-orb fp-orb-b" />

      <div className="fp-card">
        {/* Corner accents */}
        <div className="fp-corner fp-tl" /><div className="fp-corner fp-tr" />
        <div className="fp-corner fp-bl" /><div className="fp-corner fp-br" />

        {/* Header */}
        <div className="fp-header">
          <div className="fp-eyebrow">
            <span className="fp-dot" />
            Password Recovery
          </div>
          <h1 className="fp-title">
            {step === "email"    && <><span className="fp-dim">Forgot</span> Password</>}
            {step === "code"     && <><span className="fp-dim">Verify</span> Code</>}
            {step === "password" && <><span className="fp-dim">Reset</span> Password</>}
          </h1>
        </div>

        {/* Step indicator */}
        <StepDots current={step} />

        {/* ── STEP: EMAIL ────────────────────────────────── */}
        {step === "email" && (
          <div className="fp-body">
            <p className="fp-hint">Enter the email address linked to your account.</p>
            <div className="fp-field">
              <label className="fp-label">Email Address</label>
              <input
                ref={emailRef}
                className="fp-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendCode()}
              />
            </div>
            <button
              className={`fp-btn ${email.trim() && !loading ? "" : "fp-btn-off"}`}
              disabled={!email.trim() || loading}
              onClick={sendCode}
            >
              {loading ? <><span className="fp-spin" />Sending…</> : <>Send Verification Code <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></>}
            </button>
          </div>
        )}

        {/* ── STEP: OTP ──────────────────────────────────── */}
        {step === "code" && (
          <div className="fp-body">
            <div className="fp-email-pill">
              <svg width="12" height="12" viewBox="0 -960 960 960" fill="currentColor"><path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm320-280L160-640v400h640v-400L480-440Zm0-80 320-200H160l320 200ZM160-640v-80 480-400Z"/></svg>
              Code sent to <strong>{email}</strong>
            </div>
            <div className="fp-field">
              <label className="fp-label">6-Digit Code</label>
              <OtpBoxes value={code} onChange={setCode} />
            </div>
            <button
              className={`fp-btn ${code.length === 6 && !loading ? "" : "fp-btn-off"}`}
              disabled={code.length !== 6 || loading}
              onClick={verifyCode}
            >
              {loading ? <><span className="fp-spin" />Verifying…</> : <>Verify Code</>}
            </button>
            <button className="fp-resend" onClick={sendCode} disabled={loading}>
              Didn't receive? <span>Resend Code</span>
            </button>
          </div>
        )}

        {/* ── STEP: NEW PASSWORD ─────────────────────────── */}
        {step === "password" && (
          <div className="fp-body">
            <p className="fp-hint">Choose a strong new password for your account.</p>
            {[
              { label: "New Password",     val: password,         set: setPassword,         show: showPass,    toggle: () => setShowPass(!showPass) },
              { label: "Confirm Password", val: confirmPassword,  set: setConfirmPassword,  show: showConfirm, toggle: () => setShowConfirm(!showConfirm) },
            ].map(({ label, val, set, show, toggle }) => (
              <div className="fp-field" key={label}>
                <label className="fp-label">{label}</label>
                <div className="fp-pw-wrap">
                  <input
                    className="fp-input"
                    type={show ? "text" : "password"}
                    placeholder={label}
                    value={val}
                    onChange={e => set(e.target.value)}
                  />
                  <button className="fp-eye" onClick={toggle} type="button">
                    {show ? <EyeOpen /> : <EyeClose />}
                  </button>
                </div>
              </div>
            ))}
            <button
              className={`fp-btn ${password && confirmPassword && !loading ? "" : "fp-btn-off"}`}
              disabled={!password || !confirmPassword || loading}
              onClick={resetPassword}
            >
              {loading ? <><span className="fp-spin" />Updating…</> : <>Reset Password</>}
            </button>
          </div>
        )}

        {/* Back to login */}
        <div className="fp-footer">
          <button className="fp-back" onClick={() => navigate("/")}>
            ← Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}
