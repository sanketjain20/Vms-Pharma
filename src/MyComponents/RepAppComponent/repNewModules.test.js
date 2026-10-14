import { amountInWords, numberToIndianWords, receiptNumber, formatReceiptDate, canIssueReceipt, receiptModel, receiptText, whatsappLink } from "./repReceipt";
import { eligibleCash, expectedCash, difference, validateHandover, unifyHandovers, differenceText } from "./repHandover";
import { invoicesFor, unbookedAgainst, dueInfo, invoiceLabel } from "./repInvoices";
import { lastVisitFor, recency, targetBars, paceTone, elapsedFraction } from "./repBeatInfo";
import { unifyCollections, validateCollection } from "./repCollections";

describe("validateCollection against an invoice", () => {
  const base = { retailerId: 1, amount: "500", mode: "CASH" };
  test("allows up to what is left, refuses more, ignores when no invoice", () => {
    expect(validateCollection({ ...base, invoiceLeft: 500 })).toBeNull();
    expect(validateCollection({ ...base, invoiceLeft: 500.004 })).toBeNull();
    expect(validateCollection({ ...base, invoiceLeft: 499 })).toBe("That invoice only has ₹499.00 left to collect.");
    expect(validateCollection({ ...base, invoiceLeft: null })).toBeNull();
    expect(validateCollection(base)).toBeNull();
  });
});

describe("repReceipt", () => {
  test("Indian number words", () => {
    expect(numberToIndianWords(0)).toBe("Zero");
    expect(numberToIndianWords(19)).toBe("Nineteen");
    expect(numberToIndianWords(2500)).toBe("Two Thousand Five Hundred");
    expect(numberToIndianWords(100000)).toBe("One Lakh");
    expect(numberToIndianWords(12345678)).toBe("One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight");
  });

  test("amount in words handles paise and zero", () => {
    expect(amountInWords(2500)).toBe("Rupees Two Thousand Five Hundred only");
    expect(amountInWords(2500.5)).toBe("Rupees Two Thousand Five Hundred and Fifty Paise only");
    expect(amountInWords(0.25)).toBe("Twenty Five Paise only");
    expect(amountInWords(0)).toBe("Rupees Zero only");
    expect(amountInWords(1.005)).toMatch(/Rupees One/);
  });

  test("receipt number is stable and derived from the id", () => {
    expect(receiptNumber({ clientCollectionId: "ab12cd34-ef56-7890" })).toBe("RC-AB12CD34");
    expect(receiptNumber({})).toBe("RC-00000000");
  });

  test("date format is fixed", () => {
    expect(formatReceiptDate(new Date(2026, 9, 3, 16, 5).toISOString())).toBe("03 Oct 2026, 04:05 PM");
    expect(formatReceiptDate(new Date(2026, 9, 3, 0, 5).toISOString())).toBe("03 Oct 2026, 12:05 AM");
    expect(formatReceiptDate("garbage")).toBe("");
  });

  test("only money on its way to the books gets a receipt", () => {
    ["PENDING", "SENT", "CONFIRMED"].forEach((s) => expect(canIssueReceipt({ status: s })).toBe(true));
    ["INVALID", "REJECTED"].forEach((s) => expect(canIssueReceipt({ status: s })).toBe(false));
    expect(canIssueReceipt(null)).toBe(false);
  });

  test("wording differs between pending and confirmed", () => {
    const c = { clientCollectionId: "x1", retailerName: "Shop", amount: 500, mode: "UPI", reference: "T9", invoiceNumber: "INV1", capturedAt: new Date().toISOString(), status: "SENT" };
    expect(receiptModel(c, { company: "Acme", repName: "Ravi" }).statusLine).toMatch(/Pending confirmation/);
    expect(receiptModel({ ...c, status: "CONFIRMED" }, { company: "Acme" }).statusLine).toMatch(/Recorded in the books/);
    const t = receiptText(c, { company: "Acme", repName: "Ravi" });
    expect(t).toContain("Invoice INV1");
    expect(t).toContain("Collected by: Ravi");
    expect(receiptText({ ...c, invoiceNumber: null }, {})).toContain("Account balance");
    expect(whatsappLink("a b")).toBe("https://wa.me/?text=a%20b");
  });
});

