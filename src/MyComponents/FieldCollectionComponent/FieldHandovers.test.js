import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import FieldCollection from "./FieldCollection";
import { diffText } from "./FieldHandovers";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");

const json = (body, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 400, json: () => Promise.resolve(body) });

const handover = (o = {}) => ({
  uKey: "h-1", clientHandoverId: "x", repName: "Ravi Rep", expectedCash: 1000, cashCounted: 900, difference: -100, collectionsCount: 2,
  note: "one retailer short-paid", closedAt: "2026-10-03T18:00:00", createdAt: "2026-10-03T18:01:00", status: "SUBMITTED", officeNote: null,
  items: [{ retailerName: "City Chemist", amount: 600, collectedAt: "2026-10-03T10:00:00" }, { retailerName: "Metro Medicos", amount: 400, collectedAt: "2026-10-03T12:00:00" }], ...o,
});

const collection = (o = {}) => ({
  uKey: "c-1", clientCollectionId: "x-1", repName: "Ravi Rep", retailerId: 11, retailerName: "City Chemist", amount: 2500,
  paymentMode: "CASH", referenceNumber: null, note: null, collectedAt: "2026-09-28T16:30:00", createdAt: "2026-09-28T18:00:00",
  status: "SUBMITTED", rejectReason: null, retailerOutstanding: 12000, invoiceId: null, invoiceNumber: null, handedOver: false, ...o,
});


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

function mockApi({ handovers = [handover()], collections = [collection()], actionResult = { status: 200, message: "ok" } } = {}) {
  apiClient.mockImplementation((url, options = {}) => {
    const method = options.method || "GET";
    if (url.includes("/api/Access/GetUserModuleAccess/")) return json(ACCESS);
    if (url.includes("/api/FieldHandover/GetAllPaged/")) return json({ status: 200, data: paged(handovers, url) });
    if (url.includes("/api/FieldHandover/") && method !== "GET") return json(actionResult, actionResult.status === 200);
    if (url.includes("/api/FieldCollection/GetAllPaged/")) return json({ status: 200, data: paged(collections, url) });
    return json({ status: 404, message: "unmocked " + url }, false);
  });
}

const callsTo = (fragment, method) =>
  apiClient.mock.calls.filter(([url, o]) => url.includes(fragment) && (!method || (o?.method || "GET") === method));

async function openHandovers() {
  render(<FieldCollection />);
  fireEvent.click(await screen.findByRole("tab", { name: "Cash handovers" }));
  return screen.findByText("Cash handed in by your field reps");
}

async function reviewFirst() {
  await openHandovers();
  const r = (await screen.findAllByText("Ravi Rep"))[0].closest("tr");
  fireEvent.click(await within(r).findByRole("button", { name: "Review" }));
  return screen.findByLabelText("Collections in this handover");
}

beforeEach(() => jest.clearAllMocks());

describe("diffText", () => {
  it("reads as matches, short or extra", () => {
    expect(diffText(0)).toBe("Matches");
    expect(diffText(-100)).toBe("Short ₹100.00");
    expect(diffText(50.5)).toBe("Extra ₹50.50");
    expect(diffText(null)).toBe("Matches");
  });
});

describe("FieldCollection — payments tab shows the invoice", () => {
  it("shows which invoice a collection is against, or the account", async () => {
    mockApi({ collections: [collection({ invoiceNumber: "INV-7" }), collection({ uKey: "c-2", retailerName: "Other Store" })] });
    render(<FieldCollection />);
    const a = (await screen.findByText("City Chemist")).closest("tr");
    expect(within(a).getByText("Invoice INV-7")).toBeInTheDocument();
    const b = screen.getByText("Other Store").closest("tr");
    expect(within(b).getByText("Account")).toBeInTheDocument();
  });

  it("the review panel says whether the cash was handed in", async () => {
    mockApi();
    render(<FieldCollection />);
    fireEvent.click(await within((await screen.findByText("City Chemist")).closest("tr")).findByRole("button", { name: "Review" }));
    expect(await screen.findByText("Cash handed in")).toBeInTheDocument();
    expect(screen.getByText("Not yet")).toBeInTheDocument();
  });
});

