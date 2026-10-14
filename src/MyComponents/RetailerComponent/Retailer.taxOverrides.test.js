import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RetailerAdd from "./RetailerAdd";
import RetailerEdit from "./RetailerEdit";
import apiClient from "../../Config/apiClient";
import API_BASE_URL from "../../Config/api.config";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const jsonResponse = (data) => Promise.resolve({ ok: true, json: () => Promise.resolve(data) });

/**
 * Covers the TCS gap-closure fields added to Retailer: non-resident/export
 * party and the buyer's-own-194Q declaration (both make
 * SalesCommonRepository's TCS block skip collection entirely), and the
 * Section 197/206C(9) lower/nil-deduction certificate (overrides the rate in
 * PartyTurnoverCommonRepository). See Entity/Retailer.java.
 */
describe("Retailer tax-override fields", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends nonResidentParty and buyerDeductsTds194Q as booleans when checked on Add", async () => {
    apiClient.mockImplementation(() => jsonResponse({ status: 200 }));

    render(<RetailerAdd onClose={jest.fn()} onSubmit={jest.fn()} />);

    await userEvent.type(screen.getByPlaceholderText(/Sharma Medical Store/i), "City Medicos");
    await userEvent.type(screen.getByPlaceholderText(/9876543210/i), "9876543210");
    await userEvent.click(screen.getByLabelText(/Non-resident \/ export party/i));
    await userEvent.click(screen.getByLabelText(/Buyer deducts TDS under Section 194Q/i));
    await userEvent.click(screen.getByRole("button", { name: /save retailer/i }));

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/Retailer/Add`,
        expect.objectContaining({
          body: expect.stringContaining('"nonResidentParty":true'),
        })
      );
      expect(apiClient).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/Retailer/Add`,
        expect.objectContaining({
          body: expect.stringContaining('"buyerDeductsTds194Q":true'),
        })
      );
    });
  });

  it("defaults both skip flags to false when left unchecked", async () => {
    apiClient.mockImplementation(() => jsonResponse({ status: 200 }));

    render(<RetailerAdd onClose={jest.fn()} onSubmit={jest.fn()} />);

    await userEvent.type(screen.getByPlaceholderText(/Sharma Medical Store/i), "City Medicos");
    await userEvent.type(screen.getByPlaceholderText(/9876543210/i), "9876543210");
    await userEvent.click(screen.getByRole("button", { name: /save retailer/i }));

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/Retailer/Add`,
        expect.objectContaining({
          body: expect.stringContaining('"nonResidentParty":false'),
        })
      );
    });
  });

  it("loads an existing certificate and non-resident flag into the Edit form", async () => {
    apiClient.mockImplementation((url) => {
      if (url.includes("/api/Retailer/Get/")) {
        return jsonResponse({
          status: 200,
          data: {
            shopName: "City Medicos",
            phone: "9876543210",
            retailerCode: "RET001",
            nonResidentParty: true,
            certificateNumber: "CERT-9988",
            certificateRatePercent: 0.05,
            certificateValidFrom: "2026-04-01",
            certificateValidTo: "2027-03-31",
          },
        });
      }
      return jsonResponse({ status: 200 });
    });

    render(<RetailerEdit uKey="ret-1" onClose={jest.fn()} onSubmit={jest.fn()} />);

    expect(await screen.findByDisplayValue("CERT-9988")).toBeInTheDocument();
    expect(screen.getByLabelText(/Non-resident \/ export party/i)).toBeChecked();
  });

  it("rejects a certificate Valid To earlier than Valid From", async () => {
    apiClient.mockImplementation(() => jsonResponse({ status: 200 }));

    render(<RetailerAdd onClose={jest.fn()} onSubmit={jest.fn()} />);

    await userEvent.type(screen.getByPlaceholderText(/Sharma Medical Store/i), "City Medicos");
    await userEvent.type(screen.getByPlaceholderText(/9876543210/i), "9876543210");

    // The plain (non-checkbox) field labels aren't programmatically
    // associated with their input via htmlFor/id, so locate via the
    // shared .afx-field wrapper instead of getByLabelText.
    const fromInput = screen.getByText("Certificate Valid From").closest(".afx-field").querySelector("input");
    const toInput = screen.getByText("Certificate Valid To").closest(".afx-field").querySelector("input");
    await userEvent.type(fromInput, "2026-04-01");
    await userEvent.type(toInput, "2026-01-01");
    await userEvent.click(screen.getByRole("button", { name: /save retailer/i }));

    expect(await screen.findByText(/Valid To must be on or after Valid From/i)).toBeInTheDocument();
    expect(apiClient).not.toHaveBeenCalled();
  });
});