describe("repHandover", () => {
  const col = (o) => ({ clientCollectionId: "c" + Math.random(), mode: "CASH", local: true, status: "SENT", amount: 100, capturedAt: "2026-10-03T10:00:00Z", ...o });

  test("eligible cash excludes non-cash, refused, rejected and already handed over", () => {
    const keep = col({ amount: 100 });
    const list = [keep, col({ mode: "UPI" }), col({ status: "INVALID" }), col({ status: "REJECTED" }), col({ handedOver: true }), col({ handoverClientId: "h" }), col({ local: false })];
    expect(eligibleCash(list)).toEqual([keep]);
  });

  test("expected and difference are rounded", () => {
    expect(expectedCash([{ amount: 0.1 }, { amount: 0.2 }])).toBe(0.3);
    expect(difference(0.3, 0.1 + 0.2)).toBe(0);
    expect(difference(90, 100)).toBe(-10);
    expect(differenceText(0, String)).toMatch(/Matches/);
    expect(differenceText(-10, (n) => "R" + n)).toBe("Short by R10");
    expect(differenceText(5, (n) => "R" + n)).toBe("R5 extra");
  });

  test("validation mirrors the server", () => {
    expect(validateHandover({ count: 0, counted: "1" })).toMatch(/no cash/);
    expect(validateHandover({ count: 1, counted: "" })).toMatch(/Enter/);
    expect(validateHandover({ count: 1, counted: "-1" })).toMatch(/Enter/);
    expect(validateHandover({ count: 1, counted: "1.234" })).toMatch(/2 decimal/);
    expect(validateHandover({ count: 1, counted: "100000001" })).toMatch(/too large/);
    expect(validateHandover({ count: 1, counted: "0" })).toBeNull();
    expect(validateHandover({ count: 1, counted: "250.50" })).toBeNull();
  });

  test("unify: office decision wins, server-only rows appear, newest first", () => {
    const local = [
      { clientHandoverId: "a", state: "SYNCED", cashCounted: 90, expectedCash: 100, collectionIds: ["1", "2"], capturedAt: "2026-10-01T10:00:00Z" },
      { clientHandoverId: "b", state: "PENDING", cashCounted: 50, expectedCash: 50, collectionIds: ["3"], capturedAt: "2026-10-03T10:00:00Z" },
    ];
    const server = [
      { clientHandoverId: "a", uKey: "ua", status: "FLAGGED", expectedCash: 100, officeNote: "recount" },
      { clientHandoverId: "z", uKey: "uz", status: "RECEIVED", expectedCash: 10, cashCounted: 10, difference: 0, collectionsCount: 1, closedAt: "2026-09-20T10:00:00Z" },
    ];
    const out = unifyHandovers(local, server);
    expect(out.map((h) => h.key)).toEqual(["b", "a", "uz"]);
    expect(out[0].status).toBe("PENDING");
    expect(out[1].status).toBe("FLAGGED");
    expect(out[1].difference).toBe(-10);
    expect(out[1].officeNote).toBe("recount");
    expect(out[2].status).toBe("RECEIVED");
    expect(out[2].local).toBe(false);
  });
});

describe("repInvoices", () => {
  const invoices = [
    { salesId: 1, retailerId: 7, invoiceNumber: "A", remainingAmount: 1000, dueDate: "2026-10-20", invoiceDate: "2026-09-20" },
    { salesId: 2, retailerId: 7, invoiceNumber: "B", remainingAmount: 500, dueDate: "2026-10-01", invoiceDate: "2026-09-01" },
    { salesId: 3, retailerId: 8, invoiceNumber: "C", remainingAmount: 900, dueDate: null },
    { salesId: 4, retailerId: 7, invoiceNumber: "D", remainingAmount: 200, dueDate: null },
  ];
  const hist = [
    { invoiceId: 2, status: "SENT", amount: 500 },
    { invoiceId: 1, status: "PENDING", amount: 300 },
    { invoiceId: 1, status: "CONFIRMED", amount: 999 },
    { invoiceId: 1, status: "REJECTED", amount: 999 },
  ];

  test("unbooked money counts only pending/sent", () => {
    expect(unbookedAgainst(1, hist)).toBe(300);
    expect(unbookedAgainst(3, hist)).toBe(0);
  });

  test("open invoices: retailer-only, reservation subtracted, empty dropped, oldest due first, no due last", () => {
    const out = invoicesFor(7, invoices, hist);
    expect(out.map((i) => i.invoiceNumber)).toEqual(["A", "D"]);
    expect(out[0].left).toBe(700);
    expect(invoicesFor(null, invoices, hist)).toEqual([]);
  });

  test("due wording", () => {
    const now = new Date(2026, 9, 3);
    expect(dueInfo({ dueDate: "2026-10-01" }, now)).toEqual({ text: "Overdue by 2 days", overdue: true });
    expect(dueInfo({ dueDate: "2026-10-02" }, now).text).toBe("Overdue by 1 day");
    expect(dueInfo({ dueDate: "2026-10-03" }, now).text).toBe("Due today");
    expect(dueInfo({ dueDate: "2026-10-05" }, now).text).toBe("Due in 2 days");
    expect(dueInfo({ dueDate: "2026-10-25" }, now).text).toBe("Due 25 Oct");
    expect(dueInfo({}, now).text).toBe("");
    expect(invoiceLabel({ invoiceNumber: "A", dueDate: "2026-10-05", left: 70 }, (n) => "R" + n, now)).toBe("A · Due in 2 days · R70 left");
  });
});

