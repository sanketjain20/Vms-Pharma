import React, { useEffect, useRef } from "react";
import { useCanvasThemeKey, isLightTheme } from "../../utils/canvasTheme";

/* ── Shared animated backdrop for the Reports "ledger" pages ──────────────
   variant="shelf"  -> used behind the reports list (wider drift, slow ink blooms)
   variant="spread" -> used behind the open-book filter page (tighter, calmer)      */
export default function LedgerCanvas({ variant = "shelf" }) {
  const canvasRef = useRef(null);
  const themeKey = useCanvasThemeKey();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const light = isLightTheme();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let W, H, raf, resizeTimer;
    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    resize();
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 120);
    };
    window.addEventListener("resize", onResize);

    const fiberCount = variant === "shelf" ? 46 : 30;
    const fibers = Array.from({ length: fiberCount }, () => ({
      x: Math.random(),
      y: Math.random(),
      len: 10 + Math.random() * 22,
      ang: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.0009,
      drift: 0.00006 + Math.random() * 0.00012,
      a: 0.05 + Math.random() * 0.09,
      phase: Math.random() * Math.PI * 2,
    }));

    let blooms = [];
    const spawnBloom = () => {
      blooms.push({
        x: Math.random() * W,
        y: Math.random() * H * 0.85,
        r: 0,
        maxR: 140 + Math.random() * 220,
        a: 0,
        life: 0,
      });
    };
    const bloomInterval = variant === "shelf" ? 3400 : 5200;
    const si = reduced ? null : setInterval(spawnBloom, bloomInterval);

    const base = () => (light ? "#f4f7fb" : "#000000");
    const ruleColor = () => (light ? "rgba(37,99,235,0.07)" : "rgba(212,175,55,0.055)");
    const fiberColor = () => (light ? "20,19,15" : "245,245,247");
    const bloomHue = () => (light ? "37,99,235" : "212,175,55");

    const drawRules = (t) => {
      const horizon = H * (variant === "shelf" ? 0.16 : 0.5);
      const vanishX = W / 2;
      ctx.save();
      ctx.strokeStyle = ruleColor();
      ctx.lineWidth = 1;
      const rows = variant === "shelf" ? 26 : 18;
      const speed = reduced ? 0 : t * 6;
      for (let i = 0; i <= rows; i++) {
        const p = ((i + (speed % 1)) / rows) % 1;
        const y = horizon + p * (H - horizon);
        if (y > H) continue;
        const spread = ((y - horizon) / (H - horizon)) * W * 1.15;
        ctx.globalAlpha = 0.5 + 0.5 * (1 - p);
        ctx.beginPath();
        ctx.moveTo(vanishX - spread / 2, y);
        ctx.lineTo(vanishX + spread / 2, y);
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawFibers = (t) => {
      ctx.save();
      for (const f of fibers) {
        const fx = ((f.x + t * f.drift) % 1) * W;
        const fy = ((f.y + t * f.drift * 0.6) % 1) * H;
        const ang = f.ang + t * f.spin * 60;
        const tw = 0.5 + 0.5 * Math.sin(t * 0.8 + f.phase);
        ctx.strokeStyle = `rgba(${fiberColor()},${f.a * tw})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(fx - Math.cos(ang) * f.len, fy - Math.sin(ang) * f.len);
        ctx.lineTo(fx + Math.cos(ang) * f.len, fy + Math.sin(ang) * f.len);
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawBlooms = () => {
      blooms = blooms.filter((b) => b.life < 1);
      for (const b of blooms) {
        b.life += 0.006;
        b.r = b.maxR * Math.sin((b.life * Math.PI) / 2);
        b.a = Math.sin(b.life * Math.PI) * (light ? 0.05 : 0.07);
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, Math.max(b.r, 1));
        g.addColorStop(0, `rgba(${bloomHue()},${b.a})`);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
    };

    let t = 0;
    const paint = () => {
      ctx.fillStyle = base();
      ctx.fillRect(0, 0, W, H);
      drawRules(t);
      drawFibers(t);
      drawBlooms();

      const vig = ctx.createRadialGradient(W / 2, H * 0.4, H * 0.15, W / 2, H * 0.5, H * 0.95);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, light ? "rgba(180,195,220,0.35)" : "rgba(0,0,0,0.6)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);
    };

    if (reduced) {
      paint();
    } else {
      const loop = () => {
        t += 0.012;
        paint();
        raf = requestAnimationFrame(loop);
      };
      loop();
    }

    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(resizeTimer);
      if (raf) cancelAnimationFrame(raf);
      if (si) clearInterval(si);
    };
  }, [themeKey, variant]);

  return <canvas ref={canvasRef} className="lg-weave" aria-hidden="true" />;
}
