import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import DynamicGrid from "./DynamicGrid";
import apiClient from "../../Config/apiClient";
import { toast } from "react-toastify";

jest.mock("../../Config/apiClient", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("../../Config/api.config", () => ({ __esModule: true, default: "http://api" }));
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

const NINE = ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8", "c9"].map((f, i) => ({ field: f, header: `Col ${i + 1}`, width: "180px" }));
const COLUMNS = [...NINE, { field: "Action", header: "Actions", width: "220px" }];
const ROW = Object.fromEntries(NINE.map((c, i) => [c.field, `v${i + 1}`]));

function mockApi(rows = [ROW]) {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/Access/GetUserModuleAccess")) return ok({ status: 200, data: ["View"] });
    return ok({ status: 200, data: { content: rows.map((r, i) => ({ ...r, uKey: `u${i}`, id: i })), totalElements: rows.length, totalPages: 1 } });
  });
}

const headers = () => screen.getAllByRole("columnheader").map((h) => h.textContent.replace(/^\d\d/, ""));
const grid = (props = {}) => render(<DynamicGrid Module="Widgets" ModuleId="99" apiUrl="http://api/api/Widget/List" columns={COLUMNS} {...props} />);

beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); mockApi(); });

describe("DynamicGrid — columns: six by default, the rest added on request", () => {
  it("shows the first six columns and Actions, and says how many of the columns are shown", async () => {
    grid();
    await screen.findByText("v1");
    expect(headers()).toEqual(["Col 1", "Col 2", "Col 3", "Col 4", "Col 5", "Col 6", "Actions"]);
    expect(screen.queryByText("v7")).toBeNull();
    // icon only: no count on it, just a dot while columns are left out
    expect(screen.getByRole("button", { name: "Choose the columns to show" })).toHaveTextContent("");
    expect(screen.getByTestId("dg-col-more")).toBeInTheDocument();
  });

  it("adds a column from the Columns menu, in its own place, and remembers it for the next visit", async () => {
    const { unmount } = grid();
    await screen.findByText("v1");
    fireEvent.click(screen.getByTitle("Choose the columns to show"));
    fireEvent.click(within(screen.getByTestId("dg-colpick-menu")).getByLabelText("Col 8"));
    expect(headers()).toEqual(["Col 1", "Col 2", "Col 3", "Col 4", "Col 5", "Col 6", "Col 8", "Actions"]);
    expect(screen.getByText("v8")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("dg-cols:widgets"))).toEqual(["c1", "c2", "c3", "c4", "c5", "c6", "c8"]);

    unmount();
    grid();
    await screen.findByText("v1");
    expect(headers()).toContain("Col 8");
  });

  it("can hide a default column, but always keeps one", async () => {
    grid({ columns: [NINE[0], NINE[1], ...NINE.slice(2), COLUMNS[9]] });
    await screen.findByText("v1");
    fireEvent.click(screen.getByTitle("Choose the columns to show"));
    const menu = screen.getByTestId("dg-colpick-menu");
    ["Col 2", "Col 3", "Col 4", "Col 5", "Col 6"].forEach((c) => fireEvent.click(within(menu).getByLabelText(c)));
    expect(headers()).toEqual(["Col 1", "Actions"]);
    expect(within(menu).getByLabelText("Col 1")).toBeDisabled();
  });

  it("Reset goes back to the default six and forgets the choice", async () => {
    localStorage.setItem("dg-cols:widgets", JSON.stringify(["c7", "c9"]));
    grid();
    await screen.findByText("v7");
    expect(headers()).toEqual(["Col 7", "Col 9", "Actions"]);
    fireEvent.click(screen.getByTitle("Choose the columns to show"));
    fireEvent.click(screen.getByText(/Reset to default/));
    expect(headers()).toEqual(["Col 1", "Col 2", "Col 3", "Col 4", "Col 5", "Col 6", "Actions"]);
    expect(localStorage.getItem("dg-cols:widgets")).toBeNull();
  });

  it("a saved column the grid no longer has is ignored", async () => {
    localStorage.setItem("dg-cols:widgets", JSON.stringify(["gone"]));
    grid();
    await screen.findByText("v1");
    expect(headers()).toHaveLength(7);
  });

  it("every grid has the columns icon — even one with six columns or fewer, so a default column can be hidden", async () => {
    grid({ columns: [...NINE.slice(0, 4), COLUMNS[9]] });
    await screen.findByText("v1");
    const btn = screen.getByRole("button", { name: "Choose the columns to show" });
    expect(btn).not.toHaveTextContent("Columns"); // an icon, not a word
    expect(btn.querySelector("svg")).toBeInTheDocument();
    expect(btn).toHaveTextContent(""); // no count
    expect(screen.queryByTestId("dg-col-more")).toBeNull(); // every column shown: no dot
    fireEvent.click(btn);
    fireEvent.click(within(screen.getByTestId("dg-colpick-menu")).getByLabelText("Col 2"));
    expect(headers()).toEqual(["Col 1", "Col 3", "Col 4", "Actions"]);
  });

  it("marks the icon while columns are left out, so the user notices there are more", async () => {
    grid();
    await screen.findByText("v1");
    expect(screen.getByTestId("dg-col-more")).toHaveAttribute("title", "3 more column(s) available");
  });

  it("once a column is added beyond the default, each column takes its set width and the table may scroll", async () => {
    grid();
    await screen.findByText("v1");
    fireEvent.click(screen.getByRole("button", { name: "Choose the columns to show" }));
    fireEvent.click(within(screen.getByTestId("dg-colpick-menu")).getByLabelText("Col 7"));
    const table = screen.getByRole("table");
    const widths = Array.from(table.querySelectorAll("col")).map((c) => c.style.width);
    expect(widths).toEqual(["180px", "180px", "180px", "180px", "180px", "180px", "180px", "220px"]);
    expect(table.style.minWidth).toBe("1480px"); // 7 × 180 + 220: wider than most screens, so it scrolls
    // back to six: the columns share the screen again
    fireEvent.click(within(screen.getByTestId("dg-colpick-menu")).getByLabelText("Col 7"));
    expect(table.style.minWidth).toBe("");
    expect(table.querySelector("col").style.width).toMatch(/%$/);
  });

  it("column names are centred in their column", async () => {
    const css = require("fs").readFileSync(require("path").join(__dirname, "../../Styles/DynamicGrid.css"), "utf8");
    expect(css).toMatch(/\.dg-table \.dg-th \{[^}]*padding: 10px;[^}]*text-align: center;/);
    expect(css).toMatch(/\.dg-table \.dg-th-label \{ justify-content: center; \}/);
  });

  it("by default the columns share the width (no sideways scroll); long values are cut, not wrapped", async () => {
    grid();
    await screen.findByText("v1");
    const table = screen.getByRole("table");
    expect(table).toHaveClass("dg-table--fit");
    expect(table.style.minWidth).toBe("");
    const widths = Array.from(table.querySelectorAll("col")).map((c) => parseFloat(c.style.width));
    expect(table.querySelector("col").style.width).toMatch(/%$/);
    expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 0);
  });

  it("the Excel export still has every column, shown or not", async () => {
    const files = {};
    window.__JSZip__ = function FakeZip() { this.file = (n, c) => { files[n] = c; }; this.generateAsync = () => Promise.resolve(new Blob(["x"])); };
    URL.createObjectURL = jest.fn(() => "blob:x");
    URL.revokeObjectURL = jest.fn();
    jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    grid();
    await screen.findByText("v1");
    fireEvent.click(screen.getByTitle("Export to Excel"));
    fireEvent.click(screen.getByText("Current Page"));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(files["xl/sharedStrings.xml"]).toContain("Col 9");
  });
});

