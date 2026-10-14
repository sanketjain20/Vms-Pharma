import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import FieldOrder from "./FieldOrder";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");

function json(body, ok = true) {
  return Promise.resolve({ ok, status: ok ? 200 : 400, json: () => Promise.resolve(body) });
}

function order(overrides = {}) {
  return {
    uKey: "o-1",
    orderNumber: "FO-ACME-20260930-AAA111",
    repName: "Ravi Rep",
    retailerId: 55,
    retailerName: "City Chemist",
    status: "SUBMITTED",
    hasConflict: true,
    totalAmount: 150,
    capturedAt: "2026-09-30T09:00:00",
    createdAt: "2026-09-30T11:00:00",
    remarks: "Deliver Monday",
    rejectReason: null,
    convertedSalesId: null,
    items: [
      { id: 1, productId: 10, productName: "Paracetamol", quantity: 4, quotedPrice: 25, currentPrice: 30, availableQty: 100, conflictReason: "PRICE_CHANGED" },
      { id: 2, productId: 11, productName: "Amoxicillin", quantity: 5, quotedPrice: 10, currentPrice: 10, availableQty: 2, conflictReason: "STOCK_SHORT" },
      { id: 3, productId: 12, productName: "Cough Syrup", quantity: 1, quotedPrice: 5, currentPrice: 5, availableQty: 50, conflictReason: null },
    ],
    ...overrides,
  };
}

const ALL_ACTIONS = ["View", "Add", "Edit", "Disable"];

// Mirrors the server: filters by status and search, then returns one page (page is 1-based).
function paged(orders, url) {
  const u = new URL(url, "http://x");
  const [, page, size] = u.pathname.match(/GetAllPaged\/(\d+)\/(\d+)/);
  const status = u.searchParams.get("status");
  const search = (u.searchParams.get("search") || "").toLowerCase();
  const rows = orders.filter((o) => (!status || o.status === status)
    && (!search || [o.orderNumber, o.repName, o.retailerName].some((t) => t.toLowerCase().includes(search))));
  const n = Number(size);
  return { content: rows.slice((page - 1) * n, page * n), totalElements: rows.length, totalPages: Math.ceil(rows.length / n), page: Number(page), size: n };
}

function mockApi({ orders = [order()], actionResult = { status: 200, message: "ok" }, actions = ALL_ACTIONS } = {}) {
  apiClient.mockImplementation((url, options = {}) => {
    const method = options.method || "GET";
    if (url.includes("/api/Access/GetUserModuleAccess/")) return json(actions.length ? { status: 200, data: actions } : { status: 403, message: "Access denied" });
    if (url.includes("/api/FieldOrder/GetAllPaged/")) return json({ status: 200, data: paged(orders, url) });
    if (url.includes("/api/FieldOrder/") && method !== "GET") return json(actionResult, actionResult.status === 200);
    return json({ status: 404, message: "unmocked " + url }, false);
  });
}

const callsTo = (fragment, method) =>
  apiClient.mock.calls.filter(([url, o]) => url.includes(fragment) && (!method || (o?.method || "GET") === method));

async function openFirstOrder() {
  render(<FieldOrder />);
  const row = (await screen.findByText("FO-ACME-20260930-AAA111")).closest("tr");
  fireEvent.click(await within(row).findByRole("button", { name: "Review" }));
  return screen.findByText("Rep quoted");
}

