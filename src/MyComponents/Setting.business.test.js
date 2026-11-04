import { render, screen, waitFor } from "@testing-library/react";
import Settings from "./Setting";
import apiClient from "../Config/apiClient";
import { resetBusinessProfile } from "../utils/businessProfile";

jest.mock("../Config/apiClient");
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => jest.fn(),
}));

const json = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
const TYPES = [
  { value: "PHARMA", label: "Pharmacy / medical", tracksExpiryByDefault: true },
  { value: "GROCERY", label: "Grocery / FMCG", tracksExpiryByDefault: true },
  { value: "CLOTHING", label: "Clothing / textiles", tracksExpiryByDefault: false },
];

function mockApi(profile) {
  apiClient.mockImplementation((url, options = {}) => {
    if (url.includes("/api/Vendor/SettingDetails")) {
      return json({ status: 200, data: { shopName: "Test Shop", email: "v@example.com", drugLicenseNumber: "DL-1" } });
    }
    if (url.includes("/api/BusinessSetting/Save")) return json({ status: 200, message: "Clothing / textiles saved. Expiry dates are not tracked." });
    if (url.includes("/api/BusinessSetting/Get")) return json({ status: 200, data: { types: TYPES, ...profile } });
    return json({ status: 200, data: null });
  });
}

describe("Settings — the business type is set on the vendor, not here", () => {
  beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); resetBusinessProfile(); });

  it("there is no Business tab, and nothing saves a business type from Settings", async () => {
    mockApi({ businessType: "CLOTHING", trackExpiry: false, isPharma: false, canChange: true });
    render(<Settings />);
    await screen.findByText("Test Shop");
    expect(screen.queryByRole("button", { name: /^Business$/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId("business-type")).not.toBeInTheDocument();
    expect(apiClient.mock.calls.some(([u]) => u.includes("/api/BusinessSetting/Save"))).toBe(false);
  });

  it("the drug licence is asked only of a pharmacy", async () => {
    mockApi({ businessType: "CLOTHING", trackExpiry: false, isPharma: false, canChange: true });
    render(<Settings />);
    await screen.findByText("Test Shop");
    await waitFor(() => expect(apiClient.mock.calls.some(([u]) => u.includes("/api/BusinessSetting/Get"))).toBe(true));
    await waitFor(() => expect(screen.queryByText("Drug License Number")).not.toBeInTheDocument());
  });
});
