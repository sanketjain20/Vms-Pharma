import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import "../../Styles/CommonAEUDForm/FormShell.css";
import { toastApiError } from "../../utils/toastMessage";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import { createPortal } from "react-dom";
const GST_RATES = [0, 5, 12, 18, 28];

/* ─────────────────────────────────────────
   SEARCHABLE DROPDOWN — same portal-positioned component as SalesAdd.js,
   so it floats above the modal's own scroll container instead of being
   clipped by it, and reads as the same dropdown pattern everywhere.
───────────────────────────────────────── */
const SearchableDropdown = ({
  label, options, selectedId, onSelect,
  search, setSearch, open, setOpen,
  placeholder, dropdownRef, error
}) => {
  const [coords, setCoords] = useState(null);
  const selectedOption = options.find(o => String(o.id) === String(selectedId));
  const displayValue = open ? search : (selectedOption?.name ?? "");
  const filtered = options.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase())
  );

  const updateCoords = () => {
    const rect = dropdownRef.current?.getBoundingClientRect();
    if (!rect) return;
    const listHeight = 200;
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropUp = spaceBelow < listHeight && rect.top > spaceBelow;
    setCoords({
      left: rect.left,
      width: rect.width,
      top: dropUp ? undefined : rect.bottom + 5,
      bottom: dropUp ? window.innerHeight - rect.top + 5 : undefined,
    });
  };

  const handleOpen = (e) => {
    e.stopPropagation();
    if (!open) setSearch("");
    updateCoords();
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    updateCoords();
    const handler = () => updateCoords();
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div className="afx-field" ref={dropdownRef}>
      <label className="afx-label">{label}</label>
      <div className="afx-searchdrop">
        <div className={`afx-searchdrop-face ${open ? "is-open" : ""} ${selectedOption ? "is-filled" : ""}`} onClick={handleOpen}>
          <input
            type="text" value={displayValue} placeholder={placeholder}
            onChange={e => setSearch(e.target.value)} onClick={handleOpen}
            style={{ background: "transparent", border: "none", outline: "none", color: "inherit", font: "inherit", width: "100%" }}
          />
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0 }}><path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        {open && coords && createPortal(
          <div
            className="afx-searchdrop-panel"
            style={{ position: "fixed", left: coords.left, width: coords.width, top: coords.top, bottom: coords.bottom }}
          >
            <div className="afx-searchdrop-list">
              {filtered.length === 0 ? (
                <div className="afx-searchdrop-empty">No results found</div>
              ) : filtered.map(o => (
                <div key={o.id}
                  className={`afx-searchdrop-item ${String(o.id) === String(selectedId) ? "is-selected" : ""}`}
                  onMouseDown={e => { e.preventDefault(); onSelect(o.id); setOpen(false); setSearch(""); }}
                >{o.name}</div>
              ))}
            </div>
          </div>,
          document.body
        )}
      </div>
      {error && <div className="afx-error">{error}</div>}
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
  const [initialLoading, setInitialLoading] = useState(true);

  const safeJson = async (res) => {
    try { const text = await res.text(); return text ? JSON.parse(text) : null; }
    catch { return null; }
  };

  /* ── FETCH RETAILERS ── */
  useEffect(() => {
    apiClient(`${API_BASE_URL}/api/Retailer/Dropdown`, { method: "GET" })
      .then(r => r.json())
      .then(json => setRetailers(
        (json?.data ?? []).map(r => ({ id: r.id, name: r.shopName + " · " + r.ownerName }))
      ))
      .catch(() => {});
  }, []);

  /* ── FETCH ALL PRODUCTS — unchanged ── */
  useEffect(() => {
    apiClient(`${API_BASE_URL}/api/Product/GetAllProduct`, { method: "GET", headers: { "Content-Type": "application/json" } })
      .then(r => r.json())
      .then(json => {
        const dataObj = json?.data;
        const list = Array.isArray(dataObj) ? dataObj : typeof dataObj === "object" ? Object.values(dataObj).find(v => Array.isArray(v)) || [] : [];
        setAllProducts(list); setProducts(list);
      }).catch(() => { setAllProducts([]); setProducts([]); });
  }, []);

  /* ── FETCH PRODUCT TYPES — unchanged ── */
  useEffect(() => {
    apiClient(`${API_BASE_URL}/api/ProductType/GetAllProductType`, { method: "GET", headers: { "Content-Type": "application/json" } })
      .then(safeJson)
      .then(json => { const list = json?.data?.productTypes ?? []; setProductTypes(Array.isArray(list) ? list : []); });
  }, []);

  /* ── FETCH SALE — updated to load new fields ── */
  useEffect(() => { if (uKey) fetchSaleByUkey(); }, [uKey]);

  const fetchSaleByUkey = () => {
    setInitialLoading(true);
    apiClient(`${API_BASE_URL}/api/Sales/GetSalesByUkey/${uKey}`, {
      method: "GET", headers: { "Content-Type": "application/json" },
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
      })
      .catch(() => toast.error("Sale not found"))
      .finally(() => setInitialLoading(false));
  };

  /* ── FETCH BATCHES when product selected ── */
  useEffect(() => {
    if (!selectedProduct) { setAvailableBatches([]); setSelectedBatchId(""); return; }
    apiClient(`${API_BASE_URL}/api/Sales/GetAvailableBatches/${selectedProduct}`, { method: "GET" })
      .then(r => r.json())
      .then(json => { if (json?.status === 200) setAvailableBatches(json.data ?? []); else setAvailableBatches([]); })
      .catch(() => setAvailableBatches([]));
  }, [selectedProduct]);

  const handleTypeChange = (e) => {
    const typeId = e.target.value;
    setSelectedType(typeId); setSelectedProduct(""); setInventory(null); setErrors({});
    setAvailableBatches([]); setSelectedBatchId("");
    if (!typeId) { setProducts(allProducts); return; }
    apiClient(`${API_BASE_URL}/api/Product/GetProdByProdId/${typeId}`, { method: "GET" })
      .then(safeJson).then(json => setProducts(json?.data ?? []));
  };

  /* ── AUTO SET TYPE — unchanged ── */
  useEffect(() => {
    if (!selectedProduct) return;
    apiClient(`${API_BASE_URL}/api/ProductType/GetProdTypeByProductId/${selectedProduct}`)
      .then(r => r.json())
      .then(json => {
        const typeId = json?.data?.productTypeId || json?.data?.id;
        if (typeId && typeId !== selectedType) {
          setSelectedType(typeId);
          if (lastLoadedType.current !== typeId) {
            lastLoadedType.current = typeId;
            apiClient(`${API_BASE_URL}/api/Product/GetProdByProdId/${typeId}`)
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
    apiClient(`${API_BASE_URL}/api/Inventory/GetInventoryByProdId/${prodId}`, { method: "GET" })
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

  /* ── Stock helpers for the currently-selected product's inventory ── */
  const outOfStock = !!inventory && inventory.currentQuantity <= 0;
  const lowStock    = !!inventory && inventory.currentQuantity > 0 && inventory.currentQuantity <= 10;
  const noPriceConfigured = !!selectedProduct && !inventory;

  const addOrUpdateItem = () => {
    let tempErrors = {};
    if (!selectedType) tempErrors.selectedType = "Select product type";
    if (!selectedProduct) tempErrors.selectedProduct = "Select product";
    const product = products.find(p => p.id === parseInt(selectedProduct));
    if (selectedProduct && !product) tempErrors.selectedProduct = tempErrors.selectedProduct || "Invalid product";

    // Selling price always comes from inventory/product configuration —
    // there is no manual/adhoc price entry.
    if (selectedProduct && !inventory) {
      tempErrors.selectedProduct = "Selling price is not configured for this product";
    } else if (inventory && inventory.currentQuantity <= 0) {
      tempErrors.selectedProduct = "This product is out of stock";
    }

    if (!quantity || quantity <= 0) {
      tempErrors.quantity = "Enter valid quantity";
    } else if (inventory && parseInt(quantity) > inventory.currentQuantity) {
      tempErrors.quantity = "Exceeds available stock";
    }

    const price = inventory ? inventory.unitSellingPrice : 0;
    let taxValue = parseFloat(taxInput || 0);
    if (taxValue < 0) tempErrors.taxInput = "Tax cannot be negative";
    setErrors(tempErrors);
    if (Object.keys(tempErrors).length > 0) {
      toast.error(Object.values(tempErrors)[0]);
      return;
    }

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
    setTaxInput(""); setInventory(null);
    setTaxType("PERCENT"); setErrors({});
    setAvailableBatches([]); setSelectedBatchId("");
  };

  const editItem = async (index) => {
    const it = lineItems[index];
    setEditIndex(index);
    setSelectedProduct(it.productId); setQuantity(it.quantity);
    setTaxInput(it.taxAmount);
    setTaxType("FLAT"); setErrors({});
    setSelectedBatchId(it.batchId ? String(it.batchId) : "");
    const iRes  = await apiClient(`${API_BASE_URL}/api/Inventory/GetInventoryByProdId/${it.productId}`, { method: "GET" });
    const iJson = await safeJson(iRes);
    if (iJson?.data) setInventory(iJson.data);
  };

  const deleteItem = (i) => { const u = [...lineItems]; u.splice(i, 1); setLineItems(u); };

  /* ── TOTALS: Subtotal → Discount → Taxable Value → GST → Net Amount ── */
  const lineSubtotal = lineItems.reduce((s, i) => s + i.sellingPrice * i.quantity, 0);
  const lineTaxTotal = lineItems.reduce((s, i) => s + i.taxAmount, 0);
  const discAmt = discountInput > 0
    ? (discountType === "PERCENT"
      ? (lineSubtotal * parseFloat(discountInput)) / 100
      : parseFloat(discountInput))
    : 0;
  const taxableValue = lineSubtotal - discAmt;
  const netAmount     = taxableValue + lineTaxTotal;

  useEffect(() => {
    const net = netAmount.toFixed(2);
    if (creditPaymentType === "PAID") { setAmountPaid(net); setRemainingAmount(0); }
    else if (creditPaymentType === "CREDIT") { setAmountPaid(0); setRemainingAmount(net); }
    else {
      const paid = parseFloat(amountPaid || 0);
      const rem  = netAmount - paid;
      setRemainingAmount(rem < 0 ? 0 : rem);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creditPaymentType, lineItems, discountInput, discountType]);

  const updateSale = () => {
    let tempErrors = {};
    if (lineItems.length === 0) tempErrors.lineItems = "Add at least one item";
    if (!billingMode) tempErrors.billingMode = "Select billing mode";
    if (discountInput < 0) tempErrors.discountInput = "Discount cannot be negative";
    if ((creditPaymentType === "CREDIT" || creditPaymentType === "PARTIAL") && !dueDate)
      tempErrors.dueDate = "Due date is required";
    if (creditPaymentType !== "CREDIT" && (!amountPaid || amountPaid <= 0)) tempErrors.amountPaid = "Enter valid amount paid";
    if (parseFloat(amountPaid) > netAmount) tempErrors.amountPaid = "Amount paid cannot exceed net amount";
    setErrors(tempErrors);
    if (Object.keys(tempErrors).length > 0) return;

    apiClient(`${API_BASE_URL}/api/Sales/UpdateSales/${saleId}`, {
      method: "PUT",
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
        else toastApiError(json, "Update failed");
      })
      .catch((err) => toast.error(err?.message || "Network error. Please try again."));
  };

  const totalAmount = lineItems.reduce((s, i) => s + i.totalAmount, 0);

  /* ── RENDER ── */
  return (
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--xl">
        {initialLoading ? (
          <div className="afx-loading">
            <div className="afx-loader-ring"><div/><div/><div/></div>
          </div>
        ) : (
          <>
            <div className="afx-header">
              <div>
                <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />Edit Transaction</div>
                <h3 className="afx-title">Edit Sale{invoiceNumber && ` · ${invoiceNumber}`}</h3>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="afx-tabs" style={{ padding: 0, background: "none", border: "none" }}>
                  {["Existing", "Product", "Billing"].map(tab => (
                    <button type="button" key={tab} className={`afx-tab ${activeTab === tab ? "is-active" : ""}`} onClick={() => setActiveTab(tab)}>
                      {tab === "Existing" ? "Original Items" : tab}
                    </button>
                  ))}
                </div>
                <button className="afx-close" onClick={onClose} title="Close">
                  <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                  ESC
                </button>
              </div>
            </div>

            <div className="afx-body">
              {/* ── ORIGINAL ITEMS TAB ── */}
              {activeTab === "Existing" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div className="afx-section-title">Original Line Items</div>
                  {originalItems.length === 0 ? (
                    <div className="afx-items-empty">No existing items</div>
                  ) : (
                    <>
                      <div className="afx-line-table" style={{ overflowX: "auto" }}>
                        <table>
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
                                <td style={{ color: "var(--afx-text-1)", fontWeight: 600 }}>{it.product}</td>
                                <td style={{ color: "var(--afx-accent)", fontFamily: "var(--afx-font-mono)", fontSize: 11 }}>{it.batchNumberSnapshot || "—"}</td>
                                <td style={{ fontSize: 11 }}>{it.expiryDateSnapshot || "—"}</td>
                                <td style={{ fontSize: 11 }}>{it.hsnCodeSnapshot || "—"}</td>
                                <td>{it.quantity}</td>
                                <td>{it.sellingPrice}</td>
                                <td>{it.taxAmount.toFixed(2)}</td>
                                <td style={{ fontWeight: 700, color: "var(--afx-text-1)" }}>{(it.sellingPrice * it.quantity + it.taxAmount).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="afx-totals">
                        <div className="afx-totals-row afx-totals-grand">
                          <span>Original Total (incl. GST)</span>
                          <span>₹{originalItems.reduce((s, i) => s + i.sellingPrice * i.quantity + i.taxAmount, 0).toFixed(2)}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── PRODUCT TAB ── */}
              {activeTab === "Product" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div className="afx-section-title">Update Products</div>

                  <div className="afx-grid">
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

                  {/* Inventory info — price & stock are always read from product configuration,
                      there is no manual/adhoc price entry here. */}
                  {inventory ? (
                    <div className="afx-card">
                      <div className="afx-card-row"><span>Selling Price</span><strong>₹{inventory.unitSellingPrice}</strong></div>
                      <div className="afx-card-row">
                        <span>Current Stock</span>
                        <strong className={outOfStock ? "afx-text-danger" : lowStock ? "" : "afx-text-success"} style={lowStock ? { color: "var(--afx-warning)" } : undefined}>
                          {inventory.currentQuantity}{outOfStock ? " · Out of stock" : lowStock ? " · Low stock" : ""}
                        </strong>
                      </div>
                      {outOfStock && (
                        <div className="afx-error">This product is out of stock and cannot be added. Add stock via Purchase first.</div>
                      )}
                    </div>
                  ) : noPriceConfigured ? (
                    <div className="afx-alert">Selling price is not configured for this product. Please set it up in Products first.</div>
                  ) : null}

                  {/* Batch selector */}
                  {availableBatches.length > 0 && (
                    <div className="afx-card">
                      <div className="afx-section-title" style={{ padding: 0 }}>Batch Selection</div>
                      <div className="afx-select-wrap">
                        <select className="afx-select" value={selectedBatchId} onChange={e => setSelectedBatchId(e.target.value)}>
                          <option value="">Auto-select (FIFO — oldest expiry first)</option>
                          {availableBatches.map(b => (
                            <option key={b.batchId} value={b.batchId}>
                              {b.batchNumber} · Exp: {b.expiryDate} · Qty: {b.availableQuantity}
                              {b.expiryStatus === "EXPIRING_SOON" ? " (expiring soon)" : b.expiryStatus === "EXPIRED" ? " (expired)" : ""}
                            </option>
                          ))}
                        </select>
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                    </div>
                  )}

                  <div className="afx-grid">
                    <div className="afx-field">
                      <label className="afx-label">Quantity</label>
                      <input
                        className={`afx-input ${errors.quantity ? "afx-input--err" : ""}`}
                        type="number" value={quantity}
                        onChange={e => setQuantity(e.target.value)}
                        placeholder="Enter qty"
                        disabled={outOfStock}
                      />
                      {errors.quantity && <div className="afx-error">{errors.quantity}</div>}
                    </div>
                    <div className="afx-field">
                      <label className="afx-label">GST {taxType === "PERCENT" ? "Rate (%)" : "Amount (₹)"}</label>
                      <div style={{ display: "flex", gap: 8 }}>
                        {taxType === "PERCENT" ? (
                          <div className="afx-select-wrap" style={{ flex: 1 }}>
                            <select className="afx-select" value={taxInput} onChange={e => setTaxInput(e.target.value)}>
                              <option value="">Select GST rate</option>
                              {GST_RATES.map(r => <option key={r} value={r}>{r}%{r === 18 ? " (Standard)" : r === 0 ? " (Exempt)" : ""}</option>)}
                            </select>
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </div>
                        ) : (
                          <input className="afx-input" type="number" value={taxInput} onChange={e => setTaxInput(e.target.value)} placeholder="GST amount (₹)" style={{ flex: 1 }} />
                        )}
                        <select className="afx-select" value={taxType} onChange={e => setTaxType(e.target.value)} style={{ width: 90, flexShrink: 0 }}>
                          <option value="PERCENT">% Rate</option>
                          <option value="FLAT">₹ Flat</option>
                        </select>
                      </div>
                      {errors.taxInput && <div className="afx-error">{errors.taxInput}</div>}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="afx-btn" onClick={clearForm}>Clear All</button>
                    <button type="button" className="afx-btn afx-btn--primary" onClick={addOrUpdateItem} disabled={outOfStock || noPriceConfigured}>
                      {editIndex !== null ? "Update Item" : "+ Add Item"}
                    </button>
                  </div>
                  {errors.lineItems && <div className="afx-error">{errors.lineItems}</div>}

                  {lineItems.length > 0 && (
                    <div>
                      <div className="afx-section-title" style={{ marginBottom: 8 }}>Line Items</div>
                      <div className="afx-line-table" style={{ overflowX: "auto" }}>
                        <table>
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
                                <td style={{ color: "var(--afx-text-1)", fontWeight: 600 }}>{it.productName}</td>
                                <td style={{ color: "var(--afx-accent)", fontFamily: "var(--afx-font-mono)", fontSize: 11 }}>{it.batchNumber || "AUTO"}</td>
                                <td style={{ fontSize: 11 }}>{it.expiryDate || "—"}</td>
                                <td>{it.quantity}</td>
                                <td>{it.sellingPrice}</td>
                                <td>{it.taxAmount}</td>
                                <td style={{ fontWeight: 700, color: "var(--afx-text-1)" }}>{it.totalAmount.toFixed(2)}</td>
                                <td>
                                  <div style={{ display: "flex", gap: 6 }}>
                                    <button type="button" className="afx-icon-btn" style={{ width: 24, height: 24 }} onClick={() => editItem(i)} title="Edit">
                                      <svg width="12" height="12" viewBox="0 -960 960 960" fill="currentColor"><path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Z"/></svg>
                                    </button>
                                    <button type="button" className="afx-remove-btn" onClick={() => deleteItem(i)} title="Delete">
                                      <svg width="12" height="12" viewBox="0 -960 960 960" fill="currentColor"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360Z"/></svg>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="afx-totals" style={{ marginTop: 10 }}>
                        <div className="afx-totals-row afx-totals-grand"><span>Updated Total (incl. GST)</span><span>₹{totalAmount.toFixed(2)}</span></div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── BILLING TAB ── */}
              {activeTab === "Billing" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div className="afx-section-title">Billing &amp; Payment</div>

                  <SearchableDropdown
                    label="Retailer (optional)"
                    options={retailers} selectedId={selectedRetailer}
                    onSelect={id => setSelectedRetailer(id)}
                    search={retailerSearch} setSearch={setRetailerSearch}
                    open={retailerDropdownOpen} setOpen={setRetailerDropdownOpen}
                    placeholder="Search retailer…" dropdownRef={retailerDropdownRef}
                    error={errors.retailerId}
                  />

                  <div className="afx-field">
                    <label className="afx-label">Discount</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input className="afx-input" type="number" value={discountInput} onChange={e => setDiscountInput(e.target.value)} placeholder="0" />
                      <select className="afx-select" style={{ width: 80, flexShrink: 0 }} value={discountType} onChange={e => setDiscountType(e.target.value)}>
                        <option value="FLAT">₹</option>
                        <option value="PERCENT">%</option>
                      </select>
                    </div>
                    {errors.discountInput && <div className="afx-error">{errors.discountInput}</div>}
                  </div>

                  <div className="afx-field">
                    <label className="afx-label">Billing Mode</label>
                    <div className="afx-select-wrap">
                      <select className="afx-select" value={billingMode} onChange={e => setBillingMode(e.target.value)}>
                        <option value="CASH">Cash</option>
                        <option value="ONLINE">Online / UPI</option>
                        <option value="CARD">Card</option>
                      </select>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                    {errors.billingMode && <div className="afx-error">{errors.billingMode}</div>}
                  </div>

                  {/* ── Totals breakdown: Subtotal → Discount → Taxable Value → GST → Net Amount ── */}
                  <div className="afx-totals">
                    <div className="afx-totals-row"><span>Subtotal</span><span style={{ color: "var(--afx-text-1)" }}>₹{lineSubtotal.toFixed(2)}</span></div>
                    {discAmt > 0 && (
                      <div className="afx-totals-row"><span>Discount</span><span className="afx-text-danger">−₹{discAmt.toFixed(2)}</span></div>
                    )}
                    <div className="afx-totals-row"><span>Taxable Value</span><span style={{ color: "var(--afx-text-1)" }}>₹{taxableValue.toFixed(2)}</span></div>
                    <div className="afx-totals-row"><span>GST</span><span style={{ color: "var(--afx-text-1)" }}>₹{lineTaxTotal.toFixed(2)}</span></div>
                    <div className="afx-totals-divider" />
                    <div className="afx-totals-row afx-totals-grand"><span>Net Amount</span><span>₹{netAmount.toFixed(2)}</span></div>
                  </div>

                  <div className="afx-field">
                    <label className="afx-label">Payment Type</label>
                    <div className="afx-radio-group">
                      {["PAID", "CREDIT", "PARTIAL"].map(pt => (
                        <label key={pt} className={`afx-radio ${creditPaymentType === pt ? "is-checked" : ""}`}>
                          <input type="radio" checked={creditPaymentType === pt} onChange={() => setCreditPaymentType(pt)} />
                          {pt === "PAID" ? "Full Payment" : pt === "CREDIT" ? "Credit (Pay Later)" : "Partial Payment"}
                        </label>
                      ))}
                    </div>
                  </div>

                  {(creditPaymentType === "CREDIT" || creditPaymentType === "PARTIAL") && (
                    <div className="afx-field">
                      <label className="afx-label">Due Date</label>
                      <input className="afx-input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                      {errors.dueDate && <div className="afx-error">{errors.dueDate}</div>}
                    </div>
                  )}

                  <div className="afx-field">
                    <label className="afx-label">Amount Paid (₹)</label>
                    <input
                      className="afx-input"
                      type="number" value={amountPaid}
                      onChange={e => setAmountPaid(e.target.value)}
                      disabled={creditPaymentType === "PAID" || creditPaymentType === "CREDIT"}
                      placeholder="0.00"
                    />
                    {errors.amountPaid && <div className="afx-error">{errors.amountPaid}</div>}
                  </div>

                  <div className="afx-totals">
                    <div className="afx-totals-row afx-totals-grand">
                      <span>Due Amount</span>
                      <span className="afx-text-danger">₹{parseFloat(remainingAmount || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="afx-footer">
              <button className="afx-btn" type="button" onClick={onClose}>Cancel</button>
              <button className="afx-btn afx-btn--primary" type="button" onClick={updateSale}>Update Sale</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
