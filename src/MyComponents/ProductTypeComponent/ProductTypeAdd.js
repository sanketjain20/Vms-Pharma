import React, { useState } from "react";
import "../../Styles/CommonAEUDForm/FormShell.css";
import { toast } from "react-toastify";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

export default function ProductTypeAdd({ onSubmit, onClose }) {
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name?.trim())        newErrors.name        = "Product type name is mandatory";
    if (!formData.description?.trim()) newErrors.description = "Description is mandatory";
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) { setErrors(validationErrors); return; }

    setLoading(true);
    try {
      const response = await apiClient(`${API_BASE_URL}/api/ProductType/AddProdType`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formData.name, description: formData.description }),
      });
      const result = await response.json();
      if (response.ok && result.status === 200) {
        toast.success("Product Type added successfully");
        onSubmit(); onClose();
      } else {
        toast.error(result.message || "Product Type creation failed");
      }
    } catch (error) {
      console.error("API ERROR:", error);
      toast.error("Something went wrong while saving product type");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--sm">
        <div className="afx-header">
          <div>
            <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />New Product Type</div>
            <h3 className="afx-title">Add Product Type</h3>
          </div>
          <button className="afx-close" onClick={onClose} title="Close">
            <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            ESC
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="afx-body">
            <div className="afx-grid">
              <div className="afx-field afx-field--full">
                <label className="afx-label">Name<span className="afx-req">*</span></label>
                <input
                  className={`afx-input ${errors.name ? "afx-input--err" : ""}`}
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter product type name"
                />
                {errors.name && <div className="afx-error">{errors.name}</div>}
              </div>

              <div className="afx-field afx-field--full">
                <label className="afx-label">Description<span className="afx-req">*</span></label>
                <textarea
                  className={`afx-textarea ${errors.description ? "afx-textarea--err" : ""}`}
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Enter description"
                />
                {errors.description && <div className="afx-error">{errors.description}</div>}
              </div>
            </div>
          </div>

          <div className="afx-footer">
            <button className="afx-btn" type="button" onClick={onClose}>Cancel</button>
            <button type="submit" className="afx-btn afx-btn--primary" disabled={loading}>
              {loading ? <><span className="afx-spinner" /> Saving…</> : "Save Product Type"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
