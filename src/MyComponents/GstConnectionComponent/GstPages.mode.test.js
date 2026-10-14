import { render, screen, within } from "@testing-library/react";
import EInvoice from "../EInvoiceComponent/EInvoice";
import EwayBill from "../EwayBillComponent/EwayBill";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");

const json = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
const ch = { ready: true, problem: null, credentialSaved: false, credentialEnabled: false, credentialEnvironment: null, gstin: null };
const STATUS = {
  STUB: { mode: "STUB", level: "TEST", live: false, headline: "STUB MODE — e-invoices and e-way bills are simulated", detail: "Nothing is sent.", einvoice: ch, eway: ch },
  LIVE: { mode: "PRODUCTION", level: "LIVE", live: true, headline: "PRODUCTION MODE", detail: "Registered.", einvoice: ch, eway: ch },
};

const invoice = (o) => ({ salesUKey: "s-" + o.invoiceNumber, retailerName: "City Chemist", netAmount: 1000, irnStatus: "GENERATED", ackDate: "2026-10-03T10:00:00", cancellable: false, irpError: null, ...o });
const eway = (o) => ({ uKey: "e-" + o.ewayBillNo, supplyType: "O", docNo: "INV1", fromGstin: "27AAPFU0939F1ZV", toGstin: "27AAPFU0939F1ZV", transportDistanceKm: 10, status: "GENERATED", validUpto: "2026-10-04T10:00:00", ...o });

function mockApi({ status, listUrl, rows }) {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/Gst/Status")) return json({ status: 200, data: status });
    if (url.includes(listUrl)) return json({ status: 200, data: { content: rows, totalPages: 1, totalElements: rows.length } });
    return json({ status: 404, message: "unmocked " + url });
  });
}

beforeEach(() => jest.clearAllMocks());

describe("E-Invoices page", () => {
  const rows = [
    invoice({ invoiceNumber: "INV-1", irn: "a".repeat(64), mode: "STUB" }),
    invoice({ invoiceNumber: "INV-2", irn: "b".repeat(64), mode: "SANDBOX" }),
    invoice({ invoiceNumber: "INV-3", irn: "c".repeat(64), mode: "PRODUCTION" }),
    invoice({ invoiceNumber: "INV-4", irn: "d".repeat(64), mode: null }), // from before modes existed
    invoice({ invoiceNumber: "INV-5", irnStatus: "FAILED", irn: null, irpError: "GST-CREDENTIAL", mode: "SANDBOX" }),
  ];
  const row = (no) => screen.getByText(no).closest("tr");

  it("shows the mode banner at the top", async () => {
    mockApi({ status: STATUS.STUB, listUrl: "/api/EInvoice/GetAll", rows });
    render(<EInvoice />);
    expect(await screen.findByTestId("gst-mode-banner")).toHaveTextContent("STUB MODE — e-invoices and e-way bills are simulated");
  });

  it("tags simulated and sandbox IRNs as TEST, and leaves real and older ones untagged", async () => {
    mockApi({ status: STATUS.STUB, listUrl: "/api/EInvoice/GetAll", rows });
    render(<EInvoice />);
    await screen.findByText("INV-1");
    expect(within(row("INV-1")).getByText("TEST · simulated")).toBeInTheDocument();
    expect(within(row("INV-2")).getByText("TEST · sandbox")).toBeInTheDocument();
    expect(within(row("INV-3")).queryByText(/TEST/)).not.toBeInTheDocument();
    expect(within(row("INV-4")).queryByText(/TEST/)).not.toBeInTheDocument();
  });

  it("does not tag a failed invoice that has no IRN", async () => {
    mockApi({ status: STATUS.STUB, listUrl: "/api/EInvoice/GetAll", rows });
    render(<EInvoice />);
    await screen.findByText("INV-5");
    expect(within(row("INV-5")).queryByText(/TEST/)).not.toBeInTheDocument();
  });

  it("shows no warning banner once production is ready", async () => {
    mockApi({ status: STATUS.LIVE, listUrl: "/api/EInvoice/GetAll", rows });
    render(<EInvoice />);
    await screen.findByText("INV-3");
    expect(screen.queryByTestId("gst-mode-banner")).not.toBeInTheDocument();
  });

  it("still lists invoices when the status cannot be read", async () => {
    apiClient.mockImplementation((url) => (url.includes("/api/Gst/Status")
      ? Promise.reject(new Error("down"))
      : json({ status: 200, data: { content: rows, totalPages: 1, totalElements: rows.length } })));
    render(<EInvoice />);
    expect(await screen.findByText("INV-1")).toBeInTheDocument();
    expect(screen.queryByTestId("gst-mode-banner")).not.toBeInTheDocument();
  });
});

describe("E-Way Bills page", () => {
  const rows = [
    eway({ ewayBillNo: "111111111111", mode: "STUB" }),
    eway({ ewayBillNo: "222222222222", mode: "SANDBOX" }),
    eway({ ewayBillNo: "333333333333", mode: "PRODUCTION" }),
    eway({ ewayBillNo: null, uKey: "e-failed", status: "FAILED", mode: "SANDBOX" }),
  ];

  it("shows the mode banner and tags test e-way bills", async () => {
    mockApi({ status: STATUS.STUB, listUrl: "/api/EwayBill/GetAll", rows });
    render(<EwayBill />);
    expect(await screen.findByTestId("gst-mode-banner")).toHaveTextContent("STUB MODE");
    const tr = (no) => screen.getByText(no).closest("tr");
    expect(within(tr("111111111111")).getByText("TEST · simulated")).toBeInTheDocument();
    expect(within(tr("222222222222")).getByText("TEST · sandbox")).toBeInTheDocument();
    expect(within(tr("333333333333")).queryByText(/TEST/)).not.toBeInTheDocument();
  });

  it("does not tag an e-way bill that was never issued", async () => {
    mockApi({ status: STATUS.STUB, listUrl: "/api/EwayBill/GetAll", rows });
    render(<EwayBill />);
    await screen.findByText("111111111111");
    expect(screen.getAllByText(/^TEST/)).toHaveLength(2); // only the two issued test documents
  });
});
