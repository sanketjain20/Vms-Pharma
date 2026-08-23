import React, { useEffect, useRef } from "react";
import "../../Styles/CoinField.css";

/* CoinField — a contained, cursor-reactive particle panel for the Quick
   Sale header. Distinct from the Home ray field on purpose:

   Idle    : soft glowing motes drift upward at their own pace, gently
             swaying side to side, recycling once they drift off the top.
   Hover   : motes within a radius of the pointer are pushed outward,
             swirling around it like a hand stirring water — the more
             you move, the more they scatter, then drift back to normal.
   Burst   : call with an incrementing `burstToken` prop right after a
             sale completes — spawns a wave of extra motes from the
             bottom and gives every mote a brief upward kick. A small
             "cha-ching" flourish, not a full-screen animation.

   Respects prefers-reduced-motion (no animation loop, static render)
   and pauses the loop while the tab is hidden. */

const COUNT_PER_100PX = 2.2;
const RISE_MIN = 14, RISE_MAX = 30;       // px/s
const SWAY_AMP = 10;                       // px
const POINTER_RADIUS = 90;                 // px
const POINTER_FORCE = 3.4;

const HUES = [
  [59, 130, 246],   // blue
  [16, 185, 129],   // green
  [34, 211, 238],   // cyan
];

function spawn(w, h, fromBottom) {
  const hue = HUES[(Math.random() * HUES.length) | 0];
  return {
    x: Math.random() * w,
    y: fromBottom ? h + Math.random() * 20 : Math.random() * h,
    r: 1.4 + Math.random() * 2.4,
    rise: RISE_MIN + Math.random() * (RISE_MAX - RISE_MIN),
    ph: Math.random() * Math.PI * 2,
    sp: 0.4 + Math.random() * 0.6,
    baseAlpha: 0.28 + Math.random() * 0.4,
    hue,
    kick: 0,
  };
}

export default function CoinField({ burstToken = 0 }) {
  const wrapRef = useRef(null);
  const cvsRef = useRef(null);
  const partsRef = useRef([]);
  const rafRef = useRef(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const pointerRef = useRef({ x: -9999, y: -9999, active: false });
  const lastBurstToken = useRef(burstToken);

  useEffect(() => {
    const wrap = wrapRef.current;
    const cvs = cvsRef.current;
    if (!wrap || !cvs) return undefined;
    const ctx = cvs.getContext("2d", { alpha: true });
    if (!ctx) return undefined;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

    const resize = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(window.devicePixelRatio || 1, w < 600 ? 1.5 : 2);
      cvs.width = Math.round(w * dpr);
      cvs.height = Math.round(h * dpr);
      cvs.style.width = `${w}px`;
      cvs.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };

      const want = Math.max(18, Math.round((w / 100) * COUNT_PER_100PX));
      if (partsRef.current.length !== want) {
        partsRef.current = Array.from({ length: want }, () => spawn(w, h, false));
      }
    };

    const onMove = (e) => {
      const r = wrap.getBoundingClientRect();
      pointerRef.current = { x: e.clientX - r.left, y: e.clientY - r.top, active: true };
    };
    const onLeave = () => { pointerRef.current.active = false; };

    const doBurst = () => {
      const { w, h } = sizeRef.current;
      if (!w) return;
      // extra wave from the bottom
      for (let i = 0; i < 14; i++) {
        const p = spawn(w, h, true);
        p.kick = 60 + Math.random() * 40;
        partsRef.current.push(p);
      }
      // kick every existing mote upward too
      partsRef.current.forEach(p => { p.kick = Math.max(p.kick, 40 + Math.random() * 30); });
      // trim back down over time so the panel doesn't accumulate forever
      const base = Math.max(18, Math.round((w / 100) * COUNT_PER_100PX));
      if (partsRef.current.length > base + 30) {
        partsRef.current = partsRef.current.slice(partsRef.current.length - (base + 30));
      }
    };

    let last = performance.now();
    let hidden = document.hidden;
    const onVis = () => { hidden = document.hidden; if (!hidden) last = performance.now(); };
    document.addEventListener("visibilitychange", onVis);

    const draw = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { w, h } = sizeRef.current;
      const ptr = pointerRef.current;
      ctx.clearRect(0, 0, w, h);

      partsRef.current.forEach(p => {
        // idle drift
        p.y -= (p.rise + p.kick) * dt;
        p.kick *= Math.max(0, 1 - dt * 2.2);
        p.ph += p.sp * dt;
        let x = p.x + Math.sin(p.ph) * SWAY_AMP;
        let y = p.y;

        // pointer swirl
        if (ptr.active) {
          const dx = x - ptr.x, dy = y - ptr.y;
          const dist = Math.hypot(dx, dy);
          if (dist < POINTER_RADIUS && dist > 0.001) {
            const f = (1 - dist / POINTER_RADIUS) * POINTER_FORCE;
            x += (dx / dist) * f * 14;
            y += (dy / dist) * f * 14;
          }
        }

        if (p.y < -10) {
          const fresh = spawn(w, h, true);
          Object.assign(p, fresh);
        }

        const glow = ptr.active && Math.hypot(x - ptr.x, y - ptr.y) < POINTER_RADIUS ? 1.6 : 1;
        const [r, g, b] = p.hue;
        const alpha = Math.min(0.9, p.baseAlpha * glow);
        const rad = p.r * glow;

        const grad = ctx.createRadialGradient(x, y, 0, x, y, rad * 3.4);
        grad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, rad * 3.4, 0, Math.PI * 2);
        ctx.fill();
      });

      rafRef.current = requestAnimationFrame(draw);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerleave", onLeave);

    if (reduce.matches) {
      // Single static frame — no rAF loop, no motion.
      draw(performance.now());
    } else {
      rafRef.current = requestAnimationFrame(draw);
    }

    wrap.__coinFieldBurst = doBurst;

    return () => {
      ro.disconnect();
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    if (burstToken !== lastBurstToken.current) {
      lastBurstToken.current = burstToken;
      wrapRef.current?.__coinFieldBurst?.();
    }
  }, [burstToken]);

  return (
    <div className="cf-wrap" ref={wrapRef}>
      <canvas className="cf-canvas" ref={cvsRef} />
      <div className="cf-copy">
        <span className="cf-copy-kicker">Quick Sale</span>
        <span className="cf-copy-title">Every bill, closed in seconds</span>
      </div>
    </div>
  );
}
