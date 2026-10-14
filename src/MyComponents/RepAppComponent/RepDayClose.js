import React, { useMemo, useState } from "react";
import { HANDOVER_STATUS, HANDOVER_STATUS_META, differenceText, difference, eligibleCash, expectedCash, unifyHandovers, validateHandover } from "./repHandover";
import { MODE_LABEL } from "./repCollections";
import FieldPager from "../FieldRepComponent/FieldPager";
import useLocalPaging from "../FieldRepComponent/useLocalPaging";

const DC_PAGE = 6; // cash lines / day-closes per page — keeps the card short so the totals below never scroll away

const fmtMoney = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtTime = (d) => (d ? new Date(d).toLocaleString() : "");

/**
 * "Close the day": hand over the cash you collected. The rep counts the notes, we show the difference from what
 * they recorded, and the office later marks it received (or flags it). Works offline like everything else.
 */
export default function DayClose({ history, localHandovers, serverHandovers, onSubmit, onCancel, onDiscard }) {
  const eligible = useMemo(() => eligibleCash(history), [history]);
  const [skipped, setSkipped] = useState(() => new Set());
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(null);

  const chosen = eligible.filter((c) => !skipped.has(c.clientCollectionId));
  const expected = expectedCash(chosen);
  const hasCount = String(counted).trim() !== "" && Number.isFinite(Number(counted));
  const diff = hasCount ? difference(counted, expected) : null;
  const list = useMemo(() => unifyHandovers(localHandovers, serverHandovers), [localHandovers, serverHandovers]);
  const cashPaging = useLocalPaging(eligible, (c) => `${c.retailerName} ${MODE_LABEL[c.mode] || ""}`, DC_PAGE);
  const closedPaging = useLocalPaging(list, () => "", DC_PAGE);

  const toggle = (id) => setSkipped((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const submit = async () => {
    const problem = validateHandover({ count: chosen.length, counted });
    if (problem) return setError(problem);
    if (diff !== 0 && diff !== null && !note.trim()) return setError("Your count doesn't match — add a note saying why (for example, a retailer short-paid).");
    setError(null);
    setSaving(true);
    try {
      const r = await onSubmit({ collectionIds: chosen.map((c) => c.clientCollectionId), expectedCash: expected, cashCounted: counted, note });
      if (r && r.ok) { setCounted(""); setNote(""); setSkipped(new Set()); }
      else if (r && r.message) setError(r.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ra-collect-layout">
      <section className="ra-card ra-dc-card" aria-label="Close the day">
        <h3 className="ra-card-title">Cash to hand over</h3>

        {eligible.length === 0 ? (
          <p className="ra-muted">No cash waiting to be handed over. Cash you collect shows up here.</p>
        ) : (
          <>
            <div className="ra-dc-scroll">
            <ul className="ra-dc-list">
              {cashPaging.pageRows.map((c) => (
                <li key={c.clientCollectionId}>
                  <label>
                    <input type="checkbox" checked={!skipped.has(c.clientCollectionId)} onChange={() => toggle(c.clientCollectionId)}
                      aria-label={"Include cash from " + c.retailerName} />
                    <span className="ra-dc-who">{c.retailerName}<span className="ra-muted"> · {MODE_LABEL[c.mode]} · {fmtTime(c.capturedAt)}</span></span>
                    <span className="ra-dc-amt">{fmtMoney(c.amount)}</span>
                  </label>
                </li>
              ))}
            </ul>
            </div>
            <FieldPager variant="ra" page={cashPaging.page} totalPages={cashPaging.totalPages} onChange={cashPaging.setPage} label="Cash to hand over pages" />

            <div className="ra-dc-footer">
            <div className="ra-dc-total"><span>Cash you recorded</span><strong data-testid="dc-expected">{fmtMoney(expected)}</strong></div>

            <label className="ra-label" htmlFor="ra-dc-counted">Cash you are handing over (₹)</label>
            <input id="ra-dc-counted" className="ra-input" type="text" inputMode="decimal" placeholder="Count it, then enter it" value={counted}
              onChange={(e) => setCounted(e.target.value.replace(/[^0-9.]/g, ""))} />

            {diff !== null && (
              <p className={"ra-dc-diff " + (diff === 0 ? "is-ok" : "is-off")} role="status" data-testid="dc-diff">{differenceText(diff, fmtMoney)}</p>
            )}

            <label className="ra-label" htmlFor="ra-dc-note">Note{diff ? "" : " (optional)"}</label>
            <input id="ra-dc-note" className="ra-input" value={note} maxLength={255} onChange={(e) => setNote(e.target.value)} />

            {error && <p className="ra-toast ra-toast--bad" role="alert" style={{ marginTop: 12 }}>{error}</p>}
            <button className="ra-btn ra-btn--primary ra-btn--block" style={{ marginTop: 14 }} disabled={saving || chosen.length === 0} onClick={submit}>
              {saving ? "Closing…" : "Close the day"}
            </button>
            </div>
          </>
        )}
      </section>

      <section aria-label="Day-closes">
        <h3 className="ra-section-title" style={{ marginTop: 0 }}>Handed over</h3>
        {list.length === 0 && <p className="ra-muted">Nothing handed over yet.</p>}
        <div className="ra-orders">
          {closedPaging.pageRows.map((h) => {
            const [label, tone] = HANDOVER_STATUS_META[h.status];
            const canCancel = h.local && h.status === HANDOVER_STATUS.PENDING && !h.attempted;
            return (
              <article className="ra-card ra-order" key={h.key}>
                <div className="ra-order-top">
                  <div className="ra-order-who">
                    <h3 className="ra-card-title">{fmtMoney(h.counted)} handed over</h3>
                    <div className="ra-muted">{h.count} collection{h.count === 1 ? "" : "s"} · {fmtTime(h.capturedAt)}</div>
                  </div>
                  <span className={"ra-badge ra-badge--" + tone}>{label}</span>
                  <div className="ra-order-actions">
                    {canCancel && confirming !== h.key && (
                      <button className="ra-btn ra-btn--sm ra-btn--danger" onClick={() => setConfirming(h.key)}>Cancel</button>
                    )}
                    {h.status === HANDOVER_STATUS.INVALID && h.local && (
                      <button className="ra-btn ra-btn--sm ra-btn--danger" onClick={() => onDiscard(h.clientHandoverId)}>Discard</button>
                    )}
                  </div>
                </div>
                <div className={"ra-muted ra-dc-line " + (h.difference !== 0 ? "is-off" : "")}>
                  Expected {fmtMoney(h.expected)} · {differenceText(h.difference, fmtMoney)}
                </div>
                {h.note && <div className="ra-muted">Note: {h.note}</div>}
                {h.status === HANDOVER_STATUS.FLAGGED && <div className="ra-conflict">Flagged by the office{h.officeNote ? ": " + h.officeNote : ""}</div>}
                {h.status === HANDOVER_STATUS.INVALID && <div className="ra-conflict">{h.message}</div>}
                {h.status === HANDOVER_STATUS.PENDING && h.attempted && <div className="ra-muted">On its way to the office.</div>}
                {confirming === h.key && (
                  <div className="ra-confirm" role="group" aria-label="Confirm cancel day-close">
                    <span>Cancel this day-close? The cash goes back to "waiting to be handed over".</span>
                    <div className="ra-confirm-actions">
                      <button className="ra-btn ra-btn--sm ra-btn--danger" onClick={async () => { await onCancel(h.clientHandoverId); setConfirming(null); }}>Yes, cancel it</button>
                      <button className="ra-btn ra-btn--sm" onClick={() => setConfirming(null)}>Keep it</button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
        <FieldPager variant="ra" page={closedPaging.page} totalPages={closedPaging.totalPages} onChange={closedPaging.setPage} label="Day-closes pages" />
      </section>
    </div>
  );
}
