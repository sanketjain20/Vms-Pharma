import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RetailerAdd from "./RetailerAdd";
import RetailerEdit from "./RetailerEdit";
import apiClient from "../../Config/apiClient";
import API_BASE_URL from "../../Config/api.config";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const jsonResponse = (data) => Promise.resolve({ ok: true, json: () => Promise.resolve(data) });

describe("Retailer PAN field", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects an invalid PAN format on Add and never calls the API", async () => {
    apiClient.mockImplementation(() => jsonResponse({ status: 200 }));

    render(<RetailerAdd onClose={jest.fn()} onSubmit={jest.fn()} />);

    await userEvent.type(screen.getByPlaceholderText(/Sharma Medical Store/i), "City Medicos");
    await userEvent.type(screen.getByPlaceholderText(/9876543210/i), "9876543210");
    await userEvent.type(screen.getByPlaceholderText(/ABCDE1234F/i), "NOTAPAN");
    await userEvent.click(screen.getByRole("button", { name: /save retailer/i }));

    expect(await screen.findByText(/Invalid PAN format/i)).toBeInTheDocument();
    expect(apiClient).not.toHaveBeenCalled();
  });

  it("normalises a lowercase PAN to uppercase in the Add payload", async () => {
    apiClient.mockImplementation(() => jsonResponse({ status: 200 }));

    render(<RetailerAdd onClose={jest.fn()} onSubmit={jest.fn()} />);

    await userEvent.type(screen.getByPlaceholderText(/Sharma Medical Store/i), "City Medicos");
    await userEvent.type(screen.getByPlaceholderText(/9876543210/i), "9876543210");
    await userEvent.type(screen.getByPlaceholderText(/ABCDE1234F/i), "abcde1234f");
    await userEvent.click(screen.getByRole("button", { name: /save retailer/i }));

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/Retailer/Add`,
        expect.objectContaining({ body: expect.stringContaining('"pan":"ABCDE1234F"') })
      );
    });
  });

  it("loads an existing PAN into the Edit form and includes it unchanged on save", async () => {
    apiClient.mockImplementation((url, options = {}) => {
      if (url.includes("/api/Retailer/Get/")) {
        return jsonResponse({
          status: 200,
          data: { shopName: "City Medicos", phone: "9876543210", pan: "ABCDE1234F", retailerCode: "RET001" },
        });
      }
      return jsonResponse({ status: 200 });
    });

    render(<RetailerEdit uKey="ret-1" onClose={jest.fn()} onSubmit={jest.fn()} />);

    const panInput = await screen.findByDisplayValue("ABCDE1234F");
    expect(panInput).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /update retailer/i }));

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/Retailer/Update/ret-1`,
        expect.objectContaining({ body: expect.stringContaining('"pan":"ABCDE1234F"') })
      );
    });
  });
});
