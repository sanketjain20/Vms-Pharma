import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SalesAdd from "./SalesAdd";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) });

const PRODUCT = { id: 1, name: "Paracetamol", barcode: "8901234567890", productTypeId: 10 };

function mockApi() {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/Retailer/Dropdown")) return ok({ data: [{ id: 5, uKey: "r5", shopName: "Shop Five", ownerName: "Owner" }] });
    if (url.includes("/api/ProductType/GetAllProductType")) return ok({ data: { productTypes: [{ id: 10, name: "Tablets" }] } });
    if (url.includes("/api/Product/GetAllProduct")) return ok({ data: [PRODUCT] });
    if (url.includes("/api/Product/GetProdByProdId/")) return ok({ data: [PRODUCT] });
    if (url.includes("/api/Inventory/GetInventoryByProdId/")) return ok({ status: 200, data: { unitSellingPrice: 100, currentQuantity: 500 } });
    if (url.includes("/api/Scheme/Applicable")) return ok({ status: 200, data: null });
    if (url.includes("/api/Sales/AddSales")) return ok({ status: 200, message: "Sale added successfully" });
    if (url.includes("/api/SalesOrder/AddSalesOrder")) return ok({ status: 200, message: "Sales order added successfully" });
    return ok({ status: 200, data: null });
  });
}

/** wait until the scheme check for this retailer has answered and the screen has settled */
const schemesCheckedFor = async (retailerId) => {
  await waitFor(() => expect(apiClient.mock.calls.some(([u]) => u.includes("/api/Scheme/Applicable") && u.includes(`retailerId=${retailerId}`))).toBe(true));
  await new Promise((r) => setTimeout(r, 0));
};

const call = (path) => apiClient.mock.calls.find(([u]) => u.includes(path));
const body = (path) => JSON.parse(call(path)[1].body);

async function addLineAndOpenBilling(props = {}) {
  render(<SalesAdd onClose={jest.fn()} onSubmit={jest.fn()} {...props} />);
  await screen.findByText(props.documentMode ? /Add Sales/ : "Add Sales");
  fireEvent.click(screen.getByRole("button", { name: "Product" }));
  const scan = screen.getByPlaceholderText(/Scan or type barcode/i);
  fireEvent.change(scan, { target: { value: PRODUCT.barcode } });
  fireEvent.submit(scan); // bubbles to the scan form
  await screen.findByDisplayValue("Paracetamol");
  await waitFor(() => expect(screen.getByRole("button", { name: "+ Add Item" })).not.toBeDisabled());
  fireEvent.change(screen.getByPlaceholderText("Enter qty"), { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: "+ Add Item" }));
  await waitFor(() => expect(call("/api/Scheme/Applicable")).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: "Billing" }));
}

describe("SalesAdd — walk-in customer name & mobile", () => {
  beforeEach(() => jest.clearAllMocks());

  it("sends the walk-in name and a normalised mobile", async () => {
    mockApi();
    await addLineAndOpenBilling();

    fireEvent.change(screen.getByLabelText(/Customer name/), { target: { value: "Ravi Kumar" } });
    fireEvent.change(screen.getByLabelText(/Mobile number/), { target: { value: "098765 43210" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit Sales" }));

    await waitFor(() => expect(call("/api/Sales/AddSales")).toBeTruthy());
    expect(body("/api/Sales/AddSales")).toMatchObject({ retailerId: null, customerName: "Ravi Kumar", customerPhone: "9876543210" });
  });

  it("an invalid mobile is shown under the field and nothing is saved", async () => {
    mockApi();
    await addLineAndOpenBilling();

    fireEvent.change(screen.getByLabelText(/Mobile number/), { target: { value: "5555" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit Sales" }));

    expect(await screen.findByText("Enter a valid 10-digit mobile number")).toBeInTheDocument();
    expect(call("/api/Sales/AddSales")).toBeUndefined();
  });

  it("a retailer bill hides the walk-in fields and sends none", async () => {
    mockApi();
    await addLineAndOpenBilling();

    fireEvent.change(screen.getByLabelText(/Customer name/), { target: { value: "Ravi" } });
    fireEvent.click(screen.getByPlaceholderText("Search retailer…"));
    fireEvent.mouseDown(await screen.findByText("Shop Five · Owner"));
    expect(screen.queryByLabelText(/Customer name/)).not.toBeInTheDocument();
    await schemesCheckedFor(5); // a new retailer re-checks schemes; saving waits for that on purpose

    fireEvent.click(screen.getByRole("button", { name: "Submit Sales" }));
    await waitFor(() => expect(call("/api/Sales/AddSales")).toBeTruthy());
    expect(body("/api/Sales/AddSales")).toMatchObject({ retailerId: 5, customerName: null, customerPhone: null });
  });

  it("a sales order (always to a retailer) never shows the walk-in fields", async () => {
    mockApi();
    render(<SalesAdd onClose={jest.fn()} onSubmit={jest.fn()} documentMode />);
    await screen.findByText(/Add Sales/);
    fireEvent.click(screen.getByRole("button", { name: "Billing" }));
    expect(screen.queryByLabelText(/Customer name/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Mobile number/)).not.toBeInTheDocument();
  });
});
