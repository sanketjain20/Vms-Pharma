import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ProductView from "./ProductView";
import ProductForm from "./ProductForm";
import { productColumns } from "./Product";
import InventoryAdd from "../InventoryComponent/InventoryAdd";
import apiClient from "../../Config/apiClient";
import { resetBusinessProfile } from "../../utils/businessProfile";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const json = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
const call = (path) => apiClient.mock.calls.find(([u]) => u.includes(path));

const ELECTRONICS = { businessType: "ELECTRONICS", trackExpiry: false, isPharma: false };
const PHARMA = { businessType: "PHARMA", trackExpiry: true, isPharma: true };

// what an electronics product saved before this change still carries
const PHONE = { uKey: "p1", name: "Phone X", price: 12000, costPrice: 9000, unit: "PCS", hsnCode: "8517",
  scheduleType: "OTC", genericName: null, packSize: 10, packUnit: "STRIP", manufacturerName: "Acme", trackSerial: true, warrantyMonths: 12 };

function mockApis(profile, extra = {}) {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/BusinessSetting/Get")) return json({ status: 200, data: profile });
    if (url.includes("/api/ProductType/GetAllProductType")) return json({ data: { productTypes: [{ id: 4, name: "Mobiles" }] } });
    if (url.includes("/api/Manufacturer/GetManufacturerDropdown")) return json({ data: [] });
    const hit = Object.keys(extra).find((k) => url.includes(k));
    return json({ status: 200, data: hit ? extra[hit] : null });
  });
}

describe("Product fields follow the business type; the price is the selling price", () => {
  beforeEach(() => { jest.clearAllMocks(); resetBusinessProfile(); });

  it("an electronics shop's product view has no schedule (OTC/H1), generic name or pack details", async () => {
    mockApis(ELECTRONICS, { "/api/Product/GetProductByUkey/p1": PHONE });
    render(<ProductView uKey="p1" onClose={() => {}} />);
    await screen.findAllByText("Phone X");
    await waitFor(() => expect(call("/api/BusinessSetting/Get")).toBeTruthy());
    fireEvent.click(await screen.findByRole("button", { name: "More details" }));
    expect(screen.queryByTestId("schedule-type")).not.toBeInTheDocument();
    expect(screen.queryByText("Generic / Salt Name")).not.toBeInTheDocument();
    expect(screen.getByText("Brand / Manufacturer")).toBeInTheDocument();
    expect(screen.getByText("12 months")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pricing & Units" }));
    expect(screen.getByText("Selling Price")).toBeInTheDocument();
    expect(screen.getByText("₹ 12000.00")).toBeInTheDocument();
    expect(screen.getByText("Average Cost (from purchases)")).toBeInTheDocument();
    expect(screen.getByText("₹ 9000.00")).toBeInTheDocument();
    expect(screen.queryByText("Pack Size")).not.toBeInTheDocument();
    expect(screen.queryByText("Cost Price")).not.toBeInTheDocument();
  });

  it("a pharmacy still sees the schedule badge", async () => {
    mockApis(PHARMA, { "/api/Product/GetProductByUkey/p1": { ...PHONE, scheduleType: "H1" } });
    render(<ProductView uKey="p1" onClose={() => {}} />);
    await screen.findAllByText("Phone X");
    fireEvent.click(await screen.findByRole("button", { name: "Pharma" }));
    expect(screen.getByTestId("schedule-type")).toHaveTextContent("H1");
  });

  it("the product grid: generic name only for a pharmacy; selling price and average cost for everyone", () => {
    const headers = (isPharma) => productColumns(isPharma).map((c) => c.header);
    expect(headers(false)).not.toContain("Generic Name");
    expect(headers(true)).toContain("Generic Name");
    expect(headers(false)).toEqual(expect.arrayContaining(["Selling Price (₹)", "Avg Cost (₹)", "Brand / Manufacturer"]));
    expect(headers(false)).not.toContain("Price (₹)");
  });

  it("adding a product: no pack fields for an electronics shop, and nothing pharmacy-only is sent", async () => {
    mockApis(ELECTRONICS);
    render(<ProductForm onSubmit={jest.fn()} onClose={jest.fn()} />);
    fireEvent.change(await screen.findByPlaceholderText("e.g. Paracetamol 500mg"), { target: { value: "Phone X" } });
    fireEvent.click(screen.getByText("Select product type"));
    fireEvent.mouseDown(await screen.findByText("Mobiles"));
    await waitFor(() => expect(call("/api/BusinessSetting/Get")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Pricing & Units" }));
    expect(screen.getByText(/^Selling Price/)).toBeInTheDocument();
    expect(screen.getByTestId("cost-note")).toHaveTextContent("The cost comes from your purchases");
    expect(screen.queryByText("Pack Unit")).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "12000" } });
    fireEvent.change(screen.getByTestId("product-gst-rate"), { target: { value: "18" } }); // product-wise GST: required
    fireEvent.change(screen.getByPlaceholderText("e.g. Strip, Bottle, Vial"), { target: { value: "PCS" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Product" }));
    await waitFor(() => expect(call("/api/Product/AddProduct")).toBeTruthy());
    expect(JSON.parse(call("/api/Product/AddProduct")[1].body)).toMatchObject({
      price: 12000, scheduleType: null, packSize: null, packUnit: null, genericName: null,
    });
  });

  it("adding stock: the selling price is the product's and can't be typed over", async () => {
    mockApis(ELECTRONICS, { "/api/Product/GetAllProduct": [{ id: 7, name: "Phone X", price: 12000, disable: 0 }] });
    render(<InventoryAdd onSubmit={jest.fn()} onClose={jest.fn()} />);
    await waitFor(() => expect(call("/api/Product/GetAllProduct")).toBeTruthy());
    fireEvent.click(await screen.findByText("Choose a product"));
    fireEvent.mouseDown(await screen.findByText("Phone X"));
    fireEvent.click(screen.getByRole("button", { name: "Stock & Pricing" }));
    const price = screen.getByLabelText("Unit selling price");
    expect(price).toHaveValue(12000);
    expect(price).toHaveAttribute("readonly");
    expect(screen.getByText(/Set on the product/)).toBeInTheDocument();
  });
});
