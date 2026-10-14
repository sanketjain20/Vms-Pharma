import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import RepApp from "./RepApp";
import { createMemoryDb, STORES, setMeta } from "./repDb";
import { STATE, localIso, queueOrder } from "./repSync";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");

const DAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const TODAY = DAYS[new Date().getDay()];
const OTHER_DAY = DAYS[(new Date().getDay() + 3) % 7];

const BEAT = [
  { beatUKey: "b1", retailerId: 11, retailerCode: "R1", shopName: "City Chemist", ownerName: "Mr Shah", phone: "9999", address: "MG Road", visitDay: null },
  { beatUKey: "b2", retailerId: 12, retailerCode: "R2", shopName: "Metro Medicos", ownerName: "Mrs Rao", phone: null, address: null, visitDay: OTHER_DAY },
  { beatUKey: "b3", retailerId: 13, retailerCode: "R3", shopName: "Today Pharma", ownerName: null, phone: null, address: null, visitDay: TODAY },
];
const CATALOG = [
  { productId: 10, name: "Paracetamol 500", productCode: "PARA", barcode: "8901", unit: "strip", sellingPrice: 25, stock: 100 },
  { productId: 11, name: "Amoxicillin 250", productCode: "AMOX", barcode: "8902", unit: "strip", sellingPrice: 10, stock: 2 },
];

const ok = (data) => ({ ok: true, status: 200, data });
const offline = () => ({ ok: false, networkError: true, message: "You're offline." });

function makeApi({ sync, serverOrders = [] } = {}) {
  const accept = (o) => ({ clientOrderId: o.clientOrderId, status: "ACCEPTED", orderNumber: "FO-100", message: "ok", conflicts: [] });
  return {
    catalog: jest.fn(async () => ok(CATALOG)),
    retailers: jest.fn(async () => ok(BEAT)),
    myOrders: jest.fn(async () => ok(serverOrders)),
    myCollections: jest.fn(async () => ok([])),
    profile: jest.fn(async () => ok({ name: "Ravi Kumar", email: "ravi@acme.com", phone: "9820011223", address: "MG Road", company: "Acme Pharma", vendorCode: "ACM-1", memberSince: "2026-03-14T09:00:00", retailerCount: 3 })),
    changePassword: jest.fn(async () => ({ ok: true, status: 200, message: "ok" })),
    sync: jest.fn(sync || (async (body) => ok({
      orders: body.orders.map(accept),
      visits: body.visits.map((v) => ({ clientVisitId: v.clientVisitId, status: "ACCEPTED", message: "ok" })),
      collections: (body.collections || []).map((c) => ({ clientCollectionId: c.clientCollectionId, status: "ACCEPTED", message: "ok" })),
    }))),
  };
}

function renderApp({ api = makeApi(), db = createMemoryDb(), getPosition, extra = {} } = {}) {
  localStorage.setItem("vmsUser", JSON.stringify({ status: 200, data: { name: "Ravi Rep", vendorId: 7, token: "t", fieldRep: true } }));
  const pos = getPosition || jest.fn(async () => ({ latitude: 18.52, longitude: 73.85, accuracyM: 12.4 }));
  const utils = render(
    <MemoryRouter initialEntries={["/rep"]}>
      <Routes>
        <Route path="/rep" element={<RepApp db={db} api={api} getPosition={pos} {...extra} />} />
        <Route path="/" element={<div>login page</div>} />
      </Routes>
    </MemoryRouter>
  );
  return { api, db, pos, ...utils };
}

async function ready() {
  await screen.findByText("City Chemist");
}

async function placeOrder({ qtyClicks = 0 } = {}) {
  fireEvent.click(screen.getByRole("tab", { name: /New order/ }));
  fireEvent.change(await screen.findByLabelText("Retailer"), { target: { value: "11" } });
  fireEvent.click(screen.getByRole("button", { name: "Add Paracetamol 500" }));
  for (let i = 0; i < qtyClicks; i++) fireEvent.click(screen.getByRole("button", { name: "Increase Paracetamol 500" }));
  fireEvent.click(screen.getByRole("button", { name: "Save order" }));
}

beforeEach(() => {
  jest.clearAllMocks();
  apiClient.mockResolvedValue({ ok: true, json: async () => ({ status: 200 }) });
});
afterEach(() => localStorage.clear());

