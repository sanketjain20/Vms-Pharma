import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import SupplierScheme from "./SupplierScheme";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
const sent = (path) => apiClient.mock.calls.find(([u, o]) => u.includes(path) && o?.method && o.method !== "GET");

const ROWS = [{ uKey: "s1", productId: 7, productName: "Kurta", supplierId: null, supplierName: "Any supplier", buyQuantity: 10,
  freeQuantity: 1, label: "Buy 10 Get 1", validFrom: "2026-10-01", validTo: null, note: "Diwali", disable: false, status: "ACTIVE" }];

function mockApis(actions = ["View", "Add", "Edit", "Disable"]) {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/Access/GetUserModuleAccess/40/")) return ok({ status: 200, data: actions });
    if (url.includes("/api/SupplierScheme/GetAll")) return ok({ status: 200, data: ROWS });
    if (url.includes("/api/Product/GetAllProduct")) return ok({ status: 200, data: [{ id: 7, name: "Kurta" }] });
    if (url.includes("/api/Supplier/GetSupplierDropdown")) return ok({ status: 200, data: [{ id: 3, shopName: "Gadget Hub" }] });
    return ok({ status: 200, message: "Saved." });
  });
}

describe("Supplier schemes page (Phase 7)", () => {
  beforeEach(() => { jest.clearAllMocks(); mockApis(); });

  it("lists the schemes in the common grid with their offer and status, and switches one off", async () => {
    render(<SupplierScheme />);
    const table = await screen.findByRole("table");
    expect(table).toHaveClass("dg-table");
    const row = (await within(table).findByText("Kurta")).closest("tr");
    expect(row).toHaveTextContent("Any supplier");
    expect(row).toHaveTextContent("Buy 10 Get 1");
    expect(row).toHaveTextContent("Active");
    await waitFor(() => expect(within(row).getByRole("button", { name: "Switch off" })).toBeInTheDocument());
    fireEvent.click(within(row).getByRole("button", { name: "Switch off" }));
    await waitFor(() => expect(sent("/api/SupplierScheme/Toggle/s1/1")).toBeDefined());
  });

  it("shows six columns by default; the note is added from the columns icon", async () => {
    render(<SupplierScheme />);
    await screen.findByText("Kurta");
    const headers = () => screen.getAllByRole("columnheader").map((h) => h.textContent.replace(/^\d\d/, ""));
    expect(headers()).toEqual(["Product", "Supplier", "Offer", "Valid From", "Valid To", "Status", "Actions"]);
    fireEvent.click(screen.getByRole("button", { name: "Choose the columns to show" }));
    fireEvent.click(screen.getByLabelText("Note"));
    expect(headers()).toContain("Note");
    expect(screen.getByText("Diwali")).toBeInTheDocument();
  });

  it("the switched-on scheme counts as Active in the grid tabs (the list sends disable as true/false)", async () => {
    render(<SupplierScheme />);
    await screen.findByText("Kurta");
    fireEvent.click(screen.getByRole("button", { name: /Inactive/ }));
    await waitFor(() => expect(screen.queryByText("Kurta")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: /^Active/ }));
    expect(await screen.findByText("Kurta")).toBeInTheDocument();
  });

  it("without Edit / Disable / Add permission the buttons are not offered", async () => {
    mockApis(["View"]);
    render(<SupplierScheme />);
    const row = (await screen.findByText("Kurta")).closest("tr");
    await new Promise((r) => setTimeout(r, 0));
    expect(within(row).queryByRole("button", { name: "Edit" })).toBeNull();
    expect(within(row).queryByRole("button", { name: "Switch off" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Add supplier scheme/ })).toBeNull();
  });

  it("adds a scheme for one supplier after checking the numbers", async () => {
    render(<SupplierScheme />);
    fireEvent.click(await screen.findByRole("button", { name: /Add supplier scheme/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save scheme" }));
    expect(screen.getByText("Choose the product")).toBeInTheDocument();
    expect(sent("/api/SupplierScheme/Add")).toBeUndefined();

    await waitFor(() => expect(screen.getByLabelText(/^Product/)).toHaveTextContent("Kurta"), { timeout: 4000 });
    fireEvent.change(screen.getByLabelText(/^Product/), { target: { value: "7" } });
    fireEvent.change(screen.getByLabelText("Supplier"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText(/^Buy/), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText(/^Get free/), { target: { value: "2" } });
    expect(screen.getByTestId("scheme-example")).toHaveTextContent("Buying 36 gives 6 free.");
    fireEvent.click(screen.getByRole("button", { name: "Save scheme" }));
    await waitFor(() => expect(sent("/api/SupplierScheme/Add")).toBeDefined());
    expect(JSON.parse(sent("/api/SupplierScheme/Add")[1].body)).toMatchObject({ productId: 7, supplierId: 3, buyQuantity: 12, freeQuantity: 2 });
  });
});
