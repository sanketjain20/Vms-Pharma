import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../../Styles/Login/Login.css";

/* ── Canvas background (same engine as VendorOnboarding) ─── */
function LoginCanvas() {
  const cvRef = useRef(null);
  useEffect(() => {
    const cv = cvRef.current;
    const ctx = cv.getContext("2d");
    let W, H, raf, t = 0;
    const stars = Array.from({ length: 160 }, () => ({
      x: Math.random() * 2000, y: Math.random() * 2000,
      r: Math.random() * 1.2 + 0.2,
      a: Math.random() * 0.7 + 0.2,
      tw: Math.random() * 3 + 1, tp: Math.random() * Math.PI * 2,
    }));
    let shooters = [];
    const addS = () => shooters.push({
      x: Math.random() * (W || 800) * 0.7, y: Math.random() * (H || 600) * 0.4,
      vx: Math.random() * 8 + 3, vy: Math.random() * 3 + 1.5,
      len: Math.random() * 120 + 50, a: 1,
      hue: Math.random() * 60 + 180,
    });
    const si = setInterval(addS, 2400);
    const resize = () => { W = cv.width = window.innerWidth; H = cv.height = window.innerHeight; };
    resize(); window.addEventListener("resize", resize);
    const drawGrid = () => {
      ctx.strokeStyle = "rgba(0,200,255,0.022)"; ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
      for (let y = 0; y < H; y += 80) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
    };
    const loop = () => {
      ctx.clearRect(0,0,W,H); t += 0.007;
      const bg = ctx.createRadialGradient(W*.3,H*.2,0,W*.5,H*.5,Math.max(W,H));
      bg.addColorStop(0,"rgba(0,8,24,1)"); bg.addColorStop(.6,"rgba(1,4,14,1)"); bg.addColorStop(1,"rgba(0,0,4,1)");
      ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);
      drawGrid();
      for (const p of stars) {
        const tw = .5 + .5 * Math.sin(t * p.tw + p.tp);
        ctx.beginPath(); ctx.arc(p.x%W, p.y%H, p.r, 0, Math.PI*2);
        ctx.fillStyle = `rgba(200,220,255,${p.a*tw})`; ctx.fill();
      }
      const n1 = ctx.createRadialGradient(W*.15,H*.3,0,W*.15,H*.3,W*.4);
      n1.addColorStop(0,"rgba(0,80,180,0.05)"); n1.addColorStop(1,"transparent");
      ctx.fillStyle=n1; ctx.fillRect(0,0,W,H);
      const n2 = ctx.createRadialGradient(W*.85,H*.7,0,W*.85,H*.7,W*.3);
      n2.addColorStop(0,"rgba(100,0,180,0.04)"); n2.addColorStop(1,"transparent");
      ctx.fillStyle=n2; ctx.fillRect(0,0,W,H);
      shooters = shooters.filter(s=>s.a>.01);
      for (const s of shooters) {
        const g = ctx.createLinearGradient(s.x,s.y,s.x-s.vx*(s.len/10),s.y-s.vy*(s.len/10));
        g.addColorStop(0,`hsla(${s.hue},100%,80%,${s.a})`); g.addColorStop(1,"transparent");
        ctx.save(); ctx.strokeStyle=g; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(s.x,s.y); ctx.lineTo(s.x-s.vx*(s.len/10),s.y-s.vy*(s.len/10));
        ctx.stroke(); ctx.restore();
        s.x+=s.vx; s.y+=s.vy; s.a-=.018;
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => { cancelAnimationFrame(raf); clearInterval(si); window.removeEventListener("resize",resize); };
  }, []);
  return <canvas ref={cvRef} className="login-canvas" />;
}

/* ── LoginSection ────────────────────────────────────────── */
function LoginSection() {
  const navigate = useNavigate();
  const [step, setStep]               = useState("email");
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [loading, setLoading]         = useState(false);
  const [showPass, setShowPass]       = useState(false);
  const emailRef = useRef(null);
  const passRef  = useRef(null);

  useEffect(() => { if (step === "email") emailRef.current?.focus(); }, [step]);
  useEffect(() => { if (step === "password") passRef.current?.focus(); }, [step]);
  useEffect(() => {
    const handler = () => setStep("email");
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  const handleNext = () => {
    if (!email.trim()) return;
    setStep("password");
    window.history.pushState({}, "");
  };

  const handleKeyEmail = (e) => { if (e.key === "Enter") handleNext(); };
  const handleKeyPass  = (e) => { if (e.key === "Enter") handleLogin(); };

  const handleLogin = async () => {
    if (!password.trim() || loading) return;
    setLoading(true);
    try {
      const res  = await fetch("http://localhost:8080/api/auth/login", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password: password.trim() }),
      });
      const data = await res.json();
      if (data.status !== 200) { toast.error(data?.message || "Login failed"); return; }
      localStorage.setItem("vmsUser", JSON.stringify(data));
      navigate("/home");
    } catch { toast.error("Server error. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <div className="ls-wrap">
      <div className="ls-eyebrow">
        <span className="ls-dot" />
        <span>Vendor Management System</span>
      </div>

      <h1 className="ls-title">
        {step === "email" ? (
          <><span className="ls-title-dim">Welcome</span> Back</>
        ) : (
          <><span className="ls-title-dim">Enter</span> Password</>
        )}
      </h1>

      {step === "email" ? (
        <div className="ls-step" key="email">
          <p className="ls-hint">Sign in to your account to continue</p>
          <div className="ls-field">
            <label className="ls-label">Email Address</label>
            <input
              ref={emailRef}
              className="ls-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={handleKeyEmail}
            />
          </div>
          <button
            className={`ls-btn ${email.trim() ? "" : "ls-btn-disabled"}`}
            disabled={!email.trim()}
            onClick={handleNext}
          >
            Continue
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      ) : (
        <div className="ls-step" key="password">
          <div className="ls-email-pill">
            <svg width="12" height="12" viewBox="0 -960 960 960" fill="currentColor"><path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm320-280L160-640v400h640v-400L480-440Zm0-80 320-200H160l320 200ZM160-640v-80 480-400Z"/></svg>
            {email}
            <button className="ls-change-email" onClick={() => setStep("email")}>Change</button>
          </div>

          <div className="ls-field">
            <label className="ls-label">Password</label>
            <div className="ls-pw-wrap">
              <input
                ref={passRef}
                className="ls-input"
                type={showPass ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={handleKeyPass}
              />
              <button className="ls-eye" onClick={() => setShowPass(!showPass)} type="button">
                {showPass
                  ? <svg width="16" height="16" viewBox="0 -960 960 960" fill="currentColor"><path d="M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-146 0-266-81.5T40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200Z"/></svg>
                  : <svg width="16" height="16" viewBox="0 -960 960 960" fill="currentColor"><path d="m644-428-58-58q9-47-27-88t-93-32l-58-58q17-8 34.5-12t36.5-4q75 0 127.5 52.5T660-500q0 19-4 36.5T644-428Zm128 126-58-56q38-29 67.5-63.5T832-500q-50-101-143.5-160.5T480-720q-29 0-57 4t-55 12l-62-62q41-17 84-25.5t90-8.5q151 0 269 83.5T920-500q-23 59-60.5 109.5T772-302Zm20 246L624-222q-35 11-70.5 16.5T480-200q-151 0-269-83.5T40-500q21-53 53-98.5t73-81.5L56-792l56-56 736 736-56 56ZM222-624q-29 26-53 57t-41 67q50 101 143.5 160.5T480-280q20 0 39-2.5t39-5.5l-36-38q-11 3-21 4.5t-21 1.5q-75 0-127.5-52.5T300-500q0-11 1.5-21t4.5-21l-84-82Z"/></svg>
                }
              </button>
            </div>
          </div>

          <div className="ls-forgot">
            <button className="ls-forgot-btn" onClick={() => navigate("/forgotpassword")}>
              Forgot password?
            </button>
          </div>

          <button
            className={`ls-btn ${password.trim() && !loading ? "" : "ls-btn-disabled"}`}
            disabled={!password.trim() || loading}
            onClick={handleLogin}
          >
            {loading ? <><span className="ls-spinner" />Signing in…</> : <>Sign In<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></>}
          </button>

          <button className="ls-back-btn" onClick={() => setStep("email")}>
            ← Back
          </button>
        </div>
      )}

      <div className="ls-support">
        <span>support@vms.com</span>
        <span className="ls-support-sep">·</span>
        <span>+91 98765 43210</span>
      </div>
    </div>
  );
}

export default LoginSection;
