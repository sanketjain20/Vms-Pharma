// A retailer's credit limit on the bill screens: what they owe, what this bill adds, and whether that goes over the limit.
// The server refuses the bill the same way; this only lets the screen say so before saving.

import { useEffect, useState } from "react";
import API_BASE_URL from "../Config/api.config";
import apiClient from "../Config/apiClient";

/**
 * The credit position for a retailer and what a bill leaves unpaid (looked up a moment after they stop changing).
 * null while there is nothing to check (a walk-in, or a bill paid in full) or it is not known yet.
 *
 * @param saleId the bill being edited: what it already owes is not counted twice
 */
export function useCreditCheck(retailerId, unpaid, saleId = null) {
  const [check, setCheck] = useState(null);
  const amount = Math.max(0, Math.round((Number(unpaid) || 0) * 100) / 100);
  useEffect(() => {
    if (!retailerId || amount <= 0) { setCheck(null); return undefined; }
    let live = true;
    const t = setTimeout(() => {
      const q = new URLSearchParams({ retailerId: String(retailerId), unpaid: amount.toFixed(2) });
      if (saleId) q.set("saleId", String(saleId));
      apiClient(`${API_BASE_URL}/api/Sales/CreditCheck?${q.toString()}`, { method: "GET" })
        .then((r) => r.json())
        .then((json) => { if (live) setCheck(json?.status === 200 && json.data ? json.data : null); })
        .catch(() => { if (live) setCheck(null); });
    }, 300);
    return () => { live = false; clearTimeout(t); };
  }, [retailerId, amount, saleId]);
  return check;
}

/** Why the bill can't be saved as it is because of the credit limit, or "". */
export function creditProblem(check, reason) {
  if (!check || !check.over) return "";
  if (!check.canExceed) return `This bill takes ${check.retailer} over their credit limit`;
  if (!String(reason || "").trim()) return "Give a reason to bill over the credit limit";
  return "";
}
