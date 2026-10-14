import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SalesAdd from "./SalesAdd";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

function jsonResponse(body) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) });
}

const PRODUCT_TYPES = [{ id: 10, name: "Tablets" }, { id: 20, name: "Syrups" }];
const TABLET  = { id: 1, name: "Paracetamol", barcode: "1", productTypeId: 10 };
const SYRUP   = { id: 2, name: "CoughSyrup",  barcode: "2", productTypeId: 20 };

function mockApi({ inventoryByProduct = {} } = {}) {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/Retailer/Dropdown")) return jsonResponse({ data: [] });
    if (url.includes("/api/ProductType/GetAllProductType")) return jsonResponse({ data: { productTypes: PRODUCT_TYPES } });
    if (url.includes("/api/Product/GetAllProduct")) return jsonResponse({ data: [TABLET, SYRUP] });
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
  render(<SalesAdd onClose={jest.fn()} onSubmit={jest.fn()} />);
  await screen.findByText("Add Sales");
  fireEvent.click(screen.getByRole("button", { name: "Product" }));
}

function openProductDropdown() {
  fireEvent.click(screen.getByPlaceholderText("Search product…"));
}

describe("SalesAdd — product type filter chips", () => {
  beforeEach(() => jest.clearAllMocks());

  it("filters the Product dropdown's options to the clicked type, and 'All' clears it", async () => {
    mockApi();
    await openProductTab();

    fireEvent.click(await screen.findByText("Tablets"));
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

  it("does not require a product type to be selected before adding an item", async () => {
    mockApi({ inventoryByProduct: { "1": { unitSellingPrice: 50, currentQuantity: 20 } } });
    await openProductTab();

    openProductDropdown();
    fireEvent.mouseDown(screen.getByText("Paracetamol"));

    await screen.findByText("₹50");
    fireEvent.change(screen.getByPlaceholderText("Enter qty"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Add Item" }));

    expect(await screen.findByText("Line Items")).toBeInTheDocument();
  });
});

describe("SalesAdd — quantity stepper", () => {
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
    // stock ceiling is 2 — a third click must not push it to 3
    fireEvent.click(plusBtn);
    expect(qtyInput).toHaveValue(2);

    fireEvent.click(minusBtn);
    expect(qtyInput).toHaveValue(1);
  });
});

describe("SalesAdd — payment type tiles", () => {
  beforeEach(() => jest.clearAllMocks());

  it("switches payment type and syncs the amount-paid field the same way the old radio did", async () => {
    mockApi();
    render(<SalesAdd onClose={jest.fn()} onSubmit={jest.fn()} />);
    await screen.findByText("Add Sales");
    fireEvent.click(screen.getByRole("button", { name: "Billing" }));

    const amountPaidInput = screen.getByPlaceholderText("0.00");
    expect(amountPaidInput).toBeDisabled(); // PAID is the default, amount is auto-filled + locked

    fireEvent.click(screen.getByText("Credit (Pay Later)"));
    expect(screen.getByText("Credit (Pay Later)").closest("button")).toHaveClass("is-active");
    expect(amountPaidInput).toHaveValue(0);
    expect(amountPaidInput).toBeDisabled();

    fireEvent.click(screen.getByText("Partial Payment"));
    expect(screen.getByText("Partial Payment").closest("button")).toHaveClass("is-active");
    expect(amountPaidInput).not.toBeDisabled();
  });
});

describe("SalesAdd — tabs vs all-sections view toggle", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows one tab's section at a time by default (Tax first), and every section stacked at once in All sections mode", async () => {
    mockApi();
    render(<SalesAdd onClose={jest.fn()} onSubmit={jest.fn()} />);
    await screen.findByText("Add Sales");

    // default "tabs" mode: Tax tab active first (matches the original 3-tab order)
    expect(screen.getByText("GST Mode")).toBeInTheDocument();
    expect(screen.queryByText("Find Product")).not.toBeInTheDocument();
    expect(screen.queryByText("Payment Type")).not.toBeInTheDocument();

    const toggle = screen.getByText("All sections").closest("button");
    fireEvent.click(toggle);
    expect(toggle).toHaveClass("is-on");
    // every tab's section renders as its own stacked panel at once
    expect(screen.getByText("GST Mode")).toBeInTheDocument();
    expect(screen.getByText("Find Product")).toBeInTheDocument();
    expect(screen.getByText("Payment Type")).toBeInTheDocument();
    // the tab bar itself is hidden while in "all" mode — nothing to click between
    expect(screen.queryByRole("button", { name: "Billing" })).not.toBeInTheDocument();

    fireEvent.click(toggle); // toggling it off again
    expect(toggle).not.toHaveClass("is-on");
    expect(screen.queryByText("Find Product")).not.toBeInTheDocument();
    expect(screen.queryByText("Payment Type")).not.toBeInTheDocument();
  });
});
