import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "react-toastify";
import MargImport, { csvCell, failuresToCsv, matchesFilter, rowLabel } from "./MargImport";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() },
}));

const GUIDES = [
  {
    type: "STOCK", title: "Stock", description: "Export batch-wise stock.", needsPartyKind: false,
    fields: [{ key: "item", label: "Item name", required: true, acceptedHeaders: ["item name"] }],
  },
  {
    type: "PARTIES", title: "Party master", description: "Export the party list.", needsPartyKind: true,
    fields: [
      { key: "name", label: "Party name", required: true, acceptedHeaders: ["party name", "name"] },
      { key: "phone", label: "Phone", required: false, acceptedHeaders: ["phone", "mobile"] },
    ],
  },
  {
    type: "ITEMS", title: "Item master", description: "Export the item list.", needsPartyKind: false,
    fields: [{ key: "name", label: "Item name", required: true, acceptedHeaders: ["item name"] }],
  },
];

const PREVIEW = {
  importKey: "output/abc_marg-import-ABC-PARTIES-p.csv",
  type: "PARTIES", partyKind: "RETAILER", fileName: "p.csv", totalRows: 4,
  createCount: 2, updateCount: 1, skipCount: 0, errorCount: 1,
  mapping: { name: "Party Name", phone: "" }, missingRequired: [], rowsTruncated: false,
  rows: [
    { rowNumber: 2, action: "CREATE", message: "New retailer.", warnings: [], values: { name: "Shree Medicals" } },
    { rowNumber: 3, action: "UPDATE", message: "Updates existing retailer R1.", warnings: ["Phone '12' was not usable"], values: { name: "City Chemist" } },
    { rowNumber: 4, action: "CREATE", message: "New retailer.", warnings: [], values: { name: "Care Pharma" } },
    { rowNumber: 5, action: "ERROR", message: "Party name is empty.", warnings: [], values: {} },
  ],
};

const json = (body, ok = true) => Promise.resolve({ ok, json: () => Promise.resolve(body) });

function mockApi({ preview, commit } = {}) {
  apiClient.mockImplementation((url) => {
    if (url.includes("/Guides")) return json({ status: 200, data: GUIDES });
    if (url.includes("/History")) return json({ status: 200, data: [] });
    if (url.includes("/Preview/")) return preview ? preview() : json({ status: 200, data: PREVIEW });
    if (url.includes("/Commit/")) {
      return commit ? commit() : json({
        status: 200, message: "Import complete.",
        data: { type: "PARTIES", totalRows: 4, createdCount: 2, updatedCount: 1, skippedCount: 0, failedCount: 0, failures: [], failuresTruncated: false },
      });
    }
    return json({});
  });
}

const csvFile = () => new File(["Party Name\nA\n"], "p.csv", { type: "text/csv" });

// The number shown in the stat tile with this label ("New" and "Errors" are also filter buttons).
const statValue = (scope, label) => {
  const tile = Array.from(scope.querySelectorAll(".marg-stat")).find((el) => el.textContent.endsWith(label));
  return tile ? tile.querySelector(".marg-stat-value").textContent : undefined;
};

