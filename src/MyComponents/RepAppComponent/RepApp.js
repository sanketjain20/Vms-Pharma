import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import { STORES, getMeta, getRepDb, setMeta } from "./repDb";
import {
  COLLECTION_MODES, STATE, cancelCollection, cancelOrder, discardCollection, discardOrder, discardVisit, isSyncing, loadReferenceData,
  cancelHandover, discardHandover, queueCollection, queueHandover, queueOrder, queueVisit, refreshReferenceData, repApi, retryOrder, syncOutbox, updateOrder,
} from "./repSync";
import {
  COLLECTION_STATUS, COLLECTION_STATUS_META, DEFAULT_COLLECTION_FILTERS, MODE_LABEL, applyCollectionFilters, awaitingForRetailer,
  collectionStatusCounts, collectionSummary, countActiveCollectionFilters, retailersInCollections, unifyCollections, validateCollection,
} from "./repCollections";
import { creditStatus } from "./repCredit";
import { invoiceLabel, invoicesFor } from "./repInvoices";
import { lastVisitFor, recency, targetBars } from "./repBeatInfo";
import { canIssueReceipt } from "./repReceipt";
import ReceiptDialog from "./RepReceiptDialog";
import DayClose from "./RepDayClose";
import FieldPager from "../FieldRepComponent/FieldPager";
import { registerRepPwa } from "./repPwa";
import RepSettings, { readAccent, saveAccent } from "./RepSettings";
import RepAvatar from "./RepAvatar";
import ThemeToggle from "../CommonComponent/ThemeToggle";
import Footer from "../CommonComponent/Footer";
import {
  ATTENTION, DEFAULT_FILTERS, PERIODS, SORTS, STATUS, STATUS_META, applyFilters, countActive, groupByDay,
  retailersIn, statusCounts, summarize, unifyOrders,
} from "./repOrders";
import {
  CATALOG_SORTS, DEFAULT_CATALOG_FILTERS, activeCatalogFilters, catalogFacets, filterCatalog, orderAgain,
} from "./repCatalog";
import BrandMark from "../CommonComponent/BrandMark";
import "../../Styles/RepApp/RepApp.css";

const DAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const dayLabel = (d) => d.charAt(0) + d.slice(1).toLowerCase();

const STATE_UI = {
  [STATE.PENDING]: ["Waiting to send", "warn"],
  [STATE.SYNCED]: ["Sent", "ok"],
  [STATE.CONFLICT]: ["Sent — flagged", "warn"],
  [STATE.INVALID]: ["Refused", "bad"],
};

const fmtMoney = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtTime = (d) => (d ? new Date(d).toLocaleString() : "");
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function readUser() {
  try {
    return JSON.parse(localStorage.getItem("vmsUser"))?.data || null;
  } catch {
    return null;
  }
}

const defaultGetPosition = () =>
  new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return reject(new Error("unsupported"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({
        latitude: Number(p.coords.latitude.toFixed(6)),
        longitude: Number(p.coords.longitude.toFixed(6)),
        accuracyM: Number(p.coords.accuracy.toFixed(1)),
      }),
      reject,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  });

function conflictText(c) {
  return String(c.reason || "")
    .split(",")
    .filter(Boolean)
    .map((r) => {
      if (r === "PRICE_CHANGED") return `Price changed ${fmtMoney(c.quotedPrice)} → ${fmtMoney(c.currentPrice)}`;
      if (r === "STOCK_SHORT") return `Only ${c.availableQty ?? 0} in stock`;
      if (r === "PRODUCT_UNAVAILABLE") return "No longer available";
      return r;
    })
    .join(" · ");
}

