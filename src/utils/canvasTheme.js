import { useEffect, useState } from "react";

export function isLightTheme() {
  return document.body.dataset.theme === "light";
}

/** Re-render canvas when user toggles theme */
export function useCanvasThemeKey() {
  const [themeKey, setThemeKey] = useState(
    () => document.body.dataset.theme || "dark"
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setThemeKey(document.body.dataset.theme || "dark");
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return themeKey;
}

export function getPerspectiveCanvasPalette() {
  const light = isLightTheme();
  return {
    background: light ? "#f4f7fb" : "#000000",
    gridColor: "#3b82f6",
    gridAlpha: light ? 0.12 : 0.04,
    vignetteInner: light ? "rgba(244,247,251,0)" : "rgba(0,0,0,0)",
    vignetteOuter: light ? "rgba(180,195,220,0.45)" : "rgba(0,0,0,0.65)",
    orbAlphaScale: light ? 2.4 : 1,
  };
}

/**
 * Shared 3D perspective grid + orbs (same motion as dark mode, theme-aware colors).
 */
export function drawPerspectiveScene(ctx, canvas, tick, options = {}) {
  const {
    horizonRatio = 0.48,
    gridCount = 10,
    radialCount = 14,
    orbCount = 4,
    orbs,
    speed = 0.2,
    gridWidthMult = 1.3,
    radialWidthMult = 0.65,
  } = options;

  const palette = getPerspectiveCanvasPalette();
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, width, height);

  const horizon = height * horizonRatio;
  const vanishX = width / 2;
  const gridSpeed = (tick * speed) % (height / gridCount);

  ctx.save();
  ctx.globalAlpha = palette.gridAlpha;
  ctx.strokeStyle = palette.gridColor;
  ctx.lineWidth = 0.5;

  for (let i = 0; i <= gridCount; i++) {
    const y = horizon + gridSpeed + (i * (height - horizon)) / gridCount;
    if (y > height) continue;
    const spread = ((y - horizon) / (height - horizon)) * width * gridWidthMult;
    ctx.beginPath();
    ctx.moveTo(vanishX - spread / 2, y);
    ctx.lineTo(vanishX + spread / 2, y);
    ctx.stroke();
  }

  for (let i = 0; i <= radialCount; i++) {
    const t = i / radialCount;
    const bx = vanishX - width * radialWidthMult + t * width * (radialWidthMult * 2);
    ctx.beginPath();
    ctx.moveTo(vanishX, horizon);
    ctx.lineTo(bx, height + 10);
    ctx.stroke();
  }
  ctx.restore();

  const orbList =
    orbs ||
    Array.from({ length: orbCount }, (_, i) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: 80 + Math.random() * 160,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      hue: [215, 225, 230, 210][i % 4],
      alpha: (0.018 + Math.random() * 0.022) * palette.orbAlphaScale,
    }));

  orbList.forEach((o) => {
    o.x += o.vx;
    o.y += o.vy;
    if (o.x < -o.r) o.x = width + o.r;
    if (o.x > width + o.r) o.x = -o.r;
    if (o.y < -o.r) o.y = height + o.r;
    if (o.y > height + o.r) o.y = -o.r;

    const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
    g.addColorStop(0, `hsla(${o.hue},75%,${isLightTheme() ? 45 : 55}%,${o.alpha})`);
    g.addColorStop(1, "transparent");
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  });

  const vig = ctx.createRadialGradient(
    width / 2,
    height / 2,
    height * 0.1,
    width / 2,
    height / 2,
    height * 0.9
  );
  vig.addColorStop(0, palette.vignetteInner);
  vig.addColorStop(1, palette.vignetteOuter);
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, width, height);

  return orbList;
}

export function getChartTheme() {
  const light = isLightTheme();
  return {
    shellBg: light ? "rgba(255, 255, 255, 0.55)" : "rgba(4, 5, 10, 0.85)",
    shellBorder: light
      ? "1px solid rgba(15, 23, 42, 0.1)"
      : "1px solid rgba(255, 255, 255, 0.05)",
    gridStroke: light ? "rgba(15, 23, 42, 0.1)" : "rgba(255, 255, 255, 0.04)",
    tickFill: light ? "#64748b" : "#383a4d",
    emptyColor: light ? "#94a3b8" : "rgba(80, 90, 110, 0.8)",
    legendBorder: light ? "rgba(15, 23, 42, 0.08)" : "rgba(255, 255, 255, 0.05)",
    tooltipBg: light ? "rgba(255, 255, 255, 0.98)" : "rgba(5, 6, 14, 0.98)",
    tooltipBorder: light
      ? "1px solid rgba(37, 99, 235, 0.25)"
      : "1px solid rgba(59, 130, 246, 0.35)",
    tooltipLabel: light ? "#64748b" : "#525667",
    tooltipValue: light ? "#0f172a" : "#e6e8f0",
    tooltipMuted: light ? "#94a3b8" : "#6b7280",
  };
}

export function createOrbField(count, width, height, hues, palette) {
  return Array.from({ length: count }, (_, i) => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: 80 + Math.random() * 160,
    vx: (Math.random() - 0.5) * 0.18,
    vy: (Math.random() - 0.5) * 0.18,
    hue: hues[i % hues.length],
    alpha: (0.018 + Math.random() * 0.022) * palette.orbAlphaScale,
  }));
}
