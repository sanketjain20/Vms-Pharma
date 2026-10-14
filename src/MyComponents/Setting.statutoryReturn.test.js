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

const RETURN_DATA = {
  taxType: "TDS",
  financialYear: "2026-2027",
  quarter: "Q1",
  filingStatus: "PENDING",
  acknowledgementNumber: null,
  partyCount: 1,
  totalTaxableAmount: 500,
  totalTaxAmount: 50,
  totalDeposited: 0,
  totalPending: 50,
  rows: [
    {
      partyPan: "ABCDE1234F",
      partyName: "Apex Pharma",
      partyType: "SUPPLIER",
      sectionCode: "194Q",
      transactionCount: 1,
      totalTaxableAmount: 500,
      totalTaxAmount: 50,
      depositedAmount: 0,
      pendingAmount: 50,
    },
  ],
};

function mockApi({ markFiledResponse } = {}) {
  apiClient.mockImplementation((url, options = {}) => {
    if (url.includes("/api/Vendor/SettingDetails")) return jsonResponse({ status: 200, data: SETTING_DETAILS });
    if (url.includes("/api/TdsSetting/Get")) return jsonResponse({ status: 200, data: { enabled: false } });
    if (url.includes("/api/TcsSetting/Get")) return jsonResponse({ status: 200, data: { enabled: false } });
    if (url.includes("/api/StatutoryReturn/Get")) return jsonResponse({ status: 200, data: RETURN_DATA });
    if (url.includes("/api/StatutoryReturn/MarkFiled"))
      return jsonResponse(markFiledResponse || { status: 200, message: "Marked as filed" });
    return jsonResponse({ status: 200, data: null });
  });
}

async function openTaxTab() {
  render(<Settings />);
  await screen.findByText("Test Shop");
  fireEvent.click(screen.getByRole("button", { name: /^Tax$/i }));
}

describe("Settings > Tax > Return Filing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    window.prompt = jest.fn(() => "ACK-2026-001");
  });

  it("loads and displays the return summary and party rows on Load", async () => {
    mockApi();
    await openTaxTab();

    await userEvent.click(await screen.findByRole("button", { name: "Load" }));

    expect(await screen.findByText("PENDING")).toBeInTheDocument();
    expect(screen.getByText("Apex Pharma")).toBeInTheDocument();
    expect(screen.getByText("ABCDE1234F")).toBeInTheDocument();
  });

  it("offers Mark as Filed only while the return is still pending", async () => {
    mockApi();
    await openTaxTab();

    await userEvent.click(await screen.findByRole("button", { name: "Load" }));
    await screen.findByText("PENDING");

    expect(screen.getByRole("button", { name: /Mark as Filed/i })).toBeInTheDocument();
  });

  it("marking as filed sends the acknowledgement number and refreshes the summary", async () => {
    mockApi();
    await openTaxTab();

    await userEvent.click(await screen.findByRole("button", { name: "Load" }));
    await screen.findByText("PENDING");

    await userEvent.click(screen.getByRole("button", { name: /Mark as Filed/i }));

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/StatutoryReturn/MarkFiled`,
        expect.objectContaining({ body: expect.stringContaining('"acknowledgementNumber":"ACK-2026-001"') })
      );
    });
  });
});
