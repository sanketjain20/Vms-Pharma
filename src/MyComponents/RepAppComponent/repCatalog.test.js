import { DEFAULT_CATALOG_FILTERS, catalogFacets, filterCatalog, activeCatalogFilters, firstLetter, orderAgain } from "./repCatalog";

jest.mock("../../Config/apiClient");

const P = (productId, name, o = {}) => ({ productId, name, productCode: "C" + productId, barcode: "89" + productId, unit: "strip", sellingPrice: 10, stock: 5, category: "Tablets", manufacturer: "Cipla", ...o });
const CATALOG = [
  P(1, "Paracetamol 500", { sellingPrice: 25, stock: 100 }),
  P(2, "Amoxicillin 250", { category: "Capsules", manufacturer: "Sun Pharma", sellingPrice: 80, stock: 0 }),
  P(3, "Cough Syrup", { category: "Syrups", sellingPrice: 55, stock: 40 }),
  P(4, "Azithromycin 500", { category: "Tablets", sellingPrice: 120, stock: 12 }),
  P(5, "5% Dextrose", { category: null, sellingPrice: 60, stock: 3 }),
];
const f = (o) => ({ ...DEFAULT_CATALOG_FILTERS, ...o });
const names = (l) => l.map((p) => p.name);

describe("catalogFacets", () => {
  it("lists categories with counts (missing ones as 'Other') and only the letters that exist", () => {
    const { categories, letters } = catalogFacets(CATALOG);
    expect(categories).toEqual([
      { name: "Capsules", count: 1 }, { name: "Other", count: 1 }, { name: "Syrups", count: 1 }, { name: "Tablets", count: 2 },
    ]);
    expect(letters).toEqual(["A", "C", "P", "#"]); // digits group under '#', last
  });

  it("derives a letter from the first character", () => {
    expect(firstLetter("amox")).toBe("A");
    expect(firstLetter("  zinc")).toBe("Z");
    expect(firstLetter("5% Dextrose")).toBe("#");
    expect(firstLetter("")).toBe("#");
  });
});

describe("filterCatalog", () => {
  it("sorts by name by default", () => {
    expect(names(filterCatalog(CATALOG, f()))).toEqual(["5% Dextrose", "Amoxicillin 250", "Azithromycin 500", "Cough Syrup", "Paracetamol 500"]);
  });

  it("searches name, code, barcode, category and manufacturer — every word must match", () => {
    expect(names(filterCatalog(CATALOG, f({ q: "para" })))).toEqual(["Paracetamol 500"]);
    expect(names(filterCatalog(CATALOG, f({ q: "C3" })))).toEqual(["Cough Syrup"]);
    expect(names(filterCatalog(CATALOG, f({ q: "892" })))).toEqual(["Amoxicillin 250"]);
    expect(names(filterCatalog(CATALOG, f({ q: "syrups" })))).toEqual(["Cough Syrup"]);
    expect(names(filterCatalog(CATALOG, f({ q: "sun pharma" })))).toEqual(["Amoxicillin 250"]);
    expect(names(filterCatalog(CATALOG, f({ q: "tablets 500" })))).toEqual(["Azithromycin 500", "Paracetamol 500"]);
    expect(filterCatalog(CATALOG, f({ q: "tablets zzz" }))).toEqual([]);
  });

  it("filters by category (including the 'Other' bucket), letter, and in-stock", () => {
    expect(names(filterCatalog(CATALOG, f({ category: "Tablets" })))).toEqual(["Azithromycin 500", "Paracetamol 500"]);
    expect(names(filterCatalog(CATALOG, f({ category: "Other" })))).toEqual(["5% Dextrose"]);
    expect(names(filterCatalog(CATALOG, f({ letter: "A" })))).toEqual(["Amoxicillin 250", "Azithromycin 500"]);
    expect(names(filterCatalog(CATALOG, f({ letter: "#" })))).toEqual(["5% Dextrose"]);
    expect(names(filterCatalog(CATALOG, f({ inStockOnly: true }))).includes("Amoxicillin 250")).toBe(false);
  });

  it("combines filters and sorts by price and stock", () => {
    expect(names(filterCatalog(CATALOG, f({ category: "Tablets", letter: "A" })))).toEqual(["Azithromycin 500"]);
    expect(names(filterCatalog(CATALOG, f({ sort: "PRICE_LOW" })))[0]).toBe("Paracetamol 500");
    expect(names(filterCatalog(CATALOG, f({ sort: "PRICE_HIGH" })))[0]).toBe("Azithromycin 500");
    expect(names(filterCatalog(CATALOG, f({ sort: "STOCK" })))[0]).toBe("Paracetamol 500");
  });

  it("does not mutate the catalog it is given", () => {
    const copy = [...CATALOG];
    filterCatalog(CATALOG, f({ sort: "PRICE_HIGH" }));
    expect(CATALOG).toEqual(copy);
  });

  it("copes with a catalog of several hundred products", () => {
    const big = Array.from({ length: 600 }, (_, i) => P(i + 1, `Product ${String(i).padStart(3, "0")}`, { category: i % 2 ? "A" : "B" }));
    expect(filterCatalog(big, f({ category: "A" }))).toHaveLength(300);
    expect(filterCatalog(big, f({ q: "product 042" }))).toHaveLength(1);
  });

  it("counts active filters", () => {
    expect(activeCatalogFilters(f())).toBe(0);
    expect(activeCatalogFilters(f({ q: "x", category: "Tablets", letter: "A", inStockOnly: true, sort: "STOCK" }))).toBe(4);
  });
});

describe("orderAgain", () => {
  const order = (retailerId, capturedAt, ...lines) => ({ retailerId, capturedAt, items: lines.map(([productId, quantity]) => ({ productId, quantity })) });
  const orders = [
    order(7, "2026-10-01T10:00:00", [1, 5], [3, 2]),
    order(7, "2026-10-05T10:00:00", [1, 10], [4, 1]),
    order(8, "2026-10-06T10:00:00", [2, 9]),
    order(7, "2026-10-07T10:00:00", [99, 1]), // no longer in the catalog
  ];

  it("suggests what this retailer ordered before — most often first, with the latest quantity", () => {
    const r = orderAgain(orders, 7, CATALOG);
    expect(r[0]).toMatchObject({ count: 2, lastQty: 10 });
    expect(r[0].product.name).toBe("Paracetamol 500");
    expect(r.map((x) => x.product.productId)).toEqual([1, 4, 3]); // ties → most recent first
  });

  it("ignores other retailers, products no longer sold, and no retailer selected", () => {
    expect(orderAgain(orders, 8, CATALOG).map((x) => x.product.productId)).toEqual([2]);
    expect(orderAgain(orders, 7, CATALOG).some((x) => x.product.productId === 99)).toBe(false);
    expect(orderAgain(orders, "", CATALOG)).toEqual([]);
  });

  it("respects the limit", () => {
    expect(orderAgain(orders, 7, CATALOG, 2)).toHaveLength(2);
  });
});
