import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProductTypeEdit from "./ProductTypeEdit";
import apiClient from "../../Config/apiClient";
import API_BASE_URL from "../../Config/api.config";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const jsonResponse = (data) => Promise.resolve({ ok: true, json: () => Promise.resolve(data) });

function mockApiClient() {
  apiClient.mockImplementation((url, options = {}) => {
    if (url.includes("/api/ProductType/GetProdTypeByUkey/")) {
      return jsonResponse({
        status: 200,
        data: { id: 1, name: "Tablets", description: "Tablet formulations", typeCode: "PTP000001" },
      });
    }
    if (options.method === "PUT" && url.includes("/api/ProductType/UpdateProdType/")) {
      return jsonResponse({ status: 200 });
    }
    return jsonResponse({ status: 200, data: null });
  });
}

// Covers the id -> uKey conversion: the update request must target the
// product type's uKey (the prop this modal is opened with), not a numeric id.
describe("ProductTypeEdit update request", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiClient();
  });

  it("PUTs to UpdateProdType/{uKey}, not UpdateProdType/{id}", async () => {
    render(<ProductTypeEdit uKey="pt-ukey-1" onClose={jest.fn()} onSubmit={jest.fn()} />);

    const nameInput = await screen.findByPlaceholderText(/product type name/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Capsules");

    const submitButton = await screen.findByRole("button", { name: /update product type/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/ProductType/UpdateProdType/pt-ukey-1`,
        expect.objectContaining({ method: "PUT" })
      );
    });
  });
});
