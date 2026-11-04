import React from "react";

const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * The retailer's credit position on a bill that leaves money unpaid: limit, owed, what this bill adds. Over the limit,
 * a role with "Exceed Credit Limit" gives a reason; anyone else is told to take more payment, bill less or raise the limit.
 */
export default function CreditLimitNotice({ check, reason, onReason }) {
  if (!check || check.noLimit) return null;
  const over = !!check.over;
  return (
    <div className={`afx-credit ${over ? "afx-credit--over" : ""}`} data-testid="credit-limit" role={over ? "alert" : undefined}>
      <div className="afx-credit-line">
        <strong>{over ? "Over the credit limit" : "Credit limit"}</strong>
        <span>{money(check.limit)} · owes {money(check.owed)} · this bill {money(check.adds)} → {money(check.after)}</span>
      </div>
      {over && (
        <div className="afx-credit-line" data-testid="credit-over-by">
          {money(check.overBy)} over.{" "}
          {check.canExceed ? "You can bill over the limit with a reason." : "Take more payment now, bill less, or ask for the limit to be raised (needs “Exceed Credit Limit” to go over)."}
        </div>
      )}
      {over && check.canExceed && (
        <input className="afx-input" aria-label="Reason for going over the credit limit" placeholder="Reason (required)" maxLength={300}
          value={reason || ""} onChange={(e) => onReason(e.target.value)} />
      )}
    </div>
  );
}
