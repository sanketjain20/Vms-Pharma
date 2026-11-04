import { render, screen } from "@testing-library/react";
import SalesView from "./SalesView";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient", () => jest.fn());

const base = { id: 1, invoiceNumber: "INV-1", remainingAmount: 0, totalAmount: 1000, totalTax: 0, totalDiscount: 0, netAmount: 1000, items: [] };

function show(sale) {
  apiClient.mockImplementation((url) => {
    const body = url.includes("GetSalesByUkey") ? { status: 200, data: { ...base, ...sale } } : { status: 404 };
    return Promise.resolve({ ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body });
  });
  render(<SalesView uKey="sale-1" onClose={() => {}} />);
}

describe("SalesView — round-off and how the bill was paid", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows the round-off line and each payment of a split bill", async () => {
    show({
      billingMode: "SPLIT", netAmount: 1247, roundOff: -0.37,
      payments: [
        { mode: "CASH", amount: 500, source: "BILL" },
        { mode: "UPI", amount: 600, reference: "TX9", source: "BILL" },
        { mode: "CARD", amount: 147, source: "COLLECTION" },
      ],
    });
    expect(await screen.findByTestId("round-off")).toHaveTextContent("Round off- 0.37");
    expect(screen.getByText("Split")).toBeInTheDocument();
    const paid = screen.getByTestId("sale-payments");
    expect(paid).toHaveTextContent("Cash ₹500.00");
    expect(paid).toHaveTextContent("UPI ₹600.00 (TX9)");
    expect(paid).toHaveTextContent("Later · Card ₹147.00");
  });

  it("a refund of a cancelled walk-in bill reads as a refund, without a minus sign", async () => {
    show({ billingMode: "CASH", payments: [{ mode: "CASH", amount: 1000, source: "BILL" }, { mode: "CASH", amount: -1000, source: "REFUND" }] });
    expect(await screen.findByTestId("sale-payments")).toHaveTextContent("Refund · Cash ₹1000.00");
  });

  it("an older bill without round-off or payments looks as before", async () => {
    show({ billingMode: "CASH" });
    await screen.findByTestId("sale-customer");
    expect(screen.queryByTestId("round-off")).toBeNull();
    expect(screen.queryByTestId("sale-payments")).toBeNull();
  });
});
