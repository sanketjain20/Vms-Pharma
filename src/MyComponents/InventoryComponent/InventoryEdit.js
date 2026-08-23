import React, { useState, useEffect, useRef } from "react";
import "../../Styles/CommonAEUDForm/FormShell.css";
import { toast } from "react-toastify";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

/* ── Reusable searchable dropdown (mirrors InventoryAdd.js) ── */
function SearchDrop({ label, options, value, onChange, placeholder, error, getLabel = (o) => o.name, getId = (o) => o.id }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = options.find(o => String(getId(o)) === String(value));

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setSearch(""); } };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = options.filter(o => getLabel(o).toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="afx-field">
      {label && <label className="afx-label">{label}</label>}
      <div className="afx-searchdrop" ref={ref}>
        <div
          className={`afx-searchdrop-face ${open ? "is-open" : ""} ${selected ? "is-filled" : ""}`}
          onClick={() => { if (!open) setSearch(""); setOpen(!open); }}
        >
          <span>{selected ? getLabel(selected) : (placeholder || "Select…")}</span>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        {open && (
          <div className="afx-searchdrop-panel">
            <input
              className="afx-searchdrop-input"
              autoFocus
              placeholder={`Search ${label || ""}…`}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div className="afx-searchdrop-list">
              {filtered.length === 0 ? (
                <div className="afx-searchdrop-empty">No results</div>
              ) : filtered.map(o => (
                <div
                  key={getId(o)}
                  className={`afx-searchdrop-item ${String(getId(o)) === String(value) ? "is-selected" : ""}`}
                  onMouseDown={e => { e.preventDefault(); onChange(getId(o)); setOpen(false); setSearch(""); }}
                >
                  {getLabel(o)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {error && <div className="afx-error">{error}</div>}
    </div>
  );
}

export default function InventoryEdit({ uKey, onClose, onSubmit }) {
  const [products, setProducts]               = useState([]);
  const [productTypes, setProductTypes]       = useState([]);
  const [productTypeId, setProductTypeId]     = useState("");
  const [allProducts, setAllProducts]         = useState([]);
  const isInitialLoad                         = useRef(true);

  const [showStockScreen, setShowStockScreen] = useState(false);
  const [stockQty, setStockQty]               = useState("");
  const [stockActionType, setStockActionType] = useState(null);
  const [stockMovementPayload, setStockMovementPayload] = useState(null);

  const [activeTab, setActiveTab] = useState("details");
  const [formData, setFormData]   = useState({
    product_id: "", currentQuantity: "", reorderLevel: "", unitSellingPrice: "",
  });
  const [inventoryId, setInventoryId]   = useState(null);
  const [originalData, setOriginalData] = useState(null);
  const [errors, setErrors]             = useState({});
  const [initialLoading, setInitialLoading] = useState(true);

  const apiGetAllProducts   = `${API_BASE_URL}/api/Product/GetAllProduct`;
  const apiGetInventory     = `${API_BASE_URL}/api/Inventory/GetInventoryByUkey/${uKey}`;
  const apiUpdateInventoryBase = `${API_BASE_URL}/api/Inventory/UpdateInventory`;

  /* ── FETCH PRODUCTS ── */
  useEffect(() => {
    apiClient(apiGetAllProducts, { method: "GET", headers: { "Content-Type": "application/json" } })
      .then(r => r.json())
      .then(res => {
        if (res.status === 200 && Array.isArray(res.data?.products)) {
          setProducts(res.data.products);
          setAllProducts(res.data.products);
        } else { toast.error("Failed to load products"); setInitialLoading(false); }
      })
      .catch(() => { toast.error("Failed to load products"); setInitialLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── FETCH PRODUCT TYPES ── */
  useEffect(() => {
    apiClient(`${API_BASE_URL}/api/ProductType/GetAllProductType`)
      .then(r => r.json())
      .then(json => setProductTypes(json?.data?.productTypes || []));
  }, []);

  /* ── FETCH INVENTORY ── */
  useEffect(() => {
    if (products.length === 0 || !isInitialLoad.current) return;
    apiClient(apiGetInventory, { method: "GET", headers: { "Content-Type": "application/json" } })
      .then(r => r.json())
      .then(res => {
        if (!res.data) { toast.error("Inventory not found"); return; }
        const inv = res.data;
        setInventoryId(inv.id);
        const init = {
          product_id: inv.productId,
          currentQuantity: inv.currentQuantity || "",
          reorderLevel: inv.reorderLevel,
          unitSellingPrice: inv.unitSellingPrice,
          inventoryCode: inv.inventoryCode,
        };
        setFormData(init);
        setOriginalData(init);
        if (inv.productTypeId) setProductTypeId(inv.productTypeId);
        isInitialLoad.current = false;
      })
      .catch(() => toast.error("Error loading inventory"))
      .finally(() => setInitialLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

  /* ── PRODUCT → TYPE ── */
  useEffect(() => {
    if (!formData.product_id) return;
    apiClient(`${API_BASE_URL}/api/ProductType/GetProdTypeByProductId/${formData.product_id}`)
      .then(r => r.json())
      .then(json => { if (json?.data?.id) setProductTypeId(json.data.id); });
  }, [formData.product_id]);

  /* ── TYPE → PRODUCTS ── */
  useEffect(() => {
    if (!productTypeId) { setProducts(allProducts); return; }
    apiClient(`${API_BASE_URL}/api/Product/GetProdByProdId/${productTypeId}`)
      .then(r => r.json())
      .then(json => setProducts(json?.data || []));
  }, [productTypeId, allProducts]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value === "" ? "" : Number(value) }));
    setErrors(prev => ({ ...prev, [name]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!formData.product_id) e.product_id = "Product is required";
    if (formData.reorderLevel === "" || formData.reorderLevel === null) e.reorderLevel = "Reorder level is required";
    if (formData.unitSellingPrice === "" || formData.unitSellingPrice === null) e.unitSellingPrice = "Unit selling price is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const detectChanges = () =>
    originalData && (
      formData.product_id !== originalData.product_id ||
      formData.reorderLevel !== originalData.reorderLevel ||
      formData.unitSellingPrice !== originalData.unitSellingPrice
    );

  const handleSubmit = () => {
    if (!validate()) return;
    if (!detectChanges() && !stockMovementPayload) return toast.info("No changes to update");
    if (!inventoryId) return toast.error("Inventory ID missing");

    apiClient(`${apiUpdateInventoryBase}/${inventoryId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: Number(formData.product_id),
        currentQuantity: Number(formData.currentQuantity),
        reorderLevel: Number(formData.reorderLevel),
        unitSellingPrice: Number(formData.unitSellingPrice),
        stockMovement: stockMovementPayload || null,
      }),
    })
      .then(r => r.json())
      .then(res => {
        if (res.status === 200) { toast.success("Inventory updated successfully"); onSubmit(); onClose(); }
        else toast.error(res.message || "Update failed");
      })
      .catch(() => toast.error("Error updating inventory"));
  };

  const handleStockAction = (type) => { setStockActionType(type); setStockQty(""); };

  const handleStockUpdate = () => {
    const qty = Number(stockQty);
    const current = Number(formData.currentQuantity);
    if (!qty || qty <= 0) return toast.error("Enter valid quantity");

    let movementType = null;
    if (stockActionType === "add")     movementType = "ADD";
    if (stockActionType === "reduce")  { if (qty > current) return toast.error("Cannot reduce more than current stock"); movementType = "SALE"; }
    if (stockActionType === "damaged") { if (qty > current) return toast.error("Damaged qty exceeds stock"); movementType = "DAMAGE"; }
    if (stockActionType === "adjust")  movementType = "ADJUSTMENT";

    setStockMovementPayload({
      productId: Number(formData.product_id),
      inventoryId,
      movementType,
      quantity: qty,
      unitSellingPrice: Number(formData.unitSellingPrice),
      referenceId: null,
      note: stockActionType,
    });

    toast.success("Stock movement prepared. Click Update Inventory to save.");
    setStockActionType(null);
    setShowStockScreen(false);
  };

  /* ── STOCK CARDS CONFIG ── */
  const stockCards = [
    { key: "add",     emoji: "➕", label: "Add Stock" },
    { key: "reduce",  emoji: "➖", label: "Reduce Stock" },
    { key: "damaged", emoji: "💥", label: "Mark Damaged" },
    { key: "adjust",  emoji: "⚖️",  label: "Adjust Stock" },
  ];

  const stockActionTitle =
    stockActionType === "add"     ? "Add Stock" :
    stockActionType === "reduce"  ? "Reduce Stock" :
    stockActionType === "damaged" ? "Mark Damaged Stock" :
    stockActionType === "adjust"  ? "Adjust Stock Quantity" : "";

  const stockQtyLabel =
    stockActionType === "adjust"  ? "New Quantity" :
    stockActionType === "damaged" ? "Damaged Quantity" : "Quantity";

  return (
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--md">
        {initialLoading ? (
          <div className="afx-loading">
            <div className="afx-loader-ring"><div/><div/><div/></div>
          </div>
        ) : (
          <>
            <div className="afx-header">
              <div>
                <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />Edit Inventory{formData.inventoryCode ? ` · ${formData.inventoryCode}` : ""}</div>
                <h3 className="afx-title">Update Inventory</h3>
              </div>
              <button className="afx-close" onClick={onClose} title="Close">
                <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                ESC
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
              <div className="afx-body">
                {showStockScreen ? (
                  stockActionType ? (
                    /* ── ACTION INPUT ── */
                    <>
                      <div className="afx-perms-head">
                        <div className="afx-perms-title">{stockActionTitle}</div>
                        <button type="button" className="afx-btn" onClick={() => setStockActionType(null)}>← Back</button>
                      </div>
                      <div className="afx-grid">
                        <div className="afx-field">
                          <label className="afx-label">Current Quantity</label>
                          <input className="afx-input" type="number" value={formData.currentQuantity} readOnly />
                        </div>
                        <div className="afx-field">
                          <label className="afx-label">{stockQtyLabel}</label>
                          <input
                            className="afx-input"
                            type="number"
                            value={stockQty}
                            onChange={e => setStockQty(e.target.value)}
                            placeholder="Enter quantity"
                            autoFocus
                          />
                        </div>
                      </div>
                      <div>
                        <button type="button" className="afx-btn afx-btn--primary" onClick={handleStockUpdate}>
                          Confirm Update
                        </button>
                      </div>
                    </>
                  ) : (
                    /* ── STOCK OPTIONS ── */
                    <>
                      <div className="afx-perms-head">
                        <div className="afx-perms-title">Manage Stock</div>
                        <button type="button" className="afx-btn" onClick={() => setShowStockScreen(false)}>← Back</button>
                      </div>
                      <div className="afx-actions-grid">
                        {stockCards.map(card => (
                          <div
                            key={card.key}
                            className="afx-action"
                            onClick={() => handleStockAction(card.key)}
                            style={{ cursor: "pointer", flexDirection: "column", gap: 4, padding: "14px 9px" }}
                          >
                            <span style={{ fontSize: 18 }}>{card.emoji}</span>
                            <span className="afx-action-label">{card.label}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )
                ) : (
                  /* ══ MAIN TABS ══ */
                  <>
                    <div className="afx-tabs">
                      {["details", "stock"].map(tab => (
                        <button
                          type="button"
                          key={tab}
                          className={`afx-tab ${activeTab === tab ? "is-active" : ""}`}
                          onClick={() => setActiveTab(tab)}
                        >
                          {tab === "details" ? "Product" : "Stock & Pricing"}
                        </button>
                      ))}
                    </div>

                    {activeTab === "details" && (
                      <div className="afx-grid">
                        <SearchDrop
                          label="Product Type"
                          options={productTypes}
                          value={productTypeId}
                          onChange={setProductTypeId}
                          placeholder="Select product type"
                        />
                        <SearchDrop
                          label="Select Product"
                          options={products}
                          value={formData.product_id}
                          onChange={(id) => setFormData(prev => ({ ...prev, product_id: id }))}
                          placeholder="Select product"
                          error={errors.product_id}
                        />
                      </div>
                    )}

                    {activeTab === "stock" && (
                      <div className="afx-grid">
                        <div className="afx-field">
                          <label className="afx-label">Current Quantity</label>
                          <input className="afx-input" type="number" name="currentQuantity" value={formData.currentQuantity} readOnly />
                        </div>
                        <div className="afx-field">
                          <label className="afx-label">Reorder Level<span className="afx-req">*</span></label>
                          <input
                            className={`afx-input ${errors.reorderLevel ? "afx-input--err" : ""}`}
                            type="number" name="reorderLevel" value={formData.reorderLevel}
                            onChange={handleChange} placeholder="Enter reorder level"
                          />
                          {errors.reorderLevel && <div className="afx-error">{errors.reorderLevel}</div>}
                        </div>
                        <div className="afx-field">
                          <label className="afx-label">Unit Selling Price (₹)<span className="afx-req">*</span></label>
                          <input
                            className={`afx-input ${errors.unitSellingPrice ? "afx-input--err" : ""}`}
                            type="number" name="unitSellingPrice" value={formData.unitSellingPrice}
                            onChange={handleChange} placeholder="Enter price"
                          />
                          {errors.unitSellingPrice && <div className="afx-error">{errors.unitSellingPrice}</div>}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="afx-footer">
                {!showStockScreen && (
                  <button type="button" className="afx-btn" onClick={() => setShowStockScreen(true)}>⚙ Manage Stock</button>
                )}
                <button type="button" className="afx-btn" onClick={onClose}>Cancel</button>
                {!showStockScreen && !stockActionType && (detectChanges() || stockMovementPayload) && (
                  <button type="button" className="afx-btn afx-btn--primary" onClick={handleSubmit}>
                    Update Inventory
                  </button>
                )}
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
