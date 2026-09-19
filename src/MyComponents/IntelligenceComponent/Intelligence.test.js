import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Intelligence from "./Intelligence";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");

function jsonResponse(body, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) });
}

const fullDashboard = {
  status: 200,
  data: {
    summary: {
      stockHealthPercent: 63,
      totalActiveProducts: 8,
      stockoutRiskCount: 1,
      deadStockCount: 1,
      deadStockValue: 24350,
      expiringSoonCount: 2,
      recommendedPurchaseCount: 1,
      recommendedPurchaseValue: 5200,
      highRiskRetailerCount: 1,
      totalOverdueFromRetailers: 9000,
      risingCostAlertCount: 1,
      lowMarginProductCount: 1,
      seasonalDemandAlertCount: 1,
    },
    topStockoutRisks: [
      {
        productUKey: "p1",
        productName: "Paracetamol",
        unit: "STRIP",
        currentStock: 6,
        avgDailySales: 2.0,
        daysOfStockRemaining: 3.0,
        riskLevel: "RED",
        reason: "• Selling ~2.0 units/day\n• 6 in stock",
      },
    ],
    topDeadStock: [
      { productUKey: "p2", productName: "Old Cough Syrup", stockValue: 24350, daysSinceLastSale: 87 },
    ],
    topExpiryAlerts: [
      { productName: "Amoxicillin", batchNumber: "B-100", expiryDate: "2026-10-01", daysToExpiry: 15, quantity: 40, value: 3200 },
    ],
    topPurchaseRecommendations: [
      {
        productUKey: "p3",
        productName: "Amoxicillin",
        unit: "STRIP",
        currentStock: 5,
        recommendedQty: 13,
        estimatedCost: 5200,
        expectedCoverageAfterPurchaseDays: 9.0,
        leadTimeDays: 7,
        leadTimeSource: "SUPPLIER",
        priceTrend: "RISING",
        priceTrendUpliftPercent: 20.0,
        buyBeforePriceIncrease: true,
        reason: "• Average daily sales: 2.0\n• Current stock: 5\n• Supplier cost for this product is RISING (+20.0%)",
      },
    ],
    topCollectionRisks: [
      {
        retailerUKey: "r1",
        shopName: "City Pharmacy",
        retailerCode: "RET001",
        outstandingBalance: 9000,
        overdueAmount: 9000,
        overdueInvoiceCount: 3,
        daysPastDueOldest: 40,
        riskLevel: "RED",
        reason: "• Total outstanding: ₹9000\n• Overdue: ₹9000 across 3 invoices",
      },
    ],
    topSupplierPriceTrends: [
      {
        productUKey: "p4",
        productName: "Amoxicillin",
        trend: "RISING",
        percentChange: 20.0,
        currentAvgCost: 12.0,
        currentSupplierName: "Supplier A",
        bestSupplierName: "Supplier B",
        bestSupplierAvgCost: 10.0,
        potentialSavingsPercent: 16.7,
        reason: "• Average cost, recent purchases: ₹12.00/unit\n• Trend: RISING",
      },
    ],
    profitIntelligence: {
      topProfitProducts: [
        { productUKey: "p5", productName: "Vitamin C", itemProfit: 900, revenue: 2000, marginPercent: 45.0 },
      ],
      lowMarginAlerts: [
        {
          productUKey: "p6",
          productName: "Cheap Syrup",
          marginPercent: 10.0,
          revenue: 1000,
          lowMargin: true,
          reason: "• Item-level profit: ₹100 (10.0% margin)",
        },
      ],
      lowMarginProductCount: 1,
      categoryBreakdown: [{ categoryName: "Syrups", productCount: 2, revenue: 3000, profit: 900, marginPercent: 30.0 }],
      totalRevenue: 5000,
      totalProfit: 1800,
      overallMarginPercent: 36.0,
    },
    topDemandForecasts: [
      {
        productUKey: "p7",
        productName: "Cough Syrup",
        peakDayOfWeek: "Monday",
        peakDayUpliftPercent: 120.0,
        peakMonth: "December",
        monthlyUpliftPercent: 45.0,
        seasonalityType: "BOTH",
        confidence: "HIGH",
        reason: "• Busiest day of the week: Monday — +120% vs. an average day\n• Busiest month: December — +45% vs. an average month",
      },
    ],
  },
};

const emptyDashboard = {
  status: 200,
  data: {
    summary: {
      stockHealthPercent: 100,
      totalActiveProducts: 4,
      stockoutRiskCount: 0,
      deadStockCount: 0,
      deadStockValue: 0,
      expiringSoonCount: 0,
      recommendedPurchaseCount: 0,
      recommendedPurchaseValue: 0,
      highRiskRetailerCount: 0,
      totalOverdueFromRetailers: 0,
      risingCostAlertCount: 0,
      lowMarginProductCount: 0,
      seasonalDemandAlertCount: 0,
    },
    topStockoutRisks: [],
    topDeadStock: [],
    topExpiryAlerts: [],
    topPurchaseRecommendations: [],
    topCollectionRisks: [],
    topSupplierPriceTrends: [],
    profitIntelligence: {
      topProfitProducts: [],
      lowMarginAlerts: [],
      lowMarginProductCount: 0,
      categoryBreakdown: [],
      totalRevenue: 0,
      totalProfit: 0,
      overallMarginPercent: 0,
    },
    topDemandForecasts: [],
  },
};

