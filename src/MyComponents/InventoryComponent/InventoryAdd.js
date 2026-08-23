import React, { useState, useEffect, useRef } from "react";
import "../../Styles/CommonAEUDForm/FormShell.css";
import { toast } from "react-toastify";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

/* ── Reusable searchable dropdown ── */
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

export default function InventoryAdd({ onSubmit, onClose }) {
  const [products, setProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const lastLoadedType = useRef(null);

  const [activeTab, setActiveTab] = useState("details");

  const [formData, setFormData] = useState({
    product_id: "",
    currentQuantity: "",
    reorderLevel: "",
    unitSellingPrice: "",
  });

  const [productTypeId, setProductTypeId] = useState("");

  const [errors, setErrors] = useState({});
  const [initialLoading, setInitialLoading] = useState(true);

  const fetchUrl = `${API_BASE_URL}/api/Product/GetAllProduct`;

  /** FETCH ALL PRODUCTS FOR DROPDOWN */
  useEffect(() => {
    apiClient(fetchUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.json())
      .then((response) => {
        if (response.status === 200 && response.data) {
          const dataObj = response.data;
          const list =
            Array.isArray(dataObj)
              ? dataObj
              : typeof dataObj === "object"
                ? Object.values(dataObj).find((v) => Array.isArray(v)) || []
                : [];

          setProducts(list);
          setAllProducts(list);
        }
      })
      .catch((err) => console.error("Error fetching products:", err))
      .finally(() => setInitialLoading(false));
  }, []);

  /* FETCH PRODUCT TYPES */
  useEffect(() => {
    apiClient(`${API_BASE_URL}/api/ProductType/GetAllProductType`, {})
      .then(res => res.json())
      .then(json => setProductTypes(json?.data?.productTypes || []));
  }, []);

  /** HANDLE FIELD CHANGE */
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  };

  /** VALIDATION */
  const validate = () => {
    const e = {};
    if (!formData.product_id)
      e.product_id = "Product selection is mandatory";
    if (!formData.currentQuantity)
      e.currentQuantity = "Current quantity is required";
    if (!formData.reorderLevel)
      e.reorderLevel = "Reorder level is required";
    if (!formData.unitSellingPrice)
      e.unitSellingPrice = "Unit selling price is required";
    return e;
  };

  /** SUBMIT FORM */
  const handleSubmit = async (e) => {
    e.preventDefault();
    const v = validate();
    if (Object.keys(v).length > 0) {
      setErrors(v);
      return;
    }

    const payload = {
      product_id: formData.product_id,
      currentQuantity: parseFloat(formData.currentQuantity),
      reorderLevel: parseFloat(formData.reorderLevel),
      unitSellingPrice: parseFloat(formData.unitSellingPrice),
    };

    try {
      const response = await apiClient(
        `${API_BASE_URL}/api/Inventory/AddInventory`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();

      if (response.ok && result.status === 200) {
        toast.success("Inventory added successfully!");
        onSubmit();
        onClose();
      } else {
        toast.error(result.message || "Failed to add inventory");
      }
    } catch (err) {
      console.error("Inventory Add Error:", err);
      toast.error("Error occurred while adding inventory");
    }
  };

  /* LOAD PRODUCTS WHEN PRODUCT TYPE CHANGES */
  useEffect(() => {
    if (!productTypeId) {
      setProducts(allProducts);
      return;
    }
    if (lastLoadedType.current === productTypeId) return;
    lastLoadedType.current = productTypeId;

    apiClient(`${API_BASE_URL}/api/Product/GetProdByProdId/${productTypeId}`, {})
      .then(res => res.json())
      .then(json => setProducts((json?.data || []).filter(p => p.disable === 0)));
  }, [productTypeId, allProducts]);

  /* WHEN PRODUCT SELECTED → FETCH ITS PRODUCT TYPE FROM API */
  useEffect(() => {
    if (!formData.product_id) return;

    apiClient(`${API_BASE_URL}/api/ProductType/GetProdTypeByProductId/${formData.product_id}`, {})
      .then(res => res.json())
      .then(json => {
        const typeId = json?.data?.productTypeId || json?.data?.id;
        if (typeId) setProductTypeId(typeId);
      })
      .catch(() => { });
  }, [formData.product_id]);

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
                <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />New Inventory</div>
                <h3 className="afx-title">Add Inventory</h3>
              </div>
              <button className="afx-close" onClick={onClose} title="Close">
                <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                ESC
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="afx-body">
                <div className="afx-tabs">
                  {["details", "stock"].map((tab) => (
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
                      onChange={(id) => setFormData({ ...formData, product_id: id })}
                      placeholder="Choose a product"
                      error={errors.product_id}
                    />
                  </div>
                )}

                {activeTab === "stock" && (
                  <div className="afx-grid">
                    <div className="afx-field">
                      <label className="afx-label">Current Quantity<span className="afx-req">*</span></label>
                      <input
                        type="number"
                        name="currentQuantity"
                        className={`afx-input ${errors.currentQuantity ? "afx-input--err" : ""}`}
                        value={formData.currentQuantity}
                        onChange={handleChange}
                      />
                      {errors.currentQuantity && <div className="afx-error">{errors.currentQuantity}</div>}
                    </div>

                    <div className="afx-field">
                      <label className="afx-label">Reorder Level<span className="afx-req">*</span></label>
                      <input
                        type="number"
                        name="reorderLevel"
                        className={`afx-input ${errors.reorderLevel ? "afx-input--err" : ""}`}
                        value={formData.reorderLevel}
                        onChange={handleChange}
                      />
                      {errors.reorderLevel && <div className="afx-error">{errors.reorderLevel}</div>}
                    </div>

                    <div className="afx-field">
                      <label className="afx-label">Unit Selling Price<span className="afx-req">*</span></label>
                      <input
                        type="number"
                        name="unitSellingPrice"
                        className={`afx-input ${errors.unitSellingPrice ? "afx-input--err" : ""}`}
                        value={formData.unitSellingPrice}
                        onChange={handleChange}
                      />
                      {errors.unitSellingPrice && <div className="afx-error">{errors.unitSellingPrice}</div>}
                    </div>
                  </div>
                )}
              </div>

              <div className="afx-footer">
                <button className="afx-btn" type="button" onClick={onClose}>Cancel</button>
                <button type="submit" className="afx-btn afx-btn--primary">Save Inventory</button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
