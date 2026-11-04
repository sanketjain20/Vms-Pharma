import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SalesEdit from "./SalesEdit";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) });

const PRODUCT = { id: 1, name: "Paracetamol", barcode: "8901234567890", productTypeId: 10 };

const sale = (o) => ({
  id: 9, invoiceNumber: "INV00009", billingMode: "CASH", paymentType: "PAID", retailerId: null, dueDate: null,
  totalDiscount: 0, manualDiscount: 0, schemeDiscount: 0, amountPaid: 1180, remainingAmount: 0,
  items: [{ id: 1, product: "Paracetamol", productId: 1, quantity: 10, sellingPrice: 100, taxAmount: 180, discountAmount: 0, freeItem: false, batchId: 1, batchNumberSnapshot: "B1" }],
  ...o,
});

function mockApi(saleData) {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/Retailer/Dropdown")) return ok({ data: [{ id: 5, uKey: "r5", shopName: "Shop Five", ownerName: "Owner" }] });
    if (url.includes("/api/ProductType/GetAllProductType")) return ok({ data: { productTypes: [{ id: 10, name: "Tablets" }] } });
    if (url.includes("/api/Product/GetAllProduct")) return ok({ data: [PRODUCT] });
    if (url.includes("/api/Sales/GetSalesByUkey/")) return ok({ data: saleData });
    if (url.includes("/api/Scheme/Applicable")) return ok({ status: 200, data: null });
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

describe("SalesEdit — walk-in customer name & mobile", () => {
  beforeEach(() => jest.clearAllMocks());

  it("opens with the saved walk-in name and mobile filled in", async () => {
    await openBilling(sale({ customerName: "Ravi Kumar", customerPhone: "9876543210" }));
    expect(await screen.findByLabelText(/Customer name/)).toHaveValue("Ravi Kumar");
    expect(screen.getByLabelText(/Mobile number/)).toHaveValue("9876543210");
  });

  it("saves a changed mobile, normalised", async () => {
    await openBilling(sale({ customerName: "Ravi Kumar", customerPhone: "9876543210" }));
    fireEvent.change(await screen.findByLabelText(/Mobile number/), { target: { value: "+91 91234 56789" } });
    fireEvent.click(screen.getByRole("button", { name: "Update Sale" }));

    await waitFor(() => expect(updateCall()).toBeTruthy());
    expect(updateBody()).toMatchObject({ retailerId: null, customerName: "Ravi Kumar", customerPhone: "9123456789" });
  });

  it("an invalid mobile blocks the update", async () => {
    await openBilling(sale({}));
    fireEvent.change(await screen.findByLabelText(/Mobile number/), { target: { value: "000" } });
    fireEvent.click(screen.getByRole("button", { name: "Update Sale" }));

    expect(await screen.findByText("Enter a valid 10-digit mobile number")).toBeInTheDocument();
    expect(updateCall()).toBeUndefined();
  });

  it("a retailer sale shows no walk-in fields and sends none", async () => {
    await openBilling(sale({ retailerId: 5 }));
    await waitFor(() => expect(screen.queryByLabelText(/Customer name/)).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Update Sale" }));
    await waitFor(() => expect(updateCall()).toBeTruthy());
    expect(updateBody()).toMatchObject({ retailerId: 5, customerName: null, customerPhone: null });
  });
});
