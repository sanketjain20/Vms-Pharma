import React, { useState } from "react";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import "../../Styles/OperationsWorkspace.css";

export default function OperationsWorkspace() {
  return <GstReturnWorkspace />;
}

const money = (n) => `\u20B9${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
function GstReturnWorkspace() {
  const now = new Date();
  const [period, setPeriod] = useState({ month: now.getMonth() + 1, year: now.getFullYear(), quarterly: false, aggregateTurnover: 0, currentTurnover: 0, includeEInvoiced: false });
  const [kind, setKind] = useState("gstr1"), [data, setData] = useState(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const load = async (type = kind) => { setBusy(true); setError(""); try { const r = await apiClient(`${API_BASE_URL}/api/GstReturn/${type === "gstr1" ? "GetGstr1" : "GetGstr3b"}`, { method: "POST", body: JSON.stringify({ ...period, month: Number(period.month), year: Number(period.year) }) }); const j = await r.json(); if (j.status !== 200) throw new Error(j.message || "Unable to prepare return"); setData(j.data); } catch (e) { setError(e.message || "Unable to prepare return"); } finally { setBusy(false); } };
  const exportFile = async (format) => { try { setBusy(true); const name = `Export${kind === "gstr1" ? "Gstr1" : "Gstr3b"}${format}`; const r = await apiClient(`${API_BASE_URL}/api/GstReturn/${name}`, { method: "POST", body: JSON.stringify({ ...period, month: Number(period.month), year: Number(period.year) }) }); if (!r.ok) { const j = await r.json(); throw new Error(j.message || "Export failed"); } const blob = await r.blob(); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `gst-return-${kind}.${format === "Json" ? "json" : "xlsx"}`; a.click(); URL.revokeObjectURL(url); } catch (e) { setError(e.message || "Export failed"); } finally { setBusy(false); } };
  const totals = data?.totals || data?.outwardTaxable || {};
  return <main className="ops-page">
    <header className="ops-header">
      <div><span className="ops-eyebrow">GST COMPLIANCE / RETURNS</span><h1>GST Returns</h1><p>Prepare GSTR-1 and GSTR-3B summaries and export files.</p></div>
    </header>
    <section className="ops-panel ops-gst-filters">
      <label>Return type<select value={kind} onChange={e => { setKind(e.target.value); setData(null); }}><option value="gstr1">GSTR-1</option><option value="gstr3b">GSTR-3B</option></select></label>
      <label>Month<select value={period.month} onChange={e => setPeriod({ ...period, month: e.target.value })}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString("en", { month: "long" })}</option>)}</select></label>
      <label>Year<input type="number" value={period.year} onChange={e => setPeriod({ ...period, year: e.target.value })} /></label>
      <button className="ops-button ops-button-primary" onClick={() => load()} disabled={busy}>{busy ? "Preparing…" : "Prepare return"}</button>
    </section>
    {error && <div className="ops-error" role="alert">{error}</div>}
    {data && <>
      <section className="ops-summary">
        <article><span>Taxable value</span><strong>{money(totals.taxable)}</strong></article>
        <article><span>IGST</span><strong>{money(totals.igst)}</strong></article>
        <article><span>CGST</span><strong>{money(totals.cgst)}</strong></article>
        <article><span>SGST</span><strong>{money(totals.sgst)}</strong></article>
      </section>
      <section className="ops-panel ops-return">
        <header><div><span className="ops-eyebrow">{data.seller?.gstin || "GST RETURN"}</span><h2>{data.period?.label || kind.toUpperCase()}</h2></div><div className="ops-export-actions"><button className="ops-button ops-button-quiet" onClick={() => exportFile("Json")} disabled={busy}>Export JSON</button><button className="ops-button ops-button-quiet" onClick={() => exportFile("Excel")} disabled={busy}>Export Excel</button></div></header>
        <p>{data.invoiceCount ?? 0} invoices · {data.creditNoteCount ?? 0} credit notes</p>
        {data.warnings?.map((warning, i) => <div className="ops-warning" key={i}>{warning}</div>)}
      </section>
    </>}
  </main>;
}
