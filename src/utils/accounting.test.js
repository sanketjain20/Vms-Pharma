import { presetRange, fyStartYear, money, moneyOrBlank, showDate, groupTrialBalance, bookTotals, searchRows } from "./accounting";

describe("periods follow the Indian financial year (April to March)", () => {
  const oct31 = new Date(2026, 9, 31);

  it("knows which financial year a day is in", () => {
    expect(fyStartYear(new Date(2027, 2, 31))).toBe(2026); // 31 Mar 2027 is still FY 2026-27
    expect(fyStartYear(new Date(2027, 3, 1))).toBe(2027);
  });

  it("works out each quick period", () => {
    expect(presetRange("fy", oct31)).toEqual({ fromDate: "2026-04-01", toDate: "2026-10-31" });
    expect(presetRange("lastFy", oct31)).toEqual({ fromDate: "2025-04-01", toDate: "2026-03-31" });
    expect(presetRange("month", oct31)).toEqual({ fromDate: "2026-10-01", toDate: "2026-10-31" });
    expect(presetRange("lastMonth", oct31)).toEqual({ fromDate: "2026-09-01", toDate: "2026-09-30" });
    expect(presetRange("quarter", oct31)).toEqual({ fromDate: "2026-10-01", toDate: "2026-10-31" });
    expect(presetRange("lastMonth", new Date(2027, 0, 15))).toEqual({ fromDate: "2026-12-01", toDate: "2026-12-31" });
    expect(presetRange("quarter", new Date(2027, 1, 10))).toEqual({ fromDate: "2027-01-01", toDate: "2027-02-10" });
  });
});

describe("money and dates", () => {
  it("writes rupees with Indian grouping and a real minus", () => {
    expect(money(124750)).toBe("₹1,24,750.00");
    expect(money(-500)).toBe("−₹500.00");
    expect(money(null)).toBe("₹0.00");
    expect(moneyOrBlank(0)).toBe("");
    expect(moneyOrBlank(12.5)).toBe("₹12.50");
  });

  it("writes dates the Indian way", () => {
    expect(showDate("2026-10-31")).toBe("31 Oct 2026");
    expect(showDate("")).toBe("");
  });
});

describe("trial balance and books", () => {
  it("groups ledgers as assets, liabilities, income, expenses with their subtotals", () => {
    const groups = groupTrialBalance([
      { ledger: "Sales", group: "Income", debit: 0, credit: 1000 },
      { ledger: "Bank", group: "Asset", debit: 600, credit: 100 },
      { ledger: "Cash in Hand", group: "Asset", debit: 400, credit: 0 },
      { ledger: "Output GST", group: "Liability", debit: 0, credit: 180 },
    ]);
    expect(groups.map((g) => g.group)).toEqual(["Asset", "Liability", "Income"]);
    expect(groups[0]).toMatchObject({ debit: 1000, credit: 100 });
    expect(groups[0].items.map((r) => r.ledger)).toEqual(["Bank", "Cash in Hand"]);
  });

  it("puts opening stock (equity) between liabilities and income, and stock with the assets", () => {
    const groups = groupTrialBalance([
      { ledger: "Cost of Goods Sold", group: "Expense", debit: 200, credit: 0 },
      { ledger: "Opening Stock", group: "Equity", debit: 0, credit: 500 },
      { ledger: "Inventory", group: "Asset", debit: 700, credit: 200 },
      { ledger: "Accounts Payable", group: "Liability", debit: 0, credit: 200 },
    ]);
    expect(groups.map((g) => g.group)).toEqual(["Asset", "Liability", "Equity", "Expense"]);
  });

  it("adds up a book and searches it by every word", () => {
    const rows = [
      { reference: "INV-1", narration: "Customer receipt", receipts: 100, payments: 0 },
      { reference: "SP-9", narration: "Supplier payment SP-9", receipts: 0, payments: 40 },
    ];
    expect(bookTotals(rows)).toEqual({ receipts: 100, payments: 40 });
    expect(searchRows(rows, "supplier sp-9", ["reference", "narration"])).toEqual([rows[1]]);
    expect(searchRows(rows, "  ", ["reference"])).toBe(rows);
  });
});
