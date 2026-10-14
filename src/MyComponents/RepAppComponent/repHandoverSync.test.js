import { createMemoryDb, STORES, getMeta } from "./repDb";
import {
  STATE, queueCollection, cancelCollection, syncOutbox, pendingCount, refreshReferenceData,
  queueHandover, cancelHandover, discardHandover,
} from "./repSync";

jest.mock("../../Config/apiClient");

const ok = (data) => ({ ok: true, status: 200, data });
const offline = () => ({ ok: false, networkError: true, message: "You're offline." });
const fakeApi = (handler) => ({ sync: jest.fn(handler), catalog: jest.fn(), retailers: jest.fn(), myOrders: jest.fn() });

describe("invoice allocation", () => {
  it("stores the invoice on the collection and sends its id", async () => {
    const db = createMemoryDb();
    const c = await queueCollection(db, { retailerId: 5, retailerName: "City", amount: 100, mode: "UPI", invoiceId: 42, invoiceNumber: "INV42" });
    expect(c).toMatchObject({ invoiceId: 42, invoiceNumber: "INV42", handoverClientId: null });
    const api = fakeApi(async (body) => ok({ orders: [], visits: [], collections: body.collections.map((x) => ({ clientCollectionId: x.clientCollectionId, status: "ACCEPTED", message: "" })) }));
    await syncOutbox(db, api);
    expect(api.sync.mock.calls[0][0].collections[0].invoiceId).toBe(42);
  });
});

