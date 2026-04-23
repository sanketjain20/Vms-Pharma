import React, { useState, useEffect, useRef } from "react";
import "../../Styles/Product/ProductForm.css";
import { toast } from "react-toastify";

/* ── Reusable searchable dropdown — same as Add ── */
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
    <div>
      {label && <label>{label}</label>}
      <div className="custom-select" ref={ref}>
        <div className={`select-box ${open ? "active" : ""}`} onClick={() => { if (!open) setSearch(""); setOpen(!open); }}>
          <input type="text" className="select-input"
            value={open ? search : (selected?.name || "")}
            placeholder={placeholder || "Select…"}
            onChange={e => setSearch(e.target.value)}
            onClick={e => { e.stopPropagation(); if (!open) setSearch(""); setOpen(true); }}
          />
          {open && (
            <ul className="options">
              {filtered.map(o => (
                <li key={o.id} onMouseDown={e => { e.preventDefault(); onChange(o.id); setOpen(false); setSearch(""); }}
                  style={String(o.id) === String(value) ? { color: "#93c5fd", background: "rgba(59,130,246,0.1)" } : {}}>
                  {o.name}
                </li>
              ))}
              {filtered.length === 0 && <li style={{ color: "#777", fontStyle: "italic" }}>No results</li>}
            </ul>
          )}
        </div>
      </div>
      {error && <div className="error-msg">{error}</div>}
    </div>
  );
};

const SCHEDULE_TYPES = ["OTC", "H", "H1", "NARCOTIC"];
const PACK_UNITS     = ["STRIP", "BOTTLE", "VIAL", "BOX", "TUBE", "SACHET", "AMPOULE"];

