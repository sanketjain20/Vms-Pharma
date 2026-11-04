import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import SalesEdit from "./SalesEdit";
import apiClient from "../../Config/apiClient";
import { toast } from "react-toastify";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) });

const PRODUCTS = [
  { id: 1, name: "Paracetamol", productTypeId: 10, gstRate: 18, sellingPrice: 100 },
  { id: 2, name: "Cough syrup", productTypeId: 10, gstRate: null, sellingPrice: 50 }, // no GST rate yet: common GST
];

const row = (o) => ({ id: 1, product: "Paracetamol", productId: 1, quantity: 10, sellingPrice: 100, taxAmount: 180, discountAmount: 0,
  freeItem: false, batchId: 1, batchNumberSnapshot: "B1", gstSource: "PRODUCT", gstRate: 18, ...o });

/** 10 Paracetamol at 100 + 18% and 4 Cough syrup at 50 with Rs 24 GST (12%, from before the product had a rate). */
const SALE = {
  id: 9, invoiceNumber: "INV00009", billingMode: "CASH", paymentType: "PAID", retailerId: null, dueDate: null,
  totalDiscount: 0, manualDiscount: 0, schemeDiscount: 0, amountPaid: 1404, remainingAmount: 0,
  items: [
    row({}),
    row({ id: 2, productId: 2, product: "Cough syrup", quantity: 4, sellingPrice: 50, taxAmount: 24, batchId: 2, batchNumberSnapshot: "B2", gstSource: null, gstRate: null }),
  ],
  payments: [{ mode: "CASH", amount: 1404, reference: null, source: "BILL" }],
};

function mockApi() {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/Sales/GetSalesByUkey/")) return ok({ data: SALE });
    if (url.includes("/api/Product/GetAllProduct")) return ok({ data: PRODUCTS });
    if (url.includes("/api/ProductType/GetAllProductType")) return ok({ data: { productTypes: [{ id: 10, name: "Medicine" }] } });
    if (url.includes("/api/Inventory/GetInventoryByProdId/1")) return ok({ status: 200, data: { currentQuantity: 50, unitSellingPrice: 100 } });
    if (url.includes("/api/Inventory/GetInventoryByProdId/2")) return ok({ status: 200, data: { currentQuantity: 50, unitSellingPrice: 50 } });
    if (url.includes("/api/Sales/UpdateSales/")) return ok({ status: 200 });
    return ok({ status: 200, data: null });
  });
}

const updateCall = () => apiClient.mock.calls.find(([u]) => u.includes("/api/Sales/UpdateSales/"));
const lines = () => screen.queryAllByTestId("sale-line");
const lineOf = (name) => lines().find((l) => within(l).queryByText(name));

async function openProducts() {
  mockApi();
  render(<SalesEdit uKey="sale-9" onClose={jest.fn()} onSubmit={jest.fn()} />);
  await screen.findByText(/Edit Sale/i);
  await screen.findByText("Original Items", { selector: "button" });
  fireEvent.click(screen.getByRole("button", { name: "Product" }));
  await waitFor(() => expect(lines()).toHaveLength(2));
}

async function edit(name) {
  fireEvent.click(within(lineOf(name)).getByTitle("Edit"));
  await waitFor(() => expect(screen.getByRole("button", { name: "Update Item" })).toBeEnabled());
}

beforeEach(() => jest.clearAllMocks());

describe("SalesEdit — editing a line", () => {
  it("takes the line out of the table while it is in the form, so it can't be deleted meanwhile", async () => {
    await openProducts();
    await edit("Paracetamol");
    expect(lines()).toHaveLength(1);
    expect(lineOf("Paracetamol")).toBeUndefined(); // nothing left to delete
    expect(screen.getByRole("button", { name: "Cancel edit" })).toBeInTheDocument();
  });

  it("the case that crashed: delete the other line, then Update Item — no error, the line goes back", async () => {
    await openProducts();
    await edit("Paracetamol");
    fireEvent.click(within(lineOf("Cough syrup")).getByTitle("Delete"));
    expect(lines()).toHaveLength(0);
    fireEvent.change(screen.getByPlaceholderText("Enter qty"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Update Item" }));
    expect(lines()).toHaveLength(1);
    expect(within(lineOf("Paracetamol")).getByTestId("line-qty")).toHaveTextContent("12");
  });

  it("Update Item puts it back in the same place; Cancel edit puts it back unchanged", async () => {
    await openProducts();
    await edit("Paracetamol");
    fireEvent.change(screen.getByPlaceholderText("Enter qty"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel edit" }));
    expect(lines().map((l) => within(l).getByTestId("line-qty").textContent)).toEqual(["10", "4"]); // as it was, first

    await edit("Paracetamol");
    fireEvent.change(screen.getByPlaceholderText("Enter qty"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Update Item" }));
    expect(lines().map((l) => within(l).getByTestId("line-qty").textContent)).toEqual(["3", "4"]); // changed, still first
  });

  it("the bill can't be saved while a line is still in the form", async () => {
    await openProducts();
    await edit("Paracetamol");
    fireEvent.click(screen.getByRole("button", { name: "Billing" }));
    fireEvent.click(screen.getByRole("button", { name: "Update Sale" }));
    expect(toast.error).toHaveBeenCalledWith("Finish editing Paracetamol first: Update Item or Cancel edit");
    expect(updateCall()).toBeUndefined();
  });
});

describe("SalesEdit — the GST of an edited line follows the quantity", () => {
  it("a product with no rate is edited at the % it was billed at, not a flat Rs amount", async () => {
    await openProducts();
    await edit("Cough syrup");
    expect(screen.getByDisplayValue("% Rate")).toBeInTheDocument();
    expect(screen.getByDisplayValue("12%")).toBeInTheDocument(); // Rs 24 on 4 x 50

    fireEvent.change(screen.getByPlaceholderText("Enter qty"), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: "Update Item" }));
    // 8 x 50 = 400 at 12% = 48 (not the old Rs 24)
    expect(within(lineOf("Cough syrup")).getByTestId("line-gst")).toHaveTextContent("48.00");
    expect(within(lineOf("Cough syrup")).getByTestId("line-incl")).toHaveTextContent("448.00");

    fireEvent.click(screen.getByRole("button", { name: "Billing" }));
    await waitFor(() => { // the changed line re-checks its schemes ("try again"): press again until it goes
      if (!updateCall()) fireEvent.click(screen.getByRole("button", { name: "Update Sale" }));
      expect(updateCall()).toBeTruthy();
    });
    const sent = JSON.parse(updateCall()[1].body).items.find((i) => i.productId === 2);
    expect(sent).toMatchObject({ quantity: 8, taxAmount: 48, gstRate: 12 }); // the server reads the rate, not a stale amount
  });

  it("a product with its own rate keeps it", async () => {
    await openProducts();
    await edit("Paracetamol");
    expect(screen.getByTestId("product-gst-info")).toHaveTextContent("18% (from the product)");
    fireEvent.change(screen.getByPlaceholderText("Enter qty"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Update Item" }));
    expect(within(lineOf("Paracetamol")).getByTestId("line-incl")).toHaveTextContent("590.00"); // 500 + 18%
  });
});