async function chooseFileAndCheck(user, container) {
  await user.upload(container.querySelector('input[type="file"]'), csvFile());
  await user.click(screen.getByRole("button", { name: /check file/i }));
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("MargImport helpers", () => {
  it("rowLabel names a row by its party / item and shows the batch for stock", () => {
    expect(rowLabel({ name: "Shree" })).toBe("Shree");
    expect(rowLabel({ party: "City" })).toBe("City");
    expect(rowLabel({ item: "Dolo", batch: "B1" })).toBe("Dolo (batch B1)");
    expect(rowLabel({})).toBe("-");
  });

  it("matchesFilter handles actions and the warnings filter", () => {
    const row = { action: "UPDATE", warnings: ["w"] };
    expect(matchesFilter(row, "ALL")).toBe(true);
    expect(matchesFilter(row, "UPDATE")).toBe(true);
    expect(matchesFilter(row, "ERROR")).toBe(false);
    expect(matchesFilter(row, "WARN")).toBe(true);
    expect(matchesFilter({ action: "CREATE", warnings: [] }, "WARN")).toBe(false);
  });

  it("csvCell neutralises anything Excel would run as a formula", () => {
    expect(csvCell('=HYPERLINK("http://evil","x")')).toBe(`"'=HYPERLINK(""http://evil"",""x"")"`);
    expect(csvCell("+1-555-0100")).toBe(`"'+1-555-0100"`);
    expect(csvCell("-2+3")).toBe(`"'-2+3"`);
    expect(csvCell("@SUM(A1)")).toBe(`"'@SUM(A1)"`);
    expect(csvCell("\tcmd")).toBe(`"'\tcmd"`);
    expect(csvCell("Shree Medicals")).toBe('"Shree Medicals"');
    expect(csvCell(7)).toBe('"7"');
    expect(csvCell(null)).toBe('""');
  });

  it("failuresToCsv keeps an injected name inert in the downloaded file", () => {
    const csv = failuresToCsv([{ rowNumber: 3, values: { name: "=cmd|' /C calc'!A0" }, message: "bad" }]);
    expect(csv.split("\n")[1]).toBe(`"3","'=cmd|' /C calc'!A0","bad"`);
  });

  it("failuresToCsv quotes cells and escapes quotes", () => {
    const csv = failuresToCsv([{ rowNumber: 7, values: { name: 'Sharma "Raj", Sons' }, message: "Not found" }]);
    expect(csv.split("\n")[0]).toBe('"Row","Name","Problem"');
    expect(csv.split("\n")[1]).toBe('"7","Sharma ""Raj"", Sons","Not found"');
  });
});

describe("MargImport page", () => {
  it("lists the import types in load order and shows the first one's guide", async () => {
    mockApi();
    render(<MargImport />);

    const tabs = await screen.findAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["1Party master", "2Item master", "3Stock"]);
    expect(screen.getByText("Export the party list.")).toBeInTheDocument();
  });

  it("asks which side a party file holds, and hides that for types that do not need it", async () => {
    mockApi();
    const user = userEvent;
    render(<MargImport />);

    expect(await screen.findByRole("radiogroup", { name: /party type/i })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /item master/i }));
    expect(screen.queryByRole("radiogroup", { name: /party type/i })).not.toBeInTheDocument();
    expect(screen.getByText("Export the item list.")).toBeInTheDocument();
  });

  it("keeps Check file disabled until a file is chosen", async () => {
    mockApi();
    const { container } = render(<MargImport />);
    await screen.findAllByRole("tab");

    expect(screen.getByRole("button", { name: /check file/i })).toBeDisabled();
    await userEvent.upload(container.querySelector('input[type="file"]'), csvFile());
    expect(screen.getByRole("button", { name: /check file/i })).toBeEnabled();
  });

  it("uploads to Preview with the type and the chosen party kind, then shows the counts and rows", async () => {
    mockApi();
    const user = userEvent;
    const { container } = render(<MargImport />);
    await screen.findAllByRole("tab");

    await user.click(screen.getByRole("radio", { name: /suppliers/i }));
    await chooseFileAndCheck(user, container);

    const previewCall = apiClient.mock.calls.find(([url]) => url.includes("/Preview/PARTIES"));
    expect(previewCall[1].method).toBe("POST");
    expect(previewCall[1].body.get("partyKind")).toBe("SUPPLIER");
    expect(previewCall[1].body.get("file").name).toBe("p.csv");

    const preview = await screen.findByLabelText("Preview");
    expect(statValue(preview, "Rows")).toBe("4");
    expect(statValue(preview, "New")).toBe("2");
    expect(statValue(preview, "Updates")).toBe("1");
    expect(statValue(preview, "Errors")).toBe("1");
    expect(within(preview).getByRole("button", { name: /import 3 rows/i })).toBeEnabled();
  });

  it("opens on the error rows when there are errors, and the filters switch the table", async () => {
    mockApi();
    const user = userEvent;
    const { container } = render(<MargImport />);
    await screen.findAllByRole("tab");
    await chooseFileAndCheck(user, container);

    const preview = await screen.findByLabelText("Preview");
    expect(within(preview).getByText("Party name is empty.")).toBeInTheDocument();
    expect(within(preview).queryByText("Shree Medicals")).not.toBeInTheDocument();

    await user.click(within(preview).getByRole("button", { name: "Warnings" }));
    expect(within(preview).getByText("City Chemist")).toBeInTheDocument();
    expect(within(preview).getByText("Phone '12' was not usable")).toBeInTheDocument();
    expect(within(preview).queryByText("Party name is empty.")).not.toBeInTheDocument();

    await user.click(within(preview).getByRole("button", { name: "All" }));
    expect(within(preview).getByText("Shree Medicals")).toBeInTheDocument();
    expect(within(preview).getByText("Care Pharma")).toBeInTheDocument();
  });

  it("shows how the file's columns were read", async () => {
    mockApi();
    const user = userEvent;
    const { container } = render(<MargImport />);
    await screen.findAllByRole("tab");
    await chooseFileAndCheck(user, container);

    const preview = await screen.findByLabelText("Preview");
    expect(within(preview).getByText("Party Name")).toBeInTheDocument();
    expect(within(preview).getByText("not in file")).toBeInTheDocument();
  });

  it("imports the previewed file by its key and shows the result", async () => {
    mockApi();
    const user = userEvent;
    const { container } = render(<MargImport />);
    await screen.findAllByRole("tab");
    await chooseFileAndCheck(user, container);

    await user.click(await screen.findByRole("button", { name: /import 3 rows/i }));

    const commitCall = apiClient.mock.calls.find(([url]) => url.includes("/Commit/PARTIES"));
    expect(commitCall[0]).toContain("partyKind=RETAILER");
    expect(commitCall[1].method).toBe("POST");
    expect(commitCall[1].body.get("importKey")).toBe(PREVIEW.importKey);

    const result = await screen.findByLabelText("Result");
    expect(statValue(result, "Created")).toBe("2");
    expect(statValue(result, "Updated")).toBe("1");
    expect(statValue(result, "Failed")).toBe("0");
    expect(toast.success).toHaveBeenCalledWith("Import complete.");
    expect(screen.queryByLabelText("Preview")).not.toBeInTheDocument();
  });

  it("lists the failed rows after an import and offers them as a download", async () => {
    mockApi({
      commit: () => json({
        status: 200, message: "Import finished with 1 row that could not be imported.",
        data: {
          type: "PARTIES", totalRows: 4, createdCount: 2, updatedCount: 1, skippedCount: 0, failedCount: 1,
          failures: [{ rowNumber: 9, action: "ERROR", message: "GST already exists", warnings: [], values: { name: "Dup Pharma" } }],
          failuresTruncated: false,
        },
      }),
    });
    const user = userEvent;
    const { container } = render(<MargImport />);
    await screen.findAllByRole("tab");
    await chooseFileAndCheck(user, container);
    await user.click(await screen.findByRole("button", { name: /import 3 rows/i }));

    const result = await screen.findByLabelText("Result");
    expect(within(result).getByText("Dup Pharma")).toBeInTheDocument();
    expect(within(result).getByText("GST already exists")).toBeInTheDocument();
    expect(within(result).getByRole("button", { name: /download failed rows/i })).toBeInTheDocument();
    expect(toast.warning).toHaveBeenCalled();
  });

  it("disables the import button when nothing can be imported", async () => {
    mockApi({
      preview: () => json({
        status: 200,
        data: { ...PREVIEW, createCount: 0, updateCount: 0, skipCount: 3, errorCount: 1, rows: [PREVIEW.rows[3]] },
      }),
    });
    const user = userEvent;
    const { container } = render(<MargImport />);
    await screen.findAllByRole("tab");
    await chooseFileAndCheck(user, container);

    expect(await screen.findByRole("button", { name: /import 0 rows/i })).toBeDisabled();
  });

  it("shows the server's message when the file is rejected", async () => {
    mockApi({ preview: () => json({ status: 400, message: "Could not find the required column Party name." }, false) });
    const user = userEvent;
    const { container } = render(<MargImport />);
    await screen.findAllByRole("tab");
    await chooseFileAndCheck(user, container);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Could not find the required column Party name."));
    expect(screen.queryByLabelText("Preview")).not.toBeInTheDocument();
  });

  it("shows the server's message when the import itself fails", async () => {
    mockApi({ commit: () => json({ status: 404, message: "The uploaded file is no longer available. Upload it again." }, false) });
    const user = userEvent;
    const { container } = render(<MargImport />);
    await screen.findAllByRole("tab");
    await chooseFileAndCheck(user, container);
    await user.click(await screen.findByRole("button", { name: /import 3 rows/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("The uploaded file is no longer available. Upload it again."));
    expect(screen.getByLabelText("Preview")).toBeInTheDocument();
  });

  it("switching the import type clears the previous preview", async () => {
    mockApi();
    const user = userEvent;
    const { container } = render(<MargImport />);
    await screen.findAllByRole("tab");
    await chooseFileAndCheck(user, container);
    await screen.findByLabelText("Preview");

    await user.click(screen.getByRole("tab", { name: /stock/i }));

    expect(screen.queryByLabelText("Preview")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /check file/i })).toBeDisabled();
  });

  it("Start over returns to the upload step", async () => {
    mockApi();
    const user = userEvent;
    const { container } = render(<MargImport />);
    await screen.findAllByRole("tab");
    await chooseFileAndCheck(user, container);
    await screen.findByLabelText("Preview");

    await user.click(screen.getByRole("button", { name: /start over/i }));

    expect(screen.queryByLabelText("Preview")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /check file/i })).toBeDisabled();
  });

  it("downloads the sample file for the selected import type", async () => {
    mockApi();
    const blob = new Blob(["x"]);
    const original = apiClient.getMockImplementation();
    apiClient.mockImplementation((url, options) =>
      url.includes("/Sample/") ? Promise.resolve({ ok: true, blob: () => Promise.resolve(blob) }) : original(url, options)
    );
    window.URL.createObjectURL = jest.fn(() => "blob:sample");
    const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<MargImport />);
    await screen.findAllByRole("tab");

    await userEvent.click(screen.getByRole("tab", { name: /stock/i }));
    await userEvent.click(screen.getByRole("button", { name: /download sample file/i }));

    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(apiClient.mock.calls.some(([url]) => url.endsWith("/api/MargImport/Sample/STOCK"))).toBe(true);
    click.mockRestore();
  });

  it("shows the server's message when the sample cannot be downloaded", async () => {
    mockApi();
    const original = apiClient.getMockImplementation();
    apiClient.mockImplementation((url, options) =>
      url.includes("/Sample/") ? json({ message: "Unknown import type" }, false) : original(url, options)
    );
    render(<MargImport />);
    await screen.findAllByRole("tab");

    await userEvent.click(screen.getByRole("button", { name: /download sample file/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Unknown import type"));
  });

  it("switches between a new import and the history, keeping the work in progress", async () => {
    mockApi();
    const { container } = render(<MargImport />);
    await screen.findAllByRole("tab");
    await chooseFileAndCheck(userEvent, container);
    await screen.findByLabelText("Preview");

    await userEvent.click(screen.getByRole("button", { name: "History" }));
    expect(await screen.findByLabelText("Import history")).toBeInTheDocument();
    expect(screen.queryByLabelText("Preview")).not.toBeInTheDocument();
    expect(apiClient.mock.calls.some(([url]) => url.endsWith("/api/MargImport/History"))).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: "New import" }));
    expect(screen.getByLabelText("Preview")).toBeInTheDocument();
  });

  it("offers View history after an import finishes", async () => {
    mockApi();
    const { container } = render(<MargImport />);
    await screen.findAllByRole("tab");
    await chooseFileAndCheck(userEvent, container);
    await userEvent.click(await screen.findByRole("button", { name: /import 3 rows/i }));
    await screen.findByLabelText("Result");

    await userEvent.click(screen.getByRole("button", { name: /view history/i }));

    expect(await screen.findByLabelText("Import history")).toBeInTheDocument();
  });

  it("reports a failure to load the guides", async () => {
    apiClient.mockImplementation(() => json({ message: "Failed to load import guides" }, false));
    render(<MargImport />);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Failed to load import guides"));
  });
});
