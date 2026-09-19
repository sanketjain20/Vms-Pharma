import { render, screen } from "@testing-library/react";
import Gstr2Recon from "./Gstr2Recon";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");

function jsonResponse(body, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) });
}

describe("Gstr2Recon", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the upload form and an empty imports table on first load", async () => {
    apiClient.mockImplementation((url) => {
      if (url.includes("/GetImports")) return jsonResponse({ status: 200, data: [] });
      return jsonResponse({ status: 200, data: null });
    });

    render(<Gstr2Recon />);

    expect(screen.getByText(/GSTR-2A \/ GSTR-2B Reconciliation/i)).toBeInTheDocument();
    expect(await screen.findByText(/No files uploaded yet\./i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload" })).toBeInTheDocument();
  });

  it("lists uploaded imports with parse status and a Run Reconciliation button for parsed files", async () => {
    apiClient.mockImplementation((url) => {
      if (url.includes("/GetImports")) {
        return jsonResponse({
          status: 200,
          data: [
            {
              uKey: "imp-1",
              fileName: "gstr2b-march.json",
              returnType: "GSTR2B",
              uploadedAt: "2026-03-15T10:00:00",
              parseStatus: "PARSED",
              rowCount: 12,
              latestRunUKey: null,
            },
          ],
        });
      }
      return jsonResponse({ status: 200, data: null });
    });

    render(<Gstr2Recon />);

    expect(await screen.findByText("gstr2b-march.json")).toBeInTheDocument();
    expect(screen.getByText("Parsed")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run Reconciliation" })).toBeInTheDocument();
  });

  it("shows a Parse Failed badge and no run button when parsing failed", async () => {
    apiClient.mockImplementation((url) => {
      if (url.includes("/GetImports")) {
        return jsonResponse({
          status: 200,
          data: [
            {
              uKey: "imp-2",
              fileName: "bad-file.json",
              returnType: "GSTR2B",
              uploadedAt: "2026-03-15T10:00:00",
              parseStatus: "PARSE_FAILED",
              parseError: "Unrecognized file format",
              rowCount: null,
              latestRunUKey: null,
            },
          ],
        });
      }
      return jsonResponse({ status: 200, data: null });
    });

    render(<Gstr2Recon />);

    expect(await screen.findByText("Parse Failed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Run Reconciliation" })).not.toBeInTheDocument();
  });
});
