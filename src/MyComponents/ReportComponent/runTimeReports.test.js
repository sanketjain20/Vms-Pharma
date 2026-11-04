import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import apiClient from "../../Config/apiClient";
import { ReportEntity } from "../Enums/ReportEntity";
import { RUN_TIME_REPORTS, runTimeReportIdByName, cardValue, canSeeReport } from "./runTimeReports";
import Reports from "./Reports";
import { resetBusinessProfile } from "../../utils/businessProfile";
import { runReportByModule } from "./ReportService";
import GenerateReport from "./GenerateReport";
import OpenReport from "./OpenReport";

jest.mock("../../Config/apiClient");
jest.mock("./LedgerCanvas", () => () => null);

// jsdom has no canvas: give the decorative background a 2D context that accepts every call and draws nothing
const noopContext = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => noopContext), set: (t, k, v) => { t[k] = v; return true; } });
beforeAll(() => { HTMLCanvasElement.prototype.getContext = () => noopContext; });

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), blob: () => Promise.resolve(new Blob(["x"])) });
const call = (part) => apiClient.mock.calls.find(([u]) => u.includes(part));

describe("run-time reports — config", () => {
  it("opens the right report by name, before the older Sales / Customer rules could claim it", () => {
    expect(runTimeReportIdByName("Custom Item Sales Report")).toBe(ReportEntity.CustomItemSales);
    expect(runTimeReportIdByName("Daily Sales Finance Report")).toBe(ReportEntity.DailySalesFinance);
    expect(runTimeReportIdByName("Walk-in Customer Report")).toBe(ReportEntity.WalkInCustomer);
    expect(runTimeReportIdByName("Sales Report")).toBeNull();
    expect(runTimeReportIdByName("Retailer/Customer Report")).toBeNull();
    expect(runTimeReportIdByName(undefined)).toBeNull();
  });

  it("shows money cards in rupees and the rest as they are", () => {
    const money = RUN_TIME_REPORTS[ReportEntity.DailySalesFinance].cards.find((c) => c.key === "netSales");
    const plain = RUN_TIME_REPORTS[ReportEntity.DailySalesFinance].cards.find((c) => c.key === "bills");
    expect(cardValue(money, { netSales: 123456.5 })).toBe("₹1,23,456.50");
    expect(cardValue(plain, { bills: 7 })).toBe("7");
    expect(cardValue(plain, {})).toBe("—");
  });

  it("every report has a data and a download endpoint", () => {
    Object.values(RUN_TIME_REPORTS).forEach((r) => {
      expect(r.data).toMatch(/\/api\/Reports\/\w+ReportData$/);
      expect(r.download).toMatch(/\/api\/Reports\/\w+Report$/);
    });
  });
});

