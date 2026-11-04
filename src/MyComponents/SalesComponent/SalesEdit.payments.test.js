import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SalesEdit from "./SalesEdit";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) });

const PRODUCT = { id: 1, name: "Paracetamol", barcode: "8901234567890", productTypeId: 10 };

/** 10 x 100 + 18% = 1,180. */
const sale = (o) => ({
  id: 9, invoiceNumber: "INV00009", billingMode: "SPLIT", paymentType: "PAID", retailerId: null, dueDate: null,
  totalDiscount: 0, manualDiscount: 0, schemeDiscount: 0, amountPaid: 1180, remainingAmount: 0,
  items: [{ id: 1, product: "Paracetamol", productId: 1, quantity: 10, sellingPrice: 100, taxAmount: 180, discountAmount: 0, freeItem: false, batchId: 1, batchNumberSnapshot: "B1" }],
  payments: [
    { mode: "CASH", amount: 700, reference: null, source: "BILL" },
    { mode: "UPI", amount: 480, reference: "TX1", source: "BILL" },
  ],
  ...o,
});

function mockApi(saleData) {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/Retailer/Dropdown")) return ok({ data: [] });
    if (url.includes("/api/ProductType/GetAllProductType")) return ok({ data: { productTypes: [{ id: 10, name: "Tablets" }] } });
    if (url.includes("/api/Product/GetAllProduct")) return ok({ data: [PRODUCT] });
    if (url.includes("/api/Sales/GetSalesByUkey/")) return ok({ data: saleData });
    if (url.includes("/api/Sales/UpdateSales/")) return ok({ status: 200 });
    return ok({ status: 200, data: null });
  });
}

const updateCall = () => apiClient.mock.calls.find(([u]) => u.includes("/api/Sales/UpdateSales/"));
const updateBody = () => JSON.parse(updateCall()[1].body);

async function openBilling(saleData) {
  mockApi(saleData);
  render(<SalesEdit uKey="sale-9" onClose={jest.fn()} onSubmit={jest.fn()} />);
  await screen.findByText(/Edit Sale/i);
  await screen.findByText("Original Items", { selector: "button" });
  fireEvent.click(screen.getByRole("button", { name: "Billing" }));
}

describe("SalesEdit — split payments", () => {
  beforeEach(() => jest.clearAllMocks());

  it("opens a split bill with its payments and saves them as they were", async () => {
    await openBilling(sale());
    expect(await screen.findByLabelText("Payment 1 amount")).toHaveValue(700);
    expect(screen.getByLabelText("Payment 2 mode")).toHaveValue("UPI");
    expect(screen.getByLabelText("Payment 2 amount")).toHaveValue(480);
    expect(screen.getByLabelText("Payment 2 reference")).toHaveValue("TX1");
    expect(screen.queryByTestId("collected-later")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Update Sale" }));
    await waitFor(() => expect(updateCall()).toBeTruthy());
    expect(updateBody()).toMatchObject({
      billingMode: "SPLIT", paymentType: "PAID", amountPaid: 1180,
      payments: [{ mode: "CASH", amount: 700, reference: null }, { mode: "UPI", amount: 480, reference: "TX1" }],
    });
  });

  it("a bill from before split payments opens with one payment in its mode", async () => {
    await openBilling(sale({ billingMode: "ONLINE", payments: [] }));
    expect(await screen.findByLabelText("Payment 1 mode")).toHaveValue("UPI");
    expect(screen.getByLabelText("Payment 1 amount")).toHaveValue(1180);
    expect(screen.queryByLabelText("Payment 2 amount")).toBeNull();
  });

  it("money collected later stays: settling the bill only asks for the rest", async () => {
    await openBilling(sale({
      billingMode: "CASH", paymentType: "PARTIAL", dueDate: "2026-11-30", amountPaid: 700, remainingAmount: 480,
      payments: [
        { mode: "CASH", amount: 500, reference: null, source: "BILL" },
        { mode: "UPI", amount: 200, reference: null, source: "COLLECTION" },
      ],
    }));
    expect(await screen.findByTestId("collected-later")).toHaveTextContent("₹200.00 was collected on this bill later");
    expect(screen.getByLabelText("Payment 1 amount")).toHaveValue(500);

    fireEvent.click(screen.getByRole("button", { name: /Full Payment/ }));
    await waitFor(() => expect(screen.getByLabelText("Payment 1 amount")).toHaveValue(980)); // 1,180 - 200 collected
    fireEvent.click(screen.getByRole("button", { name: "Update Sale" }));

    await waitFor(() => expect(updateCall()).toBeTruthy());
    expect(updateBody()).toMatchObject({
      paymentType: "PAID", amountPaid: 1180, billingMode: "CASH",
      payments: [{ mode: "CASH", amount: 980, reference: null }],
    });
  });
});
