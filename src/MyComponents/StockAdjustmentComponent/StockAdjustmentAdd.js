import React, { useEffect, useMemo, useRef, useState } from "react";
import "../../Styles/Product/ProductForm.css";
import { toast } from "react-toastify";
import API_BASE_URL from "../../Config/api.config";
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
          const response = await fetch(url, {
            method: "GET",
            credentials: "include",
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
      const response = await fetch(`${API_BASE_URL}/api/Inventory/StockAdjustment`, {
        method: "POST",
        credentials: "include",
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
    ? `${selectedInventory.inventoryCode || selectedInventory.productCode || selectedInventory.id || selectedInventory.inventoryId} - ${selectedInventory.productName || selectedInventory.name || "Inventory"}`
    : "Choose inventory";

  return (
    <div className="modal-backdrop show">
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">
            <h3>Add Stock Adjustment</h3>
            <div className="small-muted">Adjust inventory stock quantity</div>
          </div>

          <div className="modal-controls">
            <button className="btn-ghost" type="button" onClick={onClose} title="Close">
              Close
            </button>
          </div>
        </div>

        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="form-col scrollable">
            <div className="form-grid">
              <div className="custom-select full" ref={dropdownRef}>
                <label>Inventory</label>
                <div
                  className={`select-box ${inventoryOpen ? "active" : ""}`}
                  onClick={() => setInventoryOpen(true)}
                >
                  <input
                    type="text"
                    value={inventoryOpen ? inventorySearch : inventoryLabel}
                    onChange={(event) => setInventorySearch(event.target.value)}
                    onClick={(event) => {
                      event.stopPropagation();
                      setInventoryOpen(true);
                    }}
                    readOnly={!inventoryOpen}
                    className="select-input"
                  />

                  {inventoryOpen && (
                    <ul className="options">
                      {filteredInventories.map((item) => {
                        const id = item.id ?? item.inventoryId;
                        return (
                          <li
                            key={id}
                            onClick={(event) => {
                              event.stopPropagation();
                              setFormData((current) => ({ ...current, inventoryId: id }));
                              setErrors((current) => ({ ...current, inventoryId: "" }));
                              setInventoryOpen(false);
                              setInventorySearch("");
                            }}
                          >
                            {item.inventoryCode || item.productCode || id} - {item.productName || item.name || "Inventory"}
                          </li>
                        );
                      })}
                      {filteredInventories.length === 0 && <li style={{ color: "#888" }}>No inventory found</li>}
                    </ul>
                  )}
                </div>
                {errors.inventoryId && <div className="error-msg">{errors.inventoryId}</div>}
              </div>

              <div>
                <label>Adjustment Type</label>
                <select name="adjustmentType" value={formData.adjustmentType} onChange={handleChange}>
                  {ADJUSTMENT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
                {errors.adjustmentType && <div className="error-msg">{errors.adjustmentType}</div>}
              </div>

              <div>
                <label>Quantity</label>
                <input
                  type="number"
                  name="quantity"
                  min="1"
                  step="1"
                  value={formData.quantity}
                  onChange={handleChange}
                  placeholder="Enter quantity"
                />
                {errors.quantity && <div className="error-msg">{errors.quantity}</div>}
              </div>

              <div className="full">
                <label>Note</label>
                <textarea
                  name="note"
                  rows="4"
                  value={formData.note}
                  onChange={handleChange}
                  placeholder="Reason for stock adjustment"
                />
              </div>
            </div>
          </div>

          <div className="modal-footer-fixed">
            <div className="modal-actions">
              <button className="btn-ghost" type="button" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="submit-button" disabled={saving}>
                {saving ? "Saving..." : "Save Adjustment"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
