import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import SalesAdd from "./SalesAdd";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) });

function mockApi({ allowCustomItems }) {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/Sales/CustomItemSetting")) return ok({ status: 200, data: { allowCustomItems, canChange: true } });
    if (url.includes("/api/Retailer/Dropdown")) return ok({ data: [] });
    if (url.includes("/api/ProductType/GetAllProductType")) return ok({ data: { productTypes: [] } });
    if (url.includes("/api/Product/GetAllProduct")) return ok({ data: [] });
    if (url.includes("/api/Sales/AddSales")) return ok({ status: 200, message: "Sale added successfully" });
    return ok({ status: 200, data: null });
  });
}

const call = (path) => apiClient.mock.calls.find(([u]) => u.includes(path));
const body = (path) => JSON.parse(call(path)[1].body);

async function openProducts(props = {}) {
  render(<SalesAdd onClose={jest.fn()} onSubmit={jest.fn()} {...props} />);
  await screen.findByText(props.documentMode ? "Add Sales Order" : "Add Sales");
  await waitFor(() => expect(call("/api/Sales/CustomItemSetting") || props.documentMode).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: "Product" }));
}

async function addCustom({ name = "Alteration charge", quantity = "2", price = "250", gstRate = "5", hsnCode = "", costPrice = "" } = {}) {
  fireEvent.click(await screen.findByRole("button", { name: "+ Custom item" }));
  const dialog = await screen.findByTestId("custom-item-form");
  fireEvent.change(within(dialog).getByLabelText(/Item name/), { target: { value: name } });
  fireEvent.change(within(dialog).getByLabelText(/^Quantity/), { target: { value: quantity } });
  fireEvent.change(within(dialog).getByLabelText(/Price per unit/), { target: { value: price } });
  fireEvent.change(within(dialog).getByLabelText(/GST %/), { target: { value: gstRate } });
  fireEvent.change(within(dialog).getByLabelText(/HSN/), { target: { value: hsnCode } });
  fireEvent.change(within(dialog).getByLabelText(/Cost per unit/), { target: { value: costPrice } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Add to bill" }));
}

describe("SalesAdd — custom (run-time) items", () => {
  beforeEach(() => jest.clearAllMocks());

  it("offers no custom item while the shop has the feature switched off", async () => {
    mockApi({ allowCustomItems: false });
    await openProducts();
    expect(screen.queryByRole("button", { name: "+ Custom item" })).not.toBeInTheDocument();
  });

  it("never offers it on a sales order, and does not even ask the server", async () => {
    mockApi({ allowCustomItems: true });
    await openProducts({ documentMode: true });
    expect(screen.queryByRole("button", { name: "+ Custom item" })).not.toBeInTheDocument();
    expect(call("/api/Sales/CustomItemSetting")).toBeUndefined();
  });

  it("adds a custom line with its own GST and saves it without a product, batch or scheme", async () => {
    mockApi({ allowCustomItems: true });
    await openProducts();
    await addCustom({ hsnCode: "998821", costPrice: "100" });

    expect(screen.queryByTestId("custom-item-form")).not.toBeInTheDocument();
    const line = screen.getByTestId("sale-line");
    expect(within(line).getByText("Alteration charge")).toBeInTheDocument();
    expect(within(line).getByTestId("line-custom")).toHaveTextContent("Custom item · HSN 998821");
    expect(within(line).getByTestId("line-rate")).toHaveTextContent("5%"); // its own 5%, not the screen's common 18%
    expect(within(line).getByTestId("line-incl")).toHaveTextContent("525.00");
    expect(call("/api/Scheme/Applicable")).toBeUndefined(); // a custom item gets no scheme

    fireEvent.click(screen.getByRole("button", { name: "Submit Sales" }));
    await waitFor(() => expect(call("/api/Sales/AddSales")).toBeTruthy());
    expect(body("/api/Sales/AddSales").items).toEqual([{
      productId: null, itemName: "Alteration charge", hsnCode: "998821", gstRate: 5, costPrice: 100,
      quantity: 2, sellingPrice: 250, taxAmount: 25,
    }]);
    expect(body("/api/Sales/AddSales").amountPaid).toBe(525);
  });

  it("shows what is wrong inside the form and adds nothing", async () => {
    mockApi({ allowCustomItems: true });
    await openProducts();
    await addCustom({ name: " ", price: "0", hsnCode: "12" });

    const dialog = screen.getByTestId("custom-item-form");
    expect(within(dialog).getByText("Enter a name for the item")).toBeInTheDocument();
    expect(within(dialog).getByText("Enter a price above zero")).toBeInTheDocument();
    expect(within(dialog).getByText("HSN is 4, 6 or 8 digits")).toBeInTheDocument();
    expect(screen.queryByTestId("sale-line")).not.toBeInTheDocument();
  });

  it("editing a custom line opens the same form filled in and replaces the line", async () => {
    mockApi({ allowCustomItems: true });
    await openProducts();
    await addCustom();

    fireEvent.click(within(screen.getByTestId("sale-line")).getByTitle("Edit"));
    const dialog = await screen.findByTestId("custom-item-form");
    expect(within(dialog).getByLabelText(/Item name/)).toHaveValue("Alteration charge");
    fireEvent.change(within(dialog).getByLabelText(/^Quantity/), { target: { value: "3" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Update item" }));

    expect(screen.getAllByTestId("sale-line")).toHaveLength(1);
    expect(screen.getByTestId("line-qty")).toHaveTextContent("3");
  });

  it("cancel closes the form without adding anything", async () => {
    mockApi({ allowCustomItems: true });
    await openProducts();
    fireEvent.click(await screen.findByRole("button", { name: "+ Custom item" }));
    fireEvent.click(within(await screen.findByTestId("custom-item-form")).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByTestId("custom-item-form")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sale-line")).not.toBeInTheDocument();
  });
});
