import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RoleEdit from "./RoleEdit";
import apiClient from "../../Config/apiClient";
import API_BASE_URL from "../../Config/api.config";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const jsonResponse = (data) => Promise.resolve({ ok: true, json: () => Promise.resolve(data) });

function mockApiClient() {
  apiClient.mockImplementation((url, options = {}) => {
    if (url.includes("/api/Permissions/GetAll")) {
      return jsonResponse({ status: 200, data: [{ id: 100, module: "SALES", name: "View Sales" }] });
    }
    if (url.includes("/api/Roles/GetByUkey/")) {
      return jsonResponse({
        status: 200,
        data: { id: 1, roleName: "Pharmacist", roleCode: "ROL001", permissions: [{ id: 100 }] },
      });
    }
    if (options.method === "PUT" && url.includes("/api/Roles/Update/")) {
      return jsonResponse({ status: 200 });
    }
    return jsonResponse({ status: 200, data: null });
  });
}

// Covers the id -> uKey conversion: the update request must target the
// role's uKey (the prop this modal is opened with), not a numeric id.
describe("RoleEdit update request", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiClient();
  });

  it("PUTs to Roles/Update/{uKey}, not Roles/Update/{id}", async () => {
    render(<RoleEdit uKey="role-ukey-1" onClose={jest.fn()} onSubmit={jest.fn()} />);

    const submitButton = await screen.findByRole("button", { name: /update role/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/Roles/Update/role-ukey-1`,
        expect.objectContaining({ method: "PUT" })
      );
    });
  });
});
