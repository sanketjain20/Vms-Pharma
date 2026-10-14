import { createMemoryDb, STORES, getMeta } from "./repDb";
import {
  STATE, localIso, newId, queueOrder, queueVisit, syncOutbox, retryOrder, discardOrder,
  discardVisit, pendingCount, refreshReferenceData, loadReferenceData, updateOrder, cancelOrder, isSyncing,
  queueCollection, cancelCollection, discardCollection, queueHandover,
} from "./repSync";

jest.mock("../../Config/apiClient");

const items = [
  { productId: 10, name: "Paracetamol", quantity: 4, quotedPrice: 25 },
  { productId: 11, name: "Amoxicillin", quantity: 2, quotedPrice: 10 },
];

const ok = (data) => ({ ok: true, status: 200, data });
const offline = () => ({ ok: false, networkError: true, message: "You're offline." });

function fakeApi(handler) {
  return { sync: jest.fn(handler), catalog: jest.fn(), retailers: jest.fn(), myOrders: jest.fn() };
}

describe("helpers", () => {
  it("formats local time without a zone suffix, because the server parses LocalDateTime", () => {
    expect(localIso(new Date(2026, 8, 30, 9, 5, 7))).toBe("2026-09-30T09:05:07");
  });

  it("makes unique ids", () => {
    expect(newId()).not.toBe(newId());
  });
});

describe("capturing", () => {
  it("saves an order locally as PENDING with a client id and a computed total", async () => {
    const db = createMemoryDb();
    const o = await queueOrder(db, { retailerId: 5, retailerName: "City Chemist", items, remarks: "  urgent " });

    expect(o.state).toBe(STATE.PENDING);
    expect(o.clientOrderId).toBeTruthy();
    expect(o.total).toBe(120);
    expect(o.remarks).toBe("urgent");
    expect(await db.get(STORES.ORDERS, o.clientOrderId)).toMatchObject({ retailerId: 5 });
  });

  it("saves an unplanned check-in with no retailer", async () => {
    const db = createMemoryDb();
    const v = await queueVisit(db, { latitude: 18.5, longitude: 73.8, accuracyM: 9, note: "" });
    expect(v.retailerId).toBeNull();
    expect(v.retailerName).toBe("Unplanned stop");
    expect(v.note).toBeNull();
    expect(await pendingCount(db)).toBe(1);
  });
});

