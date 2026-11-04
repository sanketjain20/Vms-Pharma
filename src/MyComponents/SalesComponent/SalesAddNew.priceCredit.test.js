import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import SalesAddNew from "./SalesAddNew";
import apiClient from "../../Config/apiClient";
import { toast } from "react-toastify";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));
jest.mock("./SalesView", () => () => null);

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

const OVER = { retailer: "Shop Five", limit: 1000, noLimit: false, owed: 900, adds: 118, after: 1018, over: true, overBy: 18, canExceed: true };

function mockApi({ actions = ["View", "Add"], credit = null } = {}) {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/Access/GetUserModuleAccess/5/")) return ok({ status: 200, data: actions });
    if (url.includes("/api/Sales/CustomItemSetting")) return ok({ status: 200, data: { allowCustomItems: false, roundBillTotal: false } });
    if (url.includes("/api/Retailer/Dropdown")) return ok({ data: [{ id: 5, uKey: "r5", shopName: "Shop Five", ownerName: "Owner" }] });
    if (url.includes("/api/ProductType/GetAllProductType")) return ok({ data: { productTypes: [{ id: 4, name: "Clothing" }] } });
    if (url.includes("/api/Product/GetAllProduct")) {
      return ok({ data: [{ id: 1, name: "Cotton shirt", productTypeId: 4, sellingPrice: 100, costPrice: 60, stock: 10, unit: "PCS", gstRate: 18, priceIncludesGst: false }] });
    }
    if (url.includes("/api/Sales/CreditCheck")) return ok({ status: 200, data: credit });
    if (url.includes("/api/Sales/AddSales")) return ok({ status: 200, message: "Sale added successfully", data: { uKey: "s1" } });
    return ok({ status: 200, data: null });
  });
}

const saleCall = () => apiClient.mock.calls.find(([u]) => u.includes("/api/Sales/AddSales"));
const saleBody = () => JSON.parse(saleCall()[1].body);

async function checkout() {
  render(<SalesAddNew onClose={jest.fn()} onSubmit={jest.fn()} />);
  await screen.findByText("Cotton shirt");
  fireEvent.click(within(screen.getByText("Cotton shirt").closest(".san-pcard")).getByRole("button", { name: /Add to cart/ }));
  fireEvent.click(screen.getByRole("button", { name: /Proceed to checkout/i }));
  await screen.findByRole("button", { name: /Place order/i });
}

async function pickRetailer() {
  fireEvent.click(screen.getByPlaceholderText("Search retailer..."));
  fireEvent.mouseDown(await screen.findByText("Shop Five · Owner"));
  await waitFor(() => expect(apiClient.mock.calls.some(([u]) => u.includes("/api/Scheme/Applicable") && u.includes("retailerId=5"))).toBe(true));
  await new Promise((r) => setTimeout(r, 0));
}

beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); });

describe("Quick Sale — price change at the counter", () => {
  it("a role without the permission can't change the price", async () => {
    mockApi();
    await checkout();
    expect(screen.getByTestId("line-price-value")).toHaveTextContent("100.00");
    expect(screen.queryByRole("button", { name: "Change price" })).toBeNull();
  });

  it("with it, the new price is billed and sent with its reason", async () => {
    mockApi({ actions: ["View", "Add", "Change Selling Price"] });
    await checkout();
    fireEvent.click(await screen.findByRole("button", { name: "Change price" }));
    fireEvent.change(screen.getByLabelText("New price for this line"), { target: { value: "90" } });
    fireEvent.change(screen.getByLabelText("Reason for the price change"), { target: { value: "Bargained" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(screen.getByTestId("line-price-changed")).toHaveTextContent("Changed from ₹100.00 · Bargained");
    expect(within(screen.getByTestId("bill-total")).getByText("₹106.20")).toBeInTheDocument(); // 90 + 18%
    // a new price re-checks the line's schemes; placing the order waits for that on purpose
    // ("Still checking schemes — try again"): press again until it goes, as a cashier would, however busy the machine is
    await waitFor(() => expect(apiClient.mock.calls.some(([u]) => u.includes("/api/Scheme/Applicable") && u.includes("unitPrice=90"))).toBe(true));
    await waitFor(() => {
      if (!saleCall()) fireEvent.click(screen.getByRole("button", { name: /Place order/i }));
      expect(saleCall()).toBeTruthy();
    });
    expect(apiClient.mock.calls.filter(([u]) => u.includes("/api/Sales/AddSales"))).toHaveLength(1);
    expect(saleBody().items[0]).toMatchObject({ sellingPrice: 90, priceOverrideReason: "Bargained", belowCostConfirmed: false });
  });
});

describe("Quick Sale — retailer credit limit", () => {
  it("a credit bill over the limit asks for a reason and sends it", async () => {
    mockApi({ actions: ["View", "Add", "Exceed Credit Limit"], credit: OVER });
    await checkout();
    await pickRetailer();
    fireEvent.click(screen.getByRole("button", { name: /Credit/ }));
    fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: "2026-11-30" } });

    const notice = await screen.findByTestId("credit-limit");
    expect(notice).toHaveTextContent("₹18.00 over");
    expect(apiClient.mock.calls.some(([u]) => u.includes("/api/Sales/CreditCheck?retailerId=5&unpaid=118.00"))).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /Place order/i }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Give a reason to bill over the credit limit"));
    expect(saleCall()).toBeUndefined();

    fireEvent.change(screen.getByLabelText("Reason for going over the credit limit"), { target: { value: "Festival order" } });
    await waitFor(() => { // a scheme check still running answers "try again": press again until it goes
      if (!saleCall()) fireEvent.click(screen.getByRole("button", { name: /Place order/i }));
      expect(saleCall()).toBeTruthy();
    });
    expect(saleBody()).toMatchObject({ retailerId: 5, paymentType: "CREDIT", creditLimitReason: "Festival order" });
  });

  it("without the permission the bill can't go over the limit", async () => {
    mockApi({ credit: { ...OVER, canExceed: false } });
    await checkout();
    await pickRetailer();
    fireEvent.click(screen.getByRole("button", { name: /Credit/ }));
    fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: "2026-11-30" } });

    expect(await screen.findByTestId("credit-over-by")).toHaveTextContent("Take more payment now");
    fireEvent.click(screen.getByRole("button", { name: /Place order/i }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("This bill takes Shop Five over their credit limit"));
    expect(saleCall()).toBeUndefined();
  });
});
