import React, { useEffect, useState } from "react";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import "../../Styles/Accounting.css";

const endpoints = { cash: "CashBook", bank: "BankBook", trial: "TrialBalance", balance: "BalanceSheet", recon: "BankReconciliation" };
const money = value => `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

export default function Accounting() {
  const [tab, setTab] = useState("trial"), [data, setData] = useState(null), [error, setError] = useState("");
  const [filter, setFilter] = useState({ fromDate: "", toDate: "" });
  const load = async () => {
    setError(""); const response = await apiClient(`${API_BASE_URL}/api/Accounting/${endpoints[tab]}`, { method: "POST", body: JSON.stringify(filter) });
    const json = await response.json(); if (json.status === 200) setData(json.data); else setError(json.message || "Could not load accounting data");
  };
  useEffect(() => { load().catch(() => setError("Could not load accounting data")); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  const exportTally = async () => { const r = await apiClient(`${API_BASE_URL}/api/Accounting/TallyExport`, { method: "POST", body: JSON.stringify(filter) }); const xml = await r.text(); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([xml], { type: "application/xml" })); a.download = "accounting-tally.xml"; a.click(); URL.revokeObjectURL(a.href); };
  const rows = data?.rows || data?.entries || [];
  return <main className="accounting-page container-fluid">
    <header className="accounting-header"><div><span className="accounting-eyebrow">FINANCE · REPORTING</span><h1>Accounting</h1><p>CA-ready books, reconciliation and Tally XML</p></div><button className="accounting-export" onClick={exportTally}><span aria-hidden="true">⇩</span> Export Tally XML</button></header>
    <nav className="accounting-tabs" aria-label="Accounting reports">{Object.keys(endpoints).map(key => <button key={key} className={`accounting-tab ${tab === key ? "is-active" : ""}`} aria-current={tab === key ? "page" : undefined} onClick={() => setTab(key)}>{({cash:"Cash book",bank:"Bank book",trial:"Trial balance",balance:"Balance sheet",recon:"Bank reconciliation"})[key]}</button>)}</nav>
    <section className="accounting-filters"><div className="accounting-date-field"><label htmlFor="accounting-from">From</label><input id="accounting-from" type="date" value={filter.fromDate} onChange={e=>setFilter({...filter,fromDate:e.target.value})}/></div><div className="accounting-date-field"><label htmlFor="accounting-to">To</label><input id="accounting-to" type="date" value={filter.toDate} onChange={e=>setFilter({...filter,toDate:e.target.value})}/></div><button className="accounting-apply" onClick={load}>Apply filters</button></section>
    {error && <div className="alert alert-danger">{error}</div>}
    {tab === "balance" && data && <div className="row"><Section title="Assets" rows={data.assets}/><Section title="Liabilities & equity" rows={data.liabilities}/></div>}
    {tab === "trial" && data && <><div className={`alert ${data.balanced ? "alert-success" : "alert-danger"}`}>{data.balanced ? "Trial balance agrees" : "Trial balance does not agree"} — Debit {money(data.totalDebit)}, Credit {money(data.totalCredit)}</div><Table rows={rows} /></>}
    {(tab === "cash" || tab === "bank") && data && <><div className="alert alert-info">Closing balance: {money(data.closingBalance)}</div><Table rows={rows}/></>}
    {tab === "recon" && data && <><div className="alert alert-warning">Bank book {money(data.bankBookBalance)} · Statement {money(data.statementBalance)} · Difference {money(data.unreconciledDifference)}</div><Table rows={rows}/></>}
  </main>;
}
function Section({title,rows=[]}) { return <div className="col-md-6 accounting-section"><div className="accounting-card"><div className="accounting-card-heading">{title}</div><ul>{rows.map(r=><li key={r.ledger}><span>{r.ledger}</span><b>{money(r.amount)}</b></li>)}</ul></div></div>; }
function Table({rows}) { if (!rows.length) return <div className="accounting-empty">No entries in this period.</div>; const keys=Object.keys(rows[0]).filter(k=>k!=="suggestedPaymentUKeys"); return <div className="accounting-table-wrap"><table className="accounting-table"><thead><tr>{keys.map(k=><th key={k}>{k}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={r.statementUKey||r.reference||i}>{keys.map(k=><td key={k}>{typeof r[k] === "number" ? money(r[k]) : r[k]}</td>)}</tr>)}</tbody></table></div>; }
