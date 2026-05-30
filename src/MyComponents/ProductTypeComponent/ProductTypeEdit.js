import React, { useEffect, useState } from "react";
import "../../Styles/Product/ProductForm.css";
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
    <div className="modal-backdrop show">
      <div className="modal">
        {loading ? (
          <div className="modal-body mf-modal-loading">
            <div className="mf-loader-ring"><div/><div/><div/><div/></div>
          </div>
        ) : (
        <>

        
        <div className="modal-header">
          <div className="modal-title">
            <h3>Edit Product Type {formData.typeCode && `· ${formData.typeCode}`}</h3>
            <div className="small-muted">Modify product type details</div>
          </div>
          <button className="btn-ghost" onClick={onClose} title="Close">✕ ESC</button>
        </div>

        
        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="form-col">
            <div className="form-grid">

              <div>
                <label>Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Product type name"
                />
                {errors.name && <div className="error-msg">{errors.name}</div>}
              </div>

              <div>
                <label>Description</label>
                <textarea
                  name="description"
                  rows={4}
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Enter description"
                />
                {errors.description && <div className="error-msg">{errors.description}</div>}
              </div>

            </div>
          </div>

          
          <div className="modal-footer-fixed">
            <div className="modal-actions">
              <button className="btn-ghost" type="button" onClick={onClose}>Cancel</button>
              {isChanged() && (
                <button type="submit" className="submit-button">Update Product Type</button>
              )}
            </div>
          </div>
        </form>
        </>
        )}

      </div>
    </div>
  );
}