describe("FieldOrder — list", () => {
  beforeEach(() => jest.clearAllMocks());

  it("lists orders with rep, retailer, total and a 'needs a look' flag on conflicted ones awaiting review", async () => {
    mockApi({ orders: [order(), order({ uKey: "o-2", orderNumber: "FO-2", status: "APPROVED", hasConflict: true })] });
    render(<FieldOrder />);

    const row = (await screen.findByText("FO-ACME-20260930-AAA111")).closest("tr");
    expect(within(row).getByText("Ravi Rep")).toBeInTheDocument();
    expect(within(row).getByText("City Chemist")).toBeInTheDocument();
    expect(within(row).getByText("Awaiting review")).toBeInTheDocument();
    expect(within(row).getByText("Needs a look")).toBeInTheDocument();

    // an already-approved order no longer needs the flag
    const approved = screen.getByText("FO-2").closest("tr");
    expect(within(approved).queryByText("Needs a look")).not.toBeInTheDocument();
  });

  it("filters by status through the server, and clears an open review when the filter changes", async () => {
    mockApi({ orders: [order(), order({ uKey: "o-2", orderNumber: "FO-2", status: "REJECTED", hasConflict: false })] });
    await openFirstOrder();
    expect(screen.getByText("Rep quoted")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Rejected" }));

    await waitFor(() => expect(callsTo("/api/FieldOrder/GetAllPaged").some(([u]) => u.includes("status=REJECTED"))).toBe(true));
    expect(await screen.findByText("FO-2")).toBeInTheDocument();
    expect(screen.queryByText("FO-ACME-20260930-AAA111")).not.toBeInTheDocument();
    expect(screen.queryByText("Rep quoted")).not.toBeInTheDocument();
  });

  it("shows an empty state", async () => {
    mockApi({ orders: [] });
    render(<FieldOrder />);
    expect(await screen.findByText("No field orders found.")).toBeInTheDocument();
  });
});

describe("FieldOrder — review", () => {
  beforeEach(() => jest.clearAllMocks());

  it("spells out what changed on each line: price moved, short stock, clean", async () => {
    mockApi();
    await openFirstOrder();

    expect(screen.getByText(/Some lines changed since the rep quoted them/)).toBeInTheDocument();
    const paracetamol = screen.getByText("Paracetamol").closest("tr");
    expect(within(paracetamol).getByText("Price changed")).toBeInTheDocument();
    expect(paracetamol).toHaveClass("fr-conflict-row");
    expect(within(paracetamol).getByText("₹30.00")).toHaveClass("fr-changed");

    const amox = screen.getByText("Amoxicillin").closest("tr");
    expect(within(amox).getByText("Not enough stock")).toBeInTheDocument();
    expect(within(amox).getByText("2")).toHaveClass("fr-short"); // 5 ordered vs 2 in stock

    const syrup = screen.getByText("Cough Syrup").closest("tr");
    expect(syrup).not.toHaveClass("fr-conflict-row");
    expect(screen.getByText("Deliver Monday")).toBeInTheDocument();
  });

  it("approves as-is with no adjustments when nothing was edited", async () => {
    mockApi();
    await openFirstOrder();

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(callsTo("/api/FieldOrder/Approve/o-1", "PUT")).toHaveLength(1));
    expect(JSON.parse(callsTo("/api/FieldOrder/Approve/o-1")[0][1].body)).toEqual({ adjustments: [] });
    expect(await screen.findByText("Order approved.")).toBeInTheDocument();
  });

  it("sends only the lines whose quantity was changed, and updates the quoted total live", async () => {
    mockApi();
    await openFirstOrder();
    const totalLine = () => screen.getByText(/Order total at the rep's quoted prices/);
    expect(totalLine()).toHaveTextContent("₹155.00"); // 4*25 + 5*10 + 1*5

    fireEvent.change(screen.getByLabelText("Quantity for Amoxicillin"), { target: { value: "2" } });
    expect(totalLine()).toHaveTextContent("₹125.00"); // 4*25 + 2*10 + 1*5

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(callsTo("/api/FieldOrder/Approve/o-1", "PUT")).toHaveLength(1));
    expect(JSON.parse(callsTo("/api/FieldOrder/Approve/o-1")[0][1].body)).toEqual({ adjustments: [{ itemId: 2, quantity: 2 }] });
  });

  it("blocks approval while any quantity is below 1", async () => {
    mockApi();
    await openFirstOrder();

    fireEvent.change(screen.getByLabelText("Quantity for Paracetamol"), { target: { value: "0" } });

    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Quantity for Paracetamol"), { target: { value: "" } });
    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
  });

  it("makes the user give a reason before rejecting", async () => {
    mockApi();
    await openFirstOrder();

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    const confirm = screen.getByRole("button", { name: "Confirm reject" });
    expect(confirm).toBeDisabled();
    expect(callsTo("/api/FieldOrder/Reject")).toHaveLength(0);

    fireEvent.change(screen.getByLabelText("Rejection reason"), { target: { value: "Over credit limit" } });
    expect(confirm).not.toBeDisabled();
    fireEvent.click(confirm);

    await waitFor(() => expect(callsTo("/api/FieldOrder/Reject/o-1", "PUT")).toHaveLength(1));
    expect(JSON.parse(callsTo("/api/FieldOrder/Reject/o-1")[0][1].body)).toEqual({ reason: "Over credit limit" });
    expect(await screen.findByText("Order rejected.")).toBeInTheDocument();
  });

  it("shows the server's message and keeps the review open when an action fails", async () => {
    mockApi({ actionResult: { status: 400, message: "Only SUBMITTED orders can be approved (this one is APPROVED)." } });
    await openFirstOrder();

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    expect(await screen.findByText(/Only SUBMITTED orders can be approved/)).toBeInTheDocument();
    expect(screen.getByText("Rep quoted")).toBeInTheDocument();
  });
});

