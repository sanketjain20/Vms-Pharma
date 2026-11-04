import { render, screen, fireEvent, within } from "@testing-library/react";
import SerialLookup from "./SerialLookup";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");
const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

const UNIT = {
  serialNo: "IMEI123", status: "SOLD", productId: 7, productName: "Phone X", productCode: "PRD000007", batchNumber: "BCH000020",
  godown: "Main Godown",
  purchase: { purchaseNumber: "PUR000009", supplier: "Gadget Hub", date: "2026-10-20", unitCost: 9000 },
  sale: { invoiceNumber: "INV000040", customer: "Asha", phone: "9876543210", soldAt: "2026-10-23T11:00:00", price: 12000, free: false },
  warrantyUntil: "2027-10-22", underWarranty: true,
  history: [
    { type: "PURCHASED", reference: "PUR000009", party: "Gadget Hub", at: "2026-10-20T10:00:00" },
    { type: "SOLD", reference: "INV000040", party: "Asha", at: "2026-10-23T11:00:00" },
  ],
};

const search = (text) => {
  fireEvent.change(screen.getByLabelText("Serial number or IMEI"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
};

describe("Serial lookup (Phase 6)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows where a unit came from, where it went, its warranty and its history", async () => {
    apiClient.mockImplementation(() => ok({ status: 200, data: [UNIT] }));
    render(<SerialLookup />);
    search(" imei 123 ");
    const card = await screen.findByTestId("serial-card");
    expect(apiClient.mock.calls[0][0]).toContain("/api/Serial/Lookup?serial=IMEI123");
    expect(within(card).getByTestId("serial-status")).toHaveTextContent("Sold");
    expect(within(card).getByTestId("serial-purchase")).toHaveTextContent("PUR000009 · Gadget Hub · 20-10-2026 · ₹9000");
    expect(within(card).getByTestId("serial-sale")).toHaveTextContent("INV000040 · Asha (9876543210) · 23-10-2026 11:00 · ₹12000");
    expect(within(card).getByTestId("serial-warranty")).toHaveTextContent("Warranty till 22-10-2027 (active)");
    expect(within(card).getByTestId("serial-history")).toHaveTextContent("Received on purchase · PUR000009 · Gadget Hub");
  });

  it("says so when nothing matches, and asks for at least 3 characters", async () => {
    apiClient.mockImplementation(() => ok({ status: 200, message: "No unit with that serial number.", data: [] }));
    render(<SerialLookup />);
    search("ab");
    expect(screen.getByText("Type at least 3 characters of the serial number.")).toBeInTheDocument();
    expect(apiClient).not.toHaveBeenCalled();
    search("ZZZ999");
    expect(await screen.findByTestId("serial-none")).toHaveTextContent("No unit with that serial number.");
  });

  it("a unit on a stock transfer, or written off, says so (Phase 7)", async () => {
    apiClient.mockImplementation(() => ok({ status: 200, data: [{ ...UNIT, status: "IN_TRANSIT", sale: null, warrantyUntil: null, underWarranty: false,
      history: [{ type: "TRANSFERRED_OUT", reference: "ST1", party: "Branch", at: "2026-10-24T10:00:00" }] }] }));
    render(<SerialLookup />);
    search("IMEI123");
    const card = await screen.findByTestId("serial-card");
    expect(within(card).getByTestId("serial-status")).toHaveTextContent("On a stock transfer");
    expect(within(card).getByTestId("serial-history")).toHaveTextContent("Sent on a stock transfer · ST1 · Branch");
  });

  it("an unsold unit has no warranty yet", async () => {
    apiClient.mockImplementation(() => ok({ status: 200, data: [{ ...UNIT, status: "IN_STOCK", sale: null, warrantyUntil: null, underWarranty: false }] }));
    render(<SerialLookup />);
    search("IMEI123");
    const card = await screen.findByTestId("serial-card");
    expect(within(card).getByTestId("serial-status")).toHaveTextContent("In stock");
    expect(within(card).getByTestId("serial-warranty")).toHaveTextContent("Starts when sold");
  });
});
