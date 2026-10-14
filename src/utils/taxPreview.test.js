import { calculateTcsPreview, isValidPan, panFromGstin, partyHasPan } from "./taxPreview";

// Mirrors VMS2's Utils/TcsCalculatorTest.java scenario-for-scenario so the
// frontend preview and the backend's authoritative calculation can't drift
// apart unnoticed. Statutory defaults: threshold 50,00,000, rate 0.1% (with
// PAN), 1% (without).
const THRESHOLD = 5000000;
const RATE = 0.1;
const RATE_NO_PAN = 1;

describe("calculateTcsPreview", () => {
  it("is not taxable below the threshold", () => {
    const result = calculateTcsPreview({
      cumulativeBefore: 1000000, consideration: 500000,
      threshold: THRESHOLD, ratePercent: RATE, ratePercentWithoutPan: RATE_NO_PAN, hasPan: true,
    });
    expect(result.taxable).toBe(0);
    expect(result.tcs).toBe(0);
  });

  it("taxes only the excess on an invoice that straddles the threshold", () => {
    // Cumulative before = 48,00,000; this invoice = 5,00,000 -> crosses
    // 50,00,000 by 3,00,000, so only that excess is taxable.
    const result = calculateTcsPreview({
      cumulativeBefore: 4800000, consideration: 500000,
      threshold: THRESHOLD, ratePercent: RATE, ratePercentWithoutPan: RATE_NO_PAN, hasPan: true,
    });
    expect(result.taxable).toBe(300000);
    expect(result.rate).toBe(RATE);
    expect(result.tcs).toBe(300);
  });

  it("taxes the full invoice once the threshold was already crossed", () => {
    const result = calculateTcsPreview({
      cumulativeBefore: 6000000, consideration: 500000,
      threshold: THRESHOLD, ratePercent: RATE, ratePercentWithoutPan: RATE_NO_PAN, hasPan: true,
    });
    expect(result.taxable).toBe(500000);
    expect(result.tcs).toBe(500);
  });

  it("is not taxable when the cumulative lands exactly on the threshold", () => {
    const result = calculateTcsPreview({
      cumulativeBefore: 4500000, consideration: 500000,
      threshold: THRESHOLD, ratePercent: RATE, ratePercentWithoutPan: RATE_NO_PAN, hasPan: true,
    });
    expect(result.taxable).toBe(0);
    expect(result.tcs).toBe(0);
  });

  it("charges the higher no-PAN rate", () => {
    const result = calculateTcsPreview({
      cumulativeBefore: 6000000, consideration: 500000,
      threshold: THRESHOLD, ratePercent: RATE, ratePercentWithoutPan: RATE_NO_PAN, hasPan: false,
    });
    expect(result.rate).toBe(RATE_NO_PAN);
    expect(result.tcs).toBe(5000);
  });

  it("is never taxable for zero or negative consideration", () => {
    const zero = calculateTcsPreview({
      cumulativeBefore: 6000000, consideration: 0,
      threshold: THRESHOLD, ratePercent: RATE, ratePercentWithoutPan: RATE_NO_PAN, hasPan: true,
    });
    const negative = calculateTcsPreview({
      cumulativeBefore: 6000000, consideration: -100,
      threshold: THRESHOLD, ratePercent: RATE, ratePercentWithoutPan: RATE_NO_PAN, hasPan: true,
    });
    expect(zero.tcs).toBe(0);
    expect(negative.tcs).toBe(0);
  });

  it("treats missing inputs as zero instead of throwing", () => {
    const result = calculateTcsPreview({ consideration: 100, hasPan: true });
    expect(result.tcs).toBe(0);
  });
});

describe("isValidPan / panFromGstin / partyHasPan", () => {
  it("accepts a well-formed PAN, case-insensitively, and rejects malformed ones", () => {
    expect(isValidPan("ABCDE1234F")).toBe(true);
    expect(isValidPan("abcde1234f")).toBe(true);
    expect(isValidPan("ABCDE1234")).toBe(false);
    expect(isValidPan("")).toBe(false);
    expect(isValidPan(null)).toBe(false);
  });

  it("derives the PAN embedded in a 15-character GSTIN", () => {
    expect(panFromGstin("27AABCC1234A1Z5")).toBe("AABCC1234A");
    expect(panFromGstin("not-a-gstin")).toBeNull();
    expect(panFromGstin(null)).toBeNull();
  });

  it("treats a GSTIN-derived PAN as having a PAN even with no PAN field set", () => {
    expect(partyHasPan(null, "27AABCC1234A1Z5")).toBe(true);
    expect(partyHasPan("ABCDE1234F", null)).toBe(true);
    expect(partyHasPan(null, null)).toBe(false);
    expect(partyHasPan("", "invalid-gstin")).toBe(false);
  });
});