describe("repBeatInfo", () => {
  test("last visit is the latest of server and local, ignoring refused", () => {
    const local = [
      { retailerId: 5, capturedAt: "2026-10-02T10:00:00Z", state: "SYNCED" },
      { retailerId: 5, capturedAt: "2026-10-03T10:00:00Z", state: "INVALID" },
      { retailerId: 6, capturedAt: "2026-10-03T11:00:00Z", state: "PENDING" },
    ];
    expect(lastVisitFor(5, "2026-09-30T10:00:00Z", local)).toBe("2026-10-02T10:00:00Z");
    expect(lastVisitFor(5, "2026-10-02T12:00:00Z", local)).toBe("2026-10-02T12:00:00Z");
    expect(lastVisitFor(9, null, local)).toBeNull();
  });

  test("recency labels and tones", () => {
    const now = new Date(2026, 9, 20, 12);
    expect(recency(null, now)).toMatchObject({ never: true, tone: "neutral" });
    expect(recency(new Date(2026, 9, 20, 1).toISOString(), now)).toMatchObject({ days: 0, label: "Visited today", tone: "ok" });
    expect(recency(new Date(2026, 9, 19).toISOString(), now).label).toBe("Visited yesterday");
    expect(recency(new Date(2026, 9, 12).toISOString(), now)).toMatchObject({ days: 8, tone: "warn" });
    expect(recency(new Date(2026, 9, 6).toISOString(), now)).toMatchObject({ days: 14, tone: "bad" });
  });

  test("target bars appear only for set targets and judge pace", () => {
    const p = { daysInMonth: 30, daysLeft: 15, ordersValue: 400, targetOrdersValue: 1000, collections: 0, targetCollections: null, checkIns: 10, targetCheckIns: 10 };
    expect(elapsedFraction(p)).toBe(0.5);
    const bars = targetBars(p);
    expect(bars.map((b) => b.key)).toEqual(["orders", "checkIns"]);
    expect(bars[0]).toMatchObject({ percent: 40, tone: "warn", done: false });
    expect(bars[1]).toMatchObject({ percent: 100, tone: "ok", done: true });
    expect(paceTone(10, 0.5)).toBe("bad");
    expect(paceTone(50, 0.5)).toBe("ok");
    expect(targetBars(null)).toEqual([]);
  });
});

describe("repCollections carries invoice and handover info", () => {
  test("unify keeps invoice, handover link and server handed-over flag", () => {
    const local = [{ clientCollectionId: "a", retailerId: 1, amount: 10, mode: "CASH", capturedAt: "2026-10-03T10:00:00Z", state: "SYNCED", invoiceId: 5, invoiceNumber: "INV5", handoverClientId: "h1" }];
    const server = [{ clientCollectionId: "b", retailerId: 1, amount: 20, paymentMode: "CASH", collectedAt: "2026-10-02T10:00:00Z", status: "CONFIRMED", invoiceId: 6, invoiceNumber: "INV6", handedOver: true }];
    const out = unifyCollections(local, server);
    expect(out[0]).toMatchObject({ invoiceId: 5, invoiceNumber: "INV5", handedOver: true, handoverClientId: "h1" });
    expect(out[1]).toMatchObject({ invoiceId: 6, invoiceNumber: "INV6", handedOver: true });
  });
});
