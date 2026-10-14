import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import FieldRep from "./FieldRep";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");

function json(body, ok = true) {
  return Promise.resolve({ ok, status: ok ? 200 : 400, json: () => Promise.resolve(body) });
}

const REPS = [
  { uKey: "rep-1", name: "Ravi Rep", email: "ravi@x.com", phone: "9999900000", disabled: false, retailerCount: 2 },
  { uKey: "rep-2", name: "Sita Rep", email: "sita@x.com", phone: null, disabled: true, retailerCount: 0 },
];
const BEAT = [
  { beatUKey: "b-1", retailerId: 11, retailerCode: "ACME-R001", shopName: "City Chemist", ownerName: "Mr Shah", phone: "111", visitDay: "MONDAY" },
];
const RETAILERS = [
  { id: 11, shopName: "City Chemist", ownerName: "Mr Shah" },
  { id: 12, shopName: "Metro Medicos", ownerName: "Mrs Rao" },
];
const VISITS = [
  { uKey: "v-1", repName: "Ravi Rep", retailerName: "City Chemist", latitude: 18.52043, longitude: 73.85674, accuracyM: 12.4, note: "restock", capturedAt: "2026-09-29T10:30:00" },
  { uKey: "v-2", repName: "Ravi Rep", retailerName: "Unplanned stop", latitude: 18.6, longitude: 73.9, accuracyM: null, note: null, capturedAt: "2026-09-29T12:00:00" },
];

const ALL_ACTIONS = ["View", "Add", "Edit", "Disable"];

function mockApi({ reps = REPS, beat = BEAT, addResult = { status: 200, message: "ok" }, visits = VISITS, actions = ALL_ACTIONS } = {}) {
  apiClient.mockImplementation((url, options = {}) => {
    const method = options.method || "GET";
    if (url.includes("/api/Access/GetUserModuleAccess/")) return json(actions.length ? { status: 200, data: actions } : { status: 403, message: "Access denied" });
    if (url.includes("/api/FieldRep/GetAll")) return json({ status: 200, data: reps });
    if (url.includes("/api/FieldRep/Add") && method === "POST") return json(addResult, addResult.status === 200);
    if (url.includes("/api/FieldRep/Toggle/")) return json({ status: 200, message: "Field rep disabled." });
    if (url.includes("/api/FieldRep/GetBeat/")) return json({ status: 200, data: beat });
    if (url.includes("/api/FieldRep/AssignBeat")) return json({ status: 200, message: "Retailer assigned to Ravi Rep." });
    if (url.includes("/api/FieldRep/RemoveBeat/")) return json({ status: 200, message: "Retailer removed from beat." });
    if (url.includes("/api/Retailer/Dropdown")) return json({ status: 200, data: RETAILERS });
    if (url.includes("/api/FieldRep/Visits")) return json({ status: 200, data: visits });
    return json({ status: 404, message: "unmocked " + url }, false);
  });
}

const callsTo = (fragment, method) =>
  apiClient.mock.calls.filter(([url, o]) => url.includes(fragment) && (!method || (o?.method || "GET") === method));