describe("FieldCollection — cash handovers", () => {
  it("lists day-closes with recorded vs handed-in cash and the shortfall", async () => {
    mockApi();
    await openHandovers();
    const r = (await screen.findByText("Ravi Rep")).closest("tr");
    expect(within(r).getByText("₹1,000.00")).toBeInTheDocument();
    expect(within(r).getByText("₹900.00")).toBeInTheDocument();
    expect(within(r).getByText("Short ₹100.00")).toBeInTheDocument();
    expect(within(r).getByText("Awaiting you")).toBeInTheDocument();
  });

  it("says how many are waiting and how much cash that is", async () => {
    mockApi({ handovers: [handover(), handover({ uKey: "h-2", cashCounted: 500, expectedCash: 500, difference: 0 }), handover({ uKey: "h-3", status: "RECEIVED", cashCounted: 9000 })] });
    await openHandovers();
    expect(await screen.findByText(/2 awaiting you on this page \(₹1,400\.00\)/)).toBeInTheDocument();
  });

  it("filters by status through the server", async () => {
    mockApi({ handovers: [handover(), handover({ uKey: "h-2", status: "FLAGGED", repName: "Sita Rep" })] });
    await openHandovers();
    fireEvent.click(screen.getByRole("button", { name: "Flagged" }));
    await waitFor(() => expect(callsTo("/api/FieldHandover/GetAllPaged").some(([u]) => u.includes("status=FLAGGED"))).toBe(true));
    expect(await screen.findByText("Sita Rep")).toBeInTheDocument();
    expect(screen.queryByText("Ravi Rep")).not.toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    mockApi({ handovers: [] });
    await openHandovers();
    expect(await screen.findByText("No cash handovers found.")).toBeInTheDocument();
  });

  it("opens the collections inside a day-close, and warns about a shortage before it is received", async () => {
    mockApi();
    const table = within(await reviewFirst());
    expect(table.getByText("City Chemist")).toBeInTheDocument();
    expect(table.getByText("₹400.00")).toBeInTheDocument();
    expect(screen.getByText(/handed in ₹100\.00 less than they recorded/)).toBeInTheDocument();
    expect(screen.getByText("one retailer short-paid")).toBeInTheDocument();
  });

  it("marks a handover received and reloads", async () => {
    mockApi();
    await reviewFirst();
    fireEvent.click(screen.getByRole("button", { name: "Mark received" }));
    await waitFor(() => expect(callsTo("/api/FieldHandover/Receive/h-1", "PUT")).toHaveLength(1));
    expect(await screen.findByText("Marked as received.")).toBeInTheDocument();
    expect(callsTo("/api/FieldHandover/GetAllPaged").length).toBeGreaterThan(1);
  });

  it("will not flag without a reason, then sends it", async () => {
    mockApi();
    await reviewFirst();
    fireEvent.click(screen.getByRole("button", { name: "Flag a problem" }));
    const confirm = screen.getByRole("button", { name: "Confirm flag" });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Flag reason"), { target: { value: "Notes were short" } });
    fireEvent.click(confirm);
    await waitFor(() => expect(callsTo("/api/FieldHandover/Flag/h-1", "PUT")).toHaveLength(1));
    expect(JSON.parse(callsTo("/api/FieldHandover/Flag/h-1", "PUT")[0][1].body)).toEqual({ note: "Notes were short" });
  });

  it("shows the server's message when the action is refused", async () => {
    mockApi({ actionResult: { status: 409, message: "This handover was already decided." } });
    await reviewFirst();
    fireEvent.click(screen.getByRole("button", { name: "Mark received" }));
    expect(await screen.findByText("This handover was already decided.")).toBeInTheDocument();
  });

  it("offers no actions once it has been decided, and shows the office's note", async () => {
    mockApi({ handovers: [handover({ status: "FLAGGED", officeNote: "Recount tomorrow" })] });
    await reviewFirst();
    expect(screen.queryByRole("button", { name: "Mark received" })).not.toBeInTheDocument();
    expect(screen.getByText("Recount tomorrow")).toBeInTheDocument();
  });
});
