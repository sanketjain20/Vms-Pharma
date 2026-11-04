import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import SalesAdd from "./SalesAdd";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) });
const PHONE = { id: 7, name: "Phone X", productTypeId: 4, trackSerial: true, warrantyMonths: 12, barcode: "PHX", sellingPrice: 10000, stock: 3 };
const CABLE = { id: 8, name: "USB Cable", productTypeId: 4, barcode: "USB", sellingPrice: 200, stock: 40 };

function mockApi() {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/Retailer/Dropdown")) return ok({ data: [] });
    if (url.includes("/api/ProductType/GetAllProductType")) return ok({ data: { productTypes: [{ id: 4, name: "Mobiles" }] } });
    if (url.includes("/api/Product/GetAllProduct") || url.includes("/api/Product/GetProdByProdId")) return ok({ data: [PHONE, CABLE] });
    if (url.includes("/api/ProductType/GetProdTypeByProductId")) return ok({ data: { productTypeId: 4 } });
    if (url.includes("/api/Inventory/GetInventoryByProdId/7")) return ok({ status: 200, data: { currentQuantity: 3, unitSellingPrice: 10000 } });
    if (url.includes("/api/Inventory/GetInventoryByProdId/8")) return ok({ status: 200, data: { currentQuantity: 40, unitSellingPrice: 200 } });
    if (url.includes("/api/Serial/InStock/7")) return ok({ status: 200, data: [{ serialNo: "IMEI1", batchNumber: "BCH1" }, { serialNo: "IMEI2", batchNumber: "BCH1" }, { serialNo: "IMEI3", batchNumber: "BCH2" }] });
    if (url.includes("/api/Sales/AddSales")) return ok({ status: 200, message: "Sale added" });
    return ok({ status: 200, data: [] });
  });
}

const call = (path) => apiClient.mock.calls.find(([u]) => u.includes(path));

async function scan(code) {
  render(<SalesAdd onClose={jest.fn()} onSubmit={jest.fn()} />);
  await waitFor(() => expect(call("/api/Product/GetAllProduct")).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: "Product" }));
  const box = await screen.findByPlaceholderText("Scan or type barcode, then press Enter…");
  fireEvent.change(box, { target: { value: code } });
  fireEvent.submit(box.closest("form"));
}

describe("Sales Add — a product with serial numbers (Phase 6)", () => {
  beforeEach(() => { jest.clearAllMocks(); mockApi(); });

  it("is sold by picking its units: the quantity follows the serials, and they go on the line and to the server", async () => {
    await scan("PHX");
    const picker = await screen.findByTestId("sale-serials");
    fireEvent.click(await within(picker).findByRole("button", { name: /^IMEI1/ }));
    fireEvent.click(within(picker).getByRole("button", { name: /^IMEI3/ }));
    const qty = screen.getByPlaceholderText("Pick serial numbers");
    expect(qty).toBeDisabled();
    expect(qty).toHaveValue(2);

    fireEvent.click(screen.getByRole("button", { name: "+ Add Item" }));
    const line = await screen.findByTestId("sale-line");
    expect(within(line).getByTestId("serial-list")).toHaveTextContent("S/N: IMEI1, IMEI3");
    expect(call("/api/Scheme/Applicable")).toBeUndefined(); // a free unit would need a serial of its own

    fireEvent.click(screen.getByRole("button", { name: "Submit Sales" }));
    await waitFor(() => expect(call("/api/Sales/AddSales")).toBeTruthy());
    expect(JSON.parse(call("/api/Sales/AddSales")[1].body).items[0]).toMatchObject({ productId: 7, quantity: 2, serials: ["IMEI1", "IMEI3"], batchId: null });
  });

  it("can't be added without picking a serial", async () => {
    await scan("PHX");
    await screen.findByTestId("sale-serials");
    fireEvent.click(screen.getByRole("button", { name: "+ Add Item" }));
    expect(await screen.findAllByText("Pick the serial numbers being sold")).not.toHaveLength(0);
    expect(screen.queryByTestId("sale-line")).not.toBeInTheDocument();
  });

  it("an ordinary product shows no serial picker and keeps its quantity box", async () => {
    await scan("USB");
    await waitFor(() => expect(call("/api/Inventory/GetInventoryByProdId/8")).toBeTruthy());
    expect(screen.queryByTestId("sale-serials")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter qty")).not.toBeDisabled();
    expect(call("/api/Serial/InStock")).toBeUndefined();
  });
});
