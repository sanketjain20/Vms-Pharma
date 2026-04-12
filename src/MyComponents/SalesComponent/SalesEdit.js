import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import "../../Styles/Sales/AddSales.css";

const GST_RATES = [0, 5, 12, 18, 28];

const SearchableDropdown = ({
  label, options, selectedId, onSelect,
  search, setSearch, open, setOpen,
  placeholder, dropdownRef, error
}) => {
  const selectedOption = options.find(o => String(o.id) === String(selectedId));
  const displayValue   = open ? search : (selectedOption?.name ?? "");
  const filtered = options.filter(o => o.name.toLowerCase().includes(search.toLowerCase()));
  const handleOpen = (e) => { e.stopPropagation(); if (!open) setSearch(""); setOpen(true); };
  return (
    <div className="custom-select" ref={dropdownRef}>
      <label>{label}</label>
      <div className={`select-box ${open ? "active" : ""}`} onClick={handleOpen}>
        <input type="text" value={displayValue} placeholder={placeholder}
          onChange={e => setSearch(e.target.value)} onClick={handleOpen} className="select-input" />
        {open && (
          <ul className="options scroll-options">
            {filtered.map(o => (
              <li key={o.id}
                onMouseDown={e => { e.preventDefault(); onSelect(o.id); setOpen(false); setSearch(""); }}
                style={String(o.id) === String(selectedId) ? { color: "#93c5fd", background: "rgba(59,130,246,0.1)" } : {}}
              >{o.name}</li>
            ))}
            {filtered.length === 0 && <li style={{ color: "#525667", fontStyle: "italic" }}>No results found</li>}
          </ul>
        )}
      </div>
      {error && <div className="error">{error}</div>}
    </div>
  );
};