describe("run-time reports — screens", () => {
  beforeEach(() => jest.clearAllMocks());

  it("the quick download posts the filters (blanks as null) to the report's Excel endpoint", async () => {
    apiClient.mockImplementation(() => ok({}));
    await runReportByModule(ReportEntity.WalkInCustomer, { fromDate: "2026-10-01", customer: "" });
    const [url, opts] = apiClient.mock.calls[0];
    expect(url).toMatch(/\/api\/Reports\/WalkInCustomerReport$/);
    expect(JSON.parse(opts.body)).toEqual({ fromDate: "2026-10-01", customer: null });
  });

  it("the filter page of Daily Sales Finance loads its own filters, not the Sales report's", async () => {
    apiClient.mockImplementation(() => ok({ status: 200, data: ["From Date", "To Date"] }));
    render(
      <MemoryRouter initialEntries={[{ pathname: "/master/reports/open", state: { reportName: "Daily Sales Finance Report" } }]}>
        <OpenReport />
      </MemoryRouter>
    );
    await waitFor(() => expect(call("/api/Filters/GetFiltersByModule/")).toBeTruthy());
    expect(call("/api/Filters/GetFiltersByModule/")[0]).toMatch(/GetFiltersByModule\/21$/);
  });

  it("the Custom Item Sales filters offer the shop's custom item names", async () => {
    apiClient.mockImplementation((url) => (url.includes("CustomItemFilterData")
      ? ok({ status: 200, data: { itemName: ["Alteration", "Blue kurta"] } })
      : ok({ status: 200, data: ["From Date", "To Date", "Item Name", "Customer", "View"] })));
    render(
      <MemoryRouter initialEntries={[{ pathname: "/master/reports/open", state: { reportName: "Custom Item Sales Report" } }]}>
        <OpenReport />
      </MemoryRouter>
    );
    await waitFor(() => expect(call("/api/Reports/CustomItemFilterData")).toBeTruthy());
    expect(call("/api/Filters/GetFiltersByModule/")[0]).toMatch(/GetFiltersByModule\/20$/);
  });

  it("the report page shows the totals as cards and one row per day", async () => {
    apiClient.mockImplementation((url) => {
      if (url.includes("GetFieldByModuleId")) return ok({ status: 200, data: ["Date", "Bills", "Custom Sales", "Net Sales"] });
      if (url.includes("DailySalesFinanceReportData")) {
        return ok({
          status: 200,
          data: {
            rows: [
              { date: "2026-10-20", bills: 3, customSales: 650, netSales: 1750 },
              { date: "2026-10-19", bills: 1, customSales: 0, netSales: 118 },
            ],
            summary: { period: "2026-10-01 to 2026-10-20", bills: 4, netSales: 1868, customSales: 650 },
          },
        });
      }
      return ok({ status: 200, data: null });
    });
    render(
      <MemoryRouter initialEntries={[{ pathname: "/master/reports/generate",
        state: { moduleId: ReportEntity.DailySalesFinance, reportName: "Daily Sales Finance Report", filters: { fromDate: "2026-10-01" } } }]}>
        <GenerateReport />
      </MemoryRouter>
    );

    expect(await screen.findByTestId("runtime-summary")).toBeInTheDocument();
    expect(screen.getByTestId("card-netSales")).toHaveTextContent("₹1,868.00");
    expect(screen.getByTestId("card-period")).toHaveTextContent("2026-10-01 to 2026-10-20");
    expect(await screen.findByText("2026-10-19")).toBeInTheDocument(); // rows without an invoice number stay separate
    expect(screen.getByText("2026-10-20")).toBeInTheDocument();
    expect(JSON.parse(call("DailySalesFinanceReportData")[1].body)).toMatchObject({ fromDate: "2026-10-01" });
  });
});

describe("run-time reports — permissions", () => {
  // the keys a role has: its Report-module action names, lower-cased and split on "/" (as Reports.js builds them)
  const keys = (...actions) => actions.flatMap((a) => a.split("/")).map((k) => k.toLowerCase());

  it("the Sales and Customer permissions no longer open the run-time reports", () => {
    const salesAndCustomer = keys("Sales", "Retailer/Customer");
    expect(canSeeReport("Sales Report", salesAndCustomer)).toBe(true);
    expect(canSeeReport("Retailer/Customer Report", salesAndCustomer)).toBe(true);
    expect(canSeeReport("Custom Item Sales Report", salesAndCustomer)).toBe(false);
    expect(canSeeReport("Daily Sales Finance Report", salesAndCustomer)).toBe(false);
    expect(canSeeReport("Walk-in Customer Report", salesAndCustomer)).toBe(false);
  });

  it("each run-time report opens with its own permission only", () => {
    const own = keys("Custom Item Sales", "Walk-in Customer");
    expect(canSeeReport("Custom Item Sales Report", own)).toBe(true);
    expect(canSeeReport("Walk-in Customer Report", own)).toBe(true);
    expect(canSeeReport("Daily Sales Finance Report", own)).toBe(false);
    expect(canSeeReport("Sales Report", own)).toBe(false, "its own permission opens nothing else");
  });

  it("with no access list loaded, everything shows, as before", () => {
    expect(canSeeReport("Daily Sales Finance Report", [])).toBe(true);
  });

  it("the report list shows a role only the reports it was granted", async () => {
    jest.clearAllMocks();
    resetBusinessProfile();
    localStorage.setItem("roleId", "4");
    apiClient.mockImplementation((url) => {
      if (url.includes("/api/Access/GetUserModuleAccess/")) return ok({ status: 200, data: ["Sales", "Daily Sales Finance"] });
      if (url.includes("/api/Reports/GetAllReports")) {
        return ok({ status: 200, data: ["Sales Report", "Custom Item Sales Report", "Daily Sales Finance Report", "Walk-in Customer Report"]
          .map((name) => ({ name, disabled: false })) });
      }
      return ok({ status: 200, data: null });
    });
    render(<MemoryRouter><Reports /></MemoryRouter>);

    await waitFor(() => expect(screen.queryAllByText("Daily Sales Finance Report").length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.queryAllByText("Custom Item Sales Report")).toHaveLength(0));
    expect(screen.queryAllByText("Walk-in Customer Report")).toHaveLength(0);
    expect(screen.queryAllByText("Sales Report").length).toBeGreaterThan(0);
  });
});
