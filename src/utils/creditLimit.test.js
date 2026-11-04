import { render, screen, fireEvent, renderHook, waitFor } from "@testing-library/react";
import { useCreditCheck, creditProblem } from "./creditLimit";
import CreditLimitNotice from "../MyComponents/SalesComponent/CreditLimitNotice";
import apiClient from "../Config/apiClient";

jest.mock("../Config/apiClient", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("../Config/api.config", () => ({ __esModule: true, default: "http://api" }));

const ok = (data) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ status: 200, data }) });
const OVER = { retailer: "Shop Five", limit: 1000, noLimit: false, owed: 900, adds: 300, after: 1200, over: true, overBy: 200, canExceed: true };

beforeEach(() => jest.clearAllMocks());

describe("useCreditCheck", () => {
  it("asks for the retailer and what the bill leaves unpaid (and the bill being edited)", async () => {
    apiClient.mockImplementation(() => ok(OVER));
    const { result } = renderHook(() => useCreditCheck("5", 300.004, 9));
    await waitFor(() => expect(result.current).toEqual(OVER));
    expect(apiClient).toHaveBeenCalledWith("http://api/api/Sales/CreditCheck?retailerId=5&unpaid=300.00&saleId=9", { method: "GET" });
  });

  it("asks nothing for a walk-in or a bill paid in full", async () => {
    renderHook(() => useCreditCheck(null, 300));
    renderHook(() => useCreditCheck("5", 0));
    await new Promise((r) => setTimeout(r, 350));
    expect(apiClient).not.toHaveBeenCalled();
  });
});

describe("creditProblem", () => {
  it("over the limit: blocked without the permission, needs a reason with it", () => {
    expect(creditProblem(null, "")).toBe("");
    expect(creditProblem({ ...OVER, over: false }, "")).toBe("");
    expect(creditProblem({ ...OVER, canExceed: false }, "anything")).toBe("This bill takes Shop Five over their credit limit");
    expect(creditProblem(OVER, " ")).toBe("Give a reason to bill over the credit limit");
    expect(creditProblem(OVER, "Festival order")).toBe("");
  });
});

describe("CreditLimitNotice", () => {
  it("within the limit: a quiet line with the figures", () => {
    render(<CreditLimitNotice check={{ ...OVER, adds: 50, after: 950, over: false, overBy: 0 }} reason="" onReason={() => {}} />);
    expect(screen.getByTestId("credit-limit")).toHaveTextContent("Credit limit₹1,000.00 · owes ₹900.00 · this bill ₹50.00 → ₹950.00");
    expect(screen.queryByLabelText("Reason for going over the credit limit")).toBeNull();
  });

  it("over it with the permission: asks for a reason", () => {
    const onReason = jest.fn();
    render(<CreditLimitNotice check={OVER} reason="" onReason={onReason} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Over the credit limit");
    expect(screen.getByTestId("credit-over-by")).toHaveTextContent("₹200.00 over. You can bill over the limit with a reason.");
    fireEvent.change(screen.getByLabelText("Reason for going over the credit limit"), { target: { value: "Festival order" } });
    expect(onReason).toHaveBeenCalledWith("Festival order");
  });

  it("over it without: says what to do instead", () => {
    render(<CreditLimitNotice check={{ ...OVER, canExceed: false }} reason="" onReason={() => {}} />);
    expect(screen.getByTestId("credit-over-by")).toHaveTextContent("Take more payment now, bill less, or ask for the limit to be raised");
    expect(screen.queryByLabelText("Reason for going over the credit limit")).toBeNull();
  });

  it("a retailer with no limit shows nothing", () => {
    const { container } = render(<CreditLimitNotice check={{ ...OVER, noLimit: true }} reason="" onReason={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
