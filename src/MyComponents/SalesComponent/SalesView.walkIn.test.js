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

describe("SalesView — who the bill is made out to", () => {
  beforeEach(() => jest.clearAllMocks());

  it("a walk-in bill shows the customer's name and mobile", async () => {
    show({ customerName: "Ravi Kumar", customerPhone: "9876543210" });
    const cell = await screen.findByTestId("sale-customer");
    expect(cell).toHaveTextContent("Ravi Kumar");
    expect(cell).toHaveTextContent("98765 43210");
    expect(screen.getByText("Customer")).toBeInTheDocument();
  });

  it("a walk-in bill with only a mobile shows the placeholder and the mobile", async () => {
    show({ customerPhone: "9876543210" });
    const cell = await screen.findByTestId("sale-customer");
    expect(cell).toHaveTextContent("Walk-in customer");
    expect(cell).toHaveTextContent("98765 43210");
  });

  it("a walk-in bill with no details looks exactly as before", async () => {
    show({});
    expect(await screen.findByTestId("sale-customer")).toHaveTextContent(/^Walk-in customer$/);
  });

  it("a retailer bill shows the retailer, not a walk-in mobile", async () => {
    show({ retailerName: "Shop Five", retailerCode: "RET-5", customerPhone: "9876543210" });
    const cell = await screen.findByTestId("sale-customer");
    expect(cell).toHaveTextContent("Shop Five");
    expect(cell).not.toHaveTextContent("98765");
    expect(screen.getByText("Retailer")).toBeInTheDocument();
  });
});