describe("DynamicGrid — document grids: All · Open · Closed", () => {
  const listCalls = () => apiClient.mock.calls.map(([u]) => u).filter((u) => u.includes("/List/"));

  it("a stock transfer grid has the three tabs and asks the server for the tab picked", async () => {
    grid({ Module: "Stock transfers" });
    await screen.findByText("v1");
    expect(screen.getByTestId("dg-tab-all")).toHaveClass("dg-tab--active");
    expect(screen.getByTestId("dg-tab-open")).toHaveAttribute("title", "Draft or in transit");
    expect(screen.getByTestId("dg-tab-closed")).toHaveAttribute("title", "Received or cancelled");

    fireEvent.click(screen.getByTestId("dg-tab-open"));
    await waitFor(() => expect(listCalls().some((u) => u.endsWith("/0/10?tab=open"))).toBe(true));
    expect(screen.getByTestId("dg-tab-open")).toHaveClass("dg-tab--active");
    fireEvent.click(screen.getByTestId("dg-tab-closed"));
    await waitFor(() => expect(listCalls().some((u) => u.endsWith("/0/10?tab=closed"))).toBe(true));
    expect(screen.getByTestId("dg-tab-closed")).toHaveTextContent("1"); // its total
  });

  it.each([
    ["Purchase orders", "Draft, confirmed or partly received", "Fulfilled or cancelled"],
    ["Sales orders", "Draft, confirmed or partly delivered", "Fulfilled or cancelled"],
    ["Delivery challans", "Issued or partly returned", "Returned, invoiced or cancelled"],
  ])("%s say what Open and Closed hold", async (Module, open, closed) => {
    grid({ Module });
    await screen.findByText("v1");
    expect(screen.getByTestId("dg-tab-open")).toHaveAttribute("title", open);
    expect(screen.getByTestId("dg-tab-closed")).toHaveAttribute("title", closed);
  });

  it("other grids keep their tabs (a purchase list has only All)", async () => {
    grid({ Module: "Purchase" });
    await screen.findByText("v1");
    expect(screen.queryByTestId("dg-tab-open")).toBeNull();
    expect(screen.getByText("All")).toBeInTheDocument();
  });
});

