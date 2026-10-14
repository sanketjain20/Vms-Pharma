// The sale-screen side of schemes and discounts: pure functions (no React, no network) so the maths can be tested alone.
//
// It mirrors what the server does (SalesLinePricer), so the figures on the screen are the figures that get charged:
//   gross      = paid qty x price                      (free units are worth nothing)
//   postScheme = gross - scheme discount
//   manual     = invoice discount x postScheme / sum of postScheme
//   taxable    = postScheme - manual
//   tax        = taxable x rate        (rate = the tax the screen sent / gross)
//   net        = gross - scheme - manual + tax
// With no scheme and no discount this is exactly what the screens always showed.

import apiClient from "../Config/apiClient";
import API_BASE_URL from "../Config/api.config";

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

export const lineGross = (it) => num(it.sellingPrice) * num(it.quantity);

/** "10 paid + 1 free" style text for a line, or "" when it has no free units. */
export const freeText = (it) => (it.freeQuantity > 0 ? `+ ${it.freeQuantity} free` : "");

/** What the server said the best scheme would give -> the fields a line carries (and a null clears them). */
export function withScheme(line, applicable) {
  if (!applicable) {
    return { ...line, schemeId: null, schemeName: "", schemeDescription: "", freeQuantity: 0, schemeDiscount: 0 };
  }
  return {
    ...line,
    schemeId: applicable.schemeId,
    schemeName: applicable.name,
    schemeDescription: applicable.description,
    freeQuantity: applicable.freeQuantity || 0,
    schemeDiscount: round2(applicable.discountAmount || 0),
    schemeOff: false,
  };
}

/** The clerk removed the scheme from this line: it stays off, whatever the screen suggests later. */
export const removeScheme = (line) => ({ ...withScheme(line, null), schemeOff: true });

/** Ask the server which scheme fits this line. Resolves to the suggestion, or null (no scheme, or the call failed). */
export async function fetchApplicable({ productId, retailerId, quantity, unitPrice }) {
  try {
    const query = new URLSearchParams({ productId, quantity, unitPrice });
    if (retailerId) query.set("retailerId", retailerId);
    const res = await apiClient(`${API_BASE_URL}/api/Scheme/Applicable?${query}`, { method: "GET" });
    const json = await res.json();
    return json?.status === 200 && json.data ? json.data : null;
  } catch {
    return null; // the server checks again on save, so a missed suggestion is harmless
  }
}

/**
 * @param lines          [{ sellingPrice, quantity (paid), taxAmount, schemeDiscount?, freeQuantity? }]
 * @param manualDiscount the number the clerk typed
 * @param discountType   "PERCENT" (of the value after schemes) or "FLAT"
 * @param commonRate     a single GST % for every line (Common GST mode), or null to use each line's own tax
 */
export function computeTotals({ lines, manualDiscount = 0, discountType = "FLAT", commonRate = null }) {
  const rows = lines.map((it) => {
    const gross = round2(lineGross(it));
    const scheme = round2(num(it.schemeDiscount));
    const post = gross - scheme;
    const clientTax = commonRate !== null ? (gross * num(commonRate)) / 100 : num(it.taxAmount);
    const rate = gross > 0 ? clientTax / gross : 0;
    return { gross, scheme, post, clientTax, rate };
  });

  const grossTotal = round2(rows.reduce((s, r) => s + r.gross, 0));
  const schemeDiscount = round2(rows.reduce((s, r) => s + r.scheme, 0));
  const postTotal = grossTotal - schemeDiscount;

  const typed = num(manualDiscount);
  const manual = typed > 0 ? round2(discountType === "PERCENT" ? (postTotal * typed) / 100 : typed) : 0;

  let tax = 0;
  rows.forEach((r) => {
    const share = postTotal > 0 ? (manual * r.post) / postTotal : 0;
    r.tax = round2((r.post - share) * r.rate);
    tax += r.tax;
  });
  tax = round2(tax);

  const taxable = round2(postTotal - manual);
  return {
    gross: grossTotal,
    schemeDiscount,
    manualDiscount: manual,
    totalDiscount: round2(schemeDiscount + manual),
    taxable,
    tax,
    net: round2(taxable + tax),
    freeUnits: lines.reduce((s, it) => s + (parseInt(it.freeQuantity, 10) || 0), 0),
    lines: rows,
    /** the discount is more than the goods are worth after schemes */
    discountTooLarge: manual > postTotal + 0.005,
  };
}

