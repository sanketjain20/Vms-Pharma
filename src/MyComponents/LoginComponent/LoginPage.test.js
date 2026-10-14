import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "./LoginPage";
import apiClient from "../../Config/apiClient";
import API_BASE_URL from "../../Config/api.config";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

function jsonResponse(body) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}

const NO_MFA_LOGIN_DATA = {
  token: "real-jwt",
  vendorId: 1,
  name: "Owner",
  shopName: "Acme Pharmacy",
  vendorPrefix: "ACME",
};

const MFA_REQUIRED_DATA = {
  mfaRequired: true,
  mfaToken: "challenge-ukey",
  mfaMethods: [{ method: "EMAIL", maskedTarget: "o***@example.com" }],
  trustedDeviceDays: 30,
  codeSent: true,
  resendAvailableInSeconds: 60,
};

async function fillCredentialsAndSubmit() {
  render(<LoginPage />);
  await userEvent.type(screen.getByLabelText(/email address/i), "owner@example.com");
  await userEvent.type(screen.getByLabelText("Password"), "secret123");
  await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
}

describe("LoginPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it("sends a field rep to the rep app instead of the office home", async () => {
    apiClient.mockResolvedValue(jsonResponse({ status: 200, message: "ok", data: { ...NO_MFA_LOGIN_DATA, fieldRep: true } }));

    await fillCredentialsAndSubmit();

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/rep"));
    expect(mockNavigate).not.toHaveBeenCalledWith("/home");
  });

  it("logs in directly and stores vmsUser when MFA isn't required", async () => {
    apiClient.mockResolvedValue(jsonResponse({ status: 200, message: "ok", data: NO_MFA_LOGIN_DATA }));

    await fillCredentialsAndSubmit();

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/home"));
    expect(JSON.parse(localStorage.getItem("vmsUser")).data.token).toBe("real-jwt");
  });

  it("switches to the OTP step on a 202 response and never stores a token yet", async () => {
    apiClient.mockResolvedValue(jsonResponse({ status: 202, message: "Verification required", data: MFA_REQUIRED_DATA }));

    await fillCredentialsAndSubmit();

    expect(await screen.findByText(/verify it's you/i)).toBeInTheDocument();
    expect((await screen.findAllByText(/o\*\*\*@example\.com/i)).length).toBeGreaterThan(0);
    expect(localStorage.getItem("vmsUser")).toBeNull();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("verifying the OTP stores vmsUser and the device token, then navigates home", async () => {
    apiClient.mockImplementation((url) => {
      if (url.includes("/api/auth/login")) {
        return jsonResponse({ status: 202, message: "Verification required", data: MFA_REQUIRED_DATA });
      }
      if (url.includes("/api/auth/mfa/Verify")) {
        return jsonResponse({
          status: 200,
          message: "ok",
          data: { ...NO_MFA_LOGIN_DATA, deviceToken: "remembered-device-token" },
        });
      }
      return jsonResponse({ status: 200, data: null });
    });

    await fillCredentialsAndSubmit();
    await screen.findByText(/verify it's you/i);

    const otpCells = screen.getAllByRole("textbox");
    for (let i = 0; i < 6; i++) {
      await userEvent.type(otpCells[i], String((i + 1) % 10));
    }

    await userEvent.click(screen.getByRole("button", { name: /verify and sign in/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/home"));
    expect(JSON.parse(localStorage.getItem("vmsUser")).data.token).toBe("real-jwt");
    expect(localStorage.getItem("vmsDeviceToken")).toBe("remembered-device-token");
  });
});