export default function ProductEdit({ uKey, onClose, onSubmit }) {
  const [productTypes,  setProductTypes]  = useState([]);
  const [manufacturers, setManufacturers] = useState([]);
  const [activeTab,     setActiveTab]     = useState("details");
  const [errors,        setErrors]        = useState({});
  const [originalData,  setOriginalData]  = useState(null);

  const [formData, setFormData] = useState({
    id:              "",
    productCode:     "",
    name:            "",
    description:     "",
    price:           "",
    unit:            "",
    product_type_id: "",
    productType:     "",
    // NEW pharma fields
    manufacturer_id: "",
    manufacturerName:"",
    genericName:     "",
    hsnCode:         "",
    scheduleType:    "OTC",
    packSize:        "",
    packUnit:        "STRIP",
  });

  /* ── FETCH PRODUCT TYPES ── */
  useEffect(() => {
    fetch("http://localhost:8080/api/ProductType/GetAllProductType", {
      method: "GET", credentials: "include", headers: { "Content-Type": "application/json" },
    })
      .then(r => r.json())
      .then(res => {
        if (res.status === 200 && res.data) {
          const d = res.data;
          const list = Array.isArray(d) ? d : typeof d === "object" ? Object.values(d).find(v => Array.isArray(v)) || [] : [];
          setProductTypes(list);
        }
      })
      .catch(err => console.error("Product types error:", err));
  }, []);

  /* ── FETCH MANUFACTURERS ── */
  useEffect(() => {
    fetch("http://localhost:8080/api/Manufacturer/GetDropdown", {
      method: "GET", credentials: "include",
    })
      .then(r => r.json())
      .then(res => setManufacturers(res.data || []))
      .catch(() => {});
  }, []);

  /* ── LOAD PRODUCT ── */
  useEffect(() => {
    if (!uKey) return;
    fetch(`http://localhost:8080/api/Product/GetProductByUkey/${uKey}`, {
      method: "GET", credentials: "include", headers: { "Content-Type": "application/json" },
    })
      .then(r => r.json())
      .then(res => {
        if (res.status === 200 && res.data) {
          const p = res.data;
          setFormData(prev => ({
            ...prev,
            id:              p.id              || "",
            productCode:     p.productCode     || "",
            name:            p.name            || "",
            description:     p.description     || "",
            price:           p.price           || "",
            unit:            p.unit            || "",
            product_type_id: p.productTypeId   || p.product_type_id || "",
            productType:     p.productType     || "",
            // NEW fields — fall back gracefully if not yet returned by backend
            manufacturer_id: p.manufacturerId  || "",
            manufacturerName:p.manufacturerName|| "",
            genericName:     p.genericName     || "",
            hsnCode:         p.hsnCode         || "",
            scheduleType:    p.scheduleType    || "OTC",
            packSize:        p.packSize        || "",
            packUnit:        p.packUnit        || "STRIP",
          }));
          setOriginalData({
            name:            p.name,
            description:     p.description,
            price:           p.price,
            unit:            p.unit,
            product_type_id: p.productTypeId || p.product_type_id,
            manufacturer_id: p.manufacturerId  || "",
            genericName:     p.genericName     || "",
            hsnCode:         p.hsnCode         || "",
            scheduleType:    p.scheduleType    || "OTC",
            packSize:        p.packSize        || "",
            packUnit:        p.packUnit        || "STRIP",
          });
        } else {
          toast.error("Error loading product details");
        }
      })
      .catch(err => console.error("Product load error:", err));
  }, [uKey]);

  /* ── MAP productType name → id (backwards compat) ── */
  useEffect(() => {
    if (productTypes.length > 0 && formData.productType && !formData.product_type_id) {
      const match = productTypes.find(pt =>
        pt.name.trim().toLowerCase() === formData.productType.trim().toLowerCase()
      );
      if (match) setFormData(prev => ({ ...prev, product_type_id: match.id }));
    }
  }, [productTypes, formData.productType]);

  const set = (key, val) => {
    setFormData(p => ({ ...p, [key]: val }));
    if (errors[key]) setErrors(p => ({ ...p, [key]: "" }));
  };

  const handleChange = e => set(e.target.name, e.target.value);

  const validate = () => {
    const e = {};
    if (!formData.name?.trim())    e.name            = "Name is required";
    if (!formData.product_type_id) e.product_type_id = "Product type is required";
    if (!formData.price)           e.price           = "Price is required";
    if (!formData.unit)            e.unit            = "Unit is required";
    if (formData.packSize && isNaN(parseInt(formData.packSize))) e.packSize = "Must be a number";
    return e;
  };

  /* ── YOUR EXISTING isChanged — extended with new fields ── */
  const isChanged = () => {
    if (!originalData) return false;
    const norm = obj => ({
      name:            obj.name            ?? "",
      description:     obj.description     ?? "",
      price:           Number(obj.price    ?? 0),
      unit:            obj.unit            ?? "",
      product_type_id: Number(obj.product_type_id ?? 0),
      manufacturer_id: String(obj.manufacturer_id ?? ""),
      genericName:     obj.genericName     ?? "",
      hsnCode:         obj.hsnCode         ?? "",
      scheduleType:    obj.scheduleType    ?? "OTC",
      packSize:        String(obj.packSize ?? ""),
      packUnit:        obj.packUnit        ?? "",
    });
    return JSON.stringify(norm(originalData)) !== JSON.stringify(norm(formData));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) { setErrors(validationErrors); return; }

    const payload = {
      name:            formData.name,
      description:     formData.description,
      price:           parseFloat(formData.price),
      unit:            formData.unit,
      product_type_id: formData.product_type_id,
      // NEW fields
      manufacturer_id: formData.manufacturer_id || null,
      genericName:     formData.genericName      || null,
      hsnCode:         formData.hsnCode          || null,
      scheduleType:    formData.scheduleType      || null,
      packSize:        formData.packSize ? parseInt(formData.packSize) : null,
      packUnit:        formData.packUnit          || null,
    };

    try {
      const res    = await fetch(`http://localhost:8080/api/Product/UpdateProd/${formData.id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (res.ok && result.status === 200) {
        toast.success("Product updated successfully");
        onSubmit?.(); onClose?.();
      } else {
        toast.error(result.message || "Update failed");
      }
    } catch (err) {
      console.error("API ERROR:", err);
      toast.error("Something went wrong");
    }
  };

  const TABS = [
    { id: "details", label: "Details"        },
    { id: "pharma",  label: "Pharma"         },
    { id: "pricing", label: "Pricing & Units" },
  ];

  return (
    <div className="modal-backdrop show">
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">
            <h3>Edit Product | {formData.productCode}</h3>
            <div className="small-muted">Modify product details</div>
          </div>
          <div className="modal-controls">
            <div className="tab-row">
              {TABS.map(t => (
                <div key={t.id} className={`tab ${activeTab === t.id ? "active" : ""}`}
                  onClick={() => setActiveTab(t.id)}>{t.label}</div>
              ))}
            </div>
            <button className="btn-ghost" onClick={onClose}>✖</button>
          </div>
        </div>

        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="form-col scrollable">

            {/* ════ DETAILS TAB ════ */}
            {activeTab === "details" && (
              <div className="form-grid">
                <div>
                  <label>Product Name <span className="pf-req">*</span></label>
                  <input type="text" name="name" value={formData.name || ""} onChange={handleChange} />
                  {errors.name && <div className="error-msg">{errors.name}</div>}
                </div>

                <SearchDrop label={<>Product Type <span className="pf-req">*</span></>}
                  options={productTypes} value={formData.product_type_id}
                  onChange={v => set("product_type_id", v)}
                  placeholder="Select product type"
                  error={errors.product_type_id}
                />

                <div>
                  <label>Description</label>
                  <textarea name="description" rows={4} value={formData.description || ""} onChange={handleChange} />
                </div>
              </div>
            )}

            {/* ════ PHARMA TAB ════ */}
            {activeTab === "pharma" && (
              <div className="form-grid">

                <SearchDrop label="Manufacturer"
                  options={manufacturers} value={formData.manufacturer_id}
                  onChange={v => set("manufacturer_id", v)}
                  placeholder="Select manufacturer (optional)"
                />

                <div>
                  <label>Generic / Salt Name</label>
                  <input type="text" name="genericName" value={formData.genericName || ""} onChange={handleChange} placeholder="e.g. Paracetamol" />
                </div>

                <div>
                  <label>HSN Code</label>
                  <input type="text" name="hsnCode" value={formData.hsnCode || ""} onChange={handleChange} placeholder="e.g. 3004" />
                </div>

                <div>
                  <label>Schedule Type</label>
                  <select name="scheduleType" value={formData.scheduleType || "OTC"} onChange={handleChange}>
                    {SCHEDULE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="pf-info-banner full">
                  <strong>OTC</strong> — No prescription&nbsp;&nbsp;
                  <strong>H</strong> — Prescription required&nbsp;&nbsp;
                  <strong>H1</strong> — Strict prescription&nbsp;&nbsp;
                  <strong>NARCOTIC</strong> — Controlled substance
                </div>
              </div>
            )}

            {/* ════ PRICING & UNITS TAB ════ */}
            {activeTab === "pricing" && (
              <div className="form-grid">
                <div>
                  <label>Cost Price (₹) <span className="pf-req">*</span></label>
                  <input type="number" name="price" value={formData.price || ""} onChange={handleChange} placeholder="0.00" min="0" step="0.01" />
                  {errors.price && <div className="error-msg">{errors.price}</div>}
                </div>

                <div>
                  <label>Unit <span className="pf-req">*</span></label>
                  <input type="text" name="unit" value={formData.unit || ""} onChange={handleChange} placeholder="e.g. Strip, Bottle" />
                  {errors.unit && <div className="error-msg">{errors.unit}</div>}
                </div>

                <div>
                  <label>Pack Size <span className="pf-hint">(qty per unit)</span></label>
                  <input type="number" name="packSize" value={formData.packSize || ""} onChange={handleChange} placeholder="e.g. 10" min="1" />
                  {errors.packSize && <div className="error-msg">{errors.packSize}</div>}
                </div>

                <div>
                  <label>Pack Unit</label>
                  <select name="packUnit" value={formData.packUnit || "STRIP"} onChange={handleChange}>
                    <option value="">— Select —</option>
                    {PACK_UNITS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                {formData.packSize && formData.packUnit && (
                  <div className="pf-info-banner full">
                    Each <strong>{formData.unit || "unit"}</strong> contains <strong>{formData.packSize}</strong> × <strong>{formData.packUnit}</strong>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="modal-footer-fixed">
            <div className="modal-actions">
              <button className="btn-ghost" type="button" onClick={onClose}>Cancel</button>
              {/* Keep your existing isChanged guard */}
              {isChanged() && (
                <button type="submit" className="submit-button">Update Product</button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
