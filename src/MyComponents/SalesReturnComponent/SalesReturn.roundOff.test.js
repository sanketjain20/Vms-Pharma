import { render, screen, fireEvent, within } from "@testing-library/react";
import SalesReturnAdd from "./SalesReturnAdd";
import SalesReturnView from "./SalesReturnView";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) });

/** A bill line of 3 shirts at 99.99 with Rs 54 GST (18%), and a free unit. */
const SALE = { invoiceNumber: "INV56", items: [
  { id: 1, product: "Shirt", sellingPrice: 99.99, quantity: 3, taxAmount: 54, discountAmount: 0 },
  { id: 2, product: "Socks", sellingPrice: 0, quantity: 1, taxAmount: 0, discountAmount: 0, freeItem: true },
] };

function mockApi(roundBillTotal = true) {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/Sales/CustomItemSetting")) return ok({ status: 200, data: { allowCustomItems: false, roundBillTotal } });
    if (url.includes("/api/Sales/GetSalesByInvoiceNumber")) return ok({ status: 200, data: SALE });
    return ok({ status: 200, data: null });
  });
}

async function returnOne() {
  render(<SalesReturnAdd onClose={jest.fn()} onSubmit={jest.fn()} />);
  fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "INV56" } });
  fireEvent.click(screen.getByRole("button", { name: /fetch|load|find/i }));
  const rows = await screen.findAllByRole("row");
  fireEvent.change(within(rows[1]).getByRole("spinbutton"), { target: { value: "1" } });
}

beforeEach(() => jest.clearAllMocks());

describe("Sales return — the refund estimate", () => {
  it("includes the GST of the units returned (it used to leave it out) and is rounded to the rupee", async () => {
    mockApi(true);
    await returnOne();
    // 1 of 3 shirts: 99.99 + 18.00 GST (a third of 54) = 117.99, refunded as 118.00
    expect(screen.getByTestId("return-gst")).toHaveTextContent("₹18.00");
    expect(screen.getByTestId("return-round-off")).toHaveTextContent("+ 0.01");
    expect(screen.getByTestId("return-refund")).toHaveTextContent("₹118.00");
  });

  it("a shop that doesn't round keeps the paise and shows no round-off", async () => {
    mockApi(false);
    await returnOne();
    expect(await screen.findByText("₹117.99")).toBeInTheDocument();
    expect(screen.getByTestId("return-refund")).toHaveTextContent("₹117.99");
    expect(screen.queryByTestId("return-round-off")).toBeNull();
  });
});

describe("Sales return — the view", () => {
  const show = (data) => {
    apiClient.mockImplementation(() => ok({ status: 200, data: { returnNumber: "RET1", refundMode: "CASH", items: [], ...data } }));
    render(<SalesReturnView uKey="r1" onClose={() => {}} />);
  };

  it("shows the credit note's round-off", async () => {
    show({ totalReturnAmount: 99.99, totalReturnTax: 18, netReturnAmount: 118, roundOff: 0.01 });
    expect(await screen.findByTestId("return-round-off")).toHaveTextContent("Round off+ 0.01");
  });

  it("an older credit note without one looks as before", async () => {
    show({ totalReturnAmount: 100, totalReturnTax: 18, netReturnAmount: 118, roundOff: 0 });
    await screen.findByText("Net Refund Amount");
    expect(screen.queryByTestId("return-round-off")).toBeNull();
  });
});
