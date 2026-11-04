import React, { useState } from "react";
import { money, moneyOrBlank, showDate, groupTrialBalance, bookTotals, searchRows } from "../../utils/accounting";

/** One headline figure. tone: "good" / "bad" / "in" / "out" colours it. */
export function Kpi({ label, figure, note, tone, testId }) {
  return (
    <div className={`acx-kpi ${tone ? `acx-kpi--${tone}` : ""}`} data-testid={testId}>
      <span className="acx-kpi-k">{label}</span>
      <strong className="acx-kpi-fig">{figure}</strong>
      {note && <span className="acx-kpi-note">{note}</span>}
    </div>
  );
}

export function Nothing({ children }) {
  return <div className="acx-nothing" data-testid="acx-nothing">{children}</div>;
}

const GROUP_LABEL = { Asset: "Assets", Liability: "Liabilities", Equity: "Equity", Income: "Income", Expense: "Expenses" };

/** Debits and credits per ledger, grouped, with whether the two sides agree. */
export function TrialBalanceView({ data }) {
  const rows = data?.rows || [];
  const diff = Number(data?.totalDebit || 0) - Number(data?.totalCredit || 0);
  return (
    <>
      <div className="acx-kpis">
        <Kpi label="Total debit" figure={money(data?.totalDebit)} testId="tb-debit" />
        <Kpi label="Total credit" figure={money(data?.totalCredit)} testId="tb-credit" />
        <Kpi label="Status" testId="tb-status" tone={data?.balanced ? "good" : "bad"}
          figure={data?.balanced ? "Agrees" : "Does not agree"}
          note={data?.balanced ? "Debits equal credits" : `Off by ${money(Math.abs(diff))}`} />
        <Kpi label="Ledgers" figure={rows.length} />
      </div>
      {rows.length === 0 ? <Nothing>No entries in this period.</Nothing> : (
        <div className="acx-scroll">
          <table className="acx-tbl" data-testid="tb-table">
            <thead><tr><th>Ledger</th><th className="acx-num">Debit</th><th className="acx-num">Credit</th></tr></thead>
            {groupTrialBalance(rows).map((g) => (
              <tbody key={g.group}>
                <tr className="acx-grp"><td colSpan={3}><span className={`acx-pill acx-pill--${g.group.toLowerCase()}`}>{GROUP_LABEL[g.group]}</span></td></tr>
                {g.items.map((r) => (
                  <tr key={r.ledger}>
                    <td>{r.ledger}</td>
                    <td className="acx-num">{moneyOrBlank(r.debit)}</td>
                    <td className="acx-num">{moneyOrBlank(r.credit)}</td>
                  </tr>
                ))}
              </tbody>
            ))}
            <tfoot>
              <tr><td>Total</td><td className="acx-num">{money(data?.totalDebit)}</td><td className="acx-num">{money(data?.totalCredit)}</td></tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}

function Lines({ lines = [] }) {
  return (
    <ul className="acx-lines">
      {lines.map((l) => <li key={l.ledger}><span>{l.ledger}</span><span className="acx-num">{money(l.amount)}</span></li>)}
    </ul>
  );
}

/** One side of the balance sheet; parts = [{ title, lines }] (a title only when the side holds more than one kind). */
function Side({ heading, parts = [], sum, testId }) {
  const any = parts.some((p) => (p.lines || []).length > 0);
  return (
    <section className="acx-side" data-testid={testId}>
      <h3 className="acx-side-head">{heading}</h3>
      {!any ? <p className="acx-side-none">Nothing up to this date.</p> : parts.filter((p) => (p.lines || []).length > 0).map((p) => (
        <div key={p.title || "lines"}>
          {p.title && <div className="acx-side-part">{p.title}</div>}
          <Lines lines={p.lines} />
        </div>
      ))}
      <div className="acx-side-sum"><span>Total</span><span className="acx-num">{money(sum)}</span></div>
    </section>
  );
}

/** Assets against liabilities and equity, side by side, as at the period's last day. */
export function BalanceSheetView({ data }) {
  const right = Number(data?.totalLiabilities || 0) + Number(data?.totalEquity || 0);
  const diff = Number(data?.totalAssets || 0) - right;
  return (
    <>
      <div className="acx-kpis">
        <Kpi label="Total assets" figure={money(data?.totalAssets)} testId="bs-assets" note={data?.asAt ? `As at ${showDate(data.asAt)}` : undefined} />
        <Kpi label="Liabilities & equity" figure={money(right)} testId="bs-liabilities" />
        <Kpi label="Difference" testId="bs-diff" tone={Math.abs(diff) < 0.005 ? "good" : "bad"} figure={money(diff)}
          note={Math.abs(diff) < 0.005 ? "Both sides match" : "The two sides should match"} />
      </div>
      <div className="acx-sides">
        <Side heading="Assets" parts={[{ lines: data?.assets }]} sum={data?.totalAssets} testId="bs-side-assets" />
        <Side heading="Liabilities & equity" parts={[{ title: "Liabilities", lines: data?.liabilities }, { title: "Equity", lines: data?.equity }]}
          sum={right} testId="bs-side-liabilities" />
      </div>
    </>
  );
}

const pct = (v) => (v === null || v === undefined ? "—" : `${Number(v).toFixed(2)}%`);

/** Sales less returns, less what the goods sold cost, then the other income and expenses: the period's profit. */
export function ProfitAndLossView({ data }) {
  const other = data?.otherLines || [];
  const net = Number(data?.netProfit || 0);
  const empty = !Number(data?.grossSales || 0) && !Number(data?.costOfGoodsSold || 0) && other.length === 0;
  return (
    <>
      <div className="acx-kpis">
        <Kpi label="Net sales" figure={money(data?.netSales)} tone="in" testId="pl-sales" />
        <Kpi label="Cost of goods sold" figure={money(data?.costOfGoodsSold)} tone="out" testId="pl-cogs" note="At the cost of each batch sold" />
        <Kpi label="Gross profit" figure={money(data?.grossProfit)} testId="pl-gross" note={`Margin ${pct(data?.grossMarginPercent)}`} />
        <Kpi label={net < 0 ? "Net loss" : "Net profit"} figure={money(net)} tone={net < 0 ? "bad" : "good"} testId="pl-net"
          note={data?.netMarginPercent !== undefined ? `Net margin ${pct(data?.netMarginPercent)}` : undefined} />
      </div>
      {empty ? <Nothing>No sales, cost, income or expenses in this period.</Nothing> : (
        <section className="acx-stmt" data-testid="pl-statement" aria-label="Profit and loss statement">
          <ul className="acx-lines">
            <li><span>Sales</span><span className="acx-num">{money(data?.grossSales)}</span></li>
            <li><span>Less: sales returns</span><span className="acx-num">{money(-Number(data?.salesReturns || 0))}</span></li>
            <li className="acx-stmt-sub"><span>Net sales</span><span className="acx-num">{money(data?.netSales)}</span></li>
            <li><span>Less: cost of goods sold</span><span className="acx-num">{money(-Number(data?.costOfGoodsSold || 0))}</span></li>
            <li className="acx-stmt-sub" data-testid="pl-gross-line"><span>Gross profit</span><span className="acx-num">{money(data?.grossProfit)}</span></li>
            {["Other income", "Expenses"].map((section) => {
              const lines = other.filter((l) => (l.section || "Expenses") === section);
              if (!lines.length) return null;
              const total = section === "Other income" ? data?.otherIncome : (data?.expenses !== undefined ? -Number(data.expenses) : lines.reduce((s, l) => s + Number(l.amount), 0));
              return (
                <React.Fragment key={section}>
                  <li className="acx-stmt-head" data-testid={`pl-section-${section === "Expenses" ? "expenses" : "income"}`}><span>{section === "Expenses" ? "Less: expenses" : "Add: other income"}</span><span /></li>
                  {lines.map((l) => <li key={l.ledger} className="acx-stmt-item"><span>{l.ledger}</span><span className="acx-num">{money(l.amount)}</span></li>)}
                  <li className="acx-stmt-sub"><span>Total {section === "Expenses" ? "expenses" : "other income"}</span><span className="acx-num">{money(total)}</span></li>
                </React.Fragment>
              );
            })}
          </ul>
          <div className="acx-side-sum" data-testid="pl-net-line"><span>{net < 0 ? "Net loss" : "Net profit"}</span><span className="acx-num">{money(net)}</span></div>
        </section>
      )}
    </>
  );
}

/** Stock on hand per product and godown at the average cost of its batches, against what the books say the stock is worth. */
export function StockValuationView({ data }) {
  const [query, setQuery] = useState("");
  const rows = data?.rows || [];
  const shown = searchRows(rows, query, ["product", "godown"]);
  const [open, setOpen] = useState(null);
  const diff = Number(data?.difference || 0);
  const agrees = Math.abs(diff) < 0.005;
  return (
    <>
      <div className="acx-kpis">
        <Kpi label="Stock value" figure={money(data?.totalValue)} testId="sv-value" note={`${data?.totalUnits || 0} units · ${rows.length} product${rows.length === 1 ? "" : "s"}`} />
        <Kpi label="Inventory in the books" figure={money(data?.ledgerBalance)} testId="sv-ledger" note="Purchases and stock in, less cost of goods sold and write-offs" />
        <Kpi label="Difference" figure={money(diff)} tone={agrees ? "good" : "bad"} testId="sv-diff"
          note={agrees ? "The books match the stock" : "Stock with no purchase or opening entry, or bought at a different price than the batch cost"} />
        {(Number(data?.expiredValue || 0) > 0 || Number(data?.nearExpiryValue || 0) > 0) && (
          <Kpi label="Expired / expiring" figure={money(Number(data?.expiredValue || 0) + Number(data?.nearExpiryValue || 0))} tone="out" testId="sv-expiry"
            note={`${money(data?.expiredValue)} expired · ${money(data?.nearExpiryValue)} within 90 days`} />
        )}
      </div>
      {rows.length === 0 ? <Nothing>No stock on hand.</Nothing> : (
        <>
          <div className="acx-tools">
            <input className="acx-search" type="search" placeholder="Search product, godown…" aria-label="Search stock"
              value={query} onChange={(e) => setQuery(e.target.value)} />
            {query && <span className="acx-found">{shown.length} of {rows.length}</span>}
          </div>
          <div className="acx-scroll">
            <table className="acx-tbl" data-testid="sv-table">
              <thead><tr><th>Product</th><th>Godown</th><th className="acx-num">Batches</th><th>Nearest expiry</th><th className="acx-num">Qty</th><th className="acx-num">Avg. unit cost</th><th className="acx-num">Value</th></tr></thead>
              <tbody>
                {shown.map((r, i) => {
                  const key = `${r.product}-${r.godown}-${i}`;
                  const lines = r.batchLines || [];
                  return (
                    <React.Fragment key={key}>
                      <tr className={open === key ? "acx-open" : ""}>
                        <td>{r.product}</td>
                        <td>{r.godown}</td>
                        <td className="acx-num">{lines.length ? (
                          <button type="button" className="acx-btn acx-btn-ghost-primary acx-btn-sm" aria-expanded={open === key}
                            aria-label={`${r.batches} batches of ${r.product}`} onClick={() => setOpen(open === key ? null : key)}>{r.batches} {open === key ? "▾" : "▸"}</button>
                        ) : r.batches}</td>
                        <td className="acx-nowrap">{r.nearestExpiry ? showDate(r.nearestExpiry) : "—"}</td>
                        <td className="acx-num">{r.quantity}</td>
                        <td className="acx-num">{money(r.unitCost)}</td>
                        <td className="acx-num acx-strong">{money(r.value)}</td>
                      </tr>
                      {open === key && (
                        <tr className="acx-drawer"><td colSpan={7}>
                          <table className="acx-tbl acx-subtbl" data-testid="sv-batches">
                            <thead><tr><th>Batch</th><th>Expiry</th><th className="acx-num">Qty</th><th className="acx-num">Batch cost</th><th className="acx-num">Value</th><th /></tr></thead>
                            <tbody>
                              {lines.map((b, j) => (
                                <tr key={`${b.batchNumber}-${j}`}>
                                  <td className="acx-ref">{b.batchNumber || "—"}</td>
                                  <td className="acx-nowrap">{b.expiryDate ? showDate(b.expiryDate) : "—"}</td>
                                  <td className="acx-num">{b.quantity}</td>
                                  <td className="acx-num">{money(b.unitCost)}</td>
                                  <td className="acx-num">{money(b.value)}</td>
                                  <td>{b.status !== "OK" && <span className={`acx-pill acx-pill--${b.status === "EXPIRED" ? "warn" : "out"}`}>{b.status === "EXPIRED" ? "Expired" : "Expires soon"}</span>}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td></tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {shown.length === 0 && <tr><td colSpan={7} className="acx-none-cell">Nothing matches “{query}”.</td></tr>}
              </tbody>
              <tfoot><tr><td colSpan={4}>Total</td><td className="acx-num">{data?.totalUnits}</td><td /><td className="acx-num">{money(data?.totalValue)}</td></tr></tfoot>
            </table>
          </div>
        </>
      )}
    </>
  );
}

const VOUCHER_TONE = { Receipt: "in", Payment: "out", Sales: "in", Purchase: "out", "Credit Note": "out", "Debit Note": "in", Journal: "plain", Contra: "plain" };

/** Cash book or bank book: every receipt and payment with the running balance, searchable. */
export function BookView({ data, kind }) {
  const [query, setQuery] = useState("");
  const entries = data?.entries || [];
  const { receipts, payments } = bookTotals(entries);
  const shown = searchRows(entries, query, ["reference", "narration", "mode", "date"]);
  return (
    <>
      <div className="acx-kpis">
        <Kpi label="Opening balance" figure={money(data?.openingBalance)} />
        <Kpi label="Money in" figure={money(receipts)} tone="in" testId="book-in" />
        <Kpi label="Money out" figure={money(payments)} tone="out" testId="book-out" />
        <Kpi label="Closing balance" figure={money(data?.closingBalance)} testId="book-closing"
          note={`${entries.length} entr${entries.length === 1 ? "y" : "ies"}`} />
      </div>
      {entries.length === 0 ? <Nothing>No {kind === "bank" ? "bank" : "cash"} receipts or payments in this period.</Nothing> : (
        <>
          <div className="acx-tools">
            <input className="acx-search" type="search" placeholder="Search reference, narration…" aria-label="Search entries"
              value={query} onChange={(e) => setQuery(e.target.value)} />
            {query && <span className="acx-found">{shown.length} of {entries.length}</span>}
          </div>
          <div className="acx-scroll">
            <table className="acx-tbl" data-testid="book-table">
              <thead><tr><th>Date</th><th>Voucher</th><th>Reference</th><th>Narration</th><th className="acx-num">Money in</th><th className="acx-num">Money out</th><th className="acx-num">Balance</th></tr></thead>
              <tbody>
                {shown.map((e, i) => (
                  <tr key={`${e.reference}-${i}`}>
                    <td className="acx-nowrap">{showDate(e.date)}</td>
                    <td><span className={`acx-pill acx-pill--${VOUCHER_TONE[e.mode] || "plain"}`}>{e.mode}</span></td>
                    <td className="acx-ref" title={e.reference}>{e.reference}</td>
                    <td>{e.narration}</td>
                    <td className="acx-num acx-in">{moneyOrBlank(e.receipts)}</td>
                    <td className="acx-num acx-out">{moneyOrBlank(e.payments)}</td>
                    <td className="acx-num acx-strong">{money(e.balance)}</td>
                  </tr>
                ))}
                {shown.length === 0 && <tr><td colSpan={7} className="acx-none-cell">Nothing matches “{query}”.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
