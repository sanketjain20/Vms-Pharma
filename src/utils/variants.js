// Sizes and colours (Phase 5). A style ("Cotton Kurta") is sold as its variants ("Cotton Kurta - M / Blue"), each an
// ordinary product that carries styleId / styleName / variantSize / variantColor in the product list. These helpers
// group the list by style and lay the variants out as a size × colour grid; the screens only draw what they return.

/** Ready-made size sets the product form offers. */
export const SIZE_PRESETS = [
  { label: "S – XXL", values: ["S", "M", "L", "XL", "XXL"] },
  { label: "Waist 28 – 38", values: ["28", "30", "32", "34", "36", "38"] },
  { label: "Kids", values: ["1-2Y", "3-4Y", "5-6Y", "7-8Y", "9-10Y"] },
  { label: "Free size", values: ["Free Size"] },
];

export const MAX_VALUE_LENGTH = 30;

/** Trimmed, inner spaces squeezed, blanks and repeats (ignoring case) dropped, in the order given — as the server does. */
export function cleanValues(values) {
  const seen = new Map();
  (values || []).forEach((raw) => {
    const v = String(raw ?? "").trim().replace(/\s+/g, " ").replace(/,/g, "");
    if (v && v.length <= MAX_VALUE_LENGTH && !seen.has(v.toLowerCase())) seen.set(v.toLowerCase(), v);
  });
  return [...seen.values()];
}

/** "S, M ,L" → ["S", "M", "L"] (what a user types or pastes into a size/colour box). */
export const splitInput = (text) => cleanValues(String(text || "").split(/[,\n]/));

/** Case-insensitive identity of a size/colour pair, same as the server's ("m|blue"). */
export const variantKey = (size, color) => `${(size || "").trim()}|${(color || "").trim()}`.toLowerCase();

/** Every size × colour pair; either list may be empty, not both. */
export function combos(sizes, colors) {
  const s = sizes?.length ? sizes : [null];
  const c = colors?.length ? colors : [null];
  const out = [];
  s.forEach((size) => c.forEach((color) => { if (size || color) out.push({ size, color }); }));
  return out;
}

const APPAREL = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "XXXL", "3XL", "4XL", "5XL"];

/** Shop-floor order for sizes: XS S M L XL…, then numbers low to high, then anything else as A–Z. */
export function sortSizes(sizes) {
  const rank = (v) => {
    const u = String(v).toUpperCase();
    const a = APPAREL.indexOf(u);
    if (a >= 0) return [0, a, ""];
    const n = parseFloat(u);
    if (!Number.isNaN(n)) return [1, n, u];
    return [2, 0, u];
  };
  return [...sizes].sort((x, y) => {
    const [a1, a2, a3] = rank(x);
    const [b1, b2, b3] = rank(y);
    return a1 - b1 || a2 - b2 || a3.localeCompare(b3);
  });
}

export const isVariant = (p) => p?.styleId !== null && p?.styleId !== undefined;

/** "M / Blue", "M" or "Blue". */
export const variantLabel = (v) => [v?.variantSize, v?.variantColor].filter(Boolean).join(" / ");

const styleNameOf = (p) => p.styleName || String(p.name || "").split(" - ")[0];

/** The sizes and colours a style's variants use: sizes in shop-floor order, colours in the order first seen. */
export function variantAxes(variants) {
  const sizes = cleanValues((variants || []).map((v) => v.variantSize));
  const colors = cleanValues((variants || []).map((v) => v.variantColor));
  return { sizes: sortSizes(sizes), colors };
}

/** The variant for a size/colour pair, or undefined. */
export const findVariant = (variants, size, color) =>
  (variants || []).find((v) => variantKey(v.variantSize, v.variantColor) === variantKey(size, color));

/**
 * The product list as catalog entries: one entry per style (its variants together, where its first variant was) and
 * one per ordinary product, in list order.
 *   → [{ kind: "product", product } | { kind: "style", styleId, name, variants }]
 */
export function groupCatalog(products) {
  const out = [];
  const byStyle = new Map();
  (products || []).forEach((p) => {
    if (!isVariant(p)) { out.push({ kind: "product", product: p }); return; }
    let entry = byStyle.get(p.styleId);
    if (!entry) {
      entry = { kind: "style", styleId: p.styleId, name: styleNameOf(p), variants: [] };
      byStyle.set(p.styleId, entry);
      out.push(entry);
    }
    entry.variants.push(p);
  });
  return out;
}

/** The styles in a product list, by name. */
export const stylesIn = (products) =>
  groupCatalog(products).filter((e) => e.kind === "style").sort((a, b) => a.name.localeCompare(b.name));

/** "₹499" or "₹499 – ₹599" over the prices given (blank/zero ones ignored); "" when none. */
export function priceRange(prices) {
  const list = (prices || []).map(Number).filter((n) => n > 0);
  if (list.length === 0) return "";
  const lo = Math.min(...list);
  const hi = Math.max(...list);
  return lo === hi ? `₹${lo}` : `₹${lo} – ₹${hi}`;
}

/**
 * The purchase lines a size × colour quantity grid adds: one per variant with a quantity above 0.
 * @param quantities { [variantId]: "3" }
 * @param common     { costPrice, mrp, gstRate } — a blank MRP takes each variant's own price
 */
export function gridToPurchaseLines(variants, quantities, common) {
  return (variants || [])
    .filter((v) => parseInt(quantities?.[v.id], 10) > 0)
    .map((v) => ({
      productId: v.id,
      productName: v.name,
      quantity: parseInt(quantities[v.id], 10),
      costPrice: common.costPrice,
      mrp: common.mrp !== "" && common.mrp !== null && common.mrp !== undefined ? common.mrp : v.price ?? "",
      gstRate: common.gstRate ?? 0,
      batchNumber: "", manufacturingDate: "", expiryDate: "",
    }));
}
