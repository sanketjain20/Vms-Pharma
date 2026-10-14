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

const MFA_OFF = { globalEnabled: false, availableMethods: [], methods: [], trustedDevices: [] };

const MFA_ON_NOT_ENROLLED = {
  globalEnabled: true,
  availableMethods: ["EMAIL"],
  methods: [],
  trustedDevices: [],
  otpLength: 6,
  resendCooldownSeconds: 60,
  trustedDeviceEnabled: true,
  trustedDeviceDays: 30,
};

const MFA_POLICY = {
  enabled: true,
  emailEnabled: true,
  smsEnabled: false,
  authenticatorEnabled: false,
  smsImplemented: false,
  authenticatorImplemented: false,
  otpLength: 6,
  otpExpirySeconds: 300,
  resendCooldownSeconds: 60,
  maxResendAttempts: 3,
  resendBlockMinutes: 15,
  maxFailedAttempts: 5,
  lockoutMinutes: 15,
  trustedDeviceEnabled: true,
  trustedDeviceDays: 30,
};

function mockApi({ myMfa = MFA_OFF } = {}) {
  apiClient.mockImplementation((url, options = {}) => {
    if (url.includes("/api/Vendor/SettingDetails")) return jsonResponse({ status: 200, data: SETTING_DETAILS });
    if (url.includes("/api/auth/Sessions")) return jsonResponse({ status: 200, data: [] });
    if (url.includes("/api/Mfa/GetMyMfa")) return jsonResponse({ status: 200, data: myMfa });
    if (url.includes("/api/Mfa/EnableMethod")) {
      return jsonResponse({ status: 200, data: { mfaToken: "enroll-token", maskedTarget: "v***@example.com" } });
    }
    if (url.includes("/api/Mfa/ConfirmMethod")) return jsonResponse({ status: 200, message: "Two-step verification enabled." });
    if (url.includes("/api/MfaSetting/Get")) return jsonResponse({ status: 200, data: MFA_POLICY });
    if (url.includes("/api/MfaSetting/Save")) return jsonResponse({ status: 200, data: { ...MFA_POLICY, otpLength: 8 } });
    return jsonResponse({ status: 200, data: null });
  });
}

function setVmsUser(vendorPrefix) {
  localStorage.setItem("vmsUser", JSON.stringify({ status: 200, data: { token: "t", vendorPrefix } }));
}

async function openSecurityTab() {
  render(<Settings />);
  await screen.findByText("Test Shop");
  fireEvent.click(screen.getByRole("button", { name: /^Security$/i }));
}

describe("Settings > Two-step verification (Security tab)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it("shows a not-turned-on message when the admin hasn't enabled MFA globally", async () => {
    setVmsUser("ACME");
    mockApi({ myMfa: MFA_OFF });
    await openSecurityTab();

    expect(await screen.findByText(/hasn't turned on two-step verification/i)).toBeInTheDocument();
  });

  it("enabling email starts enrollment and shows the confirm-code step", async () => {
    setVmsUser("ACME");
    mockApi({ myMfa: MFA_ON_NOT_ENROLLED });
    await openSecurityTab();

    const enableButton = await screen.findByRole("button", { name: "Enable" });
    await userEvent.click(enableButton);

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/Mfa/EnableMethod`,
        expect.objectContaining({ body: JSON.stringify({ method: "EMAIL" }) })
      );
    });

    expect((await screen.findAllByText(/v\*\*\*@example\.com/i)).length).toBeGreaterThan(0);
  });

  it("confirming the enrollment code calls ConfirmMethod with the entered code", async () => {
    setVmsUser("ACME");
    mockApi({ myMfa: MFA_ON_NOT_ENROLLED });
    await openSecurityTab();

    await userEvent.click(await screen.findByRole("button", { name: "Enable" }));
    const codeInput = await screen.findByPlaceholderText("Enter code");
    await userEvent.type(codeInput, "123456");

    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/Mfa/ConfirmMethod`,
        expect.objectContaining({ body: JSON.stringify({ mfaToken: "enroll-token", code: "123456" }) })
      );
    });
  });
});

describe("Settings > MFA Policy tab (admin only)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it("is not shown to a non-admin (vendor with a prefix)", async () => {
    setVmsUser("ACME");
    mockApi();
    render(<Settings />);
    await screen.findByText("Test Shop");

    expect(screen.queryByRole("button", { name: /MFA Policy/i })).not.toBeInTheDocument();
  });

  it("is shown to the platform admin (blank vendor prefix) and loads the policy", async () => {
    setVmsUser(null);
    mockApi();
    render(<Settings />);
    await screen.findByText("Test Shop");

    fireEvent.click(screen.getByRole("button", { name: /MFA Policy/i }));

    expect((await screen.findAllByRole("button", { name: "Enabled" })).length).toBeGreaterThan(0);
    expect(await screen.findByDisplayValue("6")).toBeInTheDocument(); // Code length
  });

  it("saving the policy calls MfaSetting/Save with the edited values", async () => {
    setVmsUser(null);
    mockApi();
    render(<Settings />);
    await screen.findByText("Test Shop");
    fireEvent.click(screen.getByRole("button", { name: /MFA Policy/i }));

    const otpLengthInput = await screen.findByDisplayValue("6");
    await userEvent.clear(otpLengthInput);
    await userEvent.type(otpLengthInput, "8");

    await userEvent.click(screen.getByRole("button", { name: /Save MFA Policy/i }));

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/MfaSetting/Save`,
        expect.objectContaining({ body: expect.stringContaining('"otpLength":8') })
      );
    });
  });
});
