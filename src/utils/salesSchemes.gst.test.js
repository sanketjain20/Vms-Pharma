import {
  computeTotals, toItemPayload, linesFromSale, lineGst, exclusiveOf, inclusiveOf, GST_RATES, gstSplit, gstTag,
} from "./salesSchemes";

jest.mock("../Config/apiClient", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("../Config/api.config", () => ({ __esModule: true, default: "http://api" }));

const line = (o = {}) => ({ productId: 1, productName: "Shirt", quantity: 1, sellingPrice: 100, taxAmount: 0, ...o });

describe("product-wise GST maths (mirrors the server)", () => {
  it("lists the same rates the server allows", () => {
    expect(GST_RATES).toEqual([0, 0.25, 3, 5, 12, 18, 28, 40]);
  });

  it("backs GST out of a tag price to 4 decimals and adds it back to the paisa", () => {
    expect(exclusiveOf(100, 18)).toBe(84.7458);
    expect(inclusiveOf(84.7458, 18)).toBe(100);
    [1, 9.99, 499, 1299].forEach((p) => GST_RATES.forEach((r) => expect(inclusiveOf(exclusiveOf(p, r), r)).toBe(p)));
  });

  it("decides each line's rate: custom, override, product, then the common rate", () => {
    expect(lineGst({ custom: true, gstRate: 5 }, 18)).toEqual({ rate: 5, source: "CUSTOM" });
    expect(lineGst({ productGstRate: 12, overrideRate: 5 }, 18)).toEqual({ rate: 5, source: "OVERRIDE" });
    expect(lineGst({ productGstRate: 12 }, 18)).toEqual({ rate: 12, source: "PRODUCT" });
    expect(lineGst({ productGstRate: null }, 18)).toEqual({ rate: 18, source: "COMMON" });
    expect(lineGst({ commonGstRate: 5 }, 18)).toEqual({ rate: 5, source: "COMMON" });
    expect(lineGst({}, null)).toEqual({ rate: null, source: "COMMON" });
  });

  it("charges a product its own rate even when the common rate is different", () => {
    const t = computeTotals({ lines: [line({ quantity: 10, productGstRate: 12 })], commonRate: 18 });
    expect(t.tax).toBe(120);
    expect(t.lines[0].gstSource).toBe("PRODUCT");
  });

  it("an inclusive 100 at 18% is 84.75 + 15.25 = 100", () => {
    const t = computeTotals({ lines: [line({ productGstRate: 18, priceIncludesGst: true })] });
    expect(t.gross).toBe(84.75);
    expect(t.tax).toBe(15.25);
    expect(t.net).toBe(100);
    expect(t.lines[0].inclusive).toBe(true);
  });

  it("an inclusive price with no rate known is treated as before (GST on top of its own tax)", () => {
    const t = computeTotals({ lines: [line({ priceIncludesGst: true, taxAmount: 18 })] });
    expect(t.gross).toBe(100);
    expect(t.tax).toBe(18);
    expect(t.lines[0].inclusive).toBe(false);
  });

  it("sends an override with its reason, the common rate of a product with none, and nothing for the product's own", () => {
    const lines = [
      line({ productId: 1, productGstRate: 18, overrideRate: 5, overrideReason: "Old stock" }),
      line({ productId: 2 }),
      line({ productId: 3, productGstRate: 12, priceIncludesGst: true }),
    ];
    const payload = toItemPayload(lines, computeTotals({ lines, commonRate: 18 }));
    expect(payload[0]).toMatchObject({ gstRate: 5, overrideReason: "Old stock", priceIncludesGst: false });
    expect(payload[1]).toMatchObject({ gstRate: 18, priceIncludesGst: false });
    expect(payload[1]).not.toHaveProperty("overrideReason");
    expect(payload[2]).toMatchObject({ gstRate: null, priceIncludesGst: true });
  });

  it("restores a saved inclusive line as its tag price and keeps where its rate came from", () => {
    const items = [
      { id: 1, productId: 1, product: "Shirt", quantity: 1, sellingPrice: 84.7458, taxAmount: 15.25, discountAmount: 0,
        gstRate: 18, gstSource: "PRODUCT", priceIncludesGst: true },
      { id: 2, productId: 2, product: "Jeans", quantity: 1, sellingPrice: 1000, taxAmount: 50, discountAmount: 0,
        gstRate: 5, gstSource: "OVERRIDE", gstOverrideReason: "Old stock", priceIncludesGst: false },
      { id: 3, productId: 3, product: "Cap", quantity: 1, sellingPrice: 200, taxAmount: 24, discountAmount: 0,
        gstRate: 12, gstSource: "COMMON", priceIncludesGst: false },
    ];
    const [shirt, jeans, cap] = linesFromSale(items, 0, 0);
    expect(shirt).toMatchObject({ sellingPrice: 100, priceIncludesGst: true, productGstRate: 18, overrideRate: null });
    expect(jeans).toMatchObject({ sellingPrice: 1000, overrideRate: 5, overrideReason: "Old stock", productGstRate: null });
    expect(cap).toMatchObject({ commonGstRate: 12, productGstRate: null });

    const t = computeTotals({ lines: [shirt, jeans, cap], commonRate: 18 });
    expect(t.lines.map((r) => r.gstRate)).toEqual([18, 5, 12]);
    expect(t.net).toBe(100 + 1050 + 224);
  });

  it("a sale saved before product-wise GST still has its rate worked out from its tax", () => {
    const [l] = linesFromSale([{ id: 1, productId: 1, product: "Old", quantity: 10, sellingPrice: 100, taxAmount: 120, discountAmount: 0 }], 0, 0);
    expect(l.taxAmount).toBe(120);
    expect(l.productGstRate).toBeNull();
    expect(l.commonGstRate).toBeNull();
  });

  it("splits the bill GST by rate for the totals", () => {
    const t = computeTotals({ lines: [
      line({ productId: 1, productGstRate: 18, priceIncludesGst: true }),
      line({ productId: 2, sellingPrice: 1000, productGstRate: 5 }),
      line({ productId: 3, sellingPrice: 200, productGstRate: 18 }),
    ] });
    expect(gstSplit(t)).toEqual([{ rate: 5, tax: 50 }, { rate: 18, tax: 51.25 }]);
    expect(gstSplit({ lines: [] })).toEqual([]);
  });

  it("says how a price stands with GST", () => {
    expect(gstTag(18, true)).toBe(" incl. 18% GST");
    expect(gstTag("5.00", false)).toBe(" + 5% GST");
    expect(gstTag(null, true)).toBe(" · GST not set");
  });

  it("a saved line keeps its serial numbers, so saving the bill unchanged sends them back", () => {
    const [l] = linesFromSale([{ id: 1, productId: 7, product: "Battery", quantity: 2, sellingPrice: 1000, taxAmount: 360,
      discountAmount: 0, gstRate: 18, gstSource: "PRODUCT", serials: ["BAT-1", "BAT-2"] }], 0, 0);
    expect(l.serials).toEqual(["BAT-1", "BAT-2"]);
    const [sent] = toItemPayload([l], computeTotals({ lines: [l] }));
    expect(sent.serials).toEqual(["BAT-1", "BAT-2"]);
  });
});
