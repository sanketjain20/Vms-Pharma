import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import SalesAddNew from "./SalesAddNew";
import apiClient from "../../Config/apiClient";
import { toast } from "react-toastify";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));
jest.mock("./SalesView", () => () => null);

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

const PRODUCT = { id: 1, name: "Paracetamol", barcode: "8901234567890", productTypeId: 10, sellingPrice: 100, stock: 500 };
const FREE_SCHEME = { schemeId: 7, name: "Buy 10 Get 1", description: "Buy 10 Get 1", freeQuantity: 1, discountAmount: 0 };
const PCT_SCHEME = { schemeId: 8, name: "10% off", description: "10% off", freeQuantity: 0, discountAmount: 100 };

/** applicable: what /api/Scheme/Applicable answers (null = no scheme), or a function of the url */
function mockApi({ applicable = null, schemeDelay = null, price = PRODUCT.sellingPrice } = {}) {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/Retailer/Dropdown")) return ok({ data: [{ id: 5, uKey: "r5", shopName: "Shop Five", ownerName: "Owner" }] });
    if (url.includes("/api/ProductType/GetAllProductType")) return ok({ data: { productTypes: [{ id: 10, name: "Tablets" }] } });
    if (url.includes("/api/Product/GetAllProduct")) return ok({ data: [{ ...PRODUCT, sellingPrice: price }] });
    if (url.includes("/api/Scheme/Applicable")) {
      const body = { status: 200, data: typeof applicable === "function" ? applicable(url) : applicable };
      return schemeDelay ? schemeDelay.then(() => ok(body)) : ok(body);
    }
    if (url.includes("/api/Sales/AddSales")) return ok({ status: 200, message: "Sale added successfully", data: { uKey: "s1" } });
    return ok({ status: 200, data: null });
  });
}

const schemeCalls = () => apiClient.mock.calls.filter(([u]) => u.includes("/api/Scheme/Applicable")).map(([u]) => u);
const saleCall = () => apiClient.mock.calls.find(([u]) => u.includes("/api/Sales/AddSales"));
const saleBody = () => JSON.parse(saleCall()[1].body);
const totalRow = (label) => screen.getByText(label).parentElement;

/** Opens Quick Sale, puts `qty` of the product in the cart from the catalog, and (optionally) goes to checkout. */
async function cartWith(qty, { checkout = true } = {}) {
  render(<SalesAddNew onClose={jest.fn()} onSubmit={jest.fn()} />);
  fireEvent.click(await screen.findByRole("button", { name: /Add to cart/i }));
  for (let i = 1; i < qty; i++) fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
  await waitFor(() => expect(schemeCalls().length).toBeGreaterThanOrEqual(qty));
  if (checkout) fireEvent.click(screen.getByRole("button", { name: /Proceed to checkout/i }));
}

