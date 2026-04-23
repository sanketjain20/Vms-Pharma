import React, { useEffect, useState, useRef } from "react";
import "../../Styles/Sales/SalesAddNew.css";
import { toast } from "react-toastify";
import SalesView from "./SalesView";

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
  const lastLoadedType = useRef(null);

  /* ── Data lists ── */
  const [productTypes, setProductTypes] = useState([]);
  const [products, setProducts]         = useState([]);
  const [allProducts, setAllProducts]   = useState([]);
  const [retailers, setRetailers]       = useState([]);

  /* ── Left-panel: item builder ── */
  const [selectedType, setSelectedType]       = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [inventory, setInventory]             = useState(null);
  const [quantity, setQuantity]               = useState(1);
  const [manualPrice, setManualPrice]         = useState("");
  const [editIndex, setEditIndex]             = useState(null);

  /* ── GST ── */
  const [taxMode, setTaxMode]     = useState("COMMON");   // COMMON | PRODUCT
  const [commonTax, setCommonTax] = useState("18");
  const [taxType, setTaxType]     = useState("PERCENT");  // PERCENT | FLAT
  const [taxInput, setTaxInput]   = useState("");

  /* ── Batches ── */
  const [availableBatches, setAvailableBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId]   = useState("");

  /* ── Cart / items ── */
  const [items, setItems] = useState([]);

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

  /* ══════════ FETCH ══════════ */
  useEffect(() => {
    fetch("http://localhost:8080/api/Retailer/Dropdown", { credentials: "include" })
      .then(r => r.json())
      .then(json => setRetailers(
        (json?.data ?? []).map(r => ({ id: r.id, name: `${r.shopName} · ${r.ownerName}` }))
      ))
      .catch(() => {});

    fetch("http://localhost:8080/api/ProductType/GetAllProductType", { credentials: "include" })
      .then(r => r.json())
      .then(json => setProductTypes(json?.data?.productTypes ?? []));

    fetch("http://localhost:8080/api/Product/GetAllProduct", { credentials: "include" })
      .then(r => r.json())
      .then(json => {
        const d    = json?.data;
        const list = Array.isArray(d) ? d
          : typeof d === "object" ? Object.values(d).find(v => Array.isArray(v)) ?? [] : [];
        setAllProducts(list); setProducts(list);
      });
  }, []);

  /* ── Fetch batches when product changes ── */
  useEffect(() => {
    if (!selectedProduct) { setAvailableBatches([]); setSelectedBatchId(""); return; }
    fetch(`http://localhost:8080/api/Sales/GetAvailableBatches/${selectedProduct}`, { credentials: "include" })
      .then(r => r.json())
      .then(json => setAvailableBatches(json?.status === 200 ? json.data ?? [] : []))
      .catch(() => setAvailableBatches([]));
  }, [selectedProduct]);

  /* ── Auto-sync payment amount for FULL / CREDIT modes ── */
  useEffect(() => {
    if (creditPaymentType === "PAID")   setAmountPaid(netAmount.toFixed(2));
    if (creditPaymentType === "CREDIT") setAmountPaid("0");
    // PARTIAL: user enters manually
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creditPaymentType, /* netAmount is derived — recalc happens below */]);

  /* ══════════ PRODUCT TYPE SELECT ══════════ */
  const handleTypeSelect = (typeId) => {
    setSelectedType(typeId);
    setSelectedProduct(""); setInventory(null);
    setManualPrice(""); setTaxInput(""); setErrors({});
    setAvailableBatches([]); setSelectedBatchId("");

    if (!typeId) { setProducts(allProducts); return; }
    fetch(`http://localhost:8080/api/Product/GetProdByProdId/${typeId}`, { credentials: "include" })
      .then(r => r.json())
      .then(json => setProducts(json?.data ?? []));
  };

  /* ══════════ PRODUCT SELECT ══════════ */
  const handleProductSelect = async (prodId) => {
    setSelectedProduct(prodId);
    setManualPrice(""); setTaxInput(""); setErrors({});
    setAvailableBatches([]); setSelectedBatchId("");
    if (!prodId) return;

    // Auto-set type if not already set
    if (!selectedType) {
      try {
        const res  = await fetch(`http://localhost:8080/api/ProductType/GetProdTypeByProductId/${prodId}`, { credentials: "include" });
        const json = await res.json();
        const typeId = json?.data?.productTypeId || json?.data?.id;
        if (typeId && typeId !== selectedType) {
          setSelectedType(typeId);
          if (lastLoadedType.current !== typeId) {
            lastLoadedType.current = typeId;
            fetch(`http://localhost:8080/api/Product/GetProdByProdId/${typeId}`, { credentials: "include" })
              .then(r => r.json())
              .then(json => setProducts(json?.data ?? []));
          }
        }
      } catch {}
    }

    // Inventory
    fetch(`http://localhost:8080/api/Inventory/GetInventoryByProdId/${prodId}`, { credentials: "include" })
      .then(r => r.json())
      .then(json => setInventory(json?.status === 200 ? json.data : null));
  };

  /* ══════════ COMPUTED TOTALS ══════════ */
  const subTotal        = items.reduce((s, i) => s + i.sellingPrice * i.quantity, 0);
  const lineTaxTotal    = items.reduce((s, i) => s + i.taxAmount, 0);
  const discAmt         = discountInput > 0
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

  /* ══════════ ADD / UPDATE ITEM ══════════ */
  const addItem = () => {
    const tempErrors = {};
    if (!selectedProduct) tempErrors.product = "Select a product";
    if (!quantity || quantity <= 0) tempErrors.quantity = "Quantity must be ≥ 1";

    const price    = inventory ? inventory.unitSellingPrice : parseFloat(manualPrice);
    if (!price || price <= 0) tempErrors.price = "Enter valid selling price";

    const taxValue = taxMode === "COMMON"
      ? parseFloat(commonTax || 0)
      : parseFloat(taxInput || 0);
    if (taxValue < 0) tempErrors.taxInput = "Tax cannot be negative";

    if (
      editIndex === null &&
      items.find(i => i.productId === parseInt(selectedProduct))
    ) tempErrors.product = "Product already added";

    if (inventory && quantity > inventory.currentQuantity)
      tempErrors.quantity = "Exceeds available stock";

    setErrors(tempErrors);
    if (Object.keys(tempErrors).length > 0) return;

    const product   = products.find(p => p.id === parseInt(selectedProduct));
    const taxAmount = taxMode === "PRODUCT"
      ? (taxType === "PERCENT"
        ? (price * parseInt(quantity) * taxValue) / 100
        : taxValue)
      : 0; // common tax applied globally

    const batchMeta = availableBatches.find(b => String(b.batchId) === String(selectedBatchId));
    const item = {
      productId:   parseInt(selectedProduct),
      productName: product?.name || "",
      quantity:    parseInt(quantity),
      sellingPrice: price,
      taxAmount,
      gstRate:  taxValue,
      batchId:  selectedBatchId ? parseInt(selectedBatchId) : null,
      batchNumber: selectedBatchId ? (batchMeta?.batchNumber || "") : "AUTO",
      expiryDate:  selectedBatchId ? (batchMeta?.expiryDate || "") : "",
    };

    if (editIndex !== null) {
      const updated = [...items];
      updated[editIndex] = item;
      setItems(updated);
      setEditIndex(null);
    } else {
      setItems(prev => [...prev, item]);
    }
    clearInputs();
  };

  const editItem = async (index) => {
    const it = items[index];
    setEditIndex(index);
    setSelectedProduct(it.productId);
    setQuantity(it.quantity);
    setManualPrice(it.sellingPrice);
    setTaxInput(it.taxAmount);
    setSelectedBatchId(it.batchId || "");
    setErrors({});

    try {
      const pRes  = await fetch(`http://localhost:8080/api/Product/GetProductById/${it.productId}`, { credentials: "include" });
      const pJson = await pRes.json();
      if (pJson?.data) {
        const typeId = pJson.data.productTypeId;
        setSelectedType(typeId); lastLoadedType.current = typeId;
        const [lRes, iRes] = await Promise.all([
          fetch(`http://localhost:8080/api/Product/GetProdByProdId/${typeId}`, { credentials: "include" }),
          fetch(`http://localhost:8080/api/Inventory/GetInventoryByProdId/${it.productId}`, { credentials: "include" }),
        ]);
        const lJson = await lRes.json();
        const iJson = await iRes.json();
        if (Array.isArray(lJson?.data)) setProducts(lJson.data);
        if (iJson?.status === 200) setInventory(iJson.data);
      }
    } catch {}
  };

  const increaseQty = (i) => { const u = [...items]; u[i].quantity++; setItems(u); };
  const decreaseQty = (i) => { const u = [...items]; if (u[i].quantity > 1) { u[i].quantity--; setItems(u); } };
  const deleteItem  = (i) => { const u = [...items]; u.splice(i, 1); setItems(u); };

  const clearInputs = () => {
    setSelectedType(""); setSelectedProduct(""); setProducts(allProducts);
    setInventory(null); setQuantity(1); setManualPrice(""); setTaxInput("");
    setAvailableBatches([]); setSelectedBatchId(""); setEditIndex(null); setErrors({});
  };

  const resetAll = () => {
    setItems([]); clearInputs();
    setCommonTax("18"); setTaxMode("COMMON"); setTaxType("PERCENT");
    setDiscountInput(""); setDiscountType("PERCENT");
    setSelectedRetailer(""); setBillingMode("CASH");
    setCreditPaymentType("PAID"); setAmountPaid(""); setDueDate("");
    setErrors({});
  };

  /* ══════════ SUBMIT ══════════ */
  const submitSales = async () => {
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
    if (Object.keys(tempErrors).length > 0) return;

    const finalDiscount = discountType === "PERCENT"
      ? (subTotal * (parseFloat(discountInput) || 0)) / 100
      : parseFloat(discountInput || 0);

  const totalBeforeTax = items.reduce(
  (s, i) => s + i.sellingPrice * i.quantity,
  0
);

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

    const taxAmount =
      taxMode === "COMMON"
        ? (itemTotal / totalBeforeTax) * commonTaxAmount   // ✅ distribute
        : it.taxAmount;

    return {
      productId: it.productId,
      quantity: it.quantity,
      sellingPrice: it.sellingPrice,
      taxAmount: parseFloat(taxAmount.toFixed(2)), // ✅ important
      batchId: it.batchId || null,
    };
  }),
};
    try {
      const res  = await fetch("http://localhost:8080/api/Sales/AddSales", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      toast.success("Sale added successfully");
      if (onSubmit) onSubmit();
      setViewUkey(data.data?.uKey || null);
      setIsViewOpen(true);
      resetAll();
    } catch (err) {
      console.error(err);
      toast.error("Failed to add sale");
    }
  };

  /* ══════════ DERIVED DISPLAY ══════════ */
  const selectedBatchMeta = availableBatches.find(b => String(b.batchId) === String(selectedBatchId));

  /* ══════════ RENDER ══════════ */
  return (
    <div className="san-page">
      <canvas ref={canvasRef} className="san-canvas" />
      <div className="san-noise" />
      <div className="san-top-beam" />

      <div className="san-content">
        {/* ── Page Header ── */}
        <div className="san-page-header">
          <div className="san-badge"><span className="san-badge-dot" />NEW TRANSACTION</div>
          <h1 className="san-page-title"><span className="san-title-acc">//</span> New Sale</h1>
          <div className="san-header-rule" />
        </div>

        <div className="san-layout">

          {/* ═══════════════════════════════
              LEFT — Item Builder
          ═══════════════════════════════ */}
          <div className="san-panel">
            <div className="san-panel-header">
              <div className="san-panel-title">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                {editIndex !== null ? "Edit Item" : "Add Item"}
              </div>
            </div>
            <div className="san-panel-body">

              {/* Product Type */}
              <Dropdown
                label="Product Type"
                options={productTypes}
                selectedId={selectedType}
                onSelect={handleTypeSelect}
                placeholder="Select product type"
                error={errors.selectedType}
              />

              {/* Product */}
              <Dropdown
                label="Product"
                options={products}
                selectedId={selectedProduct}
                onSelect={handleProductSelect}
                placeholder="Choose a product"
                error={errors.product}
              />

              {/* Inventory / Manual Price */}
              {inventory ? (
                <div className="san-inv-box">
                  <div>
                    <span className="san-inv-label">Selling Price</span>
                    <span className="san-inv-value">₹{inventory.unitSellingPrice}</span>
                  </div>
                  <div>
                    <span className="san-inv-label">In Stock</span>
                    <span className="san-inv-value">{inventory.currentQuantity} units</span>
                  </div>
                </div>
              ) : selectedProduct ? (
                <div className="san-field">
                  <label>Selling Price (₹)</label>
                  <input
                    type="number" value={manualPrice}
                    onChange={e => setManualPrice(e.target.value)}
                    placeholder="Enter price"
                    className={errors.price ? "san-input-err" : ""}
                  />
                  {errors.price && <span className="san-err">{errors.price}</span>}
                </div>
              ) : null}

              {/* Batch Selection */}
              {availableBatches.length > 0 && (
                <div className="san-field">
                  <label>Batch</label>
                  <select
                    value={selectedBatchId}
                    onChange={e => setSelectedBatchId(e.target.value)}
                    className="san-select"
                  >
                    <option value="">Auto-select (FIFO — oldest expiry first)</option>
                    {availableBatches.map(b => (
                      <option key={b.batchId} value={b.batchId}>
                        {b.batchNumber} · Exp: {b.expiryDate} · Qty: {b.availableQuantity}
                        {b.expiryStatus === "EXPIRING_SOON" ? " ⚠️"
                          : b.expiryStatus === "EXPIRED" ? " ❌" : " ✅"}
                      </option>
                    ))}
                  </select>
                  {selectedBatchMeta && (
                    <div className="san-inv-box" style={{ marginTop: 6 }}>
                      <div>
                        <span className="san-inv-label">Batch #</span>
                        <span className="san-inv-value">{selectedBatchMeta.batchNumber}</span>
                      </div>
                      <div>
                        <span className="san-inv-label">Expiry</span>
                        <span className="san-inv-value" style={{
                          color: selectedBatchMeta.expiryStatus === "EXPIRING_SOON" ? "#fbbf24"
                            : selectedBatchMeta.expiryStatus === "EXPIRED" ? "#fca5a5" : "#6ee7b7"
                        }}>
                          {selectedBatchMeta.expiryDate}
                        </span>
                      </div>
                      <div>
                        <span className="san-inv-label">MRP</span>
                        <span className="san-inv-value">₹{selectedBatchMeta.mrp}</span>
                      </div>
                      <div>
                        <span className="san-inv-label">Stock</span>
                        <span className="san-inv-value">{selectedBatchMeta.availableQuantity}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {availableBatches.length === 0 && selectedProduct && (
                <div className="san-inv-box" style={{ color: "#fca5a5", fontSize: 12 }}>
                  ⚠ No batches found. Add stock via Purchase first.
                </div>
              )}

              {/* Quantity */}
              <div className="san-field">
                <label>Quantity</label>
                <input
                  type="number" value={quantity} min="1"
                  onChange={e => {
                    const v = e.target.value.replace(/^0+/, "");
                    setQuantity(!v || +v < 1 ? 1 : +v);
                  }}
                  className={errors.quantity ? "san-input-err" : ""}
                />
                {errors.quantity && <span className="san-err">{errors.quantity}</span>}
              </div>

              {/* GST Mode */}
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
                        background: taxMode === val ? "rgba(59,130,246,0.15)" : "rgba(0,0,0,0.4)",
                        border: `1px solid ${taxMode === val ? "rgba(59,130,246,0.4)" : "rgba(255,255,255,0.07)"}`,
                        borderRadius: 8, color: taxMode === val ? "#93c5fd" : "rgba(100,110,130,0.8)",
                        fontFamily: "var(--san-font-m)", fontSize: 10, letterSpacing: "0.08em",
                        cursor: "pointer", transition: "all 0.2s",
                      }}
                    >{lbl}</button>
                  ))}
                </div>
              </div>

              {/* GST Inputs */}
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
                  <label>Product GST {taxType === "PERCENT" ? "Rate (%)" : "Amount (₹)"}</label>
                  <div className="san-tax-row">
                    {taxType === "PERCENT" ? (
                      <select value={taxInput} onChange={e => setTaxInput(e.target.value)} className="san-select">
                        <option value="">Select GST rate</option>
                        {GST_RATES.map(r => (
                          <option key={r} value={r}>{r}%{r === 18 ? " (Standard)" : r === 0 ? " (Exempt)" : ""}</option>
                        ))}
                      </select>
                    ) : (
                      <input type="number" value={taxInput} onChange={e => setTaxInput(e.target.value)} placeholder="Flat GST amount" />
                    )}
                    <select value={taxType} onChange={e => setTaxType(e.target.value)} className="san-select san-select-sm">
                      <option value="PERCENT">% Rate</option>
                      <option value="FLAT">₹ Flat</option>
                    </select>
                  </div>
                  {errors.taxInput && <span className="san-err">{errors.taxInput}</span>}
                </div>
              )}

              {/* Buttons */}
              <div className="san-btn-row">
                <button className="san-btn-primary" onClick={addItem}>
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d={editIndex !== null ? "M1 5.5h9M5.5 1v9" : "M5.5 1v9M1 5.5h9"}
                      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                  {editIndex !== null ? "Update Item" : "Add Item"}
                </button>
                <button className="san-btn-ghost" onClick={clearInputs} type="button">
                  {editIndex !== null ? "Cancel Edit" : "Clear"}
                </button>
              </div>

            </div>
          </div>

          {/* ═══════════════════════════════
              RIGHT — Cart & Billing
          ═══════════════════════════════ */}
          <div className="san-panel">
            <div className="san-panel-header">
              <div className="san-panel-title">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M1 1.5h1.5l1.5 6h5l1-4H4" stroke="currentColor" strokeWidth="1.2"
                    strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="5.5" cy="10" r="0.8" fill="currentColor"/>
                  <circle cx="9.5" cy="10" r="0.8" fill="currentColor"/>
                </svg>
                Cart & Billing
              </div>
              <span className="san-item-count">{items.length} item{items.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="san-panel-body san-panel-body-right">

              {/* ── Items list ── */}
              <div className="san-items-list">
                {items.length === 0 ? (
                  <div className="san-empty-cart">
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                      <circle cx="14" cy="14" r="12" stroke="rgba(59,130,246,0.2)" strokeWidth="1.5"/>
                      <path d="M9 14h10M14 9v10" stroke="rgba(59,130,246,0.25)" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    No items added yet
                  </div>
                ) : items.map((item, idx) => (
                  <div key={idx} className="san-item-row" style={{ animationDelay: `${idx * 0.04}s` }}>
                    <div className="san-item-info">
                      <span className="san-item-name">{item.productName}</span>
                      <span className="san-item-unit">
                        ₹{item.sellingPrice} / unit
                        {item.batchNumber && item.batchNumber !== "AUTO" && (
                          <> · <span style={{ color: "#93c5fd" }}>Batch: {item.batchNumber}</span></>
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
                      {/* Edit */}
                      <button
                        onClick={() => editItem(idx)}
                        style={{
                          width: 26, height: 26, background: "rgba(59,130,246,0.08)",
                          border: "1px solid rgba(59,130,246,0.2)", borderRadius: 6,
                          color: "#93c5fd", cursor: "pointer", display: "flex",
                          alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0,
                        }}
                        title="Edit"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" height="12px" viewBox="0 -960 960 960" width="12px" fill="currentColor">
                          <path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Z"/>
                        </svg>
                      </button>
                      {/* Delete */}
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

              {/* ── Totals ── */}
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

              {/* ── Billing section ── */}
              <div className="san-billing-section">

                {/* Retailer */}
                <Dropdown
                  label="Retailer (optional — blank = walk-in)"
                  options={retailers}
                  selectedId={selectedRetailer}
                  onSelect={setSelectedRetailer}
                  placeholder="Search retailer..."
                  error={errors.retailerId}
                />

                {/* Billing Mode (hidden for CREDIT) */}
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

                {/* Payment Type */}
                <div className="san-field">
                  <label>Payment Type</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    {PAYMENT_TYPES.map(({ id, name }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          setCreditPaymentType(id);
                          if (id === "PAID")   setAmountPaid(netAmount.toFixed(2));
                          if (id === "CREDIT") setAmountPaid("0");
                          if (id === "PARTIAL") setAmountPaid("");
                        }}
                        style={{
                          flex: 1, padding: "7px 4px",
                          background: creditPaymentType === id ? "rgba(59,130,246,0.15)" : "rgba(0,0,0,0.4)",
                          border: `1px solid ${creditPaymentType === id ? "rgba(59,130,246,0.4)" : "rgba(255,255,255,0.07)"}`,
                          borderRadius: 8, color: creditPaymentType === id ? "#93c5fd" : "rgba(100,110,130,0.8)",
                          fontFamily: "var(--san-font-m)", fontSize: 9, letterSpacing: "0.05em",
                          cursor: "pointer", transition: "all 0.2s", textAlign: "center",
                        }}
                      >{name}</button>
                    ))}
                  </div>
                </div>

                {/* Due Date */}
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

                {/* Amount Paid */}
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

                {/* Due badge */}
                {creditPaymentType !== "PAID" && parseFloat(amountPaid) >= 0 && (
                  <div className="san-due-badge">
                    Due: ₹{Math.max(0, netAmount - parseFloat(amountPaid || 0)).toFixed(2)}
                  </div>
                )}
              </div>

              {/* Submit */}
              <button className="san-btn-submit" onClick={submitSales}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M2 6.5l3 3 6-6" stroke="currentColor" strokeWidth="1.6"
                    strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Submit &amp; View Invoice
              </button>

            </div>
          </div>

        </div>{/* end san-layout */}
      </div>{/* end san-content */}

      {isViewOpen && (
        <SalesView
          uKey={viewUkey}
          onClose={() => { setIsViewOpen(false); setViewUkey(null); }}
        />
      )}
    </div>
  );
}
