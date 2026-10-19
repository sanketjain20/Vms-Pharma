import { BELTS, BELT_SPAN, parcelX, parcelSize, scanPulse, coinState } from "./stockFlow";

const [IN, OUT] = BELTS;

describe("stock flow", () => {
  it("has a stock-in belt moving right and a sales belt moving left", () => {
    expect(IN.key).toBe("in");
    expect(IN.dir).toBe(1);
    expect(OUT.key).toBe("out");
    expect(OUT.dir).toBe(-1);
  });

  it("parcels stay on the belt and move in the belt's direction", () => {
    [IN, OUT].forEach((belt) => {
      for (let i = 0; i < belt.count; i++) {
        for (let t = 0; t < 40; t += 0.37) {
          const x = parcelX(belt, i, t);
          expect(Math.abs(x)).toBeLessThanOrEqual(BELT_SPAN / 2 + 1e-9);
        }
        const a = parcelX(belt, i, 1);
        const b = parcelX(belt, i, 1.1);
        // it moved speed × dt in dir (or that, less one full lap if it just wrapped round)
        const off = (b - a) - belt.dir * belt.speed * 0.1;
        expect(Math.min(Math.abs(off), Math.abs(Math.abs(off) - BELT_SPAN))).toBeLessThan(1e-6);
      }
    });
  });

  it("parcels on a belt are evenly spaced", () => {
    const xs = Array.from({ length: IN.count }, (_, i) => parcelX(IN, i, 3)).sort((a, b) => a - b);
    const gaps = xs.slice(1).map((x, i) => x - xs[i]);
    gaps.forEach((g) => expect(g).toBeCloseTo(BELT_SPAN / IN.count, 6));
  });

  it("parcel sizes vary but are deterministic and sensible", () => {
    const sizes = Array.from({ length: 20 }, (_, i) => parcelSize(i));
    expect(parcelSize(7)).toEqual(parcelSize(7));
    expect(new Set(sizes.map((s) => s.join())).size).toBeGreaterThan(10);
    sizes.forEach(([w, h, d]) => {
      expect(w).toBeGreaterThanOrEqual(0.7); expect(w).toBeLessThanOrEqual(1.2 + 1e-9);
      expect(h).toBeGreaterThanOrEqual(0.45); expect(h).toBeLessThanOrEqual(0.85 + 1e-9);
      expect(d).toBeGreaterThanOrEqual(0.6); expect(d).toBeLessThanOrEqual(0.95 + 1e-9);
    });
  });

  it("the scanner glows fully as a parcel passes under it and is dark otherwise", () => {
    expect(scanPulse([5, 0, -7], 0)).toBe(1);
    expect(scanPulse([0.45], 0, 0.9)).toBeCloseTo(0.5, 6);
    expect(scanPulse([3, -4], 0)).toBe(0);
    expect(scanPulse([], 0)).toBe(0);
  });

  it("coins rise and fade in then out over their cycle", () => {
    const period = 3.2;
    const start = coinState(0, 0, 6, period);
    const mid = coinState(0, period / 2, 6, period);
    expect(start.opacity).toBeCloseTo(0, 6);
    expect(mid.opacity).toBeCloseTo(1, 6);
    expect(mid.y).toBeGreaterThan(start.y);
    // staggered: coin 3 of 6 is half a cycle ahead of coin 0
    expect(coinState(3, 0, 6, period).y).toBeCloseTo(mid.y, 6);
  });
});