export default function SalesEdit({ uKey, onClose, onSubmit }) {
  // ── Existing state ────────────────────────────────────────────────────────
  const [productTypes, setProductTypes] = useState([]);
  const [products, setProducts]         = useState([]);
  const [allProducts, setAllProducts]   = useState([]);
  const lastLoadedType                  = useRef(null);
  const [inventory, setInventory]       = useState(null);
  const [selectedType, setSelectedType]       = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity]     = useState("");
  const [taxInput, setTaxInput]     = useState("");
  const [taxType, setTaxType]       = useState("PERCENT");
  const [manualPrice, setManualPrice]   = useState("");
  const [lineItems, setLineItems]       = useState([]);
  const [editIndex, setEditIndex]       = useState(null);
  const [discountInput, setDiscountInput] = useState("0");
  const [discountType, setDiscountType]   = useState("FLAT");
  const [billingMode, setBillingMode]     = useState("CASH");
  const [saleId, setSaleId]               = useState(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [amountPaid, setAmountPaid]       = useState(0);
  const [remainingAmount, setRemainingAmount] = useState(0);
  const [errors, setErrors]           = useState({});
  const [activeTab, setActiveTab]     = useState("Existing");
  const [originalItems, setOriginalItems] = useState([]);
  const [typeSearch, setTypeSearch]                   = useState("");
  const [productSearch, setProductSearch]             = useState("");
  const [typeDropdownOpen, setTypeDropdownOpen]       = useState(false);
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const typeDropdownRef    = useRef(null);
  const productDropdownRef = useRef(null);

  // ── NEW state ─────────────────────────────────────────────────────────────
  const [retailers, setRetailers]           = useState([]);
  const [selectedRetailer, setSelectedRetailer] = useState("");
  const [retailerSearch, setRetailerSearch]     = useState("");
  const [retailerDropdownOpen, setRetailerDropdownOpen] = useState(false);
  const retailerDropdownRef = useRef(null);
  const [creditPaymentType, setCreditPaymentType] = useState("PAID");
  const [dueDate, setDueDate]               = useState("");
  const [availableBatches, setAvailableBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId]   = useState("");

  const safeJson = async (res) => {
    try { const text = await res.text(); return text ? JSON.parse(text) : null; }
    catch { return null; }
  };

  /* ── FETCH RETAILERS ── */
  useEffect(() => {
    fetch("http://localhost:8080/api/Retailer/Dropdown", { method: "GET", credentials: "include" })
      .then(r => r.json())
      .then(json => setRetailers(
        (json?.data ?? []).map(r => ({ id: r.id, name: r.shopName + " · " + r.ownerName }))
      ))
      .catch(() => {});
  }, []);

  /* ── FETCH ALL PRODUCTS — unchanged ── */
  useEffect(() => {
    fetch("http://localhost:8080/api/Product/GetAllProduct", { method: "GET", credentials: "include", headers: { "Content-Type": "application/json" } })
      .then(r => r.json())
      .then(json => {
        const dataObj = json?.data;
        const list = Array.isArray(dataObj) ? dataObj : typeof dataObj === "object" ? Object.values(dataObj).find(v => Array.isArray(v)) || [] : [];
        setAllProducts(list); setProducts(list);
      }).catch(() => { setAllProducts([]); setProducts([]); });
  }, []);

  /* ── FETCH PRODUCT TYPES — unchanged ── */
  useEffect(() => {
    fetch("http://localhost:8080/api/ProductType/GetAllProductType", { method: "GET", credentials: "include", headers: { "Content-Type": "application/json" } })
      .then(safeJson)
      .then(json => { const list = json?.data?.productTypes ?? []; setProductTypes(Array.isArray(list) ? list : []); });
  }, []);

  /* ── FETCH SALE — updated to load new fields ── */
  useEffect(() => { if (uKey) fetchSaleByUkey(); }, [uKey]);

  const fetchSaleByUkey = () => {
    fetch(`http://localhost:8080/api/Sales/GetSalesByUkey/${uKey}`, {
      method: "GET", credentials: "include", headers: { "Content-Type": "application/json" },
    })
      .then(safeJson)
      .then(json => {
        if (!json?.data) return toast.error("Sale not found");
        const sale = json.data;
        setSaleId(sale.id);
        setInvoiceNumber(sale.invoiceNumber);
        setOriginalItems(sale.items);
        setLineItems(sale.items.map(i => ({
          productId: i.productId,
          productName: i.product,
          quantity: i.quantity,
          sellingPrice: i.sellingPrice,
          taxAmount: i.taxAmount,
          totalAmount: i.sellingPrice * i.quantity + i.taxAmount,
          // NEW — load existing batch snapshot data
          batchId: i.batchId || null,
          batchNumber: i.batchNumberSnapshot || "AUTO",
          expiryDate: i.expiryDateSnapshot || "",
        })));
        setDiscountInput(sale.totalDiscount || 0);
        setDiscountType("FLAT");
        setBillingMode(sale.billingMode || "CASH");
        setAmountPaid(sale.amountPaid || 0);
        setRemainingAmount(sale.remainingAmount || 0);
        // NEW — load existing retailer + payment fields
        if (sale.retailerId) setSelectedRetailer(String(sale.retailerId));
        setCreditPaymentType(sale.paymentType || "PAID");
        setDueDate(sale.dueDate || "");
      });
  };

  /* ── FETCH BATCHES when product selected ── */
  useEffect(() => {
    if (!selectedProduct) { setAvailableBatches([]); setSelectedBatchId(""); return; }
    fetch(`http://localhost:8080/api/Sales/GetAvailableBatches/${selectedProduct}`, { method: "GET", credentials: "include" })
      .then(r => r.json())
      .then(json => { if (json?.status === 200) setAvailableBatches(json.data ?? []); else setAvailableBatches([]); })
      .catch(() => setAvailableBatches([]));
  }, [selectedProduct]);

  const handleTypeChange = (e) => {
    const typeId = e.target.value;
    setSelectedType(typeId); setSelectedProduct(""); setInventory(null); setErrors({});
    setAvailableBatches([]); setSelectedBatchId("");
    if (!typeId) { setProducts(allProducts); return; }
    fetch(`http://localhost:8080/api/Product/GetProdByProdId/${typeId}`, { method: "GET", credentials: "include" })
      .then(safeJson).then(json => setProducts(json?.data ?? []));
  };

  /* ── AUTO SET TYPE — unchanged ── */
  useEffect(() => {
    if (!selectedProduct) return;
    fetch(`http://localhost:8080/api/ProductType/GetProdTypeByProductId/${selectedProduct}`, { credentials: "include" })
      .then(r => r.json())
      .then(json => {
        const typeId = json?.data?.productTypeId || json?.data?.id;
        if (typeId && typeId !== selectedType) {
          setSelectedType(typeId);
          if (lastLoadedType.current !== typeId) {
            lastLoadedType.current = typeId;
            fetch(`http://localhost:8080/api/Product/GetProdByProdId/${typeId}`, { credentials: "include" })
              .then(r => r.json())
              .then(json => { const list = json?.data ?? []; setProducts(Array.isArray(list) ? list : []); });
          }
        }
      }).catch(() => {});
  }, [selectedProduct]);

  const handleProductChange = (e) => {
    const prodId = e.target.value;
    setSelectedProduct(prodId); setInventory(null); setErrors({});
    setAvailableBatches([]); setSelectedBatchId("");
    if (!prodId) return;
    fetch(`http://localhost:8080/api/Inventory/GetInventoryByProdId/${prodId}`, { method: "GET", credentials: "include" })
      .then(safeJson).then(json => setInventory(json?.data || null));
  };

  /* ── CLICK OUTSIDE ── */
  useEffect(() => {
    const handler = (e) => {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target)) { setTypeDropdownOpen(false); setTypeSearch(""); }
      if (productDropdownRef.current && !productDropdownRef.current.contains(e.target)) { setProductDropdownOpen(false); setProductSearch(""); }
      if (retailerDropdownRef.current && !retailerDropdownRef.current.contains(e.target)) { setRetailerDropdownOpen(false); setRetailerSearch(""); }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const addOrUpdateItem = () => {
    let tempErrors = {};
    if (!selectedType) tempErrors.selectedType = "Select product type";
    if (!selectedProduct) tempErrors.selectedProduct = "Select product";
    if (!quantity || quantity <= 0) tempErrors.quantity = "Enter valid quantity";
    const product = products.find(p => p.id === parseInt(selectedProduct));
    if (!product) tempErrors.selectedProduct = tempErrors.selectedProduct || "Invalid product";
    let price = inventory ? inventory.unitSellingPrice : parseFloat(manualPrice);
    if (!price) tempErrors.manualPrice = "Enter valid price";
    let taxValue = parseFloat(taxInput || 0);
    if (taxValue < 0) tempErrors.taxInput = "Tax cannot be negative";
    setErrors(tempErrors);
    if (Object.keys(tempErrors).length > 0) return;

    const taxAmount = taxType === "PERCENT" ? (price * quantity * taxValue) / 100 : taxValue;
    const item = {
      productId: parseInt(selectedProduct),
      productName: product.name,
      quantity: parseInt(quantity),
      sellingPrice: price,
      taxAmount,
      totalAmount: price * quantity + taxAmount,
      // NEW
      batchId: selectedBatchId ? parseInt(selectedBatchId) : null,
      batchNumber: selectedBatchId
        ? availableBatches.find(b => String(b.batchId) === String(selectedBatchId))?.batchNumber || "AUTO"
        : "AUTO",
      expiryDate: selectedBatchId
        ? availableBatches.find(b => String(b.batchId) === String(selectedBatchId))?.expiryDate || ""
        : "",
    };

    let updated = [...lineItems];
    if (editIndex !== null) { updated[editIndex] = item; setEditIndex(null); }
    else updated.push(item);
    setLineItems(updated);
    clearForm();
    toast.success("Item saved");
  };

  const clearForm = () => {
    setSelectedType(""); setSelectedProduct(""); setQuantity("");
    setTaxInput(""); setManualPrice(""); setInventory(null);
    setTaxType("PERCENT"); setErrors({});
    setAvailableBatches([]); setSelectedBatchId("");
  };

  const editItem = async (index) => {
    const it = lineItems[index];
    setEditIndex(index);
    setSelectedProduct(it.productId); setQuantity(it.quantity);
    setManualPrice(it.sellingPrice);  setTaxInput(it.taxAmount);
    setTaxType("FLAT"); setErrors({});
    setSelectedBatchId(it.batchId ? String(it.batchId) : "");
    const iRes  = await fetch(`http://localhost:8080/api/Inventory/GetInventoryByProdId/${it.productId}`, { method: "GET", credentials: "include" });
    const iJson = await safeJson(iRes);
    if (iJson?.data) setInventory(iJson.data);
  };

  const deleteItem = (i) => { const u = [...lineItems]; u.splice(i, 1); setLineItems(u); };

  const getNetAmount = () => {
    let total    = lineItems.reduce((s, i) => s + i.totalAmount, 0);
    let discount = parseFloat(discountInput || 0);
    if (discountType === "PERCENT") discount = (total * discount) / 100;
    return total - discount;
  };

  useEffect(() => {
    const net = getNetAmount().toFixed(2);
    if (creditPaymentType === "PAID") { setAmountPaid(net); setRemainingAmount(0); }
    else if (creditPaymentType === "CREDIT") { setAmountPaid(0); setRemainingAmount(net); }
    else {
      const paid = parseFloat(amountPaid || 0);
      const rem  = net - paid;
      setRemainingAmount(rem < 0 ? 0 : rem);
    }
  }, [creditPaymentType, amountPaid, lineItems, discountInput]);

  const updateSale = () => {
    let tempErrors = {};
    if (lineItems.length === 0) tempErrors.lineItems = "Add at least one item";
    if (!billingMode) tempErrors.billingMode = "Select billing mode";
    if (discountInput < 0) tempErrors.discountInput = "Discount cannot be negative";
    if ((creditPaymentType === "CREDIT" || creditPaymentType === "PARTIAL") && !dueDate)
      tempErrors.dueDate = "Due date is required";
    const net = getNetAmount();
    if (creditPaymentType !== "CREDIT" && (!amountPaid || amountPaid <= 0)) tempErrors.amountPaid = "Enter valid amount paid";
    if (parseFloat(amountPaid) > net) tempErrors.amountPaid = "Amount paid cannot exceed net amount";
    setErrors(tempErrors);
    if (Object.keys(tempErrors).length > 0) return;

    fetch(`http://localhost:8080/api/Sales/UpdateSales/${saleId}`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        totalDiscount: parseFloat(discountInput || 0),
        billingMode,
        amountPaid: parseFloat(amountPaid),
        remainingAmount: parseFloat(remainingAmount),
        // NEW fields
        retailerId: selectedRetailer ? parseInt(selectedRetailer) : null,
        paymentType: creditPaymentType,
        dueDate: dueDate || null,
        items: lineItems.map(it => ({
          productId: it.productId,
          quantity: it.quantity,
          sellingPrice: it.sellingPrice,
          taxAmount: it.taxAmount,
          batchId: it.batchId || null,
        })),
      }),
    })
      .then(safeJson)
      .then(json => {
        if (json?.status === 200 || json?.success) { toast.success("Sales updated"); onSubmit(); onClose(); }
        else toast.error(json?.message || "Update failed");
      });
  };

  const totalAmount = lineItems.reduce((s, i) => s + i.totalAmount, 0);

  return (
    <div className="sales-modal show">
      <div className="sales-container">

        {/* ── HEADER ── */}
        <div className="sales-header">
          <div className="sales-header-left">
            <div className="sales-eyebrow"><span className="sales-eyebrow-dot" />EDIT TRANSACTION</div>
            <h3>Edit Sale {invoiceNumber && `· ${invoiceNumber}`}</h3>
          </div>
          <div className="tabs-header">
            {["Existing", "Product", "Billing"].map(tab => (
              <button key={tab} className={activeTab === tab ? "active-tab" : ""} onClick={() => setActiveTab(tab)}>
                {tab === "Existing" ? "Original Items" : tab}
              </button>
            ))}
            <button className="close-btn-sales" onClick={onClose} title="Close">✕</button>
          </div>
        </div>

        {/* ══════════════ EXISTING ITEMS TAB — updated with batch columns ══════════════ */}
        {activeTab === "Existing" && (
          <div className="sales-section">
            <h4>Original Line Items</h4>
            {originalItems.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "32px 0", fontFamily: "var(--sl-font-m)", fontSize: 11, letterSpacing: "0.08em", color: "var(--sl-text-2)" }}>
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <circle cx="14" cy="14" r="12" stroke="rgba(59,130,246,0.2)" strokeWidth="1.5"/>
                  <path d="M10 14h8" stroke="rgba(59,130,246,0.3)" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                No existing items
              </div>
            ) : (
              <>
                <table className="sales-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Batch No</th>
                      <th>Expiry</th>
                      <th>HSN</th>
                      <th>Qty</th>
                      <th>Price (₹)</th>
                      <th>GST (₹)</th>
                      <th>Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {originalItems.map((it, i) => (
                      <tr key={i}>
                        <td>{it.product}</td>
                        <td style={{ fontFamily: "var(--sl-font-m)", fontSize: 11, color: "#93c5fd" }}>{it.batchNumberSnapshot || "—"}</td>
                        <td style={{ fontSize: 11 }}>{it.expiryDateSnapshot || "—"}</td>
                        <td style={{ fontSize: 11, color: "var(--sl-text-2)" }}>{it.hsnCodeSnapshot || "—"}</td>
                        <td>{it.quantity}</td>
                        <td>{it.sellingPrice}</td>
                        <td>{it.taxAmount.toFixed(2)}</td>
                        <td>{(it.sellingPrice * it.quantity + it.taxAmount).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="total-amount">
                  Original Total (incl. GST): ₹{originalItems.reduce((s, i) => s + i.sellingPrice * i.quantity + i.taxAmount, 0).toFixed(2)}
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════════════ PRODUCT TAB — updated with batch selection ══════════════ */}
        {activeTab === "Product" && (
          <div className="sales-section">
            <h4>Update Products</h4>
            <div className="product-row">
              <SearchableDropdown label="Product Type" options={productTypes} selectedId={selectedType}
                onSelect={id => handleTypeChange({ target: { value: id } })}
                search={typeSearch} setSearch={setTypeSearch} open={typeDropdownOpen} setOpen={setTypeDropdownOpen}
                placeholder="Select product type" dropdownRef={typeDropdownRef} error={errors.selectedType}
              />
              <SearchableDropdown label="Product" options={products} selectedId={selectedProduct}
                onSelect={id => handleProductChange({ target: { value: id } })}
                search={productSearch} setSearch={setProductSearch} open={productDropdownOpen} setOpen={setProductDropdownOpen}
                placeholder="Select product" dropdownRef={productDropdownRef} error={errors.selectedProduct}
              />
            </div>

            {inventory ? (
              <div className="inv-box">
                <div>Selling Price: <b>₹{inventory.unitSellingPrice}</b></div>
                <div>Current Stock: <b>{inventory.currentQuantity}</b></div>
              </div>
            ) : selectedProduct ? (
              <div className="inv-box">
                <label>Set Selling Price</label>
                <input type="number" value={manualPrice} onChange={e => setManualPrice(e.target.value)} placeholder="Enter selling price" />
                {errors.manualPrice && <div className="error">{errors.manualPrice}</div>}
              </div>
            ) : null}

            {/* NEW — Batch selection */}
            {availableBatches.length > 0 && (
              <div className="inv-box" style={{ flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 10, letterSpacing: "0.12em", color: "var(--sl-text-2)", textTransform: "uppercase", fontFamily: "var(--sl-font-m)" }}>Batch Selection</div>
                <select value={selectedBatchId} onChange={e => setSelectedBatchId(e.target.value)} style={{ width: "100%" }}>
                  <option value="">Auto-select (FIFO — oldest expiry first)</option>
                  {availableBatches.map(b => (
                    <option key={b.batchId} value={b.batchId}>
                      {b.batchNumber} · Exp: {b.expiryDate} · Qty: {b.availableQuantity}
                      {b.expiryStatus === "EXPIRING_SOON" ? " ⚠️" : b.expiryStatus === "EXPIRED" ? " ❌" : " ✅"}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="quantity-tax-row">
              <div>
                <label>Quantity</label>
                <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Enter qty" />
                {errors.quantity && <div className="error">{errors.quantity}</div>}
              </div>
              <div className="tax-column">
                <label>GST Rate (%)</label>
                <div className="tax-input-row">
                  {taxType === "PERCENT" ? (
                    <select value={taxInput} onChange={e => setTaxInput(e.target.value)}>
                      <option value="">Select GST rate</option>
                      {GST_RATES.map(r => <option key={r} value={r}>{r}%{r === 18 ? " (Standard)" : r === 0 ? " (Exempt)" : ""}</option>)}
                    </select>
                  ) : (
                    <input type="number" value={taxInput} onChange={e => setTaxInput(e.target.value)} placeholder="GST amount (₹)" />
                  )}
                  <select value={taxType} onChange={e => setTaxType(e.target.value)} style={{ width: "90px" }}>
                    <option value="PERCENT">% Rate</option>
                    <option value="FLAT">₹ Flat</option>
                  </select>
                </div>
                {errors.taxInput && <div className="error">{errors.taxInput}</div>}
              </div>
            </div>

            <button className="add-btn" onClick={addOrUpdateItem}>
              {editIndex !== null ? "✓ Update Item" : "+ Add Item"}
            </button>
            {errors.lineItems && <div className="error">{errors.lineItems}</div>}

            {lineItems.length > 0 && (
              <>
                <table className="sales-table" style={{ marginTop: 14 }}>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Batch</th>
                      <th>Expiry</th>
                      <th>Qty</th>
                      <th>Price (₹)</th>
                      <th>GST (₹)</th>
                      <th>Total (₹)</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((it, i) => (
                      <tr key={i}>
                        <td>{it.productName}</td>
                        <td style={{ fontFamily: "var(--sl-font-m)", fontSize: 11, color: "#93c5fd" }}>{it.batchNumber || "AUTO"}</td>
                        <td style={{ fontSize: 11 }}>{it.expiryDate || "—"}</td>
                        <td>{it.quantity}</td>
                        <td>{it.sellingPrice}</td>
                        <td>{it.taxAmount}</td>
                        <td>{it.totalAmount.toFixed(2)}</td>
                        <td>
                          <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                            <button className="sl-action-btn edit" onClick={() => editItem(i)} title="Edit">
                              <svg xmlns="http://www.w3.org/2000/svg" height="14px" viewBox="0 -960 960 960" width="14px" fill="currentColor"><path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Z"/></svg>
                            </button>
                            <button className="sl-action-btn delete" onClick={() => deleteItem(i)} title="Delete">
                              <svg xmlns="http://www.w3.org/2000/svg" height="14px" viewBox="0 -960 960 960" width="14px" fill="currentColor"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360Z"/></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="total-amount">Updated Total (incl. GST): ₹{totalAmount.toFixed(2)}</div>
              </>
            )}
          </div>
        )}

        {/* ══════════════ BILLING TAB — updated ══════════════ */}
        {activeTab === "Billing" && (
          <div className="sales-section">
            <h4>Billing & Payment</h4>

            {/* NEW — Retailer */}
            <SearchableDropdown
              label="Retailer (optional)"
              options={retailers} selectedId={selectedRetailer}
              onSelect={id => setSelectedRetailer(id)}
              search={retailerSearch} setSearch={setRetailerSearch}
              open={retailerDropdownOpen} setOpen={setRetailerDropdownOpen}
              placeholder="Search retailer..." dropdownRef={retailerDropdownRef}
              error={errors.retailerId}
            />

            <label>Discount</label>
            <div className="tax-row">
              <input type="number" value={discountInput} onChange={e => setDiscountInput(e.target.value)} placeholder="0" />
              <select value={discountType} onChange={e => setDiscountType(e.target.value)}>
                <option value="FLAT">₹</option>
                <option value="PERCENT">%</option>
              </select>
            </div>
            {errors.discountInput && <div className="error">{errors.discountInput}</div>}

            <label>Billing Mode</label>
            <select value={billingMode} onChange={e => setBillingMode(e.target.value)}>
              <option value="CASH">Cash</option>
              <option value="ONLINE">Online / UPI</option>
              <option value="CARD">Card</option>
            </select>
            {errors.billingMode && <div className="error">{errors.billingMode}</div>}

            <div className="total-amount">Net Amount: ₹{getNetAmount().toFixed(2)}</div>

            {/* NEW — Credit payment type */}
            <label>Payment Type</label>
            <div className="radio-group">
              {["PAID", "CREDIT", "PARTIAL"].map(pt => (
                <label key={pt} className={`radio-option ${creditPaymentType === pt ? "checked" : ""}`}>
                  <input type="radio" checked={creditPaymentType === pt} onChange={() => setCreditPaymentType(pt)} />
                  {pt === "PAID" ? "Full Payment" : pt === "CREDIT" ? "Credit (Pay Later)" : "Partial Payment"}
                </label>
              ))}
            </div>

            {/* NEW — Due date */}
            {(creditPaymentType === "CREDIT" || creditPaymentType === "PARTIAL") && (
              <>
                <label>Due Date</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{ width: "100%" }} />
                {errors.dueDate && <div className="error">{errors.dueDate}</div>}
              </>
            )}

            <label>Amount Paid (₹)</label>
            <input
              type="number" value={amountPaid}
              onChange={e => setAmountPaid(e.target.value)}
              disabled={creditPaymentType === "PAID" || creditPaymentType === "CREDIT"}
              placeholder="0.00"
            />
            {errors.amountPaid && <div className="error">{errors.amountPaid}</div>}

            <div className="total-amount" style={{ borderColor: "rgba(239,68,68,0.2)", color: "#fca5a5" }}>
              Due Amount: ₹{parseFloat(remainingAmount || 0).toFixed(2)}
            </div>
          </div>
        )}

        {/* ── FOOTER ── */}
        <div className="sales-footer">
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
          <button className="submit-btn" onClick={updateSale}>Update Sale</button>
        </div>
      </div>
    </div>
  );
}
