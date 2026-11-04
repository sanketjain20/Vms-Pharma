// Phase 4: the pharma-only parts of the app show for a pharmacy and are hidden for other shops.
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import apiClient from "../Config/apiClient";
import { resetBusinessProfile } from "../utils/businessProfile";
import { buildMenu, withoutRoutes } from "./CommonComponent/sidebarMenu";
import ProductForm from "./ProductComponent/ProductForm";
import SupplierAdd from "./SupplierComponent/SupplierAdd";
import Reports from "./ReportComponent/Reports";

jest.mock("../Config/apiClient");
jest.mock("./ReportComponent/LedgerCanvas", () => () => null);

const json = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
const CLOTHING = { businessType: "CLOTHING", trackExpiry: false, isPharma: false };
const PHARMA = { businessType: "PHARMA", trackExpiry: true, isPharma: true };

function mockApi(profile) {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/BusinessSetting/Get")) return json({ status: 200, data: profile });
    if (url.includes("/api/Reports/GetAllReports")) {
      return json({ status: 200, data: [{ name: "Sales Report", disabled: false }, { name: "Narcotic Register Report", disabled: false }] });
    }
    return json({ status: 200, data: [] });
  });
}
const profileRead = () => waitFor(() => expect(apiClient.mock.calls.some(([u]) => u.includes("/api/BusinessSetting/Get"))).toBe(true));

beforeEach(() => { jest.clearAllMocks(); resetBusinessProfile(); });

describe("sidebar", () => {
  const routes = (items) => items.flatMap((i) => (i.items ? routes(i.items) : i.type === "group" ? routes(i.children) : [i.route]));

  it("drops the Expiry Alerts page, and a sub menu left with one page becomes that page", () => {
    const menu = buildMenu(["ALERTS", "INVENTORY", "BATCH"]);
    expect(routes(menu)).toContain("/master/alerts");
    const without = withoutRoutes(menu, ["/master/alerts"]);
    expect(routes(without)).not.toContain("/master/alerts");
    expect(routes(without)).toContain("/master/reorder-alerts");
    expect(withoutRoutes(menu, [])).toBe(menu);
  });
});

describe("product form", () => {
  it.each([[PHARMA, true], [CLOTHING, false]])("generic name and schedule type for %o: %s", async (profile, shown) => {
    mockApi(profile);
    render(<ProductForm onSubmit={() => {}} onClose={() => {}} />);
    await profileRead();
    fireEvent.click(await screen.findByRole("button", { name: shown ? "Pharma" : "More details" }));
    await waitFor(() => expect(!!screen.queryByText("Schedule Type")).toBe(shown));
    expect(screen.getByText("HSN Code")).toBeInTheDocument(); // the shared fields stay
    expect(!!screen.queryByText("Generic / Salt Name")).toBe(shown);
  });
});

describe("supplier form", () => {
  it.each([[PHARMA, true], [CLOTHING, false]])("drug licence for %o: %s", async (profile, shown) => {
    mockApi(profile);
    render(<SupplierAdd onSubmit={() => {}} onClose={() => {}} />);
    await profileRead();
    await waitFor(() => expect(!!screen.queryByText("Drug License Number")).toBe(shown));
  });
});

describe("report list", () => {
  it.each([[PHARMA, true], [CLOTHING, false]])("the Narcotic Register for %o: %s", async (profile, shown) => {
    mockApi(profile);
    render(<MemoryRouter><Reports /></MemoryRouter>);
    expect((await screen.findAllByText("Sales Report")).length).toBeGreaterThan(0);
    await profileRead();
    await waitFor(() => expect(screen.queryAllByText("Narcotic Register Report").length > 0).toBe(shown));
  });
});
