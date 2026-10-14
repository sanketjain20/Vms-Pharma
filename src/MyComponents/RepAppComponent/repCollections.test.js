import {
  COLLECTION_STATUS as S, DEFAULT_COLLECTION_FILTERS, applyCollectionFilters, awaitingForRetailer, collectionStatusCounts,
  collectionSummary, countActiveCollectionFilters, retailersInCollections, unifyCollections, validateCollection,
} from "./repCollections";

jest.mock("../../Config/apiClient");

const NOW = new Date(2026, 9, 15, 14, 0, 0); // Thu 15 Oct 2026

const local = (o = {}) => ({
  clientCollectionId: "c-" + Math.random(), retailerId: 1, retailerName: "City Chemist", amount: 1000, mode: "CASH", reference: null,
  note: null, capturedAt: "2026-10-15T10:00:00", state: "PENDING", attempted: false, message: null, ...o,
});
const server = (o = {}) => ({
  uKey: "u-" + Math.random(), clientCollectionId: "x", retailerId: 1, retailerName: "City Chemist", amount: 1000, paymentMode: "CASH",
  referenceNumber: null, note: null, collectedAt: "2026-10-15T10:00:00", status: "SUBMITTED", rejectReason: null, ...o,
});
const f = (o) => ({ ...DEFAULT_COLLECTION_FILTERS, ...o });

describe("unifyCollections", () => {
  it("maps each on-phone state to a status", () => {
    const list = unifyCollections([local({ state: "PENDING" }), local({ state: "INVALID" }), local({ state: "SYNCED" })]);
    expect(list.map((c) => c.status).sort()).toEqual([S.INVALID, S.PENDING, S.SENT].sort());
  });

  it("lets the office's decision override: confirmed and rejected (with the reason)", () => {
    const a = local({ clientCollectionId: "a", state: "SYNCED" });
    const b = local({ clientCollectionId: "b", state: "SYNCED" });
    const list = unifyCollections([a, b], [
      server({ clientCollectionId: "a", status: "CONFIRMED" }),
      server({ clientCollectionId: "b", status: "REJECTED", rejectReason: "Cash never arrived" }),
    ]);
    expect(list.find((c) => c.key === "a").status).toBe(S.CONFIRMED);
    const rejected = list.find((c) => c.key === "b");
    expect(rejected).toMatchObject({ status: S.REJECTED, rejectReason: "Cash never arrived" });
  });

  it("a collection the office still has undecided stays 'sent', not confirmed", () => {
    const [c] = unifyCollections([local({ clientCollectionId: "a", state: "SYNCED" })], [server({ clientCollectionId: "a", status: "SUBMITTED" })]);
    expect(c.status).toBe(S.SENT);
  });

  it("includes the office's older records that this phone no longer holds, without duplicating the rest", () => {
    const list = unifyCollections([local({ clientCollectionId: "a", state: "SYNCED" })], [
      server({ clientCollectionId: "a", status: "SUBMITTED" }),
      server({ clientCollectionId: "old", status: "CONFIRMED", collectedAt: "2026-06-01T09:00:00" }),
    ]);
    expect(list).toHaveLength(2);
    const old = list.find((c) => c.status === S.CONFIRMED);
    expect(old).toMatchObject({ local: false, clientCollectionId: null });
  });

  it("uses the same field names as orders (total, capturedAt) so grouping by day can be shared, newest first", () => {
    const list = unifyCollections([local({ capturedAt: "2026-10-01T09:00:00", amount: 5 }), local({ capturedAt: "2026-10-09T09:00:00", amount: 7 })]);
    expect(list[0]).toMatchObject({ total: 7, capturedAt: "2026-10-09T09:00:00" });
  });

  it("carries whether a send was ever attempted", () => {
    expect(unifyCollections([local({ attempted: true })])[0].attempted).toBe(true);
    expect(unifyCollections([local()])[0].attempted).toBe(false);
  });
});

