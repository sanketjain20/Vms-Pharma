import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../Styles/Home.css";
import API_BASE_URL from "../Config/api.config";
import apiClient from "../Config/apiClient";
import AuroraBackground from "./CommonComponent/AuroraBackground";

/* ── Ray band — Stripe-style radiating fan, contained in one panel ──────
   A single <canvas> sized to its own section, not the viewport. Sky
   gradient, ray tint and bloom tint are CSS custom properties on the
   wrapper (.hc-rayband in Home.css), so switching palette is a class
   swap — JS re-reads the values and crossfades the rays to match.
   Nothing here touches the page background.

   Idle   : rays breathe, beads drift outward slowly.
   Hover  : the fan leans toward the pointer, rays near it stretch and
            brighten, beads accelerate. Eases back out on leave.
   Off-screen or hidden tab: the loop stops entirely.
--------------------------------------------------------------------- */

/* Add or remove entries here to change what the picker offers. Each key
   must have a matching .hc-rayband--<key> class in Home.css.
   Also available there, unused by default: `ice` (pale) and `rose`. */
const RAY_PRESETS = [
  { key: "indigo", label: "Indigo", swatch: "#6d5ff0" },
  { key: "teal",   label: "Teal",   swatch: "#22d3ee" },
  { key: "violet", label: "Violet", swatch: "#a86ae0" },
  { key: "amber",  label: "Amber",  swatch: "#ffb877" },
];
const DEFAULT_PRESET = RAY_PRESETS[0].key;
const PRESET_STORAGE_KEY = "vmsRayPreset";

const RAY_START = -Math.PI - 0.22;   // just past horizontal-left
const RAY_SPREAD = Math.PI + 0.44;   // a touch wider than a semicircle
const PALETTE_FADE = 0.7;            // seconds, matches the CSS sky transition

const wrapAngle = (d) => {
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};

const parseRGB = (raw, fallback) => {
  const parts = String(raw).split(",").map((n) => parseFloat(n));
  return parts.length === 3 && parts.every(Number.isFinite) ? parts : fallback.slice();
};

const mixRGB = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

const css = (rgb, alpha) =>
  alpha == null
    ? `rgb(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0})`
    : `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${alpha})`;

function buildRays(count) {
  const rays = new Array(count);
  for (let i = 0; i < count; i++) {
    // jittered stride: an even stride reads as a combed fan, pure random clumps
    const j = (i + Math.random() * 0.85) / count;
    rays[i] = {
      a: RAY_START + j * RAY_SPREAD,
      len: 0.42 + Math.random() * 0.7,       // fraction of the field radius
      w: 0.5 + Math.random() * 1.05,         // px
      al: 0.1 + Math.random() * 0.55,        // base alpha
      wob: 0.004 + Math.random() * 0.02,     // idle sway, radians
      wsp: 0.15 + Math.random() * 0.5,       // sway speed
      ph: Math.random() * Math.PI * 2,
      bead: Math.random() < 0.55
        ? { p: Math.random(), sp: 0.03 + Math.random() * 0.09 }
        : null,
    };
  }
  return rays;
}