describe("syncOutbox", () => {
  it("sends only the fields the server expects and marks accepted orders and visits SYNCED", async () => {
    const db = createMemoryDb();
    const o = await queueOrder(db, { retailerId: 5, retailerName: "City", items, remarks: null });
    const v = await queueVisit(db, { retailerId: 5, retailerName: "City", latitude: 1, longitude: 2, accuracyM: 3, note: "n" });
    const api = fakeApi(async () => ok({
      orders: [{ clientOrderId: o.clientOrderId, status: "ACCEPTED", orderNumber: "FO-1", message: "ok", conflicts: [] }],
      visits: [{ clientVisitId: v.clientVisitId, status: "ACCEPTED", message: "ok" }],
    }));

    const summary = await syncOutbox(db, api);

    const body = api.sync.mock.calls[0][0];
    expect(body.orders[0]).toEqual({
      clientOrderId: o.clientOrderId, retailerId: 5, capturedAt: o.capturedAt, remarks: null,
      items: [{ productId: 10, quantity: 4, quotedPrice: 25 }, { productId: 11, quantity: 2, quotedPrice: 10 }], // no product names
    });
    expect(body.visits[0]).toMatchObject({ clientVisitId: v.clientVisitId, latitude: 1, longitude: 2, accuracyM: 3 });
    expect(summary).toMatchObject({ sent: 2, accepted: 2, offline: false });
    expect((await db.get(STORES.ORDERS, o.clientOrderId)).state).toBe(STATE.SYNCED);
    expect((await db.get(STORES.ORDERS, o.clientOrderId)).serverOrderNumber).toBe("FO-1");
    expect((await db.get(STORES.VISITS, v.clientVisitId)).state).toBe(STATE.SYNCED);
    expect(await pendingCount(db)).toBe(0);
  });

  it("keeps everything PENDING when the network is down, so nothing is lost", async () => {
    const db = createMemoryDb();
    const o = await queueOrder(db, { retailerId: 5, retailerName: "City", items });

    const summary = await syncOutbox(db, fakeApi(async () => offline()));

    expect(summary.offline).toBe(true);
    expect((await db.get(STORES.ORDERS, o.clientOrderId)).state).toBe(STATE.PENDING);
  });

  it("keeps everything PENDING on a server error and reports the message", async () => {
    const db = createMemoryDb();
    await queueOrder(db, { retailerId: 5, retailerName: "City", items });

    const summary = await syncOutbox(db, fakeApi(async () => ({ ok: false, status: 500, message: "boom" })));

    expect(summary.error).toBe("boom");
    expect(await pendingCount(db)).toBe(1);
  });

  it("records price/stock conflicts against the order so the rep can see what changed", async () => {
    const db = createMemoryDb();
    const o = await queueOrder(db, { retailerId: 5, retailerName: "City", items });
    const conflicts = [{ productId: 10, reason: "PRICE_CHANGED", quotedPrice: 25, currentPrice: 30, availableQty: 100 }];
    const api = fakeApi(async () => ok({
      orders: [{ clientOrderId: o.clientOrderId, status: "ACCEPTED_WITH_CONFLICTS", orderNumber: "FO-2", message: "flagged", conflicts }],
      visits: [],
    }));

    const summary = await syncOutbox(db, api);

    const saved = await db.get(STORES.ORDERS, o.clientOrderId);
    expect(summary.conflicts).toBe(1);
    expect(saved.state).toBe(STATE.CONFLICT);
    expect(saved.conflicts).toEqual(conflicts);
    expect(await pendingCount(db)).toBe(0); // the server has it; it is not retried
  });

  it("treats DUPLICATE as success, so a lost response never double-books an order", async () => {
    const db = createMemoryDb();
    const o = await queueOrder(db, { retailerId: 5, retailerName: "City", items });

    await syncOutbox(db, fakeApi(async () => ok({
      orders: [{ clientOrderId: o.clientOrderId, status: "DUPLICATE", orderNumber: "FO-1", message: "already", conflicts: [] }], visits: [],
    })));

    expect((await db.get(STORES.ORDERS, o.clientOrderId)).state).toBe(STATE.SYNCED);
  });

  it("marks a refused order INVALID with the server's reason, and can retry or discard only that", async () => {
    const db = createMemoryDb();
    const bad = await queueOrder(db, { retailerId: 5, retailerName: "City", items });
    const waiting = await queueOrder(db, { retailerId: 6, retailerName: "Other", items });
    const api = fakeApi(async () => ok({
      orders: [{ clientOrderId: bad.clientOrderId, status: "INVALID", message: "This retailer is not on your beat.", conflicts: [] }], visits: [],
    }));

    const summary = await syncOutbox(db, api); // `waiting` got no verdict
    expect(summary.invalid).toBe(1);
    expect(await db.get(STORES.ORDERS, bad.clientOrderId)).toMatchObject({ state: STATE.INVALID, message: "This retailer is not on your beat." });
    expect((await db.get(STORES.ORDERS, waiting.clientOrderId)).state).toBe(STATE.PENDING); // retried next time

    await discardOrder(db, waiting.clientOrderId); // refuses: not INVALID, server hasn't answered
    expect(await db.get(STORES.ORDERS, waiting.clientOrderId)).toBeDefined();

    await retryOrder(db, bad.clientOrderId);
    expect((await db.get(STORES.ORDERS, bad.clientOrderId)).state).toBe(STATE.PENDING);
    await syncOutbox(db, fakeApi(async () => ok({
      orders: [{ clientOrderId: bad.clientOrderId, status: "INVALID", message: "still no", conflicts: [] }], visits: [],
    })));
    await discardOrder(db, bad.clientOrderId);
    expect(await db.get(STORES.ORDERS, bad.clientOrderId)).toBeUndefined();
  });

  it("marks a refused check-in INVALID and lets it be discarded", async () => {
    const db = createMemoryDb();
    const v = await queueVisit(db, { retailerId: 9, retailerName: "X", latitude: 1, longitude: 2 });
    await syncOutbox(db, fakeApi(async () => ok({
      orders: [], visits: [{ clientVisitId: v.clientVisitId, status: "INVALID", message: "Location is missing or out of range." }],
    })));

    expect((await db.get(STORES.VISITS, v.clientVisitId)).state).toBe(STATE.INVALID);
    await discardVisit(db, v.clientVisitId);
    expect(await db.get(STORES.VISITS, v.clientVisitId)).toBeUndefined();
  });

  it("sends large backlogs in batches of 50", async () => {
    const db = createMemoryDb();
    for (let i = 0; i < 120; i++) await queueOrder(db, { retailerId: 5, retailerName: "City", items });
    const api = fakeApi(async (body) => ok({
      orders: body.orders.map((o) => ({ clientOrderId: o.clientOrderId, status: "ACCEPTED", orderNumber: "FO", message: "", conflicts: [] })),
      visits: [],
    }));

    const summary = await syncOutbox(db, api);

    expect(api.sync.mock.calls.map(([b]) => b.orders.length)).toEqual([50, 50, 20]);
    expect(summary.accepted).toBe(120);
  });

  it("stops at the first failed batch and leaves the rest PENDING", async () => {
    const db = createMemoryDb();
    for (let i = 0; i < 60; i++) await queueOrder(db, { retailerId: 5, retailerName: "City", items });
    let n = 0;
    const api = fakeApi(async (body) => {
      if (++n === 2) return offline();
      return ok({ orders: body.orders.map((o) => ({ clientOrderId: o.clientOrderId, status: "ACCEPTED", orderNumber: "FO", message: "", conflicts: [] })), visits: [] });
    });

    const summary = await syncOutbox(db, api);

    expect(summary).toMatchObject({ accepted: 50, offline: true });
    expect(await pendingCount(db)).toBe(10);
  });

  it("makes no call when there is nothing to send", async () => {
    const db = createMemoryDb();
    const api = fakeApi(async () => ok({ orders: [], visits: [] }));
    await syncOutbox(db, api);
    expect(api.sync).not.toHaveBeenCalled();
  });

  it("joins a sync already in flight instead of sending the same orders twice", async () => {
    const db = createMemoryDb();
    await queueOrder(db, { retailerId: 5, retailerName: "City", items });
    let release;
    const api = fakeApi(() => new Promise((resolve) => { release = () => resolve(ok({ orders: [], visits: [] })); }));

    const a = syncOutbox(db, api);
    const b = syncOutbox(db, api);
    await new Promise((r) => setTimeout(r, 0));
    release();
    await Promise.all([a, b]);

    expect(api.sync).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it("forgets confirmed items after a week but never touches unsent or refused ones", async () => {
    const db = createMemoryDb();
    const old = "2026-01-01T10:00:00";
    await db.put(STORES.ORDERS, { clientOrderId: "synced-old", state: STATE.SYNCED, capturedAt: old, items: [] });
    await db.put(STORES.ORDERS, { clientOrderId: "invalid-old", state: STATE.INVALID, capturedAt: old, items: [] });
    await db.put(STORES.ORDERS, { clientOrderId: "pending-old", state: STATE.PENDING, capturedAt: old, items: [] });
    await db.put(STORES.ORDERS, { clientOrderId: "synced-new", state: STATE.SYNCED, capturedAt: localIso(), items: [] });
    // a pending one is present, so a sync round runs and prunes afterwards
    const api = fakeApi(async () => ok({ orders: [], visits: [] }));
    await syncOutbox(db, api);

    expect(await db.get(STORES.ORDERS, "synced-old")).toBeUndefined();
    expect(await db.get(STORES.ORDERS, "invalid-old")).toBeDefined();
    expect(await db.get(STORES.ORDERS, "pending-old")).toBeDefined();
    expect(await db.get(STORES.ORDERS, "synced-new")).toBeDefined();
  });
});

describe("reference data", () => {
  it("caches catalog, beat and server orders for offline use", async () => {
    const db = createMemoryDb();
    const api = {
      catalog: async () => ok([{ productId: 1, name: "P" }]),
      retailers: async () => ok([{ retailerId: 2, shopName: "S" }]),
      myOrders: async () => ok([{ uKey: "o" }]),
    };

    const r = await refreshReferenceData(db, api);

    expect(r.ok).toBe(true);
    const cached = await loadReferenceData(db);
    expect(cached.catalog).toHaveLength(1);
    expect(cached.retailers[0].shopName).toBe("S");
    expect(cached.serverOrders).toHaveLength(1);
    expect(cached.refreshedAt).toBeTruthy();
  });

  it("keeps the previous copies when offline, so the rep can still work", async () => {
    const db = createMemoryDb();
    await refreshReferenceData(db, {
      catalog: async () => ok([{ productId: 1 }]), retailers: async () => ok([{ retailerId: 2 }]), myOrders: async () => ok([]),
    });
    const r = await refreshReferenceData(db, { catalog: async () => offline(), retailers: async () => offline(), myOrders: async () => offline() });

    expect(r).toEqual({ ok: false, offline: true });
    expect((await loadReferenceData(db)).catalog).toEqual([{ productId: 1 }]);
    expect(await getMeta(db, "retailers")).toEqual([{ retailerId: 2 }]);
  });
});

describe("editing and cancelling an order that hasn't been accepted", () => {
  const edited = [{ productId: 10, name: "Paracetamol", quantity: 9, quotedPrice: 25 }, { productId: 12, name: "Syrup", quantity: 1, quotedPrice: 40 }];

  it("replaces the lines, note and retailer, recomputes the total, and keeps the same client id", async () => {
    const db = createMemoryDb();
    const o = await queueOrder(db, { retailerId: 5, retailerName: "City", items, remarks: "old note" });

    const r = await updateOrder(db, o.clientOrderId, { retailerId: 6, retailerName: "Metro", items: edited, remarks: "  new note " });

    expect(r.ok).toBe(true);
    const saved = await db.get(STORES.ORDERS, o.clientOrderId);
    expect(saved).toMatchObject({ retailerId: 6, retailerName: "Metro", remarks: "new note", total: 265, state: STATE.PENDING, edited: true });
    expect(saved.items).toHaveLength(2);
    expect(saved.capturedAt).toBe(o.capturedAt); // when it was taken doesn't change
    expect((await db.all(STORES.ORDERS))).toHaveLength(1);
  });

  it("puts a refused order back in the queue, clearing the refusal", async () => {
    const db = createMemoryDb();
    const o = await queueOrder(db, { retailerId: 5, retailerName: "City", items });
    await db.put(STORES.ORDERS, { ...o, state: STATE.INVALID, message: "This retailer is not on your beat." });

    const r = await updateOrder(db, o.clientOrderId, { retailerId: 7, retailerName: "On beat", items });

    expect(r.ok).toBe(true);
    expect(await db.get(STORES.ORDERS, o.clientOrderId)).toMatchObject({ state: STATE.PENDING, message: null, retailerId: 7 });
    expect((await db.get(STORES.ORDERS, o.clientOrderId)).edited).toBe(false); // the server never stored it, so it can't be stale
  });

  it("refuses to change an order the office already has", async () => {
    const db = createMemoryDb();
    const o = await queueOrder(db, { retailerId: 5, retailerName: "City", items });
    await db.put(STORES.ORDERS, { ...o, state: STATE.SYNCED });

    const r = await updateOrder(db, o.clientOrderId, { retailerId: 5, retailerName: "City", items: edited });

    expect(r).toMatchObject({ ok: false, reason: "SENT" });
    expect((await db.get(STORES.ORDERS, o.clientOrderId)).items).toHaveLength(2); // untouched: still the original two lines
    expect((await db.get(STORES.ORDERS, o.clientOrderId)).total).toBe(120);
  });

  it("refuses an empty order and one that no longer exists", async () => {
    const db = createMemoryDb();
    const o = await queueOrder(db, { retailerId: 5, retailerName: "City", items });

    expect(await updateOrder(db, o.clientOrderId, { retailerId: 5, retailerName: "City", items: [] })).toMatchObject({ ok: false, reason: "EMPTY" });
    expect(await updateOrder(db, "nope", { retailerId: 5, retailerName: "City", items })).toMatchObject({ ok: false, reason: "GONE" });
    expect((await db.get(STORES.ORDERS, o.clientOrderId)).total).toBe(120);
  });

  it("cancels an order that is still waiting, and only that", async () => {
    const db = createMemoryDb();
    const waiting = await queueOrder(db, { retailerId: 5, retailerName: "City", items });
    const sent = await queueOrder(db, { retailerId: 5, retailerName: "City", items });
    await db.put(STORES.ORDERS, { ...sent, state: STATE.CONFLICT });

    expect((await cancelOrder(db, waiting.clientOrderId)).ok).toBe(true);
    expect(await db.get(STORES.ORDERS, waiting.clientOrderId)).toBeUndefined();

    expect(await cancelOrder(db, sent.clientOrderId)).toMatchObject({ ok: false, reason: "SENT" });
    expect(await db.get(STORES.ORDERS, sent.clientOrderId)).toBeDefined();
    expect(await cancelOrder(db, "nope")).toMatchObject({ ok: false, reason: "GONE" });
  });

  it("won't change or cancel while a sync is talking to the server (it may be sending that very order)", async () => {
    const db = createMemoryDb();
    const o = await queueOrder(db, { retailerId: 5, retailerName: "City", items });
    let release;
    const api = fakeApi(() => new Promise((resolve) => { release = () => resolve(ok({ orders: [], visits: [] })); }));

    const running = syncOutbox(db, api);
    await new Promise((r) => setTimeout(r, 0));

    expect(isSyncing(db)).toBe(true);
    expect(await cancelOrder(db, o.clientOrderId)).toMatchObject({ ok: false, reason: "BUSY" });
    expect(await updateOrder(db, o.clientOrderId, { retailerId: 5, retailerName: "City", items: edited })).toMatchObject({ ok: false, reason: "BUSY" });
    expect(await db.get(STORES.ORDERS, o.clientOrderId)).toBeDefined();

    release();
    await running;
    expect(isSyncing(db)).toBe(false);
  });

  it("flags an edit the office never saw: if they already had the earlier copy, the server says DUPLICATE and the edit did not apply", async () => {
    const db = createMemoryDb();
    const o = await queueOrder(db, { retailerId: 5, retailerName: "City", items });
    await updateOrder(db, o.clientOrderId, { retailerId: 5, retailerName: "City", items: edited });
    const api = fakeApi(async () => ok({
      orders: [{ clientOrderId: o.clientOrderId, status: "DUPLICATE", orderNumber: "FO-1", message: "already", conflicts: [] }], visits: [],
    }));

    const summary = await syncOutbox(db, api);

    expect(summary.staleEdits).toBe(1);
    expect(await db.get(STORES.ORDERS, o.clientOrderId)).toMatchObject({ state: STATE.SYNCED, staleEdit: true });
  });

  it("an ordinary accepted edit is not flagged, and neither is a DUPLICATE of an order that was never edited", async () => {
    const db = createMemoryDb();
    const a = await queueOrder(db, { retailerId: 5, retailerName: "City", items });
    await updateOrder(db, a.clientOrderId, { retailerId: 5, retailerName: "City", items: edited });
    const b = await queueOrder(db, { retailerId: 5, retailerName: "City", items });
    const api = fakeApi(async () => ok({
      orders: [
        { clientOrderId: a.clientOrderId, status: "ACCEPTED", orderNumber: "FO-1", message: "", conflicts: [] },
        { clientOrderId: b.clientOrderId, status: "DUPLICATE", orderNumber: "FO-2", message: "", conflicts: [] },
      ], visits: [],
    }));

    const summary = await syncOutbox(db, api);

    expect(summary.staleEdits).toBe(0);
    expect((await db.get(STORES.ORDERS, a.clientOrderId)).staleEdit).toBeUndefined();
    expect((await db.get(STORES.ORDERS, b.clientOrderId)).staleEdit).toBeUndefined();
  });
});

describe("collections", () => {
  const draft = { retailerId: 5, retailerName: "City", amount: "2500.5", mode: "UPI", reference: "  UPI123 ", note: " at the counter " };

  it("saves a collection locally as PENDING, tidying the numbers and text, and not yet 'attempted'", async () => {
    const db = createMemoryDb();
    const c = await queueCollection(db, draft);

    expect(c).toMatchObject({ amount: 2500.5, mode: "UPI", reference: "UPI123", note: "at the counter", state: STATE.PENDING, attempted: false });
    expect(c.clientCollectionId).toBeTruthy();
    expect(await db.get(STORES.COLLECTIONS, c.clientCollectionId)).toBeDefined();
    expect(await pendingCount(db)).toBe(1); // counts toward "waiting to send"
  });

  it("rounds a float to paise", async () => {
    const db = createMemoryDb();
    expect((await queueCollection(db, { ...draft, amount: 0.1 + 0.2 })).amount).toBe(0.3);
  });

  it("sends it with the field names the server expects, and marks it attempted BEFORE the request goes out", async () => {
    const db = createMemoryDb();
    const c = await queueCollection(db, draft);
    let attemptedAtSendTime;
    const api = fakeApi(async () => {
      attemptedAtSendTime = (await db.get(STORES.COLLECTIONS, c.clientCollectionId)).attempted;
      return ok({ orders: [], visits: [], collections: [{ clientCollectionId: c.clientCollectionId, status: "ACCEPTED", message: "ok" }] });
    });

    const summary = await syncOutbox(db, api);

    expect(attemptedAtSendTime).toBe(true);
    expect(api.sync.mock.calls[0][0].collections[0]).toEqual({
      clientCollectionId: c.clientCollectionId, retailerId: 5, amount: 2500.5, paymentMode: "UPI", referenceNumber: "UPI123",
      note: "at the counter", collectedAt: c.capturedAt, invoiceId: null,
    });
    expect(summary.accepted).toBe(1);
    expect((await db.get(STORES.COLLECTIONS, c.clientCollectionId)).state).toBe(STATE.SYNCED);
  });

  it("keeps it PENDING (and attempted) when the network fails, so it is retried and can no longer be cancelled blindly", async () => {
    const db = createMemoryDb();
    const c = await queueCollection(db, draft);

    const summary = await syncOutbox(db, fakeApi(async () => offline()));

    expect(summary.offline).toBe(true);
    expect(await db.get(STORES.COLLECTIONS, c.clientCollectionId)).toMatchObject({ state: STATE.PENDING, attempted: true });
  });

  it("treats DUPLICATE as success, so a lost reply never records the money twice", async () => {
    const db = createMemoryDb();
    const c = await queueCollection(db, draft);
    await syncOutbox(db, fakeApi(async () => ok({ orders: [], visits: [], collections: [{ clientCollectionId: c.clientCollectionId, status: "DUPLICATE", message: "already" }] })));
    expect((await db.get(STORES.COLLECTIONS, c.clientCollectionId)).state).toBe(STATE.SYNCED);
  });

  it("marks a refused collection INVALID with the reason, and it can then be discarded (only then)", async () => {
    const db = createMemoryDb();
    const bad = await queueCollection(db, draft);
    const waiting = await queueCollection(db, draft);
    await syncOutbox(db, fakeApi(async () => ok({ orders: [], visits: [], collections: [{ clientCollectionId: bad.clientCollectionId, status: "INVALID", message: "This retailer is not on your beat." }] })));

    expect(await db.get(STORES.COLLECTIONS, bad.clientCollectionId)).toMatchObject({ state: STATE.INVALID, message: "This retailer is not on your beat." });
    expect((await db.get(STORES.COLLECTIONS, waiting.clientCollectionId)).state).toBe(STATE.PENDING); // got no verdict

    await discardCollection(db, waiting.clientCollectionId); // not refused → refuses to throw it away
    expect(await db.get(STORES.COLLECTIONS, waiting.clientCollectionId)).toBeDefined();
    await discardCollection(db, bad.clientCollectionId);
    expect(await db.get(STORES.COLLECTIONS, bad.clientCollectionId)).toBeUndefined();
  });

  it("sends a big backlog in batches of 50", async () => {
    const db = createMemoryDb();
    for (let i = 0; i < 120; i++) await queueCollection(db, draft);
    const api = fakeApi(async (body) => ok({ orders: [], visits: [], collections: body.collections.map((c) => ({ clientCollectionId: c.clientCollectionId, status: "ACCEPTED", message: "" })) }));

    const summary = await syncOutbox(db, api);

    expect(api.sync.mock.calls.map(([b]) => b.collections.length)).toEqual([50, 50, 20]);
    expect(summary.accepted).toBe(120);
  });

  it("an older server that answers without a collections list leaves them PENDING for the next attempt", async () => {
    const db = createMemoryDb();
    const c = await queueCollection(db, draft);
    await syncOutbox(db, fakeApi(async () => ok({ orders: [], visits: [] })));
    expect((await db.get(STORES.COLLECTIONS, c.clientCollectionId)).state).toBe(STATE.PENDING);
  });

  describe("cancelling", () => {
    it("works while the collection has never left the phone", async () => {
      const db = createMemoryDb();
      const c = await queueCollection(db, draft);

      expect((await cancelCollection(db, c.clientCollectionId)).ok).toBe(true);
      expect(await db.get(STORES.COLLECTIONS, c.clientCollectionId)).toBeUndefined();
    });

    it("is refused once a send was attempted — the office may hold it, so the rep must ask them to reject it", async () => {
      const db = createMemoryDb();
      const c = await queueCollection(db, draft);
      await syncOutbox(db, fakeApi(async () => offline())); // the reply was lost / network failed mid-send

      const r = await cancelCollection(db, c.clientCollectionId);

      expect(r).toMatchObject({ ok: false, reason: "ATTEMPTED" });
      expect(r.message).toMatch(/ask the office to reject it/);
      expect(await db.get(STORES.COLLECTIONS, c.clientCollectionId)).toBeDefined();
    });

    it("is refused once it has been sent", async () => {
      const db = createMemoryDb();
      const c = await queueCollection(db, draft);
      await db.put(STORES.COLLECTIONS, { ...c, state: STATE.SYNCED, attempted: true });
      expect(await cancelCollection(db, c.clientCollectionId)).toMatchObject({ ok: false, reason: "SENT" });
    });

    it("is refused while a sync is running, and for something that is not there", async () => {
      const db = createMemoryDb();
      const c = await queueCollection(db, draft);
      let release;
      const running = syncOutbox(db, fakeApi(() => new Promise((r) => { release = () => r(ok({ orders: [], visits: [], collections: [] })); })));
      await new Promise((r) => setTimeout(r, 0));

      expect(await cancelCollection(db, c.clientCollectionId)).toMatchObject({ ok: false, reason: "BUSY" });
      release();
      await running;
      expect(await cancelCollection(db, "nope")).toMatchObject({ ok: false, reason: "GONE" });
    });
  });

  it("caches the rep's collections as the office sees them, and keeps the old copy when offline", async () => {
    const db = createMemoryDb();
    const api = {
      catalog: async () => ok([]), retailers: async () => ok([]), myOrders: async () => ok([]),
      myCollections: async () => ok([{ uKey: "u1", clientCollectionId: "x", status: "CONFIRMED" }]),
    };
    await refreshReferenceData(db, api);
    expect((await loadReferenceData(db)).serverCollections).toHaveLength(1);

    await refreshReferenceData(db, { ...api, catalog: async () => offline(), retailers: async () => offline(), myOrders: async () => offline(), myCollections: async () => offline() });
    expect((await loadReferenceData(db)).serverCollections).toHaveLength(1);
  });

  it("forgets confirmed items after a week but never unsent or refused ones", async () => {
    const db = createMemoryDb();
    const old = "2026-01-01T10:00:00";
    await db.put(STORES.COLLECTIONS, { clientCollectionId: "synced-old", state: STATE.SYNCED, capturedAt: old });
    await db.put(STORES.COLLECTIONS, { clientCollectionId: "invalid-old", state: STATE.INVALID, capturedAt: old });
    await db.put(STORES.COLLECTIONS, { clientCollectionId: "pending-old", state: STATE.PENDING, capturedAt: old, retailerId: 1, amount: 1, mode: "CASH" });
    await syncOutbox(db, fakeApi(async () => ok({ orders: [], visits: [], collections: [] })));

    expect(await db.get(STORES.COLLECTIONS, "synced-old")).toBeUndefined();
    expect(await db.get(STORES.COLLECTIONS, "invalid-old")).toBeDefined();
    expect(await db.get(STORES.COLLECTIONS, "pending-old")).toBeDefined();
  });
});

describe("a verdict never undoes what the rep did while the request was in flight", () => {
  const held = () => {
    let release;
    const api = fakeApi(() => new Promise((resolve) => { release = (data) => resolve(ok(data)); }));
    return { api, release: (data) => release(data) };
  };
  const tick = () => new Promise((r) => setTimeout(r, 0));

  it("a removed order stays removed when the server's answer arrives afterwards", async () => {
    const db = createMemoryDb();
    const o = await queueOrder(db, { retailerId: 5, retailerName: "City", items });
    const { api, release } = held();

    const running = syncOutbox(db, api);
    await tick();
    await db.remove(STORES.ORDERS, o.clientOrderId); // gone from the phone while the request is out
    release({ orders: [{ clientOrderId: o.clientOrderId, status: "INVALID", message: "Retailer not on your beat", conflicts: [] }], visits: [] });
    await running;

    expect(await db.get(STORES.ORDERS, o.clientOrderId)).toBeUndefined(); // no ghost order with an Edit & retry button
  });

  it("a removed collection and visit stay removed too", async () => {
    const db = createMemoryDb();
    const c = await queueCollection(db, { retailerId: 5, retailerName: "City", amount: 50, mode: "CASH" });
    const v = await queueVisit(db, { retailerId: 5, retailerName: "City", latitude: 1, longitude: 2 });
    const { api, release } = held();

    const running = syncOutbox(db, api);
    await tick();
    await db.remove(STORES.COLLECTIONS, c.clientCollectionId);
    await db.remove(STORES.VISITS, v.clientVisitId);
    release({
      orders: [], collections: [{ clientCollectionId: c.clientCollectionId, status: "ACCEPTED", message: "" }],
      visits: [{ clientVisitId: v.clientVisitId, status: "ACCEPTED", message: "" }],
    });
    await running;

    expect(await db.get(STORES.COLLECTIONS, c.clientCollectionId)).toBeUndefined();
    expect(await db.get(STORES.VISITS, v.clientVisitId)).toBeUndefined();
  });

  it("closing the day while collections are being sent keeps them tied to that day-close", async () => {
    const db = createMemoryDb();
    const c = await queueCollection(db, { retailerId: 5, retailerName: "City", amount: 300, mode: "CASH" });
    let release;
    let calls = 0;
    const api = fakeApi(() => {
      calls++;
      if (calls > 1) { // the day-close itself goes out in a second request, after the collections are confirmed
        return Promise.resolve(ok({ orders: [], visits: [], collections: [], handovers: [{ clientHandoverId: sentHandoverId(), status: "ACCEPTED", message: "", expectedCash: 300 }] }));
      }
      return new Promise((resolve) => { release = (data) => resolve(ok(data)); });
    });
    let closedId = null;
    const sentHandoverId = () => closedId;

    const running = syncOutbox(db, api);
    await tick();
    const closed = await queueHandover(db, { collectionIds: [c.clientCollectionId], expectedCash: 300, cashCounted: 300 });
    expect(closed.ok).toBe(true);
    closedId = closed.handover.clientHandoverId;
    release({ orders: [], visits: [], collections: [{ clientCollectionId: c.clientCollectionId, status: "ACCEPTED", message: "" }] });
    await running;

    const after = await db.get(STORES.COLLECTIONS, c.clientCollectionId);
    expect(after.state).toBe(STATE.SYNCED);                                // the verdict was recorded...
    expect(after.handoverClientId).toBe(closed.handover.clientHandoverId); // ...without erasing the day-close link
    expect((await queueHandover(db, { collectionIds: [c.clientCollectionId], expectedCash: 300, cashCounted: 300 })).reason).toBe("TAKEN");
  });
});

describe("retry and discard of a refused order", () => {
  it("retry says why it cannot, instead of silently doing nothing", async () => {
    const db = createMemoryDb();
    const o = await queueOrder(db, { retailerId: 5, retailerName: "City", items });
    expect(await retryOrder(db, o.clientOrderId)).toMatchObject({ ok: false, reason: "STATE" }); // still waiting, not refused
    expect(await retryOrder(db, "no-such-order")).toMatchObject({ ok: false, reason: "GONE" });
  });

  it("retry and discard are refused while a sync is talking to the server", async () => {
    const db = createMemoryDb();
    const bad = await queueOrder(db, { retailerId: 5, retailerName: "City", items });
    await db.put(STORES.ORDERS, { ...bad, state: STATE.INVALID, message: "no" });
    await queueOrder(db, { retailerId: 6, retailerName: "Other", items });
    let release;
    const api = fakeApi(() => new Promise((resolve) => { release = () => resolve(ok({ orders: [], visits: [] })); }));

    const running = syncOutbox(db, api);
    await new Promise((r) => setTimeout(r, 0));
    expect(await retryOrder(db, bad.clientOrderId)).toMatchObject({ ok: false, reason: "BUSY" });
    expect(await discardOrder(db, bad.clientOrderId)).toMatchObject({ ok: false, reason: "BUSY" });
    expect(await db.get(STORES.ORDERS, bad.clientOrderId)).toBeDefined();

    release();
    await running;
    expect(await retryOrder(db, bad.clientOrderId)).toEqual({ ok: true });
  });
});
