import React, { useEffect, useState } from "react";
import "../../Styles/CommonAEUDForm/FormShell.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
const fmt = n => parseFloat(n || 0).toFixed(2);

/* ── Read-only field ── */
const ViewField = ({ label, value, mono, full }) => (
  <div className={`afx-field ${full ? "afx-field--full" : ""}`}>
    <label className="afx-label">{label}</label>
    <div className={`afx-view-value ${mono ? "afx-view-value--mono" : ""}`}>
      {value || <span className="afx-view-value--empty">—</span>}
    </div>
  </div>
);

/* ── Schedule badge ── */
const SCHEDULE_META = {
  OTC:      { fg: "var(--afx-success)", bg: "var(--afx-success-soft)", label: "OTC — Over the counter" },
  H:        { fg: "var(--afx-warning)", bg: "var(--afx-warning-soft)", label: "H — Prescription required" },
  H1:       { fg: "var(--afx-danger)",  bg: "var(--afx-danger-soft)",  label: "H1 — Strict prescription" },
  NARCOTIC: { fg: "var(--afx-accent)",  bg: "var(--afx-accent-soft)",  label: "Narcotic — Controlled substance" },
};
const ScheduleBadge = ({ type }) => {
  const s = SCHEDULE_META[type] || SCHEDULE_META.OTC;
  return <span className="afx-badge" style={{ background: s.bg, color: s.fg }}>{s.label}</span>;
};

export default function ProductView({ uKey, onClose }) {
  const [product, setProduct] = useState(null);
  const [activeTab, setActiveTab] = useState("details");

  useEffect(() => {
    if (!uKey) return;
    apiClient(`${API_BASE_URL}/api/Product/GetProductByUkey/${uKey}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })
      .then(r => r.json())
      .then(data => { if (data.status === 200) setProduct(data.data); })
      .catch(err => console.error("API Error:", err));
  }, [uKey]);

  if (!uKey) return null;

  const TABS = [
    { id: "details", label: "Details"        },
    { id: "pharma",  label: "Pharma"         },
    { id: "pricing", label: "Pricing & Units" },
  ];

  return (
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--md">
        {!product ? (
          <div className="afx-loading">
            <div className="afx-loader-ring"><div/><div/><div/></div>
          </div>
        ) : (
          <>
            <div className="afx-header">
              <div>
                <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />Read-only Product Record</div>
                <h3 className="afx-title">View Product · {product.productCode}</h3>
              </div>
              <button className="afx-close" onClick={onClose} title="Close">
                <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                ESC
              </button>
            </div>

            <div className="afx-body">
              <div className="afx-tabs">
                {TABS.map(t => (
                  <button type="button" key={t.id} className={`afx-tab ${activeTab === t.id ? "is-active" : ""}`}
                    onClick={() => setActiveTab(t.id)}>{t.label}</button>
                ))}
              </div>

              {activeTab === "details" && (
                <div className="afx-grid">
                  <ViewField label="Product Code" value={product.productCode} mono />
                  <ViewField label="Product Type" value={product.productType} />
                  <ViewField label="Product Name" value={product.name} />

                  {product.description && (
                    <div className="afx-field afx-field--full">
                      <label className="afx-label">Description</label>
                      <div className="afx-view-value">{product.description}</div>
                    </div>
                  )}

                  <div className="afx-field afx-field--full">
                    <label className="afx-label">Status</label>
                    <div>
                      <span
                        className="afx-badge"
                        style={{
                          background: product.disable ? "var(--afx-danger-soft)" : "var(--afx-success-soft)",
                          color: product.disable ? "var(--afx-danger)" : "var(--afx-success)",
                        }}
                      >
                        {product.disable ? "Inactive" : "Active"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "pharma" && (
                <div className="afx-grid">
                  <ViewField label="Manufacturer"        value={product.manufacturerName || product.manufacturer} />
                  <ViewField label="Generic / Salt Name" value={product.genericName} />
                  <ViewField label="HSN Code"            value={product.hsnCode} mono />

                  <div className="afx-field">
                    <label className="afx-label">Schedule Type</label>
                    <div><ScheduleBadge type={product.scheduleType || "OTC"} /></div>
                  </div>

                  {!product.genericName && !product.hsnCode && !product.manufacturerName && (
                    <div className="afx-info afx-field--full">
                      No pharma details entered yet. Edit the product to add manufacturer, HSN code and schedule type.
                    </div>
                  )}
                </div>
              )}

              {activeTab === "pricing" && (
                <div className="afx-grid">
                  <ViewField label="Cost Price" value={`₹ ${fmt(product.price)}`} />
                  <ViewField label="Unit"       value={product.unit} />

                  <ViewField label="Pack Size"
                    value={product.packSize ? `${product.packSize} per ${product.unit || "unit"}` : null}
                  />
                  <ViewField label="Pack Unit" value={product.packUnit} />

                  {product.packSize && product.packUnit && (
                    <div className="afx-info afx-field--full">
                      Each <strong>{product.unit || "unit"}</strong> contains <strong>{product.packSize}</strong> × <strong>{product.packUnit}</strong>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="afx-footer">
              <button className="afx-btn" onClick={onClose}>Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
