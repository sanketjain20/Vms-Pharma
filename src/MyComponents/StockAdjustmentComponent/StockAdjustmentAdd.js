import React, { useEffect, useMemo, useRef, useState } from "react";
import "../../Styles/CommonAEUDForm/FormShell.css";
import { toast } from "react-toastify";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
const ADJUSTMENT_TYPES = [
  { value: "BREAKAGE", label: "BREAKAGE" },
  { value: "SAMPLE", label: "SAMPLE" },
  { value: "OPENING_STOCK_CORRECTION", label: "OPENING_STOCK_CORRECTION" },
];

const extractList = (response) => {
  const data = response?.data;
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  return Object.values(data).find((value) => Array.isArray(value)) || [];
};

export default function StockAdjustmentAdd({ onSubmit, onClose }) {
  const [inventories, setInventories] = useState([]);
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const dropdownRef = useRef(null);

  const [formData, setFormData] = useState({
    inventoryId: "",
    adjustmentType: ADJUSTMENT_TYPES[0].value,
    quantity: "",
    note: "",
  });

  useEffect(() => {
    let cancelled = false;

    const loadInventory = async () => {
      const urls = [
        `${API_BASE_URL}/api/Inventory/GetAllInventory/0/100000`,
        `${API_BASE_URL}/api/Inventory/GetAllInventory`,
      ];

      for (const url of urls) {
        try {
          const response = await apiClient(url, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          });
          if (!response.ok) continue;
          const result = await response.json();
          const list = extractList(result);
          if (!cancelled) setInventories(list);
          return;
        } catch (error) {
          // Try the fallback endpoint before surfacing an empty dropdown.
        }
      }

      if (!cancelled) setInventories([]);
    };

    loadInventory();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setInventoryOpen(false);
        setInventorySearch("");
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const selectedInventory = useMemo(
    () => inventories.find((item) => String(item.id ?? item.inventoryId) === String(formData.inventoryId)),
    [inventories, formData.inventoryId]
  );

  const filteredInventories = useMemo(() => {
    const query = inventorySearch.trim().toLowerCase();
    if (!query) return inventories;

    return inventories.filter((item) =>
      [
        item.inventoryCode,
        item.productName,
        item.productCode,
        item.name,
      ].some((value) => String(value || "").toLowerCase().includes(query))
    );
  }, [inventories, inventorySearch]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
  };

  const validate = () => {
    const nextErrors = {};
    const quantity = Number(formData.quantity);

    if (!formData.inventoryId) nextErrors.inventoryId = "Inventory is required";
    if (!formData.adjustmentType) nextErrors.adjustmentType = "Adjustment type is required";
    if (!Number.isInteger(quantity) || quantity <= 0) nextErrors.quantity = "Quantity must be a positive whole number";

    return nextErrors;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    const payload = {
      inventoryId: Number(formData.inventoryId),
      adjustmentType: formData.adjustmentType,
      quantity: Number(formData.quantity),
      note: formData.note.trim(),
    };

    setSaving(true);
    try {
      const response = await apiClient(`${API_BASE_URL}/api/Inventory/StockAdjustment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));

      if (response.ok && (result.status === 200 || result.status === 201 || result.status === undefined)) {
        toast.success(result.message || "Stock adjusted successfully");
        onSubmit?.();
        onClose?.();
      } else {
        toast.error(result.message || "Stock adjustment failed");
      }
    } catch (error) {
      toast.error("Error occurred while adjusting stock");
    } finally {
      setSaving(false);
    }
  };

  const inventoryLabel = selectedInventory
    ? `${selectedInventory.inventoryCode || selectedInventory.productCode || selectedInventory.id || selectedInventory.inventoryId} — ${selectedInventory.productName || selectedInventory.name || "Inventory"}`
    : "Choose inventory";

  return (
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--md">
        <div className="afx-header">
          <div>
            <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />New Adjustment</div>
            <h3 className="afx-title">Add Stock Adjustment</h3>
          </div>
          <button className="afx-close" type="button" onClick={onClose}>
            <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            ESC
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="afx-body">
            <div className="afx-grid">
              <div className="afx-field afx-field--full" ref={dropdownRef}>
                <label className="afx-label">Inventory<span className="afx-req">*</span></label>
                <div className="afx-searchdrop">
                  <div
                    className={`afx-searchdrop-face ${inventoryOpen ? "is-open" : ""} ${selectedInventory ? "is-filled" : ""}`}
                    onClick={() => setInventoryOpen(true)}
                  >
                    <span>{inventoryLabel}</span>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>

                  {inventoryOpen && (
                    <div className="afx-searchdrop-panel">
                      <input
                        className="afx-searchdrop-input"
                        autoFocus
                        value={inventorySearch}
                        placeholder="Search inventory…"
                        onChange={(event) => setInventorySearch(event.target.value)}
                      />
                      <div className="afx-searchdrop-list">
                        {filteredInventories.length === 0 ? (
                          <div className="afx-searchdrop-empty">No inventory found</div>
                        ) : filteredInventories.map((item) => {
                          const id = item.id ?? item.inventoryId;
                          return (
                            <div
                              key={id}
                              className={`afx-searchdrop-item ${String(id) === String(formData.inventoryId) ? "is-selected" : ""}`}
                              onMouseDown={(event) => {
                                event.preventDefault();
                                setFormData((current) => ({ ...current, inventoryId: id }));
                                setErrors((current) => ({ ...current, inventoryId: "" }));
                                setInventoryOpen(false);
                                setInventorySearch("");
                              }}
                            >
                              {item.inventoryCode || item.productCode || id} — {item.productName || item.name || "Inventory"}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                {errors.inventoryId && <div className="afx-error">{errors.inventoryId}</div>}
              </div>

              <div className="afx-field">
                <label className="afx-label">Adjustment Type</label>
                <div className="afx-select-wrap">
                  <select className="afx-select" name="adjustmentType" value={formData.adjustmentType} onChange={handleChange}>
                    {ADJUSTMENT_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                {errors.adjustmentType && <div className="afx-error">{errors.adjustmentType}</div>}
              </div>

              <div className="afx-field">
                <label className="afx-label">Quantity<span className="afx-req">*</span></label>
                <input
                  className={`afx-input ${errors.quantity ? "afx-input--err" : ""}`}
                  type="number"
                  name="quantity"
                  min="1"
                  step="1"
                  value={formData.quantity}
                  onChange={handleChange}
                  placeholder="Enter quantity"
                />
                {errors.quantity && <div className="afx-error">{errors.quantity}</div>}
              </div>

              <div className="afx-field afx-field--full">
                <label className="afx-label">Note</label>
                <textarea
                  className="afx-textarea"
                  name="note"
                  rows="4"
                  value={formData.note}
                  onChange={handleChange}
                  placeholder="Reason for stock adjustment"
                />
              </div>
            </div>
          </div>

          <div className="afx-footer">
            <button className="afx-btn" type="button" onClick={onClose}>Cancel</button>
            <button type="submit" className="afx-btn afx-btn--primary" disabled={saving}>
              {saving ? <><span className="afx-spinner" /> Saving…</> : "Save Adjustment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