/** The line items to send: the tax figure is the one the totals above were built on, and the scheme the clerk kept. */
export function toItemPayload(lines, totals) {
  return lines.map((it, i) => ({
    productId: it.productId,
    quantity: it.quantity,
    sellingPrice: it.sellingPrice,
    taxAmount: round2(totals.lines[i].clientTax),
    batchId: it.batchId || null,
    schemeId: it.schemeId || null,
  }));
}

const SLABS = [0, 5, 12, 18, 28];

/** A rate worked out from rounded money is a little off (17.98): snap it to a real GST slab when it is that close. */
export function snapRate(rate) {
  const near = SLABS.find((s) => Math.abs(s - rate) <= 0.3);
  return near !== undefined ? near : Math.round(rate * 100) / 100;
}

/**
 * Turns a saved sale's rows back into editable lines.
 *  - free rows are dropped, the server recreates them from the scheme;
 *  - paid rows of one product and scheme (one per batch) are merged, because the scheme is judged on the whole line;
 *  - the stored tax is on the DISCOUNTED value, so the line's tax is restated on the full value (the server reads the
 *    GST rate from tax / gross), and the scheme discount is separated from the invoice discount's share.
 */
export function linesFromSale(items, manualDiscount, schemeDiscountTotal) {
  const paid = items.filter((i) => !i.freeItem);
  const merged = [];
  paid.forEach((i) => {
    const key = i.schemeId ? `${i.productId}|${i.schemeId}|${i.sellingPrice}` : null;
    const hit = key ? merged.find((m) => m.key === key) : null;
    const rowDiscount = num(i.discountAmount);
    if (hit) {
      hit.quantity += i.quantity;
      hit.paidTax += num(i.taxAmount);
      hit.rowDiscount += rowDiscount;
      return;
    }
    merged.push({
      key, productId: i.productId, productName: i.product, quantity: i.quantity, sellingPrice: i.sellingPrice,
      paidTax: num(i.taxAmount), rowDiscount, schemeId: i.schemeId || null, schemeName: i.schemeNameSnapshot || "",
      batchId: i.batchId || null, batchNumber: i.batchNumberSnapshot || "AUTO", expiryDate: i.expiryDateSnapshot || "",
    });
  });

  const grossAll = merged.reduce((s, m) => s + m.sellingPrice * m.quantity, 0);
  const manual = num(manualDiscount);
  const post = grossAll - num(schemeDiscountTotal);

  // a sale saved before schemes carries its discount only on the invoice: share it over the rows by value, as it always was
  const legacy = manual > 0 && num(schemeDiscountTotal) === 0 && merged.every((m) => m.rowDiscount === 0);
  if (legacy && grossAll > 0) merged.forEach((m) => { m.rowDiscount = (manual * m.sellingPrice * m.quantity) / grossAll; });

  return merged.map((m) => {
    const gross = m.sellingPrice * m.quantity;
    // discount_row = scheme_row + manual x (gross_row - scheme_row) / post   ->   solve for scheme_row
    let scheme = 0;
    if (m.schemeId) {
      scheme = post > manual ? (m.rowDiscount - (manual * gross) / post) / (1 - manual / post) : m.rowDiscount;
      scheme = Math.max(0, Math.min(gross, round2(scheme)));
    }
    const taxable = gross - m.rowDiscount;
    const rate = taxable > 0 ? snapRate((m.paidTax / taxable) * 100) : 0;
    const taxAmount = round2((gross * rate) / 100);
    const free = items
      .filter((i) => i.freeItem && i.productId === m.productId && (i.schemeId || null) === m.schemeId)
      .reduce((s, i) => s + i.quantity, 0);
    return {
      productId: m.productId, productName: m.productName, quantity: m.quantity, sellingPrice: m.sellingPrice,
      taxAmount, totalAmount: gross + taxAmount, batchId: m.batchId, batchNumber: m.batchNumber, expiryDate: m.expiryDate,
      schemeId: m.schemeId, schemeName: m.schemeName, schemeDescription: "", freeQuantity: free, schemeDiscount: scheme,
      schemeOff: false,
    };
  });
}

/**
 * What a return of `quantity` units of a saved row is worth before tax: the price less that row's share of the
 * discount it was sold with (the server refunds exactly this). A row from before schemes has no discount, so it is
 * quantity x price as it always was; a free row is worth nothing.
 */
export function returnValue({ sellingPrice, discountAmount, max }, quantity) {
  const q = num(quantity);
  const share = num(max) > 0 ? (num(discountAmount) * q) / num(max) : 0;
  return round2(num(sellingPrice) * q - share);
}
