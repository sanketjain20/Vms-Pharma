import apiClient from "../../Config/apiClient";
import API_BASE_URL from "../../Config/api.config";
import { STORES, getMeta, setMeta } from "./repDb";

// Order / visit lifecycle on the device:
//   PENDING  – saved locally, not yet confirmed by the server
//   SYNCED   – server has it (ACCEPTED or DUPLICATE)
//   CONFLICT – server has it, but price/stock moved since the rep quoted it;
//              the office will review it (we keep the detail to show the rep)
//   INVALID  – server refused it (e.g. retailer no longer on the beat); stays
//              visible until the rep retries or discards it
export const STATE = { PENDING: "PENDING", SYNCED: "SYNCED", CONFLICT: "CONFLICT", INVALID: "INVALID" };

const BATCH = 50; // server cap is 200 per list; stay well under it for slow links
const HISTORY_DAYS = 7;

export function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// The server parses LocalDateTime — no "Z" / offset allowed.
export function localIso(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// ───────────── server calls (network failure is a normal outcome, not an exception) ─────────────

async function call(path, options) {
  let res;
  try {
    res = await apiClient(`${API_BASE_URL}${path}`, { globalLoader: false, ...options });
  } catch {
    return { ok: false, networkError: true, message: "You're offline." };
  }
  let json = null;
  try {
    json = await res.json();
  } catch {
    // non-JSON body — handled below
  }
  const ok = res.ok && json?.status === 200;
  return { ok, status: res.status, data: json?.data, message: json?.message || (ok ? "" : "Request failed.") };
}

export const repApi = {
  sync: (body) => call("/api/Rep/Sync", { method: "POST", body: JSON.stringify(body) }),
  catalog: () => call("/api/Rep/Catalog"),
  retailers: () => call("/api/Rep/MyRetailers"),
  myOrders: () => call("/api/Rep/MyOrders"),
  myCollections: () => call("/api/Rep/MyCollections"),
  invoices: () => call("/api/Rep/MyInvoices"),
  myHandovers: () => call("/api/Rep/MyHandovers"),
  progress: () => call("/api/Rep/MyProgress"),
  profile: () => call("/api/Rep/Profile"),
  updatePhoto: (body) => call("/api/Rep/ProfilePhoto", { method: "PUT", body: JSON.stringify(body) }),
  changePassword: (body) => call("/api/Rep/ChangePassword", { method: "POST", body: JSON.stringify(body) }),
};

// ───────────── capturing (always local-first) ─────────────

export async function queueOrder(db, { retailerId, retailerName, items, remarks }) {
  const order = {
    clientOrderId: newId(),
    retailerId,
    retailerName,
    capturedAt: localIso(),
    remarks: remarks?.trim() || null,
    items: items.map((i) => ({ productId: i.productId, name: i.name, quantity: i.quantity, quotedPrice: i.quotedPrice })),
    total: items.reduce((s, i) => s + i.quantity * i.quotedPrice, 0),
    state: STATE.PENDING,
    message: null,
    conflicts: [],
    serverOrderNumber: null,
  };
  await db.put(STORES.ORDERS, order);
  return order;
}

export async function queueVisit(db, { retailerId, retailerName, latitude, longitude, accuracyM, note }) {
  const visit = {
    clientVisitId: newId(),
    retailerId: retailerId ?? null,
    retailerName: retailerName || "Unplanned stop",
    latitude,
    longitude,
    accuracyM: accuracyM ?? null,
    note: note?.trim() || null,
    capturedAt: localIso(),
    state: STATE.PENDING,
    message: null,
  };
  await db.put(STORES.VISITS, visit);
  return visit;
}

export const COLLECTION_MODES = [
  ["CASH", "Cash"],
  ["UPI", "UPI"],
  ["CHEQUE", "Cheque"],
  ["CARD", "Card"],
];

const round2 = (n) => Math.round(Number(n) * 100) / 100;

/**
 * Records money the rep took. Saved on the phone first (like an order) and sent when there's a signal.
 * attempted flips to true the moment a sync request carrying it is dispatched — from then on the office
 * MAY already have it, so the rep can no longer cancel it here (see cancelCollection).
 */
export async function queueCollection(db, { retailerId, retailerName, amount, mode, reference, note, invoiceId = null, invoiceNumber = null }) {
  const c = {
    clientCollectionId: newId(),
    retailerId,
    retailerName,
    amount: round2(amount),
    mode,
    reference: reference?.trim() || null,
    note: note?.trim() || null,
    invoiceId: invoiceId ?? null,
    invoiceNumber: invoiceNumber || null,
    handoverClientId: null, // set once this cash is part of a day-close
    capturedAt: localIso(),
    state: STATE.PENDING,
    attempted: false,
    message: null,
  };
  await db.put(STORES.COLLECTIONS, c);
  return c;
}

/**
 * Takes back a collection that has never left the phone. Stricter than for orders because this is money:
 * once a send was even attempted the office may hold it (a lost reply looks the same as a failed send),
 * and quietly deleting it locally would leave the rep believing it was cancelled. They must ask the
 * office to reject it instead.
 */
export async function cancelCollection(db, clientCollectionId) {
  if (isSyncing(db)) return BUSY;
  const c = await db.get(STORES.COLLECTIONS, clientCollectionId);
  if (!c) return { ok: false, reason: "GONE", message: "That collection is no longer on this phone." };
  if (c.state !== STATE.PENDING) {
    return { ok: false, reason: "SENT", message: "That collection has already been sent, so it can't be cancelled here. Ask the office to reject it." };
  }
  if (c.handoverClientId) {
    return { ok: false, reason: "HANDOVER", message: "This cash is part of a day-close. Cancel the day-close first." };
  }
  if (c.attempted) {
    return { ok: false, reason: "ATTEMPTED", message: "This was already on its way to the office, so it can't be cancelled here. If it's wrong, ask the office to reject it." };
  }
  await db.remove(STORES.COLLECTIONS, clientCollectionId);
  return { ok: true };
}

/** Throws away a collection the server refused (it never recorded it). */
export async function discardCollection(db, clientCollectionId) {
  const c = await db.get(STORES.COLLECTIONS, clientCollectionId);
  if (c && c.state === STATE.INVALID) await db.remove(STORES.COLLECTIONS, clientCollectionId);
}

/**
 * "Close the day": the rep hands in the cash they collected. It lists exactly which collections it covers (their
 * client ids) and is saved locally first, like everything else. The server works out the expected cash itself.
 */
export async function queueHandover(db, { collectionIds, expectedCash, cashCounted, note }) {
  if (!collectionIds || collectionIds.length === 0) {
    return { ok: false, reason: "EMPTY", message: "Pick the cash you are handing over." };
  }
  const rows = [];
  for (const id of collectionIds) {
    const c = await db.get(STORES.COLLECTIONS, id);
    if (!c) return { ok: false, reason: "GONE", message: "One of those collections is no longer on this phone." };
    if (c.handoverClientId) return { ok: false, reason: "TAKEN", message: "One of those collections is already in a day-close." };
    rows.push(c);
  }
  const h = {
    clientHandoverId: newId(),
    collectionIds: [...collectionIds],
    expectedCash: round2(expectedCash),
    cashCounted: round2(cashCounted),
    note: note?.trim() || null,
    capturedAt: localIso(),
    state: STATE.PENDING,
    attempted: false,
    message: null,
    serverExpected: null,
  };
  await db.put(STORES.HANDOVERS, h);
  for (const c of rows) await db.put(STORES.COLLECTIONS, { ...c, handoverClientId: h.clientHandoverId });
  return { ok: true, handover: h };
}

async function releaseCollections(db, h) {
  for (const id of h.collectionIds || []) {
    const c = await db.get(STORES.COLLECTIONS, id);
    if (c && c.handoverClientId === h.clientHandoverId) await db.put(STORES.COLLECTIONS, { ...c, handoverClientId: null });
  }
}

/** Takes back a day-close that never left the phone, freeing its collections. Same strictness as for collections. */
export async function cancelHandover(db, clientHandoverId) {
  if (isSyncing(db)) return BUSY;
  const h = await db.get(STORES.HANDOVERS, clientHandoverId);
  if (!h) return { ok: false, reason: "GONE", message: "That day-close is no longer on this phone." };
  if (h.state !== STATE.PENDING) return { ok: false, reason: "SENT", message: "That day-close has already been sent, so it can't be cancelled here. Ask the office." };
  if (h.attempted) {
    return { ok: false, reason: "ATTEMPTED", message: "This was already on its way to the office, so it can't be cancelled here. Ask them to flag it if it's wrong." };
  }
  await releaseCollections(db, h);
  await db.remove(STORES.HANDOVERS, clientHandoverId);
  return { ok: true };
}

/** Throws away a day-close the server refused (it recorded nothing) and frees its collections. */
export async function discardHandover(db, clientHandoverId) {
  const h = await db.get(STORES.HANDOVERS, clientHandoverId);
  if (!h || h.state !== STATE.INVALID) return;
  await releaseCollections(db, h);
  await db.remove(STORES.HANDOVERS, clientHandoverId);
}

const BUSY = { ok: false, reason: "BUSY", message: "Sending right now — try again in a moment." };

export async function retryOrder(db, clientOrderId) {
  if (isSyncing(db)) return BUSY;
  const o = await db.get(STORES.ORDERS, clientOrderId);
  if (!o) return { ok: false, reason: "GONE", message: "That order is no longer on this phone." };
  if (o.state !== STATE.INVALID) return { ok: false, reason: "STATE", message: "That order is not waiting for a retry." };
  await db.put(STORES.ORDERS, { ...o, state: STATE.PENDING, message: null });
  return { ok: true };
}

/** True while a sync is talking to the server — orders can't safely be changed or cancelled then. */
export function isSyncing(db) {
  return inFlight.has(db);
}


/**
 * Replaces the contents of an order that hasn't been accepted yet (waiting to send, or refused).
 * Keeps its client id so a resend can never create a second order. If the order had in fact reached
 * the office before the rep edited it (the reply was lost), the server answers DUPLICATE and the
 * edit can't apply — we flag that (see doSync) rather than silently showing edits the office never saw.
 */
export async function updateOrder(db, clientOrderId, { retailerId, retailerName, items, remarks }) {
  if (isSyncing(db)) return BUSY;
  const o = await db.get(STORES.ORDERS, clientOrderId);
  if (!o) return { ok: false, reason: "GONE", message: "That order is no longer on this phone." };
  if (o.state !== STATE.PENDING && o.state !== STATE.INVALID) {
    return { ok: false, reason: "SENT", message: "That order has already been sent, so it can't be changed here. Ask the office." };
  }
  if (!items || items.length === 0) return { ok: false, reason: "EMPTY", message: "An order needs at least one product." };

  const lines = items.map((i) => ({ productId: i.productId, name: i.name, quantity: i.quantity, quotedPrice: i.quotedPrice }));
  const updated = {
    ...o,
    retailerId,
    retailerName,
    remarks: remarks?.trim() || null,
    items: lines,
    total: lines.reduce((s, i) => s + i.quantity * i.quotedPrice, 0),
    state: STATE.PENDING,
    message: null,
    conflicts: [],
    // a refused order was never stored by the server, so only a still-waiting one can be "stale" later
    edited: o.state === STATE.PENDING || !!o.edited,
  };
  await db.put(STORES.ORDERS, updated);
  return { ok: true, order: updated };
}

/** Throws away an order that is still waiting to send. (Refused ones use discardOrder.) */
export async function cancelOrder(db, clientOrderId) {
  if (isSyncing(db)) return BUSY;
  const o = await db.get(STORES.ORDERS, clientOrderId);
  if (!o) return { ok: false, reason: "GONE", message: "That order is no longer on this phone." };
  if (o.state !== STATE.PENDING) return { ok: false, reason: "SENT", message: "That order has already been sent, so it can't be cancelled here. Ask the office." };
  await db.remove(STORES.ORDERS, clientOrderId);
  return { ok: true };
}

export async function discardOrder(db, clientOrderId) {
  if (isSyncing(db)) return BUSY;
  const o = await db.get(STORES.ORDERS, clientOrderId);
  // Only a refused order may be thrown away — never one the server hasn't answered yet.
  if (o && o.state === STATE.INVALID) await db.remove(STORES.ORDERS, clientOrderId);
  return { ok: true };
}

export async function discardVisit(db, clientVisitId) {
  const v = await db.get(STORES.VISITS, clientVisitId);
  if (v && v.state === STATE.INVALID) await db.remove(STORES.VISITS, clientVisitId);
}

export async function pendingCount(db) {
  const [orders, visits, collections, handovers] = await Promise.all([db.all(STORES.ORDERS), db.all(STORES.VISITS), db.all(STORES.COLLECTIONS), db.all(STORES.HANDOVERS)]);
  return [...orders, ...visits, ...collections, ...handovers].filter((x) => x.state === STATE.PENDING).length;
}

// ───────────── syncing ─────────────

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

const inFlight = new WeakMap();

/**
 * Pushes every PENDING order/visit. Safe to call repeatedly (and concurrently —
 * a second call just joins the first): the server de-duplicates on the client
 * ids, so a response lost mid-flight only means the retry comes back DUPLICATE.
 */
export function syncOutbox(db, api = repApi) {
  if (inFlight.has(db)) return inFlight.get(db);
  const p = doSync(db, api).finally(() => inFlight.delete(db));
  inFlight.set(db, p);
  return p;
}

/**
 * Records a sync verdict on a row by merging ONLY the verdict fields onto the row as it is now. Two things go wrong
 * if the snapshot taken before the request is written back instead:
 *  - the rep removed the row while the request was in flight, and a plain put() brings it back (a ghost order with an
 *    Edit / Retry button and nothing behind it);
 *  - the rep closed the day while the request was in flight, and the stale copy erases the collection's
 *    handoverClientId, so the same cash looks free to hand over a second time.
 * A row that is gone stays gone.
 */
async function recordVerdict(db, store, idKey, row, patch) {
  const current = await db.get(store, row[idKey]);
  if (current) await db.put(store, { ...current, ...patch });
}

async function doSync(db, api) {
  const summary = { sent: 0, accepted: 0, conflicts: 0, invalid: 0, staleEdits: 0, offline: false, error: null };
  const orders = (await db.all(STORES.ORDERS)).filter((o) => o.state === STATE.PENDING);
  const visits = (await db.all(STORES.VISITS)).filter((v) => v.state === STATE.PENDING);
  const collections = (await db.all(STORES.COLLECTIONS)).filter((c) => c.state === STATE.PENDING);

  const orderBatches = chunk(orders, BATCH);
  const visitBatches = chunk(visits, BATCH);
  const collectionBatches = chunk(collections, BATCH);
  const rounds = Math.max(orderBatches.length, visitBatches.length, collectionBatches.length);

  for (let i = 0; i < rounds; i++) {
    const o = orderBatches[i] || [];
    const v = visitBatches[i] || [];
    const col = collectionBatches[i] || [];
    // Mark BEFORE the request goes out: from here the office may hold them, so they can no longer be cancelled locally.
    for (const c of col) await recordVerdict(db, STORES.COLLECTIONS, "clientCollectionId", c, { attempted: true });
    const r = await api.sync({
      orders: o.map((x) => ({
        clientOrderId: x.clientOrderId,
        retailerId: x.retailerId,
        capturedAt: x.capturedAt,
        remarks: x.remarks,
        items: x.items.map((it) => ({ productId: it.productId, quantity: it.quantity, quotedPrice: it.quotedPrice })),
      })),
      collections: col.map((x) => ({
        clientCollectionId: x.clientCollectionId,
        retailerId: x.retailerId,
        amount: x.amount,
        paymentMode: x.mode,
        referenceNumber: x.reference,
        note: x.note,
        collectedAt: x.capturedAt,
        invoiceId: x.invoiceId ?? null,
      })),
      visits: v.map((x) => ({
        clientVisitId: x.clientVisitId,
        retailerId: x.retailerId,
        latitude: x.latitude,
        longitude: x.longitude,
        accuracyM: x.accuracyM,
        note: x.note,
        capturedAt: x.capturedAt,
      })),
    });

    if (!r.ok) {
      // Leave everything PENDING — nothing is lost, the next attempt resends.
      if (r.networkError) summary.offline = true;
      else summary.error = r.message;
      return summary;
    }

    summary.sent += o.length + v.length + col.length;
    const orderResults = new Map((r.data?.orders || []).map((x) => [x.clientOrderId, x]));
    const visitResults = new Map((r.data?.visits || []).map((x) => [x.clientVisitId, x]));
    const collectionResults = new Map((r.data?.collections || []).map((x) => [x.clientCollectionId, x]));

    for (const order of o) {
      const res = orderResults.get(order.clientOrderId);
      if (!res) continue; // no verdict → stays PENDING, retried next time
      if (res.status === "DUPLICATE" && order.edited) {
        // The office already had an earlier copy, so the server ignored this one: the edit did NOT apply.
        summary.staleEdits++;
        await recordVerdict(db, STORES.ORDERS, "clientOrderId", order, { state: STATE.SYNCED, message: res.message, serverOrderNumber: res.orderNumber, conflicts: [], staleEdit: true });
      } else if (res.status === "ACCEPTED" || res.status === "DUPLICATE") {
        summary.accepted++;
        await recordVerdict(db, STORES.ORDERS, "clientOrderId", order, { state: STATE.SYNCED, message: res.message, serverOrderNumber: res.orderNumber, conflicts: [] });
      } else if (res.status === "ACCEPTED_WITH_CONFLICTS") {
        summary.conflicts++;
        await recordVerdict(db, STORES.ORDERS, "clientOrderId", order, { state: STATE.CONFLICT, message: res.message, serverOrderNumber: res.orderNumber, conflicts: res.conflicts || [] });
      } else {
        summary.invalid++;
        await recordVerdict(db, STORES.ORDERS, "clientOrderId", order, { state: STATE.INVALID, message: res.message || "The server refused this order." });
      }
    }

    for (const c of col) {
      const res = collectionResults.get(c.clientCollectionId);
      if (!res) continue; // no verdict → stays PENDING (attempted), retried next time
      if (res.status === "ACCEPTED" || res.status === "DUPLICATE") {
        summary.accepted++;
        await recordVerdict(db, STORES.COLLECTIONS, "clientCollectionId", c, { attempted: true, state: STATE.SYNCED, message: res.message });
      } else {
        summary.invalid++;
        await recordVerdict(db, STORES.COLLECTIONS, "clientCollectionId", c, { attempted: true, state: STATE.INVALID, message: res.message || "The server refused this collection." });
      }
    }

    for (const visit of v) {
      const res = visitResults.get(visit.clientVisitId);
      if (!res) continue;
      if (res.status === "ACCEPTED" || res.status === "DUPLICATE") {
        summary.accepted++;
        await recordVerdict(db, STORES.VISITS, "clientVisitId", visit, { state: STATE.SYNCED, message: res.message });
      } else {
        summary.invalid++;
        await recordVerdict(db, STORES.VISITS, "clientVisitId", visit, { state: STATE.INVALID, message: res.message || "The server refused this check-in." });
      }
    }
  }

  await sendHandovers(db, api, summary);
  await pruneHistory(db);
  return summary;
}

/**
 * Day-closes go in their OWN request, after all collection batches succeeded, and only when every collection they
 * cover is confirmed on the server — otherwise the server would (correctly) say "not received yet", which would
 * be a confusing message for something that is really "one of these was refused".
 */
async function sendHandovers(db, api, summary) {
  const all = (await db.all(STORES.HANDOVERS)).filter((h) => h.state === STATE.PENDING);
  if (all.length === 0) return;

  const ready = [];
  for (const h of all) {
    const members = [];
    for (const id of h.collectionIds) members.push(await db.get(STORES.COLLECTIONS, id));
    if (members.some((c) => !c)) {
      summary.invalid++;
      await db.put(STORES.HANDOVERS, { ...h, state: STATE.INVALID, message: "A collection in this day-close is no longer on this phone." });
    } else if (members.some((c) => c.state === STATE.INVALID)) {
      summary.invalid++;
      await db.put(STORES.HANDOVERS, { ...h, state: STATE.INVALID, message: "A collection in this day-close was refused, so it can't be sent. Discard it and make a new one." });
    } else if (members.every((c) => c.state === STATE.SYNCED)) {
      ready.push(h);
    } // else some collection is still waiting to send: try again next time
  }

  for (const batch of chunk(ready, BATCH)) {
    for (const h of batch) await db.put(STORES.HANDOVERS, { ...h, attempted: true });
    const r = await api.sync({
      orders: [], visits: [], collections: [],
      handovers: batch.map((h) => ({
        clientHandoverId: h.clientHandoverId,
        cashCounted: h.cashCounted,
        collectionIds: h.collectionIds,
        note: h.note,
        closedAt: h.capturedAt,
      })),
    });
    if (!r.ok) {
      if (r.networkError) summary.offline = true;
      else summary.error = r.message;
      return;
    }
    summary.sent += batch.length;
    const results = new Map((r.data?.handovers || []).map((x) => [x.clientHandoverId, x]));
    for (const h of batch) {
      const res = results.get(h.clientHandoverId);
      if (!res) continue; // no verdict → stays PENDING (attempted), retried next time
      if (res.status === "ACCEPTED" || res.status === "DUPLICATE") {
        summary.accepted++;
        await db.put(STORES.HANDOVERS, { ...h, attempted: true, state: STATE.SYNCED, message: res.message, serverExpected: res.expectedCash ?? null });
      } else {
        summary.invalid++;
        await db.put(STORES.HANDOVERS, { ...h, attempted: true, state: STATE.INVALID, message: res.message || "The server refused this day-close." });
      }
    }
  }
}

// Keep a week of confirmed items for the rep's reference, then let them go so
// the device doesn't grow forever. Never touches PENDING / INVALID.
async function pruneHistory(db, now = Date.now()) {
  const cutoff = now - HISTORY_DAYS * 86400000;
  for (const store of [STORES.ORDERS, STORES.VISITS, STORES.COLLECTIONS, STORES.HANDOVERS]) {
    const idKey = { [STORES.ORDERS]: "clientOrderId", [STORES.VISITS]: "clientVisitId", [STORES.COLLECTIONS]: "clientCollectionId", [STORES.HANDOVERS]: "clientHandoverId" }[store];
    for (const row of await db.all(store)) {
      // cash that has not been handed over yet must stay until it is, however old
      const unhandedCash = store === STORES.COLLECTIONS && row.mode === "CASH" && !row.handoverClientId;
      // A flagged/conflict order still needs the office's attention; don't hide its details
      // just because the local history retention window elapsed.
      if (!unhandedCash && row.state === STATE.SYNCED && new Date(row.capturedAt).getTime() < cutoff) {
        await db.remove(store, row[idKey]);
      }
    }
  }
}

// ───────────── reference data (catalog / beat / server order history) ─────────────

/** Refreshes the offline copies. On failure the previous copies are kept. */
export async function refreshReferenceData(db, api = repApi) {
  const optional = (fn) => (fn ? fn() : Promise.resolve(null));
  const [catalog, retailers, myOrders, profile, myCollections, invoices, myHandovers, progress] = await Promise.all([
    api.catalog(), api.retailers(), api.myOrders(), optional(api.profile), optional(api.myCollections),
    optional(api.invoices), optional(api.myHandovers), optional(api.progress),
  ]);
  if (catalog.ok) await setMeta(db, "catalog", catalog.data || []);
  if (retailers.ok) await setMeta(db, "retailers", retailers.data || []);
  if (myOrders.ok) await setMeta(db, "serverOrders", myOrders.data || []);
  if (profile && profile.ok && profile.data) await setMeta(db, "profile", profile.data);
  if (myCollections && myCollections.ok) await setMeta(db, "serverCollections", myCollections.data || []);
  if (invoices && invoices.ok) await setMeta(db, "serverInvoices", invoices.data || []);
  if (myHandovers && myHandovers.ok) await setMeta(db, "serverHandovers", myHandovers.data || []);
  if (progress && progress.ok) await setMeta(db, "progress", progress.data || null);
  const ok = catalog.ok && retailers.ok;
  if (ok) await setMeta(db, "refreshedAt", new Date().toISOString());
  return { ok, offline: !!(catalog.networkError || retailers.networkError) };
}

export async function loadReferenceData(db) {
  const [catalog, retailers, serverOrders, refreshedAt, profile, serverCollections, serverInvoices, serverHandovers, progress] = await Promise.all([
    getMeta(db, "catalog", []),
    getMeta(db, "retailers", []),
    getMeta(db, "serverOrders", []),
    getMeta(db, "refreshedAt", null),
    getMeta(db, "profile", null),
    getMeta(db, "serverCollections", []),
    getMeta(db, "serverInvoices", []),
    getMeta(db, "serverHandovers", []),
    getMeta(db, "progress", null),
  ]);
  return { catalog, retailers, serverOrders, refreshedAt, profile, serverCollections, serverInvoices, serverHandovers, progress };
}
