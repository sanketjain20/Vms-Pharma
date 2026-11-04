// Phase 7 — supplier free-goods schemes: purchase entry asks the server which scheme applies to a line (supplier,
// product, invoice date, quantity) and fills its Free quantity. A Free typed by hand is never overwritten.

import { useEffect } from "react";
import apiClient from "../Config/apiClient";
import API_BASE_URL from "../Config/api.config";

const cache = new Map(); // "supplier|product|date|qty" -> Promise<{ label, freeForQuantity } | null>

export function fetchSupplierScheme(supplierId, productId, date, quantity) {
  const key = [supplierId, productId, date, quantity].join("|");
  if (!cache.has(key)) {
    const q = new URLSearchParams({ productId: String(productId), quantity: String(quantity) });
    if (supplierId) q.set("supplierId", String(supplierId));
    if (date) q.set("date", date);
    cache.set(key, apiClient(`${API_BASE_URL}/api/SupplierScheme/Applicable?${q}`, { method: "GET" })
      .then((r) => r.json())
      .then((json) => (json?.status === 200 && json.data ? json.data : null))
      .catch(() => null));
  }
  return cache.get(key);
}

/** Forget the looked-up schemes (between tests, and after the schemes change). */
export function resetSupplierSchemeCache() {
  cache.clear();
}

/** Lines whose Free should follow the supplier's scheme: a product and a quantity, and no Free typed by hand. */
const autoLine = (it) => it.productId && Number(it.quantity) > 0 && !it.freeManual;

/**
 * Keeps each line's Free quantity (and the scheme's name, {@code schemeLabel}) in step with the supplier's scheme.
 * {@code setItems(updater)} receives the current lines and returns the new ones.
 */
export function useSupplierSchemeFill({ enabled, supplierId, date, items, setItems }) {
  const signature = enabled
    ? items.map((it) => (autoLine(it) ? `${it.productId}:${it.quantity}` : "-")).join(",") + `|${supplierId}|${date}`
    : "";
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    items.forEach((it, i) => {
      if (!autoLine(it)) return;
      fetchSupplierScheme(supplierId, it.productId, date, Number(it.quantity)).then((scheme) => {
        if (!alive) return;
        setItems((current) => {
          const line = current[i];
          // the line may have changed while the answer was on its way
          if (!line || String(line.productId) !== String(it.productId) || String(line.quantity) !== String(it.quantity) || line.freeManual) {
            return current;
          }
          const freeQuantity = scheme && scheme.freeForQuantity > 0 ? String(scheme.freeForQuantity) : "";
          const schemeLabel = scheme ? scheme.label : "";
          if (line.freeQuantity === freeQuantity && (line.schemeLabel || "") === schemeLabel) return current;
          const next = [...current];
          next[i] = { ...line, freeQuantity, schemeLabel };
          return next;
        });
      });
    });
    return () => { alive = false; };
    // the signature covers what matters in items
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
}
