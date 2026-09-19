import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import Settings from "./Setting";
import apiClient from "../Config/apiClient";

jest.mock("../Config/apiClient");

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

function jsonResponse(body) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}

const SETTING_DETAILS = {
  shopName: "Test Shop",
  gstin: "",
  pincode: "",
  drugLicenseNumber: "",
  email: "vendor@example.com",
};

const SESSIONS = [
  {
    uKey: "session-this-device",
    browserLabel: "Chrome 128",
    ipAddress: "203.0.113.9",
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    current: true,
  },
  {
    uKey: "session-other-device",
    browserLabel: "Safari 17",
    ipAddress: "198.51.100.4",
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    lastActiveAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    current: false,
  },
];

function mockApi({ sessions = SESSIONS } = {}) {
  apiClient.mockImplementation((url, options = {}) => {
    if (url.includes("/api/Vendor/SettingDetails")) return jsonResponse({ status: 200, data: SETTING_DETAILS });
    if (url.includes("/api/auth/Sessions/Revoke/")) return jsonResponse({ status: 200, message: "Session signed out." });
    if (url.includes("/api/auth/Sessions")) return jsonResponse({ status: 200, data: sessions });
    if (url.includes("/api/auth/SignOutEverywhere")) return jsonResponse({ status: 200, message: "Signed out." });
    return jsonResponse({ status: 200, data: null });
  });
}

async function openSecurityTab() {
  render(<Settings />);
  await screen.findByText("Test Shop");
  fireEvent.click(screen.getByRole("button", { name: /Security/i }));
}

describe("Settings > Security — live sessions (no longer hardcoded)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    window.confirm = jest.fn(() => true);
  });

  it("fetches and renders the real session list instead of a hardcoded one", async () => {
    mockApi();
    await openSecurityTab();

    await screen.findByText("Chrome 128");
    expect(screen.getByText("Safari 17")).toBeInTheDocument();
    expect(apiClient).toHaveBeenCalledWith(
      expect.stringContaining("/api/auth/Sessions"),
      expect.objectContaining({ method: "GET" })
    );
  });

  it("marks the matching session as this device instead of guessing by recency", async () => {
    mockApi();
    await openSecurityTab();

    const thisDeviceRow = (await screen.findByText("Chrome 128")).closest(".st-row");
    expect(within(thisDeviceRow).getByText("This device")).toBeInTheDocument();
    expect(within(thisDeviceRow).queryByRole("button", { name: "Revoke" })).not.toBeInTheDocument();

    const otherDeviceRow = screen.getByText("Safari 17").closest(".st-row");
    expect(within(otherDeviceRow).getByRole("button", { name: "Revoke" })).toBeInTheDocument();
  });

  it("revoking a session calls the real endpoint and removes it from the list", async () => {
    mockApi();
    await openSecurityTab();
    await screen.findByText("Safari 17");

    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));

    await waitFor(() => expect(screen.queryByText("Safari 17")).not.toBeInTheDocument());
    expect(apiClient).toHaveBeenCalledWith(
      expect.stringContaining("/api/auth/Sessions/Revoke/session-other-device"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("signing out everywhere confirms, calls the endpoint, and logs the user out locally", async () => {
    mockApi();
    await openSecurityTab();
    await screen.findByText("Chrome 128");

    fireEvent.click(screen.getByRole("button", { name: /Sign out all/i }));

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith(
        expect.stringContaining("/api/auth/SignOutEverywhere"),
        expect.objectContaining({ method: "POST" })
      );
    });
    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/"));
    expect(localStorage.getItem("vmsUser")).toBeNull();
  });

  it("does not call sign-out-everywhere if the user cancels the confirmation", async () => {
    mockApi();
    window.confirm = jest.fn(() => false);
    await openSecurityTab();
    await screen.findByText("Chrome 128");

    fireEvent.click(screen.getByRole("button", { name: /Sign out all/i }));

    expect(apiClient).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/auth/SignOutEverywhere"),
      expect.anything()
    );
  });

  it("leaves Delete account disabled — no backend support exists for it yet", async () => {
    mockApi();
    await openSecurityTab();
    await screen.findByText("Chrome 128");

    expect(screen.getByRole("button", { name: /Delete/i })).toBeDisabled();
  });

  it("shows a retry option when the sessions request fails", async () => {
    apiClient.mockImplementation((url) => {
      if (url.includes("/api/Vendor/SettingDetails")) return jsonResponse({ status: 200, data: SETTING_DETAILS });
      if (url.includes("/api/auth/Sessions")) return jsonResponse({ status: 500, message: "boom" });
      return jsonResponse({ status: 200, data: null });
    });
    await openSecurityTab();

    await screen.findByText(/Couldn't load sessions/i);
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
