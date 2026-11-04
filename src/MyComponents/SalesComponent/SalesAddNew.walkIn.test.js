import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SalesAddNew from "./SalesAddNew";
import apiClient from "../../Config/apiClient";
import { toast } from "react-toastify";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));
jest.mock("./SalesView", () => () => null);

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

const PRODUCT = { id: 1, name: "Paracetamol", barcode: "8901234567890", productTypeId: 10, sellingPrice: 100, stock: 500 };

function mockApi() {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/Retailer/Dropdown")) return ok({ data: [{ id: 5, uKey: "r5", shopName: "Shop Five", ownerName: "Owner" }] });
    if (url.includes("/api/ProductType/GetAllProductType")) return ok({ data: { productTypes: [{ id: 10, name: "Tablets" }] } });
    if (url.includes("/api/Product/GetAllProduct")) return ok({ data: [PRODUCT] });
    if (url.includes("/api/Scheme/Applicable")) return ok({ status: 200, data: null });
    if (url.includes("/api/Sales/AddSales")) return ok({ status: 200, message: "Sale added successfully", data: { uKey: "s1" } });
    return ok({ status: 200, data: null });
  });
}

const saleCall = () => apiClient.mock.calls.find(([u]) => u.includes("/api/Sales/AddSales"));
const saleBody = () => JSON.parse(saleCall()[1].body);

async function checkout() {
  render(<SalesAddNew onClose={jest.fn()} onSubmit={jest.fn()} />);
  fireEvent.click(await screen.findByRole("button", { name: /Add to cart/i }));
  await waitFor(() => expect(apiClient.mock.calls.some(([u]) => u.includes("/api/Scheme/Applicable"))).toBe(true));
  fireEvent.click(screen.getByRole("button", { name: /Proceed to checkout/i }));
}

describe("SalesAddNew (Quick Sale) — walk-in customer name & mobile", () => {
  beforeEach(() => jest.clearAllMocks());

  it("sends the walk-in name and a normalised mobile with the sale", async () => {
    mockApi();
    await checkout();

    fireEvent.change(screen.getByLabelText("Customer name (optional)"), { target: { value: "  Ravi  Kumar " } });
    fireEvent.change(screen.getByLabelText("Mobile number (optional)"), { target: { value: "+91 98765-43210" } });
    fireEvent.click(screen.getByRole("button", { name: /Place order/i }));

    await waitFor(() => expect(saleCall()).toBeTruthy());
    expect(saleBody()).toMatchObject({ retailerId: null, customerName: "Ravi Kumar", customerPhone: "9876543210" });
  });

  it("leaving both blank still places the sale, as a plain walk-in", async () => {
    mockApi();
    await checkout();
    fireEvent.click(screen.getByRole("button", { name: /Place order/i }));

    await waitFor(() => expect(saleCall()).toBeTruthy());
    expect(saleBody()).toMatchObject({ customerName: null, customerPhone: null });
  });

  it("an invalid mobile stops the sale and says why", async () => {
    mockApi();
    await checkout();

    fireEvent.change(screen.getByLabelText("Mobile number (optional)"), { target: { value: "12345" } });
    fireEvent.click(screen.getByRole("button", { name: /Place order/i }));

    expect(await screen.findByText("Enter a valid 10-digit mobile number")).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith("Enter a valid 10-digit mobile number");
    expect(saleCall()).toBeUndefined();
  });

  it("picking a retailer hides the walk-in fields and sends no walk-in details", async () => {
    mockApi();
    await checkout();
    fireEvent.change(screen.getByLabelText("Customer name (optional)"), { target: { value: "Ravi" } });

    fireEvent.click(screen.getByPlaceholderText("Search retailer..."));
    fireEvent.mouseDown(await screen.findByText("Shop Five · Owner"));

    expect(screen.queryByLabelText("Customer name (optional)")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Mobile number (optional)")).not.toBeInTheDocument();
    // a new retailer re-checks schemes; placing the order waits for that on purpose
    await waitFor(() => expect(apiClient.mock.calls.some(([u]) => u.includes("/api/Scheme/Applicable") && u.includes("retailerId=5"))).toBe(true));
    await new Promise((r) => setTimeout(r, 0));

    fireEvent.click(screen.getByRole("button", { name: /Place order/i }));
    await waitFor(() => expect(saleCall()).toBeTruthy());
    expect(saleBody()).toMatchObject({ retailerId: 5, customerName: null, customerPhone: null });
  });
});