function RayField({
  preset = DEFAULT_PRESET,
  presets = null,          // pass RAY_PRESETS to show the picker
  onPresetChange = null,
  density = 1,
  children,
}) {
  const wrapRef = useRef(null);
  const cvsRef = useRef(null);
  const raysRef = useRef([]);
  const rafRef = useRef(null);
  const apiRef = useRef(null);
  const rectRef = useRef({ left: 0, top: 0 });
  const geoRef = useRef({ w: 0, h: 0, ox: 0, oy: 0, R: 1, fade: null, core: null });
  const colRef = useRef({
    from: [255, 255, 255], to: [255, 255, 255], cur: [255, 255, 255],
    coreFrom: [255, 255, 255], coreTo: [255, 255, 255], coreCur: [255, 255, 255],
    mix: 1,
  });
  const ptrRef = useRef({ ang: -Math.PI / 2, hover: 0, want: 0, idle: 99 });

  useEffect(() => {
    const wrap = wrapRef.current;
    const cvs = cvsRef.current;
    if (!wrap || !cvs) return undefined;

    const ctx = cvs.getContext("2d", { alpha: true });
    if (!ctx) return undefined;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = true;
    let last = performance.now();

    /* Cached so pointermove never forces a layout read. */
    const syncRect = () => {
      const r = wrap.getBoundingClientRect();
      rectRef.current.left = r.left;
      rectRef.current.top = r.top;
    };

    /* Bloom gradient depends on the tweening colour, so it's rebuilt
       while a palette change is in flight, then left cached. */
    const makeCore = () => {
      const g = geoRef.current;
      const grad = ctx.createRadialGradient(g.ox, g.oy, 0, g.ox, g.oy, g.R * 0.36);
      grad.addColorStop(0, css(colRef.current.coreCur, 0.8));
      grad.addColorStop(0.45, css(colRef.current.coreCur, 0.2));
      grad.addColorStop(1, css(colRef.current.coreCur, 0));
      g.core = grad;
    };

    /* Read --ray-rgb / --ray-core-rgb off the wrapper and start a crossfade
       (or snap, when motion is reduced). */
    const applyPalette = (instant) => {
      const cs = getComputedStyle(wrap);
      const ray = parseRGB(cs.getPropertyValue("--ray-rgb").trim(), [255, 255, 255]);
      const core = parseRGB(cs.getPropertyValue("--ray-core-rgb").trim(), ray);
      const c = colRef.current;

      if (instant) {
        c.from = ray.slice(); c.to = ray.slice(); c.cur = ray.slice();
        c.coreFrom = core.slice(); c.coreTo = core.slice(); c.coreCur = core.slice();
        c.mix = 1;
      } else {
        c.from = c.cur.slice(); c.to = ray;
        c.coreFrom = c.coreCur.slice(); c.coreTo = core;
        c.mix = 0;
      }
      makeCore();
    };

    /* Recompute size, origin, cached gradients and ray count. */
    const rebuild = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (!w || !h) return;

      // 1.5 on phones keeps the fill rate sane without visible aliasing
      const dpr = Math.min(window.devicePixelRatio || 1, w < 720 ? 1.5 : 2);
      cvs.width = Math.round(w * dpr);
      cvs.height = Math.round(h * dpr);
      cvs.style.width = `${w}px`;
      cvs.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // origin sits a hair below the panel, so the blown-out core stays off
      // the edge and only the fan is inside the frame
      const ox = w * 0.5;
      const oy = h * 1.02;
      const R = Math.hypot(w * 0.6, oy) * 1.06;

      // punched out with destination-out: clear at the core, solid at the rim
      const fade = ctx.createRadialGradient(ox, oy, 0, ox, oy, R);
      fade.addColorStop(0, "rgba(0,0,0,0)");
      fade.addColorStop(0.42, "rgba(0,0,0,0.08)");
      fade.addColorStop(0.76, "rgba(0,0,0,0.5)");
      fade.addColorStop(1, "rgba(0,0,0,1)");

      geoRef.current = { w, h, ox, oy, R, fade, core: null };
      makeCore();
      syncRect();

      const want = Math.round(Math.min(220, Math.max(60, w / 4)) * density);
      if (raysRef.current.length !== want) raysRef.current = buildRays(want);
    };

    const frame = (now, still) => {
      const g = geoRef.current;
      const p = ptrRef.current;
      const c = colRef.current;
      const rays = raysRef.current;
      const dt = Math.min(50, now - last) / 1000;
      last = now;

      // palette crossfade
      if (c.mix < 1) {
        c.mix = Math.min(1, c.mix + dt / PALETTE_FADE);
        const e = c.mix * c.mix * (3 - 2 * c.mix); // smoothstep
        c.cur = mixRGB(c.from, c.to, e);
        c.coreCur = mixRGB(c.coreFrom, c.coreTo, e);
        makeCore();
      }

      // hover decays on its own if the pointer stops inside the panel
      p.idle += dt;
      if (p.idle > 1.2) p.want = 0;
      p.hover += (p.want - p.hover) * Math.min(1, dt * 3.2);

      const t = now / 1000;
      const stroke = css(c.cur);
      ctx.clearRect(0, 0, g.w, g.h);
      ctx.lineCap = "round";
      ctx.strokeStyle = stroke;
      ctx.fillStyle = stroke;

      for (let i = 0; i < rays.length; i++) {
        const r = rays[i];
        const d = wrapAngle(p.ang - r.a);
        const f = p.hover > 0.002 ? Math.exp(-(d * d) / 0.2) : 0; // spotlight falloff
        const a = r.a + Math.sin(t * r.wsp + r.ph) * r.wob + p.hover * 0.09 * d * f;
        const len = g.R * r.len * (1 + 0.32 * p.hover * f);
        const al = Math.min(
          1,
          r.al * (0.78 + 0.22 * Math.sin(t * 0.6 + r.ph)) * (1 + 1.7 * p.hover * f)
        );
        const ca = Math.cos(a);
        const sa = Math.sin(a);

        ctx.globalAlpha = al;
        ctx.lineWidth = r.w * (1 + 0.5 * p.hover * f);
        ctx.beginPath();
        ctx.moveTo(g.ox + ca * 14, g.oy + sa * 14);
        ctx.lineTo(g.ox + ca * len, g.oy + sa * len);
        ctx.stroke();

        if (r.bead) {
          r.bead.p += r.bead.sp * dt * (0.55 + 2.4 * p.hover);
          if (r.bead.p > 1) r.bead.p -= 1;
          const bd = 14 + r.bead.p * (len - 14);
          const s = r.w * 1.7 + 0.6;
          ctx.globalAlpha = Math.min(1, al * 1.9 * (1 - r.bead.p * 0.55));
          ctx.fillRect(g.ox + ca * bd - s / 2, g.oy + sa * bd - s / 2, s, s);
        }
      }

      // fade the tips into the sky
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = g.fade;
      ctx.fillRect(0, 0, g.w, g.h);

      // bloom at the origin, brighter while the pointer is live
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.5 + 0.35 * p.hover;
      ctx.fillStyle = g.core;
      ctx.fillRect(0, 0, g.w, g.h);

      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;

      if (!still) rafRef.current = requestAnimationFrame(frame);
    };

    const stop = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    const start = () => {
      if (rafRef.current || reduce.matches || !visible || document.hidden) return;
      last = performance.now();
      rafRef.current = requestAnimationFrame(frame);
    };
    const paintStill = () => frame(performance.now(), true);

    const onMove = (e) => {
      const g = geoRef.current;
      const p = ptrRef.current;
      p.ang = Math.atan2(
        e.clientY - rectRef.current.top - g.oy,
        e.clientX - rectRef.current.left - g.ox
      );
      p.want = 1;
      p.idle = 0;
    };
    const onLeave = () => { ptrRef.current.want = 0; };
    const onScroll = () => syncRect();
    const onResize = () => { rebuild(); if (!rafRef.current) paintStill(); };
    const onVisibility = () => (document.hidden ? stop() : start());
    const onMotionChange = () => { stop(); applyPalette(true); paintStill(); start(); };

    applyPalette(true);
    rebuild();
    paintStill();
    start();

    // the picker only swaps a class; this is how the canvas hears about it
    apiRef.current = {
      refreshPalette: () => {
        applyPalette(reduce.matches);
        if (!rafRef.current) paintStill();
        else start();
      },
    };

    // only burn frames while the panel is actually on screen
    const io = typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(
          ([entry]) => { visible = entry.isIntersecting; visible ? start() : stop(); },
          { rootMargin: "150px" }
        )
      : null;
    if (io) io.observe(wrap);

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : null;
    if (ro) ro.observe(wrap);

    const themeObserver = new MutationObserver(() => apiRef.current?.refreshPalette());
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ["data-theme", "class"] });

    wrap.addEventListener("pointermove", onMove, { passive: true });
    wrap.addEventListener("pointerdown", onMove, { passive: true });
    wrap.addEventListener("pointerleave", onLeave);
    wrap.addEventListener("pointercancel", onLeave);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    if (reduce.addEventListener) reduce.addEventListener("change", onMotionChange);

    return () => {
      stop();
      apiRef.current = null;
      if (io) io.disconnect();
      if (ro) ro.disconnect();
      themeObserver.disconnect();
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerdown", onMove);
      wrap.removeEventListener("pointerleave", onLeave);
      wrap.removeEventListener("pointercancel", onLeave);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      if (reduce.removeEventListener) reduce.removeEventListener("change", onMotionChange);
    };
  }, [density]);

  /* Palette change: re-read the vars and crossfade. No teardown, so the
     fan keeps its shape and only the colour moves. */
  useEffect(() => {
    apiRef.current?.refreshPalette();
  }, [preset]);

  return (
    <div ref={wrapRef} className={`hc-rayband hc-rayband--${preset}`}>
      <canvas ref={cvsRef} className="hc-rayband-canvas" aria-hidden="true" />

      {children ? <div className="hc-rayband-copy">{children}</div> : null}

      {presets && onPresetChange ? (
        <div className="hc-rayband-picker" aria-label="Ray colour">
          {presets.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`hc-rayband-swatch${p.key === preset ? " is-active" : ""}`}
              style={{ "--swatch": p.swatch }}
              aria-pressed={p.key === preset}
              onClick={() => onPresetChange(p.key)}
            >
              <span className="hc-rayband-dot" aria-hidden="true" />
              <span className="hc-rayband-swatch-label">{p.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ── Animated count-up number ── */
function CountUp({ target, prefix = "", suffix = "", duration = 1100 }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const start = performance.now();
    const numeric = parseFloat(String(target).replace(/[^0-9.]/g, "")) || 0;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(numeric * eased);
      if (p < 1) ref.current = requestAnimationFrame(tick);
    };
    ref.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(ref.current);
  }, [target, duration]);

  const isDecimal = String(target).includes(".");
  const display = isDecimal ? val.toFixed(1) : Math.round(val).toLocaleString("en-IN");

  return <>{prefix}{display}{suffix}</>;
}

/* ── Analog watch — smooth, real-time, neon-glow ──
   Hands are rotated with CSS custom properties + a `transform: rotate(var(--deg))`
   rule (see Home.css), driven every animation frame. Using a CSS var instead of
   setAttribute("transform", ...) avoids any risk of React re-render fighting the
   imperative DOM update or the attribute being stripped on parent re-paints. */
function AnalogWatch() {
  const secRef = useRef(null);
  const minRef = useRef(null);
  const hourRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");

    const applyHandAngles = () => {
      const now = new Date();
      const ms = now.getMilliseconds();
      const s = now.getSeconds() + ms / 1000;
      const m = now.getMinutes() + s / 60;
      const h = (now.getHours() % 12) + m / 60;

      if (secRef.current) secRef.current.style.setProperty("--deg", `${s * 6}deg`);
      if (minRef.current) minRef.current.style.setProperty("--deg", `${m * 6}deg`);
      if (hourRef.current) hourRef.current.style.setProperty("--deg", `${h * 30}deg`);
    };

    const loop = () => {
      applyHandAngles();
      rafRef.current = requestAnimationFrame(loop);
    };

    if (mql.matches) {
      applyHandAngles();
      const id = setInterval(applyHandAngles, 1000);
      return () => clearInterval(id);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div className="hc-watch">
      <svg viewBox="0 0 120 120" className="hc-watch-svg">
        {/* Four cardinal markers at 12 / 3 / 6 / 9 only — kept minimal to
            match the bare-needle look, no full tick ring or dial. */}
        <circle cx="60" cy="8"   r="2.4" className="hc-watch-marker" />
        <circle cx="112" cy="60" r="2.4" className="hc-watch-marker" />
        <circle cx="60" cy="112" r="2.4" className="hc-watch-marker" />
        <circle cx="8" cy="60"   r="2.4" className="hc-watch-marker" />

        {/* Hour & minute hands: tapered needles — wide where they meet the
            hub, narrowing to a sharp point at the tip that indicates the
            time, with a short blunt counterbalance tail behind the hub.
            This reads as a single directional pointer instead of a
            symmetric double-ended spoke. */}
        <polygon
          ref={hourRef}
          className="hc-watch-hand-hour"
          points="60,64 64,60 60,22 56,60"
        />
        <polygon
          ref={minRef}
          className="hc-watch-hand-min"
          points="60,68 63,60 60,10 57,60"
        />
        <polygon
          ref={secRef}
          className="hc-watch-hand-sec"
          points="60,74 61.4,60 60,14 58.6,60"
        />
        <circle cx="60" cy="60" r="4.5" className="hc-watch-hub" />
      </svg>
    </div>
  );
}

function LiveClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="hc-watch-time">{time}</span>;
}

