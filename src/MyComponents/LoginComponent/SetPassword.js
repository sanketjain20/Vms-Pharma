import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import AuthLayout from "./AuthLayout";
import "../../Styles/Login/ForgotPassword.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

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

export default function SetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [status, setStatus] = useState("loading"); // loading | valid | invalid
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const passRef = useRef(null);

  useEffect(() => {
    if (!token) { setStatus("invalid"); return; }

    let cancelled = false;
    apiClient(`${API_BASE_URL}/api/auth/ValidateSetupToken?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && data.status === 200) {
          setEmail(data.data || "");
          setStatus("valid");
        } else {
          setStatus("invalid");
        }
      })
      .catch(() => { if (!cancelled) setStatus("invalid"); });

    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    if (status === "valid") passRef.current?.focus();
  }, [status]);

  const submit = async () => {
    if (!password || !confirmPassword) { toast.error("Please fill all fields"); return; }
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (password !== confirmPassword) { toast.error("Passwords do not match"); return; }

    setLoading(true);
    try {
      const res = await apiClient(`${API_BASE_URL}/api/auth/SetPassword`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (data.status !== 200) { toast.error(data.message || "Failed to set password"); return; }
      toast.success("Password set successfully! You can now log in.");
      setTimeout(() => navigate("/"), 1500);
    } catch { toast.error("Server error. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <AuthLayout
      eyebrow="Account setup"
      title="Set your password"
      subtitle={status === "valid"
        ? "Choose a password for your new VMS account."
        : "Verifying your invite link…"}
      footer={
        <button className="auth-link" onClick={() => navigate("/")}>← Back to sign in</button>
      }
    >
      {status === "loading" && (
        <div className="auth-field">
          <span className="auth-spinner" />
        </div>
      )}

      {status === "invalid" && (
        <div className="auth-email-pill">
          <span>This link is invalid or has expired. Please contact your admin for a new invite.</span>
        </div>
      )}

      {status === "valid" && (
        <>
          <div className="auth-email-pill">
            <svg width="12" height="12" viewBox="0 -960 960 960" fill="currentColor"><path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm320-280L160-640v400h640v-400L480-440Zm0-80 320-200H160l320 200Z" /></svg>
            <span>Setting up account for <strong>{email}</strong></span>
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="sp-pw">New password</label>
            <div className="auth-pw-field">
              <input
                id="sp-pw"
                ref={passRef}
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
            <label className="auth-label" htmlFor="sp-confirm">Confirm password</label>
            <div className="auth-pw-field">
              <input
                id="sp-confirm"
                className="auth-input"
                type={showConfirm ? "text" : "password"}
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
              <button className="auth-eye" type="button" onClick={() => setShowConfirm((s) => !s)} aria-label="Toggle password visibility">
                {showConfirm ? <EyeOpen /> : <EyeClosed />}
              </button>
            </div>
          </div>
          <button className="auth-btn auth-btn-primary" disabled={!password || !confirmPassword || loading} onClick={submit}>
            {loading ? (<><span className="auth-spinner" /> Setting password…</>) : "Set password"}
          </button>
        </>
      )}
    </AuthLayout>
  );
}
