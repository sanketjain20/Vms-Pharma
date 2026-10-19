import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SalesView from "./SalesView";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient", () => jest.fn());

const SALE = { id: 1, invoiceNumber: "INV-1", remainingAmount: 250, totalAmount: 1000, totalTax: 0, totalDiscount: 0, netAmount: 1250, items: [] };

/** body: object (sent as JSON), "" (an empty body, as a rejected request has) or a raw string */
function response(status, body) {
  const text = body === "" ? "" : typeof body === "string" ? body : JSON.stringify(body);
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
    json: async () => JSON.parse(text), // throws "Unexpected end of JSON input" on "" — the bug being fixed
  });
}

function mockApi(notification) {
  apiClient.mockImplementation((url) => {
    if (url.includes("GetSalesByUkey")) return response(200, { status: 200, data: SALE });
    if (url.includes("/api/CustomerNotification/")) return notification();
    return response(200, { status: 404 });
  });
}

describe("SalesView — WhatsApp invoice / reminder", () => {
  let opened;
  beforeEach(() => {
    jest.clearAllMocks();
    opened = { location: { href: "" }, close: jest.fn() };
    window.open = jest.fn(() => opened);
  });

  it("opens WhatsApp with the prepared link", async () => {
    mockApi(() => response(200, { status: 200, data: { whatsappUrl: "https://wa.me/917247064772?text=hi" } }));
    render(<SalesView uKey="sale-1" onClose={() => {}} />);

    fireEvent.click(await screen.findByRole("button", { name: "WhatsApp Invoice" }));

    await waitFor(() => expect(opened.location.href).toBe("https://wa.me/917247064772?text=hi"));
  });

  it("an empty-bodied rejection shows a session message, not a JSON parse error", async () => {
    mockApi(() => response(403, ""));
    render(<SalesView uKey="sale-1" onClose={() => {}} />);

    fireEvent.click(await screen.findByRole("button", { name: "WhatsApp Reminder" }));

    expect(await screen.findByText("Your session has expired. Please log in again.")).toBeInTheDocument();
    expect(screen.queryByText(/Unexpected end of JSON input/)).not.toBeInTheDocument();
    expect(opened.close).toHaveBeenCalled();
  });

  it("shows the server's own message when it explains the refusal", async () => {
    mockApi(() => response(400, { status: 400, message: "This invoice has no retailer phone number", data: null }));
    render(<SalesView uKey="sale-1" onClose={() => {}} />);

    fireEvent.click(await screen.findByRole("button", { name: "WhatsApp Invoice" }));

    expect(await screen.findByText("This invoice has no retailer phone number")).toBeInTheDocument();
  });

  it("an empty 500 says the server gave no details", async () => {
    mockApi(() => response(500, ""));
    render(<SalesView uKey="sale-1" onClose={() => {}} />);

    fireEvent.click(await screen.findByRole("button", { name: "WhatsApp Invoice" }));

    expect(await screen.findByText("The server returned no details (HTTP 500).")).toBeInTheDocument();
  });

  it("does not offer WhatsApp or SMS on a sales order (not an invoice yet)", async () => {
    apiClient.mockImplementation((url) => url.includes("GetSalesOrderByUKey")
      ? response(200, { status: 200, data: { ...SALE, orderNumber: "SO-1", orderDate: "2026-10-01", sales: [] } })
      : response(200, { status: 404 }));
    render(<SalesView documentMode uKey="so-1" onClose={() => {}} />);

    await screen.findByText("Order · SO-1");
    expect(screen.queryByRole("button", { name: "WhatsApp Invoice" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "WhatsApp Reminder" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send SMS" })).not.toBeInTheDocument();
  });
});