const ICONS = {
  purchase: <svg width="22" height="22" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M2 9h14M2 5h14M2 13h8"/><circle cx="14" cy="13" r="3"/><path d="M14 11.5v1.5l1 1"/></svg>,
  sales: <svg width="22" height="22" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M3 3h12l-1.5 9H4.5z"/><circle cx="7" cy="16" r="1" fill="currentColor"/><circle cx="12" cy="16" r="1" fill="currentColor"/></svg>,
  inventory: <svg width="22" height="22" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><rect x="2" y="2" width="14" height="4" rx="1"/><rect x="2" y="8" width="14" height="4" rx="1"/><rect x="2" y="14" width="8" height="2" rx="1"/></svg>,
  retailer: <svg width="22" height="22" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><circle cx="9" cy="6" r="3"/><path d="M3 16a6 6 0 0112 0"/></svg>,
  payment: <svg width="22" height="22" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><rect x="2" y="5" width="14" height="10" rx="2"/><path d="M2 9h14M6 9v6"/></svg>,
  reports: <svg width="22" height="22" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M2 14l4-5 4 3 4-7"/><circle cx="14" cy="5" r="1" fill="currentColor"/></svg>,
};

const MODULES = [
  { key: "purchase",  label: "Purchase",  hint: "Stock in · supplier dues",   from: "#7c3aed", to: "#ec4899", path: "/master/purchase" },
  { key: "sales",     label: "Sales",     hint: "FIFO billing · invoices",    from: "#06b6d4", to: "#3b82f6", path: "/master/salesshrt" },
  { key: "inventory", label: "Inventory", hint: "Live stock · expiry",        from: "#a3e635", to: "#16a34a", path: "/master/inventory" },
  { key: "retailer",  label: "Retailers", hint: "Credit · outstanding",       from: "#fb923c", to: "#ef4444", path: "/master/retailer" },
  { key: "payment",   label: "Payments",  hint: "Collect · due tracking",     from: "#facc15", to: "#f97316", path: "/master/payment-collection" },
  { key: "reports",   label: "Reports",   hint: "GSTR-1 · recall trace",      from: "#818cf8", to: "#c084fc", path: "/master/reports" },
];

