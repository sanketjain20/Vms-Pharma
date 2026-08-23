import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import "../../Styles/CommonAEUDForm/FormShell.css";
import { toastApiError } from "../../utils/toastMessage";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import { createPortal } from "react-dom";
/* ─────────────────────────────────────────
   SEARCHABLE DROPDOWN — portal-positioned so it floats above the modal's
   own scroll container instead of being clipped by it.
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

const GST_RATES = [0, 5, 12, 18, 28];

export default function SalesAdd({ onClose, onSubmit }) {
  // ── State ─────────────────────────────────────────────────────────────────
  const [productTypes, setProductTypes]       = useState([]);
  const [products, setProducts]               = useState([]);
  const [inventory, setInventory]             = useState(null);
  const [selectedType, setSelectedType]       = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity]               = useState("");
  const [taxInput, setTaxInput]               = useState("");
  const [taxType, setTaxType]                 = useState("PERCENT");
  const [lineItems, setLineItems]             = useState([]);
  const [editIndex, setEditIndex]             = useState(null);
  const [discountInput, setDiscountInput]     = useState("");
  const [discountType, setDiscountType]       = useState("PERCENT");
  const [billingMode, setBillingMode]         = useState("CASH");
  const [commonTax, setCommonTax]             = useState("18");
  const [taxMode, setTaxMode]                 = useState("COMMON");
  const [errors, setErrors]                   = useState({});
  const [activeTab, setActiveTab]             = useState("Tax");
  const [amountPaid, setAmountPaid]           = useState("");
  const [allProducts, setAllProducts]         = useState([]);
  const lastLoadedType                        = useRef(null);
  const [typeSearch, setTypeSearch]           = useState("");
  const [productSearch, setProductSearch]     = useState("");
  const [typeDropdownOpen, setTypeDropdownOpen]       = useState(false);
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const typeDropdownRef    = useRef(null);
  const productDropdownRef = useRef(null);

  // ── Pharma fields ─────────────────────────────────────────────────────────
  const [retailers, setRetailers]                     = useState([]);
  const [selectedRetailer, setSelectedRetailer]       = useState("");
  const [retailerSearch, setRetailerSearch]           = useState("");
  const [retailerDropdownOpen, setRetailerDropdownOpen] = useState(false);
  const retailerDropdownRef = useRef(null);
  const [creditPaymentType, setCreditPaymentType]     = useState("PAID");
  const [dueDate, setDueDate]                         = useState("");
  const [availableBatches, setAvailableBatches]       = useState([]);
  const [selectedBatchId, setSelectedBatchId]         = useState("");
  const [batchesLoading, setBatchesLoading]           = useState(false);

  /* ── FETCH RETAILERS ── */
  useEffect(() => {
    apiClient(`${API_BASE_URL}/api/Retailer/Dropdown`, {
      method: "GET", headers: { "Content-Type": "application/json" },
    })
      .then(r => r.json())
      .then(json => setRetailers(
        (json?.data ?? []).map(r => ({ id: r.id, name: r.shopName + " · " + r.ownerName }))
      ))
      .catch(() => {});
  }, []);

  /* ── FETCH PRODUCT TYPES ── */
  useEffect(() => {
    apiClient(`${API_BASE_URL}/api/ProductType/GetAllProductType`, {
      method: "GET", headers: { "Content-Type": "application/json" },
    })
      .then(r => r.json())
      .then(json => {
        const list = json?.data?.productTypes ?? [];
        setProductTypes(Array.isArray(list) ? list : []);
      })
      .catch(() => {});
  }, []);

  /* ── FETCH ALL PRODUCTS ── */
  useEffect(() => {
    apiClient(`${API_BASE_URL}/api/Product/GetAllProduct`, {
      method: "GET", headers: { "Content-Type": "application/json" },
    })
      .then(r => r.json())
      .then(json => {
        const dataObj = json?.data;
        const list = Array.isArray(dataObj)
          ? dataObj
          : typeof dataObj === "object"
            ? Object.values(dataObj).find(v => Array.isArray(v)) || []
            : [];
        setAllProducts(list);
        setProducts(list);
      })
      .catch(() => { setAllProducts([]); setProducts([]); });
  }, []);

  /* ── FETCH BATCHES — only show warning AFTER response ── */
  useEffect(() => {
    if (!selectedProduct) {
      setAvailableBatches([]);
      setSelectedBatchId("");
      setBatchesLoading(false);
      return;
    }
    setBatchesLoading(true);
    setAvailableBatches([]);
    apiClient(`${API_BASE_URL}/api/Sales/GetAvailableBatches/${selectedProduct}`, {
      method: "GET",
    })
      .then(r => r.json())
      .then(json => {
        if (json?.status === 200) setAvailableBatches(json.data ?? []);
        else setAvailableBatches([]);
      })
      .catch(() => setAvailableBatches([]))
      .finally(() => setBatchesLoading(false));
  }, [selectedProduct]);

  /* ── HANDLERS ── */
  const handleTypeChange = (e) => {
    const id = e.target.value;
    setSelectedType(id);
    setSelectedProduct("");
    setInventory(null);
    setProducts([]);
    setTaxInput("");
    setErrors({});
    setAvailableBatches([]);
    setSelectedBatchId("");
    setBatchesLoading(false);
    if (!id) return;
    apiClient(`${API_BASE_URL}/api/Product/GetProdByProdId/${id}`, { method: "GET" })
      .then(r => r.json())
      .then(json => { const list = json?.data ?? []; setProducts(Array.isArray(list) ? list : []); })
      .catch(() => {});
  };

  const handleProductChange = (e) => {
    const id = e.target.value;
    setSelectedProduct(id);
    setTaxInput("");
    setErrors({});
    setAvailableBatches([]);
    setSelectedBatchId("");
    setBatchesLoading(false);
    if (!id) return;
    apiClient(`${API_BASE_URL}/api/Inventory/GetInventoryByProdId/${id}`, { method: "GET" })
      .then(r => r.json())
      .then(json => { if (json.status === 200) setInventory(json.data); else setInventory(null); })
      .catch(() => {});
  };

  /* ── AUTO SET TYPE ── */
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
      })
      .catch(() => {});
  }, [selectedProduct]);

  /* ── CLICK OUTSIDE ── */
  useEffect(() => {
    const handler = (e) => {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target))       { setTypeDropdownOpen(false); setTypeSearch(""); }
      if (productDropdownRef.current && !productDropdownRef.current.contains(e.target)) { setProductDropdownOpen(false); setProductSearch(""); }
      if (retailerDropdownRef.current && !retailerDropdownRef.current.contains(e.target)) { setRetailerDropdownOpen(false); setRetailerSearch(""); }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const safeJson = async (res) => { try { return await res.json(); } catch { return null; } };

  /* ── CLEAR PRODUCT FORM ── */
  const clearProductForm = () => {
    setSelectedType("");
    setSelectedProduct("");
    setProducts(allProducts);
    setInventory(null);
    setQuantity("");
    setTaxInput("");
    setAvailableBatches([]);
    setSelectedBatchId("");
    setBatchesLoading(false);
    setEditIndex(null);
    setErrors({});
    setTypeSearch("");
    setProductSearch("");
  };

  /* ── Stock helpers for the currently-selected product's inventory ── */
  const outOfStock = !!inventory && inventory.currentQuantity <= 0;
  const lowStock    = !!inventory && inventory.currentQuantity > 0 && inventory.currentQuantity <= 10;
  const noPriceConfigured = !!selectedProduct && !batchesLoading && !inventory;

  /* ── ADD ITEM ── */
  const addItem = () => {
    let tempErrors = {};
    if (!selectedType)      tempErrors.selectedType   = "Select product type";
    if (!selectedProduct)   tempErrors.selectedProduct = "Select product";

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
    const taxValue = taxMode === "COMMON" ? parseFloat(commonTax || 0) : parseFloat(taxInput || 0);
    if (taxValue < 0)                                     tempErrors.taxInput       = "Tax cannot be negative";
    setErrors(tempErrors);
    if (Object.keys(tempErrors).length > 0) {
      toast.error(Object.values(tempErrors)[0]);
      return;
    }

    const product   = products.find(p => p.id === parseInt(selectedProduct));
    const taxAmount = taxType === "PERCENT" ? (price * quantity * taxValue) / 100 : taxValue;

    const item = {
      productId:   parseInt(selectedProduct),
      productName: product?.name || "",
      quantity:    parseInt(quantity),
      sellingPrice: price,
      taxAmount,
      gstRate: taxMode === "COMMON" ? parseFloat(commonTax || 0) : parseFloat(taxInput || 0),
      batchId: selectedBatchId ? parseInt(selectedBatchId) : null,
      batchNumber: selectedBatchId
        ? availableBatches.find(b => String(b.batchId) === String(selectedBatchId))?.batchNumber || ""
        : "AUTO",
      expiryDate: selectedBatchId
        ? availableBatches.find(b => String(b.batchId) === String(selectedBatchId))?.expiryDate || ""
        : "",
    };

    const updated = [...lineItems];
    if (editIndex !== null) { updated[editIndex] = item; setEditIndex(null); }
    else updated.push(item);

    setLineItems(updated);
    clearProductForm();
  };

  const deleteItem = (i) => { const u = [...lineItems]; u.splice(i, 1); setLineItems(u); };

  const editItem = async (index) => {
    const it = lineItems[index];
    setEditIndex(index);
    setSelectedProduct(it.productId);
    setQuantity(it.quantity);
    setTaxInput(it.taxAmount);
    setSelectedBatchId(it.batchId || "");
    setErrors({});
    const pRes  = await apiClient(`${API_BASE_URL}/api/Product/GetProductById/${it.productId}`, { method: "GET" });
    const pJson = await safeJson(pRes);
    if (pJson?.data) {
      const typeId = pJson.data.productTypeId;
      setSelectedType(typeId);
      lastLoadedType.current = typeId;
      const lRes  = await apiClient(`${API_BASE_URL}/api/Product/GetProdByProdId/${typeId}`, { method: "GET" });
      const lJson = await safeJson(lRes);
      if (Array.isArray(lJson?.data)) setProducts(lJson.data);
      const iRes  = await apiClient(`${API_BASE_URL}/api/Inventory/GetInventoryByProdId/${it.productId}`, { method: "GET" });
      const iJson = await safeJson(iRes);
      if (iJson?.status === 200) setInventory(iJson.data);
    }
  };

  /* ── TOTALS ── */
  const lineTotal    = lineItems.reduce((s, i) => s + i.sellingPrice * i.quantity, 0);
  const lineTaxTotal = lineItems.reduce((s, i) => s + i.taxAmount, 0);
  const totalAmount  = lineTotal + lineTaxTotal;

  const discAmt = discountInput > 0
    ? (discountType === "PERCENT"
      ? (lineTotal * parseFloat(discountInput)) / 100
      : parseFloat(discountInput))
    : 0;
  const discountedTotal = lineTotal - discAmt;   // Taxable Value

  let commonTaxAmount = 0;
  if (taxMode === "COMMON" && commonTax > 0)
    commonTaxAmount = taxType === "PERCENT"
      ? (discountedTotal * commonTax) / 100
      : parseFloat(commonTax);
  const gstAmount = taxMode === "PRODUCT" ? lineTaxTotal : commonTaxAmount;
  const netAmount = discountedTotal + gstAmount;

  useEffect(() => {
    if (creditPaymentType === "PAID") setAmountPaid(netAmount.toFixed(2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creditPaymentType, netAmount]);

  /* ── SUBMIT ── */
  const submitSales = async () => {
    let tempErrors = {};
    if (lineItems.length === 0)                          tempErrors.lineItems    = "Add at least one item";
    if (creditPaymentType !== "CREDIT" && !billingMode)  tempErrors.billingMode  = "Select billing mode";
    if (discountInput < 0)                               tempErrors.discountInput = "Discount cannot be negative";
    if (creditPaymentType === "PAID" && parseFloat(amountPaid) !== netAmount)
      tempErrors.amountPaid = "Amount must be equal to net amount";
    if (creditPaymentType === "PARTIAL") {
      if (!amountPaid || amountPaid <= 0)               tempErrors.amountPaid = "Enter valid amount paid";
      else if (parseFloat(amountPaid) >= netAmount)     tempErrors.amountPaid = "Partial payment must be less than total";
    }
    if (creditPaymentType === "CREDIT" && parseFloat(amountPaid) !== 0)
      tempErrors.amountPaid = "Amount paid must be 0 for credit";
    if (creditPaymentType === "CREDIT" && !dueDate)     tempErrors.dueDate = "Due date is required for credit";
    if (creditPaymentType === "PARTIAL" && !dueDate)    tempErrors.dueDate = "Due date is required for partial payment";
    setErrors(tempErrors);
    if (Object.keys(tempErrors).length > 0) return;

    const finalDiscount = discountType === "PERCENT"
      ? (totalAmount * (discountInput || 0)) / 100
      : parseFloat(discountInput || 0);

    try {
      const response = await apiClient(`${API_BASE_URL}/api/Sales/AddSales`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billingMode,
          totalDiscount: finalDiscount,
          amountPaid: parseFloat(amountPaid),
          remainingAmount: parseFloat((netAmount - amountPaid).toFixed(2)),
          retailerId: selectedRetailer ? parseInt(selectedRetailer) : null,
          paymentType: creditPaymentType,
          dueDate: dueDate || null,
          items: lineItems.map(it => ({
            productId:    it.productId,
            quantity:     it.quantity,
            sellingPrice: it.sellingPrice,
            taxAmount:    it.taxAmount,
            batchId:      it.batchId || null,
          })),
        }),
      });
      const result = await safeJson(response);
      if (response.ok && result?.status === 200) {
        toast.success(result?.message || "Sale added successfully");
        onSubmit();
        onClose();
      } else {
        toastApiError(result, "Failed to add sale");
      }
    } catch (err) {
      toast.error(err?.message || "Network error. Please try again.");
    }
  };

  /* ── RENDER ── */
  return (
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--xl">
        <div className="afx-header">
          <div>
            <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />New Transaction</div>
            <h3 className="afx-title">Add Sales</h3>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="afx-tabs" style={{ padding: 0, background: "none", border: "none" }}>
              {["Tax", "Product", "Billing"].map(tab => (
                <button type="button" key={tab} className={`afx-tab ${activeTab === tab ? "is-active" : ""}`} onClick={() => setActiveTab(tab)}>
                  {tab}
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
          {/* ── TAX TAB ── */}
          {activeTab === "Tax" && (
            <div>
              <div className="afx-section-title" style={{ marginBottom: 10 }}>GST / Tax Settings</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div className={`afx-option-row ${taxMode === "COMMON" ? "is-selected" : ""}`}>
                  <label>
                    <input type="radio" name="taxMode" value="COMMON" checked={taxMode === "COMMON"} onChange={() => setTaxMode("COMMON")} />
                    Common GST
                    <span className="afx-badge">Default 18%</span>
                  </label>
                  {taxMode === "COMMON" && (
                    <div className="afx-option-row-fields">
                      <select className="afx-select" style={{ minWidth: 160 }} value={commonTax} onChange={e => setCommonTax(e.target.value)}>
                        {GST_RATES.map(r => (
                          <option key={r} value={r}>
                            {r}% GST{r === 18 ? " (Standard)" : r === 0 ? " (Exempt)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div className={`afx-option-row ${taxMode === "PRODUCT" ? "is-selected" : ""}`}>
                  <label>
                    <input type="radio" name="taxMode" value="PRODUCT" checked={taxMode === "PRODUCT"} onChange={() => setTaxMode("PRODUCT")} />
                    Product-wise GST
                  </label>
                  {taxMode === "PRODUCT" && (
                    <div className="afx-option-row-fields">
                      <select className="afx-select" style={{ minWidth: 160 }} value={taxType} onChange={e => setTaxType(e.target.value)}>
                        <option value="PERCENT">% GST Rate</option>
                        <option value="FLAT">₹ Flat Amount</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── PRODUCT TAB ── */}
          {activeTab === "Product" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="afx-section-title">Select Product</div>

              <div className="afx-grid">
                <SearchableDropdown
                  label="Product Type" options={productTypes} selectedId={selectedType}
                  onSelect={id => handleTypeChange({ target: { value: id } })}
                  search={typeSearch} setSearch={setTypeSearch}
                  open={typeDropdownOpen} setOpen={setTypeDropdownOpen}
                  placeholder="Select product type" dropdownRef={typeDropdownRef} error={errors.selectedType}
                />
                <SearchableDropdown
                  label="Product" options={products} selectedId={selectedProduct}
                  onSelect={id => handleProductChange({ target: { value: id } })}
                  search={productSearch} setSearch={setProductSearch}
                  open={productDropdownOpen} setOpen={setProductDropdownOpen}
                  placeholder="Select product" dropdownRef={productDropdownRef} error={errors.selectedProduct}
                />
              </div>

              {/* Inventory info — price & stock are always read from product configuration */}
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

              {/* Batch loading shimmer */}
              {selectedProduct && batchesLoading && (
                <div className="afx-card" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <span className="afx-spinner" style={{ borderColor: "var(--afx-border)", borderTopColor: "var(--afx-accent)" }} />
                  <span style={{ fontSize: 12, color: "var(--afx-text-3)" }}>Loading batches…</span>
                </div>
              )}

              {/* Batch selector — only after load */}
              {selectedProduct && !batchesLoading && availableBatches.length > 0 && (
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
                  {selectedBatchId && (() => {
                    const b = availableBatches.find(x => String(x.batchId) === String(selectedBatchId));
                    return b ? (
                      <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--afx-text-2)", flexWrap: "wrap" }}>
                        <span>Batch: <strong style={{ color: "var(--afx-accent)" }}>{b.batchNumber}</strong></span>
                        <span>Expiry: <strong style={{
                          color: b.expiryStatus === "EXPIRING_SOON" ? "var(--afx-warning)"
                            : b.expiryStatus === "EXPIRED" ? "var(--afx-danger)" : "var(--afx-success)"
                        }}>{b.expiryDate}</strong></span>
                        <span>MRP: <strong style={{ color: "var(--afx-text-1)" }}>₹{b.mrp}</strong></span>
                        <span>Stock: <strong style={{ color: "var(--afx-text-1)" }}>{b.availableQuantity}</strong></span>
                      </div>
                    ) : null;
                  })()}
                </div>
              )}

              {/* No batches warning */}
              {selectedProduct && !batchesLoading && availableBatches.length === 0 && (
                <div className="afx-alert">No batches available for this product. Add stock via Purchase first.</div>
              )}

              {/* Quantity + GST */}
              <div className="afx-grid">
                <div className="afx-field">
                  <label className="afx-label">Quantity</label>
                  <input
                    className={`afx-input ${errors.quantity ? "afx-input--err" : ""}`}
                    type="number" value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                    min="1" placeholder="Enter qty"
                    disabled={outOfStock}
                  />
                  {errors.quantity && <div className="afx-error">{errors.quantity}</div>}
                </div>
                {taxMode === "PRODUCT" && (
                  <div className="afx-field">
                    <label className="afx-label">GST {taxType === "PERCENT" ? "Rate (%)" : "Amount (₹)"}</label>
                    {taxType === "PERCENT" ? (
                      <div className="afx-select-wrap">
                        <select className="afx-select" value={taxInput} onChange={e => setTaxInput(e.target.value)}>
                          <option value="">Select GST rate</option>
                          {GST_RATES.map(r => (
                            <option key={r} value={r}>{r}%{r === 18 ? " (Standard)" : r === 0 ? " (Exempt)" : ""}</option>
                          ))}
                        </select>
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                    ) : (
                      <input
                        className="afx-input"
                        type="number" value={taxInput}
                        onChange={e => setTaxInput(e.target.value)}
                        placeholder="Flat GST amount" min="0"
                      />
                    )}
                    {errors.taxInput && <div className="afx-error">{errors.taxInput}</div>}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="afx-btn" onClick={clearProductForm}>Clear All</button>
                <button type="button" className="afx-btn afx-btn--primary" onClick={addItem} disabled={outOfStock || noPriceConfigured}>
                  {editIndex !== null ? "Update Item" : "+ Add Item"}
                </button>
              </div>
              {errors.lineItems && <div className="afx-error">{errors.lineItems}</div>}

              {/* Line items table */}
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
                        {lineItems.map((it, idx) => (
                          <tr key={idx}>
                            <td style={{ color: "var(--afx-text-1)", fontWeight: 600 }}>{it.productName}</td>
                            <td style={{ color: "var(--afx-accent)", fontFamily: "var(--afx-font-mono)", fontSize: 11 }}>{it.batchNumber || "AUTO"}</td>
                            <td style={{ fontSize: 11 }}>{it.expiryDate || "—"}</td>
                            <td>{it.quantity}</td>
                            <td>{it.sellingPrice}</td>
                            <td>{it.taxAmount.toFixed(2)}</td>
                            <td style={{ fontWeight: 700, color: "var(--afx-text-1)" }}>{(it.quantity * it.sellingPrice + it.taxAmount).toFixed(2)}</td>
                            <td>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button type="button" className="afx-icon-btn" style={{ width: 24, height: 24 }} onClick={() => editItem(idx)} title="Edit">
                                  <svg width="12" height="12" viewBox="0 -960 960 960" fill="currentColor"><path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Z"/></svg>
                                </button>
                                <button type="button" className="afx-remove-btn" onClick={() => deleteItem(idx)} title="Delete">
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
                    <div className="afx-totals-row afx-totals-grand"><span>Total (incl. GST)</span><span>₹{totalAmount.toFixed(2)}</span></div>
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
                label="Retailer (optional — leave empty for walk-in)"
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
                  <input
                    className="afx-input"
                    type="number" value={discountInput}
                    onChange={e => setDiscountInput(e.target.value)}
                    min="0" placeholder="0"
                  />
                  <select className="afx-select" style={{ width: 80, flexShrink: 0 }} value={discountType} onChange={e => setDiscountType(e.target.value)}>
                    <option value="PERCENT">%</option>
                    <option value="FLAT">₹</option>
                  </select>
                </div>
                {errors.discountInput && <div className="afx-error">{errors.discountInput}</div>}
              </div>

              {creditPaymentType !== "CREDIT" && (
                <div className="afx-field">
                  <label className="afx-label">Billing Mode</label>
                  <div className="afx-select-wrap">
                    <select className="afx-select" value={billingMode} onChange={e => setBillingMode(e.target.value)}>
                      <option value="">— Select Billing Mode —</option>
                      <option value="CASH">Cash</option>
                      <option value="ONLINE">Online / UPI</option>
                      <option value="CARD">Card</option>
                    </select>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  {errors.billingMode && <div className="afx-error">{errors.billingMode}</div>}
                </div>
              )}

              {/* ── Totals breakdown ── */}
              <div className="afx-totals">
                <div className="afx-totals-row"><span>Subtotal</span><span style={{ color: "var(--afx-text-1)" }}>₹{lineTotal.toFixed(2)}</span></div>
                {discAmt > 0 && (
                  <div className="afx-totals-row"><span>Discount</span><span className="afx-text-danger">−₹{discAmt.toFixed(2)}</span></div>
                )}
                <div className="afx-totals-row"><span>Taxable Value</span><span style={{ color: "var(--afx-text-1)" }}>₹{discountedTotal.toFixed(2)}</span></div>
                <div className="afx-totals-row"><span>GST</span><span style={{ color: "var(--afx-text-1)" }}>₹{gstAmount.toFixed(2)}</span></div>
                <div className="afx-totals-divider" />
                <div className="afx-totals-row afx-totals-grand"><span>Net Amount</span><span>₹{netAmount.toFixed(2)}</span></div>
              </div>

              <div className="afx-field">
                <label className="afx-label">Payment Type</label>
                <div className="afx-radio-group">
                  {["PAID", "CREDIT", "PARTIAL"].map(pt => (
                    <label key={pt} className={`afx-radio ${creditPaymentType === pt ? "is-checked" : ""}`}>
                      <input
                        type="radio" checked={creditPaymentType === pt}
                        onChange={() => {
                          setCreditPaymentType(pt);
                          if (pt === "PAID")    setAmountPaid(netAmount.toFixed(2));
                          if (pt === "CREDIT")  setAmountPaid("0");
                          if (pt === "PARTIAL") setAmountPaid("");
                        }}
                      />
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
                  min="0" placeholder="0.00"
                />
                {errors.amountPaid && <div className="afx-error">{errors.amountPaid}</div>}
              </div>

              {creditPaymentType !== "PAID" && (
                <div className="afx-totals">
                  <div className="afx-totals-row afx-totals-grand">
                    <span>Due Amount</span>
                    <span className="afx-text-danger">₹{Math.max(0, netAmount - parseFloat(amountPaid || 0)).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="afx-footer">
          <button className="afx-btn" onClick={onClose}>Cancel</button>
          <button className="afx-btn afx-btn--primary" onClick={submitSales}>Submit Sales</button>
        </div>
      </div>
    </div>
  );
}