describe("FieldOrder — convert", () => {
  beforeEach(() => jest.clearAllMocks());

  const approved = () => order({ status: "APPROVED", hasConflict: false });

  it("only offers Convert (and Reject) on an approved order, not Approve or editable quantities", async () => {
    mockApi({ orders: [approved()] });
    await openFirstOrder();

    expect(screen.getByRole("button", { name: "Convert to sale" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Quantity for Paracetamol")).not.toBeInTheDocument();
  });

  it("converts with a numeric GST rate (default 18) and no due date unless one is chosen", async () => {
    mockApi({ orders: [approved()], actionResult: { status: 200, message: "Converted to sale INV-0777." } });
    await openFirstOrder();

    expect(screen.getByLabelText("GST %")).toHaveValue(18);
    fireEvent.click(screen.getByRole("button", { name: "Convert to sale" }));

    await waitFor(() => expect(callsTo("/api/FieldOrder/Convert/o-1", "POST")).toHaveLength(1));
    expect(JSON.parse(callsTo("/api/FieldOrder/Convert/o-1")[0][1].body)).toEqual({ gstRate: 18, dueDate: null });
    expect(await screen.findByText("Converted to sale INV-0777.")).toBeInTheDocument();
  });

  it("passes an edited GST rate and a chosen due date through", async () => {
    mockApi({ orders: [approved()] });
    await openFirstOrder();

    fireEvent.change(screen.getByLabelText("GST %"), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText(/Due date/), { target: { value: "2026-11-15" } });
    fireEvent.click(screen.getByRole("button", { name: "Convert to sale" }));

    await waitFor(() => expect(callsTo("/api/FieldOrder/Convert/o-1", "POST")).toHaveLength(1));
    expect(JSON.parse(callsTo("/api/FieldOrder/Convert/o-1")[0][1].body)).toEqual({ gstRate: 12, dueDate: "2026-11-15" });
  });

  it("surfaces a sale failure (e.g. insufficient stock) so the office can fix it and retry", async () => {
    mockApi({ orders: [approved()], actionResult: { status: 400, message: "Could not create the sale: Insufficient stock" } });
    await openFirstOrder();

    fireEvent.click(screen.getByRole("button", { name: "Convert to sale" }));

    expect(await screen.findByText(/Insufficient stock/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Convert to sale" })).toBeInTheDocument(); // still there to retry
  });

  it("offers no actions on a converted or rejected order and shows why", async () => {
    mockApi({ orders: [order({ status: "CONVERTED", hasConflict: false, convertedSalesId: 777 })] });
    await openFirstOrder();
    expect(screen.getByText("#777")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Approve|Reject|Convert to sale/ })).not.toBeInTheDocument();
  });

  it("shows a rejected order's reason and offers no actions", async () => {
    mockApi({ orders: [order({ status: "REJECTED", hasConflict: false, rejectReason: "Over credit limit" })] });
    await openFirstOrder();
    expect(screen.getByText("Over credit limit")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Approve|Reject|Convert to sale/ })).not.toBeInTheDocument();
  });
});

describe("FieldOrder — permissions", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows no Review button, and opens nothing on row click, for a role without the Approve / Reject permission", async () => {
    mockApi({ actions: ["View"] });
    render(<FieldOrder />);

    const row = (await screen.findByText("FO-ACME-20260930-AAA111")).closest("tr");
    await waitFor(() => expect(callsTo("/api/Access/GetUserModuleAccess/32")).toHaveLength(1));
    expect(within(row).queryByRole("button", { name: "Review" })).not.toBeInTheDocument();

    fireEvent.click(row);
    expect(screen.queryByText("Rep quoted")).not.toBeInTheDocument();
  });

  it("shows no Review button while the permission lookup has not answered, so it never flashes up", async () => {
    apiClient.mockImplementation((url) => {
      if (url.includes("/api/Access/GetUserModuleAccess/")) return new Promise(() => {}); // never answers
      if (url.includes("/api/FieldOrder/GetAllPaged/")) return json({ status: 200, data: paged([order()], url) });
      return json({ status: 404 }, false);
    });
    render(<FieldOrder />);
    const row = (await screen.findByText("FO-ACME-20260930-AAA111")).closest("tr");
    expect(within(row).queryByRole("button", { name: "Review" })).not.toBeInTheDocument();
  });

  it("hides Convert to sale from a role that may approve but not convert", async () => {
    mockApi({ orders: [order({ status: "APPROVED", hasConflict: false })], actions: ["View", "Edit"] });
    await openFirstOrder();
    expect(screen.queryByRole("button", { name: "Convert to sale" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
  });
});

describe("FieldOrder — pagination and search", () => {
  beforeEach(() => jest.clearAllMocks());

  const many = (n) => Array.from({ length: n }, (_, i) => order({ uKey: "o-" + i, orderNumber: "FO-" + String(i).padStart(3, "0"), hasConflict: false }));

  it("asks the server for one page at a time, never the whole list", async () => {
    mockApi({ orders: many(25) });
    render(<FieldOrder />);
    await screen.findByText("FO-000");
    expect(screen.getAllByRole("row")).toHaveLength(11); // header + 10 rows
    expect(screen.getByText("25 orders")).toBeInTheDocument();
    expect(callsTo("/api/FieldOrder/GetAllPaged/1/10")).toHaveLength(1);
    expect(callsTo("/api/FieldOrder/GetAll/")).toHaveLength(0);
  });

  it("moves between pages", async () => {
    mockApi({ orders: many(25) });
    render(<FieldOrder />);
    await screen.findByText("FO-000");

    fireEvent.click(screen.getByRole("button", { name: "Page 3" }));
    expect(await screen.findByText("FO-020")).toBeInTheDocument();
    expect(screen.queryByText("FO-000")).not.toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(6); // header + the last 5

    fireEvent.click(screen.getByRole("button", { name: "Prev" }));
    expect(await screen.findByText("FO-010")).toBeInTheDocument();
  });

  it("hides the pager when everything fits on one page", async () => {
    mockApi({ orders: many(3) });
    render(<FieldOrder />);
    await screen.findByText("FO-000");
    expect(screen.queryByRole("navigation", { name: "Field orders pages" })).not.toBeInTheDocument();
  });

  it("searches on the server and starts again from page 1", async () => {
    mockApi({ orders: [...many(25), order({ uKey: "o-x", orderNumber: "FO-SPECIAL", retailerName: "Zed Pharma", hasConflict: false })] });
    render(<FieldOrder />);
    await screen.findByText("FO-000");
    fireEvent.click(screen.getByRole("button", { name: "Page 2" }));
    await screen.findByText("FO-010");

    fireEvent.change(screen.getByLabelText("Search field orders"), { target: { value: "zed" } });

    expect(await screen.findByText("FO-SPECIAL")).toBeInTheDocument();
    expect(screen.queryByText("FO-010")).not.toBeInTheDocument();
    await waitFor(() => expect(callsTo("/api/FieldOrder/GetAllPaged/1/10").some(([u]) => u.includes("search=zed"))).toBe(true));
  });

  it("says so when nothing matches", async () => {
    mockApi({ orders: many(3) });
    render(<FieldOrder />);
    await screen.findByText("FO-000");
    fireEvent.change(screen.getByLabelText("Search field orders"), { target: { value: "nothing-like-this" } });
    expect(await screen.findByText("No field orders found.")).toBeInTheDocument();
  });
});