describe("RepApp — beat", () => {
  it("shows today's and any-day retailers by default, everyone under 'Whole beat'", async () => {
    renderApp();
    await ready();

    expect(screen.getByText("Today Pharma")).toBeInTheDocument();
    expect(screen.queryByText("Metro Medicos")).not.toBeInTheDocument(); // scheduled for another day

    fireEvent.click(screen.getByRole("button", { name: "Whole beat" }));
    expect(screen.getByText("Metro Medicos")).toBeInTheDocument();
  });

  it("tells a new rep what to do when the beat is empty", async () => {
    const api = makeApi();
    api.retailers.mockResolvedValue(ok([]));
    renderApp({ api });

    expect(await screen.findByText(/No retailers on your beat yet/)).toBeInTheDocument();
  });

  it("checks in with GPS, saves it on the phone and sends it", async () => {
    const { api, db, pos } = renderApp();
    await ready();

    fireEvent.click(within(screen.getByText("City Chemist").closest(".ra-card")).getByRole("button", { name: "Check in" }));

    expect(await screen.findByText(/Checked in at City Chemist \(±12 m\)/)).toBeInTheDocument();
    expect(pos).toHaveBeenCalled();
    await waitFor(() => expect(api.sync).toHaveBeenCalled());
    const body = api.sync.mock.calls[0][0];
    expect(body.visits[0]).toMatchObject({ retailerId: 11, latitude: 18.52, longitude: 73.85, accuracyM: 12.4 });
    expect((await db.all(STORES.VISITS))[0].state).toBe(STATE.SYNCED);
  });

  it("checks in at an unplanned stop with no retailer", async () => {
    const { api } = renderApp();
    await ready();

    fireEvent.click(screen.getByRole("button", { name: "Check in at an unplanned stop" }));

    await waitFor(() => expect(api.sync).toHaveBeenCalled());
    expect(api.sync.mock.calls[0][0].visits[0].retailerId).toBeNull();
  });

  it("explains a GPS failure and saves nothing", async () => {
    const { db } = renderApp({ getPosition: jest.fn(async () => { throw new Error("denied"); }) });
    await ready();

    fireEvent.click(within(screen.getByText("City Chemist").closest(".ra-card")).getByRole("button", { name: "Check in" }));

    expect(await screen.findByText(/Couldn't get your location/)).toBeInTheDocument();
    expect(await db.all(STORES.VISITS)).toHaveLength(0);
  });
});

describe("RepApp — taking an order", () => {
  it("builds an order from search, stepper and total, then sends it with the quoted prices", async () => {
    const { api, db } = renderApp();
    await ready();

    await placeOrder({ qtyClicks: 2 }); // 1 + 2 = 3 × ₹25

    await waitFor(() => expect(api.sync).toHaveBeenCalled());
    const sent = api.sync.mock.calls[0][0].orders[0];
    expect(sent).toMatchObject({ retailerId: 11, items: [{ productId: 10, quantity: 3, quotedPrice: 25 }] });
    expect(await screen.findByText("Sent")).toBeInTheDocument();
    expect((await db.all(STORES.ORDERS))[0]).toMatchObject({ state: STATE.SYNCED, total: 75, serverOrderNumber: "FO-100" });
  });

  it("filters the catalog by name, code or barcode", async () => {
    renderApp();
    await ready();
    fireEvent.click(screen.getByRole("tab", { name: /New order/ }));

    fireEvent.change(await screen.findByLabelText("Add products"), { target: { value: "amox" } });
    expect(screen.getByText("Amoxicillin 250")).toBeInTheDocument();
    expect(screen.queryByText("Paracetamol 500")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Add products"), { target: { value: "8901" } });
    expect(screen.getByText("Paracetamol 500")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Add products"), { target: { value: "zzz" } });
    expect(screen.getByText(/No products match "zzz"/)).toBeInTheDocument();
  });

  it("shows a running total, never lets quantity drop below 1, and can remove a line", async () => {
    renderApp();
    await ready();
    fireEvent.click(screen.getByRole("tab", { name: /New order/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Add Paracetamol 500" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Amoxicillin 250" }));

    expect(screen.getByText("₹35.00")).toBeInTheDocument(); // 25 + 10

    fireEvent.click(screen.getByRole("button", { name: "Decrease Paracetamol 500" }));
    expect(screen.getByLabelText("Quantity for Paracetamol 500")).toHaveValue(1);

    fireEvent.click(screen.getByRole("button", { name: "Remove Amoxicillin 250" }));
    expect(screen.queryByLabelText("Quantity for Amoxicillin 250")).not.toBeInTheDocument();
  });

  it("warns, but allows, an order above the stock this phone last saw", async () => {
    renderApp();
    await ready();
    fireEvent.click(screen.getByRole("tab", { name: /New order/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Add Amoxicillin 250" }));

    fireEvent.click(screen.getByRole("button", { name: "Increase Amoxicillin 250" })); // 2 → fine
    expect(screen.queryByText(/Only 2 in stock/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Increase Amoxicillin 250" })); // 3 > 2
    expect(screen.getByText(/Only 2 in stock when this phone last updated/)).toBeInTheDocument();
  });

  it("won't save without a retailer or without products", async () => {
    const { api } = renderApp();
    await ready();
    fireEvent.click(screen.getByRole("tab", { name: /New order/ }));

    fireEvent.click(await screen.findByRole("button", { name: "Save order" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Pick the retailer");

    fireEvent.change(screen.getByLabelText("Retailer"), { target: { value: "11" } });
    fireEvent.click(screen.getByRole("button", { name: "Save order" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Add at least one product");
    expect(api.sync).not.toHaveBeenCalled();
  });

  it("starts the cart fresh when the rep switches to a different retailer from the beat", async () => {
    renderApp();
    await ready();
    fireEvent.click(within(screen.getByText("City Chemist").closest(".ra-card")).getByRole("button", { name: "Take order" }));
    fireEvent.click(await screen.findByRole("button", { name: "Add Paracetamol 500" }));
    expect(screen.getByLabelText("Retailer")).toHaveValue("11");

    fireEvent.click(screen.getByRole("tab", { name: /My beat/ }));
    fireEvent.click(within(screen.getByText("Today Pharma").closest(".ra-card")).getByRole("button", { name: "Take order" }));

    expect(screen.getByLabelText("Retailer")).toHaveValue("13");
    expect(screen.queryByLabelText("Quantity for Paracetamol 500")).not.toBeInTheDocument();
  });
});

describe("RepApp — offline", () => {
  it("saves the order on the phone when there is no connection, and says so", async () => {
    const api = makeApi({ sync: async () => offline() });
    const { db } = renderApp({ api });
    await ready();

    await placeOrder();

    expect(await screen.findByText("Waiting to send")).toBeInTheDocument();
    expect(await screen.findByText(/saved on this phone and will send automatically/)).toBeInTheDocument();
    expect(screen.getByText("1 item waiting to send")).toBeInTheDocument();
    expect((await db.all(STORES.ORDERS))[0].state).toBe(STATE.PENDING);
  });

  it("sends the saved order automatically when the connection returns", async () => {
    let up = false;
    const api = makeApi({
      sync: async (body) => (up
        ? ok({ orders: body.orders.map((o) => ({ clientOrderId: o.clientOrderId, status: "ACCEPTED", orderNumber: "FO-9", message: "", conflicts: [] })), visits: [] })
        : offline()),
    });
    const { db } = renderApp({ api });
    await ready();
    await placeOrder();
    await screen.findByText("Waiting to send");

    up = true;
    await act(async () => { window.dispatchEvent(new Event("online")); });

    expect(await screen.findByText("Sent")).toBeInTheDocument();
    expect((await db.all(STORES.ORDERS))[0].state).toBe(STATE.SYNCED);
    expect(screen.queryByText(/waiting to send/)).not.toBeInTheDocument();
  });

  it("shows the Offline pill and disables Sync now while offline", async () => {
    renderApp();
    await ready();

    await act(async () => { window.dispatchEvent(new Event("offline")); });

    expect(screen.getByText("Offline")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sync now" })).toBeDisabled();

    await act(async () => { window.dispatchEvent(new Event("online")); });
    expect(screen.getByText("Online")).toBeInTheDocument();
  });

  it("still opens and works from the saved copy when the server can't be reached at all", async () => {
    const db = createMemoryDb();
    const first = renderApp({ db });
    await first.findByText("City Chemist");
    first.unmount();

    const api = makeApi();
    api.catalog.mockResolvedValue(offline());
    api.retailers.mockResolvedValue(offline());
    api.myOrders.mockResolvedValue(offline());
    api.sync.mockResolvedValue(offline());
    renderApp({ api, db });

    expect(await screen.findByText("City Chemist")).toBeInTheDocument(); // from the phone's copy
    fireEvent.click(screen.getByRole("tab", { name: /New order/ }));
    expect(await screen.findByRole("button", { name: "Add Paracetamol 500" })).toBeInTheDocument();
  });
});

describe("RepApp — orders & conflicts", () => {
  it("flags an order the server accepted with conflicts and spells out each changed line", async () => {
    const api = makeApi({
      sync: async (body) => ok({
        orders: body.orders.map((o) => ({
          clientOrderId: o.clientOrderId, status: "ACCEPTED_WITH_CONFLICTS", orderNumber: "FO-7", message: "flagged",
          conflicts: [{ productId: 10, reason: "PRICE_CHANGED", quotedPrice: 25, currentPrice: 30, availableQty: 100 }],
        })),
        visits: [],
      }),
    });
    renderApp({ api });
    await ready();

    await placeOrder();

    expect(await screen.findByText("Sent — flagged")).toBeInTheDocument();
    expect(screen.getByText(/you don't need to do anything/)).toBeInTheDocument();
    expect(await screen.findByText(/sent but flagged/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show lines" }));
    expect(screen.getByText("Price changed ₹25.00 → ₹30.00")).toBeInTheDocument();
  });

  it("describes stock and availability conflicts", async () => {
    const db = createMemoryDb();
    await db.put(STORES.ORDERS, {
      clientOrderId: "c1", retailerId: 11, retailerName: "City Chemist", capturedAt: "2026-09-30T10:00:00", total: 20, state: STATE.CONFLICT,
      serverOrderNumber: "FO-8", message: "", remarks: null,
      items: [{ productId: 11, name: "Amoxicillin 250", quantity: 5, quotedPrice: 10 }, { productId: 10, name: "Paracetamol 500", quantity: 1, quotedPrice: 25 }],
      conflicts: [
        { productId: 11, reason: "STOCK_SHORT", quotedPrice: 10, currentPrice: 10, availableQty: 2 },
        { productId: 10, reason: "PRODUCT_UNAVAILABLE", quotedPrice: 25, currentPrice: null, availableQty: null },
      ],
    });
    renderApp({ db });
    await ready();
    fireEvent.click(screen.getByRole("tab", { name: /Orders/ }));

    fireEvent.click(await screen.findByRole("button", { name: "Show lines" }));
    expect(screen.getByText("Only 2 in stock")).toBeInTheDocument();
    expect(screen.getByText("No longer available")).toBeInTheDocument();
  });

  it("shows the office's decision once they've acted on a synced order", async () => {
    const api = makeApi({ serverOrders: [{ uKey: "u1", orderNumber: "FO-100", status: "REJECTED", rejectReason: "Over credit limit", retailerName: "City Chemist", totalAmount: 25 }] });
    renderApp({ api });
    await ready();

    await placeOrder(); // server numbers it FO-100

    expect(await screen.findByText("Rejected")).toBeInTheDocument();
    expect(screen.getByText("Rejected: Over credit limit")).toBeInTheDocument();
  });

  it("lists the office's other orders for this rep too", async () => {
    const api = makeApi({ serverOrders: [{ uKey: "u2", orderNumber: "FO-55", status: "CONVERTED", retailerName: "Old Client", totalAmount: 500 }] });
    renderApp({ api });
    await ready();
    fireEvent.click(screen.getByRole("tab", { name: /Orders/ }));

    expect(await screen.findByText("Old Client")).toBeInTheDocument();
    expect(screen.getByText("Invoiced")).toBeInTheDocument();
  });

  it("lets the rep retry or discard a refused order, with the server's reason shown", async () => {
    const api = makeApi({
      sync: async (body) => ok({
        orders: body.orders.map((o) => ({ clientOrderId: o.clientOrderId, status: "INVALID", message: "This retailer is not on your beat.", conflicts: [] })),
        visits: [],
      }),
    });
    const { db } = renderApp({ api });
    await ready();
    await placeOrder();

    expect(await screen.findByText("Refused")).toBeInTheDocument();
    expect(screen.getAllByText(/This retailer is not on your beat\./).length).toBeGreaterThan(0);
    expect(screen.getByRole("tab", { name: /Orders/ })).toHaveTextContent("1"); // attention badge

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    await waitFor(async () => expect(await db.all(STORES.ORDERS)).toHaveLength(0));
    expect(await screen.findByText(/No orders yet/)).toBeInTheDocument();
  });

  it("retry puts a refused order back in the queue and resends it", async () => {
    let refuse = true;
    const api = makeApi({
      sync: async (body) => ok({
        orders: body.orders.map((o) => (refuse
          ? { clientOrderId: o.clientOrderId, status: "INVALID", message: "nope", conflicts: [] }
          : { clientOrderId: o.clientOrderId, status: "ACCEPTED", orderNumber: "FO-2", message: "", conflicts: [] })),
        visits: [],
      }),
    });
    renderApp({ api });
    await ready();
    await placeOrder();
    await screen.findByText("Refused");

    refuse = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Sent")).toBeInTheDocument();
  });
});

describe("RepApp — logout", () => {
  it("warns before logging out with unsent work, and stays logged in if the rep cancels", async () => {
    const api = makeApi({ sync: async () => offline() });
    renderApp({ api });
    await ready();
    await placeOrder();
    await screen.findByText("Waiting to send");

    const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("1 unsent item"));
    expect(localStorage.getItem("vmsUser")).not.toBeNull();
    expect(screen.queryByText("login page")).not.toBeInTheDocument();
    confirm.mockRestore();
  });

  it("logs out and returns to the login page, even when the server can't be reached", async () => {
    renderApp();
    await ready();
    apiClient.mockRejectedValue(new Error("offline"));

    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    expect(await screen.findByText("login page")).toBeInTheDocument();
    expect(localStorage.getItem("vmsUser")).toBeNull();
  });
});

describe("RepApp — theme and summary", () => {
  it("offers the same light/dark switch as the office app and reports the click", async () => {
    const onToggleTheme = jest.fn();
    renderApp({ extra: { theme: "dark", onToggleTheme } });
    await ready();

    fireEvent.click(screen.getByRole("button", { name: "Switch to light mode" }));

    expect(onToggleTheme).toHaveBeenCalledTimes(1);
  });

  it("shows no theme switch when the host gives it no theme handler", async () => {
    renderApp();
    await ready();

    expect(screen.queryByRole("button", { name: /Switch to (light|dark) mode/ })).not.toBeInTheDocument();
  });

  it("summarises the day: retailers to visit, check-ins today, unsent items", async () => {
    const api = makeApi({ sync: async () => offline() });
    renderApp({ api });
    await ready();

    const tile = (label) => screen.getByText(label).closest(".ra-stat");
    expect(within(tile("To visit today")).getByText("2")).toBeInTheDocument(); // any-day + today (not the other-day one)
    expect(within(tile("Check-ins today")).getByText("0")).toBeInTheDocument();

    fireEvent.click(within(screen.getByText("City Chemist").closest(".ra-card")).getByRole("button", { name: "Check in" }));
    await screen.findByText(/Checked in at City Chemist/);

    expect(within(tile("Check-ins today")).getByText("1")).toBeInTheDocument();
    expect(within(tile("Unsent items")).getByText("1")).toBeInTheDocument(); // offline, so it is still waiting

    fireEvent.click(screen.getByRole("button", { name: "Whole beat" }));
    expect(within(tile("On your beat")).getByText("3")).toBeInTheDocument();
  });
});

// ───────────── a long catalog ─────────────

function bigCatalog(n = 130) {
  const cats = ["Tablets", "Syrups", "Capsules"];
  return Array.from({ length: n }, (_, i) => ({
    productId: 1000 + i, name: `Item ${String(i).padStart(3, "0")}`, productCode: `P${i}`, barcode: `77${i}`, unit: "strip",
    sellingPrice: 10 + (i % 7), stock: i % 10 === 0 ? 0 : 50, category: cats[i % 3], manufacturer: i % 2 ? "Cipla" : "Sun Pharma",
  }));
}

async function openOrderTab(catalog) {
  const api = makeApi();
  api.catalog.mockResolvedValue(ok(catalog));
  const utils = renderApp({ api });
  await ready();
  fireEvent.click(screen.getByRole("tab", { name: /New order/ }));
  await screen.findByLabelText("Add products");
  return { api, ...utils };
}

describe("RepApp — browsing a long product list", () => {
  it("shows the catalog a page at a time, with a count and a Show more button", async () => {
    await openOrderTab(bigCatalog());

    expect(screen.getByText(/130 products · showing 24/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Add Item/ })).toHaveLength(24);

    fireEvent.click(screen.getByRole("button", { name: /Show 24 more \(106 left\)/ }));
    expect(screen.getAllByRole("button", { name: /^Add Item/ })).toHaveLength(48);
  });

  it("filters by category, with counts in the picker, and reports how many matched", async () => {
    await openOrderTab(bigCatalog());

    const picker = screen.getByLabelText("Category");
    expect(within(picker).getByRole("option", { name: "All categories (130)" })).toBeInTheDocument();
    fireEvent.change(picker, { target: { value: "Syrups" } });

    expect(screen.getByText(/43 of 130 products/)).toBeInTheDocument();
    expect(screen.getByText("Item 001")).toBeInTheDocument(); // index 1 → Syrups
    expect(screen.queryByText("Item 000")).not.toBeInTheDocument(); // Tablets
  });

  it("jumps by letter and narrows to what is in stock", async () => {
    const catalog = [...bigCatalog(40), { productId: 5, name: "Zinc Tablets", productCode: "Z", barcode: "z", unit: "strip", sellingPrice: 9, stock: 0, category: "Tablets", manufacturer: "X" }];
    await openOrderTab(catalog);

    fireEvent.click(screen.getByRole("button", { name: "Jump to Z" }));
    expect(screen.getByText("Zinc Tablets")).toBeInTheDocument();
    expect(screen.getByText("Out of stock")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "In stock only" }));
    expect(screen.queryByText("Zinc Tablets")).not.toBeInTheDocument();
    expect(screen.getByText(/No products match these filters/)).toBeInTheDocument();
  });

  it("searches company and category as well as name, and clears everything in one tap", async () => {
    await openOrderTab(bigCatalog());

    fireEvent.change(screen.getByLabelText("Add products"), { target: { value: "sun pharma capsules" } });
    expect(screen.getByText(/of 130 products/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Clear filters \(1\)/ }));
    expect(screen.getByText(/130 products · showing 24/)).toBeInTheDocument();
    expect(screen.getByLabelText("Add products")).toHaveValue("");
  });

  it("marks products already in the order and lets the rep reorder a retailer's usual items", async () => {
    const db = createMemoryDb();
    await db.put(STORES.ORDERS, {
      clientOrderId: "prev", retailerId: 11, retailerName: "City Chemist", capturedAt: localIso(), total: 120, state: STATE.SYNCED,
      serverOrderNumber: "FO-1", message: "", conflicts: [], remarks: null, items: [{ productId: 10, name: "Paracetamol 500", quantity: 12, quotedPrice: 25 }],
    });
    renderApp({ db });
    await ready();
    fireEvent.click(screen.getByRole("tab", { name: /New order/ }));

    expect(screen.queryByRole("button", { name: /^Reorder/ })).not.toBeInTheDocument(); // no retailer chosen yet
    fireEvent.change(await screen.findByLabelText("Retailer"), { target: { value: "11" } });
    fireEvent.click(await screen.findByRole("button", { name: "Reorder Paracetamol 500" }));

    expect(screen.getByLabelText("Quantity for Paracetamol 500")).toHaveValue(12); // last quantity, not 1
    expect(screen.getByText("12 in order")).toBeInTheDocument();
  });
});

// ───────────── order history + filters ─────────────

const daysAgo = (n, h = 10) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(h, 0, 0, 0); return localIso(d); };

async function seededOrders() {
  const db = createMemoryDb();
  // what the phone already holds from an earlier online session
  await setMeta(db, "retailers", BEAT);
  await setMeta(db, "catalog", CATALOG);
  const put = (o) => db.put(STORES.ORDERS, { retailerId: 11, retailerName: "City Chemist", total: 100, state: STATE.SYNCED, serverOrderNumber: null, message: null, conflicts: [], remarks: null, items: [{ productId: 10, name: "Paracetamol 500", quantity: 1, quotedPrice: 100 }], ...o });
  await put({ clientOrderId: "a", capturedAt: daysAgo(0), total: 100, serverOrderNumber: "FO-A" });
  await put({ clientOrderId: "b", capturedAt: daysAgo(1), total: 450, retailerId: 12, retailerName: "Metro Medicos", state: STATE.PENDING, items: [{ productId: 11, name: "Amoxicillin 250", quantity: 3, quotedPrice: 150 }] });
  await put({ clientOrderId: "c", capturedAt: daysAgo(3), total: 900, state: STATE.INVALID, message: "This retailer is not on your beat." });
  return db;
}

const openOrders = async () => { fireEvent.click(screen.getByRole("tab", { name: /Orders/ })); await screen.findByLabelText("Search orders"); };

describe("RepApp — order filters", () => {
  it("summarises the list and groups it under Today / Yesterday headings", async () => {
    renderApp({ api: makeApi({ sync: async () => offline() }), db: await seededOrders() });
    await ready();
    await openOrders();

    expect(within(screen.getByText("Orders", { selector: ".ra-stat-label" }).closest(".ra-stat")).getByText("3")).toBeInTheDocument();
    expect(screen.getByText("₹1,450.00")).toBeInTheDocument(); // 100 + 450 + 900
    expect(screen.getByText("Today", { selector: ".ra-day span" })).toBeInTheDocument();
    expect(screen.getByText("Yesterday", { selector: ".ra-day span" })).toBeInTheDocument();
  });

  it("filters by status chip, and each chip shows the count you will get", async () => {
    renderApp({ api: makeApi({ sync: async () => offline() }), db: await seededOrders() });
    await ready();
    await openOrders();

    expect(screen.getByRole("button", { name: "All (3)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Needs attention (2)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Waiting to send (1)" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Approved/ })).not.toBeInTheDocument(); // no such orders, no chip

    fireEvent.click(screen.getByRole("button", { name: "Needs attention (2)" }));
    expect(screen.getByText("Waiting to send")).toBeInTheDocument();
    expect(screen.getByText("Refused")).toBeInTheDocument();
    expect(screen.queryByText("Sent")).not.toBeInTheDocument();
  });

  it("filters by retailer, period and amount, and combines them", async () => {
    renderApp({ api: makeApi({ sync: async () => offline() }), db: await seededOrders() });
    await ready();
    await openOrders();
    fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));

    fireEvent.change(screen.getByLabelText("Retailer"), { target: { value: "12" } });
    expect(screen.getByText("Metro Medicos", { selector: "h3" })).toBeInTheDocument();
    expect(screen.queryByText("City Chemist", { selector: "h3" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Retailer"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Period"), { target: { value: "TODAY" } });
    expect(screen.getAllByRole("article")).toHaveLength(1);

    fireEvent.change(screen.getByLabelText("Period"), { target: { value: "ALL" } });
    fireEvent.change(screen.getByLabelText("Min amount (₹)"), { target: { value: "500" } });
    expect(screen.getAllByRole("article")).toHaveLength(1); // only the 900 one
    expect(screen.getByText("Refused")).toBeInTheDocument();
  });

  it("offers a custom date range and a month picker", async () => {
    renderApp({ api: makeApi({ sync: async () => offline() }), db: await seededOrders() });
    await ready();
    await openOrders();
    fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));

    fireEvent.change(screen.getByLabelText("Period"), { target: { value: "CUSTOM" } });
    const day = (n) => daysAgo(n).slice(0, 10);
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: day(3) } });
    fireEvent.change(screen.getByLabelText("To date"), { target: { value: day(1) } });
    expect(screen.getAllByRole("article")).toHaveLength(2); // yesterday and 3 days ago, both ends inclusive

    fireEvent.change(screen.getByLabelText("Period"), { target: { value: "MONTH" } });
    expect(screen.getByLabelText("Month")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Month"), { target: { value: "2019-01" } });
    expect(screen.getByText(/No orders match these filters/)).toBeInTheDocument();
  });

  it("searches by retailer, product and order number, and resets in one tap", async () => {
    renderApp({ api: makeApi({ sync: async () => offline() }), db: await seededOrders() });
    await ready();
    await openOrders();

    fireEvent.change(screen.getByLabelText("Search orders"), { target: { value: "amox" } });
    expect(screen.getAllByRole("article")).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("Search orders"), { target: { value: "FO-A" } });
    expect(screen.getAllByRole("article")).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("Search orders"), { target: { value: "nothing like this" } });
    expect(screen.getByText(/No orders match these filters/)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Reset filters" })[0]);
    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(screen.getByLabelText("Search orders")).toHaveValue("");
  });

  it("sorts by value, dropping the day headings", async () => {
    renderApp({ api: makeApi({ sync: async () => offline() }), db: await seededOrders() });
    await ready();
    await openOrders();
    fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));

    fireEvent.change(screen.getByLabelText("Sort by"), { target: { value: "HIGHEST" } });

    expect(screen.queryByText("Today", { selector: ".ra-day span" })).not.toBeInTheDocument();
    expect(within(screen.getAllByRole("article")[0]).getByText("₹900.00")).toBeInTheDocument();
  });

  it("includes the office's older history that the phone no longer keeps", async () => {
    const api = makeApi({
      serverOrders: [{
        uKey: "old", orderNumber: "FO-OLD", status: "CONVERTED", retailerId: 11, retailerName: "City Chemist", capturedAt: "2026-01-15T10:00:00",
        totalAmount: 777, items: [{ productId: 10, productName: "Paracetamol 500", quantity: 7, quotedPrice: 111, currentPrice: 111, availableQty: 9, conflictReason: null }],
      }],
    });
    renderApp({ api, db: await seededOrders() }); // online: the pending order sends, then history is fetched
    await ready();
    await openOrders();

    expect(await screen.findByText("Invoiced")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));
    fireEvent.change(screen.getByLabelText("Period"), { target: { value: "MONTH" } });
    fireEvent.change(screen.getByLabelText("Month"), { target: { value: "2026-01" } });

    expect(screen.getAllByRole("article")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Show lines" }));
    expect(screen.getByText("7 × ₹111.00")).toBeInTheDocument();
  });
});

describe("RepApp — footer", () => {
  it("shows the same footer as the office app", async () => {
    renderApp();
    await ready();

    expect(screen.getByText("UDYORA")).toBeInTheDocument();
    expect(screen.getByText("System Online")).toBeInTheDocument();
  });
});

describe("RepApp — settings tab", () => {
  it("opens Settings from the navigation and shows the rep's details", async () => {
    renderApp();
    await ready();

    fireEvent.click(screen.getByRole("tab", { name: /Settings/ }));

    expect(await screen.findByRole("heading", { name: "Change password" })).toBeInTheDocument();
    expect(await screen.findByLabelText("Your details")).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Accent colour" })).toBeInTheDocument();
  });

  it("applies the chosen accent to the whole app, and remembers it next time (per rep)", async () => {
    const first = renderApp();
    await ready();
    expect(first.container.querySelector(".ra-root")).toHaveAttribute("data-accent", "teal");

    fireEvent.click(screen.getByRole("tab", { name: /Settings/ }));
    fireEvent.click(await screen.findByRole("radio", { name: "Violet" }));

    expect(first.container.querySelector(".ra-root")).toHaveAttribute("data-accent", "violet");
    expect(localStorage.getItem("vmsRepAccent:7")).toBe("violet");
    first.unmount();

    const second = renderApp(); // a fresh visit: same rep, same phone
    await ready();
    expect(second.container.querySelector(".ra-root")).toHaveAttribute("data-accent", "violet");
  });
});

describe("RepApp — profile photo shows around the app", () => {
  const PHOTO = "data:image/jpeg;base64,/9j/AAAA";
  const withPhoto = (photo) => {
    const api = makeApi();
    api.profile.mockResolvedValue(ok({ name: "Ravi Kumar", email: "r@x.com", phone: null, address: null, company: "Acme", memberSince: "2026-03-14T09:00:00", retailerCount: 1, profilePhoto: photo }));
    return api;
  };
  const imgs = (container) => [...container.querySelectorAll("img.ra-avatar--img")];

  it("shows initials in the header and the side rail when there is no photo", async () => {
    const { container } = renderApp({ api: withPhoto(null) });
    await ready();

    expect(imgs(container)).toHaveLength(0);
    expect(container.querySelectorAll(".ra-me .ra-avatar, .ra-me-rail .ra-avatar")).toHaveLength(2);
  });

  it("shows the rep's photo in the header and above the menu in the side rail, with their name", async () => {
    const { container } = renderApp({ api: withPhoto(PHOTO) });
    await ready();

    await waitFor(() => expect(imgs(container)).toHaveLength(2)); // header + rail
    imgs(container).forEach((img) => expect(img).toHaveAttribute("src", PHOTO));
    const rail = container.querySelector(".ra-me-rail");
    expect(rail).toContainElement(imgs(container)[1]);
    expect(within(rail).getByText("Ravi Kumar")).toBeInTheDocument();
    // the profile block sits above the menu tabs inside the same nav
    const nav = container.querySelector(".ra-nav");
    expect(nav.firstElementChild).toBe(rail);
  });

  it("the header and rail avatars open Settings", async () => {
    renderApp({ api: withPhoto(null) });
    await ready();

    fireEvent.click(screen.getAllByRole("button", { name: "Your profile" })[0]);

    expect(await screen.findByRole("heading", { name: "Change password" })).toBeInTheDocument();
  });

  it("uploading a new photo in Settings updates the header and rail straight away", async () => {
    const api = withPhoto(null);
    api.updatePhoto = jest.fn(async () => ({ ok: true, status: 200, message: "Photo updated." }));
    const { container } = renderApp({ api, extra: { processImage: jest.fn(async () => "data:image/jpeg;base64,NEWPHOTO") } });
    await ready();
    expect(imgs(container)).toHaveLength(0);

    fireEvent.click(screen.getByRole("tab", { name: /Settings/ }));
    fireEvent.change(await screen.findByLabelText("Choose profile photo"), { target: { files: [new File(["x"], "me.jpg", { type: "image/jpeg" })] } });

    await screen.findByText("Photo updated.");
    await waitFor(() => expect(imgs(container).length).toBeGreaterThanOrEqual(2));
    expect(imgs(container)[0]).toHaveAttribute("src", "data:image/jpeg;base64,NEWPHOTO");
    expect(api.updatePhoto).toHaveBeenCalledWith({ photo: "data:image/jpeg;base64,NEWPHOTO" });
  });

  it("removing the photo clears it everywhere, even though the login still carries the old one", async () => {
    localStorage.setItem("vmsUser", JSON.stringify({ status: 200, data: { name: "Ravi Rep", vendorId: 7, token: "t", fieldRep: true, profilePhoto: PHOTO } }));
    const api = withPhoto(PHOTO);
    api.updatePhoto = jest.fn(async () => ({ ok: true, status: 200, message: "Photo removed." }));
    const { container } = renderApp({ api });
    await ready();
    await waitFor(() => expect(imgs(container)).toHaveLength(2));

    fireEvent.click(screen.getByRole("tab", { name: /Settings/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Remove photo" }));

    await screen.findByText("Photo removed.");
    await waitFor(() => expect(imgs(container)).toHaveLength(0));
  });

  it("still shows the saved photo when the app opens with no connection", async () => {
    const db = createMemoryDb();
    await setMeta(db, "profile", { name: "Ravi Kumar", profilePhoto: PHOTO });
    await setMeta(db, "retailers", BEAT);
    const api = makeApi({ sync: async () => offline() });
    api.profile.mockResolvedValue(offline());
    api.catalog.mockResolvedValue(offline());
    api.retailers.mockResolvedValue(offline());
    api.myOrders.mockResolvedValue(offline());
    const { container } = renderApp({ api, db });
    await ready();

    await waitFor(() => expect(imgs(container)).toHaveLength(2));
  });
});

// ───────────── editing and cancelling saved orders ─────────────

async function dbWithOrder(over = {}) {
  const db = createMemoryDb();
  await setMeta(db, "retailers", BEAT); // what the phone already holds
  await setMeta(db, "catalog", CATALOG);
  await db.put(STORES.ORDERS, {
    clientOrderId: "p1", retailerId: 11, retailerName: "City Chemist", capturedAt: localIso(), total: 100, state: STATE.PENDING,
    serverOrderNumber: null, message: null, conflicts: [], remarks: "deliver monday",
    items: [{ productId: 10, name: "Paracetamol 500", quantity: 4, quotedPrice: 25 }], ...over,
  });
  return db;
}
const offlineApi = () => makeApi({ sync: async () => offline() });
const goOrders = () => fireEvent.click(screen.getByRole("tab", { name: /Orders/ }));

describe("RepApp — editing and cancelling a saved order", () => {
  it("offers Edit and Cancel only on an order still waiting to send", async () => {
    const db = await dbWithOrder();
    await db.put(STORES.ORDERS, {
      clientOrderId: "sent", retailerId: 12, retailerName: "Metro Medicos", capturedAt: localIso(), total: 50, state: STATE.SYNCED,
      serverOrderNumber: "FO-S", message: "", conflicts: [], remarks: null, items: [{ productId: 11, name: "Amoxicillin 250", quantity: 5, quotedPrice: 10 }],
    });
    renderApp({ api: offlineApi(), db });
    await ready();
    goOrders();

    expect(await screen.findByRole("button", { name: "Edit order for City Chemist" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel order for City Chemist" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit order for Metro Medicos/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cancel order for Metro Medicos/ })).not.toBeInTheDocument();
  });

  it("loads the order back into the order screen, and saving replaces it (same order, new contents)", async () => {
    const db = await dbWithOrder();
    renderApp({ api: offlineApi(), db });
    await ready();
    goOrders();

    fireEvent.click(await screen.findByRole("button", { name: "Edit order for City Chemist" }));

    expect(await screen.findByRole("heading", { name: "Edit order" })).toBeInTheDocument();
    expect(screen.getByText(/Editing your order for/)).toHaveTextContent("City Chemist");
    expect(screen.getByLabelText("Retailer")).toHaveValue("11");
    expect(screen.getByLabelText("Quantity for Paracetamol 500")).toHaveValue(4);
    expect(screen.getByLabelText("Note for the office (optional)")).toHaveValue("deliver monday");

    fireEvent.click(screen.getByRole("button", { name: "Increase Paracetamol 500" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase Paracetamol 500" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Amoxicillin 250" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText(/No connection — your work is saved on this phone/)).toBeInTheDocument();
    const all = await db.all(STORES.ORDERS);
    expect(all).toHaveLength(1); // edited in place, not duplicated
    expect(all[0]).toMatchObject({ clientOrderId: "p1", total: 6 * 25 + 10, state: STATE.PENDING, edited: true });
    expect(all[0].items).toHaveLength(2);
  });

  it("lets the rep move the order to a different retailer", async () => {
    const db = await dbWithOrder();
    renderApp({ api: offlineApi(), db });
    await ready();
    goOrders();
    fireEvent.click(await screen.findByRole("button", { name: "Edit order for City Chemist" }));

    fireEvent.change(await screen.findByLabelText("Retailer"), { target: { value: "13" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await screen.findByText(/No connection — your work is saved on this phone/);
    expect((await db.get(STORES.ORDERS, "p1"))).toMatchObject({ retailerId: 13, retailerName: "Today Pharma" });
  });

  it("'Cancel editing' goes back to Orders and changes nothing", async () => {
    const db = await dbWithOrder();
    renderApp({ api: offlineApi(), db });
    await ready();
    goOrders();
    fireEvent.click(await screen.findByRole("button", { name: "Edit order for City Chemist" }));
    fireEvent.click(await screen.findByRole("button", { name: "Increase Paracetamol 500" }));

    fireEvent.click(screen.getByRole("button", { name: "Cancel editing" }));

    expect(await screen.findByLabelText("Search orders")).toBeInTheDocument();
    expect((await db.get(STORES.ORDERS, "p1")).total).toBe(100);
    fireEvent.click(screen.getByRole("tab", { name: /New order/ }));
    expect(await screen.findByRole("heading", { name: "New order" })).toBeInTheDocument(); // no leftover draft
    expect(screen.queryByLabelText("Quantity for Paracetamol 500")).not.toBeInTheDocument();
  });

  it("starting a fresh order from the beat abandons an edit in progress", async () => {
    const db = await dbWithOrder();
    renderApp({ api: offlineApi(), db });
    await ready();
    goOrders();
    fireEvent.click(await screen.findByRole("button", { name: "Edit order for City Chemist" }));
    await screen.findByText(/Editing your order for/);

    fireEvent.click(screen.getByRole("tab", { name: /My beat/ }));
    fireEvent.click(within(screen.getByText("Today Pharma").closest(".ra-card")).getByRole("button", { name: "Take order" }));

    expect(await screen.findByRole("heading", { name: "New order" })).toBeInTheDocument();
    expect(screen.queryByText(/Editing your order for/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save order" })).toBeInTheDocument();
  });

  it("cancelling asks first, 'Keep it' backs out, and 'Yes, cancel order' removes it for good", async () => {
    const db = await dbWithOrder();
    renderApp({ api: offlineApi(), db });
    await ready();
    goOrders();

    fireEvent.click(await screen.findByRole("button", { name: "Cancel order for City Chemist" }));
    expect(screen.getByRole("group", { name: "Confirm cancel" })).toHaveTextContent(/won't be sent/);
    expect(screen.queryByRole("button", { name: "Edit order for City Chemist" })).not.toBeInTheDocument(); // can't edit while confirming

    fireEvent.click(screen.getByRole("button", { name: "Keep it" }));
    expect(screen.queryByRole("group", { name: "Confirm cancel" })).not.toBeInTheDocument();
    expect(await db.get(STORES.ORDERS, "p1")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Cancel order for City Chemist" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, cancel order" }));

    expect(await screen.findByText("Order cancelled.")).toBeInTheDocument();
    expect(await db.get(STORES.ORDERS, "p1")).toBeUndefined();
    expect(await screen.findByText(/No orders yet/)).toBeInTheDocument();
    expect(screen.queryByText(/waiting to send/)).not.toBeInTheDocument(); // the header count drops too
  });

  it("a refused order can be fixed and re-sent: 'Edit & retry'", async () => {
    const db = await dbWithOrder({ state: STATE.INVALID, message: "This retailer is not on your beat.", retailerId: 99, retailerName: "Gone Stores" });
    renderApp({ db }); // online: the corrected order will go straight through
    await ready();
    goOrders();

    fireEvent.click(await screen.findByRole("button", { name: "Edit and resend order for Gone Stores" }));
    expect(await screen.findByText(/it was refused\. Fix it and it will be sent again/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Retailer"), { target: { value: "11" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Sent")).toBeInTheDocument();
    expect(await db.get(STORES.ORDERS, "p1")).toMatchObject({ state: STATE.SYNCED, retailerId: 11, message: expect.any(String) });
  });

  it("won't edit or cancel while a send is in progress, and says why", async () => {
    const db = await dbWithOrder();
    let release;
    const api = makeApi({ sync: () => new Promise((r) => { release = () => r(ok({ orders: [], visits: [] })); }) });
    renderApp({ api, db });
    await ready();
    await waitFor(() => expect(api.sync).toHaveBeenCalled()); // the opening sync is now in flight
    goOrders();

    fireEvent.click(await screen.findByRole("button", { name: "Edit order for City Chemist" }));

    expect(await screen.findByText("Sending right now — try again in a moment.")).toBeInTheDocument();
    expect(screen.getByLabelText("Search orders")).toBeInTheDocument(); // stayed on Orders
    await act(async () => { release(); });
  });

  it("warns when the office already had the order before it was edited, so the change didn't apply", async () => {
    const db = await dbWithOrder({ edited: true, total: 150 });
    const api = makeApi({
      sync: async (body) => ok({
        orders: body.orders.map((o) => ({ clientOrderId: o.clientOrderId, status: "DUPLICATE", orderNumber: "FO-7", message: "already", conflicts: [] })),
        visits: [],
      }),
    });
    renderApp({ api, db });
    await ready();

    expect(await screen.findByText(/had already reached the office, so your changes weren't applied/)).toBeInTheDocument();
    goOrders();
    expect(await screen.findByText(/the office had already received this order before you edited it/)).toBeInTheDocument();
    expect(await db.get(STORES.ORDERS, "p1")).toMatchObject({ state: STATE.SYNCED, staleEdit: true });
  });
});

// ───────────── credit position ─────────────

const withCredit = (over = {}) => BEAT.map((r) => ({
  ...r,
  creditLimit: r.retailerId === 11 ? 50000 : r.retailerId === 12 ? 50000 : 0,
  outstandingBalance: r.retailerId === 11 ? 20000 : r.retailerId === 12 ? 52000 : 8000,
  ...(over[r.retailerId] || {}),
}));
function creditApi(over) {
  const api = makeApi();
  api.retailers.mockResolvedValue(ok(withCredit(over)));
  return api;
}
async function openOrderFor(retailerId, api) {
  const utils = renderApp({ api });
  await ready();
  fireEvent.click(screen.getByRole("tab", { name: /New order/ }));
  fireEvent.change(await screen.findByLabelText("Retailer"), { target: { value: String(retailerId) } });
  return utils;
}
const panel = () => screen.getByRole("group", { name: "Credit position" });

describe("RepApp — credit position", () => {
  it("shows what each retailer owes against their limit on the beat, flagging the ones near or over", async () => {
    renderApp({ api: creditApi({ 11: { outstandingBalance: 41000 } }) });
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Whole beat" }));

    const city = screen.getByText("City Chemist").closest(".ra-card");
    expect(within(city).getByText("Owes ₹41,000.00 of ₹50,000.00 limit")).toBeInTheDocument();
    expect(within(city).getByText("Near limit")).toBeInTheDocument();

    const metro = screen.getByText("Metro Medicos").closest(".ra-card");
    expect(within(metro).getByText("Over limit")).toBeInTheDocument();

    const noLimit = screen.getByText("Today Pharma").closest(".ra-card");
    expect(within(noLimit).getByText("Owes ₹8,000.00")).toBeInTheDocument(); // no limit set → just the balance
    expect(within(noLimit).queryByText(/limit/)).not.toBeInTheDocument();
  });

  it("shows nothing for a retailer with no credit information at all", async () => {
    renderApp(); // the default beat has no credit fields
    await ready();
    expect(screen.queryByText(/^Owes/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /New order/ }));
    fireEvent.change(await screen.findByLabelText("Retailer"), { target: { value: "11" } });
    expect(screen.queryByRole("group", { name: "Credit position" })).not.toBeInTheDocument();
  });

  it("shows the position when a retailer is chosen, and updates it as products are added", async () => {
    await openOrderFor(11, creditApi());

    expect(within(panel()).getByText("₹50,000.00")).toBeInTheDocument();   // limit
    expect(within(panel()).getByText("₹20,000.00")).toBeInTheDocument();   // owes now
    expect(within(panel()).getByText("Left after this order")).toBeInTheDocument();
    expect(within(panel()).getByText("₹30,000.00")).toBeInTheDocument();
    expect(within(panel()).queryByText("This order")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add Paracetamol 500" })); // ₹25
    expect(within(panel()).getByText("This order")).toBeInTheDocument();
    expect(within(panel()).getByText("₹29,975.00")).toBeInTheDocument();
    expect(within(panel()).getByText(/Balances as of/)).toBeInTheDocument();
  });

  it("warns — without blocking — when this order would take the retailer over their limit", async () => {
    await openOrderFor(11, creditApi({ 11: { outstandingBalance: 49990 } }));

    fireEvent.click(screen.getByRole("button", { name: "Add Paracetamol 500" })); // +₹25 → ₹15 over

    expect(within(panel()).getByText(/This order takes City Chemist ₹15\.00 over their credit limit/)).toBeInTheDocument();
    expect(within(panel()).getByText("Over the limit by")).toBeInTheDocument();
    expect(within(panel()).getByText("Over limit")).toBeInTheDocument();
    const save = screen.getByRole("button", { name: "Save order" });
    expect(save).not.toBeDisabled();
    fireEvent.click(save);
    expect(await screen.findByText(/Order saved/)).toBeInTheDocument(); // still allowed — the office decides
  });

  it("says so when a retailer is already over their limit before the order", async () => {
    await openOrderFor(12, creditApi());

    expect(within(panel()).getByText(/Metro Medicos is already ₹2,000\.00 over their credit limit/)).toBeInTheDocument();
  });

  it("tells the rep a retailer is close to the limit", async () => {
    await openOrderFor(11, creditApi({ 11: { outstandingBalance: 41000 } }));

    expect(within(panel()).getByText(/City Chemist is at 82% of their credit limit\./)).toBeInTheDocument();
    expect(within(panel()).getByText("Near limit")).toBeInTheDocument();
  });

  it("with no limit set, shows what is owed but no limit rows and no warning", async () => {
    await openOrderFor(13, creditApi());

    expect(within(panel()).getByText("₹8,000.00")).toBeInTheDocument();
    expect(within(panel()).queryByText("Credit limit")).not.toBeInTheDocument();
    expect(within(panel()).queryByRole("status")).not.toBeInTheDocument();
  });

  it("counts the rep's own orders that aren't invoiced yet, so repeat orders can't hide the exposure", async () => {
    const db = await dbWithOrder({ total: 5000 }); // a saved ₹5,000 order for City Chemist
    await setMeta(db, "retailers", withCredit());
    const api = creditApi();
    api.sync.mockResolvedValue(offline());
    renderApp({ api, db });
    await ready();
    fireEvent.click(screen.getByRole("tab", { name: /New order/ }));
    fireEvent.change(await screen.findByLabelText("Retailer"), { target: { value: "11" } });

    expect(within(panel()).getByText("Orders not yet invoiced")).toBeInTheDocument();
    expect(within(panel()).getByText("₹5,000.00")).toBeInTheDocument();
    expect(within(panel()).getByText("₹25,000.00")).toBeInTheDocument(); // 50,000 − 20,000 − 5,000 left
  });

  it("doesn't count an order against itself while it is being edited", async () => {
    const db = await dbWithOrder({ total: 100 });
    await setMeta(db, "retailers", withCredit());
    const api = creditApi();
    api.sync.mockResolvedValue(offline());
    renderApp({ api, db });
    await ready();
    goOrders();
    fireEvent.click(await screen.findByRole("button", { name: "Edit order for City Chemist" }));

    expect(within(panel()).queryByText("Orders not yet invoiced")).not.toBeInTheDocument();
    expect(within(panel()).getByText("₹100.00")).toBeInTheDocument(); // just "This order", counted once
  });
});

// ───────────── collecting payments ─────────────

const setOnline = (value) => Object.defineProperty(window.navigator, "onLine", { value, configurable: true });
afterEach(() => setOnline(true));

function collectApi({ server = [], over } = {}) {
  const api = creditApi(over);
  api.myCollections.mockResolvedValue(ok(server));
  return api;
}
const goCollect = () => fireEvent.click(screen.getByRole("tab", { name: /Collect/ }));
const form = () => within(screen.getByRole("region", { name: "New collection" }));

async function openCollect(api = collectApi(), db) {
  const utils = renderApp({ api, db });
  await ready();
  goCollect();
  await screen.findByRole("region", { name: "New collection" });
  return { api, ...utils };
}

async function fillCollection({ retailer = "11", amount, mode, reference, note } = {}) {
  fireEvent.change(form().getByLabelText("Retailer"), { target: { value: retailer } });
  if (amount !== undefined) fireEvent.change(form().getByLabelText("Amount collected (₹)"), { target: { value: amount } });
  if (mode) fireEvent.click(form().getByRole("radio", { name: mode }));
  if (reference !== undefined) fireEvent.change(form().getByLabelText(/Cheque number|UPI reference|Card slip/), { target: { value: reference } });
  if (note !== undefined) fireEvent.change(form().getByLabelText("Note (optional)"), { target: { value: note } });
}

async function cachedDb() {
  const db = createMemoryDb();
  await setMeta(db, "retailers", withCredit());
  await setMeta(db, "catalog", CATALOG);
  return db;
}

async function dbWithCollection(over = {}) {
  const db = createMemoryDb();
  await setMeta(db, "retailers", withCredit());
  await setMeta(db, "catalog", CATALOG);
  await db.put(STORES.COLLECTIONS, {
    clientCollectionId: "k1", retailerId: 11, retailerName: "City Chemist", amount: 5000, mode: "CASH", reference: null, note: null,
    capturedAt: localIso(), state: STATE.PENDING, attempted: false, message: null, ...over,
  });
  return db;
}

describe("RepApp — collect payment: getting there", () => {
  it("has a Collect tab, and each beat card has a button that opens it with that retailer chosen", async () => {
    renderApp({ api: collectApi() });
    await ready();

    fireEvent.click(screen.getByRole("button", { name: "Collect payment from City Chemist" }));

    expect(await screen.findByRole("region", { name: "New collection" })).toBeInTheDocument();
    expect(form().getByLabelText("Retailer")).toHaveValue("11");
  });

  it("badges the Collect tab with collections that still need attention", async () => {
    setOnline(false);
    const db = await dbWithCollection();
    await db.put(STORES.COLLECTIONS, { clientCollectionId: "k2", retailerId: 11, retailerName: "City Chemist", amount: 10, mode: "CASH", capturedAt: localIso(), state: STATE.INVALID, attempted: true, message: "no" });
    await db.put(STORES.COLLECTIONS, { clientCollectionId: "k3", retailerId: 11, retailerName: "City Chemist", amount: 10, mode: "CASH", capturedAt: localIso(), state: STATE.SYNCED, attempted: true });
    renderApp({ api: collectApi(), db });
    await ready();

    expect(screen.getByRole("tab", { name: /Collect/ })).toHaveTextContent("2"); // waiting + refused; the sent one needs nothing from the rep
  });

  it("explains itself when the rep has no retailers yet", async () => {
    const api = collectApi();
    api.retailers.mockResolvedValue(ok([]));
    renderApp({ api });
    await screen.findByText(/No retailers on your beat yet/);
    goCollect();
    expect(await screen.findByText(/need retailers on your beat before you can record a collection/)).toBeInTheDocument();
  });
});

describe("RepApp — collect payment: the form", () => {
  it("shows what the retailer owes once chosen", async () => {
    await openCollect();
    expect(screen.queryByTestId("owes-line")).not.toBeInTheDocument();

    await fillCollection({});

    expect(screen.getByTestId("owes-line")).toHaveTextContent("Owes ₹20,000.00");
  });

  it("'Full balance' fills the amount, and is not offered when nothing is owed", async () => {
    await openCollect(collectApi({ over: { 13: { outstandingBalance: 0 } } }));

    await fillCollection({});
    fireEvent.click(form().getByRole("button", { name: "Full balance" }));
    expect(form().getByLabelText("Amount collected (₹)")).toHaveValue("20000.00");

    fireEvent.change(form().getByLabelText("Retailer"), { target: { value: "13" } });
    expect(form().queryByRole("button", { name: "Full balance" })).not.toBeInTheDocument();
  });

  it("subtracts money already collected but not yet booked, so the rep doesn't collect the same balance twice", async () => {
    const db = await dbWithCollection({ amount: 5000, state: STATE.SYNCED, attempted: true });
    await openCollect(collectApi(), db);

    await fillCollection({});

    expect(screen.getByTestId("owes-line")).toHaveTextContent("you've already collected ₹5,000.00 the office hasn't booked yet");
    fireEvent.click(form().getByRole("button", { name: "Full balance" }));
    expect(form().getByLabelText("Amount collected (₹)")).toHaveValue("15000.00");
  });

  it("only lets amount characters through", async () => {
    await openCollect();
    await fillCollection({ amount: "12a3,4.5x6" });
    expect(form().getByLabelText("Amount collected (₹)")).toHaveValue("1234.56");
  });

  it("cash needs no reference; UPI offers an optional one; a cheque requires its number", async () => {
    await openCollect();

    expect(form().queryByLabelText(/Cheque number|UPI reference/)).not.toBeInTheDocument();
    fireEvent.click(form().getByRole("radio", { name: "UPI" }));
    expect(form().getByLabelText("UPI reference (optional)")).toBeInTheDocument();
    fireEvent.click(form().getByRole("radio", { name: "Cheque" }));
    expect(form().getByLabelText("Cheque number")).toBeInTheDocument();
    expect(form().getByRole("radio", { name: "Cheque" })).toHaveAttribute("aria-checked", "true");
    expect(form().getByRole("radio", { name: "Cash" })).toHaveAttribute("aria-checked", "false");
  });

  it("clears the reference when switching back to cash", async () => {
    await openCollect();
    await fillCollection({ mode: "Cheque", reference: "000123" });

    fireEvent.click(form().getByRole("radio", { name: "Cash" }));
    fireEvent.click(form().getByRole("radio", { name: "Cheque" }));

    expect(form().getByLabelText("Cheque number")).toHaveValue("");
  });

  it.each([
    ["no retailer", { retailer: "", amount: "100" }, /Pick the retailer/],
    ["no amount", { amount: "" }, /Enter the amount/],
    ["a zero amount", { amount: "0" }, /Enter the amount/],
    ["too many decimals", { amount: "10.555" }, /2 decimal places/],
    ["an absurd amount", { amount: "10000001" }, /extra zero/],
    ["a cheque with no number", { amount: "100", mode: "Cheque", reference: "  " }, /cheque number/],
  ])("refuses %s without saving anything", async (_n, input, message) => {
    const { api } = await openCollect();
    api.sync.mockClear();

    await fillCollection(input);
    fireEvent.click(form().getByRole("button", { name: "Save collection" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(api.sync).not.toHaveBeenCalled();
  });

  it("warns, without blocking, when the amount is more than the retailer still owes — and says the extra becomes an advance", async () => {
    await openCollect();
    await fillCollection({ amount: "25000" });

    expect(screen.getByText(/more than City Chemist still owes \(₹20,000\.00\)/)).toBeInTheDocument();
    expect(screen.getByText(/the extra ₹5,000.00 will be kept as an advance/)).toBeInTheDocument();
    expect(form().getByRole("button", { name: "Save collection" })).not.toBeDisabled();
  });

  it("says so when the retailer owes nothing at all", async () => {
    await openCollect(collectApi({ over: { 11: { outstandingBalance: 0 } } }));
    await fillCollection({ amount: "100" });
    expect(screen.getByText(/doesn't owe anything right now/)).toBeInTheDocument();
  });

  it("gives no warning when the amount is within what is owed", async () => {
    await openCollect();
    await fillCollection({ amount: "20000" });
    expect(screen.queryByText(/kept as an advance/)).not.toBeInTheDocument();
  });
});

describe("RepApp — collect payment: saving", () => {
  it("saves, sends it with the right fields, shows it as awaiting the office, and clears the form", async () => {
    const { api } = await openCollect();
    await fillCollection({ amount: "2500.50", mode: "UPI", reference: "UPI777", note: "paid at counter" });

    fireEvent.click(form().getByRole("button", { name: "Save collection" }));

    expect(await screen.findByText("Sent — awaiting office")).toBeInTheDocument();
    await waitFor(() => expect(api.sync.mock.calls.some(([b]) => (b.collections || []).length === 1)).toBe(true));
    const sent = api.sync.mock.calls.find(([b]) => (b.collections || []).length === 1)[0].collections[0];
    expect(sent).toMatchObject({ retailerId: 11, amount: 2500.5, paymentMode: "UPI", referenceNumber: "UPI777", note: "paid at counter" });
    expect(sent.collectedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/); // no zone — the server parses local time
    expect(form().getByLabelText("Retailer")).toHaveValue("");
    expect(form().getByLabelText("Amount collected (₹)")).toHaveValue("");
    expect(form().getByRole("radio", { name: "Cash" })).toHaveAttribute("aria-checked", "true");
  });

  it("shows the totals: collected today and awaiting the office", async () => {
    await openCollect();
    await fillCollection({ amount: "1200" });
    fireEvent.click(form().getByRole("button", { name: "Save collection" }));
    await screen.findByText("Sent — awaiting office");

    const tile = (label) => screen.getByText(label, { selector: ".ra-stat-label" }).closest(".ra-stat");
    expect(within(tile("Collected today")).getByText("₹1,200.00")).toBeInTheDocument();
    expect(within(tile("Awaiting the office")).getByText("₹1,200.00")).toBeInTheDocument();
    expect(within(tile("Confirmed this month")).getByText("₹0.00")).toBeInTheDocument();
  });

  it("with no signal it is kept on the phone, counted as waiting, and the rep is told", async () => {
    setOnline(false);
    await openCollect(collectApi(), await cachedDb());
    await fillCollection({ amount: "700" });

    fireEvent.click(form().getByRole("button", { name: "Save collection" }));

    expect(await screen.findByText(/Collection saved on this phone/)).toBeInTheDocument();
    expect(screen.getByText("Waiting to send")).toBeInTheDocument();
    expect(screen.getByText("1 item waiting to send")).toBeInTheDocument();
  });

  it("sends the saved collection when the connection returns", async () => {
    setOnline(false);
    const { api } = await openCollect(collectApi(), await cachedDb());
    await fillCollection({ amount: "700" });
    fireEvent.click(form().getByRole("button", { name: "Save collection" }));
    await screen.findByText("Waiting to send");

    setOnline(true);
    await act(async () => { window.dispatchEvent(new Event("online")); });

    expect(await screen.findByText("Sent — awaiting office")).toBeInTheDocument();
    expect(api.sync).toHaveBeenCalled();
  });
});

describe("RepApp — collect payment: the office's decision and cleanup", () => {
  const serverRow = (o) => ({ uKey: "u-" + Math.random(), clientCollectionId: "k1", retailerId: 11, retailerName: "City Chemist", amount: 5000, paymentMode: "CASH", collectedAt: localIso(), status: "SUBMITTED", ...o });

  it("shows Confirmed once the office books it", async () => {
    const db = await dbWithCollection({ state: STATE.SYNCED, attempted: true });
    await openCollect(collectApi({ server: [serverRow({ status: "CONFIRMED" })] }), db);
    expect(await screen.findByText("Confirmed", { selector: ".ra-badge" })).toBeInTheDocument();
  });

  it("shows Rejected with the office's reason", async () => {
    const db = await dbWithCollection({ state: STATE.SYNCED, attempted: true });
    await openCollect(collectApi({ server: [serverRow({ status: "REJECTED", rejectReason: "Cash never reached us" })] }), db);
    expect(await screen.findByText("Rejected: Cash never reached us")).toBeInTheDocument();
  });

  it("includes the office's older collections that the phone no longer holds", async () => {
    await openCollect(collectApi({ server: [serverRow({ clientCollectionId: "ancient", status: "CONFIRMED", collectedAt: "2026-01-10T10:00:00", retailerName: "Old Client", retailerId: 77, amount: 321 })] }));
    const card = (await screen.findByText("₹321.00")).closest("article");
    expect(within(card).getByText("Old Client")).toBeInTheDocument();
    expect(within(card).getByText("Confirmed")).toBeInTheDocument();
  });

  it("a collection that never left the phone can be cancelled — with a confirmation first", async () => {
    setOnline(false); // nothing has been attempted
    const db = await dbWithCollection();
    await openCollect(collectApi(), db);

    fireEvent.click(await screen.findByRole("button", { name: "Cancel collection from City Chemist" }));
    expect(screen.getByRole("group", { name: "Confirm cancel collection" })).toHaveTextContent(/won't be sent/);
    fireEvent.click(screen.getByRole("button", { name: "Keep it" }));
    expect(await db.get(STORES.COLLECTIONS, "k1")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Cancel collection from City Chemist" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, cancel collection" }));

    expect(await screen.findByText("Collection cancelled.")).toBeInTheDocument();
    expect(await db.get(STORES.COLLECTIONS, "k1")).toBeUndefined();
  });

  it("one that was already on its way cannot be cancelled here: the rep is told to ask the office", async () => {
    setOnline(false);
    const db = await dbWithCollection({ attempted: true });
    await openCollect(collectApi(), db);

    expect(await screen.findByText(/On its way to the office — if it's wrong, ask them to reject it/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cancel collection from/ })).not.toBeInTheDocument();
  });

  it("a refused collection shows the reason and can be discarded", async () => {
    setOnline(false);
    const db = await dbWithCollection({ state: STATE.INVALID, attempted: true, message: "This retailer is not on your beat." });
    await openCollect(collectApi(), db);

    expect(await screen.findByText("This retailer is not on your beat.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Discard collection from City Chemist" }));

    await waitFor(async () => expect(await db.get(STORES.COLLECTIONS, "k1")).toBeUndefined());
  });

  it("a sent collection offers neither cancel nor discard", async () => {
    const db = await dbWithCollection({ state: STATE.SYNCED, attempted: true });
    await openCollect(collectApi({ server: [serverRow({})] }), db);
    await screen.findByText("Sent — awaiting office");
    expect(screen.queryByRole("button", { name: /Cancel collection from|Discard collection from/ })).not.toBeInTheDocument();
  });
});

describe("RepApp — collect payment: history filters", () => {
  async function seeded() {
    setOnline(false);
    const db = createMemoryDb();
    await setMeta(db, "retailers", withCredit());
    await setMeta(db, "catalog", CATALOG);
    const put = (o) => db.put(STORES.COLLECTIONS, { retailerId: 11, retailerName: "City Chemist", amount: 100, mode: "CASH", reference: null, note: null, state: STATE.SYNCED, attempted: true, message: null, ...o });
    await put({ clientCollectionId: "a", capturedAt: daysAgo(0), amount: 1000 });
    await put({ clientCollectionId: "b", capturedAt: daysAgo(1), amount: 2500, retailerId: 12, retailerName: "Metro Medicos", mode: "UPI", reference: "UPI777", state: STATE.PENDING, attempted: false });
    await put({ clientCollectionId: "c", capturedAt: daysAgo(3), amount: 400, mode: "CHEQUE", reference: "000123", state: STATE.INVALID, message: "no", note: "post dated" });
    return db;
  }
  const rows = () => screen.getAllByRole("article");

  it("groups by day, newest first", async () => {
    await openCollect(collectApi(), await seeded());
    expect(await screen.findAllByRole("article")).toHaveLength(3);
    expect(screen.getByText("Today", { selector: ".ra-day span" })).toBeInTheDocument();
    expect(screen.getByText("Yesterday", { selector: ".ra-day span" })).toBeInTheDocument();
  });

  it("filters by status chip, with counts that match", async () => {
    await openCollect(collectApi(), await seeded());
    await screen.findAllByRole("article");

    expect(screen.getByRole("button", { name: "All (3)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Waiting to send (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refused (1)" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Confirmed/ })).not.toBeInTheDocument(); // none, so no chip

    fireEvent.click(screen.getByRole("button", { name: "Refused (1)" }));
    expect(rows()).toHaveLength(1);
    expect(within(rows()[0]).getByText("₹400.00")).toBeInTheDocument();
  });

  it("filters by retailer and period", async () => {
    await openCollect(collectApi(), await seeded());
    await screen.findAllByRole("article");

    fireEvent.change(screen.getByLabelText("Filter by retailer"), { target: { value: "12" } });
    expect(rows()).toHaveLength(1);
    expect(within(rows()[0]).getByText("₹2,500.00")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter by retailer"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Period"), { target: { value: "TODAY" } });
    expect(rows()).toHaveLength(1);
  });

  it("searches reference, note and retailer, and resets in one tap", async () => {
    await openCollect(collectApi(), await seeded());
    await screen.findAllByRole("article");

    fireEvent.change(screen.getByLabelText("Search collections"), { target: { value: "upi777" } });
    expect(rows()).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("Search collections"), { target: { value: "post dated" } });
    expect(rows()).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("Search collections"), { target: { value: "nothing like this" } });
    expect(screen.getByText(/No collections match these filters/)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Reset filters" })[0]);
    expect(rows()).toHaveLength(3);
    expect(screen.getByLabelText("Search collections")).toHaveValue("");
  });

  it("says so when there are no collections at all", async () => {
    await openCollect();
    expect(await screen.findByText(/No collections yet/)).toBeInTheDocument();
  });
});

describe("RepApp — editing a refused order after the beat changed", () => {
  // A refused order whose retailer is no longer on the beat the phone just downloaded.
  const refusedForRetailerNoLongerOnBeat = async (db) => {
    const o = await queueOrder(db, { retailerId: 99, retailerName: "Gone Chemist", items: [{ productId: 10, name: "Paracetamol 500", quantity: 2, quotedPrice: 25 }] });
    await db.put(STORES.ORDERS, { ...o, state: STATE.INVALID, message: "Gone Chemist is not on your beat." });
    return o;
  };

  it("keeps the order's own retailer and saves, instead of crashing on an undefined retailer", async () => {
    const db = createMemoryDb();
    const o = await refusedForRetailerNoLongerOnBeat(db);
    renderApp({ db });
    await ready();

    fireEvent.click(screen.getByRole("tab", { name: /Orders/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Edit and resend order for Gone Chemist" }));

    expect(await screen.findByText("Edit order")).toBeInTheDocument();
    expect(screen.getByLabelText("Retailer")).toHaveValue("99");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Order updated.")).toBeInTheDocument();
    const saved = await db.get(STORES.ORDERS, o.clientOrderId);
    expect(saved).toMatchObject({ retailerId: 99, retailerName: "Gone Chemist" });
  });

  it("says so, and keeps the edits on screen, when the order has since been removed from the phone", async () => {
    const db = createMemoryDb();
    const o = await refusedForRetailerNoLongerOnBeat(db);
    renderApp({ db });
    await ready();

    fireEvent.click(screen.getByRole("tab", { name: /Orders/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Edit and resend order for Gone Chemist" }));
    await screen.findByText("Edit order");
    await db.remove(STORES.ORDERS, o.clientOrderId); // removed behind the open editor
    fireEvent.click(screen.getByRole("button", { name: /Sync now/ })); // the screen re-reads the phone and notices
    await waitFor(() => expect(screen.queryByText(/Editing your order for/)).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Save order" }));

    expect(await screen.findByText("That order is no longer on this phone, so there was nothing to save.")).toBeInTheDocument();
    expect(screen.queryByText("Edit order")).not.toBeInTheDocument();
    expect(await db.all(STORES.ORDERS)).toHaveLength(0); // nothing resurrected
  });
});
