import { normalizeSerial, parseSerials, repeatedSerials, serialProblem, tracksSerials, warrantyText } from "./serials";

describe("serial numbers (Phase 6) — the same rules as the server", () => {
  it("writes a serial down trimmed, without spaces, in upper case", () => {
    expect(normalizeSerial("  sn 001 ")).toBe("SN001");
    expect(normalizeSerial(null)).toBe("");
  });

  it("reads one per line, or separated by commas / semicolons, from typing, pasting or a scanner", () => {
    expect(parseSerials("a1\n a2 ,a3;;\n\n")).toEqual(["A1", "A2", "A3"]);
    expect(parseSerials("")).toEqual([]);
  });

  it("needs one per unit, none repeated, none too long", () => {
    expect(serialProblem(["A1", "A2"], 2)).toBe("");
    expect(serialProblem(["A1"], 3)).toBe("1 of 3 serial numbers entered");
    expect(serialProblem(["A1", "A1"], 2)).toBe("Entered more than once: A1");
    expect(serialProblem(["X".repeat(81)], 1)).toMatch(/Longer than 80/);
    expect(repeatedSerials(["A", "B", "A", "A"])).toEqual(["A"]);
  });

  it("knows a product that tracks serials and words a warranty date", () => {
    expect(tracksSerials({ trackSerial: true })).toBe(true);
    expect(tracksSerials({})).toBe(false);
    expect(tracksSerials(undefined)).toBe(false);
    expect(warrantyText("2027-10-22")).toBe("Warranty till 22-10-2027");
    expect(warrantyText(null)).toBe("");
  });
});
