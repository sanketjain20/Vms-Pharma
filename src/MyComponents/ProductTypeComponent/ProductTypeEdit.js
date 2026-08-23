import React, { useEffect, useState } from "react";
import "../../Styles/CommonAEUDForm/FormShell.css";
import { toast } from "react-toastify";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

export default function ProductTypeEdit({ uKey, onClose, onSubmit }) {
  const [formData, setFormData] = useState({ id: "", name: "", description: "", typeCode: "" });
  const [originalData, setOriginalData] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);

  const apiGet    = `${API_BASE_URL}/api/ProductType/GetProdTypeByUkey/${uKey}`;
  const apiUpdate = `${API_BASE_URL}/api/ProductType/UpdateProdType`;

  useEffect(() => {
    setLoading(true);
    apiClient(apiGet, { method: "GET", headers: { "Content-Type": "application/json" } })
      .then(r => r.json())
      .then(res => {
        if (res.status === 200) {
          const d = res.data;
          setFormData({ id: d.id, name: d.name, description: d.description, typeCode: d.typeCode });
          setOriginalData({ name: d.name, description: d.description });
        } else { toast.error("Failed to load product type"); }
      })
      .catch(err => console.error("Fetch error:", err))
      .finally(() => setLoading(false));
  }, [apiGet]);

  const handleChange = (e) => {
    setFormData(p => ({ ...p, [e.target.name]: e.target.value }));
    setErrors(p => ({ ...p, [e.target.name]: "" }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name?.trim())        newErrors.name        = "Name is required";
    if (!formData.description?.trim()) newErrors.description = "Description is required";
    return newErrors;
  };

  const isChanged = () =>
    originalData &&
    (originalData.name !== formData.name || originalData.description !== formData.description);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) { setErrors(validationErrors); return; }

    try {
      const response = await apiClient(`${apiUpdate}/${formData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formData.name.trim(), description: formData.description.trim() }),
      });
      const result = await response.json();
      if (response.ok && result.status === 200) {
        toast.success("Product type updated successfully");
        onSubmit(); onClose();
      } else { toast.error(result.message || "Update failed"); }
    } catch (error) {
      console.error("API ERROR:", error);
      toast.error("Something went wrong during update");
    }
  };

  return (
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--sm">
        {loading ? (
          <div className="afx-loading">
            <div className="afx-loader-ring"><div/><div/><div/></div>
          </div>
        ) : (
          <>
            <div className="afx-header">
              <div>
                <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />Edit Product Type</div>
                <h3 className="afx-title">Edit Product Type{formData.typeCode && ` · ${formData.typeCode}`}</h3>
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
                      placeholder="Product type name"
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
                {isChanged() && (
                  <button type="submit" className="afx-btn afx-btn--primary">Update Product Type</button>
                )}
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
