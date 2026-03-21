import React, { useEffect, useState, useRef } from "react";
import "../../Styles/Sales/SalesAddNew.css";
import { toast } from "react-toastify";
import SalesView from "./SalesView";

/* ─────────────────────────────────────────
   SEARCHABLE DROPDOWN
───────────────────────────────────────── */
const Dropdown = ({ label, options, selectedId, onSelect, placeholder, error }) => {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState("");
  const ref                 = useRef(null);

  // Close on outside click — also clears search so stale filter doesn't persist
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

  // Loose comparison: handles string "5" vs number 5
  const selectedOption = options.find(o => String(o.id) === String(selectedId));

  // While open show the search text; when closed show selected name (or empty for placeholder)
  const displayValue = open ? search : (selectedOption?.name ?? "");

  const filtered = options.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggle = (e) => {
    e.stopPropagation();
    if (!open) setSearch(""); // reset search every time we open
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
        <svg className={`san-dd-chevron ${open ? "san-dd-chevron-up" : ""}`} width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M2 4L5.5 7.5L9 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {open && (
          <ul className="san-dd-list">
            {filtered.map(o => (
              <li
                key={o.id}
                className={String(o.id) === String(selectedId) ? "san-dd-selected" : ""}
                onMouseDown={e => {
                  // onMouseDown fires before the input's onBlur so the value is set
                  // before the dropdown closes, preventing a flash of empty value
                  e.preventDefault();
                  onSelect(o.id);
                  setOpen(false);
                  setSearch("");
                }}
              >
                {String(o.id) === String(selectedId) && (
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{flexShrink:0}}>
                    <path d="M1 4L3 6L7 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
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
   GST RATES
───────────────────────────────────────── */
const GST_RATES = [0, 5, 12, 18, 28];

export default function SalesAddNew({ onClose, onSubmit }) {
  const canvasRef    = useRef(null);
  const animFrameRef = useRef(null);

  const [productTypes, setProductTypes] = useState([]);
  const [products, setProducts]         = useState([]);
  const [allProducts, setAllProducts]   = useState([]);
  const [inventory, setInventory]       = useState(null);

  const [selectedType, setSelectedType]       = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity]               = useState(1);
  const [manualPrice, setManualPrice]         = useState("");

  const [commonTax, setCommonTax] = useState("18");
  const [taxType, setTaxType]     = useState("PERCENT");

  const [items, setItems]         = useState([]);
  const [discount, setDiscount]   = useState(0);
  const [billingMode, setBillingMode] = useState("CASH");
  const [amountPaid, setAmountPaid]   = useState(0);

  const [errors, setErrors]       = useState({});
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewUkey, setViewUkey]     = useState(null);

  const billingModes = [
    { id: "CASH",   name: "Cash" },
    { id: "ONLINE", name: "Online / UPI" },
    { id: "CARD",   name: "Card" },
  ];

  /* ── 3D CANVAS ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener("resize", resize);

    const orbs = Array.from({ length: 4 }, (_, i) => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      r: 80 + Math.random() * 160, vx: (Math.random() - 0.5) * 0.18, vy: (Math.random() - 0.5) * 0.18,
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
        if (o.x < -o.r) o.x = canvas.width + o.r;
        if (o.x > canvas.width + o.r) o.x = -o.r;
        if (o.y < -o.r) o.y = canvas.height + o.r;
        if (o.y > canvas.height + o.r) o.y = -o.r;
        const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
        g.addColorStop(0, `hsla(${o.hue},75%,55%,${o.alpha})`); g.addColorStop(1, "transparent");
        ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
      });

      const vig = ctx.createRadialGradient(canvas.width/2, canvas.height/2, canvas.height*0.1, canvas.width/2, canvas.height/2, canvas.height*0.9);
      vig.addColorStop(0, "rgba(0,0,0,0)"); vig.addColorStop(1, "rgba(0,0,0,0.65)");
      ctx.fillStyle = vig; ctx.fillRect(0, 0, canvas.width, canvas.height);

      animFrameRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { window.removeEventListener("resize", resize); cancelAnimationFrame(animFrameRef.current); };
  }, []);

  /* ── FETCH ── */
  useEffect(() => {
    fetch("http://localhost:8080/api/ProductType/GetAllProductType", { credentials: "include" })
      .then(r => r.json()).then(j => setProductTypes(j?.data?.productTypes || []));

    fetch("http://localhost:8080/api/Product/GetAllProduct", { credentials: "include" })
      .then(r => r.json()).then(j => {
        const list = j?.data?.products || [];
        setProducts(list); setAllProducts(list);
      });
  }, []);

  const loadProducts = (typeId) => {
    setSelectedType(typeId); setInventory(null); setErrors({});
    if (!typeId) { setProducts(allProducts); return; }
    fetch(`http://localhost:8080/api/Product/GetProdByProdId/${typeId}`, { credentials: "include" })
      .then(r => r.json()).then(j => setProducts(j?.data || []));
  };

  const loadInventory = async (prodId) => {
    setSelectedProduct(prodId); setErrors({});
    const prod = products.find(p => p.id === +prodId);
    if (prod && !selectedType) {
      try {
        const res = await fetch(`http://localhost:8080/api/ProductType/GetProdTypeById/${prod.productTypeId}`, { credentials: "include" });
        const json = await res.json();
        if (json?.data) setSelectedType(json.data.id);
      } catch (err) { console.error(err); }
    }
    fetch(`http://localhost:8080/api/Inventory/GetInventoryByProdId/${prodId}`, { credentials: "include" })
      .then(r => r.json()).then(j => setInventory(j?.status === 200 ? j.data : null));
  };

  useEffect(() => {
    if (!selectedProduct) return;
    const prod = allProducts.find(p => p.id === +selectedProduct);
    if (!prod) return;
    if (prod.productTypeId !== +selectedType) { setSelectedType(prod.productTypeId); loadProducts(prod.productTypeId); }
  }, [selectedProduct]);

  const clearInputs = () => {
    setSelectedType(""); setSelectedProduct(""); setProducts(allProducts);
    setInventory(null); setQuantity(1); setManualPrice(""); setErrors({});
  };

  const addItem = () => {
    let tempErrors = {};
    if (!selectedProduct) tempErrors.product = "Select a product";
    if (!quantity || quantity <= 0) tempErrors.quantity = "Quantity must be ≥ 1";
    const price = inventory ? inventory.unitSellingPrice : parseFloat(manualPrice);
    if (!price || price <= 0) tempErrors.price = "Enter valid selling price";
    if (items.find(i => i.productId === +selectedProduct)) tempErrors.product = "Product already added";
    if (inventory && quantity > inventory.currentQuantity) tempErrors.quantity = "Exceeds available stock";
    setErrors(tempErrors);
    if (Object.keys(tempErrors).length > 0) return;

    const product = products.find(p => p.id === +selectedProduct);
    setItems(prev => [...prev, { productId: +selectedProduct, productName: product?.name, quantity, price }]);
    clearInputs();
  };

  const increaseQty = (i) => { const u = [...items]; u[i].quantity++; setItems(u); };
  const decreaseQty = (i) => { const u = [...items]; if (u[i].quantity > 1) { u[i].quantity--; setItems(u); } };
  const deleteItem  = (i) => { const u = [...items]; u.splice(i, 1); setItems(u); };

  const subTotal   = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const taxValue   = Number(commonTax) || 0;
  const taxAmount  = taxType === "PERCENT" ? (subTotal * taxValue) / 100 : taxValue;
  const total      = subTotal + taxAmount - discount;

  const resetAll = () => {
    setItems([]); clearInputs(); setCommonTax("18"); setTaxType("PERCENT");
    setDiscount(0); setBillingMode("CASH"); setAmountPaid(0); setErrors({});
  };

  const submitSales = async () => {
    let tempErrors = {};
    if (items.length === 0) tempErrors.items = "Add at least one item";
    if (!billingMode) tempErrors.billingMode = "Select billing mode";
    if (discount < 0) tempErrors.discount = "Discount cannot be negative";
    if (amountPaid === "" || amountPaid === null) tempErrors.amountPaid = "Enter amount paid";
    if (amountPaid < 0) tempErrors.amountPaid = "Invalid amount paid";
    if (Number(amountPaid) > total) tempErrors.amountPaid = "Cannot exceed total";
    setErrors(tempErrors);
    if (Object.keys(tempErrors).length > 0) return;

    const payload = {
      billingMode, totalDiscount: discount, amountPaid,
      remainingAmount: total - amountPaid,
      items: items.map(i => ({
        productId: i.productId, quantity: i.quantity, sellingPrice: i.price,
        taxAmount: items.length ? taxAmount / items.length : 0,
      })),
    };

    try {
      const res = await fetch("http://localhost:8080/api/Sales/AddSales", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      toast.success("Sale added successfully");
      setViewUkey(data.data?.uKey || null);
      setIsViewOpen(true);
      resetAll();
    } catch (error) {
      console.error(error);
      toast.error("Failed to add sale");
    }
  };

  return (
    <div className="san-page">
      <canvas ref={canvasRef} className="san-canvas" />
      <div className="san-noise" />
      <div className="san-top-beam" />

      <div className="san-content">
        {/* Page header */}
        <div className="san-page-header">
          <div className="san-badge"><span className="san-badge-dot" />NEW TRANSACTION</div>
          <h1 className="san-page-title"><span className="san-title-acc">//</span> New Sale</h1>
          <div className="san-header-rule" />
        </div>

        {/* Two-panel layout */}
        <div className="san-layout">

          {/* ── LEFT — Add Item ── */}
          <div className="san-panel">
            <div className="san-panel-header">
              <div className="san-panel-title">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Add Item
              </div>
            </div>
            <div className="san-panel-body">

              <Dropdown
                label="Product Type"
                options={productTypes}
                selectedId={+selectedType}
                onSelect={loadProducts}
                placeholder="Select product type"
              />

              <Dropdown
                label="Product"
                options={products}
                selectedId={+selectedProduct}
                onSelect={loadInventory}
                placeholder="Choose a product"
                error={errors.product}
              />

              {inventory ? (
                <div className="san-inv-box">
                  <div><span className="san-inv-label">Selling Price</span><span className="san-inv-value">₹{inventory.unitSellingPrice}</span></div>
                  <div><span className="san-inv-label">In Stock</span><span className="san-inv-value">{inventory.currentQuantity} units</span></div>
                </div>
              ) : selectedProduct ? (
                <div className="san-field">
                  <label>Selling Price (₹)</label>
                  <input type="number" value={manualPrice} onChange={e => setManualPrice(e.target.value)} placeholder="Enter price" className={errors.price ? "san-input-err" : ""} />
                  {errors.price && <span className="san-err">{errors.price}</span>}
                </div>
              ) : null}

              <div className="san-field">
                <label>Quantity</label>
                <input
                  type="number" value={quantity} min="1"
                  onChange={e => {
                    let v = e.target.value.replace(/^0+/, "");
                    setQuantity(!v || +v < 1 ? 1 : +v);
                  }}
                  className={errors.quantity ? "san-input-err" : ""}
                />
                {errors.quantity && <span className="san-err">{errors.quantity}</span>}
              </div>

              <div className="san-field">
                <label>GST Rate</label>
                <div className="san-tax-row">
                  {taxType === "PERCENT" ? (
                    <select value={commonTax} onChange={e => setCommonTax(e.target.value)} className="san-select">
                      {GST_RATES.map(r => <option key={r} value={r}>{r}%{r === 18 ? " (Standard)" : r === 0 ? " (Exempt)" : ""}</option>)}
                    </select>
                  ) : (
                    <input type="number" value={commonTax} onChange={e => setCommonTax(e.target.value)} placeholder="Flat GST amount" />
                  )}
                  <select value={taxType} onChange={e => setTaxType(e.target.value)} className="san-select san-select-sm">
                    <option value="PERCENT">% Rate</option>
                    <option value="FLAT">₹ Flat</option>
                  </select>
                </div>
              </div>

              <div className="san-btn-row">
                <button className="san-btn-primary" onClick={addItem}>
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                  Add Item
                </button>
                <button className="san-btn-ghost" onClick={clearInputs} type="button">
                  Clear
                </button>
              </div>

            </div>
          </div>

          {/* ── RIGHT — Cart + Billing ── */}
          <div className="san-panel">
            <div className="san-panel-header">
              <div className="san-panel-title">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M1 1.5h1.5l1.5 6h5l1-4H4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="5.5" cy="10" r="0.8" fill="currentColor"/>
                  <circle cx="9.5" cy="10" r="0.8" fill="currentColor"/>
                </svg>
                Cart & Billing
              </div>
              <span className="san-item-count">{items.length} item{items.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="san-panel-body san-panel-body-right">

              {/* Items list */}
              <div className="san-items-list">
                {items.length === 0 ? (
                  <div className="san-empty-cart">
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                      <circle cx="14" cy="14" r="12" stroke="rgba(59,130,246,0.2)" strokeWidth="1.5"/>
                      <path d="M9 14h10M14 9v10" stroke="rgba(59,130,246,0.25)" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    No items added yet
                  </div>
                ) : (
                  items.map((item, idx) => (
                    <div key={idx} className="san-item-row" style={{ animationDelay: `${idx * 0.04}s` }}>
                      <div className="san-item-info">
                        <span className="san-item-name">{item.productName}</span>
                        <span className="san-item-unit">₹{item.price} / unit</span>
                      </div>
                      <div className="san-item-controls">
                        <div className="san-qty-ctrl">
                          <button onClick={() => decreaseQty(idx)}>−</button>
                          <span>{item.quantity}</span>
                          <button onClick={() => increaseQty(idx)}>+</button>
                        </div>
                        <span className="san-item-total">₹{(item.price * item.quantity).toFixed(2)}</span>
                        <button className="san-delete-btn" onClick={() => deleteItem(idx)}>
                          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                            <path d="M1.5 3h8M4.5 3V2h2v1M2.5 3l.5 6h5l.5-6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {errors.items && <span className="san-err">{errors.items}</span>}

              {/* Totals */}
              <div className="san-totals">
                <div className="san-total-row"><span>Subtotal</span><span>₹{subTotal.toFixed(2)}</span></div>
                <div className="san-total-row"><span>GST ({commonTax}{taxType === "PERCENT" ? "%" : "₹"})</span><span>₹{taxAmount.toFixed(2)}</span></div>
                <div className="san-total-row">
                  <span>Discount</span>
                  <input type="number" className="san-discount-input" placeholder="0" onChange={e => setDiscount(+e.target.value)} />
                </div>
                {errors.discount && <span className="san-err">{errors.discount}</span>}
                <div className="san-total-divider" />
                <div className="san-total-row san-total-net">
                  <span>Total</span>
                  <span>₹{total.toFixed(2)}</span>
                </div>
              </div>

              {/* Billing */}
              <div className="san-billing-section">
                <Dropdown
                  label="Billing Mode"
                  options={billingModes}
                  selectedId={billingMode}
                  onSelect={setBillingMode}
                  placeholder="Select billing mode"
                  error={errors.billingMode}
                />

                <div className="san-field">
                  <label>Amount Paid (₹)</label>
                  <input type="number" placeholder="0.00" onChange={e => setAmountPaid(+e.target.value)} className={errors.amountPaid ? "san-input-err" : ""} />
                  {errors.amountPaid && <span className="san-err">{errors.amountPaid}</span>}
                </div>

                {Number(amountPaid) > 0 && Number(amountPaid) < total && (
                  <div className="san-due-badge">
                    Due: ₹{(total - Number(amountPaid)).toFixed(2)}
                  </div>
                )}
              </div>

              <button className="san-btn-submit" onClick={submitSales}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M2 6.5l3 3 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Submit & View Invoice
              </button>

            </div>
          </div>
        </div>
      </div>

      {isViewOpen && (
        <SalesView
          uKey={viewUkey}
          onClose={() => { setIsViewOpen(false); setViewUkey(null); }}
        />
      )}
    </div>
  );
}
