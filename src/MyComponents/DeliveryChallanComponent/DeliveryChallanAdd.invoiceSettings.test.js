import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DeliveryChallanAdd from "./DeliveryChallanAdd";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");

function jsonResponse(body, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) });
}

const retailerDropdown = [{ id: 5, name: "City Pharmacy", shopName: "City Pharmacy" }];
const godownDropdown = [{ id: 1, name: "Main Warehouse" }];
const productList = [{ id: 101, name: "Paracetamol 500mg" }];

function mockApi() {
  apiClient.mockImplementation((url, options) => {
    if (url.includes("/api/Retailer/Dropdown")) return jsonResponse({ status: 200, data: retailerDropdown });
    if (url.includes("/api/Godown/GetGodownDropdown")) return jsonResponse({ status: 200, data: godownDropdown });
    if (url.includes("/api/Product/GetAllProduct")) return jsonResponse({ status: 200, data: productList });
    if (options?.method === "POST" && url.includes("/api/DeliveryChallan/AddDeliveryChallan")) {
      return jsonResponse({ status: 200, data: {} });
    }
    return jsonResponse({ status: 200, data: null });
  });
}

function postedBody() {
  const call = apiClient.mock.calls.find(
    ([url, options]) => options?.method === "POST" && url.includes("/api/DeliveryChallan/AddDeliveryChallan")
  );
  return call ? JSON.parse(call[1].body) : null;
}

async function renderLoaded() {
  render(<DeliveryChallanAdd onSubmit={() => {}} onClose={() => {}} />);
  await waitFor(() => expect(screen.queryByText(/Loading retailer, godowns and products/i)).not.toBeInTheDocument());
}

async function pickPartyGodownAndProduct() {
  fireEvent.click(screen.getByText("Search retailers…"));
  fireEvent.mouseDown(await screen.findByText("City Pharmacy"));
  fireEvent.click(screen.getByText("Search godowns…"));
  fireEvent.mouseDown(await screen.findByText("Main Warehouse"));
}

async function pickProductOnItemsTab() {
  fireEvent.click(screen.getByText(/Items/));
  fireEvent.click(screen.getByText("Select product"));
  fireEvent.mouseDown(await screen.findByText("Paracetamol 500mg"));
}

describe("DeliveryChallanAdd — invoice settings stored on the challan", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi();
  });

  it("defaults to Simple / Credit with a due date, and shows no amount-paid field for credit", async () => {
    await renderLoaded();

    expect(screen.getByLabelText("Billing mode")).toHaveValue("CASH");
    expect(screen.getByLabelText("Payment type")).toHaveValue("CREDIT");
    expect(screen.getByLabelText("Due date").value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(screen.queryByLabelText("Amount paid")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Apply schemes automatically")).toBeChecked();
  });

  it("hides the due date for Paid and shows the amount paid field", async () => {
    await renderLoaded();

    fireEvent.change(screen.getByLabelText("Payment type"), { target: { value: "PAID" } });

    expect(screen.queryByLabelText("Due date")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Amount paid")).toBeInTheDocument();
  });

  it("POSTs the billing / payment settings and the per-line GST and scheme", async () => {
    await renderLoaded();
    await pickPartyGodownAndProduct();

    fireEvent.change(screen.getByLabelText("Billing mode"), { target: { value: "ONLINE" } });
    fireEvent.change(screen.getByLabelText("Payment type"), { target: { value: "PARTIAL" } });
    fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-11-30" } });
    fireEvent.change(screen.getByLabelText("Amount paid"), { target: { value: "40" } });
    fireEvent.change(screen.getByLabelText("Invoice discount"), { target: { value: "5" } });
    fireEvent.click(screen.getByLabelText("Apply schemes automatically"));

    await pickProductOnItemsTab();
    fireEvent.change(screen.getByLabelText("GST rate item 1"), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText("Scheme ID item 1"), { target: { value: "77" } });

    fireEvent.click(screen.getByRole("button", { name: /Save Delivery Challan/i }));

    await waitFor(() => expect(postedBody()).not.toBeNull());
    expect(postedBody()).toMatchObject({
      billingMode: "ONLINE",
      paymentType: "PARTIAL",
      dueDate: "2026-11-30",
      amountPaid: 40,
      totalDiscount: 5,
      autoApplySchemes: false,
      items: [{ productId: 101, quantity: 1, unitPrice: null, gstRate: 12, schemeId: 77 }],
    });
  });

  it("sends 18% GST, no scheme and a null due date for a Paid challan by default", async () => {
    await renderLoaded();
    await pickPartyGodownAndProduct();
    fireEvent.change(screen.getByLabelText("Payment type"), { target: { value: "PAID" } });
    await pickProductOnItemsTab();

    fireEvent.click(screen.getByRole("button", { name: /Save Delivery Challan/i }));

    await waitFor(() => expect(postedBody()).not.toBeNull());
    expect(postedBody()).toMatchObject({
      paymentType: "PAID",
      dueDate: null,
      items: [{ productId: 101, gstRate: 18, schemeId: null }],
    });
  });

  it("blocks saving a credit challan without a due date", async () => {
    await renderLoaded();
    await pickPartyGodownAndProduct();
    fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "" } });
    await pickProductOnItemsTab();

    fireEvent.click(screen.getByRole("button", { name: /Save Delivery Challan/i }));

    // the Details tab carries the error; nothing is posted
    fireEvent.click(screen.getByText("Details"));
    expect(await screen.findByText("Due date is required for credit / partial payment")).toBeInTheDocument();
    expect(postedBody()).toBeNull();
  });
});
