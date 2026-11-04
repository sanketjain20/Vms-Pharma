import { effectiveCost, freeNote, receivedQty } from "./purchaseFree";

describe("free goods on a purchase line", () => {
  it("100 paid at ₹90 + 10 free: 110 into stock at ₹81.82 each", () => {
    expect(receivedQty(100, 10)).toBe(110);
    expect(effectiveCost(90, 100, 10)).toBe(81.82);
    expect(freeNote("90", "100", "10")).toBe("110 into stock at ₹81.82 each");
  });

  it("without free goods the rate is the cost and there is no note", () => {
    expect(effectiveCost(90, 100, "")).toBe(90);
    expect(receivedQty("5", undefined)).toBe(5);
    expect(freeNote(90, 100, 0)).toBe("");
    expect(freeNote(90, 100, "-3")).toBe(""); // a negative free quantity counts as none
  });

  it("works while the rate is still empty", () => {
    expect(effectiveCost("", 100, 10)).toBeNull();
    expect(freeNote("", 100, 10)).toBe("110 into stock");
  });
});