describe("filters", () => {
  const list = unifyCollections([
    local({ clientCollectionId: "today", amount: 1000, capturedAt: "2026-10-15T09:00:00", mode: "CASH" }),
    local({ clientCollectionId: "yest", amount: 2500, capturedAt: "2026-10-14T18:00:00", retailerId: 2, retailerName: "Metro Medicos", mode: "UPI", reference: "UPI777", state: "SYNCED" }),
    local({ clientCollectionId: "wk", amount: 400, capturedAt: "2026-10-10T12:00:00", mode: "CHEQUE", reference: "000123", state: "INVALID", note: "post dated" }),
    local({ clientCollectionId: "old", amount: 90, capturedAt: "2026-06-02T12:00:00", retailerId: 2, retailerName: "Metro Medicos", state: "SYNCED" }),
  ], [server({ clientCollectionId: "yest", status: "CONFIRMED" })]);
  const ids = (r) => r.map((c) => c.key);

  it("returns everything newest first by default", () => {
    expect(ids(applyCollectionFilters(list, f(), NOW))).toEqual(["today", "yest", "wk", "old"]);
  });

  it("filters by status, retailer, and period", () => {
    expect(ids(applyCollectionFilters(list, f({ status: S.CONFIRMED }), NOW))).toEqual(["yest"]);
    expect(ids(applyCollectionFilters(list, f({ status: S.INVALID }), NOW))).toEqual(["wk"]);
    expect(ids(applyCollectionFilters(list, f({ retailerId: "2" }), NOW))).toEqual(["yest", "old"]);
    expect(ids(applyCollectionFilters(list, f({ period: "TODAY" }), NOW))).toEqual(["today"]);
    expect(ids(applyCollectionFilters(list, f({ period: "LAST7" }), NOW))).toEqual(["today", "yest", "wk"]);
    expect(ids(applyCollectionFilters(list, f({ period: "MONTH", month: "2026-06" }), NOW))).toEqual(["old"]);
  });

  it("searches retailer, reference, note, mode and amount — every word must match", () => {
    expect(ids(applyCollectionFilters(list, f({ q: "metro" }), NOW))).toEqual(["yest", "old"]);
    expect(ids(applyCollectionFilters(list, f({ q: "upi777" }), NOW))).toEqual(["yest"]);
    expect(ids(applyCollectionFilters(list, f({ q: "post dated" }), NOW))).toEqual(["wk"]);
    expect(ids(applyCollectionFilters(list, f({ q: "cheque" }), NOW))).toEqual(["wk"]);
    expect(ids(applyCollectionFilters(list, f({ q: "2500" }), NOW))).toEqual(["yest"]);
    expect(applyCollectionFilters(list, f({ q: "metro cheque" }), NOW)).toEqual([]);
  });

  it("gives each status chip the count you'd get by tapping it, with the other filters applied", () => {
    const c = collectionStatusCounts(list, f({ retailerId: "2" }), NOW);
    expect(c.ALL).toBe(2);
    expect(c[S.CONFIRMED]).toBe(1);
    expect(c[S.SENT]).toBe(1);
    expect(c[S.PENDING]).toBe(0);
  });

  it("counts active filters, ignoring blanks and unfinished dates", () => {
    expect(countActiveCollectionFilters(f())).toBe(0);
    expect(countActiveCollectionFilters(f({ q: "  " }))).toBe(0);
    expect(countActiveCollectionFilters(f({ period: "MONTH", month: "" }))).toBe(0);
    expect(countActiveCollectionFilters(f({ q: "a", status: S.SENT, retailerId: "2", period: "TODAY" }))).toBe(4);
  });

  it("lists each retailer once, alphabetically", () => {
    expect(retailersInCollections(list)).toEqual([{ id: "1", name: "City Chemist" }, { id: "2", name: "Metro Medicos" }]);
  });
});

