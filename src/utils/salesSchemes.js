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
import { roundToRupee } from "./salePayments";
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

/** GST rates a product or a line may carry (same list as the server's GstRates). */
export const GST_RATES = [0, 0.25, 3, 5, 12, 18, 28, 40];

const isSet = (v) => v !== null && v !== undefined && v !== "";

/** The before-tax unit price of a price that includes GST (4 decimals, as the server stores it): 100 at 18% -> 84.7458. */
export const exclusiveOf = (price, rate) => Math.round((num(price) * 100 / (100 + num(rate))) * 10000) / 10000;

/** The price with GST added back (2 decimals): 84.7458 at 18% -> 100. */
export const inclusiveOf = (price, rate) => round2((num(price) * (100 + num(rate))) / 100);

/**
 * Which GST rate a line is billed at, and why (mirrors SalesCommonRepository.decideGst):
 *  CUSTOM   a custom item: its own rate
 *  OVERRIDE the clerk changed a product's rate (needs a reason and the "Override GST Rate" permission)
 *  PRODUCT  the product's own rate
 *  COMMON   the product has no rate yet: the bill's common rate (null = worked out from the line's own tax); flagged
 */
export function lineGst(it, commonRate = null) {
  if (it.custom) return { rate: num(it.gstRate), source: "CUSTOM" };
  if (isSet(it.overrideRate)) return { rate: num(it.overrideRate), source: "OVERRIDE" };
  if (isSet(it.productGstRate)) return { rate: num(it.productGstRate), source: "PRODUCT" };
  // a line restored from a saved bill keeps the common rate it was billed at
  if (isSet(it.commonGstRate)) return { rate: num(it.commonGstRate), source: "COMMON" };
  return { rate: commonRate !== null && commonRate !== undefined ? num(commonRate) : null, source: "COMMON" };
}

/**
 * @param lines          [{ sellingPrice, quantity (paid), taxAmount, schemeDiscount?, freeQuantity?,
 *                          productGstRate?, priceIncludesGst?, overrideRate?, overrideReason? }]
 * @param manualDiscount the number the clerk typed
 * @param discountType   "PERCENT" (of the value after schemes) or "FLAT"
 * @param commonRate     the GST % for lines whose product has no rate yet (Common GST mode), or null to use their own tax
 * @param roundOff       round the bill total to the rupee (the shop's setting): net is rounded, roundOff the difference
 * A product line is billed at its product's rate (or an override); a price that includes GST is backed out to its
 * before-tax value first. A custom (run-time) line ({ custom: true, gstRate }) always uses its own GST %.
 */
export function computeTotals({ lines, manualDiscount = 0, discountType = "FLAT", commonRate = null, roundOff = false }) {
  const rows = lines.map((it) => {
    const g = lineGst(it, commonRate);
    const inclusive = !it.custom && !!it.priceIncludesGst && g.rate !== null;
    const unitPrice = inclusive ? exclusiveOf(it.sellingPrice, g.rate) : num(it.sellingPrice);
    const rawGross = unitPrice * num(it.quantity); // a before-tax price has 4 decimals: GST is worked out on this, as the server does
    const gross = round2(rawGross);
    const scheme = round2(num(it.schemeDiscount));
    const post = gross - scheme;
    const clientTax = g.rate !== null ? (gross * g.rate) / 100 : num(it.taxAmount);
    const rate = gross > 0 ? clientTax / gross : 0;
    return { gross, scheme, post, rawPost: rawGross - scheme, clientTax, rate, gstRate: g.rate, gstSource: g.source, inclusive, unitPrice };
  });

  const grossTotal = round2(rows.reduce((s, r) => s + r.gross, 0));
  const schemeDiscount = round2(rows.reduce((s, r) => s + r.scheme, 0));
  const postTotal = grossTotal - schemeDiscount;

  const typed = num(manualDiscount);
  const manual = typed > 0 ? round2(discountType === "PERCENT" ? (postTotal * typed) / 100 : typed) : 0;

  let tax = 0;
  rows.forEach((r) => {
    const share = postTotal > 0 ? (manual * r.post) / postTotal : 0;
    r.tax = round2((r.rawPost - share) * r.rate);
    tax += r.tax;
  });
  tax = round2(tax);

  const taxable = round2(postTotal - manual);
  // the total before round-off; with round-off on, the bill is the nearest rupee and the difference is shown
  const exactNet = round2(taxable + tax);
  const rounded = roundOff ? roundToRupee(exactNet) : { net: exactNet, roundOff: 0 };
  return {
    exactNet,
    roundOff: rounded.roundOff,
    gross: grossTotal,
    schemeDiscount,
    manualDiscount: manual,
    totalDiscount: round2(schemeDiscount + manual),
    taxable,
    tax,
    net: rounded.net,
    freeUnits: lines.reduce((s, it) => s + (parseInt(it.freeQuantity, 10) || 0), 0),
    lines: rows,
    /** the discount is more than the goods are worth after schemes */
    discountTooLarge: manual > postTotal + 0.005,
  };
}

