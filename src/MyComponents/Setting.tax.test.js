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
  tan: "ABCD12345E",
  email: "vendor@example.com",
};

const TDS_SETTING = {
  enabled: false,
  sectionCode: "194Q",
  thresholdAmount: 5000000,
  ratePercent: 0.1,
  ratePercentWithoutPan: 5,
};

const TCS_SETTING = {
  enabled: true,
  sectionCode: "206C(1H)",
  thresholdAmount: 5000000,
  ratePercent: 0.1,
  ratePercentWithoutPan: 1,
};

function mockApi() {
  apiClient.mockImplementation((url, options = {}) => {
    if (url.includes("/api/Vendor/SettingDetails")) return jsonResponse({ status: 200, data: SETTING_DETAILS });
    if (url.includes("/api/Vendor/UpdateVendorSetting")) return jsonResponse({ status: 200 });
    if (url.includes("/api/TdsSetting/Save")) return jsonResponse({ status: 200, data: { ...TDS_SETTING, enabled: true } });
    if (url.includes("/api/TdsSetting/Get")) return jsonResponse({ status: 200, data: TDS_SETTING });
    if (url.includes("/api/TcsSetting/Save")) return jsonResponse({ status: 200, data: TCS_SETTING });
    if (url.includes("/api/TcsSetting/Get")) return jsonResponse({ status: 200, data: TCS_SETTING });
    return jsonResponse({ status: 200, data: null });
  });
}

async function openTaxTab() {
  render(<Settings />);
  await screen.findByText("Test Shop");
  fireEvent.click(screen.getByRole("button", { name: /^Tax$/i }));
}

describe("Settings > Tax Configuration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it("loads TAN and the TDS/TCS enable state when the Tax tab is opened", async () => {
    mockApi();
    await openTaxTab();

    expect(await screen.findByDisplayValue("ABCD12345E")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Disabled" })).toBeInTheDocument(); // TDS
    expect(await screen.findByRole("button", { name: "Enabled" })).toBeInTheDocument(); // TCS
  });

  it("shows rate/threshold fields only once a rule is enabled", async () => {
    mockApi();
    await openTaxTab();

    await screen.findByRole("button", { name: "Disabled" });
    // TDS is disabled -> its section code field isn't shown; TCS is enabled -> its is.
    expect(await screen.findByDisplayValue("206C(1H)")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("194Q")).not.toBeInTheDocument();
  });

  it("enabling TDS and saving calls TdsSetting/Save with enabled true", async () => {
    mockApi();
    await openTaxTab();

    const tdsToggle = await screen.findByRole("button", { name: "Disabled" });
    await userEvent.click(tdsToggle);

    const saveButtons = await screen.findAllByRole("button", { name: /Save TDS Settings/i });
    await userEvent.click(saveButtons[0]);

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/TdsSetting/Save`,
        expect.objectContaining({ body: expect.stringContaining('"enabled":true') })
      );
    });
  });

  it("loads and saves the late-deposit interest rate alongside the TDS rate fields", async () => {
    mockApi();
    await openTaxTab();

    const tdsSectionInput = await screen.findByDisplayValue("206C(1H)"); // confirms tax tab loaded
    expect(tdsSectionInput).toBeInTheDocument();

    // TDS is disabled by default in this fixture -> enable it to reveal its rate rows.
    const tdsToggle = await screen.findByRole("button", { name: "Disabled" });
    await userEvent.click(tdsToggle);

    // Both TDS and TCS blocks are enabled at this point (TCS by fixture
    // default, TDS by the toggle above), so two "1.5" interest inputs exist
    // on screen -- index 0 is TDS's, matching saveButtons[0] below.
    const interestInputs = await screen.findAllByPlaceholderText("1.5");
    await userEvent.clear(interestInputs[0]);
    await userEvent.type(interestInputs[0], "2");

    const saveButtons = await screen.findAllByRole("button", { name: /Save TDS Settings/i });
    await userEvent.click(saveButtons[0]);

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/TdsSetting/Save`,
        expect.objectContaining({ body: expect.stringContaining('"lateDepositInterestRatePercent":2') })
      );
    });
  });

  it("editing TAN and saving Profile calls UpdateVendorSetting with the new TAN", async () => {
    mockApi();
    await openTaxTab();

    const tanInput = await screen.findByDisplayValue("ABCD12345E");
    await userEvent.clear(tanInput);
    await userEvent.type(tanInput, "wxyz98765f");

    const saveBar = await screen.findByRole("button", { name: /Save changes/i });
    await userEvent.click(saveBar);

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/Vendor/UpdateVendorSetting`,
        expect.objectContaining({ body: expect.stringContaining('"tan":"WXYZ98765F"') })
      );
    });
  });
});
