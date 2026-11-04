import { renderHook, waitFor } from "@testing-library/react";
import {
  normMode, modeName, roundToRupee, roundOffText, paymentsTotal, startPayments, fillLast, paymentsProblem,
  paymentPayload, billingModeOf, useRoundBillTotal,
} from "./salePayments";
import { fetchCustomItemSetting } from "./customItems";

jest.mock("./customItems", () => ({ fetchCustomItemSetting: jest.fn() }));

describe("payment modes", () => {
  it("the old ONLINE is UPI and anything unknown is cash", () => {
    expect(normMode("online")).toBe("UPI");
    expect(normMode("card")).toBe("CARD");
    expect(normMode("CHEQUE")).toBe("CASH");
    expect(normMode(null)).toBe("CASH");
    expect(modeName("ONLINE")).toBe("UPI");
    expect(modeName("CARD")).toBe("Card");
  });

  it("one mode is that mode; several are SPLIT", () => {
    expect(billingModeOf([{ mode: "UPI" }, { mode: "UPI" }])).toBe("UPI");
    expect(billingModeOf([{ mode: "CASH" }, { mode: "UPI" }])).toBe("SPLIT");
    expect(billingModeOf([])).toBe("CASH");
  });
});

describe("round-off", () => {
  it("rounds to the nearest rupee, .50 going up", () => {
    expect(roundToRupee(1247.37)).toEqual({ net: 1247, roundOff: -0.37 });
    expect(roundToRupee(1247.5)).toEqual({ net: 1248, roundOff: 0.5 });
    expect(roundToRupee(117.99)).toEqual({ net: 118, roundOff: 0.01 });
    expect(roundToRupee(100)).toEqual({ net: 100, roundOff: 0 });
  });

  it("writes the round-off as a signed line", () => {
    expect(roundOffText(-0.37)).toBe("- 0.37");
    expect(roundOffText(0.4)).toBe("+ 0.40");
    expect(roundOffText(0)).toBe("");
  });
});

describe("payments", () => {
  it("starts with one payment of the whole bill when paid in full, none on credit", () => {
    expect(startPayments("PAID", 800, "ONLINE")).toEqual([{ mode: "UPI", amount: "800.00", reference: "" }]);
    expect(startPayments("PARTIAL", 800)).toEqual([{ mode: "CASH", amount: "", reference: "" }]);
    expect(startPayments("CREDIT", 800)).toEqual([]);
  });

  it("paid in full: the last payment is what the others leave", () => {
    const filled = fillLast([{ mode: "CASH", amount: "500" }, { mode: "UPI", amount: "0" }], 800);
    expect(filled[1].amount).toBe("300.00");
    expect(fillLast([{ mode: "CASH", amount: "900" }, { mode: "UPI", amount: "" }], 800)[1].amount).toBe("0.00");
    expect(paymentsTotal(filled)).toBe(800);
  });

  it("says what is wrong, like the server would", () => {
    expect(paymentsProblem("PAID", 800, [{ mode: "CASH", amount: "500" }, { mode: "UPI", amount: "300" }])).toBe("");
    expect(paymentsProblem("PAID", 800, [{ mode: "CASH", amount: "500" }])).toBe("The payments add up to ₹500.00 but the bill is ₹800.00");
    expect(paymentsProblem("PAID", 800, [])).toBe("Add a payment");
    expect(paymentsProblem("PAID", 800, [{ mode: "CASH", amount: "" }])).toBe("Each payment needs an amount");
    expect(paymentsProblem("PARTIAL", 800, [{ mode: "CASH", amount: "200" }])).toBe("");
    expect(paymentsProblem("PARTIAL", 800, [{ mode: "CASH", amount: "800" }])).toBe("A part payment must be less than the bill");
    expect(paymentsProblem("CREDIT", 800, [])).toBe("");
    expect(paymentsProblem("CREDIT", 800, [{ mode: "CASH", amount: "1" }])).toBe("A credit bill is not paid now");
  });

  it("sends numbers, the mode and a trimmed reference", () => {
    expect(paymentPayload([{ mode: "online", amount: "300.004", reference: "  TX9 " }, { mode: "CASH", amount: "500", reference: " " }]))
      .toEqual([{ mode: "UPI", amount: 300, reference: "TX9" }, { mode: "CASH", amount: 500, reference: null }]);
  });
});

describe("useRoundBillTotal", () => {
  beforeEach(() => jest.clearAllMocks());

  it("is on until the shop's setting says otherwise", async () => {
    fetchCustomItemSetting.mockResolvedValue({ roundBillTotal: false });
    const { result } = renderHook(() => useRoundBillTotal());
    expect(result.current).toBe(true);
    await waitFor(() => expect(result.current).toBe(false));
  });

  it("does not ask the server when switched off (a sales order)", () => {
    const { result } = renderHook(() => useRoundBillTotal(false));
    expect(result.current).toBe(true);
    expect(fetchCustomItemSetting).not.toHaveBeenCalled();
  });
});