describe("DynamicGrid — values centred, formatted columns, true/false switches", () => {
  it("values are centred in their column like the names", () => {
    const css = require("fs").readFileSync(require("path").join(__dirname, "../../Styles/DynamicGrid.css"), "utf8");
    expect(css).toMatch(/\.dg-table \.dg-cell \{ padding-left: 10px; padding-right: 10px; text-align: center; \}/);
  });

  it("a column with format shows the formatted text in the table", async () => {
    mockApi([{ ...ROW, c1: "ACTIVE" }]);
    grid({ columns: [{ field: "c1", header: "Status", format: (s) => (s === "ACTIVE" ? "Active" : s) }, COLUMNS[9]] });
    const table = await screen.findByRole("table");
    await waitFor(() => expect(within(table).getByText("Active")).toBeInTheDocument());
    expect(within(table).queryByText("ACTIVE")).toBeNull();
  });

  it("rows that send disable as true/false fall into the Active / Inactive tabs", async () => {
    mockApi([{ ...ROW, c1: "on", disable: false }, { ...ROW, c1: "off", disable: true }]);
    render(<DynamicGrid Module="Widgets" ModuleId="99" apiUrl="http://api/api/Widget/List" columns={COLUMNS} noPagination />);
    await screen.findByText("on");
    fireEvent.click(screen.getByRole("button", { name: /^Active/ }));
    await waitFor(() => expect(screen.queryByText("off")).toBeNull());
    expect(screen.getByText("on")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Inactive/ }));
    await waitFor(() => expect(screen.queryByText("on")).toBeNull());
    expect(screen.getByText("off")).toBeInTheDocument();
  });
});