describe("SalesAddNew (Quick Sale) — synced with SalesAdd: schemes, discount, GST", () => {
  beforeEach(() => jest.clearAllMocks());

  it("asks for a scheme when a product is added and shows its name and free units on the cart line", async () => {
    mockApi({ applicable: FREE_SCHEME });
    await cartWith(1);

    const scheme = await screen.findByTestId("line-scheme");
    expect(scheme).toHaveTextContent("Scheme: Buy 10 Get 1");
    expect(screen.getByTestId("sale-line")).toHaveTextContent("+ 1 free");
    expect(totalRow("Free units (stock reduced, not charged)")).toHaveTextContent("1");

    const url = schemeCalls()[0];
    expect(url).toContain("productId=1");
    expect(url).toContain("quantity=1");
    expect(url).toContain("unitPrice=100");
    expect(url).not.toContain("retailerId");
  });

  it("asks again with the new quantity every time the quantity changes", async () => {
    mockApi({ applicable: null });
    await cartWith(3);
    fireEvent.click(within(screen.getByTestId("sale-line")).getByRole("button", { name: "Increase quantity" }));

    await waitFor(() => expect(schemeCalls()).toHaveLength(4));
    expect(schemeCalls().map(u => new URL(u, "http://x").searchParams.get("quantity"))).toEqual(["1", "2", "3", "4"]);
  });

  it("a discount scheme lowers the line and the totals, and the sale carries the scheme id", async () => {
    mockApi({ applicable: PCT_SCHEME });
    await cartWith(10);
    await screen.findByTestId("line-scheme");

    expect(totalRow("Scheme discount")).toHaveTextContent("-₹100.00");
    expect(screen.getByTestId("line-excl")).toHaveTextContent("₹900.00");
    expect(totalRow("Taxable value")).toHaveTextContent("₹900.00");
    expect(totalRow("Net amount")).toHaveTextContent("₹1062.00"); // 900 + 18%

    fireEvent.click(screen.getByRole("button", { name: /Place order/i }));
    await waitFor(() => expect(saleCall()).toBeTruthy());
    const body = saleBody();
    expect(body.items[0]).toMatchObject({ productId: 1, quantity: 10, sellingPrice: 100, schemeId: 8, taxAmount: 180 });
    expect(body.totalDiscount).toBe(0); // the server adds the scheme's own discount
    expect(body.amountPaid).toBe(1062);
    expect(toast.success).toHaveBeenCalledWith("Sale added successfully");
  });

  it("Remove takes the scheme off and keeps it off; Apply scheme brings it back", async () => {
    mockApi({ applicable: PCT_SCHEME });
    await cartWith(10);
    await screen.findByTestId("line-scheme");

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.queryByTestId("line-scheme")).not.toBeInTheDocument();
    expect(screen.queryByText("Scheme discount")).not.toBeInTheDocument();
    expect(totalRow("Net amount")).toHaveTextContent("₹1180.00");

    const before = schemeCalls().length;
    fireEvent.click(within(screen.getByTestId("sale-line")).getByRole("button", { name: "Decrease quantity" }));
    await new Promise(r => setTimeout(r, 0));
    expect(schemeCalls()).toHaveLength(before); // removed stays removed

    fireEvent.click(screen.getByRole("button", { name: "Apply scheme" }));
    expect(await screen.findByTestId("line-scheme")).toHaveTextContent("10% off");
  });

  it("invoice discount: GST is charged on the discounted value but the sent tax is on the full value (server reads the rate from it)", async () => {
    mockApi({ applicable: null });
    await cartWith(10);

    const discountBox = screen.getByPlaceholderText("0");
    fireEvent.change(discountBox, { target: { value: "10" } }); // 10%

    expect(totalRow("Taxable value")).toHaveTextContent("₹900.00");
    expect(totalRow("GST (18% common)")).toHaveTextContent("₹162.00");
    expect(totalRow("Net amount")).toHaveTextContent("₹1062.00");

    fireEvent.click(screen.getByRole("button", { name: /Place order/i }));
    await waitFor(() => expect(saleCall()).toBeTruthy());
    const body = saleBody();
    expect(body.totalDiscount).toBe(100);
    expect(body.items[0].taxAmount).toBe(180); // 18% of 1,000 — not 18% of 900
    expect(body.items[0].schemeId).toBeNull();
  });

  it("refuses a discount larger than the goods are worth after schemes", async () => {
    mockApi({ applicable: PCT_SCHEME });
    await cartWith(10);
    await screen.findByTestId("line-scheme");

    fireEvent.change(screen.getAllByRole("combobox").find(s => s.value === "PERCENT"), { target: { value: "FLAT" } });
    fireEvent.change(screen.getByPlaceholderText("0"), { target: { value: "950" } }); // worth 900 after the scheme
    fireEvent.click(screen.getByRole("button", { name: /Place order/i }));

    expect(await screen.findAllByText("Discount cannot be more than the value of the goods after schemes")).not.toHaveLength(0);
    expect(saleCall()).toBeUndefined();
  });

  it("choosing a retailer asks again with the retailer, for retailer-specific schemes", async () => {
    mockApi({ applicable: (url) => (url.includes("retailerId=5") ? PCT_SCHEME : null) });
    await cartWith(10);
    expect(screen.queryByTestId("line-scheme")).not.toBeInTheDocument();

    fireEvent.click(screen.getByPlaceholderText("Search retailer..."));
    fireEvent.mouseDown(await screen.findByText("Shop Five · Owner"));

    expect(await screen.findByTestId("line-scheme")).toHaveTextContent("10% off");
    expect(schemeCalls().at(-1)).toContain("retailerId=5");
  });

  it("does not submit while a scheme check is still running", async () => {
    let release;
    mockApi({ applicable: null, schemeDelay: new Promise(r => { release = r; }) });
    render(<SalesAddNew onClose={jest.fn()} onSubmit={jest.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /Add to cart/i }));
    fireEvent.click(screen.getByRole("button", { name: /Proceed to checkout/i }));

    fireEvent.click(screen.getByRole("button", { name: /Place order/i }));
    expect(toast.info).toHaveBeenCalledWith("Still checking schemes — try again in a moment");
    expect(saleCall()).toBeUndefined();

    release();
    await waitFor(() => expect(screen.getByTestId("sale-line")).toBeInTheDocument());
  });

  it("full payment goes through when the payable has more than 2 decimals before rounding (33.33 x 3 + 18%)", async () => {
    mockApi({ applicable: null, price: 33.33 });
    await cartWith(3);
    fireEvent.change(screen.getByPlaceholderText("0"), { target: { value: "7" } }); // 7% discount — more awkward paise

    fireEvent.click(screen.getByRole("button", { name: /Full payment/i }));
    fireEvent.click(screen.getByRole("button", { name: /Place order/i }));

    await waitFor(() => expect(saleCall()).toBeTruthy());
    expect(toast.error).not.toHaveBeenCalled();
    const body = saleBody();
    expect(body.paymentType).toBe("PAID");
    expect(body.remainingAmount).toBe(0);
  });

  it("Common GST is a % rate only (no ₹ Flat); Product-wise offers % or ₹ Flat", async () => {
    mockApi({ applicable: null });
    await cartWith(1);

    expect(screen.queryByRole("option", { name: "₹ Flat Amount" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Product-wise" }));
    expect(screen.getByRole("option", { name: "₹ Flat Amount" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "% GST Rate" })).toBeInTheDocument();
  });
});
