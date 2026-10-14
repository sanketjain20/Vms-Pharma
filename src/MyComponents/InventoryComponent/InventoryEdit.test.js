import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import InventoryEdit from "./InventoryEdit";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const json = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

const INVENTORY = {
  id: 25, // numeric id — what the broken UI used to put in the URL
  uKey: "6f1c2d3e-aaaa-bbbb-cccc-1234567890ab",
  productId: 7,
  currentQuantity: 40,
  reorderLevel: 10,
  unitSellingPrice: 55,
  inventoryCode: "ACME-INV000001",
};

function mockApi(updateResult = { status: 200, message: "ok" }) {
  apiClient.mockImplementation((url, options = {}) => {
    if (url.includes("/api/Product/GetAllProduct")) return json({ status: 200, data: { products: [{ id: 7, name: "Paracetamol" }] } });
    if (url.includes("/api/ProductType/GetAllProductType")) return json({ data: { productTypes: [] } });
    if (url.includes("/api/ProductType/GetProdTypeByProductId")) return json({ data: null });
    if (url.includes("/api/Inventory/GetInventoryByUkey/")) return json({ status: 200, data: INVENTORY });
    if (url.includes("/api/Inventory/UpdateInventory/") && options.method === "PUT") return json(updateResult);
    return json({ status: 404 });
  });
}

const putCalls = () => apiClient.mock.calls.filter(([u, o]) => u.includes("/api/Inventory/UpdateInventory/") && o?.method === "PUT");

describe("InventoryEdit — saving", () => {
  beforeEach(() => jest.clearAllMocks());

  it("updates by the inventory's uKey — never its numeric id (the server answers 'Inventory not found with uKey: 25' otherwise)", async () => {
    mockApi();
    const onSubmit = jest.fn();
    const onClose = jest.fn();
    render(<InventoryEdit uKey={INVENTORY.uKey} onSubmit={onSubmit} onClose={onClose} />);

    fireEvent.click(await screen.findByRole("button", { name: "Stock & Pricing" }));
    const reorder = await screen.findByDisplayValue("10");
    fireEvent.change(reorder, { target: { name: "reorderLevel", value: "15" } });
    fireEvent.click(await screen.findByRole("button", { name: "Update Inventory" }));

    await waitFor(() => expect(putCalls()).toHaveLength(1));
    const [url, options] = putCalls()[0];
    expect(url).toMatch(/\/api\/Inventory\/UpdateInventory\/6f1c2d3e-aaaa-bbbb-cccc-1234567890ab$/);
    expect(url).not.toMatch(/\/25$/);
    expect(JSON.parse(options.body)).toMatchObject({ product_id: 7, reorderLevel: 15, unitSellingPrice: 55 });
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps the dialog open and doesn't report success when the server refuses the update", async () => {
    mockApi({ status: 404, message: "Inventory not found with uKey: x" });
    const onSubmit = jest.fn();
    render(<InventoryEdit uKey={INVENTORY.uKey} onSubmit={onSubmit} onClose={jest.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: "Stock & Pricing" }));
    fireEvent.change(await screen.findByDisplayValue("10"), { target: { name: "reorderLevel", value: "12" } });
    fireEvent.click(await screen.findByRole("button", { name: "Update Inventory" }));

    await waitFor(() => expect(putCalls()).toHaveLength(1));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
