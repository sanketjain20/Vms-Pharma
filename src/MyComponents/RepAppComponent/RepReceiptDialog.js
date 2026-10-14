import React, { useEffect, useState } from "react";
import { receiptModel, receiptText, whatsappLink } from "./repReceipt";

/**
 * The receipt a rep shows the retailer. Print uses the browser's print dialog (which can also "save as PDF");
 * Share uses the phone's share sheet when there is one, WhatsApp opens a pre-filled message.
 * It is an acknowledgement slip — until the office confirms the payment it says so.
 */
export default function ReceiptDialog({ collection, company, repName, onClose }) {
  const [msg, setMsg] = useState(null);
  const m = receiptModel(collection, { company, repName });
  const text = receiptText(collection, { company, repName });

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const share = async () => {
    try {
      await navigator.share({ title: "Payment receipt " + m.number, text });
    } catch (e) {
      if (e && e.name !== "AbortError") setMsg("Couldn't open the share sheet.");
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setMsg("Receipt copied.");
    } catch {
      setMsg("Couldn't copy — use Print or WhatsApp instead.");
    }
  };

  return (
    <div className="ra-modal-back" onClick={onClose}>
      <div className="ra-modal" role="dialog" aria-modal="true" aria-label="Payment receipt" onClick={(e) => e.stopPropagation()}>
        <div className="ra-receipt-sheet" data-testid="receipt-sheet">
          <div className="ra-receipt-company">{m.company}</div>
          <div className="ra-receipt-title">Payment receipt</div>
          <dl className="ra-receipt-rows">
            <div><dt>Receipt no.</dt><dd>{m.number}</dd></div>
            <div><dt>Date</dt><dd>{m.date}</dd></div>
            <div><dt>Received from</dt><dd>{m.retailer}</dd></div>
            <div><dt>Mode</dt><dd>{m.mode}{m.reference ? " · Ref " + m.reference : ""}</dd></div>
            <div><dt>Against</dt><dd>{m.invoice ? "Invoice " + m.invoice : "Account balance"}</dd></div>
            {m.repName && <div><dt>Collected by</dt><dd>{m.repName}</dd></div>}
          </dl>
          <div className="ra-receipt-amount">{m.amountText}</div>
          <div className="ra-receipt-words">{m.words}</div>
          <p className={"ra-receipt-status " + (m.confirmed ? "is-ok" : "is-pending")}>{m.statusLine}</p>
        </div>

        {msg && <p className="ra-muted" role="status" style={{ marginTop: 8 }}>{msg}</p>}
        <div className="ra-modal-actions">
          <button className="ra-btn ra-btn--primary" onClick={() => window.print()}>Print</button>
          {canShare && <button className="ra-btn" onClick={share}>Share</button>}
          <a className="ra-btn" href={whatsappLink(text)} target="_blank" rel="noopener noreferrer">WhatsApp</a>
          <button className="ra-btn" onClick={copy}>Copy</button>
          <button className="ra-btn ra-btn--ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
