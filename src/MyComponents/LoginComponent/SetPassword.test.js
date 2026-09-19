import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { toast } from "react-toastify";
import SetPassword from "./SetPassword";

jest.mock("react-toastify", () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));

// StrictMode is what the real app renders under (src/index.js) — it double-invokes
// effects in dev (setup → cleanup → setup on the same mount), which previously broke
// this component: the throwaway first invocation's cleanup flipped its own local
// `cancelled` flag before the fetch resolved, silently discarding the result forever.
// Rendering under StrictMode here catches that class of regression.
function renderAt(path) {
  return render(
    <React.StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/set-password" element={<SetPassword />} />
          <Route path="/" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    </React.StrictMode>
  );
}

describe("SetPassword", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    global.fetch = jest.fn();
  });

  it("shows the read-only email and the password form for a valid token", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 200, message: "Link is valid.", data: "invitee@example.com" }),
    });

    renderAt("/set-password?token=abc123");

    expect(await screen.findByText("invitee@example.com")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
  });

  it("shows an error state and no form for an invalid/expired token", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ status: 404, message: "This link is invalid or has expired." }),
    });

    renderAt("/set-password?token=expired");

    expect(await screen.findByText(/invalid or has expired/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
  });

  it("shows the error state when there is no token at all", async () => {
    renderAt("/set-password");

    expect(await screen.findByText(/invalid or has expired/i)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("submits the token and new password to /api/auth/SetPassword", async () => {
    global.fetch.mockImplementation((url) => {
      if (url.includes("/api/auth/ValidateSetupToken")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ status: 200, message: "Link is valid.", data: "invitee@example.com" }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ status: 200, message: "Password set successfully. You can now log in." }),
      });
    });

    renderAt("/set-password?token=abc123");

    await screen.findByLabelText("New password");
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "NewPassw0rd!" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "NewPassw0rd!" } });
    fireEvent.click(screen.getByRole("button", { name: /set password/i }));

    await waitFor(() => expect(toast.success).toHaveBeenCalled());

    const setPasswordCall = global.fetch.mock.calls.find(([url]) => url.includes("/api/auth/SetPassword"));
    expect(setPasswordCall).toBeDefined();
    const [, options] = setPasswordCall;
    expect(JSON.parse(options.body)).toEqual({ token: "abc123", password: "NewPassw0rd!" });
  });

  it("rejects mismatched passwords client-side without calling the API", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 200, message: "Link is valid.", data: "invitee@example.com" }),
    });

    renderAt("/set-password?token=abc123");

    await screen.findByLabelText("New password");
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "NewPassw0rd!" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "SomethingElse!" } });
    fireEvent.click(screen.getByRole("button", { name: /set password/i }));

    expect(toast.error).toHaveBeenCalledWith("Passwords do not match");
    expect(global.fetch.mock.calls.some(([url]) => url.includes("/api/auth/SetPassword"))).toBe(false);
  });
});