export default function RepApp({ db: dbProp, api = repApi, getPosition = defaultGetPosition, theme, onToggleTheme, processImage }) {
  const navigate = useNavigate();
  const user = useMemo(readUser, []);
  const db = useMemo(() => dbProp || getRepDb(user?.vendorId), [dbProp, user]);

  const [tab, setTab] = useState("beat");
  const [ref, setRef] = useState({ catalog: [], retailers: [], serverOrders: [], refreshedAt: null });
  const [orders, setOrders] = useState([]);
  const [visits, setVisits] = useState([]);
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));
  const [syncing, setSyncing] = useState(false);
  const [note, setNote] = useState(null);
  const [draft, setDraft] = useState({ retailerId: "", cart: [], remarks: "" });
  const [locating, setLocating] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [collections, setCollections] = useState([]);
  const [handovers, setHandovers] = useState([]);
  const emptyCollect = { retailerId: "", amount: "", mode: "CASH", reference: "", note: "", invoiceId: "" };
  const [collectDraft, setCollectDraft] = useState(emptyCollect);
  const [accent, setAccent] = useState(() => readAccent(user?.vendorId));
  const chooseAccent = (key) => { setAccent(key); saveAccent(user?.vendorId, key); };

  const reloadSeq = useRef(0);
  const reloadLocal = useCallback(async () => {
    const mine = ++reloadSeq.current;
    try {
      const [o, v, c, h, r] = await Promise.all([db.all(STORES.ORDERS), db.all(STORES.VISITS), db.all(STORES.COLLECTIONS), db.all(STORES.HANDOVERS), loadReferenceData(db)]);
      // A newer reload started while this one was reading: its snapshot is fresher, so drop this one - otherwise a
      // slow read from before an order was removed could put the removed order back on screen.
      if (mine !== reloadSeq.current) return;
      const newest = (a, b) => String(b.capturedAt).localeCompare(String(a.capturedAt));
      setOrders(o.sort(newest));
      setVisits(v.sort(newest));
      setCollections(c.sort(newest));
      setHandovers(h.sort(newest));
      setRef(r);
    } catch {
      setNote({ text: "Couldn't read this phone's saved data.", tone: "bad" });
    }
  }, [db]);

  const pending = useMemo(
    () => [...orders, ...visits, ...collections, ...handovers].filter((x) => x.state === STATE.PENDING).length,
    [orders, visits, collections, handovers]
  );
  const pendingRef = useRef(0);
  pendingRef.current = pending;
  const syncingRef = useRef(false);

  // keepNote: the caller already told the rep what happened (e.g. "Checked in…"), so only
  // interrupt it for a real problem — offline/up-to-date are already shown by the header.
  const runSync = useCallback(async (quiet = false, keepNote = false) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const s = await syncOutbox(db, api);
      if (!s.offline) await refreshReferenceData(db, api);
      await reloadLocal();
      if (s.offline && keepNote) { /* header pill + pending count already say so */ }
      else if (s.offline) setNote({ text: "No connection — your work is saved on this phone and will send automatically.", tone: "warn" });
      else if (s.staleEdits > 0) setNote({ text: plural(s.staleEdits, "edited order") + " had already reached the office, so your changes weren't applied — see Orders.", tone: "warn" });
      else if (s.invalid > 0) setNote({ text: `${plural(s.invalid, "item")} refused by the server — see Orders or Collect.`, tone: "bad" });
      else if (s.error) setNote({ text: `Couldn't sync: ${s.error}`, tone: "bad" });
      else if (s.conflicts > 0) setNote({ text: `${plural(s.conflicts, "order")} sent but flagged — a price or stock changed. The office will review ${s.conflicts === 1 ? "it" : "them"}.`, tone: "warn" });
      else if (s.sent > 0 && !quiet) setNote({ text: `Sent ${plural(s.sent, "item")} to the office.`, tone: "ok" });
      else if (!quiet) setNote({ text: "Everything is up to date.", tone: "info" });
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [db, api, reloadLocal]);

  useEffect(() => {
    const unregister = registerRepPwa();
    reloadLocal().then(() => {
      if (navigator.onLine !== false) runSync(true);
    });
    return unregister;
  }, [reloadLocal, runSync]);

  useEffect(() => {
    const goOnline = () => { setOnline(true); runSync(true); };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    const timer = setInterval(() => {
      if (navigator.onLine !== false && pendingRef.current > 0) runSync(true);
    }, 60000);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      clearInterval(timer);
    };
  }, [runSync]);

  const checkIn = async (retailer) => {
    setLocating(retailer ? retailer.retailerId : "unplanned");
    try {
      const pos = await getPosition();
      await queueVisit(db, { retailerId: retailer?.retailerId ?? null, retailerName: retailer?.shopName, ...pos });
      await reloadLocal();
      const where = retailer?.shopName || "an unplanned stop";
      setNote({ text: `Checked in at ${where}${pos.accuracyM != null ? ` (±${Math.round(pos.accuracyM)} m)` : ""}.`, tone: "ok" });
      if (navigator.onLine !== false) runSync(true, true);
    } catch {
      setNote({ text: "Couldn't get your location. Turn on GPS and allow location access, then try again.", tone: "bad" });
    } finally {
      setLocating(null);
    }
  };

  const emptyDraft = { retailerId: "", cart: [], remarks: "" };

  const takeOrderFor = (retailerId) => {
    setEditingId(null); // starting a fresh order abandons any edit in progress
    setDraft((d) => ({ retailerId: String(retailerId), cart: String(d.retailerId) === String(retailerId) ? d.cart : [], remarks: d.remarks }));
    setTab("order");
  };

  const startCollect = (retailerId) => {
    setCollectDraft((d) => ({ ...d, retailerId: String(retailerId) }));
    setTab("collect");
  };

  const saveCollection = async () => {
    const retailer = ref.retailers.find((r) => String(r.retailerId) === String(collectDraft.retailerId));
    const invoice = collectDraft.invoiceId ? (ref.serverInvoices || []).find((i) => String(i.salesId) === String(collectDraft.invoiceId)) : null;
    await queueCollection(db, {
      retailerId: retailer.retailerId,
      retailerName: retailer.shopName,
      amount: collectDraft.amount,
      mode: collectDraft.mode,
      reference: collectDraft.reference,
      note: collectDraft.note,
      invoiceId: invoice ? invoice.salesId : null,
      invoiceNumber: invoice ? invoice.invoiceNumber : null,
    });
    setCollectDraft(emptyCollect);
    await reloadLocal();
    setNote({
      text: navigator.onLine !== false ? "Collection saved." : "Collection saved on this phone. It will send when you're back online.",
      tone: "ok",
    });
    if (navigator.onLine !== false) runSync(true);
  };

  const cancelPendingCollection = async (id) => {
    const r = await cancelCollection(db, id);
    await reloadLocal();
    setNote(r.ok ? { text: "Collection cancelled.", tone: "ok" } : { text: r.message, tone: "warn" });
  };

  const closeDay = async (input) => {
    const r = await queueHandover(db, input);
    await reloadLocal();
    if (r.ok) {
      setNote({ text: navigator.onLine !== false ? "Day closed. Sending to the office…" : "Day closed on this phone. It will send when you're back online.", tone: "ok" });
      if (navigator.onLine !== false) runSync(true);
    } else {
      setNote({ text: r.message, tone: "warn" });
    }
    return r;
  };

  const cancelDayClose = async (id) => {
    const r = await cancelHandover(db, id);
    await reloadLocal();
    setNote(r.ok ? { text: "Day-close cancelled.", tone: "ok" } : { text: r.message, tone: "warn" });
  };

  // Load a saved-but-unaccepted order back into the order screen to change it.
  const startEdit = (clientOrderId) => {
    const o = orders.find((x) => x.clientOrderId === clientOrderId);
    if (!o) return;
    if (isSyncing(db)) return setNote({ text: "Sending right now — try again in a moment.", tone: "warn" });
    if (o.state !== STATE.PENDING && o.state !== STATE.INVALID) {
      return setNote({ text: "That order has already been sent, so it can't be changed here. Ask the office.", tone: "warn" });
    }
    const stockOf = (id) => ref.catalog.find((p) => p.productId === id)?.stock;
    setDraft({
      retailerId: String(o.retailerId),
      cart: o.items.map((i) => ({ productId: i.productId, name: i.name, quantity: i.quantity, quotedPrice: i.quotedPrice, stock: stockOf(i.productId) })),
      remarks: o.remarks || "",
    });
    setEditingId(clientOrderId);
    setNote(null);
    setTab("order");
  };

  const cancelEdit = () => {
    setDraft(emptyDraft);
    setEditingId(null);
    setTab("orders");
  };

  const cancelPending = async (clientOrderId) => {
    const r = await cancelOrder(db, clientOrderId);
    await reloadLocal();
    setNote(r.ok ? { text: "Order cancelled.", tone: "ok" } : { text: r.message, tone: "warn" });
  };

  const saveOrder = async () => {
    const beatRetailer = ref.retailers.find((r) => String(r.retailerId) === String(draft.retailerId));
    const editedOrder = editingId ? orders.find((o) => o.clientOrderId === editingId) : null;

    if (editingId && !editedOrder) {
      // The order was cancelled / discarded while it was open for editing - nothing left to save into.
      setDraft(emptyDraft);
      setEditingId(null);
      await reloadLocal();
      setTab("orders");
      return setNote({ text: "That order is no longer on this phone, so there was nothing to save.", tone: "warn" });
    }

    // The retailer is normally on the beat. An order being edited keeps its own retailer even if the beat has since
    // changed (the beat is refreshed on every sync), so fall back to what the order itself recorded.
    const retailer = beatRetailer || (editedOrder && String(editedOrder.retailerId) === String(draft.retailerId)
      ? { retailerId: editedOrder.retailerId, shopName: editedOrder.retailerName }
      : null);
    if (!retailer) return setNote({ text: "Pick the retailer this order is for - the one chosen is no longer on your beat.", tone: "warn" });

    if (editingId) {
      const r = await updateOrder(db, editingId, { retailerId: retailer.retailerId, retailerName: retailer.shopName, items: draft.cart, remarks: draft.remarks });
      if (!r.ok && r.reason === "BUSY") return setNote({ text: r.message, tone: "warn" }); // keep their edits on screen
      setDraft(emptyDraft);
      setEditingId(null);
      await reloadLocal();
      setTab("orders");
      setNote(r.ok ? { text: "Order updated.", tone: "ok" } : { text: r.message, tone: "bad" });
      if (r.ok && navigator.onLine !== false) runSync(true);
      return;
    }    await queueOrder(db, {
      retailerId: retailer.retailerId,
      retailerName: retailer.shopName,
      items: draft.cart,
      remarks: draft.remarks,
    });
    setDraft({ retailerId: "", cart: [], remarks: "" });
    await reloadLocal();
    setTab("orders");
    setNote({
      text: navigator.onLine !== false ? "Order saved." : "Order saved on this phone. It will send when you're back online.",
      tone: "ok",
    });
    if (navigator.onLine !== false) runSync(true);
  };

  const logout = async () => {
    if (pending > 0 && !window.confirm(`You have ${plural(pending, "unsent item")} on this phone. They stay saved and will send the next time you log in. Log out anyway?`)) return;
    try {
      await apiClient(`${API_BASE_URL}/api/auth/logout`, { method: "POST", globalLoader: false });
    } catch {
      // offline logout: still clear the local session below
    }
    localStorage.removeItem("vmsUser");
    localStorage.removeItem("modules");
    navigate("/");
  };

  const history = useMemo(() => unifyOrders(orders, ref.serverOrders), [orders, ref.serverOrders]);
  const photo = ref.profile ? ref.profile.profilePhoto || null : user?.profilePhoto || null;
  const displayName = ref.profile?.name || user?.name;

  const changePhoto = async (next) => {
    const current = (await getMeta(db, "profile", null)) || {};
    await setMeta(db, "profile", { ...current, profilePhoto: next });
    await reloadLocal();
  };

  const collectionHistory = useMemo(() => unifyCollections(collections, ref.serverCollections || []), [collections, ref.serverCollections]);
  const collectAttention = [...collections, ...handovers].filter((c) => c.state === STATE.PENDING || c.state === STATE.INVALID).length;
  const attention = orders.filter((o) => o.state === STATE.PENDING || o.state === STATE.INVALID).length;

  const tabs = [
    ["beat", "My beat", Icon.pin],
    ["order", "New order", Icon.cart],
    ["orders", "Orders", Icon.list],
    ["collect", "Collect", Icon.wallet],
    ["settings", "Settings", Icon.gear],
  ];

  return (
    <div className="ra-root" data-accent={accent}>
      <header className="ra-header">
        <div className="ra-brand">
          <BrandMark theme={theme} className="ra-logo" />
          <button type="button" className="ra-me" aria-label="Your profile" onClick={() => setTab("settings")}>
            <RepAvatar photo={photo} name={displayName} size={34} />
          </button>
          <div className="ra-brand-text">
            <h1 className="ra-title">Field Rep</h1>
            <div className="ra-sub">{user?.name || "Signed in"}{user?.shopName ? ` · ${user.shopName}` : ""}</div>
          </div>
        </div>

        <div className="ra-statusbar">
          <span className={`ra-pill ${online ? "" : "is-offline"}`}>{online ? "Online" : "Offline"}</span>
          {pending > 0 && <span className="ra-pending">{plural(pending, "item")} waiting to send</span>}
        </div>

        <div className="ra-header-actions">
          <button className="ra-icon-btn" aria-label="Sync now" disabled={!online || syncing} onClick={() => runSync(false)}>
            <span className={syncing ? "ra-spin" : ""} style={{ display: "inline-flex" }}>{Icon.sync}</span>
            <span className="ra-btn-label">{syncing ? "Syncing…" : "Sync now"}</span>
          </button>
          {onToggleTheme && <ThemeToggle theme={theme} onToggle={onToggleTheme} />}
          <button className="ra-icon-btn" aria-label="Log out" onClick={logout}>{Icon.logout}<span className="ra-btn-label">Log out</span></button>
        </div>
      </header>

      <main className="ra-main">
        {note && <p className={`ra-toast ra-toast--${note.tone}`} role="status">{note.text}</p>}

        {tab === "beat" && (
          <BeatView user={user} history={history} retailers={ref.retailers} visits={visits} pending={pending} locating={locating} refreshedAt={ref.refreshedAt} progress={ref.progress}
            onCheckIn={checkIn} onOrder={takeOrderFor} onCollect={startCollect} onDiscardVisit={async (id) => { await discardVisit(db, id); reloadLocal(); }} />
        )}
        {tab === "order" && (
          <NewOrderView ref_={ref} history={history} draft={draft} setDraft={setDraft} onSave={saveOrder}
            editing={editingId ? orders.find((o) => o.clientOrderId === editingId) || null : null} onCancelEdit={cancelEdit} />
        )}
        {tab === "orders" && (
          <OrdersView history={history} onEdit={startEdit} onCancel={cancelPending}
            onRetry={async (id) => {
              const r = await retryOrder(db, id);
              await reloadLocal();
              if (!r.ok) return setNote({ text: r.message, tone: "warn" });
              if (navigator.onLine !== false) runSync(true);
            }}
            onDiscard={async (id) => {
              const r = await discardOrder(db, id);
              await reloadLocal();
              if (!r.ok) setNote({ text: r.message, tone: "warn" });
            }} />
        )}
        {tab === "collect" && (
          <CollectView ref_={ref} history={collectionHistory} draft={collectDraft} setDraft={setCollectDraft} onSave={saveCollection}
            onCancel={cancelPendingCollection} onDiscard={async (id) => { await discardCollection(db, id); reloadLocal(); }}
            handovers={handovers} onCloseDay={closeDay} onCancelDayClose={cancelDayClose}
            onDiscardDayClose={async (id) => { await discardHandover(db, id); reloadLocal(); }}
            company={user?.shopName} repName={displayName} />
        )}
        {tab === "settings" && (
          <RepSettings user={user} db={db} api={api} online={online} accent={accent} onAccent={chooseAccent}
            photo={photo} onPhotoChange={changePhoto} onProfileSaved={reloadLocal} processImage={processImage} />
        )}
      </main>

      <div className="ra-footer"><Footer /></div>

      <nav className="ra-nav" aria-label="Rep app">
        <button type="button" className="ra-me-rail" aria-label="Your profile" onClick={() => setTab("settings")}>
          <RepAvatar photo={photo} name={displayName} size={56} />
          <span className="ra-me-text">
            <span className="ra-me-name">{displayName || "Field rep"}</span>
            <span className="ra-me-role">Field rep{user?.shopName ? ` · ${user.shopName}` : ""}</span>
          </span>
        </button>
        <div className="ra-tabs" role="tablist" aria-label="Rep app sections">
        {tabs.map(([key, label, icon]) => (
          <button key={key} role="tab" aria-selected={tab === key} className={`ra-tab ${tab === key ? "is-active" : ""}`} onClick={() => setTab(key)}>
            {icon}
            <span>{label}</span>
            {(key === "orders" ? attention : key === "collect" ? collectAttention : 0) > 0 && (
              <span className="ra-tab-count">{key === "orders" ? attention : collectAttention}</span>
            )}
          </button>
        ))}
        </div>
      </nav>
    </div>
  );
}

