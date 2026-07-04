import React, { useEffect, useState, useRef, useMemo } from "react";
import "../../Styles/Sales/SalesAddNew.css";
import { toast } from "react-toastify";
import SalesView from "./SalesView";
import { toastApiError } from "../../utils/toastMessage";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

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
        className={`san-dd-box ${open ? "san-dd-open" : ""} ${error ? "san-dd-err" : ""}`}
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

const BILLING_MODES = [
  { id: "CASH",   name: "Cash" },
  { id: "ONLINE", name: "Online / UPI" },
  { id: "CARD",   name: "Card" },
];

const PAYMENT_TYPES = [
  { id: "PAID",    name: "Full Payment" },
  { id: "PARTIAL", name: "Partial Payment" },
  { id: "CREDIT",  name: "Credit (Pay Later)" },
];

/* ─────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────── */
export default function SalesAddNew({ onClose, onSubmit }) {
  const canvasRef    = useRef(null);
  const animFrameRef = useRef(null);

  /* ── Flow step: "catalog" (pick products) → "checkout" (pay) ── */
  const [step, setStep] = useState("catalog");

  /* ── Data lists ── */
  const [productTypes, setProductTypes] = useState([]);
  const [allProducts, setAllProducts]   = useState([]);
  const [retailers, setRetailers]       = useState([]);
  // manualPrices only needed for products where sellingPrice is null/0 from API
  const [manualPrices, setManualPrices] = useState({});
  const [batchesMap, setBatchesMap]     = useState({});   // productId -> [batches] (lazy-loaded)

  /* ── Catalog filters ── */
  const [search, setSearch]             = useState("");
  const [typeFilter, setTypeFilter]     = useState("");
  const [priceDraft, setPriceDraft]     = useState({});   // productId -> string being typed for manual price

  /* ── GST ── */
  const [taxMode, setTaxMode]     = useState("COMMON");   // COMMON | PRODUCT
  const [commonTax, setCommonTax] = useState("18");
  const [taxType, setTaxType]     = useState("PERCENT");  // PERCENT | FLAT

  /* ── Cart / items ── */
  const [items, setItems]         = useState([]);
  const [editingIdx, setEditingIdx] = useState(null);

  /* ── Right-panel: billing ── */
  const [selectedRetailer, setSelectedRetailer] = useState("");
  const [discountInput, setDiscountInput]       = useState("");
  const [discountType, setDiscountType]         = useState("PERCENT");
  const [billingMode, setBillingMode]           = useState("CASH");
  const [creditPaymentType, setCreditPaymentType] = useState("PAID");
  const [amountPaid, setAmountPaid]             = useState("");
  const [dueDate, setDueDate]                   = useState("");

  /* ── UI state ── */
  const [errors, setErrors]         = useState({});
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewUkey, setViewUkey]     = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  /* ══════════ 3-D CANVAS ══════════ */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx    = canvas.getContext("2d");
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener("resize", resize);

    const orbs = Array.from({ length: 4 }, (_, i) => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      r: 80 + Math.random() * 160,
      vx: (Math.random() - 0.5) * 0.18, vy: (Math.random() - 0.5) * 0.18,
      hue: [215, 225, 210, 230][i], alpha: 0.018 + Math.random() * 0.02,
    }));

    let tick = 0;
    const draw = () => {
      tick++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, canvas.width, canvas.height);

      const hor = canvas.height * 0.45, vanX = canvas.width / 2, gc = 10;
      const spd = (tick * 0.2) % (canvas.height / gc);
      ctx.save(); ctx.globalAlpha = 0.04; ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 0.5;
      for (let i = 0; i <= gc; i++) {
        const y = hor + spd + (i * (canvas.height - hor)) / gc;
        if (y > canvas.height) continue;
        const sp = ((y - hor) / (canvas.height - hor)) * canvas.width * 1.3;
        ctx.beginPath(); ctx.moveTo(vanX - sp / 2, y); ctx.lineTo(vanX + sp / 2, y); ctx.stroke();
      }
      for (let i = 0; i <= 14; i++) {
        const t = i / 14, bx = vanX - canvas.width * 0.65 + t * canvas.width * 1.3;
        ctx.beginPath(); ctx.moveTo(vanX, hor); ctx.lineTo(bx, canvas.height + 10); ctx.stroke();
      }
      ctx.restore();

      orbs.forEach(o => {
        o.x += o.vx; o.y += o.vy;
        if (o.x < -o.r)              o.x = canvas.width + o.r;
        if (o.x > canvas.width + o.r) o.x = -o.r;
        if (o.y < -o.r)              o.y = canvas.height + o.r;
        if (o.y > canvas.height + o.r) o.y = -o.r;
        const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
        g.addColorStop(0, `hsla(${o.hue},75%,55%,${o.alpha})`);
        g.addColorStop(1, "transparent");
        ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx.fillStyle = g; ctx.fill();
      });

      const vig = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, canvas.height * 0.1,
        canvas.width / 2, canvas.height / 2, canvas.height * 0.9
      );
      vig.addColorStop(0, "rgba(0,0,0,0)"); vig.addColorStop(1, "rgba(0,0,0,0.65)");
      ctx.fillStyle = vig; ctx.fillRect(0, 0, canvas.width, canvas.height);

      animFrameRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  /* ══════════ FETCH: retailers, product types, all products ══════════
     Stock and sellingPrice now come directly from the GetAllProduct API.
     No separate inventory API call needed.
  ══════════════════════════════════════════════════════════════════════ */
  useEffect(() => {
    apiClient(`${API_BASE_URL}/api/Retailer/Dropdown`)
      .then(r => r.json())
      .then(json => setRetailers(
        (json?.data ?? []).map(r => ({ id: r.id, name: `${r.shopName} · ${r.ownerName}` }))
      ))
      .catch(() => {});

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
   * Price priority:
   *  1. manualPrices (user override for products with no sellingPrice)
   *  2. sellingPrice from product API
   *  Falls back to null if neither available.
   */
  const priceFor = (productId) => {
    if (manualPrices[productId]) return manualPrices[productId];
    const product = allProducts.find(p => p.id === productId);
    return (product?.sellingPrice > 0) ? product.sellingPrice : null;
  };

  /**
   * Stock comes directly from the product API `stock` field.
   */
  const stockFor = (productId) => {
    const product = allProducts.find(p => p.id === productId);
    return product?.stock ?? null;
  };

  /* ══════════ ADD / ADJUST CART FROM CATALOG ══════════ */
  const adjustCart = (product, delta) => {
    const price = priceFor(product.id);
    if (!price || price <= 0) {
      toast.error("Set a selling price for this product first");
      return;
    }
    const stock = stockFor(product.id);

    setItems(prev => {
      const idx = prev.findIndex(i => i.productId === product.id);

      if (idx === -1) {
        if (delta <= 0) return prev;
        if (stock !== null && delta > stock) {
          toast.error("Exceeds available stock");
          return prev;
        }
        return [
          ...prev,
          {
            productId:    product.id,
            productName:  product.name,
            quantity:     delta,
            sellingPrice: price,
            gstRate:      parseFloat(commonTax || 0),
            taxAmount:    0,
            batchId:      null,
            batchNumber:  "AUTO",
            expiryDate:   "",
          },
        ];
      }

      const newQty = prev[idx].quantity + delta;
      if (newQty <= 0) return prev.filter((_, i) => i !== idx);
      if (stock !== null && newQty > stock) {
        toast.error("Exceeds available stock");
        return prev;
      }
      const updated = [...prev];
      updated[idx] = { ...updated[idx], quantity: newQty };
      return updated;
    });
  };

  const confirmManualPrice = (productId) => {
    const val = parseFloat(priceDraft[productId]);
    if (!val || val <= 0) {
      toast.error("Enter a valid price");
      return;
    }
    setManualPrices(prev => ({ ...prev, [productId]: val }));
  };

  /* ══════════ CART ROW HELPERS (checkout step) ══════════ */
  const increaseQty = (i) => {
    const it = items[i];
    const stock = stockFor(it.productId);
    if (stock !== null && it.quantity + 1 > stock) { toast.error("Exceeds available stock"); return; }
    const u = [...items]; u[i].quantity++; setItems(u);
  };
  const decreaseQty = (i) => { const u = [...items]; if (u[i].quantity > 1) { u[i].quantity--; setItems(u); } };
  const deleteItem  = (i) => { const u = [...items]; u.splice(i, 1); setItems(u); };

  const openEdit  = (i) => { ensureBatches(items[i].productId); setEditingIdx(i); };
  const closeEdit = () => setEditingIdx(null);

  const saveEdit = (patch) => {
    setItems(prev => {
      const u = [...prev];
      u[editingIdx] = { ...u[editingIdx], ...patch };
      return u;
    });
    closeEdit();
  };

  /* ══════════ COMPUTED TOTALS ══════════ */
  const subTotal = items.reduce((s, i) => s + i.sellingPrice * i.quantity, 0);

  const lineTaxTotal = items.reduce((s, i) => {
    if (taxMode !== "PRODUCT") return s;
    const rate = parseFloat(i.gstRate || 0);
    const amt = taxType === "PERCENT" ? (i.sellingPrice * i.quantity * rate) / 100 : rate;
    return s + amt;
  }, 0);

  const discAmt = discountInput > 0
    ? (discountType === "PERCENT"
      ? (subTotal * parseFloat(discountInput)) / 100
      : parseFloat(discountInput))
    : 0;
  const discountedSub   = subTotal - discAmt;
  const commonTaxAmount = taxMode === "COMMON" && parseFloat(commonTax) > 0
    ? (taxType === "PERCENT"
      ? (discountedSub * parseFloat(commonTax)) / 100
      : parseFloat(commonTax))
    : 0;
  const netAmount = discountedSub + (taxMode === "PRODUCT" ? lineTaxTotal : commonTaxAmount);

  /* ── Auto-sync payment amount for FULL / CREDIT modes whenever net changes ── */
  useEffect(() => {
    if (creditPaymentType === "PAID")   setAmountPaid(netAmount.toFixed(2));
    if (creditPaymentType === "CREDIT") setAmountPaid("0");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [netAmount, creditPaymentType]);

  const resetAll = () => {
    setItems([]); setManualPrices({}); setPriceDraft({});
    setCommonTax("18"); setTaxMode("COMMON"); setTaxType("PERCENT");
    setDiscountInput(""); setDiscountType("PERCENT");
    setSelectedRetailer(""); setBillingMode("CASH");
    setCreditPaymentType("PAID"); setAmountPaid(""); setDueDate("");
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
    if (creditPaymentType !== "CREDIT" && !billingMode) tempErrors.billingMode = "Select billing mode";
    if (discountInput < 0)   tempErrors.discountInput = "Discount cannot be negative";

    if (creditPaymentType === "PAID" && parseFloat(amountPaid) !== netAmount)
      tempErrors.amountPaid = "Amount must equal net amount";
    if (creditPaymentType === "PARTIAL") {
      if (!amountPaid || amountPaid <= 0) tempErrors.amountPaid = "Enter valid amount paid";
      else if (parseFloat(amountPaid) >= netAmount) tempErrors.amountPaid = "Partial must be less than total";
    }
    if (creditPaymentType === "CREDIT" && parseFloat(amountPaid) !== 0)
      tempErrors.amountPaid = "Amount paid must be 0 for credit";
    if ((creditPaymentType === "CREDIT" || creditPaymentType === "PARTIAL") && !dueDate)
      tempErrors.dueDate = "Due date is required";

    setErrors(tempErrors);
    if (Object.keys(tempErrors).length > 0) {
      toast.error(Object.values(tempErrors)[0]);
      return;
    }

    const finalDiscount = discountType === "PERCENT"
      ? (subTotal * (parseFloat(discountInput) || 0)) / 100
      : parseFloat(discountInput || 0);

    const totalBeforeTax = items.reduce((s, i) => s + i.sellingPrice * i.quantity, 0);

    const payload = {
      billingMode,
      totalDiscount: finalDiscount,
      amountPaid: parseFloat(amountPaid),
      remainingAmount: parseFloat((netAmount - parseFloat(amountPaid)).toFixed(2)),
      retailerId: selectedRetailer ? parseInt(selectedRetailer) : null,
      paymentType: creditPaymentType,
      dueDate: dueDate || null,

      items: items.map(it => {
        const itemTotal = it.sellingPrice * it.quantity;

        let taxAmount;
        if (taxMode === "COMMON") {
          taxAmount = totalBeforeTax > 0 ? (itemTotal / totalBeforeTax) * commonTaxAmount : 0;
        } else {
          const rate = parseFloat(it.gstRate || 0);
          taxAmount = taxType === "PERCENT" ? (itemTotal * rate) / 100 : rate;
        }

        return {
          productId: it.productId,
          quantity: it.quantity,
          sellingPrice: it.sellingPrice,
          taxAmount: parseFloat(taxAmount.toFixed(2)),
          batchId: it.batchId || null,
        };
      }),
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
      toast.success("Sale added successfully");
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
      <canvas ref={canvasRef} className="san-canvas" />
      <div className="san-noise" />
      <div className="san-top-beam" />

      {initialLoading ? (
        <div className="san-screen-loading">
          <div className="san-loader"><div/><div/><div/><div/></div>
        </div>
      ) : (
      <>
      <div className="san-content">

        <div className="san-page-header">
          <div className="san-badge"><span className="san-badge-dot" />NEW TRANSACTION</div>
          <div className="san-header-top">
            <h1 className="san-page-title">New Sale</h1>
            <div className="san-steps">
              <div className={`san-step ${step === "catalog" ? "san-step-active" : "san-step-done"}`}>
                <span className="san-step-num">1</span> Select Products
              </div>
              <div className="san-step-line" />
              <div className={`san-step ${step === "checkout" ? "san-step-active" : ""}`}>
                <span className="san-step-num">2</span> Payment
              </div>
            </div>
          </div>
          <div className="san-header-rule" />
        </div>

        {step === "catalog" ? (
          <CatalogStep
            productTypes={productTypes}
            filteredProducts={filteredProducts}
            search={search} setSearch={setSearch}
            typeFilter={typeFilter} setTypeFilter={setTypeFilter}
            allProducts={allProducts}
            manualPrices={manualPrices}
            priceDraft={priceDraft} setPriceDraft={setPriceDraft}
            confirmManualPrice={confirmManualPrice}
            cartQtyFor={cartQtyFor}
            priceFor={priceFor}
            stockFor={stockFor}
            adjustCart={adjustCart}
            items={items}
            subTotal={subTotal}
            onProceed={goToCheckout}
          />
        ) : (
          <CheckoutStep
            items={items}
            increaseQty={increaseQty}
            decreaseQty={decreaseQty}
            deleteItem={deleteItem}
            openEdit={openEdit}
            taxMode={taxMode} setTaxMode={setTaxMode}
            commonTax={commonTax} setCommonTax={setCommonTax}
            taxType={taxType} setTaxType={setTaxType}
            discountInput={discountInput} setDiscountInput={setDiscountInput}
            discountType={discountType} setDiscountType={setDiscountType}
            subTotal={subTotal}
            lineTaxTotal={lineTaxTotal}
            commonTaxAmount={commonTaxAmount}
            netAmount={netAmount}
            errors={errors}
            retailers={retailers}
            selectedRetailer={selectedRetailer} setSelectedRetailer={setSelectedRetailer}
            billingMode={billingMode} setBillingMode={setBillingMode}
            creditPaymentType={creditPaymentType} setCreditPaymentType={setCreditPaymentType}
            amountPaid={amountPaid} setAmountPaid={setAmountPaid}
            dueDate={dueDate} setDueDate={setDueDate}
            onBack={() => setStep("catalog")}
            onSubmit={submitSales}
            submitting={submitting}
          />
        )}

      </div>

      {/* ── Floating cart bar while browsing the catalog ── */}
      {step === "catalog" && (
        <div className="san-cart-float">
          <div className="san-cart-float-info">
            {items.length === 0 ? (
              <>
                <span className="san-cart-float-count san-cart-float-empty-label">
                  🛒 Cart is empty
                </span>
                <span className="san-cart-float-hint">Add products above to get started</span>
              </>
            ) : (
              <>
                <span className="san-cart-float-count">
                  {items.reduce((s, i) => s + i.quantity, 0)} unit{items.reduce((s, i) => s + i.quantity, 0) !== 1 ? "s" : ""} · {items.length} item{items.length !== 1 ? "s" : ""}
                </span>
                <span className="san-cart-float-amount">₹{subTotal.toFixed(2)}</span>
              </>
            )}
          </div>
          <button
            className="san-btn-primary san-cart-float-btn"
            onClick={goToCheckout}
            disabled={items.length === 0}
          >
            Review &amp; Pay
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M2 5.5h7M6 2l3.5 3.5L6 9" stroke="currentColor" strokeWidth="1.6"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
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
   STEP 1 — CATALOG
───────────────────────────────────────── */
function CatalogStep({
  productTypes, filteredProducts, search, setSearch, typeFilter, setTypeFilter,
  allProducts, manualPrices, priceDraft, setPriceDraft, confirmManualPrice,
  cartQtyFor, priceFor, stockFor, adjustCart,
}) {
  return (
    <div className="san-catalog">

      <div className="san-catalog-toolbar">
        <div className="san-search-bar">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
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
          {filteredProducts.map(p => {
            const price      = priceFor(p.id);
            const stock      = stockFor(p.id);
            const inCart     = cartQtyFor(p.id);
            const outOfStock = stock !== null && stock <= 0;
            const lowStock   = stock !== null && stock > 0 && stock <= 10;

            return (
              <div key={p.id} className={`san-pcard ${inCart > 0 ? "san-pcard-in-cart" : ""}`}>
                <div className="san-pcard-top">
                  <span className="san-pcard-name">{p.name}</span>
                  {stock !== null && (
                    <span className={`san-stock-badge ${outOfStock ? "san-stock-out" : lowStock ? "san-stock-low" : "san-stock-ok"}`}>
                      {outOfStock ? "Out of stock" : `${stock} in stock`}
                    </span>
                  )}
                </div>

                {price ? (
                  <span className="san-pcard-price">₹{price}</span>
                ) : (
                  <div className="san-pcard-setprice">
                    <input
                      type="number"
                      placeholder="Set price ₹"
                      value={priceDraft[p.id] ?? ""}
                      onChange={e => setPriceDraft(prev => ({ ...prev, [p.id]: e.target.value }))}
                    />
                    <button onClick={() => confirmManualPrice(p.id)}>Set</button>
                  </div>
                )}

                <div className="san-pcard-action">
                  {outOfStock ? (
                    <span className="san-pcard-disabled-note">Add stock via Purchase</span>
                  ) : inCart > 0 ? (
                    <div className="san-qty-ctrl san-qty-ctrl-card">
                      <button onClick={() => adjustCart(p, -1)}>−</button>
                      <span>{inCart}</span>
                      <button onClick={() => adjustCart(p, 1)}>+</button>
                    </div>
                  ) : (
                    <button
                      className="san-pcard-add"
                      disabled={!price}
                      onClick={() => adjustCart(p, 1)}
                    >
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                        <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                      </svg>
                      Add
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   STEP 2 — CHECKOUT
───────────────────────────────────────── */
function CheckoutStep({
  items, increaseQty, decreaseQty, deleteItem, openEdit,
  taxMode, setTaxMode, commonTax, setCommonTax, taxType, setTaxType,
  discountInput, setDiscountInput, discountType, setDiscountType,
  subTotal, lineTaxTotal, commonTaxAmount, netAmount, errors,
  retailers, selectedRetailer, setSelectedRetailer,
  billingMode, setBillingMode,
  creditPaymentType, setCreditPaymentType,
  amountPaid, setAmountPaid, dueDate, setDueDate,
  onBack, onSubmit, submitting,
}) {
  return (
    <>
      {/* ── Back button — prominent pill style ── */}
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
      <div className="san-layout">

        <div className="san-panel">
          <div className="san-panel-header">
            <div className="san-panel-title">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 1.5h1.5l1.5 6h5l1-4H4" stroke="currentColor" strokeWidth="1.2"
                  strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="5.5" cy="10" r="0.8" fill="currentColor"/>
                <circle cx="9.5" cy="10" r="0.8" fill="currentColor"/>
              </svg>
              Cart
            </div>
            <span className="san-item-count">{items.length} item{items.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="san-panel-body san-panel-body-right">

            <div className="san-items-list">
              {items.map((item, idx) => (
                <div key={idx} className="san-item-row" style={{ animationDelay: `${idx * 0.04}s` }}>
                  <div className="san-item-info">
                    <span className="san-item-name">{item.productName}</span>
                    <span className="san-item-unit">
                      ₹{item.sellingPrice} / unit
                      {item.batchNumber && item.batchNumber !== "AUTO" && (
                        <> · <span className="san-batch-tag">Batch: {item.batchNumber}</span></>
                      )}
                      {item.expiryDate && <> · Exp: {item.expiryDate}</>}
                    </span>
                  </div>
                  <div className="san-item-controls">
                    <div className="san-qty-ctrl">
                      <button onClick={() => decreaseQty(idx)}>−</button>
                      <span>{item.quantity}</span>
                      <button onClick={() => increaseQty(idx)}>+</button>
                    </div>
                    <span className="san-item-total">₹{(item.sellingPrice * item.quantity).toFixed(2)}</span>

                    <button
                      onClick={() => openEdit(idx)}
                      className="san-edit-btn"
                      title="Edit batch / GST"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" height="12px" viewBox="0 -960 960 960" width="12px" fill="currentColor">
                        <path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Z"/>
                      </svg>
                    </button>

                    <button className="san-delete-btn" onClick={() => deleteItem(idx)}>
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                        <path d="M1.5 3h8M4.5 3V2h2v1M2.5 3l.5 6h5l.5-6"
                          stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {errors.items && <span className="san-err">{errors.items}</span>}

            <div className="san-field">
              <label>GST Mode</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[["COMMON", "Common GST"], ["PRODUCT", "Product-wise"]].map(([val, lbl]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setTaxMode(val)}
                    style={{
                      flex: 1, padding: "7px 10px",
                      background: taxMode === val ? "var(--san-blue-dim)" : "var(--san-deep-bg)",
                      border: `1px solid ${taxMode === val ? "rgba(59,130,246,0.4)" : "var(--san-border)"}`,
                      borderRadius: 8, color: taxMode === val ? "var(--san-blue-light)" : "var(--san-text-3)",
                      fontFamily: "var(--san-font-m)", fontSize: 10, letterSpacing: "0.08em",
                      cursor: "pointer", transition: "all 0.2s",
                    }}
                  >{lbl}</button>
                ))}
              </div>
            </div>

            {taxMode === "COMMON" ? (
              <div className="san-field">
                <label>GST Rate</label>
                <div className="san-tax-row">
                  <select value={commonTax} onChange={e => setCommonTax(e.target.value)} className="san-select">
                    {GST_RATES.map(r => (
                      <option key={r} value={r}>
                        {r}%{r === 18 ? " (Standard)" : r === 0 ? " (Exempt)" : ""}
                      </option>
                    ))}
                  </select>
                  <select value={taxType} onChange={e => setTaxType(e.target.value)} className="san-select san-select-sm">
                    <option value="PERCENT">% Rate</option>
                    <option value="FLAT">₹ Flat</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="san-field">
                <label>Product-wise GST</label>
                <span className="san-hint">Tap the pencil icon on each item to set its GST rate.</span>
              </div>
            )}

            <div className="san-totals">
              <div className="san-total-row"><span>Subtotal</span><span>₹{subTotal.toFixed(2)}</span></div>
              <div className="san-total-row">
                <span>
                  GST ({taxMode === "COMMON"
                    ? `${commonTax}${taxType === "PERCENT" ? "%" : "₹"} common`
                    : "product-wise"})
                </span>
                <span>₹{(taxMode === "COMMON" ? commonTaxAmount : lineTaxTotal).toFixed(2)}</span>
              </div>
              <div className="san-total-row">
                <span>Discount</span>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    type="number"
                    className="san-discount-input"
                    placeholder="0"
                    value={discountInput}
                    onChange={e => setDiscountInput(e.target.value)}
                  />
                  <select
                    value={discountType}
                    onChange={e => setDiscountType(e.target.value)}
                    className="san-select"
                    style={{ flex: "0 0 60px", padding: "5px 6px", fontSize: 11 }}
                  >
                    <option value="PERCENT">%</option>
                    <option value="FLAT">₹</option>
                  </select>
                </div>
              </div>
              {errors.discountInput && <span className="san-err">{errors.discountInput}</span>}
              <div className="san-total-divider" />
              <div className="san-total-row san-total-net">
                <span>Net Total</span>
                <span>₹{netAmount.toFixed(2)}</span>
              </div>
            </div>

          </div>
        </div>

        <div className="san-panel">
          <div className="san-panel-header">
            <div className="san-panel-title">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="1" y="2.5" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M1 4.5h10" stroke="currentColor" strokeWidth="1.2"/>
              </svg>
              Payment
            </div>
          </div>
          <div className="san-panel-body san-panel-body-right">

            <div className="san-billing-section">

              <Dropdown
                label="Retailer (optional — blank = walk-in)"
                options={retailers}
                selectedId={selectedRetailer}
                onSelect={setSelectedRetailer}
                placeholder="Search retailer..."
                error={errors.retailerId}
              />

              {creditPaymentType !== "CREDIT" && (
                <Dropdown
                  label="Billing Mode"
                  options={BILLING_MODES}
                  selectedId={billingMode}
                  onSelect={setBillingMode}
                  placeholder="Select billing mode"
                  error={errors.billingMode}
                />
              )}

              <div className="san-field">
                <label>Payment Type</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {PAYMENT_TYPES.map(({ id, name }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setCreditPaymentType(id);
                        if (id === "PAID")    setAmountPaid(netAmount.toFixed(2));
                        if (id === "CREDIT")  setAmountPaid("0");
                        if (id === "PARTIAL") setAmountPaid("");
                      }}
                      style={{
                        flex: 1, padding: "7px 4px",
                        background: creditPaymentType === id ? "var(--san-blue-dim)" : "var(--san-deep-bg)",
                        border: `1px solid ${creditPaymentType === id ? "rgba(59,130,246,0.4)" : "var(--san-border)"}`,
                        borderRadius: 8, color: creditPaymentType === id ? "var(--san-blue-light)" : "var(--san-text-3)",
                        fontFamily: "var(--san-font-m)", fontSize: 9, letterSpacing: "0.05em",
                        cursor: "pointer", transition: "all 0.2s", textAlign: "center",
                      }}
                    >{name}</button>
                  ))}
                </div>
              </div>

              {(creditPaymentType === "CREDIT" || creditPaymentType === "PARTIAL") && (
                <div className="san-field">
                  <label>Due Date</label>
                  <input
                    type="date" value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className={errors.dueDate ? "san-input-err" : ""}
                  />
                  {errors.dueDate && <span className="san-err">{errors.dueDate}</span>}
                </div>
              )}

              <div className="san-field">
                <label>Amount Paid (₹)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={amountPaid}
                  onChange={e => setAmountPaid(e.target.value)}
                  disabled={creditPaymentType === "PAID" || creditPaymentType === "CREDIT"}
                  className={errors.amountPaid ? "san-input-err" : ""}
                />
                {errors.amountPaid && <span className="san-err">{errors.amountPaid}</span>}
              </div>

              {creditPaymentType !== "PAID" && parseFloat(amountPaid) >= 0 && (
                <div className="san-due-badge">
                  Due: ₹{Math.max(0, netAmount - parseFloat(amountPaid || 0)).toFixed(2)}
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
                  Submit &amp; View Invoice
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
          <div className="san-submit-overlay-card">
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
    <div className="san-modal-overlay" onMouseDown={onCancel}>
      <div className="san-modal" onMouseDown={e => e.stopPropagation()}>
        <div className="san-modal-header">
          <span>{item.productName}</span>
          <button className="san-modal-close" onClick={onCancel}>✕</button>
        </div>

        <div className="san-modal-body">
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

          {taxMode === "PRODUCT" && (
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
                <option value="">Auto-select (FIFO — oldest expiry first)</option>
                {batches.map(b => (
                  <option key={b.batchId} value={b.batchId}>
                    {b.batchNumber} · Exp: {b.expiryDate} · Qty: {b.availableQuantity}
                    {b.expiryStatus === "EXPIRING_SOON" ? " ⚠️"
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

        <div className="san-modal-footer">
          <button className="san-btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="san-btn-primary" onClick={handleSave}>Save changes</button>
        </div>
      </div>
    </div>
  );
}