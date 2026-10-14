// Browsing a long product list on a phone: search, category, A–Z jump, stock and
// sort, plus "order again" suggestions per retailer. Pure functions.

export const CATALOG_SORTS = [
  ["NAME", "Name A–Z"],
  ["PRICE_LOW", "Price: low to high"],
  ["PRICE_HIGH", "Price: high to low"],
  ["STOCK", "Most in stock"],
];

export const DEFAULT_CATALOG_FILTERS = { q: "", category: "", letter: "", inStockOnly: false, sort: "NAME" };

const norm = (s) => String(s ?? "").toLowerCase();

export const firstLetter = (name) => {
  const c = String(name ?? "").trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : "#";
};

/** Category list (with counts) and the letters that actually have products. */
export function catalogFacets(catalog) {
  const cats = new Map();
  const letters = new Set();
  for (const p of catalog) {
    const c = p.category || "Other";
    cats.set(c, (cats.get(c) || 0) + 1);
    letters.add(firstLetter(p.name));
  }
  return {
    categories: [...cats.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name)),
    letters: [...letters].sort((a, b) => (a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b))),
  };
}

export function filterCatalog(catalog, f) {
  const tokens = norm(f.q).split(/\s+/).filter(Boolean);
  const out = catalog.filter((p) => {
    if (f.category && (p.category || "Other") !== f.category) return false;
    if (f.letter && firstLetter(p.name) !== f.letter) return false;
    if (f.inStockOnly && !(Number(p.stock) > 0)) return false;
    if (tokens.length === 0) return true;
    const hay = norm([p.name, p.productCode, p.barcode, p.category, p.manufacturer].join(" \n "));
    return tokens.every((t) => hay.includes(t));
  });

  const by = {
    NAME: (a, b) => String(a.name).localeCompare(String(b.name)),
    PRICE_LOW: (a, b) => Number(a.sellingPrice) - Number(b.sellingPrice),
    PRICE_HIGH: (a, b) => Number(b.sellingPrice) - Number(a.sellingPrice),
    STOCK: (a, b) => Number(b.stock || 0) - Number(a.stock || 0),
  }[f.sort] || ((a, b) => String(a.name).localeCompare(String(b.name)));
  return out.sort(by);
}

export function activeCatalogFilters(f) {
  return [f.q.trim(), f.category, f.letter, f.inStockOnly].filter(Boolean).length;
}

/**
 * Products this retailer has ordered before, most-ordered first (ties: most recent) —
 * the quickest way to build a repeat order. Only products still in the catalog are offered.
 */
export function orderAgain(orders, retailerId, catalog, limit = 8) {
  if (!retailerId) return [];
  const byId = new Map(catalog.map((p) => [p.productId, p]));
  const seen = new Map();
  orders
    .filter((o) => String(o.retailerId) === String(retailerId))
    .forEach((o) => {
      const t = new Date(o.capturedAt).getTime() || 0;
      o.items.forEach((i) => {
        const cur = seen.get(i.productId) || { productId: i.productId, count: 0, last: 0, lastQty: i.quantity };
        cur.count += 1;
        if (t >= cur.last) { cur.last = t; cur.lastQty = i.quantity; }
        seen.set(i.productId, cur);
      });
    });
  return [...seen.values()]
    .filter((s) => byId.has(s.productId))
    .sort((a, b) => b.count - a.count || b.last - a.last)
    .slice(0, limit)
    .map((s) => ({ product: byId.get(s.productId), count: s.count, lastQty: s.lastQty }));
}