/* Moved out of the component body: these JSX icons were being rebuilt on
   every render (and every 45s ticker poll) for no reason. */
const QUICK_ACTIONS = [
  {
    key: "billing",
    label: "Start billing",
    sub: "FIFO · invoice now",
    path: "/master/salesshrt",
    color: "#22d3ee",
    icon: <svg width="20" height="20" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 3h12l-1.5 9H4.5z"/><circle cx="7" cy="16" r="1" fill="currentColor"/><circle cx="12" cy="16" r="1" fill="currentColor"/></svg>,
  },
  {
    key: "dashboard",
    label: "Dashboard",
    sub: "Live metrics · trends",
    path: "/master/dashboard",
    color: "#a3e635",
    icon: <svg width="20" height="20" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 14l4-5 4 3 4-7"/><circle cx="14" cy="5" r="1" fill="currentColor"/></svg>,
  },
  {
    key: "onboarding",
    label: "How it works",
    sub: "Flow guide · setup",
    path: "/onboarding",
    color: "#fb923c",
    icon: <svg width="20" height="20" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="9" cy="5" r="2.5"/><path d="M4 15a5 5 0 0110 0"/><path d="M9 10v3M7.5 12h3"/></svg>,
  },
];

const [PRIMARY_ACTION, ...SECONDARY_ACTIONS] = QUICK_ACTIONS;