describe("VMS Intelligence dashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the title and the Overview tab by default", async () => {
    apiClient.mockReturnValue(jsonResponse(fullDashboard));

    render(<Intelligence />);

    expect(screen.getByText("VMS Intelligence")).toBeInTheDocument();
    expect(await screen.findByText("63%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /overview/i })).toBeInTheDocument();
  });

  it("navigates to the Restock tab when the 'Worth restocking' tile is clicked", async () => {
    apiClient.mockReturnValue(jsonResponse(fullDashboard));

    render(<Intelligence />);
    await screen.findByText("63%");

    await userEvent.click(screen.getByText("Worth restocking"));

    expect(await screen.findByText("Amoxicillin")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeInTheDocument();
  });

  it("expands the recommendation reason when 'Why?' is clicked on the Restock tab", async () => {
    apiClient.mockReturnValue(jsonResponse(fullDashboard));

    render(<Intelligence />);
    await screen.findByText("63%");
    await userEvent.click(screen.getByRole("button", { name: /^restock$/i }));

    const whyButton = await screen.findByRole("button", { name: "Why?" });
    expect(screen.queryByText(/Average daily sales: 2.0/)).not.toBeInTheDocument();

    await userEvent.click(whyButton);

    expect(screen.getByText(/Average daily sales: 2.0/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide" })).toBeInTheDocument();
  });

  it("applies custom settings as query params from the Restock tab", async () => {
    apiClient.mockReturnValue(jsonResponse(fullDashboard));

    render(<Intelligence />);
    await screen.findByText("63%");
    await userEvent.click(screen.getByRole("button", { name: /^restock$/i }));
    apiClient.mockClear();

    await userEvent.type(screen.getByLabelText(/Target coverage/i), "45");
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));

    await screen.findByText("Amoxicillin");
    const lastCallUrl = apiClient.mock.calls[apiClient.mock.calls.length - 1][0];
    expect(lastCallUrl).toContain("targetCoverageDays=45");
  });

  it("shows retailer collection risk on the Collections tab", async () => {
    apiClient.mockReturnValue(jsonResponse(fullDashboard));

    render(<Intelligence />);
    await screen.findByText("63%");
    await userEvent.click(screen.getByRole("button", { name: /collections/i }));

    expect(await screen.findByText("City Pharmacy")).toBeInTheDocument();
    expect(screen.getByText("High risk")).toBeInTheDocument();
  });

  it("shows supplier price trends on the Suppliers tab", async () => {
    apiClient.mockReturnValue(jsonResponse(fullDashboard));

    render(<Intelligence />);
    await screen.findByText("63%");
    await userEvent.click(screen.getByRole("button", { name: /suppliers/i }));

    expect(await screen.findByText("Supplier B (₹10/unit)")).toBeInTheDocument();
    expect(screen.getByText("Rising")).toBeInTheDocument();
  });

  it("shows top profit products and low-margin alerts on the Profit tab", async () => {
    apiClient.mockReturnValue(jsonResponse(fullDashboard));

    render(<Intelligence />);
    await screen.findByText("63%");
    await userEvent.click(screen.getByRole("button", { name: /^profit$/i }));

    expect(await screen.findByText("Vitamin C")).toBeInTheDocument();
    expect(screen.getByText("Cheap Syrup")).toBeInTheDocument();
  });

  it("shows weekday and monthly demand patterns on the Forecast tab", async () => {
    apiClient.mockReturnValue(jsonResponse(fullDashboard));

    render(<Intelligence />);
    await screen.findByText("63%");
    await userEvent.click(screen.getByRole("button", { name: /forecast/i }));

    expect(await screen.findByText("Cough Syrup")).toBeInTheDocument();
    expect(screen.getByText(/Monday/)).toBeInTheDocument();
    expect(screen.getByText(/December/)).toBeInTheDocument();
  });

  it("flags a purchase recommendation to buy before the price rises", async () => {
    apiClient.mockReturnValue(jsonResponse(fullDashboard));

    render(<Intelligence />);
    await screen.findByText("63%");
    await userEvent.click(screen.getByRole("button", { name: /^restock$/i }));

    expect(await screen.findByText("Buy before price rises")).toBeInTheDocument();
  });

  it("applies an advanced threshold override as a query param", async () => {
    apiClient.mockReturnValue(jsonResponse(fullDashboard));

    render(<Intelligence />);
    await screen.findByText("63%");
    await userEvent.click(screen.getByRole("button", { name: /^restock$/i }));
    apiClient.mockClear();

    await userEvent.click(screen.getByText("Advanced thresholds"));
    await userEvent.type(screen.getByLabelText(/Dead stock/i), "30");
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));

    await screen.findByText("Amoxicillin");
    const lastCallUrl = apiClient.mock.calls[apiClient.mock.calls.length - 1][0];
    expect(lastCallUrl).toContain("deadStockThresholdDays=30");
  });

  it("shows empty-state copy on every tab when nothing needs attention", async () => {
    apiClient.mockReturnValue(jsonResponse(emptyDashboard));

    render(<Intelligence />);
    await screen.findByText("Nothing urgent right now — everything looks healthy.");

    await userEvent.click(screen.getByRole("button", { name: /^restock$/i }));
    expect(screen.getByText(/No purchases recommended right now/i)).toBeInTheDocument();
    expect(screen.getByText("No products at risk of stocking out.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /collections/i }));
    expect(screen.getByText("No retailers with overdue payments right now.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /forecast/i }));
    expect(screen.getByText(/No strong weekday patterns detected yet/i)).toBeInTheDocument();
  });

  it("shows an error message when the API call fails", async () => {
    apiClient.mockReturnValue(jsonResponse({ status: 500, message: "Server error" }));

    render(<Intelligence />);

    expect(await screen.findByText("Server error")).toBeInTheDocument();
  });
});
