import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SupplierAdd from "./SupplierAdd";
import SupplierEdit from "./SupplierEdit";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const jsonResponse = (data) => Promise.resolve({ ok: true, json: () => Promise.resolve(data) });

/**
 * Covers the TDS gap-closure fields added to Supplier: non-resident/export
 * party (makes PurchaseCommonRepository's TDS block skip collection) and the
 * Section 197/206C(9) lower/nil-deduction certificate (overrides the rate in
 * PartyTurnoverCommonRepository.applyAndPostForSupplier). See
 * Entity/Supplier.java. No buyer-deducts-TDS field here — that declaration
 * is buyer-side only (Retailer), see Circular 13/2021.
 */
describe("Supplier tax-override fields", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends nonResidentParty as a boolean when checked on Add", async () => {
    apiClient.mockImplementation(() => jsonResponse({ status: 200 }));

    render(<SupplierAdd onClose={jest.fn()} onSubmit={jest.fn()} />);

    await userEvent.type(screen.getByPlaceholderText(/Cipla Distributors/i), "Apex Pharma");
    await userEvent.type(screen.getByPlaceholderText(/9876543210/i), "9876543210");
    await userEvent.click(screen.getByLabelText(/Non-resident \/ export party/i));
    await userEvent.click(screen.getByRole("button", { name: /save supplier/i }));

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith(
        expect.stringContaining("/api/Supplier/CreateSupplier"),
        expect.objectContaining({ body: expect.stringContaining('"nonResidentParty":true') })
      );
    });
  });

  it("loads an existing certificate and non-resident flag into the Edit form", async () => {
    apiClient.mockImplementation((url) => {
      if (url.includes("/api/Supplier/GetSupplierByUKey/")) {
        return jsonResponse({
          status: 200,
          data: {
            shopName: "Apex Pharma",
            phone: "9876543210",
            supplierCode: "SUP001",
            nonResidentParty: true,
            certificateNumber: "CERT-1122",
            certificateRatePercent: 0,
            certificateValidFrom: "2026-04-01",
            certificateValidTo: "2027-03-31",
          },
        });
      }
      return jsonResponse({ status: 200 });
    });

    render(<SupplierEdit uKey="sup-1" onClose={jest.fn()} onSubmit={jest.fn()} />);

    expect(await screen.findByDisplayValue("CERT-1122")).toBeInTheDocument();
    expect(screen.getByLabelText(/Non-resident \/ export party/i)).toBeChecked();
  });

  it("rejects a certificate Valid To earlier than Valid From", async () => {
    apiClient.mockImplementation(() => jsonResponse({ status: 200 }));

    render(<SupplierAdd onClose={jest.fn()} onSubmit={jest.fn()} />);

    await userEvent.type(screen.getByPlaceholderText(/Cipla Distributors/i), "Apex Pharma");
    await userEvent.type(screen.getByPlaceholderText(/9876543210/i), "9876543210");

    const fromInput = screen.getByText("Certificate Valid From").closest(".afx-field").querySelector("input");
    const toInput = screen.getByText("Certificate Valid To").closest(".afx-field").querySelector("input");
    await userEvent.type(fromInput, "2026-04-01");
    await userEvent.type(toInput, "2026-01-01");
    await userEvent.click(screen.getByRole("button", { name: /save supplier/i }));

    expect(await screen.findByText(/Valid To must be on or after Valid From/i)).toBeInTheDocument();
    expect(apiClient).not.toHaveBeenCalled();
  });
});
