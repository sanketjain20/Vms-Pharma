import React, { useEffect, useState, useRef, useMemo } from "react";
import "../../Styles/Sales/SalesAddNew.css";
import { toast } from "react-toastify";
import SalesView from "./SalesView";
import { toastApiError } from "../../utils/toastMessage";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import CoinField from "../CommonComponent/CoinField";
import { calculateTcsPreview, partyHasPan } from "../../utils/taxPreview";
import { resolveWalkIn, MAX_NAME_LENGTH } from "../../utils/walkInCustomer";
import { toCustomLine, useCustomItemsAllowed } from "../../utils/customItems";
import CustomItemForm from "./CustomItemForm";
import LineGstCell, { useCanOverrideGst } from "./LineGstCell";
import LinePriceCell, { useCanChangePrice } from "./LinePriceCell";
import CreditLimitNotice from "./CreditLimitNotice";
import { useCreditCheck, creditProblem } from "../../utils/creditLimit";
import PaymentSplit from "../CommonComponent/PaymentSplit";
import {
  startPayments, fillLast, paymentsTotal, paymentsProblem, paymentPayload, billingModeOf, roundOffText, useRoundBillTotal,
} from "../../utils/salePayments";
import { VariantPicker } from "../CommonComponent/VariantWidgets";
import { groupCatalog, priceRange, variantAxes } from "../../utils/variants";
import { SerialPickerModal, SerialList } from "../CommonComponent/SerialWidgets";
import { tracksSerials } from "../../utils/serials";
import {
  computeTotals, toItemPayload, fetchApplicable, withScheme, removeScheme, freeText, round2, gstSplit, gstTag,
} from "../../utils/salesSchemes";
import { useBusinessProfile } from "../../utils/businessProfile";

/* ─────────────────────────────────────────
   PRODUCT AVATAR — deterministic color + initials, no image needed
───────────────────────────────────────── */
function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}
function productInitials(name) {
  const parts = String(name || "?").trim().split(/\s+/).slice(0, 2);
  const s = parts.map(p => p[0]).join("").toUpperCase();
  return s || "?";
}
function productHue(name) {
  return hashString(String(name || "")) % 360;
}

