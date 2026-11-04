import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import Styles from "./Styles";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
const sent = (path) => apiClient.mock.calls.find(([u, o]) => u.includes(path) && o?.method && o.method !== "GET");

const STYLE = {
  uKey: "st1", styleCode: "STY000001", name: "Cotton Kurta", description: "", price: 599, productTypeId: 4, unit: "PCS", hsnCode: "6211",
  sizes: ["M", "S"], colors: ["Blue", "Black"], totalStock: 13,
  variants: [
    { id: 1, name: "Cotton Kurta - S / Blue", size: "S", color: "Blue", price: 599, ownPrice: null, stock: 4 },
    { id: 2, name: "Cotton Kurta - S / Black", size: "S", color: "Black", price: 599, ownPrice: null, stock: 1 },
    { id: 3, name: "Cotton Kurta - M / Blue", size: "M", color: "Blue", price: 649, ownPrice: 649, stock: 8 },
  ],
};

function mockApis() {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/ProductStyle/List")) return ok({ status: 200, data: [STYLE] });
    if (url.includes("/api/ProductStyle/Get/st1")) return ok({ status: 200, data: STYLE });
    if (url.includes("/api/ProductType/GetAllProductType")) return ok({ data: { productTypes: [{ id: 4, name: "Apparel" }] } });
    return ok({ status: 200, message: "Saved." });
  });
}

describe("Styles page — sizes & colours (Phase 7)", () => {
  beforeEach(() => { jest.clearAllMocks(); mockApis(); });

  it("shows the stock of every size × colour over all godowns, with totals", async () => {
    render(<Styles />);
    fireEvent.click(await screen.findByRole("button", { name: /Cotton Kurta/ }));
    const matrix = await screen.findByTestId("stock-matrix");
    expect(apiClient.mock.calls.some(([u]) => u.includes("/api/ProductStyle/Get/st1?allGodowns=true"))).toBe(true);
    expect(within(matrix).getByTestId("cell-S-Blue")).toHaveTextContent("4");
    expect(within(matrix).getByTestId("cell-M-Blue")).toHaveTextContent("₹649.00 (own)");
    expect(within(matrix).getByTestId("stock-total")).toHaveTextContent("13");
    const sRow = within(matrix).getByRole("rowheader", { name: "S" }).closest("tr");
    expect(sRow).toHaveTextContent("5"); // 4 + 1

    fireEvent.click(screen.getByTestId("all-godowns"));
    await waitFor(() => expect(apiClient.mock.calls.some(([u]) => u.includes("/api/ProductStyle/Get/st1?allGodowns=false"))).toBe(true));
  });

  it("saves the details for every variant, a variant's own price and new sizes", async () => {
    render(<Styles />);
    fireEvent.click(await screen.findByRole("button", { name: /Cotton Kurta/ }));
    await screen.findByTestId("style-detail");

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Linen Kurta" } });
    fireEvent.click(screen.getByRole("button", { name: "Save details (all variants)" }));
    await waitFor(() => expect(sent("/api/ProductStyle/Update/st1")).toBeDefined());
    expect(JSON.parse(sent("/api/ProductStyle/Update/st1")[1].body)).toMatchObject({ name: "Linen Kurta", unit: "PCS", product_type_id: 4 });

    fireEvent.click(within(screen.getByTestId("cell-S-Black")).getByRole("button"));
    fireEvent.change(screen.getByLabelText("Own price of Cotton Kurta - S / Black"), { target: { value: "629" } });
    fireEvent.click(within(screen.getByTestId("cell-S-Black")).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(sent("/api/ProductStyle/VariantPrice/2")).toBeDefined());
    expect(JSON.parse(sent("/api/ProductStyle/VariantPrice/2")[1].body)).toEqual({ price: "629" });

    fireEvent.change(screen.getByLabelText("New sizes"), { target: { value: "XL, XXL" } });
    fireEvent.click(screen.getByRole("button", { name: "Add sizes / colours" }));
    await waitFor(() => expect(sent("/api/ProductStyle/AddVariants/st1")).toBeDefined());
    expect(JSON.parse(sent("/api/ProductStyle/AddVariants/st1")[1].body)).toEqual({ sizes: ["XL", "XXL"], colors: [] });
  });
});
