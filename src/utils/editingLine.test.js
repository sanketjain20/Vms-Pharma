import { takeLine, putBack, switchEdit, editRateOf, keptOnEdit } from "./editingLine";

const A = { lineKey: 1, productId: 1, productName: "A" };
const B = { lineKey: 2, productId: 2, productName: "B" };
const C = { lineKey: 3, productId: 3, productName: "C" };

describe("a line being edited leaves the table and goes back to its place", () => {
  it("takes it out and puts it back where it was", () => {
    const { lines, editing } = takeLine([A, B, C], 1);
    expect(lines).toEqual([A, C]);
    expect(editing).toEqual({ line: B, index: 1 });
    expect(putBack(lines, editing)).toEqual([A, B, C]); // Cancel edit: as it was
    expect(putBack(lines, editing, { ...B, quantity: 5 })).toEqual([A, { ...B, quantity: 5 }, C]); // Update Item: changed
  });

  it("goes to the end if the table got shorter meanwhile", () => {
    const { editing } = takeLine([A, B, C], 2);
    expect(putBack([A], editing)).toEqual([A, C]);
  });

  it("editing another line first puts the one in the form back", () => {
    const first = takeLine([A, B, C], 0); // A in the form; the table shows [B, C]
    const next = switchEdit(first.lines, first.editing, 1); // the clerk picks C (position 1 on screen)
    expect(next.editing.line).toBe(C);
    expect(next.lines).toEqual([A, B]);
    const back = switchEdit(takeLine([A, B, C], 2).lines, { line: C, index: 2 }, 0); // C in the form, picks A
    expect(back.editing.line).toBe(A);
    expect(back.lines).toEqual([B, C]);
  });
});

describe("the GST of an edited line is a rate, so it follows the quantity", () => {
  it("is the product's rate, an override, or the common rate it was saved with", () => {
    expect(editRateOf({ productGstRate: 18, taxAmount: 999 })).toBe(18);
    expect(editRateOf({ productGstRate: 18, overrideRate: 5 })).toBe(5);
    expect(editRateOf({ commonGstRate: 12, taxAmount: 999 })).toBe(12);
  });

  it("from before product-wise GST, it is worked out from the line's own GST and snapped to a slab", () => {
    // 2 x 100 with Rs 24 GST = 12%; 3 x 33.33 with Rs 17.98 ≈ 18%
    expect(editRateOf({ sellingPrice: 100, quantity: 2, taxAmount: 24 })).toBe(12);
    expect(editRateOf({ sellingPrice: 33.33, quantity: 3, taxAmount: 17.98 })).toBe(18);
    expect(editRateOf({ sellingPrice: 0, quantity: 2, taxAmount: 0 })).toBe(0);
  });
});

describe("what an edit keeps", () => {
  const line = { lineKey: 9, productId: 1, schemeOff: true, overrideRate: 5, overrideReason: "Exempt buyer",
    sellingPrice: 90, listPrice: 100, priceOverrideReason: "Bargained", belowCostConfirmed: false };

  it("on the same product: its key, scheme choice, price change and GST override", () => {
    expect(keptOnEdit(line, 1)).toEqual({ lineKey: 9, schemeOff: true, overrideRate: 5, overrideReason: "Exempt buyer",
      sellingPrice: 90, listPrice: 100, priceOverrideReason: "Bargained", belowCostConfirmed: false });
    expect(keptOnEdit(line, "1").sellingPrice).toBe(90); // the form holds the id as text
  });

  it("switched to another product: only its key and scheme choice", () => {
    expect(keptOnEdit(line, 2)).toEqual({ lineKey: 9, schemeOff: true });
  });

  it("a plain line keeps nothing extra, and nothing is kept when no line is being edited", () => {
    expect(keptOnEdit({ lineKey: 4, productId: 1 }, 1)).toEqual({ lineKey: 4, schemeOff: false });
    expect(keptOnEdit(null, 1)).toEqual({});
  });
});
