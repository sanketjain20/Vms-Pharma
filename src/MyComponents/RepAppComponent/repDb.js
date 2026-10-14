// Offline storage for the rep app. Orders and visits are written here FIRST and
// only removed once the server confirms them, so nothing a rep captures can be
// lost to a dead signal, a closed tab or a killed browser.
//
// IndexedDB (not localStorage): the product catalog can be thousands of rows,
// which blows past localStorage's ~5 MB. If IndexedDB is unavailable (private
// mode on some browsers, jsdom in tests) we fall back to an in-memory store
// with the same API — the app still works, it just can't survive a reload.

export const STORES = { ORDERS: "orders", VISITS: "visits", COLLECTIONS: "collections", HANDOVERS: "handovers", META: "meta" };

const KEY_PATH = { orders: "clientOrderId", visits: "clientVisitId", collections: "clientCollectionId", handovers: "clientHandoverId", meta: "key" };

export function createMemoryDb() {
  const data = { orders: new Map(), visits: new Map(), collections: new Map(), handovers: new Map(), meta: new Map() };
  return {
    persistent: false,
    async put(store, value) {
      data[store].set(value[KEY_PATH[store]], structuredCloneSafe(value));
    },
    async get(store, key) {
      const v = data[store].get(key);
      return v === undefined ? undefined : structuredCloneSafe(v);
    },
    async all(store) {
      return [...data[store].values()].map(structuredCloneSafe);
    },
    async remove(store, key) {
      data[store].delete(key);
    },
  };
}

function structuredCloneSafe(v) {
  return JSON.parse(JSON.stringify(v));
}

function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function createIndexedDb(name, factory = typeof indexedDB !== "undefined" ? indexedDB : undefined) {
  const opening = new Promise((resolve, reject) => {
    const req = factory.open(name, 3);
    req.onupgradeneeded = () => {
      const db = req.result;
      Object.entries(KEY_PATH).forEach(([store, keyPath]) => {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath });
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  const run = async (store, mode, fn) => {
    const db = await opening;
    const tx = db.transaction(store, mode);
    const result = await promisify(fn(tx.objectStore(store)));
    return result;
  };

  return {
    persistent: true,
    put: (store, value) => run(store, "readwrite", (s) => s.put(value)),
    get: (store, key) => run(store, "readonly", (s) => s.get(key)),
    all: (store) => run(store, "readonly", (s) => s.getAll()),
    remove: (store, key) => run(store, "readwrite", (s) => s.delete(key)),
  };
}

const open = new Map();

// One database per rep, so a second rep sharing a phone never sees (or syncs)
// the first rep's unsent orders.
export function getRepDb(vendorId) {
  const name = `vms-rep-${vendorId ?? "anon"}`;
  if (!open.has(name)) {
    let db;
    try {
      db = typeof indexedDB !== "undefined" ? createIndexedDb(name) : createMemoryDb();
    } catch {
      db = createMemoryDb();
    }
    open.set(name, db);
  }
  return open.get(name);
}

export async function getMeta(db, key, fallback = null) {
  const row = await db.get(STORES.META, key);
  return row ? row.value : fallback;
}

export function setMeta(db, key, value) {
  return db.put(STORES.META, { key, value });
}