describe("summaries", () => {
  const list = unifyCollections([
    local({ clientCollectionId: "a", amount: 1000, capturedAt: "2026-10-15T09:00:00", state: "PENDING" }),                 // today, waiting
    local({ clientCollectionId: "b", amount: 500, capturedAt: "2026-10-15T08:00:00", state: "SYNCED" }),                   // today, with office
    local({ clientCollectionId: "c", amount: 300, capturedAt: "2026-10-15T07:00:00", state: "INVALID" }),                 // today, refused → not collected
    local({ clientCollectionId: "d", amount: 2000, capturedAt: "2026-10-03T07:00:00", state: "SYNCED" }),                 // this month, confirmed
    local({ clientCollectionId: "e", amount: 700, capturedAt: "2026-10-04T07:00:00", state: "SYNCED" }),                  // rejected
    local({ clientCollectionId: "f", amount: 9000, capturedAt: "2026-09-20T07:00:00", state: "SYNCED" }),                 // last month, confirmed
  ], [
    server({ clientCollectionId: "d", status: "CONFIRMED" }),
    server({ clientCollectionId: "e", status: "REJECTED" }),
    server({ clientCollectionId: "f", status: "CONFIRMED" }),
  ]);

  it("collected today = waiting + sent + confirmed today; refused and rejected money isn't collected", () => {
    expect(collectionSummary(list, NOW).collectedToday).toBe(1500);
  });

  it("awaiting the office = waiting to send + sent, all time", () => {
    expect(collectionSummary(list, NOW).awaitingOffice).toBe(1500);
  });

  it("confirmed this month only counts this month's confirmed money", () => {
    expect(collectionSummary(list, NOW).confirmedThisMonth).toBe(2000);
  });

  it("works out what is still unbooked for one retailer", () => {
    expect(awaitingForRetailer(list, 1)).toBe(1500);
    expect(awaitingForRetailer(list, 99)).toBe(0);
  });
});

describe("validateCollection", () => {
  const ok = { retailerId: 5, amount: "2500", mode: "CASH", reference: "" };

  it("accepts a normal collection", () => {
    expect(validateCollection(ok)).toBeNull();
    expect(validateCollection({ ...ok, amount: "2500.50" })).toBeNull();
    expect(validateCollection({ ...ok, amount: 99 })).toBeNull();
    expect(validateCollection({ ...ok, mode: "UPI", reference: "" })).toBeNull(); // UPI reference is optional
    expect(validateCollection({ ...ok, mode: "CHEQUE", reference: "000123" })).toBeNull();
  });

  it("explains each way it can be wrong", () => {
    expect(validateCollection({ ...ok, retailerId: "" })).toMatch(/Pick the retailer/);
    expect(validateCollection({ ...ok, amount: "" })).toMatch(/Enter the amount/);
    expect(validateCollection({ ...ok, amount: "0" })).toMatch(/Enter the amount/);
    expect(validateCollection({ ...ok, amount: "-5" })).toMatch(/Enter the amount/);
    expect(validateCollection({ ...ok, amount: "abc" })).toMatch(/Enter the amount/);
    expect(validateCollection({ ...ok, amount: "10.555" })).toMatch(/2 decimal places/);
    expect(validateCollection({ ...ok, amount: "10000001" })).toMatch(/extra zero/);
    expect(validateCollection({ ...ok, mode: "" })).toMatch(/how they paid/);
    expect(validateCollection({ ...ok, mode: "CHEQUE", reference: "  " })).toMatch(/cheque number/);
    expect(validateCollection({ ...ok, reference: "x".repeat(101) })).toMatch(/too long/);
  });

  it("allows the maximum, and trailing zeros are not extra precision", () => {
    expect(validateCollection({ ...ok, amount: "10000000" })).toBeNull();
    expect(validateCollection({ ...ok, amount: "10.500" })).toBeNull();
  });
});