describe("FieldRep — reps", () => {
  beforeEach(() => jest.clearAllMocks());

  it("lists the reps with their beat size and active/disabled status", async () => {
    mockApi();
    render(<FieldRep />);

    expect(await screen.findByText("Ravi Rep")).toBeInTheDocument();
    const row = screen.getByText("Sita Rep").closest("tr");
    expect(within(row).getByText("Disabled")).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Enable" })).toBeInTheDocument();
    expect(within(screen.getByText("Ravi Rep").closest("tr")).getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("2 reps")).toBeInTheDocument();
  });

  it("shows a helpful empty state when there are no reps yet", async () => {
    mockApi({ reps: [] });
    render(<FieldRep />);

    expect(await screen.findByText(/No field reps yet/)).toBeInTheDocument();
  });

  it("won't submit a new rep without a name and email", async () => {
    mockApi();
    render(<FieldRep />);
    await screen.findByText("Ravi Rep");

    fireEvent.click(screen.getByRole("button", { name: "+ Add rep" }));
    fireEvent.click(screen.getByRole("button", { name: "Create rep" }));

    expect(screen.getByText("Name and email are required.")).toBeInTheDocument();
    expect(callsTo("/api/FieldRep/Add")).toHaveLength(0);
  });

  it("creates a rep, tells the user about the invite email, and refreshes the list", async () => {
    mockApi();
    render(<FieldRep />);
    await screen.findByText("Ravi Rep");

    fireEvent.click(screen.getByRole("button", { name: "+ Add rep" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New Rep" } });
    fireEvent.change(screen.getByLabelText("Email (their login)"), { target: { value: "new@x.com" } });
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "98765" } });
    fireEvent.click(screen.getByRole("button", { name: "Create rep" }));

    expect(await screen.findByText(/emailed a link to set their password/)).toBeInTheDocument();
    const [, options] = callsTo("/api/FieldRep/Add", "POST")[0];
    expect(JSON.parse(options.body)).toMatchObject({ name: "New Rep", email: "new@x.com", phone: "98765" });
    await waitFor(() => expect(callsTo("/api/FieldRep/GetAll").length).toBeGreaterThan(1));
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument(); // form closed
  });

  it("surfaces the server's reason when creating a rep fails (e.g. worker limit)", async () => {
    mockApi({ addResult: { status: 400, message: "Worker credential limit reached. Allowed: 2" } });
    render(<FieldRep />);
    await screen.findByText("Ravi Rep");

    fireEvent.click(screen.getByRole("button", { name: "+ Add rep" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "X" } });
    fireEvent.change(screen.getByLabelText("Email (their login)"), { target: { value: "x@x.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Create rep" }));

    expect(await screen.findByText("Worker credential limit reached. Allowed: 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument(); // form stays open so nothing typed is lost
  });

  it("disables an active rep and enables a disabled one", async () => {
    mockApi();
    render(<FieldRep />);
    await screen.findByText("Ravi Rep");

    fireEvent.click(within(screen.getByText("Ravi Rep").closest("tr")).getByRole("button", { name: "Disable" }));
    await waitFor(() => expect(callsTo("/api/FieldRep/Toggle/rep-1/true", "PUT")).toHaveLength(1));

    fireEvent.click(within(screen.getByText("Sita Rep").closest("tr")).getByRole("button", { name: "Enable" }));
    await waitFor(() => expect(callsTo("/api/FieldRep/Toggle/rep-2/false", "PUT")).toHaveLength(1));
  });
});

describe("FieldRep — beat", () => {
  beforeEach(() => jest.clearAllMocks());

  async function openBeatFor(name) {
    render(<FieldRep />);
    await screen.findByText(name);
    fireEvent.click(within(screen.getByText(name).closest("tr")).getByRole("button", { name: "Beat" }));
    return screen.findByText(`Beat for ${name}`);
  }

  it("shows the rep's retailers and only offers retailers not already on the beat", async () => {
    mockApi();
    await openBeatFor("Ravi Rep");

    expect(await screen.findByText("ACME-R001")).toBeInTheDocument();
    const picker = screen.getByLabelText("Retailer to add");
    const options = within(picker).getAllByRole("option").map((o) => o.textContent);
    expect(options.some((t) => t.includes("Metro Medicos"))).toBe(true);
    expect(options.some((t) => t.includes("City Chemist"))).toBe(false); // already on this beat
  });

  it("assigns a retailer with a visit day", async () => {
    mockApi();
    await openBeatFor("Ravi Rep");
    await screen.findByText("ACME-R001");

    fireEvent.change(screen.getByLabelText("Retailer to add"), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText("Visit day"), { target: { value: "FRIDAY" } });
    fireEvent.click(screen.getByRole("button", { name: "Add to beat" }));

    expect(await screen.findByText("Retailer assigned to Ravi Rep.")).toBeInTheDocument();
    const [, options] = callsTo("/api/FieldRep/AssignBeat", "POST")[0];
    expect(JSON.parse(options.body)).toEqual({ repUKey: "rep-1", retailerId: 12, visitDay: "FRIDAY" });
  });

  it("sends 'any day' as null and refuses to assign when no retailer is picked", async () => {
    mockApi();
    await openBeatFor("Ravi Rep");
    await screen.findByText("ACME-R001");

    fireEvent.click(screen.getByRole("button", { name: "Add to beat" }));
    expect(screen.getByText("Pick a retailer to add to this beat.")).toBeInTheDocument();
    expect(callsTo("/api/FieldRep/AssignBeat")).toHaveLength(0);

    fireEvent.change(screen.getByLabelText("Retailer to add"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Add to beat" }));
    await waitFor(() => expect(callsTo("/api/FieldRep/AssignBeat")).toHaveLength(1));
    expect(JSON.parse(callsTo("/api/FieldRep/AssignBeat")[0][1].body).visitDay).toBeNull();
  });

  it("removes a retailer from the beat", async () => {
    mockApi();
    await openBeatFor("Ravi Rep");
    await screen.findByText("ACME-R001");

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(callsTo("/api/FieldRep/RemoveBeat/b-1", "DELETE")).toHaveLength(1));
    expect(await screen.findByText("Retailer removed from beat.")).toBeInTheDocument();
  });
});

describe("FieldRep — visit history", () => {
  beforeEach(() => jest.clearAllMocks());

  it("lists check-ins with a map link, accuracy and unplanned stops labelled", async () => {
    mockApi();
    render(<FieldRep />);
    fireEvent.click(await screen.findByRole("tab", { name: "Visit History" }));

    expect(await screen.findByText("City Chemist")).toBeInTheDocument();
    expect(screen.getByText("Unplanned stop")).toBeInTheDocument();
    const link = screen.getByText("18.52043, 73.85674");
    expect(link.closest("a")).toHaveAttribute("href", "https://www.google.com/maps?q=18.52043,73.85674");
    expect(link.closest("a")).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(screen.getByText("±12 m")).toBeInTheDocument();
    expect(screen.getByText("2 visits")).toBeInTheDocument();
  });

  it("queries the last 7 days by default and re-queries when filtered to one rep", async () => {
    mockApi();
    render(<FieldRep />);
    fireEvent.click(await screen.findByRole("tab", { name: "Visit History" }));
    await screen.findByText("City Chemist");

    const first = callsTo("/api/FieldRep/Visits")[0][0];
    expect(first).toMatch(/from=\d{4}-\d{2}-\d{2}/);
    expect(first).toMatch(/to=\d{4}-\d{2}-\d{2}/);
    expect(first).not.toContain("repUKey");

    await waitFor(() => expect(within(screen.getByLabelText("Filter by rep")).getAllByRole("option").length).toBeGreaterThan(1));
    fireEvent.change(screen.getByLabelText("Filter by rep"), { target: { value: "rep-1" } });

    await waitFor(() => expect(callsTo("/api/FieldRep/Visits").some(([u]) => u.includes("repUKey=rep-1"))).toBe(true));
  });

  it("shows an empty state when there are no check-ins in the period", async () => {
    mockApi({ visits: [] });
    render(<FieldRep />);
    fireEvent.click(await screen.findByRole("tab", { name: "Visit History" }));

    expect(await screen.findByText("No check-ins in this period.")).toBeInTheDocument();
  });
});

describe("FieldRep — permissions", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows no add / enable / disable controls to a role that can only view", async () => {
    mockApi({ actions: ["View"] });
    render(<FieldRep />);
    await screen.findByText("Ravi Rep");
    await waitFor(() => expect(callsTo("/api/Access/GetUserModuleAccess/31")).toHaveLength(1));
    expect(screen.queryByRole("button", { name: "+ Add rep" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Disable" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enable" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Beat" })).toHaveLength(2); // viewing a beat is still allowed
  });

  it("hides beat editing from a role without Add / Disable", async () => {
    mockApi({ actions: ["View"] });
    render(<FieldRep />);
    await screen.findByText("Ravi Rep");
    fireEvent.click(screen.getAllByRole("button", { name: "Beat" })[0]);
    await screen.findByText("ACME-R001");
    expect(screen.queryByRole("button", { name: "Add to beat" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  });
});

describe("FieldRep — search and pagination", () => {
  beforeEach(() => jest.clearAllMocks());

  const manyReps = Array.from({ length: 23 }, (_, i) => ({ uKey: "r-" + i, name: "Rep " + String(i).padStart(2, "0"), email: `rep${i}@x.com`, phone: null, disabled: false, retailerCount: 1 }));

  it("shows one page of reps and moves between pages", async () => {
    mockApi({ reps: manyReps });
    render(<FieldRep />);
    await screen.findByText("Rep 00");
    expect(screen.getByText("23 reps")).toBeInTheDocument();
    expect(screen.queryByText("Rep 10")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Page 3" }));
    expect(await screen.findByText("Rep 20")).toBeInTheDocument();
    expect(screen.queryByText("Rep 00")).not.toBeInTheDocument();
  });

  it("searches the reps by name, email or phone", async () => {
    mockApi({ reps: manyReps });
    render(<FieldRep />);
    await screen.findByText("Rep 00");
    fireEvent.change(screen.getByLabelText("Search field reps"), { target: { value: "rep17@" } });
    expect(await screen.findByText("Rep 17")).toBeInTheDocument();
    expect(screen.queryByText("Rep 00")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search field reps"), { target: { value: "zzz" } });
    expect(await screen.findByText("No reps match your search.")).toBeInTheDocument();
  });

  it("pages and searches visit history too", async () => {
    const visits = Array.from({ length: 12 }, (_, i) => ({ uKey: "v" + i, repName: "Ravi Rep", retailerName: "Shop " + String(i).padStart(2, "0"), latitude: 18.5, longitude: 73.8, accuracyM: 5, note: null, capturedAt: "2026-09-29T10:30:00" }));
    mockApi({ visits });
    render(<FieldRep />);
    fireEvent.click(await screen.findByRole("tab", { name: "Visit History" }));
    await screen.findByText("Shop 00");
    expect(screen.queryByText("Shop 11")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Page 2" }));
    expect(await screen.findByText("Shop 11")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search visits"), { target: { value: "shop 03" } });
    expect(await screen.findByText("Shop 03")).toBeInTheDocument();
    expect(screen.queryByText("Shop 11")).not.toBeInTheDocument();
  });
});
