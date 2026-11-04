import fs from "fs";
import path from "path";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DynamicGrid, { tabColorOf, cardStatus } from "./DynamicGrid";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("../../Config/api.config", () => ({ __esModule: true, default: "http://api" }));
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
const COLUMNS = [{ field: "name", header: "Name" }, { field: "Action", header: "Actions" }];

function mockApi(rows) {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/Access/GetUserModuleAccess")) return ok({ status: 200, data: ["View"] });
    return ok({ status: 200, data: { content: rows, totalElements: rows.length, totalPages: 1 } });
  });
}

const edges = () => screen.getAllByTestId("dg-item").map((c) => [...c.classList].find((k) => k.startsWith("dg-item--edge-")));

async function gridView(props, rows) {
  mockApi(rows);
  render(<DynamicGrid ModuleId="9" apiUrl="http://api/api/X/List" columns={COLUMNS} {...props} />);
  fireEvent.click(screen.getByTitle("Grid view"));
  await screen.findAllByTestId("dg-item");
}

beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); });

describe("DynamicGrid — card edges follow the tab colour", () => {
  it("maps each tab to its colour", () => {
    expect(["all", "active", "inactive", "open", "closed", "payment_done", "payment_pending", "x"].map(tabColorOf))
      .toEqual(["accent", "green", "red", "amber", "green", "green", "amber", "accent"]);
  });

  it("a master grid: All = accent, Active = green, Inactive = red — whatever each row's own status", async () => {
    await gridView({ Module: "Products", noPagination: true }, [
      { uKey: "a", name: "On", disable: 0 }, { uKey: "b", name: "Off", disable: 1 },
    ]);
    expect(edges()).toEqual(["dg-item--edge-accent", "dg-item--edge-accent"]);
    fireEvent.click(screen.getByRole("button", { name: /^Active/ }));
    await waitFor(() => expect(edges()).toEqual(["dg-item--edge-green"]));
    fireEvent.click(screen.getByRole("button", { name: /^Inactive/ }));
    await waitFor(() => expect(edges()).toEqual(["dg-item--edge-red"]));
  });

  it("a document grid: Open = amber, Closed = green, the same colour as the tab", async () => {
    await gridView({ Module: "Stock transfers" }, [{ uKey: "t", name: "ST1", status: "DRAFT" }]);
    fireEvent.click(screen.getByTestId("dg-tab-open"));
    await waitFor(() => expect(edges()).toEqual(["dg-item--edge-amber"]));
    expect(screen.getByTestId("dg-tab-open")).toHaveClass("dg-tab--amber");
    fireEvent.click(screen.getByTestId("dg-tab-closed"));
    await waitFor(() => expect(edges()).toEqual(["dg-item--edge-green"]));
    expect(screen.getByTestId("dg-tab-closed")).toHaveClass("dg-tab--green");
  });

  it("Sales: the Payment Done and Pending tabs are coloured too, and their cards match", async () => {
    await gridView({ Module: "Sales", noPagination: true }, [
      { uKey: "s1", name: "INV1", statusId: 1 }, { uKey: "s2", name: "INV2", statusId: 2 },
    ]);
    const done = screen.getByRole("button", { name: /^Payment Done/ });
    const pending = screen.getByRole("button", { name: /^Pending/ });
    expect(done).toHaveClass("dg-tab--green");
    expect(pending).toHaveClass("dg-tab--amber");
    fireEvent.click(pending);
    await waitFor(() => expect(edges()).toEqual(["dg-item--edge-amber"]));
    fireEvent.click(done);
    await waitFor(() => expect(edges()).toEqual(["dg-item--edge-green"]));
  });

  it("the edge colours exist in both themes", () => {
    const css = fs.readFileSync(path.join(__dirname, "../../Styles/DynamicGrid.css"), "utf8");
    [["accent", "--dg-accent"], ["green", "--dg-success"], ["red", "--dg-danger"], ["amber", "--dg-warning"]].forEach(([c, token]) => {
      expect(css).toContain(`.dg-item.dg-item--edge-${c}`);
      expect(css).toMatch(new RegExp(`body\\[data-theme="light"\\][^{]*\\.dg-item\\.dg-item--edge-${c}\\s*\\{ border-left-color: var\\(${token}\\) !important; \\}`));
    });
  });
});

describe("DynamicGrid — the status on a card", () => {
  it("a document card shows its own status, never Active / Inactive", () => {
    expect(cardStatus({ status: "DRAFT" }, "Stock transfers")).toEqual({ label: "Draft", color: "amber" });
    expect(cardStatus({ status: "IN_TRANSIT" }, "Stock transfers")).toEqual({ label: "In transit", color: "amber" });
    expect(cardStatus({ status: "RECEIVED" }, "Stock transfers")).toEqual({ label: "Received", color: "green" });
    expect(cardStatus({ status: "PARTIALLY_FULFILLED" }, "Purchase orders")).toEqual({ label: "Partially fulfilled", color: "amber" });
    expect(cardStatus({ status: "FULFILLED" }, "Sales orders")).toEqual({ label: "Fulfilled", color: "green" });
    expect(cardStatus({ status: "INVOICED" }, "Delivery challans")).toEqual({ label: "Invoiced", color: "green" });
    expect(cardStatus({ status: "CANCELLED" }, "Delivery challans")).toEqual({ label: "Cancelled", color: "red" });
    expect(cardStatus({}, "Stock transfers")).toBeNull();
  });

  it("other grids keep their pills; a record with no on/off switch gets none", () => {
    expect(cardStatus({ statusId: 1 }, "Sales")).toEqual({ label: "Paid", color: "green" });
    expect(cardStatus({ statusId: 2 }, "Sales")).toEqual({ label: "Pending", color: "amber" });
    expect(cardStatus({ disable: 0 }, "Products")).toEqual({ label: "Active", color: "green" });
    expect(cardStatus({ disable: true }, "Supplier schemes")).toEqual({ label: "Inactive", color: "red" });
    expect(cardStatus({ name: "x" }, "Widgets")).toBeNull();
  });

  it("on the Open and Closed tabs of a stock transfer grid the cards say Draft / Received, not Active / Inactive", async () => {
    await gridView({ Module: "Stock transfers" }, [{ uKey: "t1", name: "ST1", status: "DRAFT" }, { uKey: "t2", name: "ST2", status: "RECEIVED" }]);
    const pills = () => screen.getAllByTestId("dg-item-status").map((p) => p.textContent);
    expect(pills()).toEqual(["Draft", "Received"]);
    fireEvent.click(screen.getByTestId("dg-tab-open"));
    await waitFor(() => expect(screen.getByTestId("dg-tab-open")).toHaveClass("dg-tab--active"));
    expect(pills()).not.toContain("Active");
    expect(pills()).not.toContain("Inactive");
    expect(screen.getAllByTestId("dg-item-status")[0]).toHaveClass("dg-item-status--amber");
  });
});