const FALLBACK_STATS = [
  { key: "collectedToday", label: "Collected today", value: "0", prefix: "₹", color: "#22d3ee" },
  { key: "billsGenerated", label: "Bills generated",  value: "0", prefix: "",  color: "#a3e635" },
  { key: "expiring30d",    label: "Expiring in 30d",  value: "0", prefix: "",  color: "#fb923c" },
  { key: "outstandingDues",label: "Outstanding dues", value: "0", prefix: "₹", color: "#ec4899" },
];

const FALLBACK_CHECKLIST = [
  { label: "Auto FIFO batches",        sub: "Oldest expiry sold first, always automatic", color: "#22d3ee" },
  { label: "Credit limit enforcement", sub: "Blocks a sale the instant a retailer's limit is hit", color: "#fb923c" },
  { label: "Nightly expiry scheduler", sub: "1 AM scan marks expired batches, emails alerts", color: "#a3e635" },
  { label: "GST-ready invoices",       sub: "HSN snapshot on every line, GSTR-1 ready", color: "#818cf8" },
  { label: "Batch recall trace",       sub: "One batch traces to every retailer who received it", color: "#ec4899" },
  { label: "Zero manual outstanding",  sub: "Every balance updates automatically, every action", color: "#facc15" },
];

const STAT_COLOR_BY_KEY = {
  collectedToday: "#22d3ee",
  billsGenerated: "#a3e635",
  expiring30d: "#fb923c",
  outstandingDues: "#ec4899",
};

