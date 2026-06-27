import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "../../Styles/Login/Login.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

/* ══════════════════════════════════════════════════════
   LEFT PANEL — Image + overlay + headline
══════════════════════════════════════════════════════ */
function VMSLeft() {
  return (
    <div className="vms-left">
      <div className="vms-left-img" />
      <div className="vms-left-overlay" />
      <div className="vms-left-vignette" />

      <div className="vms-left-top">
        <div className="vms-logo-mark">
          VMS<span className="vms-cursor" />
        </div>
        <div className="vms-logo-sub">Vendor Management System</div>
      </div>

      <div className="vms-left-bottom">
        <h1 className="vms-left-headline">
          Your Pharma Business,<br />Always In Control
        </h1>
        <p className="vms-left-sub">Ready to get back to work?</p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   RIGHT PANEL — Single-screen login form
══════════════════════════════════════════════════════ */
function VMSRight() {
  const navigate                = useNavigate();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const emailRef = useRef(null);

  useEffect(() => { emailRef.current?.focus(); }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim() || loading) return;
    setLoading(true);
    try {
      const res = await apiClient(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password: password.trim() }),
      });
      const data = await res.json();
      localStorage.setItem("vmsUser", JSON.stringify(data));
      if (data.status !== 200) { toast.error(data?.message || "Login failed"); return; }
      navigate("/home");
    } catch {
      toast.error("Server error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKey = e => { if (e.key === "Enter") handleLogin(); };

  return (
    <div className="vms-right">
      <div className="vms-right-inner">

        <div className="vms-form-heading">
          <span>WELCOME</span><br />BACK
        </div>
        <div className="vms-form-sub">
          Sign in to access your vendor management console.
        </div>

        <div className="vms-field">
          <label className="vms-field-label">Email Address</label>
          <input
            ref={emailRef}
            className="vms-input"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={handleKey}
            autoComplete="email"
          />
        </div>

        <div className="vms-field">
          <label className="vms-field-label">Password</label>
          <div className="vms-input-wrap">
            <input
              className="vms-input vms-input-pw"
              type={showPass ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={handleKey}
              autoComplete="current-password"
            />
            <button
              className="vms-eye"
              onClick={() => setShowPass(!showPass)}
              type="button"
              aria-label="Toggle password"
            >
              {showPass ? (
                <svg width="16" height="16" viewBox="0 -960 960 960" fill="currentColor">
                  <path d="M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-146 0-266-81.5T40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200Z" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 -960 960 960" fill="currentColor">
                  <path d="m644-428-58-58q9-47-27-88t-93-32l-58-58q17-8 34.5-12t36.5-4q75 0 127.5 52.5T660-500q0 19-4 36.5T644-428Zm128 126-58-56q38-29 67.5-63.5T832-500q-50-101-143.5-160.5T480-720q-29 0-57 4t-55 12l-62-62q41-17 84-25.5t90-8.5q151 0 269 83.5T920-500q-23 59-60.5 109.5T772-302Zm20 246L624-222q-35 11-70.5 16.5T480-200q-151 0-269-83.5T40-500q21-53 53-98.5t73-81.5L56-792l56-56 736 736-56 56Z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className="vms-forgot">
          <button className="vms-forgot-btn" onClick={() => navigate("/forgotpassword")}>
            Forgot password?
          </button>
        </div>

        <button
          className="vms-cta"
          disabled={!email.trim() || !password.trim() || loading}
          onClick={handleLogin}
        >
          {loading ? (
            <><span className="vms-spinner" /> SIGNING IN…</>
          ) : (
            <>
              SIGN IN
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </>
          )}
        </button>

        <div className="vms-foot">
          <span>support@vms.com</span>
          <span className="vms-foot-sep">·</span>
          <span>+91 98765 43210</span>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   ROOT EXPORT
══════════════════════════════════════════════════════ */
export default function LoginPage() {
  return (
    <div className="vms-login-page">
      <VMSLeft />
      <VMSRight />
    </div>
  );
}