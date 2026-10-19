import { useEffect, useState } from "react";
import * as THREE from "three";

/* The app's theme lives on <body data-theme="light|dark"> (App.js). */
export const readTheme = () => (document.body.getAttribute("data-theme") === "light" ? "light" : "dark");

/* ── One WebGL scene, owned by a host <div> ──
   build({ THREE, renderer, scene, camera, pointer, theme }) sets the scene up and may
   return { update(t, dt), resize(w, h), setTheme(theme), dispose(), stillTime }.

   - setTheme is called once after build and again whenever the app theme flips.

   - Sized to the host (ResizeObserver), pixel ratio capped.
   - Only renders while the host is on screen and the tab is visible.
   - prefers-reduced-motion: one still frame at `stillTime`, no loop.
   - pointer.x / pointer.y: −1..1 across the host, eased; 0 when the pointer is away.
   - No WebGL (old GPU, blocked, jsdom): returns "failed" so the caller can show a fallback.
   - Everything is disposed on unmount, including the GL context.

   Returns "loading" | "ready" (first frame drawn) | "failed". */
export default function useThreeScene(hostRef, build, { fov = 35, maxPixelRatio = 1.75, shadows = true } = {}) {
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      setStatus("failed");
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setClearColor(0x000000, 0);
    if (shadows) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    const canvas = renderer.domElement;
    canvas.className = "hc-scene-canvas";
    canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 200);
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

    let theme = readTheme();
    let api;
    try {
      api = build({ THREE, renderer, scene, camera, pointer, theme }) || {};
      api.setTheme?.(theme);
    } catch {
      renderer.dispose();
      canvas.remove();
      setStatus("failed");
      return undefined;
    }

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    let raf = null;
    let visible = true;
    let last = performance.now();
    let elapsed = 0;
    let drawn = false;

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      api.resize?.(w, h);
    };

    const draw = (dt) => {
      const ease = Math.min(1, dt * 3);
      pointer.x += (pointer.tx - pointer.x) * ease;
      pointer.y += (pointer.ty - pointer.y) * ease;
      api.update?.(elapsed, dt);
      renderer.render(scene, camera);
      if (!drawn) { drawn = true; setStatus("ready"); }
    };

    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      elapsed += dt;
      draw(dt);
      raf = requestAnimationFrame(frame);
    };
    const stop = () => { if (raf) cancelAnimationFrame(raf); raf = null; };
    const start = () => {
      if (raf || !visible || document.hidden || reduce?.matches) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const still = () => {
      if (api.stillTime != null) elapsed = api.stillTime;
      draw(0);
    };

    resize();
    still();
    start();

    const ro = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => { resize(); if (!raf) still(); })
      : null;
    ro?.observe(host);

    const io = typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; visible ? start() : stop(); }, { rootMargin: "100px" })
      : null;
    io?.observe(host);

    // the host usually sits under page content, so listen on the window and map into its box
    const onPointer = (e) => {
      const r = host.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      pointer.tx = inside ? ((e.clientX - r.left) / r.width) * 2 - 1 : 0;
      pointer.ty = inside ? -(((e.clientY - r.top) / r.height) * 2 - 1) : 0;
    };
    const themeWatch = typeof MutationObserver !== "undefined"
      ? new MutationObserver(() => {
          const next = readTheme();
          if (next === theme) return;
          theme = next;
          api.setTheme?.(theme);
          if (!raf) draw(0);          // paused or reduced motion: repaint once in the new colours
        })
      : null;
    themeWatch?.observe(document.body, { attributes: true, attributeFilter: ["data-theme"] });

    const onVisibility = () => (document.hidden ? stop() : start());
    const onMotion = () => { stop(); still(); start(); };

    window.addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    reduce?.addEventListener?.("change", onMotion);

    return () => {
      stop();
      ro?.disconnect();
      io?.disconnect();
      themeWatch?.disconnect();
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVisibility);
      reduce?.removeEventListener?.("change", onMotion);
      api.dispose?.();
      scene.traverse((obj) => {
        obj.geometry?.dispose?.();
        const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
        mats.forEach((m) => {
          Object.values(m).forEach((v) => { if (v && v.isTexture) v.dispose(); });
          m.dispose?.();
        });
      });
      scene.environment?.dispose?.();
      renderer.dispose();
      renderer.forceContextLoss?.();
      canvas.remove();
    };
    // the scene is built once per mount; build/options are fixed by the caller
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return status;
}
