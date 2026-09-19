import { render, screen } from "@testing-library/react";
import EInvoice from "./EInvoice";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");

function jsonResponse(body, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) });
}

describe("EInvoice list page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the page title and an empty state on first load", async () => {
    apiClient.mockReturnValue(jsonResponse({ status: 200, data: { content: [], totalPages: 1, totalElements: 0 } }));

    render(<EInvoice />);

    expect(screen.getByText("E-Invoices (IRN)")).toBeInTheDocument();
    expect(await screen.findByText(/No e-invoiced sales yet\./i)).toBeInTheDocument();
  });

  it("lists e-invoiced sales with status and a Generate button for pending ones", async () => {
    apiClient.mockReturnValue(
      jsonResponse({
        status: 200,
        data: {
          content: [
            {
              salesUKey: "sale-1",
              invoiceNumber: "INV00001",
              retailerName: "Delhi Pharmacy",
              netAmount: 1180,
              irnStatus: "PENDING",
              irn: null,
              ackDate: null,
              cancellable: false,
            },
          ],
          totalPages: 1,
          totalElements: 1,
        },
      })
    );

    render(<EInvoice />);

    expect(await screen.findByText("INV00001")).toBeInTheDocument();
    expect(screen.getByText("Delhi Pharmacy")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toBeInTheDocument();
  });

  it("shows a Cancel button only for a generated, still-cancellable IRN", async () => {
    apiClient.mockReturnValue(
      jsonResponse({
        status: 200,
        data: {
          content: [
            {
              salesUKey: "sale-2",
              invoiceNumber: "INV00002",
              retailerName: "Mumbai Pharmacy",
              netAmount: 2360,
              irnStatus: "GENERATED",
              irn: "a".repeat(64),
              ackDate: "2026-03-15T10:00:00",
              cancellable: true,
            },
          ],
          totalPages: 1,
          totalElements: 1,
        },
      })
    );

    render(<EInvoice />);

    expect(await screen.findByText("Generated")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Generate" })).not.toBeInTheDocument();
  });
});
