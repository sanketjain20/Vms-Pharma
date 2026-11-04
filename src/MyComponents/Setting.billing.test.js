import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Settings from "./Setting";
import apiClient from "../Config/apiClient";

jest.mock("../Config/apiClient");

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => jest.fn(),
}));

const json = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

function mockApi({ allowCustomItems, canChange }) {
  apiClient.mockImplementation((url, options = {}) => {
    if (url.includes("/api/Vendor/SettingDetails")) return json({ status: 200, data: { shopName: "Test Shop", email: "v@example.com" } });
    if (url.includes("/api/Sales/CustomItemSetting") && options.method === "PUT") {
      return json({ status: 200, message: "Custom items are now allowed on bills." });
    }
    if (url.includes("/api/Sales/CustomItemSetting")) return json({ status: 200, data: { allowCustomItems, canChange } });
    return json({ status: 200, data: null });
  });
}

const putCall = () => apiClient.mock.calls.find(([u, o]) => u.includes("/api/Sales/CustomItemSetting") && o?.method === "PUT");

async function openBilling() {
  render(<Settings />);
  await screen.findByText("Test Shop");
  fireEvent.click(screen.getByRole("button", { name: /^Billing$/ }));
}

describe("Settings > Billing — custom items switch", () => {
  beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); });

  it("the main account turns custom items on", async () => {
    mockApi({ allowCustomItems: false, canChange: true });
    await openBilling();

    const toggle = await screen.findByTestId("custom-items-toggle");
    expect(toggle).toHaveTextContent("Disabled");
    fireEvent.click(toggle);

    await waitFor(() => expect(putCall()).toBeTruthy());
    expect(JSON.parse(putCall()[1].body)).toEqual({ allowCustomItems: true });
    await waitFor(() => expect(screen.getByTestId("custom-items-toggle")).toHaveTextContent("Enabled"));
    expect(await screen.findByText("Custom items are now allowed on bills.")).toBeInTheDocument();
  });

  it("a sub-account sees the setting but cannot change it", async () => {
    mockApi({ allowCustomItems: true, canChange: false });
    await openBilling();

    const toggle = await screen.findByTestId("custom-items-toggle");
    expect(toggle).toHaveTextContent("Enabled");
    expect(toggle).toBeDisabled();
    expect(screen.getByText("Only the shop's main account can change this setting.")).toBeInTheDocument();
  });
});

describe("Settings > Billing — round-off switch", () => {
  beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); });

  const roundPut = () => apiClient.mock.calls.find(([u, o]) => u.includes("/api/Sales/RoundOffSetting") && o?.method === "PUT");

  it("is on by default and the main account switches it off", async () => {
    apiClient.mockImplementation((url, options = {}) => {
      if (url.includes("/api/Vendor/SettingDetails")) return json({ status: 200, data: { shopName: "Test Shop", email: "v@example.com" } });
      if (url.includes("/api/Sales/RoundOffSetting")) return json({ status: 200, message: "Bill totals are no longer rounded." });
      if (url.includes("/api/Sales/CustomItemSetting")) return json({ status: 200, data: { allowCustomItems: false, canChange: true } });
      return json({ status: 200, data: null });
    });
    await openBilling();

    const toggle = await screen.findByTestId("round-off-toggle");
    expect(toggle).toHaveTextContent("Enabled");
    fireEvent.click(toggle);

    await waitFor(() => expect(roundPut()).toBeTruthy());
    expect(JSON.parse(roundPut()[1].body)).toEqual({ roundBillTotal: false });
    await waitFor(() => expect(screen.getByTestId("round-off-toggle")).toHaveTextContent("Disabled"));
    expect(await screen.findByText("Bill totals are no longer rounded.")).toBeInTheDocument();
  });

  it("a sub-account cannot change it", async () => {
    mockApi({ allowCustomItems: true, canChange: false });
    await openBilling();
    expect(await screen.findByTestId("round-off-toggle")).toBeDisabled();
  });
});
