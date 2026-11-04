import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SalesEdit from "./SalesEdit";
import apiClient from "../../Config/apiClient";
import { toast } from "react-toastify";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) });

const PRODUCT = { id: 1, name: "Cotton shirt", productTypeId: 10, sellingPrice: 100, costPrice: 60, gstRate: 18 };

/** A retailer bill of 10 shirts at Rs 90 (changed from 100), 18% GST = 1,062, Rs 500 paid, Rs 562 due. */
const SALE = {
  id: 9, invoiceNumber: "INV00009", billingMode: "CASH", paymentType: "PARTIAL", retailerId: 5, dueDate: "2026-11-30",
  totalDiscount: 0, manualDiscount: 0, schemeDiscount: 0, amountPaid: 500, remainingAmount: 562,
  items: [{ id: 1, product: "Cotton shirt", productId: 1, quantity: 10, sellingPrice: 90, taxAmount: 162, discountAmount: 0, freeItem: false,
    batchId: 1, batchNumberSnapshot: "B1", gstSource: "PRODUCT", gstRate: 18, listPrice: 100, priceOverrideReason: "Bulk order" }],
  payments: [{ mode: "CASH", amount: 500, reference: null, source: "BILL" }],
};

function mockApi(credit) {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/Retailer/Dropdown")) return ok({ data: [{ id: 5, uKey: "r5", shopName: "Shop Five", ownerName: "Owner" }] });
    if (url.includes("/api/ProductType/GetAllProductType")) return ok({ data: { productTypes: [{ id: 10, name: "Clothing" }] } });
    if (url.includes("/api/Product/GetAllProduct")) return ok({ data: [PRODUCT] });
    if (url.includes("/api/Sales/GetSalesByUkey/")) return ok({ data: SALE });
    if (url.includes("/api/Sales/CreditCheck")) return ok({ status: 200, data: credit });
    if (url.includes("/api/Sales/UpdateSales/")) return ok({ status: 200 });
    return ok({ status: 200, data: null });
  });
}

const updateCall = () => apiClient.mock.calls.find(([u]) => u.includes("/api/Sales/UpdateSales/"));
const creditCalls = () => apiClient.mock.calls.filter(([u]) => u.includes("/api/Sales/CreditCheck"));

async function open() {
  render(<SalesEdit uKey="sale-9" onClose={jest.fn()} onSubmit={jest.fn()} />);
  await screen.findByText(/Edit Sale/i);
  await screen.findByText("Original Items", { selector: "button" });
}

beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); });

describe("SalesEdit — a changed price and the credit limit", () => {
  it("shows the price change made when billed and keeps it on saving", async () => {
    mockApi(null);
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Product" }));
    expect(await screen.findByTestId("line-price-changed")).toHaveTextContent("Changed from ₹100.00 · Bulk order");
    fireEvent.click(screen.getByRole("button", { name: "Billing" }));
    fireEvent.click(screen.getByRole("button", { name: "Update Sale" }));
    await waitFor(() => expect(updateCall()).toBeTruthy());
    expect(JSON.parse(updateCall()[1].body).items[0]).toMatchObject({ sellingPrice: 90, priceOverrideReason: "Bulk order" });
  });

  it("checks the credit limit without counting this bill's own balance twice, and sends the reason", async () => {
    mockApi({ retailer: "Shop Five", limit: 1000, noLimit: false, owed: 600, adds: 562, after: 1162, over: true, overBy: 162, canExceed: true });
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Billing" }));
    await waitFor(() => expect(creditCalls().some(([u]) => u.includes("retailerId=5") && u.includes("unpaid=562.00") && u.includes("saleId=9"))).toBe(true));

    expect(await screen.findByTestId("credit-over-by")).toHaveTextContent("₹162.00 over");
    fireEvent.click(screen.getByRole("button", { name: "Update Sale" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Give a reason to bill over the credit limit"));
    expect(updateCall()).toBeUndefined();

    fireEvent.change(screen.getByLabelText("Reason for going over the credit limit"), { target: { value: "Agreed with owner" } });
    fireEvent.click(screen.getByRole("button", { name: "Update Sale" }));
    await waitFor(() => expect(updateCall()).toBeTruthy());
    expect(JSON.parse(updateCall()[1].body)).toMatchObject({ creditLimitReason: "Agreed with owner" });
  });
});
