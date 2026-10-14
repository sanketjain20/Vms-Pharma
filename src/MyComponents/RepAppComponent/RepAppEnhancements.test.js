import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import RepApp from "./RepApp";
import { createMemoryDb, STORES, setMeta } from "./repDb";
import { STATE, queueCollection } from "./repSync";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

const BEAT = [
  { beatUKey: "b1", retailerId: 11, retailerCode: "R1", shopName: "City Chemist", ownerName: "Mr Shah", visitDay: null, outstandingBalance: 5000, lastVisitAt: daysAgo(16) },
  { beatUKey: "b2", retailerId: 12, retailerCode: "R2", shopName: "Fresh Pharma", ownerName: null, visitDay: null, outstandingBalance: 0, lastVisitAt: null },
];
const INVOICES = [
  { salesId: 1, invoiceNumber: "INV-001", retailerId: 11, invoiceDate: "2026-09-01T10:00:00", dueDate: "2026-09-20", netAmount: 3000, remainingAmount: 3000 },
  { salesId: 2, invoiceNumber: "INV-002", retailerId: 11, invoiceDate: "2026-09-10T10:00:00", dueDate: "2026-10-30", netAmount: 2000, remainingAmount: 2000 },
  { salesId: 9, invoiceNumber: "INV-OTHER", retailerId: 12, invoiceDate: "2026-09-10T10:00:00", dueDate: null, netAmount: 700, remainingAmount: 700 },
];
const ok = (data) => ({ ok: true, status: 200, data });
const offlineApi = () => ({ ...makeApi(), sync: jest.fn(async () => ({ ok: false, networkError: true, message: "off" })) });
// a phone that has already downloaded its beat once, now without a connection
async function seeded(db) {
  await setMeta(db, "retailers", BEAT);
  await setMeta(db, "serverInvoices", INVOICES);
  await setMeta(db, "catalog", []);
  return db;
}

function makeApi({ progress = null, invoices = INVOICES, myHandovers = [], handoverVerdict = "ACCEPTED" } = {}) {
  return {
    catalog: jest.fn(async () => ok([])),
    retailers: jest.fn(async () => ok(BEAT)),
    myOrders: jest.fn(async () => ok([])),
    myCollections: jest.fn(async () => ok([])),
    profile: jest.fn(async () => ok({ name: "Ravi Kumar" })),
    invoices: jest.fn(async () => ok(invoices)),
    myHandovers: jest.fn(async () => ok(myHandovers)),
    progress: jest.fn(async () => ok(progress)),
    sync: jest.fn(async (body) => ok({
      orders: [], visits: [],
      collections: (body.collections || []).map((c) => ({ clientCollectionId: c.clientCollectionId, status: "ACCEPTED", message: "" })),
      handovers: (body.handovers || []).map((h) => ({ clientHandoverId: h.clientHandoverId, status: handoverVerdict, message: handoverVerdict === "INVALID" ? "Server said no" : "", expectedCash: 300 })),
    })),
  };
}

function renderApp({ api = makeApi(), db = createMemoryDb() } = {}) {
  localStorage.setItem("vmsUser", JSON.stringify({ status: 200, data: { name: "Ravi Rep", vendorId: 7, token: "t", fieldRep: true, shopName: "Acme Pharma" } }));
  render(
    <MemoryRouter initialEntries={["/rep"]}>
      <Routes>
        <Route path="/rep" element={<RepApp db={db} api={api} getPosition={jest.fn()} />} />
        <Route path="/" element={<div>login</div>} />
      </Routes>
    </MemoryRouter>
  );
  return { api, db };
}

const openCollect = async () => {
  await screen.findByText("City Chemist");
  fireEvent.click(screen.getByRole("tab", { name: /^Collect/ }));
};

beforeEach(() => {
  jest.clearAllMocks();
  apiClient.mockResolvedValue({ ok: true, json: async () => ({ status: 200 }) });
});
afterEach(() => localStorage.clear());

