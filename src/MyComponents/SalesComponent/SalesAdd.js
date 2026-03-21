import React, { useState, useEffect, useRef } from "react";
import "../../Styles/Sales/AddSales.css";

/* ─────────────────────────────────────────
   SEARCHABLE DROPDOWN
───────────────────────────────────────── */
const SearchableDropdown = ({
  label, options, selectedId, onSelect,
  search, setSearch, open, setOpen,
  placeholder, dropdownRef, error
}) => {
  // Loose comparison — handles number vs string IDs
  const selectedOption = options.find(o => String(o.id) === String(selectedId));
  const displayValue   = open ? search : (selectedOption?.name ?? "");

  const filtered = options.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpen = (e) => {
    e.stopPropagation();
    if (!open) setSearch(""); // reset filter when opening
    setOpen(true);
  };

  return (
    <div className="custom-select" ref={dropdownRef}>
      <label>{label}</label>
      <div
        className={`select-box ${open ? "active" : ""}`}
        onClick={handleOpen}
      >
        <input
          type="text"
          value={displayValue}
          placeholder={placeholder}
          onChange={e => setSearch(e.target.value)}
          onClick={handleOpen}
          className="select-input"
        />
        {open && (
          <ul className="options scroll-options">
            {filtered.map(o => (
              <li
                key={o.id}
                // onMouseDown fires before onBlur so the value is captured
                // before the dropdown closes — this is the key fix
                onMouseDown={e => {
                  e.preventDefault();
                  onSelect(o.id);
                  setOpen(false);
                  setSearch("");
                }}
                style={String(o.id) === String(selectedId) ? { color: "#93c5fd", background: "rgba(59,130,246,0.1)" } : {}}
              >
                {o.name}
              </li>
            ))}
            {filtered.length === 0 && (
              <li style={{ color: "#525667", fontStyle: "italic" }}>No results found</li>
            )}
          </ul>
        )}
      </div>
      {error && <div className="error">{error}</div>}
    </div>
  );
};

/* ─────────────────────────────────────────
   GST RATES for product-wise
───────────────────────────────────────── */
const GST_RATES = [0, 5, 12, 18, 28];

