/* The hero's "stock flow", as plain maths — no three.js, so it can be tested alone.

   Two conveyor belts cross the floor:
     • the front belt carries stock IN (purchase → inventory), left to right;
     • the back belt carries goods OUT (sale), right to left.
   Each belt has a scanner arch at x = 0 that flashes as a parcel passes, and
   every sale that clears the back scanner sends a ₹ coin floating up. */

export const BELT_SPAN = 30;   // parcels wrap around after travelling this far (well past the fog)

export const BELTS = [
  { key: "in",  z: 1.6,  dir: 1,  speed: 1.5, count: 9, color: "#22d3ee" },
  { key: "out", z: -1.8, dir: -1, speed: 1.15, count: 8, color: "#a3e635" },
];

const frac = (v) => v - Math.floor(v);

/** Parcel i's x on a belt at time t: evenly spaced, moving at belt.speed, wrapping over BELT_SPAN. */
export function parcelX(belt, i, t) {
  const gap = BELT_SPAN / belt.count;
  const travelled = frac((i * gap + t * belt.speed) / BELT_SPAN) * BELT_SPAN;
  return belt.dir * (travelled - BELT_SPAN / 2);
}

/** Deterministic, varied box sizes so the line doesn't look cloned. [w, h, d] */
export function parcelSize(i) {
  const h = (i * 2654435761) >>> 0;             // integer hash
  const r = (n) => ((h >>> (n * 4)) & 15) / 15;  // 0..1 from different bits
  return [0.7 + 0.5 * r(0), 0.45 + 0.4 * r(1), 0.6 + 0.35 * r(2)];
}

/** 0..1 — how brightly a scanner at scannerX glows given the parcels' xs (peaks as one passes under it). */
export function scanPulse(xs, scannerX = 0, width = 0.9) {
  let best = 0;
  for (const x of xs) best = Math.max(best, 1 - Math.abs(x - scannerX) / width);
  return Math.max(0, best);
}

/** Coin i of `count`, rising from the sale scanner: height above the belt, opacity and spin. */
export function coinState(i, t, count = 6, period = 3.2) {
  const s = frac(t / period + i / count);
  return {
    y: 1.2 + s * 3.4,
    x: Math.sin(i * 1.7 + t * 0.6) * 0.5,
    opacity: Math.sin(Math.PI * s),
    spin: t * 2.2 + i,
  };
}
