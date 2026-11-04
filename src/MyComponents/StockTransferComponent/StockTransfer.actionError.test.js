import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import StockTransfer from "./StockTransfer";
import apiClient from "../../Config/apiClient";

// the grid itself is covered elsewhere: here it shows one DRAFT row with its actions
jest.mock("../CommonComponent/DynamicGrid", () => ({ extraActions }) => (
  <div data-testid="grid">{extraActions({ uKey: "st-3", status: "DRAFT" }, { can: () => true, ActionIcon: { View: () => null, Edit: () => null, Activate: () => null, Disable: () => null, Cancel: () => null, Dispatch: () => null, Receive: () => null } })}</div>
));
jest.mock("../../Config/apiClient", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const reply = (status, body) => Promise.resolve({ ok: status === 200, status, text: () => Promise.resolve(JSON.stringify(body)) });

describe("Stock transfers — a refused Dispatch", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows the server's reason in the styled banner, which can be closed", async () => {
    apiClient.mockImplementation(() => reply(400, { status: 400, message: 'Insufficient stock for ABC in "Main WareHouse": 0 available, 1000 needed.' }));
    render(<StockTransfer />);
    fireEvent.click(screen.getByRole("button", { name: "Dispatch" }));

    const banner = await screen.findByTestId("action-error");
    expect(banner).toHaveClass("aeb");
    expect(banner).toHaveTextContent('Insufficient stock for ABC in "Main WareHouse": 0 available, 1000 needed.');
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    await waitFor(() => expect(screen.queryByTestId("action-error")).toBeNull());
  });
});
