import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ProductForm from "./ProductForm";
import apiClient from "../../Config/apiClient";
import { resetBusinessProfile } from "../../utils/businessProfile";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const json = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
const call = (path) => apiClient.mock.calls.find(([u]) => u.includes(path));

function mockApis(profile) {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/BusinessSetting/Get")) return json({ status: 200, data: profile });
    if (url.includes("/api/ProductType/GetAllProductType")) return json({ data: { productTypes: [{ id: 4, name: "Mobiles" }] } });
    if (url.includes("/api/Manufacturer/GetManufacturerDropdown")) return json({ data: [] });
    if (url.includes("/api/Product/AddProduct")) return json({ status: 200 });
    return json({ status: 200, data: null });
  });
}

async function fillAndOpenMore() {
  fireEvent.change(await screen.findByPlaceholderText("e.g. Paracetamol 500mg"), { target: { value: "Phone X" } });
  fireEvent.click(screen.getByText("Select product type"));
  fireEvent.mouseDown(await screen.findByText("Mobiles"));
  fireEvent.click(screen.getByRole("button", { name: "Pricing & Units" }));
  fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "9000" } });
  fireEvent.change(screen.getByTestId("product-gst-rate"), { target: { value: "18" } }); // product-wise GST: required
  fireEvent.change(screen.getByPlaceholderText("e.g. Strip, Bottle, Vial"), { target: { value: "PCS" } });
}

describe("Product form — serial numbers and warranty (Phase 6)", () => {
  beforeEach(() => { jest.clearAllMocks(); resetBusinessProfile(); });

  it("an electronics shop switches serials on and sets the warranty", async () => {
    mockApis({ businessType: "ELECTRONICS", trackExpiry: false, isPharma: false });
    render(<ProductForm onSubmit={jest.fn()} onClose={jest.fn()} />);
    await fillAndOpenMore();
    fireEvent.click(await screen.findByRole("button", { name: "More details" }));
    fireEvent.click(screen.getByTestId("track-serial"));
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. 12/), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Product" }));
    await waitFor(() => expect(call("/api/Product/AddProduct")).toBeTruthy());
    expect(JSON.parse(call("/api/Product/AddProduct")[1].body)).toMatchObject({ trackSerial: true, warrantyMonths: 12 });
  });

  it("a pharmacy has neither, and saves serials off", async () => {
    mockApis({ businessType: "PHARMA", trackExpiry: true, isPharma: true });
    render(<ProductForm onSubmit={jest.fn()} onClose={jest.fn()} />);
    await fillAndOpenMore();
    fireEvent.click(await screen.findByRole("button", { name: "Pharma" }));
    expect(screen.queryByTestId("track-serial")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save Product" }));
    await waitFor(() => expect(call("/api/Product/AddProduct")).toBeTruthy());
    expect(JSON.parse(call("/api/Product/AddProduct")[1].body)).toMatchObject({ trackSerial: false, warrantyMonths: null });
  });
});
