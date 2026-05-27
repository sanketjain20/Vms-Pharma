import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "../../Styles/Login/Login.css";

/* ══════════════════════════════════════════════════════
   CANVAS — Amber grid + drift particles + data-lines
══════════════════════════════════════════════════════ */
function VMSCanvas() {
  const cvRef = useRef(null);

  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    let W, H, raf, t = 0;

    /* Floating particles */
    const pts = Array.from({ length: 60 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.2 + 0.3,
      vx: (Math.random() - 0.5) * 0.0003,
      vy: (Math.random() - 0.5) * 0.0003,
      a: Math.random() * 0.55 + 0.1,
    }));

    /* Horizontal data-streams */
    const streams = Array.from({ length: 8 }, () => ({
      y: Math.random(),
      speed: 0.0006 + Math.random() * 0.001,
      len: 0.08 + Math.random() * 0.14,
      x: Math.random(),
      a: Math.random() * 0.4 + 0.1,
    }));

    const resize = () => {
      W = cv.width  = window.innerWidth;
      H = cv.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const loop = () => {
      ctx.clearRect(0, 0, W, H);
      t += 0.008;

      /* BG */
      ctx.fillStyle = "#080a0f";
      ctx.fillRect(0, 0, W, H);

      /* Fine grid */
      ctx.strokeStyle = "rgba(245,166,35,0.028)";
      ctx.lineWidth = 1;
      const gs = 56;
      for (let x = 0; x < W; x += gs) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += gs) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      /* Grid intersections glow dots */
      for (let x = 0; x < W; x += gs) {
        for (let y = 0; y < H; y += gs) {
          const d = Math.sin(t + x * 0.01 + y * 0.01) * 0.5 + 0.5;
          if (d > 0.85) {
            ctx.beginPath();
            ctx.arc(x, y, 1, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(245,166,35,${d * 0.22})`;
            ctx.fill();
          }
        }
      }

      /* Particles */
      for (const p of pts) {
        p.x = ((p.x + p.vx) + 1) % 1;
        p.y = ((p.y + p.vy) + 1) % 1;
        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(245,166,35,${p.a * (0.5 + 0.5 * Math.sin(t + p.x * 10))})`;
        ctx.fill();
      }

      /* Connections */
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = (pts[i].x - pts[j].x) * W;
          const dy = (pts[i].y - pts[j].y) * H;
          const d  = Math.sqrt(dx * dx + dy * dy);
          if (d < 90) {
            ctx.beginPath();
            ctx.moveTo(pts[i].x * W, pts[i].y * H);
            ctx.lineTo(pts[j].x * W, pts[j].y * H);
            ctx.strokeStyle = `rgba(245,166,35,${(1 - d / 90) * 0.08})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      /* Horizontal data-streams */
      for (const s of streams) {
        s.x = (s.x + s.speed) % 1;
        const sx = s.x * W;
        const sy = s.y * H;
        const g  = ctx.createLinearGradient(sx, sy, sx + s.len * W, sy);
        g.addColorStop(0, "transparent");
        g.addColorStop(0.5, `rgba(245,166,35,${s.a})`);
        g.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + s.len * W, sy);
        ctx.strokeStyle = g;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      /* Ambient glow — top left */
      const gl = ctx.createRadialGradient(0, 0, 0, W * 0.3, H * 0.3, W * 0.55);
      gl.addColorStop(0, "rgba(245,166,35,0.04)");
      gl.addColorStop(1, "transparent");
      ctx.fillStyle = gl;
      ctx.fillRect(0, 0, W, H);

      raf = requestAnimationFrame(loop);
    };

    loop();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  return <canvas ref={cvRef} className="vms-canvas" />;
}

/* ══════════════════════════════════════════════════════
   LEFT PANEL — VMS brand & modules
══════════════════════════════════════════════════════ */
const modules = [
  { icon: "📦", name: "Products",  desc: "Catalogue, HSN codes, batch tracking",   cls: "vms-mod-gold" },
  { icon: "👥", name: "Vendors",   desc: "Suppliers, balances, real-time ledger",  cls: "vms-mod-teal" },
  { icon: "📈", name: "Analytics", desc: "GSTR-1, FIFO invoices, payment tracking", cls: "vms-mod-blue" },
  { icon: "🗂️", name: "Dashboard", desc: "KPIs, expiry alerts, stock & P&L",       cls: "vms-mod-red"  },
];

function VMSLeft() {
  return (
    <div className="vms-left">
      <div className="vms-left-inner">
        
        <div className="vms-sys-tag">System · v2.0 · Pharma Wholesale</div>

        
        <div className="vms-logo">
          <div className="vms-logo-text">
            VMS<span className="vms-cursor" />
          </div>
          <div className="vms-logo-sub">Vendor Management System</div>
        </div>

        
        <p className="vms-tagline">
          Complete pharma wholesale control — vendors, stock, billing
          and analytics in one unified system.
        </p>

        
        <div className="vms-modules">
          {modules.map(({ icon, name, desc, cls }, i) => (
            <div key={i} className={`vms-module ${cls}`}>
              <span className="vms-mod-icon">{icon}</span>
              <div className="vms-mod-name">{name}</div>
              <div className="vms-mod-desc">{desc}</div>
            </div>
          ))}
        </div>

        
        <div className="vms-statrow">
          {[
            ["∞", "Products"],
            ["AUTO", "Invoices"],
            ["Live", "Reports"],
          ].map(([val, key], i) => (
            <div key={i} className="vms-stat-cell">
              <div className="vms-stat-val">{val}</div>
              <div className="vms-stat-key">{key}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   RIGHT PANEL — Login form
══════════════════════════════════════════════════════ */
function VMSRight() {
  const navigate               = useNavigate();
  const [step,     setStep]    = useState("email");
  const [email,    setEmail]   = useState("");
  const [password, setPassword]= useState("");
  const [loading,  setLoading] = useState(false);
  const [showPass, setShowPass]= useState(false);
  const emailRef = useRef(null);
  const passRef  = useRef(null);

  useEffect(() => { if (step === "email")    emailRef.current?.focus(); }, [step]);
  useEffect(() => { if (step === "password") passRef.current?.focus();  }, [step]);
  useEffect(() => {
    const h = () => setStep("email");
    window.addEventListener("popstate", h);
    return () => window.removeEventListener("popstate", h);
  }, []);

  const handleNext = () => {
    if (!email.trim()) return;
    setStep("password");
    window.history.pushState({}, "");
  };

  const handleLogin = async () => {
    if (!password.trim() || loading) return;
    setLoading(true);
    try {
      const res  = await fetch("https://vms-ui-backend-3.onrender.com/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password: password.trim() }),
      });
      const data = await res.json();
      if (data.status !== 200) { toast.error(data?.message || "Login failed"); return; }
      localStorage.setItem("vmsUser", JSON.stringify(data));
      navigate("/home");
    } catch {
      toast.error("Server error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="vms-right">
      
      <div className="vms-corner vms-corner-tl" />
      <div className="vms-corner vms-corner-tr" />
      <div className="vms-corner vms-corner-bl" />
      <div className="vms-corner vms-corner-br" />

      
      <div className="vms-step-badge">
        <div className="vms-badge-num">{step === "email" ? "01" : "02"}</div>
        {step === "email" ? "Identify Account" : "Verify Credentials"}
      </div>

      
      <div className="vms-form-heading">
        {step === "email"
          ? <><span>WELCOME</span><br />BACK</>
          : <><span>ENTER</span><br />PASSWORD</>
        }
      </div>

      
      <div className="vms-form-sub">
        {step === "email"
          ? "Sign in to access your vendor management console."
          : "Authenticate to continue to your dashboard."
        }
      </div>

      
      {step === "email" && (
        <div key="email-step">
          <div className="vms-field">
            <label className="vms-field-label">Email Address</label>
            <div className="vms-input-wrap">
              <input
                ref={emailRef}
                className="vms-input"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleNext()}
                autoComplete="email"
              />
            </div>
          </div>

          <button
            className="vms-cta"
            disabled={!email.trim()}
            onClick={handleNext}
          >
            CONTINUE
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}

      
      {step === "password" && (
        <div key="password-step">
          
          <div className="vms-email-tag">
            <svg width="11" height="11" viewBox="0 -960 960 960" fill="currentColor">
              <path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm320-280L160-640v400h640v-400L480-440Zm0-80 320-200H160l320 200Z" />
            </svg>
            <span className="vms-email-tag-addr">{email}</span>
            <button className="vms-email-change" onClick={() => setStep("email")}>Change</button>
          </div>

          <div className="vms-field">
            <label className="vms-field-label">Password</label>
            <div className="vms-input-wrap">
              <input
                ref={passRef}
                className={`vms-input vms-input-pw`}
                type={showPass ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
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
            disabled={!password.trim() || loading}
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

          <button className="vms-back" onClick={() => setStep("email")}>
            ← Back to email
          </button>
        </div>
      )}

      
      <div className="vms-foot">
        <span>support@vms.com</span>
        <span className="vms-foot-sep">·</span>
        <span>+91 98765 43210</span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   ROOT EXPORT
══════════════════════════════════════════════════════ */
export default function LoginPage() {
  return (
    <>
      <div className="vms-login-page">
        <VMSCanvas />
        <div className="vms-split" />
        <VMSLeft />
        <VMSRight />
      </div>
    </>
  );
}
