import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ProductForm from "./ProductForm";
import apiClient from "../../Config/apiClient";
import { toast } from "react-toastify";
import { resetBusinessProfile } from "../../utils/businessProfile";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const json = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

function mockApis(profile) {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/BusinessSetting/Get")) return json({ status: 200, data: profile });
    if (url.includes("/api/ProductType/GetAllProductType")) return json({ data: { productTypes: [{ id: 4, name: "Apparel" }] } });
    if (url.includes("/api/Manufacturer/GetManufacturerDropdown")) return json({ data: [] });
    if (url.includes("/api/ProductStyle/Create")) return json({ status: 200, message: "4 variant(s) of Cotton Kurta created." });
    if (url.includes("/api/Product/AddProduct")) return json({ status: 200 });
    return json({ status: 200, data: null });
  });
}

const CLOTHING = { businessType: "CLOTHING", trackExpiry: false, isPharma: false };
const PHARMA = { businessType: "PHARMA", trackExpiry: true, isPharma: true };
const call = (path) => apiClient.mock.calls.find(([u]) => u.includes(path));

async function fillDetails() {
  fireEvent.change(await screen.findByPlaceholderText("e.g. Paracetamol 500mg"), { target: { value: "Cotton Kurta" } });
  fireEvent.click(screen.getByText("Select product type"));
  fireEvent.mouseDown(await screen.findByText("Apparel"));
  fireEvent.click(screen.getByRole("button", { name: "Pricing & Units" }));
  fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "599" } });
  fireEvent.change(screen.getByTestId("product-gst-rate"), { target: { value: "18" } }); // product-wise GST: required
  fireEvent.change(screen.getByPlaceholderText("e.g. Strip, Bottle, Vial"), { target: { value: "PCS" } });
}

describe("ProductForm — a style in sizes and colours (Phase 5)", () => {
  beforeEach(() => { jest.clearAllMocks(); resetBusinessProfile(); });

  it("a pharmacy has no Sizes & colours tab", async () => {
    mockApis(PHARMA);
    render(<ProductForm onSubmit={jest.fn()} onClose={jest.fn()} />);
    await screen.findByPlaceholderText("e.g. Paracetamol 500mg");
    await waitFor(() => expect(call("/api/BusinessSetting/Get")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Sizes & colours" })).not.toBeInTheDocument();
  });

  it("a cloth shop creates the style and its variants in one save", async () => {
    mockApis(CLOTHING);
    const onSubmit = jest.fn();
    render(<ProductForm onSubmit={onSubmit} onClose={jest.fn()} />);
    await fillDetails();
    expect(screen.getByText(/Selling Price/)).toHaveTextContent(/^Selling Price/);

    fireEvent.click(await screen.findByRole("button", { name: "Sizes & colours" }));
    fireEvent.click(screen.getByTestId("style-mode"));
    fireEvent.change(screen.getByLabelText("Add sizes"), { target: { value: "S, M" } });
    fireEvent.keyDown(screen.getByLabelText("Add sizes"), { key: "Enter" });
    fireEvent.change(screen.getByLabelText("Add colours"), { target: { value: "Blue, Black" } });
    fireEvent.keyDown(screen.getByLabelText("Add colours"), { key: "Enter" });
    fireEvent.change(screen.getByLabelText("Price of M / Black"), { target: { value: "649" } });

    fireEvent.click(screen.getByRole("button", { name: "Create 4 variants" }));
    await waitFor(() => expect(call("/api/ProductStyle/Create")).toBeTruthy());
    expect(call("/api/Product/AddProduct")).toBeUndefined();
    expect(JSON.parse(call("/api/ProductStyle/Create")[1].body)).toEqual({
      name: "Cotton Kurta", description: "", price: 599, unit: "PCS", product_type_id: 4, hsnCode: null, gstRate: 18, priceIncludesGst: true,
      sizes: ["S", "M"], colors: ["Blue", "Black"],
      overrides: [{ size: "M", color: "Black", price: 649 }], exclude: [],
    });
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith("4 variant(s) of Cotton Kurta created.");
  });

  it("will not save a style without any size or colour, and shows why on its tab", async () => {
    mockApis(CLOTHING);
    render(<ProductForm onSubmit={jest.fn()} onClose={jest.fn()} />);
    await fillDetails();
    fireEvent.click(await screen.findByRole("button", { name: "Sizes & colours" }));
    fireEvent.click(screen.getByTestId("style-mode"));
    fireEvent.click(screen.getByRole("button", { name: "Pricing & Units" }));
    expect(screen.getByText("Style Selling Price (₹)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create 0 variants" }));
    expect(await screen.findByText(/keep at least one to make/)).toBeInTheDocument();
    expect(call("/api/ProductStyle/Create")).toBeUndefined();
  });

  it("with the switch off it still saves one ordinary product", async () => {
    mockApis(CLOTHING);
    render(<ProductForm onSubmit={jest.fn()} onClose={jest.fn()} />);
    await fillDetails();
    fireEvent.click(screen.getByRole("button", { name: "Save Product" }));
    await waitFor(() => expect(call("/api/Product/AddProduct")).toBeTruthy());
    expect(call("/api/ProductStyle/Create")).toBeUndefined();
  });
});
