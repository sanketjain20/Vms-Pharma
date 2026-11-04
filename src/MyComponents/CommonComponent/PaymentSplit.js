import React from "react";
import "../../Styles/CommonComponent/PaymentSplit.css";
import { PAYMENT_MODES, fillLast, paymentsTotal } from "../../utils/salePayments";

/**
 * How a bill is paid, split across modes: one row per payment (Cash / UPI / Card, amount, optional reference) and
 * "+ Split payment" to add another mode. For a bill paid in full the last row is filled in with what the others leave,
 * so the clerk types the cash and the UPI part follows. Nothing is shown for a credit bill.
 *
 * @param type     PAID / PARTIAL / CREDIT
 * @param net      the bill total
 * @param payments [{ mode, amount, reference }]
 * @param onChange the new list
 */
export default function PaymentSplit({ type, net, payments, onChange, error }) {
  if (type === "CREDIT") return null;
  const list = payments || [];
  const paidInFull = type === "PAID";

  const set = (next) => onChange(paidInFull ? fillLast(next, net) : next);
  const update = (i, patch) => set(list.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  const remove = (i) => set(list.filter((_, k) => k !== i));
  const add = () => {
    const used = new Set(list.map((p) => p.mode));
    const next = PAYMENT_MODES.find((m) => !used.has(m.id)) || PAYMENT_MODES[0];
    set([...list, { mode: next.id, amount: paidInFull ? "0.00" : "", reference: "" }]);
  };

  const total = paymentsTotal(list);
  const left = Math.max(0, Math.round((Number(net) - total) * 100) / 100);

  return (
    <div className="pay-split" data-testid="payment-split">
      {list.map((p, i) => {
        const autoFilled = paidInFull && i === list.length - 1 && list.length > 1;
        return (
          <div className="pay-split-line" key={i} data-testid="payment-row">
            <select aria-label={`Payment ${i + 1} mode`} value={p.mode} onChange={(e) => update(i, { mode: e.target.value })}>
              {PAYMENT_MODES.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <input aria-label={`Payment ${i + 1} amount`} type="number" min="0" step="0.01" placeholder="Amount"
              value={p.amount} readOnly={autoFilled || (paidInFull && list.length === 1)}
              title={autoFilled ? "What the other payments leave of the bill" : undefined}
              onChange={(e) => update(i, { amount: e.target.value })} />
            {p.mode !== "CASH" && (
              <input aria-label={`Payment ${i + 1} reference`} type="text" maxLength={60} placeholder="Ref / txn no. (optional)"
                value={p.reference || ""} onChange={(e) => update(i, { reference: e.target.value })} />
            )}
            {list.length > 1 && (
              <button type="button" className="pay-split-remove" aria-label={`Remove payment ${i + 1}`} onClick={() => remove(i)}>×</button>
            )}
          </div>
        );
      })}
      <div className="pay-split-foot">
        {list.length < PAYMENT_MODES.length && (
          <button type="button" className="pay-split-add pay-split-primary" onClick={add}>+ Split payment</button>
        )}
        <span className="pay-split-sum" data-testid="payment-sum">
          Paid ₹{total.toFixed(2)}{type === "PARTIAL" ? ` · Due ₹${left.toFixed(2)}` : ""}
        </span>
      </div>
      {error && <div className="pay-split-err" role="alert">{error}</div>}
    </div>
  );
}