describe("RepApp — last visit and targets on the beat", () => {
  it("shows how long since each retailer was visited, and flags the ones never visited", async () => {
    renderApp();
    const city = (await screen.findByText("City Chemist")).closest(".ra-card");
    expect(within(city).getByText("Visited 16 days ago")).toHaveClass("ra-lastvisit--bad");
    const fresh = screen.getByText("Fresh Pharma").closest(".ra-card");
    expect(within(fresh).getByText("Not visited yet")).toBeInTheDocument();
  });

  it("a check-in made on this phone counts straight away, even before it has synced", async () => {
    const db = createMemoryDb();
    await db.put(STORES.VISITS, { clientVisitId: "v1", retailerId: 11, retailerName: "City Chemist", capturedAt: new Date().toISOString(), state: STATE.PENDING });
    renderApp({ db: await seeded(db), api: offlineApi() });
    expect(await screen.findByText("Visited today")).toHaveClass("ra-lastvisit--ok");
  });

  it("shows target progress bars only for targets that were set", async () => {
    renderApp({ api: makeApi({ progress: { month: "2026-10", daysInMonth: 31, daysLeft: 20, ordersValue: 4000, collections: 0, checkIns: 3, targetOrdersValue: 10000, targetCollections: null, targetCheckIns: 20 } }) });
    const box = await screen.findByLabelText("Your targets this month");
    expect(within(box).getByText(/₹4,000.00 of ₹10,000.00 · 40%/)).toBeInTheDocument();
    expect(within(box).getByText(/3 of 20 · 15%/)).toBeInTheDocument();
    expect(within(box).queryByText("Collections")).not.toBeInTheDocument();
    expect(within(box).queryByText(/office counts confirmed payments only/)).not.toBeInTheDocument(); // no collections target, no caveat
    expect(within(box).getByText("20 days left")).toBeInTheDocument();
  });

  it("explains that collections include money the office hasn't confirmed, when there is a collections target", async () => {
    renderApp({ api: makeApi({ progress: { month: "2026-10", daysInMonth: 31, daysLeft: 20, ordersValue: 0, collections: 500, checkIns: 0, targetOrdersValue: null, targetCollections: 1000, targetCheckIns: null } }) });
    const box = await screen.findByLabelText("Your targets this month");
    expect(within(box).getByText(/₹500.00 of ₹1,000.00 · 50%/)).toBeInTheDocument();
    expect(within(box).getByText(/office counts confirmed payments only/)).toBeInTheDocument();
  });

  it("shows no targets card when none are set", async () => {
    renderApp();
    await screen.findByText("City Chemist");
    expect(screen.queryByLabelText("Your targets this month")).not.toBeInTheDocument();
  });
});

