import { render, screen, waitFor } from "@testing-library/react";
import SalesView from "./SalesComponent/SalesView";
import Batch from "./InventoryComponent/Batch";
import ExpiryAlert from "./InventoryComponent/ExpiryAlert";
import apiClient from "../Config/apiClient";
import { resetBusinessProfile } from "../utils/businessProfile";

jest.mock("../Config/apiClient");
jest.mock("./CommonComponent/DynamicGrid", () => (props) => (
  <div data-testid="grid">{props.columns.map((c) => c.header).join(" | ")}</div>
));

const json = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

const CLOTH = { businessType: "CLOTHING", trackExpiry: false, isPharma: false };
const PHARMA = { businessType: "PHARMA", trackExpiry: true, isPharma: true };

const sale = {
  id: 1, uKey: "sale-1", invoiceNumber: "INV10", billingMode: "CASH", paymentType: "PAID", createdAt: "2026-10-01",
  totalAmount: 1000, totalTax: 0, totalDiscount: 0, netAmount: 1000, remainingAmount: 0,
  items: [{ product: "Kurta", quantity: 2, sellingPrice: 500, discountAmount: 0, taxAmount: 0, subtotal: 1000,
    batchNumberSnapshot: "B1", expiryDateSnapshot: "2028-01-31", hsnCodeSnapshot: "6211" }],
};

function mockApis(profile, extra = {}) {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/BusinessSetting/Get")) return json({ status: 200, data: profile });
    const hit = Object.keys(extra).find((k) => url.includes(k));
    return json({ status: 200, data: hit ? extra[hit] : null });
  });
}

describe("A shop with expiry switched off sees no expiry anywhere", () => {
  beforeEach(() => { jest.clearAllMocks(); resetBusinessProfile(); });

  it("the sale view has no Expiry column (a pharmacy still has it)", async () => {
    mockApis(CLOTH, { "/api/Sales/GetSalesByUkey/sale-1": sale });
    const { unmount } = render(<SalesView uKey="sale-1" onClose={() => {}} />);
    await screen.findByText("Kurta");
    await waitFor(() => expect(screen.queryByText("Expiry")).not.toBeInTheDocument());
    expect(screen.queryByText("2028-01-31")).not.toBeInTheDocument();
    unmount();

    resetBusinessProfile();
    mockApis(PHARMA, { "/api/Sales/GetSalesByUkey/sale-1": sale });
    render(<SalesView uKey="sale-1" onClose={() => {}} />);
    expect(await screen.findByText("2028-01-31")).toBeInTheDocument();
    expect(screen.getByText("Expiry")).toBeInTheDocument();
  });

  it("the batch grid drops the MFG and expiry columns", async () => {
    mockApis(CLOTH);
    render(<Batch />);
    await waitFor(() => expect(screen.getByTestId("grid")).not.toHaveTextContent("MFG Date"));
    expect(screen.getByTestId("grid")).not.toHaveTextContent("Expiry");
    expect(screen.getByTestId("grid")).toHaveTextContent("Batch No");
  });

  it("the Expiry Alerts page says expiry is off instead of listing batches", async () => {
    mockApis(CLOTH);
    render(<ExpiryAlert />);
    expect(await screen.findByTestId("expiry-off")).toHaveTextContent("Expiry dates are switched off for this shop");
  });
});
