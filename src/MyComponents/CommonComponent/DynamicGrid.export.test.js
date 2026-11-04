import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DynamicGrid, { readGridPayload } from "./DynamicGrid";
import apiClient from "../../Config/apiClient";
import { toast } from "react-toastify";

jest.mock("../../Config/apiClient", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("../../Config/api.config", () => ({ __esModule: true, default: "http://api" }));
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
const rows = (from, n) => Array.from({ length: n }, (_, i) => ({ id: from + i, uKey: `u${from + i}`, transferNumber: `ST${from + i}` }));
const columns = [{ field: "transferNumber", header: "Document" }, { field: "Action", header: "Actions" }];

/** 25 transfers on the server, which pages them `cap` at a time whatever size is asked for. */
function mockServer({ total = 25, cap = 10 } = {}) {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/Access/GetUserModuleAccess")) return ok({ status: 200, data: ["View"] });
    const m = url.match(/\/List\/(\d+)\/(\d+)/);
    if (m) {
      const page = Number(m[1]);
      const size = Math.min(Number(m[2]), cap);
      const start = page * size;
      return ok({ status: 200, data: { content: rows(start + 1, Math.max(0, Math.min(size, total - start))), totalElements: total, totalPages: Math.ceil(total / size) } });
    }
    return ok({ status: 200, data: null });
  });
}

let zipFiles;
beforeEach(() => {
  jest.clearAllMocks();
  zipFiles = {};
  // the grid builds the .xlsx with JSZip (loaded from a CDN in the browser): a stand-in records the sheet
  window.__JSZip__ = function FakeZip() {
    this.file = (name, content) => { zipFiles[name] = content; };
    this.generateAsync = () => Promise.resolve(new Blob(["x"]));
  };
  URL.createObjectURL = jest.fn(() => "blob:x");
  URL.revokeObjectURL = jest.fn();
  jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {}); // the download itself (jsdom cannot navigate)
});

const listCalls = () => apiClient.mock.calls.map(([u]) => u).filter((u) => u.includes("/List/"));

async function openExport() {
  render(<DynamicGrid Module="Stock transfers" ModuleId="38" apiUrl="http://api/api/StockTransfer/List" columns={columns} customActionsOnly />);
  await screen.findByText("ST1");
  fireEvent.click(screen.getByTitle("Export to Excel"));
}

describe("DynamicGrid — Export", () => {
  it("Download All fetches every record of the tab from the server, not just the page on screen", async () => {
    mockServer({ total: 25, cap: 10 });
    await openExport();
    fireEvent.click(screen.getByText("Download All"));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Downloaded 25 rows"));
    // the server capped the pages at 10, so the export followed its page count: 3 pages
    expect(listCalls().filter((u) => u.includes("/500?"))).toEqual([
      "http://api/api/StockTransfer/List/0/500?tab=all",
      "http://api/api/StockTransfer/List/1/500?tab=all",
      "http://api/api/StockTransfer/List/2/500?tab=all",
    ]);
    expect(zipFiles["xl/sharedStrings.xml"]).toContain("ST25");
  });

  it("the Download All badge shows the tab's total", async () => {
    mockServer({ total: 25 });
    await openExport();
    expect(screen.getByText("Download All").querySelector(".dg-export-badge")).toHaveTextContent("25");
  });

  it("Download All keeps the search the user typed", async () => {
    mockServer({ total: 3, cap: 500 });
    render(<DynamicGrid Module="Stock transfers" ModuleId="38" apiUrl="http://api/api/StockTransfer/List" columns={columns} customActionsOnly />);
    await screen.findByText("ST1");
    fireEvent.change(screen.getByPlaceholderText("Search Stock transfers…"), { target: { value: "ST" } });
    fireEvent.click(screen.getByTitle("Export to Excel"));
    fireEvent.click(screen.getByText("Download All"));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Downloaded 3 rows"));
    expect(listCalls().some((u) => u === "http://api/api/StockTransfer/List/0/500?search=ST&tab=all")).toBe(true);
  });

  it("Current Page still downloads only the rows on screen", async () => {
    mockServer({ total: 25, cap: 10 });
    await openExport();
    fireEvent.click(screen.getByText("Current Page"));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Downloaded 10 rows"));
    expect(listCalls().some((u) => u.includes("/500?"))).toBe(false);
  });

  it("a failed load says so instead of downloading part of the data", async () => {
    mockServer({ total: 25, cap: 10 });
    await openExport();
    apiClient.mockImplementation(() => ok({ status: 500, message: "Server down" }));
    fireEvent.click(screen.getByText("Download All"));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Export failed"));
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("readGridPayload", () => {
  it("reads the list shapes the APIs return", () => {
    expect(readGridPayload({ data: { content: [1, 2], totalPages: 4, totalElements: 31 } })).toEqual({ list: [1, 2], pageCount: 4, itemCount: 31 });
    expect(readGridPayload({ data: [1] }).list).toEqual([1]);
    expect(readGridPayload({ data: { sales: [5, 6], totalItems: 2 } })).toMatchObject({ list: [5, 6], itemCount: 2 });
    expect(Number.isNaN(readGridPayload({ data: [] }).pageCount)).toBe(true);
  });
});
