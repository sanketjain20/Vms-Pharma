import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import FieldCollection from "./FieldCollection";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");

function json(body, ok = true) {
  return Promise.resolve({ ok, status: ok ? 200 : 400, json: () => Promise.resolve(body) });
}

const collection = (o = {}) => ({
  uKey: "c-1", clientCollectionId: "cc-1", repName: "Ravi Rep", retailerId: 11, retailerName: "City Chemist", amount: 500,
  paymentMode: "CASH", referenceNumber: null, note: null, collectedAt: "2026-09-30T10:00:00", createdAt: "2026-09-30T11:00:00",
  status: "SUBMITTED", rejectReason: null, retailerOutstanding: 800, invoiceId: null, invoiceNumber: null, handedOver: false, ...o,
});

const handover = (o = {}) => ({
  uKey: "h-1", clientHandoverId: "ch-1", repName: "Ravi Rep", expectedCash: 500, cashCounted: 500, difference: 0, collectionsCount: 1,
  note: null, closedAt: "2026-09-30T18:00:00", createdAt: "2026-09-30T18:05:00", status: "SUBMITTED", officeNote: null, items: [], ...o,
});

const ALL_ACTIONS = ["View", "Add", "Edit", "Disable"];

function page(rows, url, fields) {
  const u = new URL(url, "http://x");
  const [, p, size] = u.pathname.match(/GetAllPaged\/(\d+)\/(\d+)/);
  const status = u.searchParams.get("status");
  const search = (u.searchParams.get("search") || "").toLowerCase();
  const hit = rows.filter((r) => (!status || r.status === status) && (!search || fields.some((f) => String(r[f] || "").toLowerCase().includes(search))));
  const n = Number(size);
  return { content: hit.slice((p - 1) * n, p * n), totalElements: hit.length, totalPages: Math.ceil(hit.length / n), page: Number(p), size: n };
}

function mockApi({ collections = [collection()], handovers = [handover()], actions = ALL_ACTIONS, decision = { status: 200, message: "ok" } } = {}) {
  apiClient.mockImplementation((url, options = {}) => {
    const method = options.method || "GET";
    if (url.includes("/api/Access/GetUserModuleAccess/")) return json(actions.length ? { status: 200, data: actions } : { status: 403, message: "Access denied" });
    if (url.includes("/api/FieldCollection/GetAllPaged/")) return json({ status: 200, data: page(collections, url, ["repName", "retailerName", "referenceNumber", "invoiceNumber"]) });
    if (url.includes("/api/FieldHandover/GetAllPaged/")) return json({ status: 200, data: page(handovers, url, ["repName", "note"]) });
    if (method !== "GET") return json(decision, decision.status === 200);
    return json({ status: 404, message: "unmocked " + url }, false);
  });
}

const callsTo = (fragment, method) =>
  apiClient.mock.calls.filter(([url, o]) => url.includes(fragment) && (!method || (o?.method || "GET") === method));

describe("FieldCollection — payments", () => {
  beforeEach(() => jest.clearAllMocks());

  it("lists collections from the paged endpoint and lets a permitted user review one", async () => {
    mockApi();
    render(<FieldCollection />);

    const row = (await screen.findByText("City Chemist")).closest("tr");
    fireEvent.click(await within(row).findByRole("button", { name: "Review" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm payment" }));

    await waitFor(() => expect(callsTo("/api/FieldCollection/Confirm/c-1", "PUT")).toHaveLength(1));
    expect(callsTo("/api/FieldCollection/GetAll/")).toHaveLength(0);
  });

  it("shows no Review button, and no way into the review, for a role without Confirm / Reject", async () => {
    mockApi({ actions: ["View"] });
    render(<FieldCollection />);

    const row = (await screen.findByText("City Chemist")).closest("tr");
    await waitFor(() => expect(callsTo("/api/Access/GetUserModuleAccess/33")).toHaveLength(1));
    expect(within(row).queryByRole("button", { name: "Review" })).not.toBeInTheDocument();
    fireEvent.click(row);
    expect(screen.queryByRole("button", { name: "Confirm payment" })).not.toBeInTheDocument();
  });

  it("filters by status through the server", async () => {
    mockApi({ collections: [collection(), collection({ uKey: "c-2", retailerName: "Metro", status: "CONFIRMED" })] });
    render(<FieldCollection />);
    await screen.findByText("City Chemist");
    fireEvent.click(screen.getByRole("tab", { name: "Confirmed" }));
    await waitFor(() => expect(screen.queryByText("City Chemist")).not.toBeInTheDocument());
    expect(screen.getByText("Metro")).toBeInTheDocument();
    expect(callsTo("/api/FieldCollection/GetAllPaged/1/10").some(([u]) => u.includes("status=CONFIRMED"))).toBe(true);
  });

  it("pages and searches on the server", async () => {
    const rows = Array.from({ length: 23 }, (_, i) => collection({ uKey: "c-" + i, retailerName: "Shop " + String(i).padStart(2, "0"), referenceNumber: "REF" + i }));
    mockApi({ collections: rows });
    render(<FieldCollection />);
    await screen.findByText("Shop 00");
    expect(screen.getByText("23 collections")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(11);

    fireEvent.click(screen.getByRole("button", { name: "Page 3" }));
    expect(await screen.findByText("Shop 20")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(4);

    fireEvent.change(screen.getByLabelText("Search field collections"), { target: { value: "ref7" } });
    expect(await screen.findByText("Shop 07")).toBeInTheDocument();
    expect(screen.queryByText("Shop 20")).not.toBeInTheDocument();
    await waitFor(() => expect(callsTo("/api/FieldCollection/GetAllPaged/1/10").some(([u]) => u.includes("search=ref7"))).toBe(true));
  });
});

describe("FieldCollection — cash handovers", () => {
  beforeEach(() => jest.clearAllMocks());

  const openHandovers = async () => {
    render(<FieldCollection />);
    fireEvent.click(await screen.findByRole("tab", { name: "Cash handovers" }));
  };

  it("lists day-closes from the paged endpoint", async () => {
    mockApi();
    await openHandovers();
    expect(await screen.findByText("1 day-close")).toBeInTheDocument();
    expect(callsTo("/api/FieldHandover/GetAllPaged/1/10")).toHaveLength(1);
  });

  it("hides Review from a role without Confirm / Reject", async () => {
    mockApi({ actions: ["View"] });
    await openHandovers();
    const row = (await screen.findByText("Ravi Rep")).closest("tr");
    expect(within(row).queryByRole("button", { name: "Review" })).not.toBeInTheDocument();
  });

  it("pages and searches the handovers", async () => {
    const rows = Array.from({ length: 12 }, (_, i) => handover({ uKey: "h-" + i, repName: "Rep " + String(i).padStart(2, "0") }));
    mockApi({ handovers: rows });
    await openHandovers();
    await screen.findByText("Rep 00");
    expect(screen.getAllByRole("row")).toHaveLength(11);
    fireEvent.click(screen.getByRole("button", { name: "Page 2" }));
    expect(await screen.findByText("Rep 11")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search cash handovers"), { target: { value: "rep 03" } });
    expect(await screen.findByText("Rep 03")).toBeInTheDocument();
  });
});
