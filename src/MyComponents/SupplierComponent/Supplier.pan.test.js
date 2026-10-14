import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SupplierAdd from "./SupplierAdd";
import SupplierEdit from "./SupplierEdit";
import apiClient from "../../Config/apiClient";
import API_BASE_URL from "../../Config/api.config";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const jsonResponse = (data) => Promise.resolve({ ok: true, json: () => Promise.resolve(data) });

describe("Supplier PAN field", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects an invalid PAN format on Add and never calls the API", async () => {
    apiClient.mockImplementation(() => jsonResponse({ status: 200 }));

    render(<SupplierAdd onClose={jest.fn()} onSubmit={jest.fn()} />);

    await userEvent.type(screen.getByPlaceholderText(/Cipla Distributors/i), "Apex Pharma");
    await userEvent.type(screen.getByPlaceholderText(/9876543210/i), "9876543210");
    await userEvent.type(screen.getByPlaceholderText(/ABCDE1234F/i), "NOTAPAN");
    await userEvent.click(screen.getByRole("button", { name: /save supplier/i }));

    expect(await screen.findByText(/Invalid PAN format/i)).toBeInTheDocument();
    expect(apiClient).not.toHaveBeenCalled();
  });

  it("normalises a lowercase PAN to uppercase in the Add payload", async () => {
    apiClient.mockImplementation(() => jsonResponse({ status: 200 }));

    render(<SupplierAdd onClose={jest.fn()} onSubmit={jest.fn()} />);

    await userEvent.type(screen.getByPlaceholderText(/Cipla Distributors/i), "Apex Pharma");
    await userEvent.type(screen.getByPlaceholderText(/9876543210/i), "9876543210");
    await userEvent.type(screen.getByPlaceholderText(/ABCDE1234F/i), "abcde1234f");
    await userEvent.click(screen.getByRole("button", { name: /save supplier/i }));

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith(
        expect.stringContaining("/api/Supplier/CreateSupplier"),
        expect.objectContaining({ body: expect.stringContaining('"pan":"ABCDE1234F"') })
      );
    });
  });

  it("loads an existing PAN into the Edit form", async () => {
    apiClient.mockImplementation((url) => {
      if (url.includes("/api/Supplier/GetSupplierByUKey/")) {
        return jsonResponse({
          status: 200,
          data: { shopName: "Apex Pharma", phone: "9876543210", pan: "ABCDE1234F", supplierCode: "SUP001" },
        });
      }
      return jsonResponse({ status: 200 });
    });

    render(<SupplierEdit uKey="sup-1" onClose={jest.fn()} onSubmit={jest.fn()} />);

    expect(await screen.findByDisplayValue("ABCDE1234F")).toBeInTheDocument();
  });
});