export default function SalesAdd({ onClose, onSubmit }) {
  const [productTypes, setProductTypes] = useState([]);
  const [products, setProducts]         = useState([]);
  const [inventory, setInventory]       = useState(null);

  const [selectedType, setSelectedType]       = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");

  const [quantity, setQuantity]     = useState("");
  const [taxInput, setTaxInput]     = useState("");
  const [taxType, setTaxType]       = useState("PERCENT");

  const [lineItems, setLineItems] = useState([]);
  const [editIndex, setEditIndex] = useState(null);

  const [discountInput, setDiscountInput] = useState("");
  const [discountType, setDiscountType]   = useState("PERCENT");

  const [billingMode, setBillingMode]   = useState("CASH");
  const [manualPrice, setManualPrice]   = useState("");
  const [commonTax, setCommonTax]       = useState("18");     // ← default 18%
  const [taxMode, setTaxMode]           = useState("COMMON"); // COMMON = GST

  const [errors, setErrors]     = useState({});
  const [activeTab, setActiveTab] = useState("Tax");

  const [paymentType, setPaymentType] = useState("FULL");
  const [amountPaid, setAmountPaid]   = useState("");

  const [allProducts, setAllProducts] = useState([]);
  const lastLoadedType = useRef(null);

  const [typeSearch, setTypeSearch]             = useState("");
  const [productSearch, setProductSearch]       = useState("");
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const typeDropdownRef    = useRef(null);
  const productDropdownRef = useRef(null);

  /* ── FETCH PRODUCT TYPES ── */
  useEffect(() => {
    fetch("http://localhost:8080/api/ProductType/GetAllProductType", {
      method: "GET", credentials: "include", headers: { "Content-Type": "application/json" },
    })
      .then(r => r.json())
      .then(json => { const list = json?.data?.productTypes ?? []; setProductTypes(Array.isArray(list) ? list : []); })
      .catch(() => {});
  }, []);

  /* ── FETCH ALL PRODUCTS ── */
  useEffect(() => {
    fetch("http://localhost:8080/api/Product/GetAllProduct", {
      method: "GET", credentials: "include", headers: { "Content-Type": "application/json" },
    })
      .then(r => r.json())
      .then(json => {
        const dataObj = json?.data;
        const list = Array.isArray(dataObj) ? dataObj
          : typeof dataObj === "object" ? Object.values(dataObj).find(v => Array.isArray(v)) || [] : [];
        setAllProducts(list);
        setProducts(list);
      })
      .catch(() => { setAllProducts([]); setProducts([]); });
  }, []);

  const handleTypeChange = (e) => {
    const id = e.target.value;
    setSelectedType(id); setSelectedProduct(""); setInventory(null);
    setProducts([]); setManualPrice(""); setTaxInput(""); setErrors({});
    if (!id) return;
    fetch(`http://localhost:8080/api/Product/GetProdByProdId/${id}`, { method: "GET", credentials: "include" })
      .then(r => r.json())
      .then(json => { const list = json?.data ?? []; setProducts(Array.isArray(list) ? list : []); })
      .catch(() => {});
  };

  const handleProductChange = (e) => {
    const id = e.target.value;
    setSelectedProduct(id); setManualPrice(""); setTaxInput(""); setErrors({});
    if (!id) return;
    fetch(`http://localhost:8080/api/Inventory/GetInventoryByProdId/${id}`, { method: "GET", credentials: "include" })
      .then(r => r.json())
      .then(json => { if (json.status === 200) setInventory(json.data); else setInventory(null); })
      .catch(() => {});
  };

  /* ── AUTO SET TYPE WHEN PRODUCT CHANGES ── */
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
      })
      .catch(() => {});
  }, [selectedProduct]);

  useEffect(() => {
    const handler = (e) => {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target)) {
        setTypeDropdownOpen(false); setTypeSearch("");
      }
      if (productDropdownRef.current && !productDropdownRef.current.contains(e.target)) {
        setProductDropdownOpen(false); setProductSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const safeJson = async (res) => { try { return await res.json(); } catch { return null; } };

  const addItem = () => {
    let tempErrors = {};
    if (!selectedType) tempErrors.selectedType = "Select product type";
    if (!selectedProduct) tempErrors.selectedProduct = "Select product";
    if (!quantity || quantity <= 0) tempErrors.quantity = "Enter valid quantity";

    let price = inventory ? inventory.unitSellingPrice : parseFloat(manualPrice || 0);
    if (!inventory && (!manualPrice || manualPrice <= 0)) tempErrors.manualPrice = "Enter valid selling price";

    let taxValue = taxMode === "COMMON" ? parseFloat(commonTax || 0) : parseFloat(taxInput || 0);
    if (taxValue < 0) tempErrors.taxInput = "Tax cannot be negative";

    setErrors(tempErrors);
    if (Object.keys(tempErrors).length > 0) return;

    const product = products.find(p => p.id === parseInt(selectedProduct));
    let taxAmount = 0;
    if (taxType === "PERCENT") taxAmount = (price * quantity * taxValue) / 100;
    else taxAmount = taxValue;

    const item = {
      productId: parseInt(selectedProduct),
      productName: product?.name || "",
      quantity: parseInt(quantity),
      sellingPrice: price,
      taxAmount,
      gstRate: taxMode === "COMMON" ? parseFloat(commonTax || 0) : parseFloat(taxInput || 0),
    };

    let updated = [...lineItems];
    if (editIndex !== null) { updated[editIndex] = item; setEditIndex(null); }
    else updated.push(item);

    setLineItems(updated);
    setSelectedType(""); setSelectedProduct(""); setProducts(allProducts);
    setInventory(null); setQuantity(""); setManualPrice(""); setTaxInput("");
  };

  const deleteItem = (i) => { const u = [...lineItems]; u.splice(i, 1); setLineItems(u); };

  const editItem = async (index) => {
    const it = lineItems[index];
    setEditIndex(index);
    setSelectedProduct(it.productId); setQuantity(it.quantity);
    setManualPrice(it.sellingPrice);  setTaxInput(it.taxAmount); setErrors({});

    const pRes  = await fetch(`http://localhost:8080/api/Product/GetProductById/${it.productId}`, { method: "GET", credentials: "include" });
    const pJson = await safeJson(pRes);
    if (pJson?.data) {
      const typeId = pJson.data.productTypeId;
      setSelectedType(typeId); lastLoadedType.current = typeId;
      const lRes  = await fetch(`http://localhost:8080/api/Product/GetProdByProdId/${typeId}`, { method: "GET", credentials: "include" });
      const lJson = await safeJson(lRes);
      if (Array.isArray(lJson?.data)) setProducts(lJson.data);
      const iRes  = await fetch(`http://localhost:8080/api/Inventory/GetInventoryByProdId/${it.productId}`, { method: "GET", credentials: "include" });
      const iJson = await safeJson(iRes);
      if (iJson?.status === 200) setInventory(iJson.data);
    }
  };

  /* ── TOTALS ── */
  const lineTotal    = lineItems.reduce((s, i) => s + i.sellingPrice * i.quantity, 0);
  const lineTaxTotal = lineItems.reduce((s, i) => s + i.taxAmount, 0);
  const totalAmount  = lineTotal + lineTaxTotal;

  const discountedTotal = discountInput > 0
    ? discountType === "PERCENT" ? lineTotal - (lineTotal * discountInput) / 100 : lineTotal - discountInput
    : lineTotal;

  let commonTaxAmount = 0;
  if (taxMode === "COMMON" && commonTax > 0) {
    commonTaxAmount = taxType === "PERCENT" ? (discountedTotal * commonTax) / 100 : parseFloat(commonTax);
  }

  const netAmount = discountedTotal + (taxMode === "PRODUCT" ? lineTaxTotal : commonTaxAmount);

  useEffect(() => {
    if (paymentType === "FULL") setAmountPaid(netAmount.toFixed(2));
  }, [paymentType, netAmount]);

  const submitSales = async () => {
    let tempErrors = {};
    if (lineItems.length === 0) tempErrors.lineItems = "Add at least one item";
    if (!billingMode) tempErrors.billingMode = "Select billing mode";
    if (discountInput < 0) tempErrors.discountInput = "Discount cannot be negative";
    if (!amountPaid || amountPaid <= 0) tempErrors.amountPaid = "Enter valid amount paid";
    if (parseFloat(amountPaid) > netAmount) tempErrors.amountPaid = "Amount paid cannot exceed net amount";
    setErrors(tempErrors);
    if (Object.keys(tempErrors).length > 0) return;

    const finalDiscount = discountType === "PERCENT"
      ? (totalAmount * (discountInput || 0)) / 100 : parseFloat(discountInput || 0);

    try {
      const response = await fetch("http://localhost:8080/api/Sales/AddSales", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billingMode,
          totalDiscount: finalDiscount,
          items: lineItems,
          amountPaid: parseFloat(amountPaid),
          remainingAmount: parseFloat((netAmount - amountPaid).toFixed(2)),
        }),
      });
      const result = await response.json();
      if (response.ok && result.status === 200) { onSubmit(); onClose(); }
    } catch (err) {}
  };

  return (
    <div className="sales-modal show">
      <div className="sales-container">

        {/* ── HEADER ── */}
        <div className="sales-header">
          <div className="sales-header-left">
            <div className="sales-eyebrow">
              <span className="sales-eyebrow-dot" />
              NEW TRANSACTION
            </div>
            <h3>Add Sales</h3>
          </div>

          <div className="tabs-header">
            {["Tax", "Product", "Billing"].map(tab => (
              <button
                key={tab}
                className={activeTab === tab ? "active-tab" : ""}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
            <button className="close-btn-sales" onClick={onClose} title="Close">✕</button>
          </div>
        </div>

        {/* ══════════════ TAX TAB ══════════════ */}
        {activeTab === "Tax" && (
          <div className="sales-section">
            <h4>GST / Tax Settings</h4>
            <div className="tax-settings-container">

              {/* Common GST */}
              <div className={`tax-row-single ${taxMode === "COMMON" ? "selected" : ""}`}>
                <label className="tax-option">
                  <input type="radio" name="taxMode" value="COMMON" checked={taxMode === "COMMON"} onChange={() => setTaxMode("COMMON")} />
                  Common GST
                  <span className="gst-badge">Default 18%</span>
                </label>

                {taxMode === "COMMON" && (
                  <div className="tax-inline-fields">
                    <select value={commonTax} onChange={e => setCommonTax(e.target.value)}>
                      {GST_RATES.map(r => (
                        <option key={r} value={r}>{r}% GST{r === 18 ? " (Standard)" : r === 0 ? " (Exempt)" : ""}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Product-wise GST */}
              <div className={`tax-row-single ${taxMode === "PRODUCT" ? "selected" : ""}`}>
                <label className="tax-option">
                  <input type="radio" name="taxMode" value="PRODUCT" checked={taxMode === "PRODUCT"} onChange={() => setTaxMode("PRODUCT")} />
                  Product-wise GST
                </label>
                {taxMode === "PRODUCT" && (
                  <div className="tax-inline-fields">
                    <select value={taxType} onChange={e => setTaxType(e.target.value)}>
                      <option value="PERCENT">% GST Rate</option>
                      <option value="FLAT">₹ Flat Amount</option>
                    </select>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* ══════════════ PRODUCT TAB ══════════════ */}
        {activeTab === "Product" && (
          <div className="sales-section">
            <h4>Select Product</h4>

            <div className="product-row">
              <SearchableDropdown
                label="Product Type"
                options={productTypes}
                selectedId={selectedType}
                onSelect={id => handleTypeChange({ target: { value: id } })}
                search={typeSearch} setSearch={setTypeSearch}
                open={typeDropdownOpen} setOpen={setTypeDropdownOpen}
                placeholder="Select product type"
                dropdownRef={typeDropdownRef}
                error={errors.selectedType}
              />
              <SearchableDropdown
                label="Product"
                options={products}
                selectedId={selectedProduct}
                onSelect={id => handleProductChange({ target: { value: id } })}
                search={productSearch} setSearch={setProductSearch}
                open={productDropdownOpen} setOpen={setProductDropdownOpen}
                placeholder="Select product"
                dropdownRef={productDropdownRef}
                error={errors.selectedProduct}
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
                <input type="number" value={manualPrice} onChange={e => setManualPrice(e.target.value)} placeholder="Enter selling price" min="0" />
                {errors.manualPrice && <div className="error">{errors.manualPrice}</div>}
              </div>
            ) : null}

            <div className="quantity-tax-row">
              <div>
                <label>Quantity</label>
                <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} min="1" placeholder="Enter qty" />
                {errors.quantity && <div className="error">{errors.quantity}</div>}
              </div>

              {taxMode === "PRODUCT" && (
                <div className="tax-column">
                  <label>GST {taxType === "PERCENT" ? "Rate (%)" : "Amount (₹)"}</label>
                  <div className="tax-input-row">
                    {taxType === "PERCENT" ? (
                      <select value={taxInput} onChange={e => setTaxInput(e.target.value)}>
                        <option value="">Select GST rate</option>
                        {GST_RATES.map(r => <option key={r} value={r}>{r}%{r === 18 ? " (Standard)" : r === 0 ? " (Exempt)" : ""}</option>)}
                      </select>
                    ) : (
                      <input type="number" value={taxInput} onChange={e => setTaxInput(e.target.value)} placeholder="Flat GST amount" min="0" />
                    )}
                    {errors.taxInput && <div className="error">{errors.taxInput}</div>}
                  </div>
                </div>
              )}
            </div>

            <button className="add-btn" onClick={addItem}>
              {editIndex !== null ? "✓ Update Item" : "+ Add Item"}
            </button>
            {errors.lineItems && <div className="error">{errors.lineItems}</div>}

            {lineItems.length > 0 && (
              <div className="sales-section" style={{ marginTop: 16, padding: 0, border: "none" }}>
                <h4>Line Items</h4>
                <table className="sales-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Price (₹)</th>
                      <th>Line Amt (₹)</th>
                      <th>GST (₹)</th>
                      <th>Total (₹)</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((it, idx) => (
                      <tr key={idx}>
                        <td>{it.productName}</td>
                        <td>{it.quantity}</td>
                        <td>{it.sellingPrice}</td>
                        <td>{(it.quantity * it.sellingPrice).toFixed(2)}</td>
                        <td>{it.taxAmount.toFixed(2)}</td>
                        <td>{(it.quantity * it.sellingPrice + it.taxAmount).toFixed(2)}</td>
                        <td>
                          <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                            <button className="sl-action-btn edit" onClick={() => editItem(idx)} title="Edit">
                              <svg xmlns="http://www.w3.org/2000/svg" height="14px" viewBox="0 -960 960 960" width="14px" fill="currentColor">
                                <path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Z"/>
                              </svg>
                            </button>
                            <button className="sl-action-btn delete" onClick={() => deleteItem(idx)} title="Delete">
                              <svg xmlns="http://www.w3.org/2000/svg" height="14px" viewBox="0 -960 960 960" width="14px" fill="currentColor">
                                <path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360Z"/>
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="total-amount">Total (incl. GST): ₹{totalAmount.toFixed(2)}</div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════ BILLING TAB ══════════════ */}
        {activeTab === "Billing" && (
          <div className="sales-section">
            <h4>Billing & Payment</h4>

            <label>Discount</label>
            <div className="tax-row">
              <input type="number" value={discountInput} onChange={e => setDiscountInput(e.target.value)} min="0" placeholder="0" />
              <select value={discountType} onChange={e => setDiscountType(e.target.value)}>
                <option value="PERCENT">%</option>
                <option value="FLAT">₹</option>
              </select>
            </div>
            {errors.discountInput && <div className="error">{errors.discountInput}</div>}

            <label>Billing Mode</label>
            <select value={billingMode} onChange={e => setBillingMode(e.target.value)}>
              <option value="">— Select Billing Mode —</option>
              <option value="CASH">Cash</option>
              <option value="ONLINE">Online / UPI</option>
              <option value="CARD">Card</option>
            </select>
            {errors.billingMode && <div className="error">{errors.billingMode}</div>}

            <div className="total-amount">Net Amount: ₹{netAmount.toFixed(2)}</div>

            <label>Payment Type</label>
            <div className="radio-group">
              <label className={`radio-option ${paymentType === "FULL" ? "checked" : ""}`}>
                <input type="radio" checked={paymentType === "FULL"} onChange={() => setPaymentType("FULL")} />
                Full Payment
              </label>
              <label className={`radio-option ${paymentType === "PARTIAL" ? "checked" : ""}`}>
                <input type="radio" checked={paymentType === "PARTIAL"} onChange={() => setPaymentType("PARTIAL")} />
                Partial Payment
              </label>
            </div>

            <label>Amount Paid (₹)</label>
            <input
              type="number"
              value={amountPaid}
              onChange={e => setAmountPaid(e.target.value)}
              disabled={paymentType === "FULL"}
              min="0"
              placeholder="0.00"
            />
            {errors.amountPaid && <div className="error">{errors.amountPaid}</div>}
          </div>
        )}

        {/* ── FOOTER ── */}
        <div className="sales-footer">
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
          <button className="submit-btn" onClick={submitSales}>Submit Sales</button>
        </div>

      </div>
    </div>
  );
}
