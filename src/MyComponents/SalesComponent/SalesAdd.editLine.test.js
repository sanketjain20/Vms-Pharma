import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import SalesAdd from "./SalesAdd";
import apiClient from "../../Config/apiClient";
import { toast } from "react-toastify";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) });

/** A product with no GST rate yet, at Rs 50. */
const SYRUP = { id: 2, name: "Cough syrup", barcode: "8900000000002", productTypeId: 10, gstRate: null };

function mockApi() {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/Retailer/Dropdown")) return ok({ data: [] });
    if (url.includes("/api/ProductType/GetAllProductType")) return ok({ data: { productTypes: [{ id: 10, name: "Medicine" }] } });
    if (url.includes("/api/Product/GetAllProduct")) return ok({ data: [SYRUP] });
    if (url.includes("/api/Product/GetProdByProdId/")) return ok({ data: [SYRUP] });
    if (url.includes("/api/Product/GetProductById/")) return ok({ status: 200, data: SYRUP });
    if (url.includes("/api/Inventory/GetInventoryByProdId/")) return ok({ status: 200, data: { unitSellingPrice: 50, currentQuantity: 500 } });
    if (url.includes("/api/Sales/AddSales")) return ok({ status: 200, message: "Sale added successfully" });
    return ok({ status: 200, data: null });
  });
}

const lines = () => screen.queryAllByTestId("line-qty").map((c) => c.closest("tr"));
const saleCall = () => apiClient.mock.calls.find(([u]) => u.includes("/api/Sales/AddSales"));

/** Product-wise GST, the syrup at 12%, 4 units: 200 + 24 GST. */
async function addSyrup() {
  render(<SalesAdd onClose={jest.fn()} onSubmit={jest.fn()} />);
  await screen.findByText("Add Sales");
  fireEvent.click(screen.getByTitle(/Show every section at once/)); // the GST mode is in the "All sections" view
  fireEvent.click(screen.getByRole("button", { name: "Product-wise GST" }));
  const scan = screen.getByPlaceholderText(/Scan or type barcode/i);
  fireEvent.change(scan, { target: { value: SYRUP.barcode } });
  fireEvent.submit(scan.closest("form"));
  await screen.findByDisplayValue("Cough syrup");
  await waitFor(() => expect(screen.getByRole("button", { name: "+ Add Item" })).not.toBeDisabled());
  fireEvent.change(screen.getByDisplayValue("Select GST rate"), { target: { value: "12" } });
  fireEvent.change(screen.getByPlaceholderText("Enter qty"), { target: { value: "4" } });
  fireEvent.click(screen.getByRole("button", { name: "+ Add Item" }));
  await waitFor(() => expect(lines()).toHaveLength(1));
}

async function editIt() {
  fireEvent.click(within(lines()[0]).getByTitle("Edit"));
  await waitFor(() => expect(screen.getByRole("button", { name: "Update Item" })).not.toBeDisabled());
}

beforeEach(() => jest.clearAllMocks());

describe("SalesAdd — editing a line", () => {
  it("the line leaves the table while edited; Update Item brings it back changed (no error with an empty table)", async () => {
    mockApi();
    await addSyrup();
    await editIt();
    expect(lines()).toHaveLength(0);
    fireEvent.change(screen.getByPlaceholderText("Enter qty"), { target: { value: "6" } });
    fireEvent.click(screen.getByRole("button", { name: "Update Item" }));
    expect(lines()).toHaveLength(1);
    expect(within(lines()[0]).getByTestId("line-qty")).toHaveTextContent("6");
  });

  it("Cancel edit puts it back as it was, and the bill can't be saved while a line is in the form", async () => {
    mockApi();
    await addSyrup();
    await editIt();
    fireEvent.click(screen.getByRole("button", { name: "Submit Sales" }));
    expect(toast.error).toHaveBeenCalledWith("Finish editing Cough syrup first: Update Item or Cancel edit");
    expect(saleCall()).toBeUndefined();
    fireEvent.click(screen.getByRole("button", { name: "Cancel edit" }));
    expect(within(lines()[0]).getByTestId("line-qty")).toHaveTextContent("4");
  });

  it("the GST is edited as the % it was added at (it used to take the Rs amount as a %), and follows the quantity", async () => {
    mockApi();
    await addSyrup();
    expect(within(lines()[0]).getByTestId("line-gst")).toHaveTextContent("24.00");
    await editIt();
    expect(screen.getByDisplayValue("12%")).toBeInTheDocument(); // not "24"
    fireEvent.change(screen.getByPlaceholderText("Enter qty"), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: "Update Item" }));
    expect(within(lines()[0]).getByTestId("line-gst")).toHaveTextContent("48.00"); // 400 at 12%
  });
});
