import React, { useEffect, useState } from "react";
import "../../Styles/Product/ProductForm.css";

const fmt = n => parseFloat(n || 0).toFixed(2);

/* ── Read-only field ── */
const ViewField = ({ label, value, mono, full }) => (
  <div className={full ? "full" : ""}>
    <label>{label}</label>
    <input type="text" value={value || "—"} readOnly
      style={mono ? { fontFamily: "var(--mf-font-m)", fontSize: 12 } : {}} />
  </div>
);

/* ── Schedule badge ── */
const ScheduleBadge = ({ type }) => {
  const map = {
    OTC:      { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.25)", color: "#6ee7b7", label: "OTC — Over the counter" },
    H:        { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.25)", color: "#fbbf24", label: "H — Prescription required" },
    H1:       { bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.25)",  color: "#fca5a5", label: "H1 — Strict prescription" },
    NARCOTIC: { bg: "rgba(139,92,246,0.12)", border: "rgba(139,92,246,0.25)", color: "#c4b5fd", label: "Narcotic — Controlled substance" },
  };
  const s = map[type] || map.OTC;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "4px 12px",
      background: s.bg, border: `1px solid ${s.border}`, borderRadius: 100,
      fontFamily: "var(--mf-font-m)", fontSize: 11, fontWeight: 600,
      letterSpacing: "0.08em", color: s.color,
    }}>{s.label}</span>
  );
};

export default function ProductView({ uKey, onClose }) {
  const [product, setProduct] = useState(null);
  const [activeTab, setActiveTab] = useState("details");

  useEffect(() => {
    if (!uKey) return;
    fetch(`http://localhost:8080/api/Product/GetProductByUkey/${uKey}`, {
      method: "GET", credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then(r => r.json())
      .then(data => { if (data.status === 200) setProduct(data.data); })
      .catch(err => console.error("API Error:", err));
  }, [uKey]);

  if (!uKey)    return null;
  if (!product) return (
    <div className="modal-backdrop show">
      <div className="modal" style={{ minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--mf-text-2)", fontFamily: "var(--mf-font-m)", fontSize: 12 }}>Loading…</p>
      </div>
    </div>
  );

  const TABS = [
    { id: "details", label: "Details"        },
    { id: "pharma",  label: "Pharma"         },
    { id: "pricing", label: "Pricing & Units" },
  ];

  return (
    <div className="modal-backdrop show">
      <div className="modal">

        {/* ── HEADER ── */}
        <div className="modal-header">
          <div className="modal-title">
            <h3>View Product | {product.productCode}</h3>
            <div className="small-muted">Read-only product record</div>
          </div>
          <div className="modal-controls">
            <div className="tab-row">
              {TABS.map(t => (
                <div key={t.id} className={`tab ${activeTab === t.id ? "active" : ""}`}
                  onClick={() => setActiveTab(t.id)}>{t.label}</div>
              ))}
            </div>
            <button className="btn-ghost" onClick={onClose} title="Close">✖</button>
          </div>
        </div>

        {/* ── BODY ── */}
        <div className="modal-body">
          <div className="form-col scrollable">

            {/* ════ DETAILS TAB ════ */}
            {activeTab === "details" && (
              <div className="form-grid">
                <ViewField label="Product Code" value={product.productCode} mono />
                <ViewField label="Product Type" value={product.productType} />
                <ViewField label="Product Name" value={product.name} />

                {product.description && (
                  <div className="full">
                    <label>Description</label>
                    <textarea value={product.description || ""} rows={4} readOnly />
                  </div>
                )}

                <div className="full">
                  <label>Status</label>
                  <div style={{ marginTop: 4 }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", padding: "4px 12px",
                      background: product.disable ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)",
                      border: `1px solid ${product.disable ? "rgba(239,68,68,0.25)" : "rgba(16,185,129,0.25)"}`,
                      borderRadius: 100, fontFamily: "var(--mf-font-m)", fontSize: 11, fontWeight: 600,
                      color: product.disable ? "#fca5a5" : "#6ee7b7",
                    }}>
                      {product.disable ? "Inactive" : "Active"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ════ PHARMA TAB ════ */}
            {activeTab === "pharma" && (
              <div className="form-grid">

                <ViewField label="Manufacturer"       value={product.manufacturerName || product.manufacturer} />
                <ViewField label="Generic / Salt Name" value={product.genericName} />
                <ViewField label="HSN Code"            value={product.hsnCode} mono />

                <div>
                  <label>Schedule Type</label>
                  <div style={{ marginTop: 6 }}>
                    <ScheduleBadge type={product.scheduleType || "OTC"} />
                  </div>
                </div>

                {/* Empty state if no pharma data entered yet */}
                {!product.genericName && !product.hsnCode && !product.manufacturerName && (
                  <div className="full pf-info-banner" style={{ color: "var(--mf-text-3)", fontStyle: "italic" }}>
                    No pharma details entered yet. Edit the product to add manufacturer, HSN code and schedule type.
                  </div>
                )}
              </div>
            )}

            {/* ════ PRICING & UNITS TAB ════ */}
            {activeTab === "pricing" && (
              <div className="form-grid">
                <ViewField label="Cost Price"  value={`₹ ${fmt(product.price)}`} />
                <ViewField label="Unit"         value={product.unit} />

                <ViewField label="Pack Size"
                  value={product.packSize ? `${product.packSize} per ${product.unit || "unit"}` : null}
                />
                <ViewField label="Pack Unit" value={product.packUnit} />

                {/* Pack summary */}
                {product.packSize && product.packUnit && (
                  <div className="full pf-info-banner">
                    Each <strong>{product.unit || "unit"}</strong> contains <strong>{product.packSize}</strong> × <strong>{product.packUnit}</strong>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        {/* ── FOOTER ── */}
        <div className="modal-footer-fixed">
          <div className="modal-actions">
            <button className="btn-ghost" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