/* ─────────────────────────────────────────
   SEARCHABLE DROPDOWN  (san- styling)
───────────────────────────────────────── */
const Dropdown = ({ label, options, selectedId, onSelect, placeholder, error }) => {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState("");
  const ref                 = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectedOption = options.find(o => String(o.id) === String(selectedId));
  const displayValue   = open ? search : (selectedOption?.name ?? "");
  const filtered       = options.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggle = (e) => {
    e.stopPropagation();
    if (!open) setSearch("");
    setOpen(prev => !prev);
  };

  return (
    <div className="san-dd" ref={ref}>
      {label && <label>{label}</label>}
      <div
        className={`san-dd-field ${open ? "san-dd-open" : ""} ${error ? "san-dd-err" : ""}`}
        onClick={handleToggle}
      >
        <input
          type="text"
          value={displayValue}
          placeholder={placeholder}
          onChange={e => setSearch(e.target.value)}
          onClick={e => { e.stopPropagation(); if (!open) { setSearch(""); setOpen(true); } }}
          className="san-dd-input"
        />
        <svg
          className={`san-dd-chevron ${open ? "san-dd-chevron-up" : ""}`}
          width="11" height="11" viewBox="0 0 11 11" fill="none"
        >
          <path d="M2 4L5.5 7.5L9 4" stroke="currentColor" strokeWidth="1.4"
            strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {open && (
          <ul className="san-dd-list">
            {filtered.map(o => (
              <li
                key={o.id}
                className={String(o.id) === String(selectedId) ? "san-dd-selected" : ""}
                onMouseDown={e => {
                  e.preventDefault();
                  onSelect(o.id);
                  setOpen(false);
                  setSearch("");
                }}
              >
                {String(o.id) === String(selectedId) && (
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M1 4L3 6L7 2" stroke="currentColor" strokeWidth="1.4"
                      strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                {o.name}
              </li>
            ))}
            {filtered.length === 0 && <li className="san-dd-empty">No results</li>}
          </ul>
        )}
      </div>
      {error && <span className="san-err">{error}</span>}
    </div>
  );
};

/* ─────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────── */
const GST_RATES = [0, 5, 12, 18, 28];

const PAYMENT_TYPES = [
  { id: "PAID",    name: "Full payment",  sub: "Pay the net amount now" },
  { id: "PARTIAL", name: "Partial",       sub: "Pay part now, rest later" },
  { id: "CREDIT",  name: "Credit",        sub: "Pay later, on account" },
];

const PAYMENT_ICONS = {
  PAID:    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5l3 3 7-7"/></svg>,
  PARTIAL: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="8" cy="8" r="6.2"/><path d="M8 1.8A6.2 6.2 0 018 14.2" fill="currentColor" stroke="none"/></svg>,
  CREDIT:  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="6.2"/><path d="M8 4.5V8l2.6 1.6"/></svg>,
};

/* ─────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────── */
export default function SalesAddNew({ onClose, onSubmit }) {
  /* ── Flow step: "catalog" (pick products) → "checkout" (pay) ── */
  const [step, setStep] = useState("catalog");

  /* ── Data lists ── */
  const [productTypes, setProductTypes] = useState([]);
  const [allProducts, setAllProducts]   = useState([]);
  const [retailers, setRetailers]       = useState([]);
  const [batchesMap, setBatchesMap]     = useState({});   // productId -> [batches] (lazy-loaded)

  /* ── Catalog filters ── */
  const [search, setSearch]             = useState("");
  const [typeFilter, setTypeFilter]     = useState("");

  /* ── GST ── */
  const [taxMode, setTaxMode]     = useState("COMMON");   // COMMON | PRODUCT
  const [commonTax, setCommonTax] = useState("18");
  const [taxType, setTaxType]     = useState("PERCENT");  // PERCENT | FLAT — Product-wise mode only

  /* ── Cart / items ── */
  const [items, setItems]         = useState([]);
  const [editingIdx, setEditingIdx] = useState(null);

  /* ── Schemes: each line gets the best matching scheme suggested; the clerk can remove it (same as SalesAdd) ── */
  const lineKeyRef = useRef(0);
  // custom (run-time) items: only when the shop has them switched on (Settings → Billing)
  const customAllowed = useCustomItemsAllowed();
  const [customForm, setCustomForm] = useState(null); // { index: number|null } while the form is open
  const [serialFor, setSerialFor] = useState(null);   // Phase 6: { product } while its serial numbers are picked
  const itemsRef   = useRef([]);
  const [schemePending, setSchemePending] = useState(0);

  /* ── Right-panel: billing ── */
  const [selectedRetailer, setSelectedRetailer] = useState("");
  // walk-in customer typed on the bill (only used when no retailer is picked)
  const [customerName, setCustomerName]         = useState("");
  const [customerPhone, setCustomerPhone]       = useState("");
  const [discountInput, setDiscountInput]       = useState("");
  const [discountType, setDiscountType]         = useState("PERCENT");
  const [billingMode, setBillingMode]           = useState("CASH");
  const [creditPaymentType, setCreditPaymentType] = useState("PAID");
  // how the bill is paid: one row per mode (Rs 500 Cash + Rs 300 UPI); amountPaid is their total
  const [payments, setPayments]                 = useState(() => startPayments("PAID", 0));
  const amountPaid = paymentsTotal(payments);
  const roundBill = useRoundBillTotal();
  const [dueDate, setDueDate]                   = useState("");

  /* ── UI state ── */
  const [errors, setErrors]         = useState({});
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewUkey, setViewUkey]     = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [burstToken, setBurstToken] = useState(0);   // ticks up on a completed sale — see CoinField

  /* ── Retailer-TDS preview (see Utils/tcsPreview.js) — best-effort only,
     the backend is the source of truth at submit time. 206C(1H) TCS was
     withdrawn from 1 Apr 2025, so this is never added to the invoice; it's
     an estimate of what a retailer who has self-declared they deduct 194Q
     (Retailer.buyerDeductsTds194Q) will withhold when paying us. Stays "not
     enabled" silently if the current role lacks TCS View permission or any
     call fails; sale creation itself was never permission-gated, only this
     preview is. */
  const [tcsSetting, setTcsSetting]             = useState(null);
  const [retailerTaxInfo, setRetailerTaxInfo]   = useState(null);
  const [retailerTurnover, setRetailerTurnover] = useState(null);

  /* ══════════ FETCH: retailers, product types, all products ══════════
     Stock and sellingPrice now come directly from the GetAllProduct API.
     No separate inventory API call needed. Selling price is fully managed
     via product configuration — there is no manual/adhoc price entry here.
  ══════════════════════════════════════════════════════════════════════ */
  useEffect(() => {
    apiClient(`${API_BASE_URL}/api/Retailer/Dropdown`)
      .then(r => r.json())
      .then(json => setRetailers(
        (json?.data ?? []).map(r => ({ id: r.id, uKey: r.uKey, name: `${r.shopName} · ${r.ownerName}` }))
      ))
      .catch(() => {});

    apiClient(`${API_BASE_URL}/api/TcsSetting/Get`)
      .then(r => r.json())
      .then(json => setTcsSetting(json?.status === 200 ? json.data : null))
      .catch(() => setTcsSetting(null));

    apiClient(`${API_BASE_URL}/api/ProductType/GetAllProductType`)
      .then(r => r.json())
      .then(json => setProductTypes(json?.data?.productTypes ?? []))
      .catch(() => {});

    apiClient(`${API_BASE_URL}/api/Product/GetAllProduct`)
      .then(r => r.json())
      .then((json) => {
        const d    = json?.data;
        // Support both array and { products: [...] } shapes
        const list = Array.isArray(d)
          ? d
          : Array.isArray(d?.products)
          ? d.products
          : typeof d === "object"
          ? Object.values(d).find(v => Array.isArray(v)) ?? []
          : [];
        setAllProducts(list);
      })
      .catch(() => {})
      .finally(() => setInitialLoading(false));
  }, []);

  /* ── FETCH SELECTED RETAILER'S PAN/GSTIN + FY TURNOVER, for the TCS preview ── */
  useEffect(() => {
    setRetailerTaxInfo(null);
    setRetailerTurnover(null);
    const retailer = retailers.find(r => String(r.id) === String(selectedRetailer));
    if (!retailer?.uKey || !tcsSetting?.enabled) return;

    apiClient(`${API_BASE_URL}/api/Retailer/Get/${retailer.uKey}`)
      .then(r => r.json())
      .then(json => setRetailerTaxInfo(json?.status === 200 ? json.data : null))
      .catch(() => setRetailerTaxInfo(null));

    apiClient(`${API_BASE_URL}/api/TcsSetting/GetPartyTurnover/${retailer.uKey}`)
      .then(r => r.json())
      .then(json => setRetailerTurnover(json?.status === 200 ? json.data : null))
      .catch(() => setRetailerTurnover(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRetailer, tcsSetting?.enabled]);

  /* ── Lazy batch fetch (only needed when fine-tuning a cart line) ── */
  const ensureBatches = (productId) => {
    if (batchesMap[productId]) return;
    apiClient(`${API_BASE_URL}/api/Sales/GetAvailableBatches/${productId}`)
      .then(r => r.json())
      .then(json => setBatchesMap(prev => ({ ...prev, [productId]: json?.status === 200 ? json.data ?? [] : [] })))
      .catch(() => setBatchesMap(prev => ({ ...prev, [productId]: [] })));
  };

  /* ══════════ CATALOG: filtered list ══════════ */
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allProducts.filter(p => {
      if (typeFilter && String(p.productTypeId ?? p.typeId ?? "") !== String(typeFilter)) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allProducts, search, typeFilter]);

  const cartQtyFor = (productId) => items.find(i => i.productId === productId)?.quantity ?? 0;

  /**
   * Selling price always comes from the product's own configuration
   * (sellingPrice field from the product API). There is no manual /
   * adhoc price override — if a product has no configured price it
   * simply cannot be added to a sale until it's set up in Products.
   */
  const priceFor = (productId) => {
    const product = allProducts.find(p => p.id === productId);
    return (product?.sellingPrice > 0) ? product.sellingPrice : null;
  };

  /**
   * Stock comes directly from the product API `stock` field.
   */
  const stockFor = (productId) => {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return null;
    // no stock row in this godown = nothing to sell (a size/colour never bought must not be addable)
    return product.stock ?? 0;
  };

  /* ══════════ SCHEME SUGGESTION ══════════
     Asks the server which scheme fits a line and attaches it. Runs after the line is already on screen, so changing
     the cart never waits on it; a result is dropped if the line was changed or removed in the meantime. The server
     checks the scheme again on save, so a missed suggestion is harmless. Same flow as SalesAdd. */
  const suggestScheme = async (line, retailerId) => {
    if (line.custom) return; // a custom item gets no scheme
    setSchemePending(n => n + 1);
    const applicable = await fetchApplicable({
      productId: line.productId, retailerId, quantity: line.quantity, unitPrice: line.sellingPrice,
    });
    setSchemePending(n => n - 1);
    setItems(prev => prev.map(l =>
      l.lineKey === line.lineKey && !l.schemeOff && l.quantity === line.quantity && l.sellingPrice === line.sellingPrice
        ? withScheme(l, applicable)
        : l
    ));
  };

  useEffect(() => { itemsRef.current = items; }, [items]);

  /* A different retailer can mean a different scheme (retailer-specific ones), so look again for every line. */
  useEffect(() => {
    itemsRef.current.filter(l => !l.schemeOff).forEach(l => suggestScheme(l, selectedRetailer || null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRetailer]);

  const canOverrideGst = useCanOverrideGst();
  const canChangePrice = useCanChangePrice();
  const [creditReason, setCreditReason] = useState(""); // why this bill may go over the retailer's credit limit

  /* Replaces line i and, when its quantity or price changed, asks for a scheme for it again. */
  const updateLine = (i, patch) => {
    const before = items[i];
    const line = { ...before, ...patch };
    setItems(prev => prev.map((l, idx) => (idx === i ? line : l)));
    const changed = line.quantity !== before.quantity || line.sellingPrice !== before.sellingPrice;
    if (changed && !line.schemeOff) suggestScheme(line, selectedRetailer || null);
  };

  const dropScheme  = (i) => setItems(prev => prev.map((l, idx) => (idx === i ? removeScheme(l) : l)));
  const retryScheme = (i) => {
    const l = { ...items[i], schemeOff: false };
    setItems(prev => prev.map((x, idx) => (idx === i ? l : x)));
    suggestScheme(l, selectedRetailer || null);
  };

  /* ══════════ ADD / ADJUST CART FROM CATALOG ══════════ */
  const adjustCart = (product, delta) => {
    if (tracksSerials(product)) { setSerialFor({ product }); return; } // Phase 6: sold by picking its units
    const stock = stockFor(product.id);
    if (stock !== null && stock <= 0) {
      toast.error("This product is out of stock");
      return;
    }

    const price = priceFor(product.id);
    if (!price || price <= 0) {
      toast.error("Selling price is not configured for this product");
      return;
    }

    const idx = items.findIndex(i => i.productId === product.id);

    if (idx === -1) {
      if (delta <= 0) return;
      if (stock !== null && delta > stock) {
        toast.error("Exceeds available stock");
        return;
      }
      const line = {
        lineKey:      ++lineKeyRef.current,
        schemeOff:    false,
        schemeId: null, schemeName: "", schemeDescription: "", freeQuantity: 0, schemeDiscount: 0,
        productId:    product.id,
        productName:  product.name,
        quantity:     delta,
        sellingPrice: price,
        gstRate:      product.gstRate ?? parseFloat(commonTax || 0),
        productGstRate: product.gstRate ?? null, // product-wise GST; none = the common rate (flagged)
        priceIncludesGst: !!product.priceIncludesGst,
        taxAmount:    0,
        batchId:      null,
        batchNumber:  "AUTO",
        expiryDate:   "",
      };
      setItems(prev => [...prev, line]);
      suggestScheme(line, selectedRetailer || null);
      return;
    }

    const newQty = items[idx].quantity + delta;
    if (newQty <= 0) { deleteItem(idx); return; }
    if (stock !== null && newQty > stock) {
      toast.error("Exceeds available stock");
      return;
    }
    updateLine(idx, { quantity: newQty });
  };

  /* ══════════ BARCODE SCAN-TO-SELECT ══════════
     A USB/Bluetooth barcode scanner behaves like a keyboard — it types the
     code then fires Enter, which is all the scan input below listens for.
     Matches against the already-loaded catalog first (instant, the normal
     case); falls back to a live lookup only for a product added since this
     page loaded, so a fresh scan still works without a full page refresh.
     Scanning only SELECTS the product — filters the catalog down to it and
     picks its type chip — it deliberately does not add it to the cart or
     choose a quantity. The user adds it and sets quantity themselves via
     the card's Add to cart / +/- controls, same as picking it by hand. */
  const handleBarcodeScan = async (rawCode) => {
    const code = rawCode.trim();
    if (!code) return;

    const localMatch = allProducts.find(p => p.barcode === code);
    if (localMatch) {
      setTypeFilter(localMatch.productTypeId ?? localMatch.typeId ?? "");
      setSearch(localMatch.name);
      toast.success(`${localMatch.name} selected`);
      return;
    }

    try {
      const res  = await apiClient(`${API_BASE_URL}/api/Product/GetProductByBarcode/${encodeURIComponent(code)}`);
      const json = await res.json();
      if (json.status === 200 && json.data) {
        setAllProducts(prev => prev.some(p => p.id === json.data.id) ? prev : [...prev, json.data]);
        setTypeFilter(json.data.productTypeId ?? json.data.typeId ?? "");
        setSearch(json.data.name);
        toast.success(`${json.data.name} selected`);
      } else {
        toast.error(`No product found for barcode "${code}"`);
      }
    } catch {
      toast.error("Barcode lookup failed");
    }
  };

  /* ══════════ CART ROW HELPERS (checkout step) ══════════ */
  /* Phase 6 — the serial numbers picked for a product: they make its cart line (none left removes it) */
  const saveSerials = (product, serials) => {
    setSerialFor(null);
    const idx = items.findIndex(i => i.productId === product.id);
    if (serials.length === 0) { if (idx !== -1) deleteItem(idx); return; }
    const price = priceFor(product.id);
    if (!price || price <= 0) { toast.error("Selling price is not configured for this product"); return; }
    if (idx !== -1) { updateLine(idx, { quantity: serials.length, serials }); return; }
    setItems(prev => [...prev, {
      lineKey: ++lineKeyRef.current, schemeOff: true, // no scheme suggestion: a free unit would need a serial of its own
      schemeId: null, schemeName: "", schemeDescription: "", freeQuantity: 0, schemeDiscount: 0,
      productId: product.id, productName: product.name, quantity: serials.length, sellingPrice: price,
      gstRate: product.gstRate ?? parseFloat(commonTax || 0), productGstRate: product.gstRate ?? null,
      priceIncludesGst: !!product.priceIncludesGst,
      taxAmount: 0, batchId: null, batchNumber: "AUTO", expiryDate: "", serials,
    }]);
  };

  const increaseQty = (i) => {
    if (items[i].serials) { setSerialFor({ product: allProducts.find(p => p.id === items[i].productId) || { id: items[i].productId, name: items[i].productName } }); return; }
    const it = items[i];
    const stock = stockFor(it.productId);
    if (stock !== null && it.quantity + 1 > stock) { toast.error("Exceeds available stock"); return; }
    updateLine(i, { quantity: it.quantity + 1 });
  };
  const decreaseQty = (i) => {
    if (items[i].serials) { setSerialFor({ product: allProducts.find(p => p.id === items[i].productId) || { id: items[i].productId, name: items[i].productName } }); return; }
    if (items[i].quantity > 1) updateLine(i, { quantity: items[i].quantity - 1 });
  };
  const deleteItem  = (i) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const openEdit  = (i) => {
    if (items[i].custom) { setCustomForm({ index: i }); return; }
    ensureBatches(items[i].productId); setEditingIdx(i);
  };

  /* A custom item: typed in at billing time, not a product in stock (see CustomItemForm). */
  const saveCustomItem = (checked) => {
    const index = customForm?.index ?? null;
    const line = toCustomLine(checked, index !== null ? items[index].lineKey : ++lineKeyRef.current);
    setItems(prev => (index !== null ? prev.map((l, i) => (i === index ? line : l)) : [...prev, line]));
    setCustomForm(null);
  };
  const closeEdit = () => setEditingIdx(null);

  const saveEdit = (patch) => {
    updateLine(editingIdx, patch);
    closeEdit();
  };

  /* ══════════ COMPUTED TOTALS ══════════
     One calculation (utils/salesSchemes.js) shared with SalesAdd that mirrors the server: scheme discount first, then
     the invoice discount on what is left, GST on the discounted value. In Product-wise mode a line's tax on its full
     value is worked out from its own GST % (or flat ₹); in Common mode every line takes the common %. */
  const taxLines = items.map(i => {
    const rate = parseFloat(i.gstRate || 0);
    return { ...i, taxAmount: taxType === "PERCENT" ? (i.sellingPrice * i.quantity * rate) / 100 : rate };
  });
  const totals = computeTotals({
    lines: taxLines,
    manualDiscount: discountInput,
    discountType,
    commonRate: taxMode === "COMMON" ? parseFloat(commonTax || 0) : null,
    roundOff: roundBill,
  });
  const subTotal  = totals.gross;
  const netAmount = totals.net;

  // Retailer-TDS estimate only ever applies against a retailer who has
  // self-declared they deduct 194Q (SalesCommonRepository requires
  // buyerDeductsTds194Q === true), matching the backend condition exactly.
  // This is never added to the invoice — see the state comment above.
  const retailerTdsPreview = (selectedRetailer && tcsSetting?.enabled && retailerTaxInfo?.buyerDeductsTds194Q)
    ? calculateTcsPreview({
        cumulativeBefore: retailerTurnover?.cumulativeConsideration || 0,
        consideration: netAmount,
        threshold: tcsSetting.thresholdAmount,
        ratePercent: tcsSetting.ratePercent,
        ratePercentWithoutPan: tcsSetting.ratePercentWithoutPan,
        hasPan: partyHasPan(retailerTaxInfo?.pan, retailerTaxInfo?.gstNumber),
      })
    : { taxable: 0, rate: 0, tcs: 0 };
  const payableAmount = netAmount;
  const credit = useCreditCheck(selectedRetailer || null, payableAmount - amountPaid);

  /* ── Paid in full: the payments follow the bill (the last one takes what the others leave); credit: none ── */
  useEffect(() => {
    if (creditPaymentType === "PAID") setPayments(prev => (prev.length ? fillLast(prev, payableAmount) : startPayments("PAID", payableAmount, billingMode)));
    if (creditPaymentType === "CREDIT") setPayments([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payableAmount, creditPaymentType]);
  const choosePaymentType = (id) => {
    setCreditPaymentType(id);
    setPayments(startPayments(id, payableAmount, billingMode));
  };

  const resetAll = () => {
    setItems([]);
    setCommonTax("18"); setTaxMode("COMMON"); setTaxType("PERCENT");
    setDiscountInput(""); setDiscountType("PERCENT");
    setSelectedRetailer(""); setBillingMode("CASH");
    setCustomerName(""); setCustomerPhone("");
    setCreditPaymentType("PAID"); setPayments(startPayments("PAID", 0)); setDueDate(""); setCreditReason("");
    setErrors({}); setSearch(""); setTypeFilter("");
    setStep("catalog");
  };

  const goToCheckout = () => {
    if (items.length === 0) {
      toast.error("Add at least one product first");
      return;
    }
    setStep("checkout");
  };

  /* ══════════ SUBMIT ══════════ */
  const submitSales = async () => {
    if (submitting) return; // guard against double-submit while a request is already in flight

    const tempErrors = {};
    if (items.length === 0)  tempErrors.items = "Add at least one item";
    if (discountInput < 0)   tempErrors.discountInput = "Discount cannot be negative";
    if (totals.discountTooLarge) tempErrors.discountInput = "Discount cannot be more than the value of the goods after schemes";

    // the payments must cover the bill (paid in full), stay under it (part payment), or be none (credit)
    const payProblem = paymentsProblem(creditPaymentType, payableAmount, payments);
    if (payProblem) tempErrors.amountPaid = payProblem;
    if ((creditPaymentType === "CREDIT" || creditPaymentType === "PARTIAL") && !dueDate)
      tempErrors.dueDate = "Due date is required";
    const walkIn = resolveWalkIn({ retailerId: selectedRetailer, name: customerName, phone: customerPhone });
    Object.assign(tempErrors, walkIn.errors);
    const creditIssue = creditProblem(credit, creditReason); // the server refuses it the same way
    if (creditIssue) tempErrors.credit = creditIssue;

    setErrors(tempErrors);
    if (Object.keys(tempErrors).length > 0) {
      toast.error(Object.values(tempErrors)[0]);
      return;
    }

    if (schemePending > 0) {
      toast.info("Still checking schemes — try again in a moment");
      return;
    }

    const payload = {
      billingMode: creditPaymentType === "CREDIT" ? billingMode : billingModeOf(payments),
      totalDiscount: totals.manualDiscount, // what the clerk gave; the server adds the schemes' discount itself
      amountPaid,
      payments: paymentPayload(payments),
      remainingAmount: round2(payableAmount - amountPaid),
      ...(credit?.over ? { creditLimitReason: creditReason.trim() } : {}),
      retailerId: selectedRetailer ? parseInt(selectedRetailer) : null,
      customerName: walkIn.customerName,
      customerPhone: walkIn.customerPhone,
      paymentType: creditPaymentType,
      dueDate: dueDate || null,
      items: toItemPayload(items, totals),
    };

    setSubmitting(true);
    try {
      const res  = await apiClient(`${API_BASE_URL}/api/Sales/AddSales`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !(data?.status === 200 || data?.success)) {
        toastApiError(data, "Failed to add sale");
        return;
      }
      toast.success(data?.message || "Sale added successfully");
      setBurstToken(t => t + 1);
      if (onSubmit) onSubmit();
      setViewUkey(data.data?.uKey || null);
      setIsViewOpen(true);
      resetAll();
    } catch (err) {
      console.error(err);
      toast.error(err?.message || "Failed to add sale");
    } finally {
      setSubmitting(false);
    }
  };

  /* ══════════ RENDER ══════════ */
  return (
    <div className="san-page">
      {initialLoading ? (
        <div className="san-screen-loading">
          <div className="san-loader"><div/><div/><div/><div/></div>
        </div>
      ) : (
      <>
      <div className={`san-content ${step === "checkout" ? "san-content-wide" : ""}`}>

        <div className="san-page-header">
          <div className="san-header-top">
            <div>
              <div className="san-badge"><span className="san-badge-dot" />New transaction</div>
              <h1 className="san-page-title">Quick Sale</h1>
            </div>
            <div className="san-steps">
              <div className={`san-step ${step === "catalog" ? "san-step-active" : "san-step-done"}`}>
                <span className="san-step-num">
                  {step === "checkout"
                    ? <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.2 2.2L8 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    : "1"}
                </span> Products
              </div>
              <div className="san-step-line" />
              <div className={`san-step ${step === "checkout" ? "san-step-active" : ""}`}>
                <span className="san-step-num">2</span> Payment
              </div>
            </div>
          </div>
        </div>

        {step === "catalog" && <CoinField burstToken={burstToken} />}

        {step === "catalog" ? (
          <CatalogStep
            productTypes={productTypes}
            filteredProducts={filteredProducts}
            search={search} setSearch={setSearch}
            typeFilter={typeFilter} setTypeFilter={setTypeFilter}
            allProducts={allProducts}
            cartQtyFor={cartQtyFor}
            priceFor={priceFor}
            stockFor={stockFor}
            adjustCart={adjustCart}
            onScan={handleBarcodeScan}
            items={items}
            subTotal={subTotal}
            onProceed={goToCheckout}
          />
        ) : (
          <CheckoutStep
            items={items}
            canOverrideGst={canOverrideGst}
            patchLine={updateLine}
            increaseQty={increaseQty}
            stockFor={stockFor}
            unitFor={(id) => allProducts.find(p => p.id === id)?.unit || ""}
            decreaseQty={decreaseQty}
            deleteItem={deleteItem}
            openEdit={openEdit}
            onAddCustom={customAllowed ? () => setCustomForm({ index: null }) : null}
            dropScheme={dropScheme}
            retryScheme={retryScheme}
            taxMode={taxMode} setTaxMode={setTaxMode}
            commonTax={commonTax} setCommonTax={setCommonTax}
            taxType={taxType} setTaxType={setTaxType}
            discountInput={discountInput} setDiscountInput={setDiscountInput}
            discountType={discountType} setDiscountType={setDiscountType}
            totals={totals}
            retailerTdsPreview={retailerTdsPreview}
            tcsSetting={tcsSetting}
            payableAmount={payableAmount}
            errors={errors}
            retailers={retailers}
            selectedRetailer={selectedRetailer} setSelectedRetailer={setSelectedRetailer}
            customerName={customerName} setCustomerName={setCustomerName}
            customerPhone={customerPhone} setCustomerPhone={setCustomerPhone}
            billingMode={billingMode} setBillingMode={setBillingMode}
            creditPaymentType={creditPaymentType} setCreditPaymentType={setCreditPaymentType}
            amountPaid={amountPaid} payments={payments} setPayments={setPayments}
            choosePaymentType={choosePaymentType}
            dueDate={dueDate} setDueDate={setDueDate}
            canChangePrice={canChangePrice} productOf={(id) => allProducts.find((p) => p.id === id)}
            credit={credit} creditReason={creditReason} setCreditReason={setCreditReason}
            onBack={() => setStep("catalog")}
            onSubmit={submitSales}
            submitting={submitting}
          />
        )}

      </div>

      {/* ── Sticky checkout bar while browsing the catalog ── */}
      {step === "catalog" && (
        <div className="san-cart-bar">
          <div className="san-cart-bar-inner">
            <div className="san-cart-bar-info">
              {items.length === 0 ? (
                <>
                  <span className="san-cart-bar-count san-cart-bar-empty">Cart is empty</span>
                  <span className="san-cart-bar-hint">Add products above to get started</span>
                </>
              ) : (
                <>
                  <span className="san-cart-bar-amount">₹{subTotal.toFixed(2)}</span>
                  <span className="san-cart-bar-count">
                    {items.reduce((s, i) => s + i.quantity, 0)} unit{items.reduce((s, i) => s + i.quantity, 0) !== 1 ? "s" : ""} · {items.length} item{items.length !== 1 ? "s" : ""}
                  </span>
                </>
              )}
            </div>
            {customAllowed && (
              <button type="button" className="san-btn-ghost" onClick={() => setCustomForm({ index: null })}
                title="Bill something that is not a product in stock">
                + Custom item
              </button>
            )}
            <button
              className="san-btn-checkout"
              onClick={goToCheckout}
              disabled={items.length === 0}
            >
              Proceed to checkout
              <svg width="12" height="12" viewBox="0 0 11 11" fill="none">
                <path d="M2 5.5h7M6 2l3.5 3.5L6 9" stroke="currentColor" strokeWidth="1.6"
                  strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Cart line edit modal ── */}
      {editingIdx !== null && (
        <CartItemEditModal
          item={items[editingIdx]}
          batches={batchesMap[items[editingIdx].productId] || []}
          taxMode={taxMode}
          taxType={taxType}
          stock={stockFor(items[editingIdx].productId)}
          onSave={saveEdit}
          onCancel={closeEdit}
        />
      )}

      {serialFor && (
        <SerialPickerModal
          product={serialFor.product}
          initial={items.find(i => i.productId === serialFor.product.id)?.serials || []}
          onDone={(serials) => saveSerials(serialFor.product, serials)}
          onClose={() => setSerialFor(null)}
        />
      )}

      {customForm && (
        <CustomItemForm
          line={customForm.index !== null ? items[customForm.index] : null}
          onSave={saveCustomItem}
          onCancel={() => setCustomForm(null)}
        />
      )}

      {isViewOpen && (
        <SalesView
          uKey={viewUkey}
          onClose={() => { setIsViewOpen(false); setViewUkey(null); }}
        />
      )}
      </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   STEP 1 — CATALOG  (Amazon / Flipkart product-grid reference)
───────────────────────────────────────── */
function CatalogStep({
  productTypes, filteredProducts, search, setSearch, typeFilter, setTypeFilter,
  allProducts, cartQtyFor, priceFor, stockFor, adjustCart, onScan,
}) {
  const [scanValue, setScanValue] = useState("");
  const scanRef = useRef(null);
  // a style's variants share one card; its size/colour picker reads them fresh from the full list (Phase 5)
  const [pickerStyleId, setPickerStyleId] = useState(null);
  const entries = useMemo(() => groupCatalog(filteredProducts), [filteredProducts]);
  const pickerStyle = pickerStyleId === null ? null
    : groupCatalog(allProducts).find(e => e.kind === "style" && e.styleId === pickerStyleId) || null;

  const submitScan = (e) => {
    e.preventDefault();
    const code = scanValue;
    setScanValue("");
    onScan(code);
    scanRef.current?.focus();
  };

  return (
    <div className="san-catalog">

      <div className="san-catalog-toolbar">
        <form className="san-search-bar" onSubmit={submitScan} title="Scan a barcode — selects the product; choose the quantity yourself">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3v10M5 3v10M7.5 3v10M10 3v10M12.5 3v10M14 3v10" />
          </svg>
          <input
            ref={scanRef}
            type="text"
            placeholder="Scan barcode…"
            value={scanValue}
            onChange={e => setScanValue(e.target.value)}
            autoComplete="off"
          />
        </form>

        <div className="san-search-bar">
          <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            placeholder="Search products by name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="san-search-clear" onClick={() => setSearch("")}>✕</button>
          )}
        </div>

        <div className="san-filter-chips">
          <button
            className={`san-chip ${!typeFilter ? "san-chip-active" : ""}`}
            onClick={() => setTypeFilter("")}
          >All</button>
          {productTypes.map(t => (
            <button
              key={t.id}
              className={`san-chip ${String(typeFilter) === String(t.id) ? "san-chip-active" : ""}`}
              onClick={() => setTypeFilter(t.id)}
            >{t.name}</button>
          ))}
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <div className="san-catalog-empty">
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
            <circle cx="15" cy="15" r="13" stroke="rgba(59,130,246,0.2)" strokeWidth="1.5"/>
            <path d="M9.5 15h11M15 9.5v11" stroke="rgba(59,130,246,0.25)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          No products match your search
        </div>
      ) : (
        <div className="san-catalog-grid">
          {entries.map(entry => {
            if (entry.kind === "style") {
              return (
                <StyleCard key={`style-${entry.styleId}`} entry={entry} cartQtyFor={cartQtyFor} priceFor={priceFor}
                  stockFor={stockFor} onOpen={() => setPickerStyleId(entry.styleId)} />
              );
            }
            const p          = entry.product;
            const price      = priceFor(p.id);
            const stock      = stockFor(p.id);
            const inCart     = cartQtyFor(p.id);
            const outOfStock = stock !== null && stock <= 0;
            const lowStock   = stock !== null && stock > 0 && stock <= 10;
            const noPrice    = !outOfStock && (!price || price <= 0);
            const isBlocked  = outOfStock || noPrice;
            const hue        = productHue(p.name);

            return (
              <div
                key={p.id}
                className={`san-pcard ${inCart > 0 ? "san-pcard-in-cart" : ""} ${outOfStock ? "san-pcard-out-of-stock" : ""}`}
              >
                <div className="san-pcard-media" style={{ "--hue": hue }}>
                  <span className="san-pcard-initials">{productInitials(p.name)}</span>
                  {stock !== null && (
                    <span className={`san-stock-badge ${outOfStock ? "san-stock-out" : lowStock ? "san-stock-low" : "san-stock-ok"}`}>
                      {outOfStock ? "Out of stock" : `${stock} left`}
                    </span>
                  )}
                </div>

                <div className="san-pcard-body">
                  <span className="san-pcard-name">{p.name}</span>
                  {[p.variantSize, p.variantColor, p.unit].filter(Boolean).length > 0 && (
                    <span className="san-pcard-meta" data-testid="card-meta">{[p.variantSize, p.variantColor, p.unit].filter(Boolean).join(" · ")}</span>
                  )}

                  {price ? (
                    <span className="san-pcard-price">₹{price}
                      <span className="san-pcard-gst" data-testid="card-gst">{gstTag(p.gstRate, p.priceIncludesGst)}</span>
                    </span>
                  ) : (
                    <span className="san-pcard-noprice">Price not configured</span>
                  )}

                  <div className="san-pcard-action">
                    {outOfStock ? (
                      <span className="san-pcard-disabled-note">Add stock via Purchase</span>
                    ) : noPrice ? (
                      <span className="san-pcard-disabled-note">Set price in Products</span>
                    ) : inCart > 0 ? (
                      <>
                        <div className="san-qty-ctrl san-qty-ctrl-tile">
                          <button onClick={() => adjustCart(p, -1)} aria-label="Decrease quantity">−</button>
                          <span>{inCart}</span>
                          {/* every unit in stock is already in the cart: no more can be added */}
                          <button onClick={() => adjustCart(p, 1)} aria-label="Increase quantity"
                            disabled={stock !== null && inCart >= stock}>+</button>
                        </div>
                        {stock !== null && inCart >= stock && (
                          <span className="san-pcard-disabled-note" data-testid="card-max">All {stock} in cart</span>
                        )}
                      </>
                    ) : (
                      <button
                        className="san-pcard-add"
                        disabled={isBlocked}
                        onClick={() => adjustCart(p, 1)}
                      >
                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                          <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                        </svg>
                        Add to cart
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pickerStyle && (
        <VariantPicker style={pickerStyle} qtyFor={cartQtyFor} stockFor={stockFor} priceFor={priceFor}
          onAdjust={adjustCart} onClose={() => setPickerStyleId(null)} />
      )}
    </div>
  );
}

/* One card for a style in sizes/colours (Phase 5): its price range and stock over every variant; "Choose size" opens
   the size × colour picker, where each variant is added like any product. */
function StyleCard({ entry, cartQtyFor, priceFor, stockFor, onOpen }) {
  const { sizes, colors } = variantAxes(entry.variants);
  const stocks   = entry.variants.map(v => stockFor(v.id)).filter(s => s !== null);
  const stock    = stocks.length ? stocks.reduce((a, b) => a + b, 0) : null;
  const inCart   = entry.variants.reduce((n, v) => n + cartQtyFor(v.id), 0);
  const price    = priceRange(entry.variants.map(v => priceFor(v.id)));
  const outOfStock = stock !== null && stock <= 0;
  return (
    <div className={`san-pcard ${inCart > 0 ? "san-pcard-in-cart" : ""} ${outOfStock ? "san-pcard-out-of-stock" : ""}`} data-testid="style-card">
      <div className="san-pcard-media" style={{ "--hue": productHue(entry.name) }}>
        <span className="san-pcard-initials">{productInitials(entry.name)}</span>
        {stock !== null && (
          <span className={`san-stock-badge ${outOfStock ? "san-stock-out" : stock <= 10 ? "san-stock-low" : "san-stock-ok"}`}>
            {outOfStock ? "Out of stock" : `${stock} left`}
          </span>
        )}
      </div>
      <div className="san-pcard-body">
        <span className="san-pcard-name">{entry.name}</span>
        <span className="vgx-meta">
          {[sizes.length ? `${sizes.length} size${sizes.length === 1 ? "" : "s"}` : "", colors.length ? `${colors.length} colour${colors.length === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ")}
        </span>
        {price ? <span className="san-pcard-price">{price}</span> : <span className="san-pcard-noprice">Price not configured</span>}
        <div className="san-pcard-action">
          <button className="san-pcard-add" onClick={onOpen} disabled={outOfStock}>
            {inCart > 0 ? `${inCart} in cart · change` : "Choose size"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   STEP 2 — CHECKOUT  (Apple Store checkout reference)
───────────────────────────────────────── */
function CheckoutStep({
  items, canOverrideGst = false, patchLine = () => {}, stockFor = () => null, unitFor = () => "", increaseQty, decreaseQty, deleteItem, openEdit, onAddCustom, dropScheme, retryScheme,
  taxMode, setTaxMode, commonTax, setCommonTax, taxType, setTaxType,
  discountInput, setDiscountInput, discountType, setDiscountType,
  totals, retailerTdsPreview, tcsSetting, payableAmount, errors,
  retailers, selectedRetailer, setSelectedRetailer,
  customerName, setCustomerName, customerPhone, setCustomerPhone,
  billingMode, setBillingMode,
  creditPaymentType, setCreditPaymentType,
  amountPaid, payments = [], setPayments = () => {}, choosePaymentType, dueDate, setDueDate,
  canChangePrice = false, productOf = () => undefined, credit = null, creditReason = "", setCreditReason = () => {},
  onBack, onSubmit, submitting,
}) {
  const { trackExpiry } = useBusinessProfile(); // no expiry anywhere when the shop doesn't track it
  const units = items.reduce((n, it) => n + (parseInt(it.quantity, 10) || 0), 0);
  return (
    <>
      {/* ── Back button ── */}
      <button className="san-back-link" onClick={onBack} disabled={submitting}>
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M9 5.5H2M5 1.5L1 5.5l4 4" stroke="currentColor" strokeWidth="1.6"
            strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Back to products
      </button>

      {/* ── Full-panel overlay shown while the sale is being submitted ── */}
      <fieldset
        disabled={submitting}
        className={`san-checkout-fieldset ${submitting ? "san-checkout-submitting" : ""}`}
      >
      {/* Billing layout: the items as a table on the left (about three quarters of the width), with the GST mode
          and the bill discount under it; the total, its breakdown, the customer and the payment on the right. */}
      <div className="san-layout san-layout-bill">

        <div className="san-block san-bill-main">
          <div className="san-block-header">
            <div className="san-block-title">Items</div>
            <span className="san-item-count">{items.length} item{items.length !== 1 ? "s" : ""} · Qty {units}</span>
            {onAddCustom && (
              <button type="button" className="san-link-btn" style={{ fontSize: 12 }} onClick={onAddCustom} title="Bill something that is not a product in stock">
                + Custom item
              </button>
            )}
          </div>
          <div className="san-block-body san-bill-main-body">

            <div className="san-bill-table-wrap">
              <table className="san-bill-table" data-testid="bill-table">
                <thead>
                  <tr>
                    <th className="san-bt-num">#</th>
                    <th className="san-bt-item">Item name</th>
                    <th className="san-bt-qty">Qty</th>
                    <th>Unit</th>
                    <th className="san-bt-money">Price (₹)</th>
                    <th className="san-bt-money">GST</th>
                    <th className="san-bt-money">Disc (₹)</th>
                    <th className="san-bt-money">Amount (₹)</th>
                    <th className="san-bt-actions" aria-label="Actions"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 && (
                    <tr><td colSpan={9} className="san-bt-empty">No items yet — go back to products to add some.</td></tr>
                  )}
                  {items.map((item, idx) => {
                    // per line: value before GST (after any scheme) and its GST — the same figures as SalesAdd's line table
                    const row = totals.lines[idx] || { gross: 0, post: 0, rate: 0 };
                    const lineGst = (row.rawPost ?? row.post) * row.rate;
                    return (
                      <tr key={item.lineKey ?? idx} className="san-bt-row" data-testid="sale-line">
                        <td className="san-bt-num">{idx + 1}</td>
                        <td className="san-bt-item">
                          <span className="san-item-name">{item.productName}</span>
                          <SerialList serials={item.serials} />
                          <span className="san-item-unit">
                            {item.custom && <span data-testid="line-custom">Custom item{item.hsnCode ? ` · HSN ${item.hsnCode}` : ""}</span>}
                            {item.freeQuantity > 0 && <> <span className="san-item-free">{freeText(item)}</span></>}
                            {item.batchNumber && item.batchNumber !== "AUTO" && (
                              <> <span className="san-batch-tag">Batch {item.batchNumber}</span></>
                            )}
                            {trackExpiry && item.expiryDate && <> · Exp {item.expiryDate}</>}
                          </span>
                          {item.schemeId && (
                            <span className="san-item-scheme" data-testid="line-scheme">
                              Scheme: {item.schemeName}{item.schemeDiscount > 0 && ` · −₹${item.schemeDiscount.toFixed(2)}`}
                              {" "}<button type="button" className="san-link-btn" onClick={() => dropScheme(idx)}>Remove</button>
                            </span>
                          )}
                          {!item.schemeId && item.schemeOff && !item.custom && (
                            <span className="san-item-scheme">
                              No scheme <button type="button" className="san-link-btn" onClick={() => retryScheme(idx)}>Apply scheme</button>
                            </span>
                          )}
                          <LineGstCell line={item} row={row} hideRate canOverride={canOverrideGst} onChange={(p) => patchLine(idx, p)} />
                        </td>
                        <td className="san-bt-qty">
                          <div className="san-qty-ctrl">
                            <button onClick={() => decreaseQty(idx)} aria-label="Decrease quantity">−</button>
                            <span>{item.quantity}</span>
                            <button onClick={() => increaseQty(idx)} aria-label="Increase quantity"
                              disabled={!item.custom && !item.serials && stockFor(item.productId) !== null && item.quantity >= stockFor(item.productId)}>+</button>
                          </div>
                        </td>
                        <td data-testid="line-unit">{item.custom ? "—" : unitFor(item.productId) || "—"}</td>
                        <td className="san-bt-money" data-testid="line-price">
                          <LinePriceCell line={item} product={productOf(item.productId)} canChange={canChangePrice}
                            onChange={(p) => patchLine(idx, p)}>
                            {row.inclusive && <span className="san-bt-sub">price incl. GST</span>}
                          </LinePriceCell>
                        </td>
                        <td className="san-bt-money" data-testid="line-rate">{Number((row.rate * 100).toFixed(2))}%</td>
                        <td className="san-bt-money" data-testid="line-disc">{row.scheme > 0 ? row.scheme.toFixed(2) : "0.00"}</td>
                        <td className="san-bt-money san-bt-amount">
                          {/* the line as the customer pays it: before GST (after any scheme) + its GST */}
                          <span className="san-item-total" data-testid="line-total">
                            {row.scheme > 0 && <span className="san-item-total-was">₹{(row.gross * (1 + row.rate)).toFixed(2)}</span>}
                            ₹{(row.post + lineGst).toFixed(2)}
                            <span className="san-item-total-split" data-testid="line-excl">₹{row.post.toFixed(2)} + ₹{lineGst.toFixed(2)} GST</span>
                          </span>
                        </td>
                        <td className="san-bt-actions">
                          <button onClick={() => openEdit(idx)} className="san-edit-btn" title="Edit batch / GST" aria-label={`Edit ${item.productName}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" height="12px" viewBox="0 -960 960 960" width="12px" fill="currentColor">
                              <path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Z"/>
                            </svg>
                          </button>
                          <button className="san-delete-btn" onClick={() => deleteItem(idx)} aria-label={`Remove ${item.productName}`}>
                            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                              <path d="M1.5 3h8M4.5 3V2h2v1M2.5 3l.5 6h5l.5-6"
                                stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {errors.items && <span className="san-err">{errors.items}</span>}

            {/* ── Under the items: GST mode and the bill discount ── */}
            <div className="san-bill-options">
              <div className="san-field">
                <label>GST mode</label>
                <div className="san-segmented">
                  {[["COMMON", "Common GST"], ["PRODUCT", "Product-wise"]].map(([val, lbl]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setTaxMode(val)}
                      className={`san-segmented-btn ${taxMode === val ? "san-segmented-active" : ""}`}
                    >{lbl}</button>
                  ))}
                </div>
              </div>

              {taxMode === "COMMON" ? (
                <div className="san-field">
                  <label>Common GST rate</label>
                  <select value={commonTax} onChange={e => setCommonTax(e.target.value)} className="san-select">
                    {GST_RATES.map(r => (
                      <option key={r} value={r}>
                        {r}%{r === 18 ? " (Standard)" : r === 0 ? " (Exempt)" : ""}
                      </option>
                    ))}
                  </select>
                  <span className="san-hint" data-testid="common-gst-hint">Used only for products that have no GST rate yet; the rest use their own.</span>
                </div>
              ) : (
                <div className="san-field">
                  <label>Product-wise GST</label>
                  <select value={taxType} onChange={e => setTaxType(e.target.value)} className="san-select san-select-sm">
                    <option value="PERCENT">% GST Rate</option>
                    <option value="FLAT">₹ Flat Amount</option>
                  </select>
                  <span className="san-hint">Tap the pencil icon on an item without a GST rate to set it.</span>
                </div>
              )}

              <div className="san-field">
                <label htmlFor="san-bill-discount">Bill discount</label>
                <div className="san-total-inline">
                  <input
                    id="san-bill-discount"
                    type="number"
                    className="san-discount-input"
                    placeholder="0"
                    value={discountInput}
                    onChange={e => setDiscountInput(e.target.value)}
                  />
                  <select
                    value={discountType}
                    onChange={e => setDiscountType(e.target.value)}
                    className="san-select san-discount-select"
                    aria-label="Discount type"
                  >
                    <option value="PERCENT">%</option>
                    <option value="FLAT">₹</option>
                  </select>
                </div>
                {errors.discountInput && <span className="san-err">{errors.discountInput}</span>}
              </div>
            </div>

          </div>
        </div>

        <div className="san-block san-bill-side">
          <div className="san-block-body san-block-body-right san-bill-side-body">

            {/* ── The total, large, and how it is made up ── */}
            <div className="san-bill-hero" data-testid="bill-total">
              <span className="san-bill-hero-label">Total</span>
              <span className="san-bill-hero-amount">₹{payableAmount.toFixed(2)}</span>
              <span className="san-item-count">Items: {items.length} · Qty: {units}</span>
            </div>

            <div className="san-totals">
              <div className="san-total-row">
                <span>Subtotal</span>
                <span>₹{totals.gross.toFixed(2)}</span>
              </div>

              {totals.schemeDiscount > 0 && (
                <div className="san-total-row">
                  <span>Scheme discount</span>
                  <span className="san-total-negative">-₹{totals.schemeDiscount.toFixed(2)}</span>
                </div>
              )}

              {totals.manualDiscount > 0 && (
                <div className="san-total-row">
                  <span>Discount</span>
                  <span className="san-total-negative">-₹{totals.manualDiscount.toFixed(2)}</span>
                </div>
              )}

              {totals.freeUnits > 0 && (
                <div className="san-total-row">
                  <span>Free units (stock reduced, not charged)</span>
                  <span className="san-item-free">{totals.freeUnits}</span>
                </div>
              )}

              <div className="san-total-row">
                <span>Taxable value</span>
                <span>₹{totals.taxable.toFixed(2)}</span>
              </div>

              {gstSplit(totals).length > 1 && gstSplit(totals).map(g => (
                <div className="san-total-row san-total-row-sub" key={g.rate} data-testid="gst-split">
                  <span>GST @ {g.rate}%</span>
                  <span>₹{g.tax.toFixed(2)}</span>
                </div>
              ))}
              <div className="san-total-row">
                <span>GST{gstSplit(totals).length === 1 ? ` @ ${gstSplit(totals)[0].rate}%` : ""}</span>
                <span>₹{totals.tax.toFixed(2)}</span>
              </div>

              {totals.roundOff !== 0 && totals.roundOff !== undefined && (
                <div className="san-total-row" data-testid="round-off">
                  <span>Round off</span>
                  <span>{roundOffText(totals.roundOff)}</span>
                </div>
              )}
              <div className="san-total-net">
                <span>Net amount</span>
                <span>₹{totals.net.toFixed(2)}</span>
              </div>

              <div className="san-total-net">
                <span>Payable amount</span>
                <span>₹{payableAmount.toFixed(2)}</span>
              </div>
              {retailerTdsPreview.tcs > 0 && (
                <span className="san-hint">
                  Retailer TDS{tcsSetting?.sectionCode ? ` (${tcsSetting.sectionCode})` : ""}: this retailer is expected to
                  withhold ~₹{retailerTdsPreview.tcs.toFixed(2)} (@ {retailerTdsPreview.rate}%) when paying you, since their
                  purchases from you crossed the FY threshold — estimated, not added to this invoice, and not something
                  you collect or remit.
                </span>
              )}
            </div>

            <div className="san-billing-section">

              <Dropdown
                label="Retailer (optional — blank = walk-in)"
                options={retailers}
                selectedId={selectedRetailer}
                onSelect={setSelectedRetailer}
                placeholder="Search retailer..."
                error={errors.retailerId}
              />

              {/* Walk-in customer: only when no retailer is picked */}
              {!selectedRetailer && (
                <>
                  <div className="san-field">
                    <label htmlFor="san-customer-name">Customer name (optional)</label>
                    <input
                      id="san-customer-name"
                      type="text" value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      maxLength={MAX_NAME_LENGTH} placeholder="Walk-in customer" autoComplete="off"
                      className={errors.customerName ? "san-input-err" : ""}
                    />
                    {errors.customerName && <span className="san-err">{errors.customerName}</span>}
                  </div>
                  <div className="san-field">
                    <label htmlFor="san-customer-phone">Mobile number (optional)</label>
                    <input
                      id="san-customer-phone"
                      type="tel" inputMode="tel" value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                      maxLength={16} placeholder="10-digit mobile" autoComplete="off"
                      className={errors.customerPhone ? "san-input-err" : ""}
                    />
                    {errors.customerPhone && <span className="san-err">{errors.customerPhone}</span>}
                  </div>
                </>
              )}

              <div className="san-field">
                <label>Payment type</label>
                <div className="san-pay-tiles">
                  {PAYMENT_TYPES.map(({ id, name, sub }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => (choosePaymentType ? choosePaymentType(id) : setCreditPaymentType(id))}
                      className={`san-pay-tile ${creditPaymentType === id ? "san-pay-tile-active" : ""}`}
                    >
                      <span className="san-pay-tile-icon">{PAYMENT_ICONS[id]}</span>
                      <span className="san-pay-tile-text">
                        <span className="san-pay-tile-label">{name}</span>
                        <span className="san-pay-tile-sub">{sub}</span>
                      </span>
                      {creditPaymentType === id && (
                        <span className="san-pay-tile-check">
                          <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.2 2.2L8 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {(creditPaymentType === "CREDIT" || creditPaymentType === "PARTIAL") && (
                <div className="san-field">
                  <label>Due date</label>
                  <input
                    type="date" value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className={errors.dueDate ? "san-input-err" : ""}
                  />
                  {errors.dueDate && <span className="san-err">{errors.dueDate}</span>}
                </div>
              )}

              {creditPaymentType !== "CREDIT" && (
                <div className="san-field">
                  <label>Payment (split across Cash / UPI / Card)</label>
                  <PaymentSplit type={creditPaymentType} net={payableAmount} payments={payments} onChange={setPayments}
                    error={errors.amountPaid} />
                </div>
              )}
              <CreditLimitNotice check={credit} reason={creditReason} onReason={setCreditReason} />

              {creditPaymentType !== "PAID" && (
                <div className="san-due-badge">
                  Due: ₹{Math.max(0, payableAmount - (amountPaid || 0)).toFixed(2)}
                </div>
              )}
            </div>

            <button
              className={`san-btn-submit ${submitting ? "san-btn-submit-loading" : ""}`}
              onClick={onSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span className="san-btn-spinner" />
                  Submitting…
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path d="M2 6.5l3 3 6-6" stroke="currentColor" strokeWidth="1.6"
                      strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Place order
                </>
              )}
            </button>

          </div>
        </div>

      </div>
      </fieldset>

      {/* ── Blocking overlay so the user can't interact with anything else mid-submit ── */}
      {submitting && (
        <div className="san-submit-overlay">
          <div className="san-submit-overlay-frame">
            <div className="san-loader san-loader-sm"><div/><div/><div/><div/></div>
            <span>Processing sale… please wait</span>
          </div>
        </div>
      )}
    </>
  );
}

/* ─────────────────────────────────────────
   CART LINE EDIT MODAL
───────────────────────────────────────── */
function CartItemEditModal({ item, batches, taxMode, taxType, stock, onSave, onCancel }) {
  const { trackExpiry } = useBusinessProfile(); // no expiry anywhere when the shop doesn't track it
  const [quantity, setQuantity] = useState(item.quantity);
  const [batchId, setBatchId]   = useState(item.batchId ?? "");
  const [gstRate, setGstRate]   = useState(item.gstRate ?? 0);
  const [price, setPrice]       = useState(item.sellingPrice);

  const handleSave = () => {
    if (!quantity || quantity <= 0) { toast.error("Quantity must be ≥ 1"); return; }
    if (stock !== null && quantity > stock) { toast.error("Exceeds available stock"); return; }
    if (!price || price <= 0) { toast.error("Enter a valid price"); return; }

    const batchMeta = batches.find(b => String(b.batchId) === String(batchId));
    onSave({
      quantity: parseInt(quantity),
      sellingPrice: parseFloat(price),
      gstRate: parseFloat(gstRate || 0),
      batchId: batchId ? parseInt(batchId) : null,
      batchNumber: batchId ? (batchMeta?.batchNumber || "") : "AUTO",
      expiryDate: batchId ? (batchMeta?.expiryDate || "") : "",
    });
  };

  return (
    <div className="san-sheet-overlay" onMouseDown={onCancel}>
      <div className="san-sheet" onMouseDown={e => e.stopPropagation()}>
        <div className="san-sheet-header">
          <span>{item.productName}</span>
          <button className="san-sheet-close" onClick={onCancel}>✕</button>
        </div>

        <div className="san-sheet-body">
          <div className="san-field">
            <label>Quantity</label>
            <input
              type="number" min="1" value={quantity}
              onChange={e => setQuantity(e.target.value.replace(/^0+/, "") || 1)}
            />
          </div>

          <div className="san-field">
            <label>Selling Price (₹)</label>
            <input
              type="number" value={price}
              onChange={e => setPrice(e.target.value)}
            />
          </div>

          {item.productGstRate != null && (
            <span className="san-hint" data-testid="edit-product-gst">GST {item.productGstRate}% (from the product){item.priceIncludesGst ? " · price includes GST" : ""}</span>
          )}
          {taxMode === "PRODUCT" && item.productGstRate == null && (
            <div className="san-field">
              <label>GST {taxType === "PERCENT" ? "Rate (%)" : "Amount (₹)"}</label>
              {taxType === "PERCENT" ? (
                <select value={gstRate} onChange={e => setGstRate(e.target.value)} className="san-select">
                  <option value="0">0% (Exempt)</option>
                  {GST_RATES.filter(r => r > 0).map(r => (
                    <option key={r} value={r}>{r}%{r === 18 ? " (Standard)" : ""}</option>
                  ))}
                </select>
              ) : (
                <input type="number" value={gstRate} onChange={e => setGstRate(e.target.value)} placeholder="Flat GST amount" />
              )}
            </div>
          )}

          {batches.length > 0 && (
            <div className="san-field">
              <label>Batch</label>
              <select value={batchId} onChange={e => setBatchId(e.target.value)} className="san-select">
                <option value="">{trackExpiry ? "Auto-select (FIFO — oldest expiry first)" : "Auto-select (oldest stock first)"}</option>
                {batches.map(b => (
                  <option key={b.batchId} value={b.batchId}>
                    {b.batchNumber}{trackExpiry && b.expiryDate ? ` · Exp: ${b.expiryDate}` : ""} · Qty: {b.availableQuantity}
                    {!trackExpiry ? "" : b.expiryStatus === "EXPIRING_SOON" ? " ⚠️"
                      : b.expiryStatus === "EXPIRED" ? " ❌" : " ✅"}
                  </option>
                ))}
              </select>
            </div>
          )}
          {batches.length === 0 && (
            <span className="san-hint">No specific batches found — FIFO auto-allocation will be used.</span>
          )}
        </div>

        <div className="san-sheet-footer">
          <button className="san-btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="san-btn-primary" onClick={handleSave}>Save changes</button>
        </div>
      </div>
    </div>
  );
}
