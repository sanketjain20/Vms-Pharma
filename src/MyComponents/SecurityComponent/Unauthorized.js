import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../../Styles/Unauthorized.css";

export default function Unauthorized() {
  const navigate   = useNavigate();
  const canvasRef  = useRef(null);
  const animRef    = useRef(null);

  /* 3D canvas background */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);

    const orbs = Array.from({ length: 5 }, (_, i) => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: 100 + Math.random() * 180,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
      hue: [0, 10, 350, 5, 15][i],
      alpha: 0.025 + Math.random() * 0.03,
    }));

    let tick = 0;
    const draw = () => {
      tick++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, canvas.width, canvas.height);

      const hor = canvas.height * 0.55, vanX = canvas.width / 2, gc = 12;
      const spd = (tick * 0.22) % (canvas.height / gc);
      ctx.save(); ctx.globalAlpha = 0.045; ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 0.5;
      for (let i = 0; i <= gc; i++) {
        const y = hor + spd + (i * (canvas.height - hor)) / gc;
        if (y > canvas.height) continue;
        const sp = ((y - hor) / (canvas.height - hor)) * canvas.width * 1.4;
        ctx.beginPath(); ctx.moveTo(vanX - sp / 2, y); ctx.lineTo(vanX + sp / 2, y); ctx.stroke();
      }
      for (let i = 0; i <= 16; i++) {
        const t = i / 16, bx = vanX - canvas.width * 0.7 + t * canvas.width * 1.4;
        ctx.beginPath(); ctx.moveTo(vanX, hor); ctx.lineTo(bx, canvas.height + 10); ctx.stroke();
      }
      ctx.restore();

      orbs.forEach(o => {
        o.x += o.vx; o.y += o.vy;
        if (o.x < -o.r) o.x = canvas.width + o.r;
        if (o.x > canvas.width + o.r) o.x = -o.r;
        if (o.y < -o.r) o.y = canvas.height + o.r;
        if (o.y > canvas.height + o.r) o.y = -o.r;
        const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
        g.addColorStop(0, `hsla(${o.hue},80%,55%,${o.alpha})`); g.addColorStop(1, "transparent");
        ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
      });

      const vig = ctx.createRadialGradient(canvas.width/2, canvas.height/2, canvas.height*0.1, canvas.width/2, canvas.height/2, canvas.height*0.9);
      vig.addColorStop(0, "rgba(0,0,0,0)"); vig.addColorStop(1, "rgba(0,0,0,0.75)");
      ctx.fillStyle = vig; ctx.fillRect(0, 0, canvas.width, canvas.height);

      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { window.removeEventListener("resize", resize); cancelAnimationFrame(animRef.current); };
  }, []);

  return (
    <div className="ua-page">
      <canvas ref={canvasRef} className="ua-canvas" />
      <div className="ua-noise" />
      <div className="ua-top-beam" />

      <div className="ua-card">
        {/* Corner brackets */}
        <div className="ua-corner ua-tl" /><div className="ua-corner ua-tr" />
        <div className="ua-corner ua-bl" /><div className="ua-corner ua-br" />

        {/* Badge */}
        <div className="ua-badge">
          <span className="ua-badge-dot" />
          ACCESS CONTROL
        </div>

        {/* 403 */}
        <div className="ua-code">
          <span>4</span>
          <span className="ua-code-accent">0</span>
          <span>3</span>
        </div>

        {/* Divider */}
        <div className="ua-rule" />

        {/* Lock icon */}
        <div className="ua-icon-ring">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect x="5" y="12" width="18" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.6"/>
            <path d="M9 12V9a5 5 0 0 1 10 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            <circle cx="14" cy="18.5" r="1.5" fill="currentColor"/>
            <path d="M14 18.5v2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </div>

        <h2 className="ua-title">Access Denied</h2>
        <p className="ua-msg">
          You don't have permission to view this page.<br />
          Contact your administrator if this seems wrong.
        </p>

        <button className="ua-btn" onClick={() => navigate("/home")}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M6 1.5L1.5 6.5L6 11.5M1.5 6.5H11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Go Back Home
        </button>
      </div>
    </div>
  );
}
