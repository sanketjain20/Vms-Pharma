import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import "../../Styles/Accounting.css";
import useModuleActions from "../../utils/useModuleActions";
import { ACCOUNTING_MODULE_ID, PRESETS, presetRange, showDate, EXPORTABLE } from "../../utils/accounting";
import { TrialBalanceView, BalanceSheetView, BookView, ProfitAndLossView, StockValuationView } from "./AccountingReports";
import BankReconciliation from "./BankReconciliation";
import Vouchers, { CashCount } from "./Vouchers";
import { GeneralLedger, DayBookView } from "./Ledgers";
import { CashFlowView, GstLiabilityView, Ageing, PeriodClosing } from "./FinancialReports";
import { ExportButtons, OpeningBalances, AuditTrail } from "./BooksAdmin";

/** The reports, in the order an accountant reads them, and the endpoint each comes from. */
export const ACCOUNTING_TABS = [
  { id: "trial", name: "Trial balance", endpoint: "TrialBalance" },
  { id: "pnl", name: "Profit & Loss", endpoint: "ProfitAndLoss" },
  { id: "balance", name: "Balance sheet", endpoint: "BalanceSheet" },
  { id: "cashflow", name: "Cash flow", endpoint: "CashFlow" },
  { id: "stock", name: "Stock valuation", endpoint: "StockValuation" },
  { id: "ageing", name: "Ageing", endpoint: null },
  { id: "gst", name: "GST liability", endpoint: "GstLiability" },
  { id: "ledger", name: "General ledger", endpoint: null },
  { id: "day", name: "Day book", endpoint: "DayBook" },
  { id: "cash", name: "Cash book", endpoint: "CashBook" },
  { id: "bank", name: "Bank book", endpoint: "BankBook" },
  { id: "vouchers", name: "Vouchers", endpoint: null },
  { id: "recon", name: "Bank reconciliation", endpoint: "BankReconciliation" },
  { id: "opening", name: "Opening balances", endpoint: null },
  { id: "closing", name: "Closing", endpoint: null },
  { id: "audit", name: "Audit trail", endpoint: "Audit" },
];

/**
 * Accounting (module ACCOUNTING): books worked out from bills, purchases and payments for a period — trial balance,
 * balance sheet, cash and bank books — plus bank reconciliation and the Tally XML export. Each part follows its own
 * permission (View / Add / Edit / Download); the server checks them again.
 */
