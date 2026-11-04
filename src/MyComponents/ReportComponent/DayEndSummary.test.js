import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import DayEndSummary from "./DayEndSummary";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("../../Config/api.config", () => ({ __esModule: true, default: "http://api" }));

const json = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

const mode = (m, label, bills, collections, refunds) => ({ mode: m, label, bills, collections, refunds, total: bills + collections + refunds });

const DAY = {
  modes: [mode("CASH", "Cash", 500, 100, -50), mode("UPI", "UPI", 300, 0, 0), mode("CARD", "Card", 0, 0, 0)],
  total: 850,
  rows: [
    { time: "2026-10-30T10:15:00", kind: "Bill", document: "INV-1", party: "Walk-in", mode: "CASH", modeLabel: "Cash", reference: null, amount: 500 },
    { time: "2026-10-30T10:15:00", kind: "Bill", document: "INV-1", party: "Walk-in", mode: "UPI", modeLabel: "UPI", reference: "TX1", amount: 300 },
    { time: "2026-10-30T12:00:00", kind: "Collection", document: "INV-0", party: "Ravi", mode: "CASH", modeLabel: "Cash", reference: null, amount: 100 },
    { time: "2026-10-30T16:40:00", kind: "Refund", document: "INV-2", party: null, mode: "CASH", modeLabel: "Cash", reference: null, amount: -50 },
  ],
};

describe("Day-end summary", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows each mode's total, the day's total and every movement", async () => {
    apiClient.mockImplementation(() => json({ status: 200, data: DAY }));
    render(<DayEndSummary />);

    const cash = await screen.findByTestId("dayend-mode-CASH");
    expect(cash).toHaveTextContent("₹550.00");
    expect(cash).toHaveTextContent("Bills ₹500.00");
    expect(cash).toHaveTextContent("Collected ₹100.00");
    expect(cash).toHaveTextContent("Refunds − ₹50.00");
    expect(screen.getByTestId("dayend-mode-UPI")).toHaveTextContent("₹300.00");
    expect(screen.getByTestId("dayend-mode-CARD")).not.toHaveTextContent("Refunds");
    expect(screen.getByTestId("dayend-total")).toHaveTextContent("₹850.00");
    expect(screen.getByTestId("dayend-total")).toHaveTextContent("4 movements");

    const rows = within(screen.getByTestId("dayend-rows")).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(4);
    expect(rows[1]).toHaveTextContent("10:15BillINV-1Walk-inUPITX1₹300.00");
    expect(rows[3]).toHaveClass("dayend-out");
    expect(rows[3]).toHaveTextContent("− ₹50.00");
  });

  it("asks for the picked date", async () => {
    apiClient.mockImplementation(() => json({ status: 200, data: { ...DAY, rows: [], total: 0 } }));
    render(<DayEndSummary />);
    await screen.findByText("No money in or out on this day.");
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-10-01" } });
    await waitFor(() => expect(apiClient).toHaveBeenLastCalledWith("http://api/api/Sales/DayEndSummary?date=2026-10-01", { method: "GET" }));
  });

  it("shows the server's message when it can't load", async () => {
    apiClient.mockImplementation(() => json({ status: 403, message: "You do not have access to reports." }));
    render(<DayEndSummary />);
    expect(await screen.findByRole("alert")).toHaveTextContent("You do not have access to reports.");
  });
});
