import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "../../Styles/Login/Login.css";

/* ══════════════════════════════════════════════════════
   CANVAS — Violet particle web + shooting stars
══════════════════════════════════════════════════════ */
function LoginCanvas() {
  const cvRef = useRef(null);

  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    let W, H, raf, t = 0;

    /* Floating particles */
    const particles = Array.from({ length: 55 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.4 + 0.3,
      vx: (Math.random() - 0.5) * 0.00025,
      vy: (Math.random() - 0.5) * 0.00025,
      a: Math.random() * 0.5 + 0.15,
      tw: Math.random() * 2 + 0.6,
      tp: Math.random() * Math.PI * 2,
    }));

    /* Shooters */
    let shooters = [];
    const addShooter = () => {
      shooters.push({
        x: Math.random() * 0.7,
        y: Math.random() * 0.45,
        vx: 5 + Math.random() * 6,
        vy: 1.5 + Math.random() * 2.5,
        len: 90 + Math.random() * 110,
        a: 1,
      });
    };
    const si = setInterval(addShooter, 3200);

    const resize = () => {
      W = cv.width = window.innerWidth;
      H = cv.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const loop = () => {
      ctx.clearRect(0, 0, W, H);
      t += 0.005;

      /* Background */
      const bg = ctx.createRadialGradient(W * 0.2, H * 0.2, 0, W * 0.5, H * 0.5, Math.max(W, H));
      bg.addColorStop(0,   "rgba(11,9,28,1)");
      bg.addColorStop(0.5, "rgba(6,8,15,1)");
      bg.addColorStop(1,   "rgba(3,4,10,1)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      /* Subtle grid */
      ctx.strokeStyle = "rgba(124,58,237,0.025)";
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 72) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += 72) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      /* Move + draw particles */
      for (const p of particles) {
        p.x = ((p.x + p.vx) + 1) % 1;
        p.y = ((p.y + p.vy) + 1) % 1;
        const tw = 0.5 + 0.5 * Math.sin(t * p.tw + p.tp);
        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(167,139,250,${p.a * tw})`;
        ctx.fill();
      }

      /* Connections between close particles */
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = (particles[i].x - particles[j].x) * W;
          const dy = (particles[i].y - particles[j].y) * H;
          const d  = Math.sqrt(dx * dx + dy * dy);
          if (d < 100) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x * W, particles[i].y * H);
            ctx.lineTo(particles[j].x * W, particles[j].y * H);
            ctx.strokeStyle = `rgba(124,58,237,${(1 - d / 100) * 0.12})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      /* Violet ambient glow top-left */
      const gl = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 0.5);
      gl.addColorStop(0, "rgba(124,58,237,0.06)");
      gl.addColorStop(1, "transparent");
      ctx.fillStyle = gl;
      ctx.fillRect(0, 0, W, H);

      /* Shooting stars */
      shooters = shooters.filter(s => s.a > 0.02);
      for (const s of shooters) {
        const tail = ctx.createLinearGradient(
          s.x * W, s.y * H,
          s.x * W - s.vx * (s.len / 10),
          s.y * H - s.vy * (s.len / 10)
        );
        tail.addColorStop(0, `rgba(167,139,250,${s.a})`);
        tail.addColorStop(1, "transparent");
        ctx.save();
        ctx.strokeStyle = tail;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(s.x * W, s.y * H);
        ctx.lineTo(s.x * W - s.vx * (s.len / 10), s.y * H - s.vy * (s.len / 10));
        ctx.stroke();
        ctx.restore();
        s.x += s.vx / W;
        s.y += s.vy / H;
        s.a -= 0.014;
      }

      raf = requestAnimationFrame(loop);
    };

    loop();
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(si);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={cvRef} className="login-canvas" />;
}

/* ══════════════════════════════════════════════════════
   LOGIN SECTION
══════════════════════════════════════════════════════ */
export default function LoginSection() {
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

  const handleKeyEmail = e => { if (e.key === "Enter") handleNext(); };
  const handleKeyPass  = e => { if (e.key === "Enter") handleLogin(); };

  const handleLogin = async () => {
    if (!password.trim() || loading) return;
    setLoading(true);
    try {
      const res  = await fetch("https:/vms-ui-backend-3.onrender.com/api/auth/login", {
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
    <>
      <LoginCanvas />

      <div className="ls-wrap">
        <div className="ls-card">

          
          <div className="ls-card-header">
            <div className="ls-eyebrow">
              <span className="ls-dot" />
              <span>Secure Login</span>
            </div>

            <h1 className="ls-title">
              {step === "email"
                ? <><span className="ls-title-dim">Welcome</span>Back</>
                : <><span className="ls-title-dim">Enter</span>Password</>
              }
            </h1>
          </div>

          
          {step === "email" && (
            <div className="ls-step" key="email-step">
              <p className="ls-hint">
                Sign in to manage your vendors, products, and invoices.
              </p>

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
                  autoComplete="email"
                />
              </div>

              <button
                className={`ls-btn${email.trim() ? "" : " ls-btn-disabled"}`}
                disabled={!email.trim()}
                onClick={handleNext}
              >
                Continue
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          )}

          
          {step === "password" && (
            <div className="ls-step" key="password-step">
              <div className="ls-email-pill">
                <svg width="11" height="11" viewBox="0 -960 960 960" fill="currentColor">
                  <path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm320-280L160-640v400h640v-400L480-440Zm0-80 320-200H160l320 200Z" />
                </svg>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{email}</span>
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
                    autoComplete="current-password"
                  />
                  <button className="ls-eye" onClick={() => setShowPass(!showPass)} type="button" aria-label="Toggle password">
                    {showPass ? (
                      <svg width="15" height="15" viewBox="0 -960 960 960" fill="currentColor">
                        <path d="M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-146 0-266-81.5T40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200Z" />
                      </svg>
                    ) : (
                      <svg width="15" height="15" viewBox="0 -960 960 960" fill="currentColor">
                        <path d="m644-428-58-58q9-47-27-88t-93-32l-58-58q17-8 34.5-12t36.5-4q75 0 127.5 52.5T660-500q0 19-4 36.5T644-428Zm128 126-58-56q38-29 67.5-63.5T832-500q-50-101-143.5-160.5T480-720q-29 0-57 4t-55 12l-62-62q41-17 84-25.5t90-8.5q151 0 269 83.5T920-500q-23 59-60.5 109.5T772-302Zm20 246L624-222q-35 11-70.5 16.5T480-200q-151 0-269-83.5T40-500q21-53 53-98.5t73-81.5L56-792l56-56 736 736-56 56Z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="ls-forgot">
                <button className="ls-forgot-btn" onClick={() => navigate("/forgotpassword")}>
                  Forgot password?
                </button>
              </div>

              <button
                className={`ls-btn${password.trim() && !loading ? "" : " ls-btn-disabled"}`}
                disabled={!password.trim() || loading}
                onClick={handleLogin}
              >
                {loading ? (
                  <><span className="ls-spinner" /> Signing in…</>
                ) : (
                  <>
                    Sign In
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </>
                )}
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
      </div>
    </>
  );
}
