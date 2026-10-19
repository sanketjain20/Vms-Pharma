import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import SalesEdit from "./SalesEdit";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) });

const PRODUCT = { id: 1, name: "Paracetamol", barcode: "8901234567890", productTypeId: 10 };

const row = (o) => ({
  id: 1, product: "Paracetamol", productId: 1, quantity: 10, sellingPrice: 100, taxAmount: 0, discountAmount: 0, freeItem: false,
  batchId: 1, batchNumberSnapshot: "B1", ...o,
});

const sale = (o) => ({
  id: 9, invoiceNumber: "INV00009", billingMode: "CASH", paymentType: "PAID", retailerId: null, dueDate: null,
  totalDiscount: 0, manualDiscount: 0, schemeDiscount: 0, amountPaid: 0, remainingAmount: 0, items: [], ...o,
});

/** Buy 10 Get 1 at 100 with 18% GST, the 10 paid units came from two batches (7 + 3) and the free one from a third. */
const FREE_SALE = sale({
  amountPaid: 1180,
  items: [
    row({ id: 1, quantity: 7, taxAmount: 126, schemeId: 7, schemeNameSnapshot: "Buy 10 Get 1", batchId: 1, batchNumberSnapshot: "B1" }),
    row({ id: 2, quantity: 3, taxAmount: 54, schemeId: 7, schemeNameSnapshot: "Buy 10 Get 1", batchId: 2, batchNumberSnapshot: "B2" }),
    row({ id: 3, quantity: 1, sellingPrice: 0, freeItem: true, schemeId: 7, schemeNameSnapshot: "Buy 10 Get 1", batchId: 2, batchNumberSnapshot: "B2" }),
  ],
});

/** 1,000 at 10% off (100) and a 50 invoice discount: 12% GST on 850 = 102, net 952. One batch. */
const PCT_SALE = sale({
  totalDiscount: 150, manualDiscount: 50, schemeDiscount: 100, amountPaid: 952,
  items: [row({ quantity: 10, taxAmount: 102, discountAmount: 150, schemeId: 8, schemeNameSnapshot: "10% off" })],
});

/** Made before schemes existed: a 100 invoice discount only; the rows carry no discount of their own. 18% on 900 = 162. */
const OLD_SALE = sale({ totalDiscount: 100, manualDiscount: 100, amountPaid: 1062, items: [row({ taxAmount: 162 })] });

function mockApi(saleData, applicable = null) {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/Retailer/Dropdown")) return ok({ data: [{ id: 5, uKey: "r5", shopName: "Shop Five", ownerName: "Owner" }] });
    if (url.includes("/api/ProductType/GetAllProductType")) return ok({ data: { productTypes: [{ id: 10, name: "Tablets" }] } });
    if (url.includes("/api/Product/GetAllProduct")) return ok({ data: [PRODUCT] });
    if (url.includes("/api/Product/GetProdByProdId/")) return ok({ data: [PRODUCT] });
    if (url.includes("/api/Product/GetProductById/")) return ok({ data: PRODUCT });
    if (url.includes("/api/Sales/GetSalesByUkey/")) return ok({ data: saleData });
    if (url.includes("/api/Inventory/GetInventoryByProdId/")) return ok({ status: 200, data: { unitSellingPrice: 100, currentQuantity: 500 } });
    if (url.includes("/api/Scheme/Applicable")) return ok({ status: 200, data: applicable });
    if (url.includes("/api/Sales/UpdateSales/")) return ok({ status: 200 });
    return ok({ status: 200, data: null });
  });
}

const schemeCalls = () => apiClient.mock.calls.filter(([u]) => u.includes("/api/Scheme/Applicable")).map(([u]) => u);
const updateBody = () => JSON.parse(apiClient.mock.calls.find(([u]) => u.includes("/api/Sales/UpdateSales/"))[1].body);
const tab = (name) => fireEvent.click(screen.getByRole("button", { name }));

async function open() {
  render(<SalesEdit uKey="sale-9" onClose={jest.fn()} onSubmit={jest.fn()} />);
  await screen.findByText(/Edit Sale/i);
  await screen.findByText("Original Items", { selector: "button" });
}

async function save() {
  fireEvent.click(screen.getByRole("button", { name: "Update Sale" }));
  await waitFor(() => expect(apiClient.mock.calls.some(([u]) => u.includes("/api/Sales/UpdateSales/"))).toBe(true));
  return updateBody();
}