export default function Home() {
  const navigate = useNavigate();
  const user = (() => { try { return JSON.parse(localStorage.getItem("vmsUser")) || {}; } catch { return {}; } })();
  const name = user?.data?.name || "Vendor";

  const [stats, setStats] = useState(FALLBACK_STATS);
  const [ticker, setTicker] = useState([]);
  const [checklist, setChecklist] = useState(FALLBACK_CHECKLIST);
  const [loadingStats, setLoadingStats] = useState(true);

  /* Ray palette, remembered per browser. */
  const [rayPreset, setRayPreset] = useState(() => {
    try {
      const saved = localStorage.getItem(PRESET_STORAGE_KEY);
      return RAY_PRESETS.some(p => p.key === saved) ? saved : DEFAULT_PRESET;
    } catch {
      return DEFAULT_PRESET;
    }
  });

  useEffect(() => {
    try { localStorage.setItem(PRESET_STORAGE_KEY, rayPreset); } catch { /* private mode */ }
  }, [rayPreset]);

  useEffect(() => {
    apiClient(`${API_BASE_URL}/api/Vendor/GetUserRoleId`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })
      .then(r => r.json())
      .then(d => { if (d.status === 200) localStorage.setItem("roleId", d.data); })
      .catch(() => {});
  }, []);

  /* ── Live dashboard summary: collections, bills, expiry, dues ── */
  const fetchSummary = useCallback(() => {
    apiClient(`${API_BASE_URL}/api/Dashboard/GetHomeSummary`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })
      .then(r => r.json())
      .then(d => {
        if (d?.status === 200 && d.data) {
          const next = FALLBACK_STATS.map(s => ({
            ...s,
            color: STAT_COLOR_BY_KEY[s.key] || s.color,
            value: d.data[s.key] != null ? String(d.data[s.key]) : s.value,
          }));
          setStats(next);
        }
      })
      .catch(() => {
        /* keep last-known stats on transient failure */
      })
      .finally(() => setLoadingStats(false));
  }, []);

  /* ── Live activity ticker ── */
  const fetchTicker = useCallback(() => {
    apiClient(`${API_BASE_URL}/api/Dashboard/GetActivityFeed`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })
      .then(r => r.json())
      .then(d => {
        if (d?.status === 200 && Array.isArray(d.data) && d.data.length) {
          setTicker(d.data.map(item => item.message || item));
        }
      })
      .catch(() => {
        /* keep last-known ticker on transient failure */
      });
  }, []);

  useEffect(() => {
    fetchSummary();
    fetchTicker();

    // Keep the dashboard live: re-pull every 60s without a full page reload.
    const statsId = setInterval(fetchSummary, 60000);
    const tickerId = setInterval(fetchTicker, 45000);
    return () => {
      clearInterval(statsId);
      clearInterval(tickerId);
    };
  }, [fetchSummary, fetchTicker]);

  const tickerItems = ticker.length ? ticker : [
    "Live activity will appear here once today's first action is logged",
  ];

  return (
    <>
      <AuroraBackground />
      <div className="hc-page">

        <header className="hc-nav">
          <span className="hc-nav-mark">VMS</span>
          <div className="hc-nav-right">
            <span className="hc-live"><span className="hc-live-dot" />Live</span>
            <span className="hc-clock">
              <AnalogWatch />
              <LiveClock />
            </span>
          </div>
        </header>

        <section className="hc-hero">
          <h1 className="hc-hero-title">
            Namaste, {name}.
          </h1>
          <p className="hc-hero-sub">Here's your pulse today.</p>

          <div className="hc-hero-actions">
            <button className="hc-btn-primary" onClick={() => navigate(PRIMARY_ACTION.path)}>
              {PRIMARY_ACTION.label}
            </button>
            {SECONDARY_ACTIONS.map(a => (
              <button key={a.key} className="hc-btn-link" onClick={() => navigate(a.path)}>
                {a.label}
              </button>
            ))}
          </div>
        </section>

        <section className="hc-stats" aria-label="Today's summary">
          {stats.map((s) => (
            <div key={s.key} className="hc-stat" style={{ "--stat-color": s.color }}>
              <span className="hc-stat-val">
                {loadingStats ? "—" : <CountUp target={s.value} prefix={s.prefix} />}
              </span>
              <span className="hc-stat-lbl">{s.label}</span>
            </div>
          ))}
        </section>

        <div className="hc-ticker">
          <div className="hc-ticker-track">
            {[...tickerItems, ...tickerItems].map((t, i) => (
              <span key={i} className="hc-ticker-item">{t}</span>
            ))}
          </div>
        </div>

        <section className="hc-section">
          <h2 className="hc-section-title">Open a module</h2>
          <div className="hc-module-grid">
            {MODULES.map(m => (
              <div
                key={m.key}
                className="hc-module-tile"
                style={{ "--tint": m.to }}
                onClick={() => navigate(m.path)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === "Enter" && navigate(m.path)}
              >
                <span className="hc-module-icon">{ICONS[m.key]}</span>
                <span className="hc-module-label">{m.label}</span>
                <span className="hc-module-hint">{m.hint}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Ray band ──
            Colour is picked in-panel and remembered in localStorage.
            density: 0.6 on low-end phones, 1.4 for a denser fan.
            Move this <section> anywhere in the page; it owns its own box. */}
        <section className="hc-section">
          <h2 className="hc-section-title">One entry, every trail</h2>
          <RayField
            preset={rayPreset}
            presets={RAY_PRESETS}
            onPresetChange={setRayPreset}
            density={1}
          >
            <span className="hc-rayband-eyebrow">Move your cursor across it</span>
            <p className="hc-rayband-line">
              A single bill fans out — batch, retailer ledger, outstanding, GSTR-1 —
              in one pass, with nothing to re-enter.
            </p>
          </RayField>
        </section>

        <section className="hc-section">
          <h2 className="hc-section-title">Why it runs itself</h2>
          <div className="hc-feature-list">
            {checklist.map((f, i) => (
              <div key={i} className="hc-feature-row">
                <span className="hc-feature-check" style={{ "--check-color": f.color }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6.2l2.6 2.6L10 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
                <div>
                  <span className="hc-feature-label">{f.label}</span>
                  <span className="hc-feature-sub">{f.sub}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="hc-closing">
          <h2>Ready to close today's register?</h2>
          <p>First bill in under 30 minutes. One owner, zero complexity.</p>
          <button className="hc-btn-primary hc-btn-large" onClick={() => navigate(PRIMARY_ACTION.path)}>
            Start billing
          </button>
        </section>

      </div>
    </>
  );
}