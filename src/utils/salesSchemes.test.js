import {
  computeTotals, toItemPayload, linesFromSale, snapRate, withScheme, removeScheme, fetchApplicable, freeText, round2,
} from "./salesSchemes";
import apiClient from "../Config/apiClient";

jest.mock("../Config/apiClient", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("../Config/api.config", () => ({ __esModule: true, default: "http://api" }));

const line = (o = {}) => ({ productId: 1, productName: "Paracetamol", quantity: 10, sellingPrice: 100, taxAmount: 0, ...o });

describe("computeTotals", () => {
  it("Buy 10 Get 1 at 100: pays for 10, 1 is free, charged 1,000", () => {
    const t = computeTotals({ lines: [line({ freeQuantity: 1 })] });
    expect(t.gross).toBe(1000);
    expect(t.net).toBe(1000);
    expect(t.freeUnits).toBe(1);
    expect(t.totalDiscount).toBe(0);
  });

  it("1,000 with 10% off: discount 100, taxable 900", () => {
    const t = computeTotals({ lines: [line({ quantity: 1, sellingPrice: 1000, schemeDiscount: 100 })] });
    expect(t.schemeDiscount).toBe(100);
    expect(t.taxable).toBe(900);
    expect(t.net).toBe(900);
  });

  it("charges GST on the discounted value (12% on 900 = 108)", () => {
    const t = computeTotals({ lines: [line({ quantity: 1, sellingPrice: 1000, taxAmount: 120, schemeDiscount: 100 })] });
    expect(t.tax).toBe(108);
    expect(t.net).toBe(1008);
  });

  it("with no scheme and no discount it is the plain total it always was", () => {
    const t = computeTotals({ lines: [line({ quantity: 3, sellingPrice: 50, taxAmount: 27 }), line({ quantity: 2, sellingPrice: 10, taxAmount: 1 })] });
    expect(t.gross).toBe(170);
    expect(t.tax).toBe(28);
    expect(t.net).toBe(198);
  });

  it("a flat invoice discount is shared by value, and GST follows it", () => {
    // 1,000 + 500 at 18%; 150 off -> 100 / 50 shares
    const t = computeTotals({
      lines: [line({ quantity: 10, sellingPrice: 100, taxAmount: 180 }), line({ productId: 2, quantity: 5, sellingPrice: 100, taxAmount: 90 })],
      manualDiscount: 150, discountType: "FLAT",
    });
    expect(t.manualDiscount).toBe(150);
    expect(t.taxable).toBe(1350);
    expect(t.tax).toBe(243);
    expect(t.net).toBe(1593);
  });

  it("a percent invoice discount is taken on the value AFTER schemes", () => {
    const t = computeTotals({ lines: [line({ quantity: 1, sellingPrice: 1000, schemeDiscount: 100 })], manualDiscount: 10, discountType: "PERCENT" });
    expect(t.manualDiscount).toBe(90); // 10% of 900, not of 1,000
    expect(t.totalDiscount).toBe(190);
    expect(t.net).toBe(810);
  });

  it("a scheme and an invoice discount together", () => {
    const t = computeTotals({ lines: [line({ quantity: 1, sellingPrice: 1000, taxAmount: 120, schemeDiscount: 100 })], manualDiscount: 50, discountType: "FLAT" });
    expect(t.taxable).toBe(850);
    expect(t.tax).toBe(102);
    expect(t.net).toBe(952);
  });

  it("flags a discount larger than the goods are worth", () => {
    expect(computeTotals({ lines: [line()], manualDiscount: 1000.01, discountType: "FLAT" }).discountTooLarge).toBe(true);
    expect(computeTotals({ lines: [line()], manualDiscount: 1000, discountType: "FLAT" }).discountTooLarge).toBe(false);
  });

  it("Common GST uses one rate for every line, whatever tax each line was added with", () => {
    const t = computeTotals({ lines: [line({ taxAmount: 0 })], commonRate: 18 });
    expect(t.tax).toBe(180);
    expect(t.lines[0].clientTax).toBe(180);
  });

  it("copes with an empty bill and with junk input", () => {
    const t = computeTotals({ lines: [], manualDiscount: "abc" });
    expect(t.net).toBe(0);
    expect(t.discountTooLarge).toBe(false);
  });

  it("a fully discounted line pays no tax and does not divide by zero", () => {
    const t = computeTotals({ lines: [line({ quantity: 1, sellingPrice: 100, taxAmount: 18, schemeDiscount: 100 })] });
    expect(t.net).toBe(0);
  });

  it("figures are whole paise, so Amount Paid can equal the payable exactly", () => {
    const t = computeTotals({ lines: [line({ quantity: 3, sellingPrice: 33.33, taxAmount: 12.0 })], manualDiscount: 7, discountType: "PERCENT" });
    [t.gross, t.tax, t.net, t.taxable, t.manualDiscount].forEach((v) => expect(v).toBe(round2(v)));
  });
});

describe("toItemPayload", () => {
  it("sends the tax the totals used and the kept scheme, never an amount for the free units", () => {
    const lines = [line({ schemeId: 7, freeQuantity: 1, batchId: 5 })];
    const totals = computeTotals({ lines, commonRate: 12 });
    expect(toItemPayload(lines, totals)).toEqual([
      { productId: 1, quantity: 10, sellingPrice: 100, taxAmount: 120, batchId: 5, schemeId: 7 },
    ]);
  });

  it("a line without a scheme sends none (the server then applies none)", () => {
    const lines = [line()];
    expect(toItemPayload(lines, computeTotals({ lines }))[0].schemeId).toBeNull();
  });
});

describe("scheme helpers", () => {
  it("withScheme copies the suggestion onto a line and null clears it", () => {
    const s = withScheme(line(), { schemeId: 3, name: "B10G1", description: "Buy 10 Get 1", freeQuantity: 1, discountAmount: 0 });
    expect(s).toMatchObject({ schemeId: 3, schemeName: "B10G1", freeQuantity: 1, schemeDiscount: 0, schemeOff: false });
    expect(withScheme(s, null)).toMatchObject({ schemeId: null, freeQuantity: 0, schemeDiscount: 0 });
  });

  it("removeScheme marks the line so a later suggestion leaves it alone", () => {
    const s = removeScheme(withScheme(line(), { schemeId: 3, name: "x", description: "d", freeQuantity: 1, discountAmount: 5 }));
    expect(s).toMatchObject({ schemeId: null, freeQuantity: 0, schemeDiscount: 0, schemeOff: true });
  });

  it("freeText", () => {
    expect(freeText({ freeQuantity: 2 })).toBe("+ 2 free");
    expect(freeText({ freeQuantity: 0 })).toBe("");
    expect(freeText({})).toBe("");
  });
});

describe("fetchApplicable", () => {
  beforeEach(() => apiClient.mockReset());

  it("returns the suggestion and sends the retailer only when there is one", async () => {
    apiClient.mockResolvedValue({ json: async () => ({ status: 200, data: { schemeId: 1 } }) });
    expect(await fetchApplicable({ productId: 4, retailerId: 9, quantity: 10, unitPrice: 100 })).toEqual({ schemeId: 1 });
    expect(apiClient.mock.calls[0][0]).toBe("http://api/api/Scheme/Applicable?productId=4&quantity=10&unitPrice=100&retailerId=9");
    await fetchApplicable({ productId: 4, retailerId: "", quantity: 10, unitPrice: 100 });
    expect(apiClient.mock.calls[1][0]).not.toContain("retailerId");
  });

  it("is null when nothing applies or the call fails", async () => {
    apiClient.mockResolvedValueOnce({ json: async () => ({ status: 200, data: null }) });
    expect(await fetchApplicable({ productId: 4, quantity: 1, unitPrice: 1 })).toBeNull();
    apiClient.mockRejectedValueOnce(new Error("down"));
    expect(await fetchApplicable({ productId: 4, quantity: 1, unitPrice: 1 })).toBeNull();
    apiClient.mockResolvedValueOnce({ json: async () => ({ status: 500, message: "x" }) });
    expect(await fetchApplicable({ productId: 4, quantity: 1, unitPrice: 1 })).toBeNull();
  });
});

describe("snapRate", () => {
  it("snaps a rate worked out from rounded money to the GST slab", () => {
    expect(snapRate(17.98)).toBe(18);
    expect(snapRate(12.2)).toBe(12);
    expect(snapRate(0)).toBe(0);
  });
  it("leaves a rate that is not near a slab", () => {
    expect(snapRate(9.5)).toBe(9.5);
  });
});

describe("linesFromSale (opening a saved sale for edit)", () => {
  const row = (o) => ({ productId: 1, product: "Paracetamol", quantity: 10, sellingPrice: 100, taxAmount: 0, discountAmount: 0, freeItem: false, batchId: 5, ...o });

  it("drops free rows, keeps their count on the paid line, and lists them no more", () => {
    const lines = linesFromSale([
      row({ schemeId: 5, schemeNameSnapshot: "B10G1" }),
      row({ schemeId: 5, schemeNameSnapshot: "B10G1", quantity: 1, sellingPrice: 0, freeItem: true }),
    ], 0, 0);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ quantity: 10, freeQuantity: 1, schemeId: 5 });
  });

  it("merges the batch slices of one scheme line so the scheme is judged on the whole quantity", () => {
    const lines = linesFromSale([
      row({ quantity: 7, schemeId: 5, taxAmount: 71.4, discountAmount: 105, batchId: 1 }),
      row({ quantity: 3, schemeId: 5, taxAmount: 30.6, discountAmount: 45, batchId: 2 }),
    ], 50, 100);
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(10);
    expect(lines[0].schemeDiscount).toBe(100); // 150 stored less the 50 invoice discount's share
    expect(lines[0].taxAmount).toBe(120);      // 12% restated on the full 1,000, which is what the server reads the rate from
  });

  it("restating the tax round-trips to the same totals the sale was saved with", () => {
    const lines = linesFromSale([row({ schemeId: 5, taxAmount: 102, discountAmount: 150 })], 50, 100);
    const t = computeTotals({ lines, manualDiscount: 50, discountType: "FLAT" });
    expect(t.net).toBe(952);
    expect(t.tax).toBe(102);
  });

  it("does not merge different products or rows without a scheme", () => {
    const lines = linesFromSale([row({ productId: 1 }), row({ productId: 1, batchId: 6 }), row({ productId: 2, schemeId: 5 }), row({ productId: 3, schemeId: 5 })], 0, 0);
    expect(lines).toHaveLength(4);
  });

  it("a sale from before schemes: the invoice discount is shared by value to recover each line's GST rate", () => {
    // 1,000 at 18% with 100 off: tax was charged on 900 = 162
    const lines = linesFromSale([row({ taxAmount: 162, discountAmount: 0 })], 100, 0);
    expect(lines[0].taxAmount).toBe(180);
    expect(lines[0].schemeId).toBeNull();
    expect(computeTotals({ lines, manualDiscount: 100, discountType: "FLAT" }).net).toBe(1062);
  });

  it("an untaxed sale stays untaxed", () => {
    expect(linesFromSale([row({})], 0, 0)[0].taxAmount).toBe(0);
  });

  it("a discount that wipes out the line does not divide by zero", () => {
    const lines = linesFromSale([row({ schemeId: 5, discountAmount: 1000 })], 0, 1000);
    expect(lines[0].taxAmount).toBe(0);
    expect(lines[0].schemeDiscount).toBe(1000);
  });
});

describe("returnValue", () => {
  const { returnValue } = require("./salesSchemes");

  it("is price x quantity for a row sold without a discount, as it always was", () => {
    expect(returnValue({ sellingPrice: 100, discountAmount: 0, max: 10 }, 3)).toBe(300);
    expect(returnValue({ sellingPrice: 100, max: 10 }, 3)).toBe(300);
  });

  it("is net of the discount the units were sold with", () => {
    // 10 units at 100 sold with a 150 discount: each unit was really 85
    expect(returnValue({ sellingPrice: 100, discountAmount: 150, max: 10 }, 4)).toBe(340);
    expect(returnValue({ sellingPrice: 100, discountAmount: 150, max: 10 }, 10)).toBe(850);
  });

  it("a free row refunds nothing", () => {
    expect(returnValue({ sellingPrice: 0, discountAmount: 0, max: 1 }, 1)).toBe(0);
  });

  it("copes with a row of zero quantity", () => {
    expect(returnValue({ sellingPrice: 100, discountAmount: 10, max: 0 }, 0)).toBe(0);
  });
});
