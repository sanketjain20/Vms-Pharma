import {
  STATUS, DEFAULT_FILTERS, unifyOrders, applyFilters, countActive, statusCounts, summarize,
  retailersIn, groupByDay, periodRange,
} from "./repOrders";

jest.mock("../../Config/apiClient");

const NOW = new Date(2026, 9, 15, 14, 0, 0); // Thu 15 Oct 2026, 14:00 local

const local = (o) => ({
  clientOrderId: "c-" + Math.random(), retailerId: 1, retailerName: "City Chemist", capturedAt: "2026-10-15T10:00:00",
  total: 100, state: "SYNCED", serverOrderNumber: null, message: null, conflicts: [], remarks: null,
  items: [{ productId: 10, name: "Paracetamol", quantity: 2, quotedPrice: 50 }], ...o,
});
const server = (o) => ({
  uKey: "u-" + Math.random(), orderNumber: "FO-1", status: "SUBMITTED", hasConflict: false, retailerId: 1, retailerName: "City Chemist",
  capturedAt: "2026-10-15T10:00:00", totalAmount: 100, remarks: null, rejectReason: null,
  items: [{ productId: 10, productName: "Paracetamol", quantity: 2, quotedPrice: 50, currentPrice: 50, availableQty: 9, conflictReason: null }], ...o,
});
const f = (over) => ({ ...DEFAULT_FILTERS, ...over });

describe("unifyOrders", () => {
  it("maps each on-phone state to a status", () => {
    const list = unifyOrders([
      local({ state: "PENDING" }), local({ state: "INVALID" }), local({ state: "CONFLICT" }), local({ state: "SYNCED" }),
    ]);
    expect(list.map((o) => o.status).sort()).toEqual([STATUS.FLAGGED, STATUS.INVALID, STATUS.PENDING, STATUS.WITH_OFFICE].sort());
  });

  it("lets the office's decision override the sync state, and uses the server's numbers", () => {
    const l = local({ state: "CONFLICT", serverOrderNumber: "FO-9", total: 300, items: [{ productId: 10, name: "Paracetamol", quantity: 6, quotedPrice: 50 }] });
    const s = server({ orderNumber: "FO-9", status: "APPROVED", totalAmount: 200, items: [{ productId: 10, productName: "Paracetamol", quantity: 4, quotedPrice: 50, currentPrice: 50, availableQty: 4, conflictReason: null }] });

    const [o] = unifyOrders([l], [s]);

    expect(o.status).toBe(STATUS.APPROVED);
    expect(o.total).toBe(200); // the office cut the quantity
    expect(o.items[0].quantity).toBe(4);
  });

  it("maps converted orders to Invoiced and keeps a rejection reason", () => {
    const list = unifyOrders([], [server({ orderNumber: "A", status: "CONVERTED" }), server({ orderNumber: "B", status: "REJECTED", rejectReason: "Over limit" })]);
    expect(list.find((o) => o.orderNumber === "A").status).toBe(STATUS.INVOICED);
    expect(list.find((o) => o.orderNumber === "B")).toMatchObject({ status: STATUS.REJECTED, rejectReason: "Over limit" });
  });

  it("includes server-only history older than what the phone keeps, without duplicating synced orders", () => {
    const l = local({ serverOrderNumber: "FO-1" });
    const list = unifyOrders([l], [server({ orderNumber: "FO-1" }), server({ orderNumber: "FO-OLD", capturedAt: "2026-06-01T09:00:00" })]);
    expect(list).toHaveLength(2);
    expect(list.find((o) => o.orderNumber === "FO-OLD").local).toBe(false);
  });

  it("shows a still-undecided server order as flagged only when it has a conflict, and carries line conflicts", () => {
    const flagged = server({ orderNumber: "X", hasConflict: true, items: [{ productId: 10, productName: "P", quantity: 8, quotedPrice: 30, currentPrice: 35, availableQty: 5, conflictReason: "PRICE_CHANGED,STOCK_SHORT" }] });
    const [o] = unifyOrders([], [flagged]);
    expect(o.status).toBe(STATUS.FLAGGED);
    expect(o.items[0].conflict).toMatchObject({ reason: "PRICE_CHANGED,STOCK_SHORT", currentPrice: 35, availableQty: 5 });
    expect(unifyOrders([], [server({ orderNumber: "Y" })])[0].status).toBe(STATUS.WITH_OFFICE);
  });

  it("sorts newest first", () => {
    const list = unifyOrders([local({ capturedAt: "2026-10-01T09:00:00" }), local({ capturedAt: "2026-10-09T09:00:00" })]);
    expect(list[0].capturedAt).toBe("2026-10-09T09:00:00");
  });
});

