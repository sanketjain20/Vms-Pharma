import { render, screen, waitFor } from "@testing-library/react";
import SalesView from "./SalesView";
import apiClient from "../../Config/apiClient";
jest.mock("../../Config/apiClient", () => jest.fn());

test("shows WhatsApp invoice and reminder actions for an outstanding sale", async () => {
  apiClient.mockImplementation(url => Promise.resolve({ ok: true, json: async () => url.includes("GetSalesByUkey") ? ({ status: 200, data: { id: 1, invoiceNumber: "INV-1", remainingAmount: 250, totalAmount: 1000, totalTax: 0, totalDiscount: 0, netAmount: 1250, items: [] } }) : ({ status: 404 }) }));
  render(<SalesView uKey="sale-1" onClose={() => {}} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "WhatsApp Invoice" })).toBeInTheDocument());
  expect(screen.getByRole("button", { name: "WhatsApp Reminder" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Send SMS" })).toBeInTheDocument();
});
