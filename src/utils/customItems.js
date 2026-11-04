// Custom (run-time) items on a bill: something typed in at billing time that is not a product in stock
// ("Alteration charge", "Blue kurta (old stock)"). Mirrors the backend's Utils/CustomSaleItem.java so the screen
// refuses exactly what the server would:
//   - name required, at most 200 characters;
//   - quantity at least 1, price above zero;
//   - GST % one of the slabs below (none = 0);
//   - HSN optional, 4, 6 or 8 digits (the server also requires it when the bill will be e-invoiced);
//   - cost price optional, not negative (only used for profit).
// A custom line takes no stock, has no batch and gets no scheme. The shop turns the feature on in Settings → Billing.

import { useEffect, useState } from "react";
import apiClient from "../Config/apiClient";
import API_BASE_URL from "../Config/api.config";

export const MAX_ITEM_NAME_LENGTH = 200;

/** The GST % a custom item can carry (the common slabs; the server accepts every slab in use). */
export const CUSTOM_GST_SLABS = [0, 0.25, 3, 5, 12, 18, 28, 40];

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : NaN;
};

/**
 * @param form { name, quantity, price, gstRate, hsnCode, costPrice } as typed (strings are fine)
 * @returns {{ errors: object, line: object|null }} the field errors, or the cleaned values when there are none
 */
export function checkCustomItem(form) {
  const errors = {};
  const name = String(form.name ?? "").trim().replace(/\s+/g, " ");
  if (!name) errors.name = "Enter a name for the item";
  else if (name.length > MAX_ITEM_NAME_LENGTH) errors.name = `At most ${MAX_ITEM_NAME_LENGTH} characters`;

  const quantity = num(form.quantity);
  if (!Number.isInteger(quantity) || quantity < 1) errors.quantity = "Quantity must be a whole number, at least 1";

  const price = num(form.price);
  if (!(price > 0)) errors.price = "Enter a price above zero";

  const gstRate = form.gstRate === "" || form.gstRate == null ? 0 : num(form.gstRate);
  if (!CUSTOM_GST_SLABS.includes(gstRate)) errors.gstRate = "Choose a GST rate";

  const hsnCode = String(form.hsnCode ?? "").replace(/\s/g, "");
  if (hsnCode && !/^(\d{4}|\d{6}|\d{8})$/.test(hsnCode)) errors.hsnCode = "HSN is 4, 6 or 8 digits";

  const costText = String(form.costPrice ?? "").trim();
  const costPrice = costText === "" ? null : num(costText);
  if (costPrice !== null && !(costPrice >= 0)) errors.costPrice = "Cost can't be negative";

  if (Object.keys(errors).length > 0) return { errors, line: null };
  return { errors, line: { name, quantity, price, gstRate, hsnCode: hsnCode || null, costPrice } };
}

/** The tax on a custom line's full value, from its own GST % (what the server charges before any discount). */
export const customTax = (line) => (Number(line.sellingPrice) * Number(line.quantity) * Number(line.gstRate || 0)) / 100;

/** A cart / line-items row for a checked custom item (the shape the sales screens already use, plus custom fields). */
export function toCustomLine(checked, lineKey) {
  const line = {
    lineKey,
    custom: true,
    productId: null,
    productName: checked.name,
    itemName: checked.name,
    quantity: checked.quantity,
    sellingPrice: checked.price,
    gstRate: checked.gstRate,
    hsnCode: checked.hsnCode,
    costPrice: checked.costPrice,
    schemeOff: true, schemeId: null, schemeName: "", schemeDescription: "", freeQuantity: 0, schemeDiscount: 0,
    batchId: null, batchNumber: "", expiryDate: "",
  };
  line.taxAmount = customTax(line);
  line.totalAmount = line.sellingPrice * line.quantity + line.taxAmount;
  return line;
}

/** The form values for editing an existing custom line. */
export const formFromLine = (line) => ({
  name: line?.itemName ?? line?.productName ?? "",
  quantity: line ? String(line.quantity) : "1",
  price: line ? String(line.sellingPrice) : "",
  gstRate: line ? String(line.gstRate ?? 0) : "0",
  hsnCode: line?.hsnCode ?? "",
  costPrice: line?.costPrice != null ? String(line.costPrice) : "",
});

/**
 * GET the shop's billing switches: { allowCustomItems, roundBillTotal, canChange }. When they can't be read, custom
 * items stay hidden and round-off stays on (the server's default).
 */
export async function fetchCustomItemSetting() {
  try {
    const res = await apiClient(`${API_BASE_URL}/api/Sales/CustomItemSetting`, { method: "GET" });
    const json = await res.json();
    if (json?.status === 200 && json.data) {
      return {
        allowCustomItems: !!json.data.allowCustomItems,
        roundBillTotal: json.data.roundBillTotal !== false,
        canChange: !!json.data.canChange,
      };
    }
  } catch {
    // an older backend without the endpoint, or offline: the feature just stays hidden
  }
  return { allowCustomItems: false, roundBillTotal: true, canChange: false };
}

/** PUT the shop's round-off switch (bill totals rounded to the rupee). Resolves to the server's { status, message }. */
export async function saveRoundOffSetting(roundBillTotal) {
  const res = await apiClient(`${API_BASE_URL}/api/Sales/RoundOffSetting`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roundBillTotal }),
  });
  return res.json();
}

/** PUT the shop's switch. Resolves to the server's { status, message }. */
export async function saveCustomItemSetting(allowCustomItems) {
  const res = await apiClient(`${API_BASE_URL}/api/Sales/CustomItemSetting`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ allowCustomItems }),
  });
  return res.json();
}

/** Whether this shop allows custom items on bills (false until known). */
export function useCustomItemsAllowed(enabled = true) {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    fetchCustomItemSetting().then((s) => { if (live) setAllowed(s.allowCustomItems); });
    return () => { live = false; };
  }, [enabled]);
  return allowed;
}