describe("applyFilters", () => {
  const list = unifyOrders([
    local({ clientOrderId: "today", capturedAt: "2026-10-15T09:00:00", total: 100, retailerId: 1, retailerName: "City Chemist" }),
    local({ clientOrderId: "yest", capturedAt: "2026-10-14T18:00:00", total: 250, retailerId: 2, retailerName: "Metro Medicos", state: "PENDING", items: [{ productId: 11, name: "Amoxicillin 250", quantity: 1, quotedPrice: 250 }] }),
    local({ clientOrderId: "wk", capturedAt: "2026-10-10T12:00:00", total: 900, retailerId: 1, retailerName: "City Chemist", state: "INVALID" }),
    local({ clientOrderId: "lastm", capturedAt: "2026-09-20T12:00:00", total: 40, retailerId: 3, retailerName: "Health Plus", remarks: "deliver monday" }),
    local({ clientOrderId: "old", capturedAt: "2026-06-02T12:00:00", total: 5000, retailerId: 2, retailerName: "Metro Medicos" }),
  ]);
  const ids = (r) => r.map((o) => o.clientOrderId);

  it("returns everything by default, newest first", () => {
    expect(ids(applyFilters(list, f(), NOW))).toEqual(["today", "yest", "wk", "lastm", "old"]);
  });

  it("filters by date presets", () => {
    expect(ids(applyFilters(list, f({ period: "TODAY" }), NOW))).toEqual(["today"]);
    expect(ids(applyFilters(list, f({ period: "YESTERDAY" }), NOW))).toEqual(["yest"]);
    expect(ids(applyFilters(list, f({ period: "LAST7" }), NOW))).toEqual(["today", "yest", "wk"]);
    expect(ids(applyFilters(list, f({ period: "THIS_MONTH" }), NOW))).toEqual(["today", "yest", "wk"]);
    expect(ids(applyFilters(list, f({ period: "LAST_MONTH" }), NOW))).toEqual(["lastm"]);
    expect(ids(applyFilters(list, f({ period: "LAST30" }), NOW))).toEqual(["today", "yest", "wk", "lastm"]);
  });

  it("filters by a picked month and by custom dates (inclusive of both end days)", () => {
    expect(ids(applyFilters(list, f({ period: "MONTH", month: "2026-06" }), NOW))).toEqual(["old"]);
    expect(ids(applyFilters(list, f({ period: "CUSTOM", from: "2026-10-10", to: "2026-10-14" }), NOW))).toEqual(["yest", "wk"]);
    expect(ids(applyFilters(list, f({ period: "CUSTOM", from: "2026-10-14" }), NOW))).toEqual(["today", "yest"]); // open-ended
    expect(ids(applyFilters(list, f({ period: "CUSTOM", to: "2026-09-30" }), NOW))).toEqual(["lastm", "old"]);
  });

  it("treats an incomplete month/custom choice as no date limit rather than hiding everything", () => {
    expect(applyFilters(list, f({ period: "MONTH", month: "" }), NOW)).toHaveLength(5);
    expect(applyFilters(list, f({ period: "CUSTOM" }), NOW)).toHaveLength(5);
  });

  it("filters by retailer", () => {
    expect(ids(applyFilters(list, f({ retailerId: "2" }), NOW))).toEqual(["yest", "old"]);
  });

  it("filters by status, including the 'needs attention' group", () => {
    expect(ids(applyFilters(list, f({ status: STATUS.PENDING }), NOW))).toEqual(["yest"]);
    expect(ids(applyFilters(list, f({ status: "ATTENTION" }), NOW))).toEqual(["yest", "wk"]);
  });

  it("filters by amount range", () => {
    expect(ids(applyFilters(list, f({ min: "100", max: "900" }), NOW))).toEqual(["today", "yest", "wk"]);
    expect(ids(applyFilters(list, f({ min: "1000" }), NOW))).toEqual(["old"]);
    expect(ids(applyFilters(list, f({ max: "50" }), NOW))).toEqual(["lastm"]);
  });

  it("searches retailer, product, order number and note — every word must match", () => {
    expect(ids(applyFilters(list, f({ q: "metro" }), NOW))).toEqual(["yest", "old"]);
    expect(ids(applyFilters(list, f({ q: "amox" }), NOW))).toEqual(["yest"]);
    expect(ids(applyFilters(list, f({ q: "deliver monday" }), NOW))).toEqual(["lastm"]);
    expect(ids(applyFilters(list, f({ q: "metro amox" }), NOW))).toEqual(["yest"]);
    expect(applyFilters(list, f({ q: "metro zzz" }), NOW)).toEqual([]);
  });

  it("combines filters", () => {
    expect(ids(applyFilters(list, f({ retailerId: "1", period: "LAST7", status: STATUS.INVALID }), NOW))).toEqual(["wk"]);
  });

  it("sorts by date and by value", () => {
    expect(ids(applyFilters(list, f({ sort: "OLDEST" }), NOW))[0]).toBe("old");
    expect(ids(applyFilters(list, f({ sort: "HIGHEST" }), NOW))[0]).toBe("old");
    expect(ids(applyFilters(list, f({ sort: "LOWEST" }), NOW))[0]).toBe("lastm");
  });

  it("builds period ranges as [start, end) in local time", () => {
    const [from, to] = periodRange(f({ period: "TODAY" }), NOW);
    expect(from).toEqual(new Date(2026, 9, 15));
    expect(to).toEqual(new Date(2026, 9, 16));
  });
});

