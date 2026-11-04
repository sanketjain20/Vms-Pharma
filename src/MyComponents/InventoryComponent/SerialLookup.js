// Serial lookup (Phase 6): type or scan a serial number / IMEI and see the unit — which product, whether it is in
// stock, which purchase brought it in (supplier, date, cost), which sale took it out (customer, invoice, date) and
// whether it is still under warranty — with everything that happened to it.

import React, { useState } from "react";
import "../../Styles/CommonAEUDForm/FormShell.css";
import "../../Styles/CommonComponent/Serials.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import { normalizeSerial, warrantyText } from "../../utils/serials";

const STATUS = {
  IN_STOCK: { label: "In stock", color: "var(--afx-success, #10b981)" },
  SOLD: { label: "Sold", color: "var(--afx-accent, #3b82f6)" },
  RETURNED_TO_SUPPLIER: { label: "Returned to supplier", color: "var(--afx-warning, #f59e0b)" },
  IN_TRANSIT: { label: "On a stock transfer", color: "var(--afx-warning, #f59e0b)" }, // Phase 7
  WRITTEN_OFF: { label: "Written off", color: "var(--afx-danger, #ef4444)" },
};

const EVENT = {
  PURCHASED: "Received on purchase",
  SOLD: "Sold",
  SALE_RETURNED: "Returned by the customer",
  PURCHASE_RETURNED: "Returned to the supplier",
  SALE_EDITED: "Back in stock while a sale was edited",
  PURCHASE_EDITED: "Purchase edited",
  TRANSFERRED_OUT: "Sent on a stock transfer",
  TRANSFERRED_IN: "Received from a stock transfer",
  TRANSFER_CANCELLED: "Stock transfer cancelled — back in stock",
  WRITTEN_OFF: "Written off",
};

const day = (v) => (v ? String(v).slice(0, 10).split("-").reverse().join("-") : "—");
const when = (v) => (v ? `${day(v)} ${String(v).slice(11, 16)}` : "—");

export default function SerialLookup() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState({ loading: false, results: null, message: "" });

  const search = async (e) => {
    e.preventDefault();
    const q = normalizeSerial(query);
    if (q.length < 3) { setState({ loading: false, results: null, message: "Type at least 3 characters of the serial number." }); return; }
    setState({ loading: true, results: null, message: "" });
    try {
      const res = await apiClient(`${API_BASE_URL}/api/Serial/Lookup?serial=${encodeURIComponent(q)}`, { method: "GET" });
      const json = await res.json();
      setState({ loading: false, results: Array.isArray(json?.data) ? json.data : [], message: json?.message || "" });
    } catch {
      setState({ loading: false, results: null, message: "" });
    }
  };

  return (
    <div className="i-container srl-page" data-testid="serial-lookup">
      <h2 className="i-title">SERIAL LOOKUP</h2>
      <form className="srl-search" onSubmit={search}>
        <input className="afx-input" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus
          aria-label="Serial number or IMEI" placeholder="Scan or type a serial number / IMEI (or part of it), then Enter" />
        <button type="submit" className="afx-btn afx-btn--primary" disabled={state.loading}>{state.loading ? "Searching…" : "Search"}</button>
      </form>

      {state.results && state.results.length === 0 && <p className="srl-note" data-testid="serial-none">{state.message || "No unit with that serial number."}</p>}
      {!state.results && state.message && <p className="srl-note">{state.message}</p>}

      {(state.results || []).map((u) => {
        const status = STATUS[u.status] || { label: u.status, color: "var(--afx-text-2)" };
        return (
          <section key={`${u.productId}-${u.serialNo}`} className="srl-card" data-testid="serial-card">
            <header className="srl-card-head">
              <div>
                <div className="srl-sn">{u.serialNo}</div>
                <div className="srl-prod">{u.productName} <span className="srl-note">· {u.productCode}</span></div>
              </div>
              <span className="srl-status" style={{ "--srl-status": status.color }} data-testid="serial-status">{status.label}</span>
            </header>

            <div className="srl-facts">
              <div><span className="srl-cap">Batch</span><b>{u.batchNumber || "—"}</b>{u.godown && <span className="srl-note"> · {u.godown}</span>}</div>
              {u.purchase && (
                <div data-testid="serial-purchase"><span className="srl-cap">Bought</span>
                  <b>{u.purchase.purchaseNumber}</b> · {u.purchase.supplier || "—"} · {day(u.purchase.date)}
                  {u.purchase.unitCost != null && <> · ₹{u.purchase.unitCost}</>}
                </div>
              )}
              {u.sale && (
                <div data-testid="serial-sale"><span className="srl-cap">Sold</span>
                  <b>{u.sale.invoiceNumber}</b> · {u.sale.customer}{u.sale.phone ? ` (${u.sale.phone})` : ""} · {when(u.sale.soldAt)}
                  {u.sale.free ? " · free under a scheme" : u.sale.price != null ? ` · ₹${u.sale.price}` : ""}
                </div>
              )}
              <div data-testid="serial-warranty"><span className="srl-cap">Warranty</span>
                {u.warrantyUntil
                  ? <b style={{ color: u.underWarranty ? "var(--afx-success, #10b981)" : "var(--afx-danger, #ef4444)" }}>
                      {warrantyText(u.warrantyUntil)}{u.underWarranty ? " (active)" : " (ended)"}
                    </b>
                  : <span className="srl-note">{u.sale ? "No warranty on this product" : "Starts when sold"}</span>}
              </div>
            </div>

            {u.history?.length > 0 && (
              <ol className="srl-history" data-testid="serial-history">
                {u.history.map((h, i) => (
                  <li key={i}>
                    <b>{EVENT[h.type] || h.type}</b>
                    {h.reference && <> · {h.reference}</>}
                    {h.party && <> · {h.party}</>}
                    {h.note && <span className="srl-note"> · {h.note}</span>}
                    <span className="srl-note"> · {when(h.at)}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        );
      })}
    </div>
  );
}
