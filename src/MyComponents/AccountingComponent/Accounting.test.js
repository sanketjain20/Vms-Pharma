import { render, screen, waitFor } from "@testing-library/react";
import Accounting from "./Accounting";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient", () => jest.fn());
describe("Accounting", () => {
  it("loads and shows a balanced trial balance", async () => {
    apiClient.mockResolvedValue({ json: async () => ({ status: 200, data: { balanced: true, totalDebit: 100, totalCredit: 100, rows: [{ ledger: "Bank", group: "Asset", debit: 100, credit: 0 }] } }) });
    render(<Accounting />);
    expect(screen.getByRole("heading", { name: "Accounting" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/Trial balance agrees/)).toBeInTheDocument());
    expect(screen.getByText("Bank")).toBeInTheDocument();
  });
});