// ───────────── shared bits ─────────────

const svg = (children, size = 20) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const Icon = {
  pin: svg(<><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.4" /></>, 22),
  cart: svg(<><path d="M3 4h2.2l1.7 9.2a1.6 1.6 0 001.6 1.3h8.1a1.6 1.6 0 001.6-1.2L20 7H6.1" /><circle cx="9.5" cy="19" r="1.3" /><circle cx="17" cy="19" r="1.3" /></>, 22),
  list: svg(<><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>, 22),
  sync: svg(<><path d="M20 11a8 8 0 00-14.3-4.5M4 13a8 8 0 0014.3 4.5" /><path d="M20 4v5h-5M4 20v-5h5" /></>, 16),
  logout: svg(<><path d="M10 4H6a2 2 0 00-2 2v12a2 2 0 002 2h4" /><path d="M16 8l4 4-4 4M20 12H9" /></>, 16),
  phone: svg(<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />, 15),
  check: svg(<path d="M5 12.5l4.5 4.5L19 7.5" />, 18),
  gear: svg(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></>, 22),
  wallet: svg(<><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /><circle cx="16.5" cy="14.5" r="1.2" /></>, 22),
  receipt: svg(<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" /><path d="M9 8h6M9 12h6" /></>, 22),
};

function EmptyState({ icon, children }) {
  return (
    <div className="ra-empty">
      <span className="ra-empty-icon">{icon}</span>
      <div>{children}</div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

const isToday = (iso) => {
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
};

// ───────────── My beat ─────────────

// ───────────── credit position ─────────────

const LEVEL_LABEL = { near: "Near limit", over: "Over limit" };

function CreditBar({ credit }) {
  return (
    <div className={"ra-credit-bar ra-credit-bar--" + credit.level} role="img" aria-label={credit.usedPercent + "% of the credit limit"}>
      <span style={{ width: Math.min(100, credit.usedPercent) + "%" }} />
    </div>
  );
}

/** One quiet line on a beat card: what they owe, against their limit, with a bar when a limit is set. */
function CreditMini({ retailer, history }) {
  const c = creditStatus(retailer, history, 0);
  if (!c || (!c.hasLimit && c.outstanding <= 0 && c.pending <= 0)) return null;
  return (
    <div className="ra-credit-mini">
      <div className="ra-credit-mini-row">
        <span>Owes {fmtMoney(c.outstanding)}{c.hasLimit ? " of " + fmtMoney(c.limit) + " limit" : ""}</span>
        {LEVEL_LABEL[c.level] && <span className={"ra-badge ra-badge--" + (c.level === "over" ? "bad" : "warn")}>{LEVEL_LABEL[c.level]}</span>}
      </div>
      {c.hasLimit && <CreditBar credit={c} />}
      {c.pending > 0 && <div className="ra-muted">+ {fmtMoney(c.pending)} in orders not yet invoiced</div>}
    </div>
  );
}

/** Shown while taking an order: where this retailer stands, and where this order would put them. Advisory only — it never blocks. */
function CreditPanel({ retailer, credit, refreshedAt }) {
  if (!retailer || !credit || (!credit.hasLimit && credit.outstanding <= 0 && credit.pending <= 0)) return null;
  const name = retailer.shopName;
  let message = null;
  if (credit.alreadyOver) {
    message = name + " is already " + fmtMoney(credit.exposureBefore - credit.limit) + " over their credit limit. You can still save the order — the office will decide.";
  } else if (credit.pushesOver) {
    message = "This order takes " + name + " " + fmtMoney(credit.overBy) + " over their credit limit. You can still save it — the office will decide.";
  } else if (credit.level === "near") {
    message = name + (credit.thisOrder > 0 ? " will be at " : " is at ") + credit.usedPercent + "% of their credit limit" + (credit.thisOrder > 0 ? " after this order." : ".");
  }
  return (
    <div className={"ra-credit ra-credit--" + credit.level} role="group" aria-label="Credit position">
      <div className="ra-credit-head">
        <strong>Credit position</strong>
        {LEVEL_LABEL[credit.level] && <span className={"ra-badge ra-badge--" + (credit.level === "over" ? "bad" : "warn")}>{LEVEL_LABEL[credit.level]}</span>}
      </div>
      {credit.hasLimit && <CreditBar credit={credit} />}
      <dl className="ra-credit-rows">
        {credit.hasLimit && <div><dt>Credit limit</dt><dd>{fmtMoney(credit.limit)}</dd></div>}
        <div><dt>Owes now</dt><dd>{fmtMoney(credit.outstanding)}</dd></div>
        {credit.pending > 0 && <div><dt>Orders not yet invoiced</dt><dd>{fmtMoney(credit.pending)}</dd></div>}
        {credit.thisOrder > 0 && <div><dt>This order</dt><dd>{fmtMoney(credit.thisOrder)}</dd></div>}
        {credit.hasLimit && (
          <div className="ra-credit-after">
            <dt>{credit.overBy > 0 ? "Over the limit by" : "Left after this order"}</dt>
            <dd>{fmtMoney(credit.overBy > 0 ? credit.overBy : credit.limit - credit.exposureAfter)}</dd>
          </div>
        )}
      </dl>
      {message && <p className={"ra-credit-msg ra-credit-msg--" + credit.level} role="status">{message}</p>}
      {refreshedAt && <div className="ra-muted ra-credit-foot">Balances as of {fmtTime(refreshedAt)}</div>}
    </div>
  );
}

function LastVisit({ retailer, visits }) {
  const rec = recency(lastVisitFor(retailer.retailerId, retailer.lastVisitAt, visits));
  return <div className={"ra-lastvisit ra-lastvisit--" + rec.tone}>{rec.label}</div>;
}

function TargetBars({ progress }) {
  const bars = targetBars(progress);
  if (bars.length === 0) return null;
  const fmt = (b, n) => (b.kind === "money" ? fmtMoney(n) : String(n));
  return (
    <section className="ra-card ra-targets" aria-label="Your targets this month">
      <div className="ra-row">
        <h3 className="ra-card-title">This month&apos;s targets</h3>
        <span className="ra-muted">{plural(progress.daysLeft, "day")} left</span>
      </div>
      {bars.map((b) => (
        <div key={b.key} className="ra-target">
          <div className="ra-row"><span>{b.label}</span><span className="ra-muted">{fmt(b, b.actual)} of {fmt(b, b.target)} · {b.percent}%</span></div>
          <div className={"ra-credit-bar ra-target-bar--" + b.tone} role="img" aria-label={b.label + " " + b.percent + "% of target"}>
            <span style={{ width: Math.min(100, b.percent) + "%" }} />
          </div>
        </div>
      ))}
      {bars.some((b) => b.key === "collections") && (
        <p className="ra-muted" style={{ marginTop: 10 }}>Collections include money the office hasn&apos;t confirmed yet; the office counts confirmed payments only.</p>
      )}
    </section>
  );
}

function BeatView({ user, history, retailers, visits, pending, locating, refreshedAt, progress, onCheckIn, onOrder, onCollect, onDiscardVisit }) {
  const today = DAYS[new Date().getDay()];
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? retailers : retailers.filter((r) => !r.visitDay || r.visitDay === today);
  const firstName = (user?.name || "").split(" ")[0];
  const checkedInToday = visits.filter((v) => isToday(v.capturedAt)).length;

  return (
    <>
      <div className="ra-page-head">
        <h2 className="ra-page-title">{greeting()}{firstName ? `, ${firstName}` : ""}</h2>
        <div className="ra-page-sub">{dayLabel(today)} · {new Date().toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</div>
      </div>

      <div className="ra-stats">
        <div className="ra-stat"><div className="ra-stat-value">{shown.length}</div><div className="ra-stat-label">{showAll ? "On your beat" : "To visit today"}</div></div>
        <div className="ra-stat"><div className="ra-stat-value">{checkedInToday}</div><div className="ra-stat-label">Check-ins today</div></div>
        <div className="ra-stat"><div className="ra-stat-value">{pending}</div><div className="ra-stat-label">Unsent items</div></div>
      </div>

      <TargetBars progress={progress} />

      <div className="ra-chips">
        <button className={`ra-chip ${!showAll ? "is-active" : ""}`} onClick={() => setShowAll(false)}>Today ({dayLabel(today)})</button>
        <button className={`ra-chip ${showAll ? "is-active" : ""}`} onClick={() => setShowAll(true)}>Whole beat</button>
      </div>

      {retailers.length === 0 && (
        <EmptyState icon={Icon.pin}>No retailers on your beat yet. Connect to the internet once so they can download, or ask the office to assign some.</EmptyState>
      )}
      {retailers.length > 0 && shown.length === 0 && (
        <EmptyState icon={Icon.pin}>Nothing scheduled for today. Tap "Whole beat" to see everyone.</EmptyState>
      )}

      <div className="ra-grid">
        {shown.map((r) => (
          <div className="ra-card" key={r.beatUKey}>
            <div className="ra-row">
              <h3 className="ra-card-title">{r.shopName}</h3>
              {r.visitDay && <span className="ra-badge">{dayLabel(r.visitDay)}</span>}
            </div>
            <div className="ra-muted">{[r.ownerName, r.address].filter(Boolean).join(" · ")}</div>
            <LastVisit retailer={r} visits={visits} />
            <CreditMini retailer={r} history={history} />
            {r.phone && <a className="ra-muted ra-link" href={`tel:${r.phone}`} style={{ display: "inline-flex", gap: 6, alignItems: "center", marginTop: 4 }}>{Icon.phone}{r.phone}</a>}
            <div className="ra-actions">
              <button className="ra-btn" disabled={locating !== null} onClick={() => onCheckIn(r)}>
                {locating === r.retailerId ? "Locating…" : <>{Icon.pin}Check in</>}
              </button>
              <button className="ra-btn ra-btn--primary" onClick={() => onOrder(r.retailerId)}>Take order</button>
              <button className="ra-btn" aria-label={"Collect payment from " + r.shopName} onClick={() => onCollect(r.retailerId)}>Collect payment</button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14 }}>
        <button className="ra-btn ra-btn--block" disabled={locating !== null} onClick={() => onCheckIn(null)}>
          {locating === "unplanned" ? "Locating…" : "Check in at an unplanned stop"}
        </button>
      </div>
      {refreshedAt && <p className="ra-muted" style={{ textAlign: "center", marginTop: 10 }}>Beat last updated {fmtTime(refreshedAt)}</p>}

      {visits.length > 0 && <h2 className="ra-section-title">Recent check-ins</h2>}
      <div className="ra-grid">
        {visits.slice(0, 10).map((v) => {
          const [label, tone] = STATE_UI[v.state] || [v.state, "info"];
          return (
            <div className="ra-card" key={v.clientVisitId}>
              <div className="ra-row">
                <strong>{v.retailerName}</strong>
                <span className={`ra-badge ra-badge--${tone}`}>{label}</span>
              </div>
              <div className="ra-muted">{fmtTime(v.capturedAt)}</div>
              {v.state === STATE.INVALID && (
                <>
                  <div className="ra-conflict">{v.message}</div>
                  <div className="ra-actions"><button className="ra-btn ra-btn--sm ra-btn--danger" onClick={() => onDiscardVisit(v.clientVisitId)}>Discard</button></div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ───────────── New order ─────────────

const COLLECTION_PAGE = 15; // collections per page on the Collect tab
const PAGE = 24; // products shown per "page" — keeps a 500-product catalog fast and scannable

function NewOrderView({ ref_, history, draft, setDraft, onSave, editing, onCancelEdit }) {
  const { catalog } = ref_;
  // An order being edited keeps its retailer even if that retailer has since left the beat.
  const retailers = useMemo(() => {
    const beat = ref_.retailers;
    if (!editing || beat.some((r) => String(r.retailerId) === String(editing.retailerId))) return beat;
    return [...beat, { beatUKey: `edit-${editing.clientOrderId}`, retailerId: editing.retailerId, shopName: `${editing.retailerName} (no longer on your beat)` }];
  }, [ref_.retailers, editing]);
  const [cf, setCf] = useState(DEFAULT_CATALOG_FILTERS);
  const [shown, setShown] = useState(PAGE);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const facets = useMemo(() => catalogFacets(catalog), [catalog]);
  const results = useMemo(() => filterCatalog(catalog, cf), [catalog, cf]);
  const visible = results.slice(0, shown);
  const again = useMemo(() => orderAgain(history, draft.retailerId, catalog), [history, draft.retailerId, catalog]);
  const activeFilters = activeCatalogFilters(cf);
  const setFilter = (patch) => { setCf((prev) => ({ ...prev, ...patch })); setShown(PAGE); };

  const qtyInCart = (id) => draft.cart.find((c) => c.productId === id)?.quantity || 0;

  const setCart = (fn) => setDraft((d) => ({ ...d, cart: fn(d.cart) }));
  const add = (p, qty = 1) =>
    setCart((cart) => {
      const hit = cart.find((c) => c.productId === p.productId);
      if (hit) return cart.map((c) => (c.productId === p.productId ? { ...c, quantity: c.quantity + qty } : c));
      return [...cart, { productId: p.productId, name: p.name, quantity: qty, quotedPrice: Number(p.sellingPrice), stock: p.stock }];
    });
  const setQty = (id, v) => setCart((cart) => cart.map((c) => (c.productId === id ? { ...c, quantity: Math.max(1, parseInt(v, 10) || 1) } : c)));
  const remove = (id) => setCart((cart) => cart.filter((c) => c.productId !== id));

  const total = draft.cart.reduce((s, c) => s + c.quantity * c.quotedPrice, 0);
  const chosenRetailer = retailers.find((r) => String(r.retailerId) === String(draft.retailerId));
  const credit = creditStatus(chosenRetailer, history, total, editing ? editing.clientOrderId : null);

  const submit = async () => {
    if (!draft.retailerId) return setError("Pick the retailer this order is for.");
    if (draft.cart.length === 0) return setError("Add at least one product.");
    setError(null);
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  };

  if (retailers.length === 0) {
    return (
      <>
        <div className="ra-page-head"><h2 className="ra-page-title">New order</h2></div>
        <EmptyState icon={Icon.cart}>You need retailers on your beat before you can take an order.</EmptyState>
      </>
    );
  }

  return (
    <>
      <div className="ra-page-head">
        <h2 className="ra-page-title">{editing ? "Edit order" : "New order"}</h2>
        <div className="ra-page-sub">{editing ? "Change anything, then save. It sends again when you have a signal." : "Pick a retailer, add products, save. It sends when you have a signal."}</div>
      </div>

      {editing && (
        <div className="ra-edit-banner" role="status">
          <span>
            Editing your order for <strong>{editing.retailerName}</strong>
            {editing.state === STATE.INVALID ? " — it was refused. Fix it and it will be sent again." : "."}
          </span>
          <button type="button" className="ra-btn ra-btn--sm" onClick={onCancelEdit}>Cancel editing</button>
        </div>
      )}

      <div className="ra-order-layout">
        <section>
          <label className="ra-label" htmlFor="ra-retailer" style={{ marginTop: 0 }}>Retailer</label>
          <select id="ra-retailer" className="ra-select" value={draft.retailerId}
            onChange={(e) => setDraft((d) => ({ ...d, retailerId: e.target.value }))}>
            <option value="">Select retailer…</option>
            {retailers.map((r) => <option key={r.beatUKey} value={r.retailerId}>{r.shopName}</option>)}
          </select>

          <CreditPanel retailer={chosenRetailer} credit={credit} refreshedAt={ref_.refreshedAt} />

          {again.length > 0 && (
            <div className="ra-again">
              <div className="ra-label" style={{ marginBottom: 8 }}>Order again — this retailer's usual items</div>
              <div className="ra-chips ra-chips--scroll">
                {again.map(({ product, lastQty }) => (
                  <button key={product.productId} className="ra-chip" aria-label={`Reorder ${product.name}`} onClick={() => add(product, lastQty)}>
                    + {product.name} · {lastQty}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="ra-label" htmlFor="ra-search">Add products</label>
          {catalog.length === 0 ? (
            <EmptyState icon={Icon.cart}>No product list on this phone yet. Connect to the internet once to download it.</EmptyState>
          ) : (
            <>
              <input id="ra-search" className="ra-input" placeholder="Search by name, code, barcode or company" value={cf.q}
                onChange={(e) => setFilter({ q: e.target.value })} />

              <div className="ra-filterbar">
                {facets.categories.length > 1 && (
                  <select className="ra-select ra-select--sm" aria-label="Category" value={cf.category} onChange={(e) => setFilter({ category: e.target.value })}>
                    <option value="">All categories ({catalog.length})</option>
                    {facets.categories.map((c) => <option key={c.name} value={c.name}>{c.name} ({c.count})</option>)}
                  </select>
                )}
                <select className="ra-select ra-select--sm" aria-label="Sort products" value={cf.sort} onChange={(e) => setFilter({ sort: e.target.value })}>
                  {CATALOG_SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <button type="button" className={`ra-chip ${cf.inStockOnly ? "is-active" : ""}`} aria-pressed={cf.inStockOnly}
                  onClick={() => setFilter({ inStockOnly: !cf.inStockOnly })}>In stock only</button>
                {activeFilters > 0 && (
                  <button type="button" className="ra-btn ra-btn--sm ra-btn--ghost" onClick={() => { setCf(DEFAULT_CATALOG_FILTERS); setShown(PAGE); }}>
                    Clear filters ({activeFilters})
                  </button>
                )}
              </div>

              {catalog.length > 30 && facets.letters.length > 1 && (
                <div className="ra-az" role="group" aria-label="Jump to letter">
                  <button type="button" className={`ra-az-key ${cf.letter === "" ? "is-active" : ""}`} onClick={() => setFilter({ letter: "" })}>All</button>
                  {facets.letters.map((l) => (
                    <button key={l} type="button" aria-label={`Jump to ${l}`} className={`ra-az-key ${cf.letter === l ? "is-active" : ""}`}
                      onClick={() => setFilter({ letter: cf.letter === l ? "" : l })}>{l}</button>
                  ))}
                </div>
              )}

              <div className="ra-count" aria-live="polite">
                {results.length === catalog.length ? `${plural(results.length, "product")}` : `${results.length} of ${catalog.length} products`}
                {results.length > visible.length ? ` · showing ${visible.length}` : ""}
              </div>

              <div className="ra-products">
                {visible.map((p) => {
                  const inOrder = qtyInCart(p.productId);
                  const out = !(Number(p.stock) > 0);
                  return (
                    <div className={`ra-card ra-product ${inOrder ? "is-in-order" : ""}`} key={p.productId}>
                      <div style={{ minWidth: 0 }}>
                        <strong>{p.name}</strong>
                        <div className="ra-muted">
                          {fmtMoney(p.sellingPrice)}{p.unit ? ` / ${p.unit}` : ""} · {p.stock ?? 0} in stock
                        </div>
                        <div className="ra-tags">
                          {p.category && <span className="ra-tag">{p.category}</span>}
                          {out && <span className="ra-badge ra-badge--bad">Out of stock</span>}
                          {inOrder > 0 && <span className="ra-badge ra-badge--ok">{inOrder} in order</span>}
                        </div>
                      </div>
                      <button className="ra-btn ra-btn--sm ra-btn--primary" aria-label={`Add ${p.name}`} onClick={() => add(p)}>Add</button>
                    </div>
                  );
                })}
              </div>

              {results.length === 0 && (
                <EmptyState icon={Icon.cart}>
                  No products match{cf.q ? ` "${cf.q}"` : " these filters"}.
                  {activeFilters > 0 && <><br /><button className="ra-btn ra-btn--sm" style={{ marginTop: 10 }} onClick={() => { setCf(DEFAULT_CATALOG_FILTERS); setShown(PAGE); }}>Clear filters</button></>}
                </EmptyState>
              )}
              {results.length > visible.length && (
                <button className="ra-btn ra-btn--block" style={{ marginTop: 12 }} onClick={() => setShown((n) => n + PAGE)}>
                  Show {Math.min(PAGE, results.length - visible.length)} more ({results.length - visible.length} left)
                </button>
              )}
            </>
          )}
        </section>

        <aside className="ra-basket">
          <h2 className="ra-section-title" style={{ marginTop: 0 }}>This order</h2>
          {draft.cart.length === 0 ? (
            <EmptyState icon={Icon.cart}>Nothing added yet — tap "Add" on a product.</EmptyState>
          ) : (
            <div className="ra-card">
              {draft.cart.map((c) => (
                <div className="ra-line" key={c.productId}>
                  <div style={{ minWidth: 0 }}>
                    <strong>{c.name}</strong>
                    <div className="ra-muted">{fmtMoney(c.quotedPrice)} each</div>
                    {c.stock != null && c.quantity > c.stock && (
                      <div className="ra-warn-text">Only {c.stock} in stock when this phone last updated — the office may adjust it.</div>
                    )}
                  </div>
                  <div className="ra-line-end">
                    <span className="ra-qty">
                      <button aria-label={`Decrease ${c.name}`} onClick={() => setQty(c.productId, c.quantity - 1)}>−</button>
                      <input aria-label={`Quantity for ${c.name}`} type="number" inputMode="numeric" min="1" value={c.quantity} onChange={(e) => setQty(c.productId, e.target.value)} />
                      <button aria-label={`Increase ${c.name}`} onClick={() => setQty(c.productId, c.quantity + 1)}>+</button>
                    </span>
                    <div><button className="ra-btn ra-btn--sm ra-btn--ghost" style={{ marginTop: 6 }} aria-label={`Remove ${c.name}`} onClick={() => remove(c.productId)}>Remove</button></div>
                  </div>
                </div>
              ))}
              <div className="ra-total"><strong>Total</strong><strong>{fmtMoney(total)}</strong></div>
            </div>
          )}

          {draft.cart.length > 0 && (
            <>
              <label className="ra-label" htmlFor="ra-remarks">Note for the office (optional)</label>
              <input id="ra-remarks" className="ra-input" value={draft.remarks} onChange={(e) => setDraft((d) => ({ ...d, remarks: e.target.value }))} />
            </>
          )}

          {error && <p className="ra-toast ra-toast--bad" role="alert" style={{ marginTop: 12 }}>{error}</p>}
          <div className="ra-savebar">
            <button className="ra-btn ra-btn--primary ra-btn--block" disabled={saving} onClick={submit}>{editing ? "Save changes" : "Save order"}</button>
          </div>
        </aside>
      </div>
    </>
  );
}

// ───────────── Orders ─────────────

const fmtClock = (d) => (d ? new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "");

function OrdersView({ history, onRetry, onDiscard, onEdit, onCancel }) {
  const [f, setF] = useState(DEFAULT_FILTERS);
  const [panelOpen, setPanelOpen] = useState(false);
  const [open, setOpen] = useState(null);
  const set = (patch) => setF((prev) => ({ ...prev, ...patch }));

  const filtered = useMemo(() => applyFilters(history, f), [history, f]);
  const counts = useMemo(() => statusCounts(history, f), [history, f]);
  const retailers = useMemo(() => retailersIn(history), [history]);
  const sum = summarize(filtered);
  const active = countActive(f);
  const needAttention = history.filter((o) => ATTENTION.includes(o.status)).length;
  const byDate = f.sort === "NEWEST" || f.sort === "OLDEST";
  const groups = byDate ? groupByDay(filtered) : [{ key: "all", label: null, orders: filtered }];

  const head = (
    <div className="ra-page-head">
      <h2 className="ra-page-title">Orders</h2>
      <div className="ra-page-sub">What you've taken, and what the office did with it.</div>
    </div>
  );

  if (history.length === 0) {
    return (
      <>
        {head}
        <EmptyState icon={Icon.receipt}>No orders yet. Take one from "My beat" or "New order".</EmptyState>
      </>
    );
  }

  const chips = [["ALL", "All"], ["ATTENTION", "Needs attention"], ...Object.entries(STATUS_META).map(([k, [label]]) => [k, label])];

  return (
    <>
      {head}

      <div className="ra-stats">
        <div className="ra-stat"><div className="ra-stat-value">{sum.count}</div><div className="ra-stat-label">{active ? "Matching orders" : "Orders"}</div></div>
        <div className="ra-stat"><div className="ra-stat-value">{fmtMoney(sum.total)}</div><div className="ra-stat-label">Order value</div></div>
        <div className="ra-stat"><div className="ra-stat-value">{needAttention}</div><div className="ra-stat-label">Need attention</div></div>
      </div>

      <div className="ra-card ra-filters">
        <div className="ra-filters-top">
          <input className="ra-input" aria-label="Search orders" placeholder="Search retailer, product, order no. or note" value={f.q} onChange={(e) => set({ q: e.target.value })} />
          <button type="button" className="ra-btn ra-filters-toggle" aria-expanded={panelOpen} onClick={() => setPanelOpen((v) => !v)}>
            Filters{active > 0 ? ` (${active})` : ""}
          </button>
        </div>

        <div className="ra-chips ra-chips--scroll" role="group" aria-label="Filter by status">
          {chips.filter(([k]) => k === "ALL" || k === "ATTENTION" || counts[k] > 0 || f.status === k).map(([key, label]) => (
            <button key={key} type="button" className={`ra-chip ${f.status === key ? "is-active" : ""}`} aria-pressed={f.status === key}
              onClick={() => set({ status: key })}>{`${label} (${counts[key] ?? 0})`}</button>
          ))}
        </div>

        <div className={`ra-filter-panel ${panelOpen ? "is-open" : ""}`}>
          <div className="ra-field">
            <label className="ra-label" htmlFor="ra-f-period">Period</label>
            <select id="ra-f-period" className="ra-select" value={f.period} onChange={(e) => set({ period: e.target.value })}>
              {PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          {f.period === "MONTH" && (
            <div className="ra-field">
              <label className="ra-label" htmlFor="ra-f-month">Month</label>
              <input id="ra-f-month" type="month" className="ra-input" value={f.month} onChange={(e) => set({ month: e.target.value })} />
            </div>
          )}
          {f.period === "CUSTOM" && (
            <>
              <div className="ra-field">
                <label className="ra-label" htmlFor="ra-f-from">From date</label>
                <input id="ra-f-from" type="date" className="ra-input" value={f.from} max={f.to || undefined} onChange={(e) => set({ from: e.target.value })} />
              </div>
              <div className="ra-field">
                <label className="ra-label" htmlFor="ra-f-to">To date</label>
                <input id="ra-f-to" type="date" className="ra-input" value={f.to} min={f.from || undefined} onChange={(e) => set({ to: e.target.value })} />
              </div>
            </>
          )}
          <div className="ra-field">
            <label className="ra-label" htmlFor="ra-f-retailer">Retailer</label>
            <select id="ra-f-retailer" className="ra-select" value={f.retailerId} onChange={(e) => set({ retailerId: e.target.value })}>
              <option value="">All retailers</option>
              {retailers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="ra-field">
            <label className="ra-label" htmlFor="ra-f-min">Min amount (₹)</label>
            <input id="ra-f-min" type="number" inputMode="decimal" min="0" className="ra-input" placeholder="0" value={f.min} onChange={(e) => set({ min: e.target.value })} />
          </div>
          <div className="ra-field">
            <label className="ra-label" htmlFor="ra-f-max">Max amount (₹)</label>
            <input id="ra-f-max" type="number" inputMode="decimal" min="0" className="ra-input" placeholder="Any" value={f.max} onChange={(e) => set({ max: e.target.value })} />
          </div>
          <div className="ra-field">
            <label className="ra-label" htmlFor="ra-f-sort">Sort by</label>
            <select id="ra-f-sort" className="ra-select" value={f.sort} onChange={(e) => set({ sort: e.target.value })}>
              {SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
        </div>

        {active > 0 && (
          <div className="ra-filters-foot">
            <span className="ra-muted">{plural(active, "filter")} applied</span>
            <button type="button" className="ra-btn ra-btn--sm ra-btn--ghost" onClick={() => setF(DEFAULT_FILTERS)}>Reset filters</button>
          </div>
        )}
      </div>

      {filtered.length === 0 && (
        <EmptyState icon={Icon.receipt}>
          No orders match these filters.
          <br /><button className="ra-btn ra-btn--sm" style={{ marginTop: 10 }} onClick={() => setF(DEFAULT_FILTERS)}>Reset filters</button>
        </EmptyState>
      )}

      {groups.map((g) => (
        <section key={g.key} className="ra-day-group">
          {g.label && (
            <h3 className="ra-day">
              <span>{g.label}</span>
              <span className="ra-day-meta">{plural(g.orders.length, "order")} · {fmtMoney(g.total)}</span>
            </h3>
          )}
          <div className="ra-orders">
            {g.orders.map((o) => <OrderRow key={o.key} o={o} timeOnly={byDate} isOpen={open === o.key} onToggle={() => setOpen(open === o.key ? null : o.key)} onRetry={onRetry} onDiscard={onDiscard} onEdit={onEdit} onCancel={onCancel} />)}
          </div>
        </section>
      ))}
    </>
  );
}

function OrderRow({ o, timeOnly, isOpen, onToggle, onRetry, onDiscard, onEdit, onCancel }) {
  const [label, tone] = STATUS_META[o.status];
  const [confirming, setConfirming] = useState(false);
  return (
    <article className="ra-card ra-order">
      <div className="ra-order-top">
        <div className="ra-order-who">
          <h3 className="ra-card-title">{o.retailerName}</h3>
          <div className="ra-muted">
            {timeOnly ? fmtClock(o.capturedAt) : fmtTime(o.capturedAt)} · {plural(o.items.length, "line")}
            {o.orderNumber ? ` · ${o.orderNumber}` : ""}
          </div>
        </div>
        <div className="ra-order-amt">{fmtMoney(o.total)}</div>
        <span className={`ra-badge ra-badge--${tone}`}>{label}</span>
        <div className="ra-order-actions">
          <button className="ra-btn ra-btn--sm" aria-expanded={isOpen} onClick={onToggle}>{isOpen ? "Hide lines" : "Show lines"}</button>
          {o.status === STATUS.PENDING && o.clientOrderId && !confirming && (
            <>
              <button className="ra-btn ra-btn--sm" aria-label={"Edit order for " + o.retailerName} onClick={() => onEdit(o.clientOrderId)}>Edit</button>
              <button className="ra-btn ra-btn--sm ra-btn--danger" aria-label={"Cancel order for " + o.retailerName} onClick={() => setConfirming(true)}>Cancel order</button>
            </>
          )}
          {o.status === STATUS.INVALID && o.clientOrderId && (
            <>
              <button className="ra-btn ra-btn--sm" aria-label={"Edit and resend order for " + o.retailerName} onClick={() => onEdit(o.clientOrderId)}>Edit &amp; retry</button>
              <button className="ra-btn ra-btn--sm ra-btn--primary" onClick={() => onRetry(o.clientOrderId)}>Retry</button>
              <button className="ra-btn ra-btn--sm ra-btn--danger" onClick={() => onDiscard(o.clientOrderId)}>Discard</button>
            </>
          )}
        </div>
      </div>

      {confirming && (
        <div className="ra-confirm" role="group" aria-label="Confirm cancel">
          <span>Cancel this order? It will be removed from this phone and won't be sent.</span>
          <div className="ra-confirm-actions">
            <button className="ra-btn ra-btn--sm ra-btn--danger" onClick={async () => { await onCancel(o.clientOrderId); setConfirming(false); }}>Yes, cancel order</button>
            <button className="ra-btn ra-btn--sm" onClick={() => setConfirming(false)}>Keep it</button>
          </div>
        </div>
      )}

      {o.staleEdit && (
        <div className="ra-conflict">Your changes weren't applied: the office had already received this order before you edited it. Ask them to adjust it.</div>
      )}
      {o.status === STATUS.REJECTED && o.rejectReason && <div className="ra-conflict">Rejected: {o.rejectReason}</div>}
      {o.status === STATUS.INVALID && <div className="ra-conflict">{o.message}</div>}
      {o.status === STATUS.FLAGGED && (
        <div className="ra-conflict">A price or stock changed since you quoted this. The office will review it — you don't need to do anything.</div>
      )}
      {o.remarks && <div className="ra-muted" style={{ marginTop: 6 }}>Note: {o.remarks}</div>}

      {isOpen && (
        <div className="ra-order-lines">
          {o.items.map((i) => (
            <div className="ra-line" key={i.productId}>
              <div style={{ minWidth: 0 }}>
                <strong>{i.name}</strong>
                {i.conflict && <div className="ra-conflict">{conflictText(i.conflict)}</div>}
              </div>
              <div className="ra-line-end">{i.quantity} × {fmtMoney(i.quotedPrice)}</div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

// ───────────── Collect payment ─────────────

const REF_LABEL = { CHEQUE: "Cheque number", UPI: "UPI reference (optional)", CARD: "Card slip / reference (optional)" };

function CollectView({ ref_, history, draft, setDraft, onSave, onCancel, onDiscard, handovers, onCloseDay, onCancelDayClose, onDiscardDayClose, company, repName }) {
  const { retailers, refreshedAt } = ref_;
  const [section, setSection] = useState("payments");
  const [receiptFor, setReceiptFor] = useState(null);
  const [f, setF] = useState(DEFAULT_COLLECTION_FILTERS);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(null);
  const set = (patch) => setF((prev) => ({ ...prev, ...patch }));
  const setField = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const retailer = retailers.find((r) => String(r.retailerId) === String(draft.retailerId));
  const owes = retailer && retailer.outstandingBalance !== undefined && retailer.outstandingBalance !== null ? Number(retailer.outstandingBalance) : null;
  const unbooked = retailer ? awaitingForRetailer(history, retailer.retailerId) : 0;
  const stillOwed = owes === null ? null : Math.max(0, owes - unbooked);
  const amountNum = Number(draft.amount);
  const openInvoices = useMemo(() => invoicesFor(draft.retailerId, ref_.serverInvoices || [], history), [draft.retailerId, ref_.serverInvoices, history]);
  const invoice = openInvoices.find((i) => String(i.salesId) === String(draft.invoiceId)) || null;

  const filtered = useMemo(() => applyCollectionFilters(history, f), [history, f]);
  const counts = useMemo(() => collectionStatusCounts(history, f), [history, f]);
  const summary = collectionSummary(history);
  const active = countActiveCollectionFilters(f);
  const retailerOptions = useMemo(() => retailersInCollections(history), [history]);
  // Pages of the (already searched / filtered) list. It is all on the phone, so paging is local — and it must work offline.
  const [colPage, setColPage] = useState(1);
  const colPages = Math.max(1, Math.ceil(filtered.length / COLLECTION_PAGE));
  useEffect(() => { setColPage(1); }, [f, history.length]);
  const pageRows = filtered.slice((Math.min(colPage, colPages) - 1) * COLLECTION_PAGE, Math.min(colPage, colPages) * COLLECTION_PAGE);
  const groups = groupByDay(pageRows);

  const submit = async () => {
    const problem = validateCollection({ ...draft, invoiceLeft: invoice ? invoice.left : null });
    if (problem) return setError(problem);
    setError(null);
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  };

  const chips = [["ALL", "All"], ...Object.entries(COLLECTION_STATUS_META).map(([k, [label]]) => [k, label])];

  return (
    <>
      <div className="ra-page-head">
        <h2 className="ra-page-title">Collect payment</h2>
        <div className="ra-page-sub">Record money you collect. It stays "awaiting office" until they confirm it.</div>
      </div>

      <div className="ra-chips" role="tablist" aria-label="Collect sections">
        <button type="button" role="tab" aria-selected={section === "payments"} className={"ra-chip " + (section === "payments" ? "is-active" : "")} onClick={() => setSection("payments")}>Payments</button>
        <button type="button" role="tab" aria-selected={section === "close"} className={"ra-chip " + (section === "close" ? "is-active" : "")} onClick={() => setSection("close")}>Day close</button>
      </div>

      <div className="ra-stats">
        <div className="ra-stat"><div className="ra-stat-value">{fmtMoney(summary.collectedToday)}</div><div className="ra-stat-label">Collected today</div></div>
        <div className="ra-stat"><div className="ra-stat-value">{fmtMoney(summary.awaitingOffice)}</div><div className="ra-stat-label">Awaiting the office</div></div>
        <div className="ra-stat"><div className="ra-stat-value">{fmtMoney(summary.confirmedThisMonth)}</div><div className="ra-stat-label">Confirmed this month</div></div>
      </div>

      {section === "close" && (
        <DayClose history={history} localHandovers={handovers} serverHandovers={ref_.serverHandovers || []}
          onSubmit={onCloseDay} onCancel={onCancelDayClose} onDiscard={onDiscardDayClose} />
      )}

      {section === "payments" && retailers.length === 0 && (
        <EmptyState icon={Icon.wallet}>You need retailers on your beat before you can record a collection.</EmptyState>
      )}

      {section === "payments" && retailers.length > 0 && <div className="ra-collect-layout">
        <section className="ra-card ra-collect-form" aria-label="New collection">
          <h3 className="ra-card-title">New collection</h3>

          <label className="ra-label" htmlFor="ra-c-retailer">Retailer</label>
          <select id="ra-c-retailer" className="ra-select" value={draft.retailerId} onChange={(e) => setField({ retailerId: e.target.value, invoiceId: "" })}>
            <option value="">Select retailer…</option>
            {retailers.map((r) => <option key={r.beatUKey} value={r.retailerId}>{r.shopName}</option>)}
          </select>

          {retailer && owes !== null && (
            <p className="ra-muted ra-owes" data-testid="owes-line">
              Owes <strong>{fmtMoney(owes)}</strong>
              {unbooked > 0 && <> · you've already collected <strong>{fmtMoney(unbooked)}</strong> the office hasn't booked yet</>}
              {refreshedAt && <> · as of {fmtTime(refreshedAt)}</>}
            </p>
          )}

          {retailer && openInvoices.length > 0 && (
            <>
              <label className="ra-label" htmlFor="ra-c-invoice">Apply to</label>
              <select id="ra-c-invoice" className="ra-select" value={draft.invoiceId} onChange={(e) => setField({ invoiceId: e.target.value })}>
                <option value="">Account balance (no specific invoice)</option>
                {openInvoices.map((i) => <option key={i.salesId} value={i.salesId}>{invoiceLabel(i, fmtMoney)}</option>)}
              </select>
            </>
          )}

          <label className="ra-label" htmlFor="ra-c-amount">Amount collected (₹)</label>
          <div className="ra-amount-row">
            <input id="ra-c-amount" className="ra-input" type="text" inputMode="decimal" placeholder="0.00" value={draft.amount}
              onChange={(e) => setField({ amount: e.target.value.replace(/[^0-9.]/g, "") })} />
            {invoice ? (
              <button type="button" className="ra-btn ra-btn--sm" onClick={() => setField({ amount: invoice.left.toFixed(2) })}>Full invoice</button>
            ) : stillOwed !== null && stillOwed > 0 && (
              <button type="button" className="ra-btn ra-btn--sm" onClick={() => setField({ amount: stillOwed.toFixed(2) })}>Full balance</button>
            )}
          </div>

          <div className="ra-label" id="ra-c-mode-label">How did they pay?</div>
          <div className="ra-chips ra-modes" role="radiogroup" aria-labelledby="ra-c-mode-label">
            {COLLECTION_MODES.map(([key, label]) => (
              <button key={key} type="button" role="radio" aria-checked={draft.mode === key} className={"ra-chip " + (draft.mode === key ? "is-active" : "")}
                onClick={() => setField({ mode: key, reference: key === "CASH" ? "" : draft.reference })}>{label}</button>
            ))}
          </div>

          {draft.mode !== "CASH" && (
            <>
              <label className="ra-label" htmlFor="ra-c-ref">{REF_LABEL[draft.mode]}</label>
              <input id="ra-c-ref" className="ra-input" value={draft.reference} maxLength={100} onChange={(e) => setField({ reference: e.target.value })} />
            </>
          )}

          <label className="ra-label" htmlFor="ra-c-note">Note (optional)</label>
          <input id="ra-c-note" className="ra-input" value={draft.note} maxLength={255} onChange={(e) => setField({ note: e.target.value })} />

          {!invoice && retailer && stillOwed !== null && amountNum > 0 && amountNum > stillOwed && (
            <p className="ra-credit-msg ra-credit-msg--over" role="status">
              {stillOwed === 0
                ? retailer.shopName + " doesn't owe anything right now — if the office confirms this, it will be kept as an advance."
                : "That's more than " + retailer.shopName + " still owes (" + fmtMoney(stillOwed) + "). If the office confirms it, the extra " + fmtMoney(amountNum - stillOwed) + " will be kept as an advance."}
            </p>
          )}

          {error && <p className="ra-toast ra-toast--bad" role="alert" style={{ marginTop: 12 }}>{error}</p>}
          <button className="ra-btn ra-btn--primary ra-btn--block" style={{ marginTop: 14 }} disabled={saving} onClick={submit}>Save collection</button>
        </section>

        <section aria-label="Collections">
          <div className="ra-card ra-filters">
            <input className="ra-input" aria-label="Search collections" placeholder="Search retailer, reference or note" value={f.q} onChange={(e) => set({ q: e.target.value })} />
            <div className="ra-chips ra-chips--scroll" role="group" aria-label="Filter collections by status">
              {chips.filter(([k]) => k === "ALL" || counts[k] > 0 || f.status === k).map(([key, label]) => (
                <button key={key} type="button" className={"ra-chip " + (f.status === key ? "is-active" : "")} aria-pressed={f.status === key}
                  onClick={() => set({ status: key })}>{label + " (" + (counts[key] ?? 0) + ")"}</button>
              ))}
            </div>
            <div className="ra-filter-panel is-open">
              <div className="ra-field">
                <label className="ra-label" htmlFor="ra-cf-period">Period</label>
                <select id="ra-cf-period" className="ra-select" value={f.period} onChange={(e) => set({ period: e.target.value })}>
                  {PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>
              {f.period === "MONTH" && (
                <div className="ra-field">
                  <label className="ra-label" htmlFor="ra-cf-month">Month</label>
                  <input id="ra-cf-month" type="month" className="ra-input" value={f.month} onChange={(e) => set({ month: e.target.value })} />
                </div>
              )}
              {f.period === "CUSTOM" && (
                <>
                  <div className="ra-field">
                    <label className="ra-label" htmlFor="ra-cf-from">From date</label>
                    <input id="ra-cf-from" type="date" className="ra-input" value={f.from} max={f.to || undefined} onChange={(e) => set({ from: e.target.value })} />
                  </div>
                  <div className="ra-field">
                    <label className="ra-label" htmlFor="ra-cf-to">To date</label>
                    <input id="ra-cf-to" type="date" className="ra-input" value={f.to} min={f.from || undefined} onChange={(e) => set({ to: e.target.value })} />
                  </div>
                </>
              )}
              <div className="ra-field">
                <label className="ra-label" htmlFor="ra-cf-retailer">Filter by retailer</label>
                <select id="ra-cf-retailer" className="ra-select" value={f.retailerId} onChange={(e) => set({ retailerId: e.target.value })}>
                  <option value="">All retailers</option>
                  {retailerOptions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>
            {active > 0 && (
              <div className="ra-filters-foot">
                <span className="ra-muted">{plural(active, "filter")} applied</span>
                <button type="button" className="ra-btn ra-btn--sm ra-btn--ghost" onClick={() => setF(DEFAULT_COLLECTION_FILTERS)}>Reset filters</button>
              </div>
            )}
          </div>

          {history.length === 0 && <EmptyState icon={Icon.wallet}>No collections yet. Record one with the form.</EmptyState>}
          {history.length > 0 && filtered.length === 0 && (
            <EmptyState icon={Icon.wallet}>
              No collections match these filters.
              <br /><button className="ra-btn ra-btn--sm" style={{ marginTop: 10 }} onClick={() => setF(DEFAULT_COLLECTION_FILTERS)}>Reset filters</button>
            </EmptyState>
          )}

          {groups.map((g) => (
            <section key={g.key} className="ra-day-group">
              <h3 className="ra-day">
                <span>{g.label}</span>
                <span className="ra-day-meta">{plural(g.orders.length, "collection")} · {fmtMoney(g.total)}</span>
              </h3>
              <div className="ra-orders">
                {g.orders.map((c) => {
                  const [label, tone] = COLLECTION_STATUS_META[c.status];
                  const canCancel = c.status === COLLECTION_STATUS.PENDING && c.local && !c.attempted;
                  return (
                    <article className="ra-card ra-order" key={c.key}>
                      <div className="ra-order-top">
                        <div className="ra-order-who">
                          <h3 className="ra-card-title">{c.retailerName}</h3>
                          <div className="ra-muted">{MODE_LABEL[c.mode] || c.mode}{c.reference ? " · " + c.reference : ""} · {fmtClock(c.capturedAt)}</div>
                        </div>
                        <div className="ra-order-amt">{fmtMoney(c.amount)}</div>
                        <span className={"ra-badge ra-badge--" + tone}>{label}</span>
                        <div className="ra-order-actions">
                          {canCancel && confirming !== c.key && (
                            <button className="ra-btn ra-btn--sm ra-btn--danger" aria-label={"Cancel collection from " + c.retailerName} onClick={() => setConfirming(c.key)}>Cancel</button>
                          )}
                          {c.status === COLLECTION_STATUS.INVALID && c.local && (
                            <button className="ra-btn ra-btn--sm ra-btn--danger" aria-label={"Discard collection from " + c.retailerName} onClick={() => onDiscard(c.clientCollectionId)}>Discard</button>
                          )}
                          {canIssueReceipt(c) && (
                            <button className="ra-btn ra-btn--sm" aria-label={"Receipt for " + c.retailerName} onClick={() => setReceiptFor(c)}>Receipt</button>
                          )}
                        </div>
                      </div>

                      {c.invoiceNumber && <div className="ra-muted" style={{ marginTop: 6 }}>Against invoice {c.invoiceNumber}</div>}
                      {c.handedOver && <div className="ra-muted">Cash handed over</div>}
                      {c.note && <div className="ra-muted" style={{ marginTop: 6 }}>Note: {c.note}</div>}
                      {c.status === COLLECTION_STATUS.REJECTED && <div className="ra-conflict">Rejected{c.rejectReason ? ": " + c.rejectReason : ""}</div>}
                      {c.status === COLLECTION_STATUS.INVALID && <div className="ra-conflict">{c.message}</div>}
                      {c.status === COLLECTION_STATUS.PENDING && c.attempted && (
                        <div className="ra-muted" style={{ marginTop: 6 }}>On its way to the office — if it's wrong, ask them to reject it.</div>
                      )}

                      {confirming === c.key && (
                        <div className="ra-confirm" role="group" aria-label="Confirm cancel collection">
                          <span>Cancel this collection? It will be removed from this phone and won't be sent.</span>
                          <div className="ra-confirm-actions">
                            <button className="ra-btn ra-btn--sm ra-btn--danger" onClick={async () => { await onCancel(c.clientCollectionId); setConfirming(null); }}>Yes, cancel collection</button>
                            <button className="ra-btn ra-btn--sm" onClick={() => setConfirming(null)}>Keep it</button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}

          <FieldPager variant="ra" page={Math.min(colPage, colPages)} totalPages={colPages} onChange={setColPage} label="Collections pages" />
        </section>
      </div>}

      {receiptFor && <ReceiptDialog collection={receiptFor} company={company} repName={repName} onClose={() => setReceiptFor(null)} />}
    </>
  );
}