/** The bill's GST split by rate, for the totals: [{ rate: 18, tax }], lowest rate first; lines of no value left out. */
export function gstSplit(totals) {
  const byRate = new Map();
  (totals?.lines || []).forEach((r) => {
    if (!(r.gross > 0)) return;
    const rate = Number((r.rate * 100).toFixed(2));
    const g = byRate.get(rate) || { rate, tax: 0 };
    g.tax += r.tax || 0;
    byRate.set(rate, g);
  });
  return [...byRate.values()].sort((a, b) => a.rate - b.rate).map((g) => ({ ...g, tax: round2(g.tax) }));
}

/** How a product's price stands with GST, for a card or a line: " incl. 18% GST", " + 18% GST", or " · GST not set". */
export function gstTag(gstRate, priceIncludesGst) {
  if (gstRate === null || gstRate === undefined || gstRate === "") return " · GST not set";
  return priceIncludesGst ? ` incl. ${Number(gstRate)}% GST` : ` + ${Number(gstRate)}% GST`;
}

/** The line items to send: the tax figure is the one the totals above were built on, and the scheme the clerk kept. */
export function toItemPayload(lines, totals) {
  return lines.map((it, i) => (it.custom ? {
    // a custom item: no product, no batch, no scheme; the server works its tax out from gstRate
    productId: null,
    itemName: it.itemName,
    hsnCode: it.hsnCode || null,
    gstRate: num(it.gstRate),
    costPrice: it.costPrice ?? null,
    quantity: it.quantity,
    sellingPrice: it.sellingPrice,
    taxAmount: round2(totals.lines[i].clientTax),
  } : {
    productId: it.productId,
    quantity: it.quantity,
    sellingPrice: it.sellingPrice,
    taxAmount: round2(totals.lines[i].clientTax),
    // the server bills a product at its own rate: only an override, or the common rate of a product with none, is sent
    gstRate: totals.lines[i].gstSource === "OVERRIDE" || totals.lines[i].gstSource === "COMMON" ? totals.lines[i].gstRate : null,
    ...(totals.lines[i].gstSource === "OVERRIDE" ? { overrideReason: it.overrideReason || "" } : {}),
    // a price other than the product's: why, and whether a price below the average cost was confirmed
    ...(it.priceOverrideReason ? { priceOverrideReason: it.priceOverrideReason, belowCostConfirmed: !!it.belowCostConfirmed } : {}),
    priceIncludesGst: !!it.priceIncludesGst,
    batchId: it.batchId || null,
    schemeId: it.schemeId || null,
    ...(it.serials && it.serials.length ? { serials: it.serials } : {}), // Phase 6: the units sold, one per unit
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
    if (i.custom) {
      // a custom (run-time) item: kept as it was typed, with its own GST %
      merged.push({
        key: null, custom: true, productId: null, productName: i.itemName || i.product, itemName: i.itemName || i.product,
        quantity: i.quantity, sellingPrice: i.sellingPrice, paidTax: num(i.taxAmount), rowDiscount: num(i.discountAmount),
        gstRate: num(i.gstRate), hsnCode: i.hsnCodeSnapshot || null, costPrice: i.costPrice ?? null,
        schemeId: null, schemeName: "", batchId: null, batchNumber: "", expiryDate: "",
      });
      return;
    }
    const key = i.schemeId ? `${i.productId}|${i.schemeId}|${i.sellingPrice}` : null;
    const hit = key ? merged.find((m) => m.key === key) : null;
    const rowDiscount = num(i.discountAmount);
    if (hit) {
      hit.quantity += i.quantity;
      if (i.serials && i.serials.length) hit.serials = [...(hit.serials || []), ...i.serials];
      hit.paidTax += num(i.taxAmount);
      hit.rowDiscount += rowDiscount;
      // rows from different batches merged into one line: no single batch holds it all, so it goes back to Auto
      if ((i.batchId || null) !== hit.batchId) {
        hit.batchId = null; hit.batchNumber = "AUTO"; hit.expiryDate = "";
      }
      return;
    }
    merged.push({
      key, productId: i.productId, productName: i.product, quantity: i.quantity, sellingPrice: i.sellingPrice,
      paidTax: num(i.taxAmount), rowDiscount, schemeId: i.schemeId || null, schemeName: i.schemeNameSnapshot || "",
      batchId: i.batchId || null, batchNumber: i.batchNumberSnapshot || "AUTO", expiryDate: i.expiryDateSnapshot || "",
      gstSource: i.gstSource || null, gstRate: i.gstRate ?? null, priceIncludesGst: !!i.priceIncludesGst,
      overrideReason: i.gstOverrideReason || "",
      listPrice: i.listPrice ?? null, priceOverrideReason: i.priceOverrideReason || "", belowCostConfirmed: !!i.priceBelowCost,
      ...(i.serials && i.serials.length ? { serials: [...i.serials] } : {}),
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
    if (m.custom) {
      const taxAmount = round2((gross * m.gstRate) / 100);
      return {
        custom: true, productId: null, productName: m.productName, itemName: m.itemName, quantity: m.quantity,
        sellingPrice: m.sellingPrice, gstRate: m.gstRate, hsnCode: m.hsnCode, costPrice: m.costPrice, taxAmount,
        totalAmount: gross + taxAmount, batchId: null, batchNumber: "", expiryDate: "", schemeId: null, schemeName: "",
        schemeDescription: "", freeQuantity: 0, schemeDiscount: 0, schemeOff: true,
      };
    }
    // discount_row = scheme_row + manual x (gross_row - scheme_row) / post   ->   solve for scheme_row
    let scheme = 0;
    if (m.schemeId) {
      scheme = post > manual ? (m.rowDiscount - (manual * gross) / post) / (1 - manual / post) : m.rowDiscount;
      scheme = Math.max(0, Math.min(gross, round2(scheme)));
    }
    const taxable = gross - m.rowDiscount;
    // a line saved since product-wise GST keeps its rate; an older one has it worked out from its tax
    const known = !!m.gstSource && m.gstRate !== null;
    const rate = known ? num(m.gstRate) : taxable > 0 ? snapRate((m.paidTax / taxable) * 100) : 0;
    const taxAmount = round2((gross * rate) / 100);
    const free = items
      .filter((i) => i.freeItem && i.productId === m.productId && (i.schemeId || null) === m.schemeId)
      .reduce((s, i) => s + i.quantity, 0);
    const inclusive = known && m.priceIncludesGst;
    return {
      productId: m.productId, productName: m.productName, quantity: m.quantity,
      // the bill stores the before-tax rate of a GST-inclusive price: shown (and sent back) as the price with GST
      sellingPrice: inclusive ? inclusiveOf(m.sellingPrice, rate) : m.sellingPrice,
      taxAmount, totalAmount: gross + taxAmount, batchId: m.batchId, batchNumber: m.batchNumber, expiryDate: m.expiryDate,
      schemeId: m.schemeId, schemeName: m.schemeName, schemeDescription: "", freeQuantity: free, schemeDiscount: scheme,
      schemeOff: false,
      // the serial numbers sold on the line go back with it, or saving the bill unchanged asks for them again
      ...(m.serials && m.serials.length ? { serials: [...m.serials] } : {}),
      priceIncludesGst: inclusive,
      productGstRate: known && m.gstSource === "PRODUCT" ? rate : null,
      overrideRate: known && m.gstSource === "OVERRIDE" ? rate : null,
      overrideReason: known && m.gstSource === "OVERRIDE" ? m.overrideReason : "",
      commonGstRate: known && m.gstSource === "COMMON" ? rate : null,
      // a price changed when it was billed: from what and why (kept as it is unless changed again)
      listPrice: m.listPrice, priceOverrideReason: m.priceOverrideReason, belowCostConfirmed: m.belowCostConfirmed,
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
