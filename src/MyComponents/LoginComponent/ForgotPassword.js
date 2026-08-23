import React, { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import AuthLayout from "./AuthLayout";
import "../../Styles/Login/ForgotPassword.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

const STEPS = ["email", "code", "password"];
const STEP_META = [
  { title: "Forgot password", subtitle: "Enter the email address linked to your account and we'll send you a verification code." },
  { title: "Verify code", subtitle: "Enter the 6-digit code we just sent to your email." },
  { title: "Reset password", subtitle: "Choose a strong new password for your account." },
];

function StepDots({ current }) {
  const idx = STEPS.indexOf(current);
  return (
    <div className="auth-steps">
      {STEPS.map((s, i) => (
        <React.Fragment key={s}>
          <span className={`auth-step-dot${current === s ? " is-active" : idx > i ? " is-done" : ""}`}>
            {idx > i
              ? <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              : i + 1}
          </span>
          {i < STEPS.length - 1 && <span className={`auth-step-line${idx > i ? " is-done" : ""}`} />}
        </React.Fragment>
      ))}
    </div>
  );
}

function OtpBoxes({ value, onChange }) {
  const refs = useRef([]);
  const digits = value.padEnd(6, " ").split("").slice(0, 6);

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
    const arr = value.padEnd(6, " ").split("");
    arr[i] = ch;
    onChange(arr.join("").replace(/\s/g, "").slice(0, 6));
    if (i < 5) refs.current[i + 1]?.focus();
  };
  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) { onChange(pasted); refs.current[Math.min(pasted.length, 5)]?.focus(); }
    e.preventDefault();
  };

  return (
    <div className="auth-otp-line">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          className={`auth-otp-cell${digits[i] && digits[i] !== " " ? " is-filled" : ""}`}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i] !== " " ? digits[i] : ""}
          onChange={(e) => handleChange(e, i)}
          onKeyDown={(e) => handleKey(e, i)}
          onPaste={handlePaste}
        />
      ))}
    </div>
  );
}

const EyeOpen = () => (
  <svg width="16" height="16" viewBox="0 -960 960 960" fill="currentColor">
    <path d="M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-146 0-266-81.5T40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200Z" />
  </svg>
);
const EyeClosed = () => (
  <svg width="16" height="16" viewBox="0 -960 960 960" fill="currentColor">
    <path d="m644-428-58-58q9-47-27-88t-93-32l-58-58q17-8 34.5-12t36.5-4q75 0 127.5 52.5T660-500q0 19-4 36.5T644-428Zm128 126-58-56q38-29 67.5-63.5T832-500q-50-101-143.5-160.5T480-720q-29 0-57 4t-55 12l-62-62q41-17 84-25.5t90-8.5q151 0 269 83.5T920-500q-23 59-60.5 109.5T772-302Zm20 246L624-222q-35 11-70.5 16.5T480-200q-151 0-269-83.5T40-500q21-53 53-98.5t73-81.5L56-792l56-56 736 736-56 56Z" />
  </svg>
);

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const emailRef = useRef(null);

  useEffect(() => { emailRef.current?.focus(); }, []);

  const sendCode = async () => {
    if (!email.trim()) { toast.error("Please enter your email"); return; }
    setLoading(true);
    try {
      const res = await apiClient(`${API_BASE_URL}/api/auth/SendVerificationCode`, {
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
      const res = await apiClient(`${API_BASE_URL}/api/auth/VerifyCode`, {
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
    if (password !== confirmPassword) { toast.error("Passwords do not match"); return; }
    setLoading(true);
    try {
      const res = await apiClient(`${API_BASE_URL}/api/auth/ResetPassword`, {
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

  const meta = STEP_META[STEPS.indexOf(step)];

  return (
    <AuthLayout
      eyebrow="Account recovery"
      title={meta.title}
      subtitle={meta.subtitle}
      formKey={step}
      footer={
        <button className="auth-link" onClick={() => navigate("/")}>← Back to sign in</button>
      }
    >
      <StepDots current={step} />

      {step === "email" && (
        <>
          <div className="auth-field">
            <label className="auth-label" htmlFor="fp-email">Email address</label>
            <input
              id="fp-email"
              ref={emailRef}
              className="auth-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendCode()}
              autoComplete="email"
            />
          </div>
          <button className="auth-btn auth-btn-primary" disabled={!email.trim() || loading} onClick={sendCode}>
            {loading ? (<><span className="auth-spinner" /> Sending…</>) : (
              <>Send verification code
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </>
            )}
          </button>
        </>
      )}

      {step === "code" && (
        <>
          <div className="auth-email-pill">
            <svg width="12" height="12" viewBox="0 -960 960 960" fill="currentColor"><path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm320-280L160-640v400h640v-400L480-440Zm0-80 320-200H160l320 200Z" /></svg>
            <span>Code sent to <strong>{email}</strong></span>
          </div>
          <div className="auth-field">
            <label className="auth-label">6-digit code</label>
            <OtpBoxes value={code} onChange={setCode} />
          </div>
          <button className="auth-btn auth-btn-primary" disabled={code.length !== 6 || loading} onClick={verifyCode}>
            {loading ? (<><span className="auth-spinner" /> Verifying…</>) : "Verify code"}
          </button>
          <button className="auth-link auth-resend" disabled={loading} onClick={sendCode}>
            Didn't receive it? Resend code
          </button>
        </>
      )}

      {step === "password" && (
        <>
          <div className="auth-field">
            <label className="auth-label" htmlFor="fp-pw">New password</label>
            <div className="auth-pw-field">
              <input
                id="fp-pw"
                className="auth-input"
                type={showPass ? "text" : "password"}
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button className="auth-eye" type="button" onClick={() => setShowPass((s) => !s)} aria-label="Toggle password visibility">
                {showPass ? <EyeOpen /> : <EyeClosed />}
              </button>
            </div>
          </div>
          <div className="auth-field">
            <label className="auth-label" htmlFor="fp-confirm">Confirm password</label>
            <div className="auth-pw-field">
              <input
                id="fp-confirm"
                className="auth-input"
                type={showConfirm ? "text" : "password"}
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button className="auth-eye" type="button" onClick={() => setShowConfirm((s) => !s)} aria-label="Toggle password visibility">
                {showConfirm ? <EyeOpen /> : <EyeClosed />}
              </button>
            </div>
          </div>
          <button className="auth-btn auth-btn-primary" disabled={!password || !confirmPassword || loading} onClick={resetPassword}>
            {loading ? (<><span className="auth-spinner" /> Updating…</>) : "Reset password"}
          </button>
        </>
      )}
    </AuthLayout>
  );
}
