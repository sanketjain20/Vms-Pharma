import React, { useState, useEffect, useRef } from "react";
import "../../Styles/CommonAEUDForm/FormShell.css";
import { toast } from "react-toastify";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

/* ── Reusable searchable dropdown ── */
const SearchDrop = ({ label, options, value, onChange, placeholder, error }) => {
  const [search, setSearch] = useState("");
  const [open, setOpen]     = useState(false);
  const ref = useRef(null);
  const selected = options.find(o => String(o.id) === String(value));

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setSearch(""); } };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = options.filter(o => (o.name || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="afx-field">
      {label && <label className="afx-label">{label}</label>}
      <div className="afx-searchdrop" ref={ref}>
        <div
          className={`afx-searchdrop-face ${open ? "is-open" : ""} ${selected ? "is-filled" : ""}`}
          onClick={() => { if (!open) setSearch(""); setOpen(!open); }}
        >
          <span>{selected?.name || placeholder || "Select…"}</span>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        {open && (
          <div className="afx-searchdrop-panel">
            <input
              className="afx-searchdrop-input"
              autoFocus
              value={search}
              placeholder="Search…"
              onChange={e => setSearch(e.target.value)}
            />
            <div className="afx-searchdrop-list">
              {filtered.length === 0 ? (
                <div className="afx-searchdrop-empty">No results</div>
              ) : filtered.map(o => (
                <div
                  key={o.id}
                  className={`afx-searchdrop-item ${String(o.id) === String(value) ? "is-selected" : ""}`}
                  onMouseDown={e => { e.preventDefault(); onChange(o.id); setOpen(false); setSearch(""); }}
                >
                  {o.name}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {error && <div className="afx-error">{error}</div>}
    </div>
  );
};

const SCHEDULE_TYPES = ["OTC", "H", "H1", "NARCOTIC"];
const PACK_UNITS     = ["STRIP", "BOTTLE", "VIAL", "BOX", "TUBE", "SACHET", "AMPOULE"];

export default function ProductForm({ onSubmit, onClose }) {
  const [productTypes,   setProductTypes]   = useState([]);
  const [manufacturers,  setManufacturers]  = useState([]);
  const [activeTab,      setActiveTab]      = useState("details");
  const [errors,         setErrors]         = useState({});
  const [initialLoading, setInitialLoading] = useState(true);

  const [formData, setFormData] = useState({
    name:           "",
    description:    "",
    price:          "",
    unit:           "",
    product_type_id: "",
    manufacturer_id: "",
    genericName:     "",
    hsnCode:         "",
    scheduleType:    "OTC",
    packSize:        "",
    packUnit:        "STRIP",
  });

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [typeRes, manufacturerRes] = await Promise.allSettled([
          apiClient(`${API_BASE_URL}/api/ProductType/GetAllProductType`, {
            method: "GET", headers: { "Content-Type": "application/json" },
          }).then(r => r.json()),
          apiClient(`${API_BASE_URL}/api/Manufacturer/GetManufacturerDropdown`, {
            method: "GET",
          }).then(r => r.json()),
        ]);

        if (!alive) return;
        if (typeRes.status === "fulfilled") {
          const d = typeRes.value?.data;
          const list = Array.isArray(d) ? d : typeof d === "object" ? Object.values(d).find(v => Array.isArray(v)) || [] : [];
          setProductTypes(list);
        } else {
          console.error("Product types error:", typeRes.reason);
        }
        if (manufacturerRes.status === "fulfilled") {
          setManufacturers(manufacturerRes.value?.data || []);
        }
      } finally {
        if (alive) setInitialLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, []);

  const set = (key, val) => {
    setFormData(p => ({ ...p, [key]: val }));
    if (errors[key]) setErrors(p => ({ ...p, [key]: "" }));
  };

  const handleChange = e => {
    set(e.target.name, e.target.value);
  };

  const validate = () => {
    const e = {};
    if (!formData.name?.trim())        e.name           = "Product name is required";
    if (!formData.product_type_id)     e.product_type_id = "Product type is required";
    if (!formData.price)               e.price          = "Price is required";
    if (!formData.unit)                e.unit           = "Unit is required";
    if (formData.packSize && isNaN(parseInt(formData.packSize))) e.packSize = "Pack size must be a number";
    return e;
  };

  const handleSubmit = async e => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) { setErrors(validationErrors); return; }

    const payload = {
      name:             formData.name,
      description:      formData.description,
      price:            parseFloat(formData.price),
      unit:             formData.unit,
      product_type_id:  formData.product_type_id,
      manufacturer_id:  formData.manufacturer_id || null,
      genericName:      formData.genericName      || null,
      hsnCode:          formData.hsnCode          || null,
      scheduleType:     formData.scheduleType      || null,
      packSize:         formData.packSize ? parseInt(formData.packSize) : null,
      packUnit:         formData.packUnit          || null,
    };

    try {
      const res    = await apiClient(`${API_BASE_URL}/api/Product/AddProduct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (res.ok && result.status === 200) {
        toast.success("Product added successfully");
        onSubmit?.(); onClose?.();
      } else {
        toast.error(result.message || "Product creation failed");
      }
    } catch (err) {
      console.error("API ERROR:", err);
      toast.error("Something went wrong while saving product");
    }
  };

  const TABS = [
    { id: "details",  label: "Details"      },
    { id: "pharma",   label: "Pharma"       },
    { id: "pricing",  label: "Pricing & Units" },
  ];

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
                <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />New Product</div>
                <h3 className="afx-title">Add Product</h3>
              </div>
              <button className="afx-close" onClick={onClose} title="Close">
                <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                ESC
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="afx-body">
                <div className="afx-tabs">
                  {TABS.map(t => (
                    <button type="button" key={t.id} className={`afx-tab ${activeTab === t.id ? "is-active" : ""}`}
                      onClick={() => setActiveTab(t.id)}>{t.label}</button>
                  ))}
                </div>

                {activeTab === "details" && (
                  <div className="afx-grid">
                    <div className="afx-field">
                      <label className="afx-label">Product Name<span className="afx-req">*</span></label>
                      <input className={`afx-input ${errors.name ? "afx-input--err" : ""}`} type="text" name="name" value={formData.name} onChange={handleChange} placeholder="e.g. Paracetamol 500mg" />
                      {errors.name && <div className="afx-error">{errors.name}</div>}
                    </div>

                    <SearchDrop label={<>Product Type <span className="afx-req">*</span></>}
                      options={productTypes} value={formData.product_type_id}
                      onChange={v => set("product_type_id", v)}
                      placeholder="Select product type"
                      error={errors.product_type_id}
                    />

                    <div className="afx-field afx-field--full">
                      <label className="afx-label">Description</label>
                      <textarea className="afx-textarea" name="description" value={formData.description} onChange={handleChange} rows={4} placeholder="Enter description" />
                    </div>
                  </div>
                )}

                {activeTab === "pharma" && (
                  <div className="afx-grid">
                    <SearchDrop label="Manufacturer"
                      options={manufacturers} value={formData.manufacturer_id}
                      onChange={v => set("manufacturer_id", v)}
                      placeholder="Select manufacturer (optional)"
                    />

                    <div className="afx-field">
                      <label className="afx-label">Generic / Salt Name</label>
                      <input className="afx-input" type="text" name="genericName" value={formData.genericName} onChange={handleChange} placeholder="e.g. Paracetamol" />
                    </div>

                    <div className="afx-field">
                      <label className="afx-label">HSN Code</label>
                      <input className="afx-input" type="text" name="hsnCode" value={formData.hsnCode} onChange={handleChange} placeholder="e.g. 3004" />
                    </div>

                    <div className="afx-field">
                      <label className="afx-label">Schedule Type</label>
                      <div className="afx-select-wrap">
                        <select className="afx-select" name="scheduleType" value={formData.scheduleType} onChange={handleChange}>
                          {SCHEDULE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                    </div>

                    <div className="afx-info afx-field--full">
                      <strong>OTC</strong>&nbsp;— no prescription&emsp;
                      <strong>H</strong>&nbsp;— prescription required&emsp;
                      <strong>H1</strong>&nbsp;— strict prescription&emsp;
                      <strong>NARCOTIC</strong>&nbsp;— controlled substance
                    </div>
                  </div>
                )}

                {activeTab === "pricing" && (
                  <div className="afx-grid">
                    <div className="afx-field">
                      <label className="afx-label">Cost Price (₹)<span className="afx-req">*</span></label>
                      <input className={`afx-input ${errors.price ? "afx-input--err" : ""}`} type="number" name="price" value={formData.price} onChange={handleChange} placeholder="0.00" min="0" step="0.01" />
                      {errors.price && <div className="afx-error">{errors.price}</div>}
                    </div>

                    <div className="afx-field">
                      <label className="afx-label">Unit<span className="afx-req">*</span></label>
                      <input className={`afx-input ${errors.unit ? "afx-input--err" : ""}`} type="text" name="unit" value={formData.unit} onChange={handleChange} placeholder="e.g. Strip, Bottle, Vial" />
                      {errors.unit && <div className="afx-error">{errors.unit}</div>}
                    </div>

                    <div className="afx-field">
                      <label className="afx-label">Pack Size <span style={{ color: "var(--afx-text-3)", fontWeight: 400 }}>(qty per unit)</span></label>
                      <input className={`afx-input ${errors.packSize ? "afx-input--err" : ""}`} type="number" name="packSize" value={formData.packSize} onChange={handleChange} placeholder="e.g. 10 tablets per strip" min="1" />
                      {errors.packSize && <div className="afx-error">{errors.packSize}</div>}
                    </div>

                    <div className="afx-field">
                      <label className="afx-label">Pack Unit</label>
                      <div className="afx-select-wrap">
                        <select className="afx-select" name="packUnit" value={formData.packUnit} onChange={handleChange}>
                          <option value="">— Select —</option>
                          {PACK_UNITS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                    </div>

                    {formData.packSize && formData.packUnit && (
                      <div className="afx-info afx-field--full">
                        Each <strong>{formData.unit || "unit"}</strong> contains <strong>{formData.packSize}</strong> items packed as <strong>{formData.packUnit}</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="afx-footer">
                <button className="afx-btn" type="button" onClick={onClose}>Cancel</button>
                <button type="submit" className="afx-btn afx-btn--primary">Save Product</button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
