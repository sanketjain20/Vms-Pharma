import { render, screen, fireEvent, within } from "@testing-library/react";
import SalesEdit from "./SalesEdit";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) });

const row = (o) => ({
  id: 1, product: "Paracetamol", productId: 1, quantity: 10, sellingPrice: 100, taxAmount: 0, discountAmount: 0, freeItem: false,
  batchId: 1, batchNumberSnapshot: "B1", ...o,
});

const sale = (o) => ({
  id: 9, invoiceNumber: "INV00009", billingMode: "CASH", paymentType: "PAID", retailerId: null, dueDate: null,
  totalDiscount: 0, manualDiscount: 0, schemeDiscount: 0, amountPaid: 0, remainingAmount: 0, items: [], ...o,
});

/** Two products at different GST: 10 x 100 @ 18% (180) and 5 x 200 @ 12% (120). */
const TWO_PRODUCTS = sale({
  amountPaid: 2300,
  items: [
    row({ id: 1, productId: 1, product: "Paracetamol", quantity: 10, sellingPrice: 100, taxAmount: 180 }),
    row({ id: 2, productId: 2, product: "Amoxicillin", quantity: 5, sellingPrice: 200, taxAmount: 120, batchId: 2, batchNumberSnapshot: "B2" }),
  ],
});

/** A 100 invoice discount on 1,000 @ 18%: 18% on 900 = 162, net 1,062. */
const DISCOUNTED = sale({ totalDiscount: 100, manualDiscount: 100, amountPaid: 1062, items: [row({ taxAmount: 162 })] });

function mockApi(saleData) {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/Sales/GetSalesByUkey/")) return ok({ data: saleData });
    if (url.includes("/api/ProductType/GetAllProductType")) return ok({ data: { productTypes: [] } });
    return ok({ status: 200, data: null });
  });
}

async function openProductTab(saleData) {
  mockApi(saleData);
  render(<SalesEdit uKey="sale-9" onClose={jest.fn()} onSubmit={jest.fn()} />);
  await screen.findByText(/Edit Sale/i);
  await screen.findByText("Original Items", { selector: "button" });
  fireEvent.click(screen.getByRole("button", { name: "Product" }));
}

const cells = (testId) => screen.getAllByTestId(testId).map((c) => c.textContent);

describe("Sales (edit) — Product tab line items table", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows one row per product with price, qty, amount without GST, GST %, GST and amount with GST", async () => {
    await openProductTab(TWO_PRODUCTS);

    const rows = screen.getAllByTestId("sale-line");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Paracetamol")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Amoxicillin")).toBeInTheDocument();
    expect(cells("line-price")).toEqual(["100.00", "200.00"]);
    expect(cells("line-qty")).toEqual(["10", "5"]);
    expect(cells("line-excl")).toEqual(["1000.00", "1000.00"]);
    expect(cells("line-rate")).toEqual(["18%", "12%"]);
    expect(cells("line-gst")).toEqual(["180.00", "120.00"]);
    expect(cells("line-incl")).toEqual(["1180.00", "1120.00"]);
  });

  it("totals every product at the bottom, without GST, the GST, and with GST", async () => {
    await openProductTab(TWO_PRODUCTS);

    expect(screen.getByTestId("sum-excl")).toHaveTextContent("2000.00");
    expect(screen.getByTestId("sum-gst")).toHaveTextContent("300.00");
    expect(screen.getByTestId("sum-incl")).toHaveTextContent("2300.00");
    expect(screen.getByText("Total (2 items)")).toBeInTheDocument();
    expect(screen.queryByTestId("net-payable")).not.toBeInTheDocument(); // no invoice discount
  });

  it("with an invoice discount, shows the net payable after the discount under the table", async () => {
    await openProductTab(DISCOUNTED);

    expect(screen.getByTestId("sum-incl")).toHaveTextContent("1180.00");
    expect(screen.getByTestId("net-payable")).toHaveTextContent("₹1062.00");
  });

  it("shows the saved items the same way on the Original Items tab", async () => {
    mockApi(TWO_PRODUCTS);
    render(<SalesEdit uKey="sale-9" onClose={jest.fn()} onSubmit={jest.fn()} />);
    await screen.findByText(/Edit Sale/i);

    const rows = await screen.findAllByTestId("original-line");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("18%");
    expect(rows[1]).toHaveTextContent("12%");
    expect(rows[1]).toHaveTextContent("1120.00");
  });
});
