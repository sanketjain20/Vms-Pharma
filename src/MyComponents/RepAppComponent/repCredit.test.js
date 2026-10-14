import { NEAR_RATIO, creditStatus, pendingOrderValue } from "./repCredit";
import { STATUS } from "./repOrders";

jest.mock("../../Config/apiClient");

const R = (o = {}) => ({ retailerId: 11, shopName: "City Chemist", creditLimit: 50000, outstandingBalance: 20000, ...o });
const order = (status, total, o = {}) => ({ key: "k" + Math.random(), retailerId: 11, status, total, ...o });

describe("pendingOrderValue", () => {
  it("counts only orders that will still become money owed, for this retailer", () => {
    const history = [
      order(STATUS.PENDING, 1000), order(STATUS.WITH_OFFICE, 2000), order(STATUS.FLAGGED, 3000), order(STATUS.APPROVED, 4000),
      order(STATUS.INVOICED, 9999),   // already inside the outstanding balance
      order(STATUS.REJECTED, 9999),   // never happens
      order(STATUS.INVALID, 9999),    // refused, never stored
      order(STATUS.PENDING, 7777, { retailerId: 99 }), // someone else's
    ];
    expect(pendingOrderValue(history, 11)).toBe(10000);
  });

  it("can leave out the order being edited so it isn't counted twice", () => {
    const mine = order(STATUS.PENDING, 5000, { key: "mine" });
    expect(pendingOrderValue([mine, order(STATUS.PENDING, 1000)], 11, "mine")).toBe(1000);
  });
});

describe("creditStatus", () => {
  it("says nothing is wrong when there is no retailer, or no limit set (0 = no limit)", () => {
    expect(creditStatus(null)).toBeNull();
    const s = creditStatus(R({ creditLimit: 0, outstandingBalance: 123456 }), [], 99999);
    expect(s).toMatchObject({ hasLimit: false, level: "none", available: null, usedPercent: null, overBy: 0, pushesOver: false });
    expect(s.outstanding).toBe(123456); // still known, so it can be shown
  });

  it("is ok well under the limit, and reports what is available", () => {
    const s = creditStatus(R(), [order(STATUS.PENDING, 5000)], 5000);
    expect(s).toMatchObject({ level: "ok", exposureBefore: 25000, exposureAfter: 30000, available: 25000, usedPercent: 60 });
  });

  it("goes 'near' from 80% of the limit — the same line the office uses", () => {
    expect(NEAR_RATIO).toBe(0.8);
    expect(creditStatus(R(), [], 19999).level).toBe("ok");   // 39,999 of 50,000 = 79.998%
    expect(creditStatus(R(), [], 20000).level).toBe("near"); // exactly 40,000 = 80%
    expect(creditStatus(R(), [], 30000).level).toBe("near"); // exactly at the limit is not over
  });

  it("goes 'over' only above the limit, and says by how much and whether THIS order did it", () => {
    const s = creditStatus(R(), [], 30001);
    expect(s).toMatchObject({ level: "over", overBy: 1, pushesOver: true, alreadyOver: false });
  });

  it("recognises a retailer who is already over before this order", () => {
    const s = creditStatus(R({ outstandingBalance: 52000 }), [], 1000);
    expect(s).toMatchObject({ level: "over", alreadyOver: true, pushesOver: false, overBy: 3000 });
    expect(s.available).toBe(-2000);
  });

  it("includes the rep's own not-yet-invoiced orders, so repeat orders can't hide the exposure", () => {
    const history = [order(STATUS.WITH_OFFICE, 20000), order(STATUS.APPROVED, 9000)];
    const s = creditStatus(R(), history, 2000); // 20,000 owed + 29,000 pending + 2,000 new = 51,000
    expect(s).toMatchObject({ pending: 29000, exposureAfter: 51000, level: "over", overBy: 1000, pushesOver: true });
  });

  it("copes with missing or non-numeric figures", () => {
    const s = creditStatus({ retailerId: 11, creditLimit: "50000.00", outstandingBalance: null }, [], "abc");
    expect(s).toMatchObject({ limit: 50000, outstanding: 0, thisOrder: 0, level: "ok" });
  });

  it("ignores the order being edited when judging the rest", () => {
    const mine = order(STATUS.PENDING, 30000, { key: "mine" });
    const s = creditStatus(R(), [mine], 10000, "mine");
    expect(s.pending).toBe(0);
    expect(s.exposureAfter).toBe(30000);
  });
});