describe("filter helpers", () => {
  const list = unifyOrders([
    local({ state: "PENDING", retailerId: 2, retailerName: "Zed Store", total: 10 }),
    local({ state: "SYNCED", retailerId: 1, retailerName: "Alpha Store", total: 30 }),
    local({ state: "SYNCED", retailerId: 1, retailerName: "Alpha Store", total: 60 }),
  ]);

  it("counts how many filters are narrowing the list (sort and unfinished dates don't count)", () => {
    expect(countActive(f())).toBe(0);
    expect(countActive(f({ q: "  " }))).toBe(0);
    expect(countActive(f({ sort: "HIGHEST" }))).toBe(0);
    expect(countActive(f({ period: "MONTH", month: "" }))).toBe(0);
    expect(countActive(f({ q: "a", status: "PENDING", retailerId: "1", period: "TODAY", min: "5" }))).toBe(5);
  });

  it("gives each status chip the count you'd get by tapping it, with the other filters applied", () => {
    const c = statusCounts(list, f({ retailerId: "1" }), NOW);
    expect(c.ALL).toBe(2);
    expect(c[STATUS.WITH_OFFICE]).toBe(2);
    expect(c[STATUS.PENDING]).toBe(0);
    expect(statusCounts(list, f(), NOW).ATTENTION).toBe(1);
  });

  it("summarises count and value", () => {
    expect(summarize(list)).toEqual({ count: 3, total: 100 });
  });

  it("lists each retailer once, alphabetically", () => {
    expect(retailersIn(list)).toEqual([{ id: "1", name: "Alpha Store" }, { id: "2", name: "Zed Store" }]);
  });

  it("groups by day with Today / Yesterday headings and a day total", () => {
    const orders = unifyOrders([
      local({ capturedAt: "2026-10-15T09:00:00", total: 10 }), local({ capturedAt: "2026-10-15T08:00:00", total: 20 }),
      local({ capturedAt: "2026-10-14T09:00:00", total: 5 }), local({ capturedAt: "2026-10-02T09:00:00", total: 1 }),
    ]);
    const groups = groupByDay(orders, NOW);
    expect(groups.map((g) => g.label).slice(0, 2)).toEqual(["Today", "Yesterday"]);
    expect(groups).toHaveLength(3);
    expect(groups[0]).toMatchObject({ total: 30 });
    expect(groups[0].orders).toHaveLength(2);
  });
});
