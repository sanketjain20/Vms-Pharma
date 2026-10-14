import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import FieldCollection from "./FieldCollection";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");

const json = (body, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 400, json: () => Promise.resolve(body) });


// Mirrors the server: filter by status, then return one page (page is 1-based).
function paged(rows, url) {
  const u = new URL(url, "http://x");
  const [, p, size] = u.pathname.match(/GetAllPaged\/(\d+)\/(\d+)/);
  const status = u.searchParams.get("status");
  const hit = rows.filter((r) => !status || r.status === status);
  const n = Number(size);
  return { content: hit.slice((p - 1) * n, p * n), totalElements: hit.length, totalPages: Math.ceil(hit.length / n), page: Number(p), size: n };
}
const ACCESS = { status: 200, data: ["View", "Add", "Edit", "Disable"] };

const row = (o = {}) => ({
  uKey: "c-1", clientCollectionId: "x-1", repName: "Ravi Rep", retailerId: 11, retailerName: "City Chemist", amount: 2500,
  paymentMode: "UPI", referenceNumber: "UPI123", note: "paid at the counter", collectedAt: "2026-09-28T16:30:00",
  createdAt: "2026-09-28T18:00:00", status: "SUBMITTED", rejectReason: null, retailerOutstanding: 12000, ...o,
});

function mockApi({ rows = [row()], actionResult = { status: 200, message: "ok" } } = {}) {
  apiClient.mockImplementation((url, options = {}) => {
    const method = options.method || "GET";
    if (url.includes("/api/Access/GetUserModuleAccess/")) return json(ACCESS);
    if (url.includes("/api/FieldCollection/GetAllPaged/")) return json({ status: 200, data: paged(rows, url) });
    if (url.includes("/api/FieldCollection/") && method !== "GET") return json(actionResult, actionResult.status === 200);
    return json({ status: 404, message: "unmocked " + url }, false);
  });
}

const callsTo = (fragment, method) =>
  apiClient.mock.calls.filter(([url, o]) => url.includes(fragment) && (!method || (o?.method || "GET") === method));

async function openFirst() {
  render(<FieldCollection />);
  const r = (await screen.findAllByText("Ravi Rep"))[0].closest("tr"); // several rows can share a rep
  fireEvent.click(await within(r).findByRole("button", { name: "Review" })); // shown once the permission lookup answers
  return screen.findByText("Retailer owes now");
}

describe("FieldCollection — list", () => {
  beforeEach(() => jest.clearAllMocks());

  it("lists collections with rep, retailer, amount, mode and reference, and what the retailer owes now", async () => {
    mockApi();
    render(<FieldCollection />);

    const r = (await screen.findByText("Ravi Rep")).closest("tr");
    expect(within(r).getByText("City Chemist")).toBeInTheDocument();
    expect(within(r).getByText("₹2,500.00")).toBeInTheDocument();
    expect(within(r).getByText("UPI · UPI123")).toBeInTheDocument();
    expect(within(r).getByText("₹12,000.00")).toBeInTheDocument();
    expect(within(r).getByText("Awaiting review")).toBeInTheDocument();
  });

  it("says how many are waiting and how much money that is", async () => {
    mockApi({ rows: [row(), row({ uKey: "c-2", amount: 500 }), row({ uKey: "c-3", status: "CONFIRMED", amount: 9000 })] });
    render(<FieldCollection />);

    expect(await screen.findByText(/2 awaiting review on this page \(₹3,000\.00\)/)).toBeInTheDocument(); // the confirmed 9,000 is not counted
  });

  it("filters by status through the server and closes an open review when the filter changes", async () => {
    mockApi({ rows: [row(), row({ uKey: "c-2", status: "REJECTED", retailerName: "Other Store" })] });
    await openFirst();

    fireEvent.click(screen.getByRole("tab", { name: "Rejected" }));

    await waitFor(() => expect(callsTo("/api/FieldCollection/GetAllPaged").some(([u]) => u.includes("status=REJECTED"))).toBe(true));
    expect(await screen.findByText("Other Store")).toBeInTheDocument();
    expect(screen.queryByText("Retailer owes now")).not.toBeInTheDocument();
  });

  it("shows an empty state", async () => {
    mockApi({ rows: [] });
    render(<FieldCollection />);
    expect(await screen.findByText("No collections found.")).toBeInTheDocument();
  });
});

describe("FieldCollection — review", () => {
  beforeEach(() => jest.clearAllMocks());

  it("confirming records the payment and says so", async () => {
    mockApi({ actionResult: { status: 200, message: "Payment confirmed and recorded." } });
    await openFirst();

    fireEvent.click(screen.getByRole("button", { name: "Confirm payment" }));

    await waitFor(() => expect(callsTo("/api/FieldCollection/Confirm/c-1", "PUT")).toHaveLength(1));
    expect(await screen.findByText("Payment confirmed and recorded.")).toBeInTheDocument();
  });

  it("warns, before confirming, when the amount is more than the retailer owes (the extra becomes an advance)", async () => {
    mockApi({ rows: [row({ amount: 15000, retailerOutstanding: 12000 })] });
    await openFirst();

    expect(screen.getByText(/₹3,000\.00 more than City Chemist currently owes/)).toBeInTheDocument();
    expect(screen.getByText(/kept as an advance payment/)).toBeInTheDocument();
  });

  it("shows no over-payment warning when the amount is within what is owed", async () => {
    mockApi();
    await openFirst();
    expect(screen.queryByText(/advance payment/)).not.toBeInTheDocument();
  });

  it("makes the office give a reason before rejecting", async () => {
    mockApi();
    await openFirst();

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    const confirm = screen.getByRole("button", { name: "Confirm reject" });
    expect(confirm).toBeDisabled();
    expect(callsTo("/api/FieldCollection/Reject")).toHaveLength(0);

    fireEvent.change(screen.getByLabelText("Rejection reason"), { target: { value: "Cash never reached us" } });
    fireEvent.click(confirm);

    await waitFor(() => expect(callsTo("/api/FieldCollection/Reject/c-1", "PUT")).toHaveLength(1));
    expect(JSON.parse(callsTo("/api/FieldCollection/Reject/c-1")[0][1].body)).toEqual({ reason: "Cash never reached us" });
    expect(await screen.findByText("Collection rejected.")).toBeInTheDocument();
  });

  it("shows the server's reason when booking fails, and keeps the review open to retry", async () => {
    mockApi({ actionResult: { status: 400, message: "Could not record the payment: Retailer not found" } });
    await openFirst();

    fireEvent.click(screen.getByRole("button", { name: "Confirm payment" }));

    expect(await screen.findByText(/Retailer not found/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm payment" })).toBeInTheDocument();
  });

  it("offers no actions on a decided collection, and shows why a rejected one was refused", async () => {
    mockApi({ rows: [row({ status: "REJECTED", rejectReason: "Cash never reached us" })] });
    await openFirst();

    expect(screen.getByText("Cash never reached us")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Confirm payment|Reject/ })).not.toBeInTheDocument();
  });

  it("shows the rep's note, mode and reference in the detail", async () => {
    mockApi();
    await openFirst();
    expect(screen.getByText("paid at the counter")).toBeInTheDocument();
    expect(screen.getByText("Reference")).toBeInTheDocument();
  });
});
