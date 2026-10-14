import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "react-toastify";
import MargImportHistory, { importLabel, statusClass } from "./MargImportHistory";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() },
}));

const ROWS = [
  {
    id: 3, transactionCode: "MRG-20261004-101500-AB12", type: "PARTIES", partyKind: "RETAILER", fileName: "parties.xlsx",
    status: "Partially Processed", totalRows: 10, createdCount: 6, updatedCount: 2, skippedCount: 0, failedCount: 2,
    hasSuccessFile: true, hasFailureFile: true, createdBy: "owner@abc.com", createdAt: "2026-10-04T10:15:00",
  },
  {
    id: 2, transactionCode: "MRG-20261003-090000-CD34", type: "STOCK", partyKind: null, fileName: "stock.csv",
    status: "Processed", totalRows: 5, createdCount: 5, updatedCount: 0, skippedCount: 0, failedCount: 0,
    hasSuccessFile: true, hasFailureFile: false, createdBy: "owner@abc.com", createdAt: "2026-10-03T09:00:00",
  },
  {
    id: 1, transactionCode: "MRG-20261002-080000-EF56", type: "OUTSTANDING", partyKind: "SUPPLIER", fileName: "os.xlsx",
    status: "Failed", totalRows: 3, createdCount: 0, updatedCount: 0, skippedCount: 0, failedCount: 3,
    hasSuccessFile: false, hasFailureFile: true, createdBy: null, createdAt: null,
  },
];

const json = (body, ok = true) => Promise.resolve({ ok, json: () => Promise.resolve(body) });

beforeEach(() => {
  jest.clearAllMocks();
  window.URL.createObjectURL = jest.fn(() => "blob:x");
});

describe("history helpers", () => {
  it("importLabel names the import and its party side", () => {
    expect(importLabel({ type: "PARTIES", partyKind: "RETAILER" })).toBe("Party master (Retailers)");
    expect(importLabel({ type: "OUTSTANDING", partyKind: "SUPPLIER" })).toBe("Outstanding (Suppliers)");
    expect(importLabel({ type: "STOCK", partyKind: null })).toBe("Stock");
  });

  it("statusClass picks the same colours as bulk upload", () => {
    expect(statusClass("Processed")).toBe("bulkup-status-success");
    expect(statusClass("Partially Processed")).toBe("bulkup-status-warning");
    expect(statusClass("Failed")).toBe("bulkup-status-failure");
    expect(statusClass("?")).toBe("bulkup-status-pending");
  });
});

describe("MargImportHistory", () => {
  it("loads and lists past imports with status, result counts and who ran them", async () => {
    apiClient.mockImplementation(() => json({ status: 200, data: ROWS }));
    render(<MargImportHistory />);

    expect(await screen.findByText("MRG-20261004-101500-AB12")).toBeInTheDocument();
    expect(apiClient.mock.calls[0][0]).toContain("/api/MargImport/History");
    expect(screen.getByText("Party master (Retailers)")).toBeInTheDocument();
    expect(screen.getByText("parties.xlsx")).toBeInTheDocument();
    expect(screen.getByText("Partially Processed")).toBeInTheDocument();
    expect(screen.getByText("6 new")).toBeInTheDocument();
    expect(screen.getByText("2 failed")).toBeInTheDocument();
    expect(screen.getAllByText("owner@abc.com")).toHaveLength(2);
    expect(screen.getByText("3 records")).toBeInTheDocument();
  });

  it("only offers the success and failure downloads the import actually has", async () => {
    apiClient.mockImplementation(() => json({ status: 200, data: ROWS }));
    render(<MargImportHistory />);
    await screen.findByText("MRG-20261004-101500-AB12");

    const rowOf = (code) => screen.getByText(code).closest("tr");
    expect(within(rowOf("MRG-20261004-101500-AB12")).getAllByRole("button").map((b) => b.textContent.trim()))
      .toEqual(["Uploaded", "Success", "Failure"]);
    expect(within(rowOf("MRG-20261003-090000-CD34")).getAllByRole("button").map((b) => b.textContent.trim()))
      .toEqual(["Uploaded", "Success"]);
    expect(within(rowOf("MRG-20261002-080000-EF56")).getAllByRole("button").map((b) => b.textContent.trim()))
      .toEqual(["Uploaded", "Failure"]);
  });

  it("downloads the chosen file for that import", async () => {
    apiClient.mockImplementation((url) =>
      url.includes("/File/") ? Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob(["x"])) }) : json({ status: 200, data: ROWS })
    );
    const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<MargImportHistory />);
    await screen.findByText("MRG-20261004-101500-AB12");

    const row = screen.getByText("MRG-20261004-101500-AB12").closest("tr");
    await userEvent.click(within(row).getByRole("button", { name: /failure/i }));

    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(apiClient.mock.calls.some(([url]) => url.endsWith("/History/3/File/failure"))).toBe(true);
    click.mockRestore();
  });

  it("shows the server's message when a download fails", async () => {
    apiClient.mockImplementation((url) =>
      url.includes("/File/") ? json({ message: "The stored file is no longer available." }, false) : json({ status: 200, data: ROWS })
    );
    render(<MargImportHistory />);
    await screen.findByText("MRG-20261004-101500-AB12");

    await userEvent.click(within(screen.getByText("MRG-20261002-080000-EF56").closest("tr")).getByRole("button", { name: /uploaded/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("The stored file is no longer available."));
  });

  it("filters by code, file name or status", async () => {
    apiClient.mockImplementation(() => json({ status: 200, data: ROWS }));
    render(<MargImportHistory />);
    await screen.findByText("MRG-20261004-101500-AB12");

    await userEvent.type(screen.getByPlaceholderText(/search by code/i), "stock");

    expect(screen.getByText("MRG-20261003-090000-CD34")).toBeInTheDocument();
    expect(screen.queryByText("MRG-20261004-101500-AB12")).not.toBeInTheDocument();
    expect(screen.getByText("1 records")).toBeInTheDocument();

    await userEvent.clear(screen.getByPlaceholderText(/search by code/i));
    await userEvent.type(screen.getByPlaceholderText(/search by code/i), "failed");
    expect(screen.getByText("MRG-20261002-080000-EF56")).toBeInTheDocument();
  });

  it("shows an empty state, and a different one when a search finds nothing", async () => {
    apiClient.mockImplementation(() => json({ status: 200, data: [] }));
    render(<MargImportHistory />);

    expect(await screen.findByText("No imports found")).toBeInTheDocument();
    expect(screen.getByText(/import a marg file/i)).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText(/search by code/i), "zzz");
    expect(screen.getByText(/different search term/i)).toBeInTheDocument();
  });

  it("Refresh loads the list again", async () => {
    apiClient.mockImplementation(() => json({ status: 200, data: ROWS }));
    render(<MargImportHistory />);
    await screen.findByText("MRG-20261004-101500-AB12");

    await userEvent.click(screen.getByRole("button", { name: /refresh/i }));

    await waitFor(() => expect(apiClient).toHaveBeenCalledTimes(2));
  });

  it("reports a failure to load the history", async () => {
    apiClient.mockImplementation(() => json({ message: "Could not load the import history: boom" }, false));
    render(<MargImportHistory />);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Could not load the import history: boom"));
    expect(screen.getByText("No imports found")).toBeInTheDocument();
  });
});
