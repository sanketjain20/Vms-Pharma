import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import AuthLayout from "./AuthLayout";
import OtpBoxes from "../CommonComponent/OtpBoxes";
import ResendTimer from "../CommonComponent/ResendTimer";
import "../../Styles/Login/Login.css";
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

// Keeps a browser's "remembered" MFA status across logins — sent back as
// X-Device-Token so MfaService.evaluateLogin can skip asking for a code
// again. localStorage (not a cookie) because apiClient authenticates with a
// Bearer token and never sends cookies, and this is deliberately per-browser
// (each browser profile has its own localStorage) — see AuthController/
// MfaService's Javadoc on why a different browser still gets asked.
const DEVICE_TOKEN_KEY = "vmsDeviceToken";

export default function LoginPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState("credentials"); // "credentials" | "otp"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const emailRef = useRef(null);

  /* MFA step state — populated from the 202 response of /api/auth/login. */
  const [mfaToken, setMfaToken] = useState(null);
  const [mfaMethods, setMfaMethods] = useState([]);
  const [trustedDeviceDays, setTrustedDeviceDays] = useState(0);
  const [otpCode, setOtpCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => { emailRef.current?.focus(); }, []);

  // Completes a login that produced a real token — the ONLY place vmsUser is
  // ever written. A 202 (MFA required) response must never reach here: its
  // data.token is null, so RequireAuth's isAuthenticated() (which decodes
  // the stored JWT's exp) would reject it anyway, but we don't even try.
  const finishLogin = (loginData) => {
    if (loginData?.deviceToken) {
      localStorage.setItem(DEVICE_TOKEN_KEY, loginData.deviceToken);
    }
    localStorage.setItem("vmsUser", JSON.stringify({ status: 200, data: loginData }));
    navigate(loginData?.fieldRep ? "/rep" : "/home");
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim() || loading) return;
    setLoading(true);
    try {
      const deviceToken = localStorage.getItem(DEVICE_TOKEN_KEY) || "";
      const res = await apiClient(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(deviceToken ? { "X-Device-Token": deviceToken } : {}),
        },
        body: JSON.stringify({ email: email.trim(), password: password.trim() }),
      });
      const data = await res.json();

      if (data.status === 202 && data.data?.mfaRequired) {
        setMfaToken(data.data.mfaToken);
        setMfaMethods(data.data.mfaMethods || []);
        setTrustedDeviceDays(data.data.trustedDeviceDays || 0);
        setOtpCode("");
        if (data.data.resendAvailableInSeconds) {
          setResendAvailableAt(Date.now() + data.data.resendAvailableInSeconds * 1000);
        }
        setStep("otp");
        return;
      }

      if (data.status !== 200) {
        toast.error(data?.message || "Login failed");
        setShake(true);
        setTimeout(() => setShake(false), 500);
        return;
      }

      finishLogin(data.data);
    } catch {
      toast.error("Server error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length < 4 || verifying) return;
    setVerifying(true);
    try {
      const res = await apiClient(`${API_BASE_URL}/api/auth/mfa/Verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfaToken, code: otpCode.trim(), rememberDevice }),
      });
      const data = await res.json();
      if (data.status !== 200) {
        toast.error(data?.message || "Incorrect code");
        return;
      }
      finishLogin(data.data);
    } catch {
      toast.error("Server error. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    try {
      const res = await apiClient(`${API_BASE_URL}/api/auth/mfa/Send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfaToken }),
      });
      const data = await res.json();
      if (data.status !== 200) {
        toast.error(data?.message || "Failed to resend code");
        return;
      }
      toast.success("Verification code resent");
      if (data.data?.resendAvailableInSeconds) {
        setResendAvailableAt(Date.now() + data.data.resendAvailableInSeconds * 1000);
      }
    } catch {
      toast.error("Server error. Please try again.");
    }
  };

  const backToCredentials = () => {
    setStep("credentials");
    setMfaToken(null);
    setOtpCode("");
  };

  const handleKey = (e) => { if (e.key === "Enter") handleLogin(); };
  const handleOtpKey = (e) => { if (e.key === "Enter") handleVerifyOtp(); };

  if (step === "otp") {
    const method = mfaMethods[0]?.method;
    const maskedTarget = mfaMethods[0]?.maskedTarget;

    return (
      <AuthLayout
        eyebrow="Secure sign in"
        title="Verify it's you"
        subtitle={
          maskedTarget
            ? `Enter the code we sent to ${maskedTarget}.`
            : "Enter the verification code we just sent you."
        }
        formKey="otp"
        footer={<button className="auth-link" onClick={backToCredentials}>← Back to sign in</button>}
      >
        {method === "EMAIL" && (
          <div className="auth-email-pill">
            <svg width="12" height="12" viewBox="0 -960 960 960" fill="currentColor"><path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm320-280L160-640v400h640v-400L480-440Zm0-80 320-200H160l320 200Z" /></svg>
            <span>Code sent to <strong>{maskedTarget}</strong></span>
          </div>
        )}

        <div className="auth-field" onKeyDown={handleOtpKey}>
          <label className="auth-label">Verification code</label>
          <OtpBoxes value={otpCode} onChange={setOtpCode} />
        </div>

        {trustedDeviceDays > 0 && (
          <label className="auth-form-line" style={{ cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(e) => setRememberDevice(e.target.checked)}
              style={{ marginRight: 8 }}
            />
            Don&apos;t ask again on this browser for {trustedDeviceDays} days
          </label>
        )}

        <button
          className="auth-btn auth-btn-primary"
          disabled={otpCode.length < 4 || verifying}
          onClick={handleVerifyOtp}
        >
          {verifying ? (<><span className="auth-spinner" /> Verifying…</>) : "Verify and sign in"}
        </button>

        <ResendTimer availableAt={resendAvailableAt} onResend={handleResendOtp} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      eyebrow="Secure sign in"
      title="Welcome back"
      subtitle="Sign in to access your vendor management console."
      formKey="credentials"
      footer={
        <>
          <span>support@vms.com</span>
          <span className="auth-dot" />
          <span>+91 98765 43210</span>
        </>
      }
    >
      <div className={shake ? "auth-shake" : ""}>
        <div className="auth-field">
          <label className="auth-label" htmlFor="login-email">Email address</label>
          <input
            id="login-email"
            ref={emailRef}
            className="auth-input"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleKey}
            autoComplete="email"
          />
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="login-password">Password</label>
          <div className="auth-pw-field">
            <input
              id="login-password"
              className="auth-input"
              type={showPass ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKey}
              autoComplete="current-password"
            />
            <button className="auth-eye" type="button" onClick={() => setShowPass((s) => !s)} aria-label="Toggle password visibility">
              {showPass ? <EyeOpen /> : <EyeClosed />}
            </button>
          </div>
        </div>

        <div className="auth-form-line">
          <button className="auth-link" onClick={() => navigate("/forgotpassword")}>Forgot password?</button>
        </div>

        <button className="auth-btn auth-btn-primary" disabled={!email.trim() || !password.trim() || loading} onClick={handleLogin}>
          {loading ? (
            <><span className="auth-spinner" /> Signing in…</>
          ) : (
            <>
              Sign in
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </>
          )}
        </button>
      </div>
    </AuthLayout>
  );
}
