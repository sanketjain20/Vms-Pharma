import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProductEdit from "./ProductEdit";
import apiClient from "../../Config/apiClient";
import API_BASE_URL from "../../Config/api.config";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const jsonResponse = (data) => Promise.resolve({ ok: true, json: () => Promise.resolve(data) });

function mockApiClient() {
  apiClient.mockImplementation((url, options = {}) => {
    if (url.includes("/api/ProductType/GetAllProductType")) {
      return jsonResponse({ status: 200, data: [] });
    }
    if (url.includes("/api/Manufacturer/GetDropdown")) {
      return jsonResponse({ status: 200, data: [] });
    }
    if (url.includes("/api/Product/GetProductByUkey/")) {
      return jsonResponse({
        status: 200,
        data: {
          id: 1,
          productCode: "PROD001",
          name: "Paracetamol 500mg",
          price: 10,
          unit: "STRIP",
          productTypeId: 5,
        },
      });
    }
    if (options.method === "PUT" && url.includes("/api/Product/UpdateProd/")) {
      return jsonResponse({ status: 200 });
    }
    return jsonResponse({ status: 200, data: null });
  });
}

// Covers the id -> uKey conversion: the update request must target the
// product's uKey (the prop this modal is opened with), not a numeric id.
describe("ProductEdit update request", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiClient();
  });

  it("PUTs to UpdateProd/{uKey}, not UpdateProd/{id}", async () => {
    render(<ProductEdit uKey="product-ukey-1" onClose={jest.fn()} onSubmit={jest.fn()} />);

    const nameInput = await screen.findByPlaceholderText(/e\.g\. paracetamol 500mg/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Paracetamol 650mg");

    const submitButton = await screen.findByRole("button", { name: /update product/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/Product/UpdateProd/product-ukey-1`,
        expect.objectContaining({ method: "PUT" })
      );
    });
  });
});