describe("cash handover (day close)", () => {
  const cash = (db, amount = 100) => queueCollection(db, { retailerId: 5, retailerName: "City", amount, mode: "CASH" });
  // answers collections and handovers in whichever request carries them
  const serverApi = (verdict = "ACCEPTED") => fakeApi(async (body) => ok({
    orders: [], visits: [],
    collections: (body.collections || []).map((x) => ({ clientCollectionId: x.clientCollectionId, status: "ACCEPTED", message: "" })),
    handovers: (body.handovers || []).map((h) => ({ clientHandoverId: h.clientHandoverId, status: verdict, message: verdict === "INVALID" ? "nope" : "", expectedCash: 200 })),
  }));
  const make = async (db, ids, counted = 100, expected = 100) =>
    (await queueHandover(db, { collectionIds: ids, expectedCash: expected, cashCounted: counted })).handover;

  it("queues a day-close and locks its collections to it", async () => {
    const db = createMemoryDb();
    const a = await cash(db);
    const b = await cash(db, 50);
    const r = await queueHandover(db, { collectionIds: [a.clientCollectionId, b.clientCollectionId], expectedCash: 150, cashCounted: "140.456", note: " short " });
    expect(r.ok).toBe(true);
    expect(r.handover).toMatchObject({ cashCounted: 140.46, expectedCash: 150, note: "short", state: STATE.PENDING, attempted: false });
    expect((await db.get(STORES.COLLECTIONS, a.clientCollectionId)).handoverClientId).toBe(r.handover.clientHandoverId);
    expect(await pendingCount(db)).toBe(3);
  });

  it("refuses empty, missing and already-taken collections", async () => {
    const db = createMemoryDb();
    const a = await cash(db);
    expect((await queueHandover(db, { collectionIds: [], expectedCash: 0, cashCounted: 0 })).reason).toBe("EMPTY");
    expect((await queueHandover(db, { collectionIds: ["nope"], expectedCash: 0, cashCounted: 0 })).reason).toBe("GONE");
    await make(db, [a.clientCollectionId]);
    expect((await queueHandover(db, { collectionIds: [a.clientCollectionId], expectedCash: 100, cashCounted: 100 })).reason).toBe("TAKEN");
  });

  it("a collection inside a day-close cannot be cancelled on its own", async () => {
    const db = createMemoryDb();
    const a = await cash(db);
    await make(db, [a.clientCollectionId]);
    const r = await cancelCollection(db, a.clientCollectionId);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("HANDOVER");
  });

  it("cancelling an unsent day-close frees its collections", async () => {
    const db = createMemoryDb();
    const a = await cash(db);
    const h = await make(db, [a.clientCollectionId]);
    expect((await cancelHandover(db, h.clientHandoverId)).ok).toBe(true);
    expect((await db.get(STORES.COLLECTIONS, a.clientCollectionId)).handoverClientId).toBeNull();
    expect(await db.get(STORES.HANDOVERS, h.clientHandoverId)).toBeUndefined();
    expect((await cancelHandover(db, h.clientHandoverId)).reason).toBe("GONE");
  });

  it("sends collections first, then the day-close in its own request, and ends SYNCED", async () => {
    const db = createMemoryDb();
    const a = await cash(db, 200);
    const h = await make(db, [a.clientCollectionId], 190, 200);
    const api = serverApi();
    await syncOutbox(db, api);
    const bodies = api.sync.mock.calls.map((c) => c[0]);
    expect(bodies.some((b) => b.collections.length === 1 && !(b.handovers || []).length)).toBe(true);
    const hb = bodies.find((b) => (b.handovers || []).length);
    expect(hb.collections).toEqual([]);
    expect(hb.handovers[0]).toMatchObject({ clientHandoverId: h.clientHandoverId, cashCounted: 190, collectionIds: [a.clientCollectionId] });
    expect(await db.get(STORES.HANDOVERS, h.clientHandoverId)).toMatchObject({ state: STATE.SYNCED, attempted: true, serverExpected: 200 });
  });

  it("is marked attempted and stays pending (not cancellable) when the send fails", async () => {
    const db = createMemoryDb();
    const a = await cash(db);
    const h = await make(db, [a.clientCollectionId]);
    await db.put(STORES.COLLECTIONS, { ...(await db.get(STORES.COLLECTIONS, a.clientCollectionId)), state: STATE.SYNCED });
    await syncOutbox(db, fakeApi(async () => offline()));
    expect(await db.get(STORES.HANDOVERS, h.clientHandoverId)).toMatchObject({ state: STATE.PENDING, attempted: true });
    expect((await cancelHandover(db, h.clientHandoverId)).reason).toBe("ATTEMPTED");
  });

  it("waits, without calling the server, while a member collection has not been accepted yet", async () => {
    const db = createMemoryDb();
    const a = await cash(db);
    const h = await make(db, [a.clientCollectionId]);
    const api = fakeApi(async () => ok({ orders: [], visits: [], collections: [], handovers: [] })); // no verdict for the collection
    await syncOutbox(db, api);
    expect(api.sync.mock.calls.every((c) => !(c[0].handovers || []).length)).toBe(true);
    expect(await db.get(STORES.HANDOVERS, h.clientHandoverId)).toMatchObject({ state: STATE.PENDING, attempted: false });
  });

  it("goes INVALID locally if a member collection was refused, and discard frees the others", async () => {
    const db = createMemoryDb();
    const a = await cash(db);
    const b = await cash(db, 30);
    const h = await make(db, [a.clientCollectionId, b.clientCollectionId], 130, 130);
    await syncOutbox(db, fakeApi(async (body) => ok({
      orders: [], visits: [],
      collections: body.collections.map((x) => ({ clientCollectionId: x.clientCollectionId, status: x.clientCollectionId === a.clientCollectionId ? "INVALID" : "ACCEPTED", message: "x" })),
    })));
    expect((await db.get(STORES.HANDOVERS, h.clientHandoverId)).state).toBe(STATE.INVALID);
    await discardHandover(db, h.clientHandoverId);
    expect(await db.get(STORES.HANDOVERS, h.clientHandoverId)).toBeUndefined();
    expect((await db.get(STORES.COLLECTIONS, b.clientCollectionId)).handoverClientId).toBeNull();
  });

  it("a server refusal makes it INVALID with the server's message", async () => {
    const db = createMemoryDb();
    const a = await cash(db);
    const h = await make(db, [a.clientCollectionId]);
    await syncOutbox(db, serverApi("INVALID"));
    expect(await db.get(STORES.HANDOVERS, h.clientHandoverId)).toMatchObject({ state: STATE.INVALID, message: "nope" });
  });

  it("discard only works on refused day-closes", async () => {
    const db = createMemoryDb();
    const a = await cash(db);
    const h = await make(db, [a.clientCollectionId]);
    await discardHandover(db, h.clientHandoverId);
    expect(await db.get(STORES.HANDOVERS, h.clientHandoverId)).toBeDefined();
  });

  it("old cash that was never handed over is not pruned", async () => {
    const db = createMemoryDb();
    const a = await cash(db);
    await db.put(STORES.COLLECTIONS, { ...(await db.get(STORES.COLLECTIONS, a.clientCollectionId)), state: STATE.SYNCED, capturedAt: "2020-01-01T00:00:00.000Z" });
    await syncOutbox(db, fakeApi(async () => ok({ orders: [], visits: [], collections: [] })));
    expect(await db.get(STORES.COLLECTIONS, a.clientCollectionId)).toBeDefined();
  });
});

describe("reference data for the new features", () => {
  it("caches invoices and progress, and a failing optional call keeps nothing stale", async () => {
    const db = createMemoryDb();
    const api = {
      catalog: async () => ok([]), retailers: async () => ok([]), myOrders: async () => ok([]),
      invoices: async () => ok([{ salesId: 1 }]), myHandovers: async () => ({ ok: false, message: "x" }), progress: async () => ok({ daysLeft: 3 }),
    };
    await refreshReferenceData(db, api);
    expect(await getMeta(db, "serverInvoices")).toEqual([{ salesId: 1 }]);
    expect(await getMeta(db, "progress")).toEqual({ daysLeft: 3 });
    expect(await getMeta(db, "serverHandovers")).toBeFalsy();
  });
});
