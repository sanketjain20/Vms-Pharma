import {
  cleanValues, combos, findVariant, gridToPurchaseLines, groupCatalog, isVariant, priceRange, sortSizes, splitInput,
  stylesIn, variantAxes, variantKey, variantLabel,
} from "./variants";

const v = (id, size, color, extra = {}) => ({
  id, name: `Kurta - ${[size, color].filter(Boolean).join(" / ")}`, styleId: 7, styleName: "Kurta",
  variantSize: size, variantColor: color, price: 599, ...extra,
});

describe("variants (Phase 5)", () => {
  it("cleans size/colour lists like the server: trimmed, squeezed, no blanks, commas or repeats", () => {
    expect(cleanValues([" S ", "m", "", null, "s", "Sky   Blue", "sky blue", "x".repeat(31)])).toEqual(["S", "m", "Sky Blue"]);
    expect(splitInput("S, M ,L\nXL,,")).toEqual(["S", "M", "L", "XL"]);
    expect(cleanValues(undefined)).toEqual([]);
  });

  it("makes every size × colour pair, and allows one list to be empty", () => {
    expect(combos(["S", "M"], ["Blue"])).toEqual([{ size: "S", color: "Blue" }, { size: "M", color: "Blue" }]);
    expect(combos([], ["Red"])).toEqual([{ size: null, color: "Red" }]);
    expect(combos([], [])).toEqual([]);
  });

  it("keys pairs ignoring case and spaces", () => {
    expect(variantKey("M", "Blue")).toBe("m|blue");
    expect(variantKey(" m", "BLUE ")).toBe(variantKey("M", "blue"));
    expect(variantKey(null, "Red")).toBe("|red");
  });

  it("orders sizes as on a shop floor: letters, then numbers, then the rest", () => {
    expect(sortSizes(["XL", "S", "Free Size", "M", "32", "28", "XS"])).toEqual(["XS", "S", "M", "XL", "28", "32", "Free Size"]);
  });

  it("knows a variant and labels it", () => {
    expect(isVariant(v(1, "M", "Blue"))).toBe(true);
    expect(isVariant({ id: 2, styleId: null })).toBe(false);
    expect(isVariant(undefined)).toBe(false);
    expect(variantLabel(v(1, "M", "Blue"))).toBe("M / Blue");
    expect(variantLabel(v(1, null, "Blue"))).toBe("Blue");
  });

  it("groups a product list into one entry per style, where its first variant was", () => {
    const list = [{ id: 1, name: "Socks" }, v(2, "M", "Blue"), { id: 3, name: "Belt" }, v(4, "S", "Blue")];
    const entries = groupCatalog(list);
    expect(entries.map((e) => e.kind)).toEqual(["product", "style", "product"]);
    expect(entries[1]).toMatchObject({ styleId: 7, name: "Kurta" });
    expect(entries[1].variants.map((x) => x.id)).toEqual([2, 4]);
    expect(stylesIn(list)).toHaveLength(1);
  });

  it("falls back to the name before the dash when the style name is missing", () => {
    expect(groupCatalog([{ ...v(2, "M", "Blue"), styleName: null }])[0].name).toBe("Kurta");
  });

  it("lays out a style's sizes and colours and finds the variant of a pair", () => {
    const list = [v(1, "M", "Blue"), v(2, "S", "Blue"), v(3, "S", "Black")];
    expect(variantAxes(list)).toEqual({ sizes: ["S", "M"], colors: ["Blue", "Black"] });
    expect(findVariant(list, "s", "black").id).toBe(3);
    expect(findVariant(list, "M", "Black")).toBeUndefined();
  });

  it("shows a price or a price range", () => {
    expect(priceRange([599, 649, 0, null])).toBe("₹599 – ₹649");
    expect(priceRange([599, 599])).toBe("₹599");
    expect(priceRange([])).toBe("");
  });

  it("turns a quantity grid into one purchase line per variant with a quantity", () => {
    const list = [v(1, "S", "Blue"), v(2, "M", "Blue", { price: 649 }), v(3, "L", "Blue")];
    const lines = gridToPurchaseLines(list, { 1: "4", 2: "2", 3: "0" }, { costPrice: "300", mrp: "", gstRate: "5" });
    expect(lines).toEqual([
      expect.objectContaining({ productId: 1, quantity: 4, costPrice: "300", mrp: 599, gstRate: "5", expiryDate: "" }),
      expect.objectContaining({ productId: 2, quantity: 2, mrp: 649 }),
    ]);
    const shared = gridToPurchaseLines(list, { 3: "1" }, { costPrice: "300", mrp: "799", gstRate: 0 });
    expect(shared[0].mrp).toBe("799");
  });
});