describe("RepApp — collecting against an invoice", () => {
  const pick = async (retailerId = "11") => {
    await openCollect();
    fireEvent.change(await screen.findByLabelText("Retailer"), { target: { value: retailerId } });
  };

  it("offers only that retailer's open invoices, oldest due first", async () => {
    renderApp();
    await pick();
    const select = await screen.findByLabelText("Apply to");
    const labels = within(select).getAllByRole("option").map((o) => o.textContent);
    expect(labels[0]).toMatch(/Account balance/);
    expect(labels[1]).toMatch(/INV-001/);
    expect(labels[2]).toMatch(/INV-002/);
    expect(labels).toHaveLength(3);
    expect(select.textContent).not.toMatch(/INV-OTHER/);
  });

  it("'Full invoice' fills the amount, and saving sends the invoice id", async () => {
    const { api } = renderApp();
    await pick();
    fireEvent.change(await screen.findByLabelText("Apply to"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Full invoice" }));
    expect(screen.getByLabelText("Amount collected (₹)")).toHaveValue("3000.00");
    fireEvent.click(screen.getByRole("button", { name: "Save collection" }));
    await waitFor(() => expect(api.sync.mock.calls.some((c) => (c[0].collections || []).some((x) => x.invoiceId === 1 && x.amount === 3000))).toBe(true));
    expect(await screen.findByText("Against invoice INV-001")).toBeInTheDocument();
  });

  it("won't take more than the invoice has left", async () => {
    renderApp();
    await pick();
    fireEvent.change(await screen.findByLabelText("Apply to"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Amount collected (₹)"), { target: { value: "2500" } });
    fireEvent.click(screen.getByRole("button", { name: "Save collection" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That invoice only has ₹2000.00 left to collect.");
  });

  it("subtracts what this rep already collected against the invoice but the office hasn't booked", async () => {
    const db = createMemoryDb();
    await queueCollection(db, { retailerId: 11, retailerName: "City Chemist", amount: 1000, mode: "UPI", invoiceId: 1, invoiceNumber: "INV-001" });
    renderApp({ db: await seeded(db), api: offlineApi() });
    await pick();
    const select = await screen.findByLabelText("Apply to");
    expect(within(select).getByRole("option", { name: /INV-001.*₹2,000.00 left/ })).toBeInTheDocument();
  });

  it("changing the retailer clears the chosen invoice, and no picker shows when there are no invoices", async () => {
    renderApp({ api: makeApi({ invoices: [] }) });
    await pick();
    expect(screen.queryByLabelText("Apply to")).not.toBeInTheDocument();
  });
});

describe("RepApp — receipt", () => {
  const withCollection = async (extra = {}) => {
    const db = createMemoryDb();
    await queueCollection(db, { retailerId: 11, retailerName: "City Chemist", amount: 2500.5, mode: "UPI", reference: "T123", invoiceId: 1, invoiceNumber: "INV-001", ...extra });
    return db;
  };

  it("opens a receipt with amount in words, the invoice, and a 'pending' wording until confirmed", async () => {
    renderApp({ db: await withCollection() });
    await openCollect();
    fireEvent.click(await screen.findByRole("button", { name: "Receipt for City Chemist" }));
    const sheet = within(await screen.findByTestId("receipt-sheet"));
    expect(sheet.getByText("₹2,500.50")).toBeInTheDocument();
    expect(sheet.getByText("Rupees Two Thousand Five Hundred and Fifty Paise only")).toBeInTheDocument();
    expect(sheet.getByText("Invoice INV-001")).toBeInTheDocument();
    expect(sheet.getByText(/UPI · Ref T123/)).toBeInTheDocument();
    expect(sheet.getByText(/Pending confirmation by Acme Pharma/)).toBeInTheDocument();
    expect(sheet.getByText("Acme Pharma")).toBeInTheDocument();
  });

  it("closes with Escape and the Close button", async () => {
    renderApp({ db: await withCollection() });
    await openCollect();
    fireEvent.click(await screen.findByRole("button", { name: "Receipt for City Chemist" }));
    await screen.findByRole("dialog", { name: "Payment receipt" });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Receipt for City Chemist" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("gives no receipt for a collection the server refused", async () => {
    const api = makeApi();
    api.sync.mockImplementation(async (body) => ok({ orders: [], visits: [], collections: (body.collections || []).map((c) => ({ clientCollectionId: c.clientCollectionId, status: "INVALID", message: "Not on your beat" })) }));
    renderApp({ db: await withCollection(), api });
    await openCollect();
    expect(await screen.findByText("Not on your beat")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Receipt for City Chemist" })).not.toBeInTheDocument();
  });
});

describe("RepApp — day close", () => {
  const cash = async (db, retailerName, amount, retailerId = 11) =>
    queueCollection(db, { retailerId, retailerName, amount, mode: "CASH" });

  const openClose = async () => {
    await openCollect();
    fireEvent.click(await screen.findByRole("tab", { name: "Day close" }));
  };

  it("lists only cash, totals it, and shows the difference from what was counted", async () => {
    const db = createMemoryDb();
    await cash(db, "City Chemist", 200);
    await cash(db, "Fresh Pharma", 100, 12);
    await queueCollection(db, { retailerId: 11, retailerName: "City Chemist", amount: 999, mode: "UPI" });
    renderApp({ db });
    await openClose();
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect(screen.getByTestId("dc-expected")).toHaveTextContent("₹300.00");

    fireEvent.change(screen.getByLabelText("Cash you are handing over (₹)"), { target: { value: "250" } });
    expect(screen.getByTestId("dc-diff")).toHaveTextContent("Short by ₹50.00");
    fireEvent.change(screen.getByLabelText("Cash you are handing over (₹)"), { target: { value: "300" } });
    expect(screen.getByTestId("dc-diff")).toHaveTextContent("Matches what you collected");
  });

  it("unticking a collection leaves it out of the total", async () => {
    const db = createMemoryDb();
    await cash(db, "City Chemist", 200);
    await cash(db, "Fresh Pharma", 100, 12);
    renderApp({ db });
    await openClose();
    fireEvent.click(screen.getByRole("checkbox", { name: "Include cash from Fresh Pharma" }));
    expect(screen.getByTestId("dc-expected")).toHaveTextContent("₹200.00");
  });

  it("asks for a count, and a reason when the count doesn't match", async () => {
    const db = createMemoryDb();
    await cash(db, "City Chemist", 200);
    renderApp({ db });
    await openClose();
    fireEvent.click(screen.getByRole("button", { name: "Close the day" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter the cash you are handing over");
    fireEvent.change(screen.getByLabelText("Cash you are handing over (₹)"), { target: { value: "150" } });
    fireEvent.click(screen.getByRole("button", { name: "Close the day" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("add a note saying why");
  });

  it("closes the day: sends it to the office, locks the cash, and shows it in the list", async () => {
    const db = createMemoryDb();
    await cash(db, "City Chemist", 300);
    const { api } = renderApp({ db });
    await openClose();
    fireEvent.change(screen.getByLabelText("Cash you are handing over (₹)"), { target: { value: "300" } });
    fireEvent.click(screen.getByRole("button", { name: "Close the day" }));

    await waitFor(() => expect(api.sync.mock.calls.some((c) => (c[0].handovers || []).length === 1)).toBe(true));
    const sent = api.sync.mock.calls.map((c) => c[0]).find((b) => (b.handovers || []).length).handovers[0];
    expect(sent.cashCounted).toBe(300);
    expect(sent.collectionIds).toHaveLength(1);

    const list = within(screen.getByLabelText("Day-closes"));
    expect(await list.findByText("₹300.00 handed over")).toBeInTheDocument();
    expect(await list.findByText(/Sent — awaiting office/)).toBeInTheDocument();
    expect(screen.getByText(/No cash waiting to be handed over/)).toBeInTheDocument();
  });

  it("shows what the office did: received and flagged with their reason", async () => {
    const db = createMemoryDb();
    await cash(db, "City Chemist", 300);
    const api = makeApi();
    renderApp({ db, api });
    await openClose();
    fireEvent.change(screen.getByLabelText("Cash you are handing over (₹)"), { target: { value: "300" } });
    fireEvent.click(screen.getByRole("button", { name: "Close the day" }));
    const h = await waitFor(() => {
      const b = api.sync.mock.calls.map((c) => c[0]).find((x) => (x.handovers || []).length);
      expect(b).toBeTruthy();
      return b.handovers[0];
    });
    api.myHandovers.mockResolvedValue(ok([{ clientHandoverId: h.clientHandoverId, uKey: "u1", status: "FLAGGED", expectedCash: 300, officeNote: "Recount please" }]));
    fireEvent.click(screen.getByRole("button", { name: /Sync now/ }));
    expect(await screen.findByText("Flagged by the office: Recount please")).toBeInTheDocument();
  });

  it("an unsent day-close can be cancelled, which frees the cash again", async () => {
    const db = createMemoryDb();
    await cash(db, "City Chemist", 300);
    renderApp({ db: await seeded(db), api: offlineApi() });
    await openClose();
    fireEvent.change(screen.getByLabelText("Cash you are handing over (₹)"), { target: { value: "300" } });
    fireEvent.click(screen.getByRole("button", { name: "Close the day" }));
    const list = within(screen.getByLabelText("Day-closes"));
    expect(await list.findByText(/Waiting to send/)).toBeInTheDocument();
    fireEvent.click(list.getByRole("button", { name: "Cancel" }));
    fireEvent.click(await list.findByRole("button", { name: "Yes, cancel it" }));
    await waitFor(() => expect(screen.getByTestId("dc-expected")).toHaveTextContent("₹300.00"));
    expect(list.getByText("Nothing handed over yet.")).toBeInTheDocument();
  });

  it("a refused day-close shows the reason and can be discarded", async () => {
    const db = createMemoryDb();
    await cash(db, "City Chemist", 300);
    renderApp({ db, api: makeApi({ handoverVerdict: "INVALID" }) });
    await openClose();
    fireEvent.change(screen.getByLabelText("Cash you are handing over (₹)"), { target: { value: "300" } });
    fireEvent.click(screen.getByRole("button", { name: "Close the day" }));
    const list = within(screen.getByLabelText("Day-closes"));
    expect(await list.findByText("Server said no")).toBeInTheDocument();
    fireEvent.click(list.getByRole("button", { name: "Discard" }));
    await waitFor(() => expect(list.getByText("Nothing handed over yet.")).toBeInTheDocument());
  });
});

describe("RepApp — day close with many collections", () => {
  const openClose = async () => {
    await openCollect();
    fireEvent.click(await screen.findByRole("tab", { name: "Day close" }));
  };

  it("pages the cash list, but the total and the Close button always cover everything", async () => {
    const db = createMemoryDb();
    for (let i = 0; i < 14; i++) await queueCollection(db, { retailerId: 11, retailerName: "Shop " + String(i).padStart(2, "0"), amount: 100, mode: "CASH" });
    renderApp({ db });
    await openClose();

    expect(screen.getAllByRole("checkbox")).toHaveLength(6); // one page of the list
    expect(screen.getByTestId("dc-expected")).toHaveTextContent("₹1,400.00"); // ...but the total is all 14
    expect(screen.getByRole("button", { name: "Close the day" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Page 2" }));
    expect(screen.getAllByRole("checkbox")).toHaveLength(6);
    fireEvent.click(screen.getByRole("button", { name: "Page 3" }));
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect(screen.getByTestId("dc-expected")).toHaveTextContent("₹1,400.00");
  });

  it("the footer (count, note, Close the day) sits after the cash list, not inside the scrolling part", async () => {
    const db = createMemoryDb();
    await queueCollection(db, { retailerId: 11, retailerName: "City Chemist", amount: 300, mode: "CASH" });
    renderApp({ db });
    await openClose();

    const scroll = document.querySelector(".ra-dc-scroll");
    const footer = document.querySelector(".ra-dc-footer");
    expect(scroll).toBeInTheDocument();
    expect(footer).toBeInTheDocument();
    expect(scroll.contains(footer)).toBe(false);
    expect(footer).toContainElement(screen.getByRole("button", { name: "Close the day" }));
    expect(scroll.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("Day close is reachable even when the beat is empty", async () => {
    const api = makeApi();
    api.retailers.mockResolvedValue(ok([]));
    renderApp({ api });
    fireEvent.click(await screen.findByRole("tab", { name: /Collect/ }));
    fireEvent.click(await screen.findByRole("tab", { name: "Day close" }));
    expect(await screen.findByText(/No cash waiting to be handed over/)).toBeInTheDocument();
  });

  it("pages the collections list on the Collect tab", async () => {
    const db = createMemoryDb();
    for (let i = 0; i < 20; i++) await queueCollection(db, { retailerId: 11, retailerName: "Shop " + String(i).padStart(2, "0"), amount: 10 + i, mode: "UPI", reference: "R" + i });
    renderApp({ db: await seeded(db), api: offlineApi() });
    await openCollect();

    expect(await screen.findByRole("navigation", { name: "Collections pages" })).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(15);
    fireEvent.click(screen.getByRole("button", { name: "Page 2" }));
    expect(screen.getAllByRole("article")).toHaveLength(5);
  });
});
