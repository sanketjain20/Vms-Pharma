import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SalesEdit from "./SalesEdit";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

function jsonResponse(body) {
  return Promise.resolve({
    ok: true, status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

const PRODUCT_TYPES = [{ id: 10, name: "Tablets" }, { id: 20, name: "Syrups" }];
const TABLET = { id: 1, name: "Paracetamol", barcode: "1", productTypeId: 10 };
const SYRUP  = { id: 2, name: "CoughSyrup",  barcode: "2", productTypeId: 20 };

const BASE_SALE = {
  id: 9, invoiceNumber: "INV00009", items: [],
  totalDiscount: 0, billingMode: "CASH", amountPaid: 0, remainingAmount: 0,
  retailerId: null, paymentType: "PAID", dueDate: null,
};

function mockApi({ inventoryByProduct = {} } = {}) {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/Retailer/Dropdown")) return jsonResponse({ data: [] });
    if (url.includes("/api/ProductType/GetAllProductType")) return jsonResponse({ data: { productTypes: PRODUCT_TYPES } });
    if (url.includes("/api/Product/GetAllProduct")) return jsonResponse({ data: [TABLET, SYRUP] });
    if (url.includes("/api/Sales/GetSalesByUkey/")) return jsonResponse({ data: BASE_SALE });
    if (url.includes("/api/Product/GetProdByProdId/10")) return jsonResponse({ data: [TABLET] });
    if (url.includes("/api/Product/GetProdByProdId/20")) return jsonResponse({ data: [SYRUP] });
    if (url.includes("/api/Inventory/GetInventoryByProdId/")) {
      const id = url.split("/").pop();
      const inv = inventoryByProduct[id];
      return jsonResponse(inv ? { status: 200, data: inv } : { status: 404, data: null });
    }
    return jsonResponse({ status: 200, data: null });
  });
}

async function openProductTab() {
  render(<SalesEdit uKey="sale-9" onClose={jest.fn()} onSubmit={jest.fn()} />);
  await screen.findByText(/Edit Sale/i);
  fireEvent.click(screen.getByRole("button", { name: "Product" }));
}

function openProductDropdown() {
  fireEvent.click(screen.getByPlaceholderText("Search product…"));
}

describe("SalesEdit — product type filter chips", () => {
  beforeEach(() => jest.clearAllMocks());

  it("filters the Product dropdown's options to the clicked type, and 'All' clears it", async () => {
    mockApi();
    await openProductTab();

    fireEvent.click(screen.getByText("Tablets"));
    await waitFor(() => expect(screen.getByText("Tablets")).toHaveClass("is-active"));

    openProductDropdown();
    expect(screen.getByText("Paracetamol")).toBeInTheDocument();
    expect(screen.queryByText("CoughSyrup")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("All"));
    await waitFor(() => expect(screen.getByText("All")).toHaveClass("is-active"));

    openProductDropdown();
    expect(screen.getByText("Paracetamol")).toBeInTheDocument();
    expect(screen.getByText("CoughSyrup")).toBeInTheDocument();
  });
});

describe("SalesEdit — quantity stepper", () => {
  beforeEach(() => jest.clearAllMocks());

  it("increments and decrements quantity, and won't go over available stock", async () => {
    mockApi({ inventoryByProduct: { "1": { unitSellingPrice: 50, currentQuantity: 2 } } });
    await openProductTab();

    openProductDropdown();
    fireEvent.mouseDown(screen.getByText("Paracetamol"));
    await screen.findByText("₹50");

    const qtyInput = screen.getByPlaceholderText("Enter qty");
    const [minusBtn, plusBtn] = screen.getAllByRole("button", { name: /[−+]/ }).filter(b =>
      b.closest(".afx-qty")
    );

    fireEvent.click(plusBtn);
    expect(qtyInput).toHaveValue(1);
    fireEvent.click(plusBtn);
    expect(qtyInput).toHaveValue(2);
    fireEvent.click(plusBtn);
    expect(qtyInput).toHaveValue(2); // stock ceiling is 2

    fireEvent.click(minusBtn);
    expect(qtyInput).toHaveValue(1);
  });
});

describe("SalesEdit — payment type tiles", () => {
  beforeEach(() => jest.clearAllMocks());

  it("switches payment type the same way the old radio did", async () => {
    mockApi();
    render(<SalesEdit uKey="sale-9" onClose={jest.fn()} onSubmit={jest.fn()} />);
    await screen.findByText(/Edit Sale/i);
    fireEvent.click(screen.getByRole("button", { name: "Billing" }));

    expect(screen.getByText("Full Payment").closest("button")).toHaveClass("is-active");

    fireEvent.click(screen.getByText("Credit (Pay Later)"));
    expect(screen.getByText("Credit (Pay Later)").closest("button")).toHaveClass("is-active");
    expect(screen.getByText("Full Payment").closest("button")).not.toHaveClass("is-active");
  });
});

describe("SalesEdit — tabs vs all-sections view toggle", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows one tab's section at a time by default (Original Items first), and every section stacked at once in All sections mode", async () => {
    mockApi();
    render(<SalesEdit uKey="sale-9" onClose={jest.fn()} onSubmit={jest.fn()} />);
    await screen.findByText(/Edit Sale/i);

    // default "tabs" mode: Original Items tab active first (matches the original 3-tab order)
    expect(screen.getByText("No existing items")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Scan or type barcode/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Payment Type")).not.toBeInTheDocument();

    const toggle = screen.getByText("All sections").closest("button");
    fireEvent.click(toggle);
    expect(toggle).toHaveClass("is-on");
    // every tab's section renders as its own stacked panel at once
    expect(screen.getByText("No existing items")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Scan or type barcode/i)).toBeInTheDocument();
    expect(screen.getByText("Payment Type")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Billing" })).not.toBeInTheDocument();

    fireEvent.click(toggle); // toggling it off again
    expect(toggle).not.toHaveClass("is-on");
    expect(screen.queryByPlaceholderText(/Scan or type barcode/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Payment Type")).not.toBeInTheDocument();
  });
});
