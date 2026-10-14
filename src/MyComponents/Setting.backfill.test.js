import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Settings from "./Setting";
import apiClient from "../Config/apiClient";
import API_BASE_URL from "../Config/api.config";

jest.mock("../Config/apiClient");

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => jest.fn(),
}));

function jsonResponse(body) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}

const SETTING_DETAILS = {
  shopName: "Test Shop",
  gstin: "",
  pincode: "",
  drugLicenseNumber: "",
  tan: "",
  email: "vendor@example.com",
};

const PREVIEW_WITH_ROWS = {
  tcs: {
    taxType: "TCS",
    financialYear: "2026-2027",
    rows: [{ partyUKey: "ret-1", partyName: "City Medicos", historicalConsideration: 50000 }],
    totalConsideration: 50000,
    alreadyCompleted: false,
    completedAt: null,
  },
  tds: {
    taxType: "TDS",
    financialYear: "2026-2027",
    rows: [],
    totalConsideration: 0,
    alreadyCompleted: false,
    completedAt: null,
  },
};

const ALREADY_COMPLETED = {
  tcs: {
    taxType: "TCS",
    financialYear: "2026-2027",
    rows: [],
    totalConsideration: 0,
    alreadyCompleted: true,
    completedAt: "2026-09-01T10:00:00",
  },
  tds: {
    taxType: "TDS",
    financialYear: "2026-2027",
    rows: [],
    totalConsideration: 0,
    alreadyCompleted: true,
    completedAt: "2026-09-01T10:00:00",
  },
};

function mockApi({ previewResponse, applyResponse } = {}) {
  apiClient.mockImplementation((url, options = {}) => {
    if (url.includes("/api/Vendor/SettingDetails")) return jsonResponse({ status: 200, data: SETTING_DETAILS });
    if (url.includes("/api/TdsSetting/Get")) return jsonResponse({ status: 200, data: { enabled: false } });
    if (url.includes("/api/TcsSetting/Get")) return jsonResponse({ status: 200, data: { enabled: false } });
    if (url.includes("/api/TaxTurnoverBackfill/Preview"))
      return jsonResponse(previewResponse || { status: 200, data: PREVIEW_WITH_ROWS });
    if (url.includes("/api/TaxTurnoverBackfill/Apply"))
      return jsonResponse(applyResponse || { status: 200, data: ALREADY_COMPLETED });
    return jsonResponse({ status: 200, data: null });
  });
}

async function openTaxTab() {
  render(<Settings />);
  await screen.findByText("Test Shop");
  fireEvent.click(screen.getByRole("button", { name: /^Tax$/i }));
}

describe("Settings > Tax > Historical Turnover Backfill", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    window.confirm = jest.fn(() => true);
  });

  it("previews the backfill and shows the party rows to add", async () => {
    mockApi();
    await openTaxTab();

    await userEvent.click(await screen.findByRole("button", { name: "Preview Backfill" }));

    expect(await screen.findByText("City Medicos")).toBeInTheDocument();
    expect(screen.getByText(/1 party · ₹50,000.00 to add/i)).toBeInTheDocument();
  });

  it("shows Apply Backfill only after a preview with parties to add, behind a confirmation", async () => {
    mockApi();
    await openTaxTab();

    expect(screen.queryByRole("button", { name: "Apply Backfill" })).not.toBeInTheDocument();

    await userEvent.click(await screen.findByRole("button", { name: "Preview Backfill" }));
    const applyButton = await screen.findByRole("button", { name: "Apply Backfill" });

    await userEvent.click(applyButton);

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/TaxTurnoverBackfill/Apply`,
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("shows a completed badge instead of the Apply button once already backfilled", async () => {
    mockApi({ previewResponse: { status: 200, data: ALREADY_COMPLETED } });
    await openTaxTab();

    await userEvent.click(await screen.findByRole("button", { name: "Preview Backfill" }));

    expect(await screen.findAllByText(/Backfilled on/i)).toHaveLength(2); // TCS and TDS
    expect(screen.queryByRole("button", { name: "Apply Backfill" })).not.toBeInTheDocument();
  });
});