describe("SalesEdit — schemes", () => {
  beforeEach(() => jest.clearAllMocks());

  it("opens a Buy 10 Get 1 sale as ONE line of 10 with the free unit noted, not as its batch slices and a free row", async () => {
    mockApi(FREE_SALE);
    await open();
    tab("Product");

    const lines = document.querySelectorAll(".afx-line-list .afx-line-row");
    expect(lines).toHaveLength(1);
    expect(lines[0].querySelector("[data-testid='line-price']")).toHaveTextContent("100.00");
    expect(lines[0].querySelector("[data-testid='line-qty']")).toHaveTextContent("10");
    expect(lines[0]).toHaveTextContent("+ 1 free");
    expect(screen.getByTestId("line-scheme")).toHaveTextContent("Scheme: Buy 10 Get 1");
  });

  it("the original items list still shows every saved row, with the free one tagged", async () => {
    mockApi(FREE_SALE);
    await open();

    const rows = screen.getAllByTestId("original-line");
    expect(rows).toHaveLength(3);
    expect(rows[2]).toHaveTextContent("FREE");
    expect(rows[2]).toHaveTextContent("Buy 10 Get 1");
  });

  it("opening a sale keeps its saved schemes: the server is not asked for new suggestions", async () => {
    mockApi(FREE_SALE, { schemeId: 99, name: "Other", description: "x", freeQuantity: 5, discountAmount: 0 });
    await open();
    tab("Product");

    expect(schemeCalls()).toHaveLength(0);
    expect(screen.getByTestId("line-scheme")).toHaveTextContent("Buy 10 Get 1");
  });

  it("saving an untouched scheme sale sends one merged line with the scheme, the tax on the full value and no discount", async () => {
    mockApi(FREE_SALE);
    await open();

    const body = await save();
    expect(body.totalDiscount).toBe(0);
    expect(body.items).toEqual([{ productId: 1, quantity: 10, sellingPrice: 100, taxAmount: 180, batchId: 1, schemeId: 7 }]);
    expect(body.amountPaid).toBe(1180);
  });

  it("a scheme discount and an invoice discount are separated: only the invoice discount is shown and sent as the discount", async () => {
    mockApi(PCT_SALE);
    await open();
    tab("Billing");

    expect(screen.getByDisplayValue("50")).toBeInTheDocument();                              // the discount box holds the manual 50, not 150
    expect(screen.getByText("Scheme discount").nextSibling).toHaveTextContent("−₹100.00");
    expect(screen.getByText("Net Amount").nextSibling).toHaveTextContent("₹952.00");         // unchanged by opening it

    const body = await save();
    expect(body.totalDiscount).toBe(50);
    expect(body.items[0]).toMatchObject({ schemeId: 8, taxAmount: 120 }); // 12% of the full 1,000: the server takes the rate from this
  });

  it("a sale made before schemes with an invoice discount keeps its total and recovers the GST rate", async () => {
    mockApi(OLD_SALE);
    await open();
    tab("Billing");

    expect(screen.getByText("Net Amount").nextSibling).toHaveTextContent("₹1062.00");
    const body = await save();
    expect(body.totalDiscount).toBe(100);
    expect(body.items[0]).toMatchObject({ taxAmount: 180, schemeId: null });
    expect(body.amountPaid).toBe(1062);
  });

  it("removing a line's scheme drops its free units and discount, and is saved as no scheme", async () => {
    mockApi(PCT_SALE);
    await open();
    tab("Product");

    fireEvent.click(within(screen.getByTestId("line-scheme")).getByRole("button", { name: "Remove" }));
    tab("Billing");

    expect(screen.queryByText("Scheme discount")).not.toBeInTheDocument();
    expect(screen.getByText("Net Amount").nextSibling).toHaveTextContent("₹1064.00"); // 1,000 - 50 = 950, + 12% GST = 114

    const body = await save();
    expect(body.items[0].schemeId).toBeNull();
    expect(body.totalDiscount).toBe(50);
  });

  it("changing a line's quantity asks for the scheme again for the new quantity", async () => {
    mockApi(FREE_SALE, { schemeId: 7, name: "Buy 10 Get 1", description: "Buy 10 Get 1", freeQuantity: 2, discountAmount: 0 });
    await open();
    tab("Product");

    fireEvent.click(document.querySelector(".afx-line-row .afx-icon-btn"));
    const qty = await screen.findByDisplayValue("10");
    fireEvent.change(qty, { target: { value: "20" } });
    fireEvent.click(await screen.findByRole("button", { name: "Update Item" }));

    await waitFor(() => expect(schemeCalls()).toHaveLength(1));
    expect(schemeCalls()[0]).toContain("quantity=20");
    await waitFor(() => expect(document.querySelector(".afx-line-row")).toHaveTextContent("+ 2 free"));
  });

  it("choosing another retailer looks again for the schemes, and sends the retailer", async () => {
    mockApi(FREE_SALE, { schemeId: 7, name: "Buy 10 Get 1", description: "Buy 10 Get 1", freeQuantity: 1, discountAmount: 0 });
    await open();
    tab("Billing");

    fireEvent.click(screen.getByPlaceholderText("Search retailer…"));
    fireEvent.mouseDown(await screen.findByText("Shop Five · Owner"));

    await waitFor(() => expect(schemeCalls()).toHaveLength(1));
    expect(schemeCalls()[0]).toContain("retailerId=5");
  });
});