export default function Accounting() {
  const { can } = useModuleActions(ACCOUNTING_MODULE_ID);
  const [tab, setTab] = useState("trial");
  const [preset, setPreset] = useState("fy");
  const [range, setRange] = useState(() => presetRange("fy"));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const endpoint = ACCOUNTING_TABS.find((t) => t.id === tab).endpoint;

  const load = useCallback(async () => {
    if (range.fromDate > range.toDate) return; // the screen says why; nothing to ask the server
    if (!endpoint) { setLoading(false); setError(""); return; } // the tab loads its own
    setLoading(true);
    setError("");
    try {
      const res = await apiClient(`${API_BASE_URL}/api/Accounting/${endpoint}`, { method: "POST", body: JSON.stringify(range) });
      const json = await res.json().catch(() => null);
      if (json?.status === 200) setData(json.data);
      else { setData(null); setError(json?.status === 403 ? "You don't have access to this part of Accounting. Ask an admin to grant it in Roles." : json?.message || "Could not load the books."); }
    } catch {
      setData(null);
      setError("Could not load the books. Check the connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [endpoint, range]);

  useEffect(() => { load(); }, [load]);

  const choosePreset = (id) => { setPreset(id); setRange(presetRange(id)); };
  const setDate = (key) => (e) => {
    const value = e.target.value;
    if (!value) return;
    setPreset("custom");
    setRange((r) => ({ ...r, [key]: value }));
  };
  const backwards = range.fromDate > range.toDate;

  const exportTally = async () => {
    setExporting(true);
    try {
      const res = await apiClient(`${API_BASE_URL}/api/Accounting/TallyExport`, { method: "POST", body: JSON.stringify(range) });
      const type = res.headers?.get?.("Content-Type") || "";
      if (!res.ok || type.includes("json")) {
        const json = await res.json().catch(() => null);
        toast.error(json?.message?.startsWith("Access denied") ? "Exporting needs the Accounting “Download” permission." : json?.message || "The export failed.");
        return;
      }
      const xml = await res.text();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([xml], { type: "application/xml" }));
      a.download = `tally-${range.fromDate}-to-${range.toDate}.xml`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("Tally XML downloaded.");
    } catch {
      toast.error("The export failed. Check the connection and try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <main className="acx" id="accounting-page">
      <header className="acx-head">
        <div>
          <span className="acx-kicker">Finance</span>
          <h1 className="acx-heading">Accounting</h1>
          <p className="acx-lead" data-testid="acx-lead">Books worked out from your bills, purchases, stock and payments · {
            tab === "balance" ? `as at ${showDate(range.toDate)}` : tab === "stock" || tab === "ageing" ? "as of today" : tab === "closing" ? "closing the books" : `${showDate(range.fromDate)} – ${showDate(range.toDate)}`}</p>
        </div>
        {can("Download") && (
          <button type="button" className="acx-btn acx-btn-primary" onClick={exportTally} disabled={exporting || backwards}>
            {exporting ? "Exporting…" : "⇩ Export Tally XML"}
          </button>
        )}
      </header>

      <section className="acx-period" aria-label="Period">
        <div className="acx-chips" role="group" aria-label="Quick periods">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" className={`acx-chip acx-chip-primary ${preset === p.id ? "is-on" : ""}`}
              aria-pressed={preset === p.id} onClick={() => choosePreset(p.id)}>{p.name}</button>
          ))}
        </div>
        <div className="acx-dates">
          <span className="acx-field-k">From</span>
          <input type="date" aria-label="From date" value={range.fromDate} onChange={setDate("fromDate")} />
          <span className="acx-field-k">To</span>
          <input type="date" aria-label="To date" value={range.toDate} onChange={setDate("toDate")} />
        </div>
      </section>

      <nav className="acx-tabs" role="tablist" aria-label="Accounting reports">
        {ACCOUNTING_TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id}
            className={`acx-tab acx-tab-primary ${tab === t.id ? "is-on" : ""}`} onClick={() => { setTab(t.id); setData(null); }}>
            {t.name}
          </button>
        ))}
      </nav>

      {can("Download") && EXPORTABLE[tab] && !backwards && (
        <div className="acx-export-row"><ExportButtons report={EXPORTABLE[tab]} params={range} /></div>
      )}

      <section className="acx-body" role="tabpanel" aria-label={ACCOUNTING_TABS.find((t) => t.id === tab).name}>
        {backwards ? <div className="acx-err" role="alert">The “From” date is after the “To” date.</div>
          : error ? (
            <div className="acx-err" role="alert">
              <span>{error}</span>
              <button type="button" className="acx-btn acx-btn-ghost-primary acx-btn-sm" onClick={load}>Try again</button>
            </div>
          ) : loading && !data ? (
            <div className="acx-loading" data-testid="acx-loading" aria-busy="true"><span /><span /><span /></div>
          ) : tab === "ledger" ? <GeneralLedger range={range} canExport={can("Download")} />
          : tab === "vouchers" ? <Vouchers range={range} can={can} />
          : tab === "ageing" ? <Ageing canExport={can("Download")} />
          : tab === "closing" ? <PeriodClosing can={can} />
          : tab === "opening" ? <OpeningBalances can={can} range={range} />
          : data && (
            <>
              {tab === "trial" && <TrialBalanceView data={data} />}
              {tab === "pnl" && <ProfitAndLossView data={data} />}
              {tab === "balance" && <BalanceSheetView data={data} />}
              {tab === "stock" && <StockValuationView data={data} />}
              {tab === "day" && <DayBookView data={data} />}
              {tab === "cashflow" && <CashFlowView data={data} />}
              {tab === "gst" && <GstLiabilityView data={data} />}
              {tab === "cash" && <BookView data={data} kind="cash" />}
              {tab === "cash" && can("Add") && <CashCount closing={data.closingBalance} asAt={range.toDate} onPosted={load} />}
              {tab === "bank" && <BookView data={data} kind="bank" />}
              {tab === "recon" && <BankReconciliation data={data} can={can} reload={load} range={range} />}
              {tab === "audit" && <AuditTrail data={data} />}
            </>
          )}
      </section>
    </main>
  );
}
