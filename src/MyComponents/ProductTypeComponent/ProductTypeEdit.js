import React, { useEffect, useState } from "react";
import "../../Styles/ProductForm.css";
import { toast } from "react-toastify";

export default function ProductTypeEdit({ uKey, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    description: "",
    typeCode: "",
  });

  const [originalData, setOriginalData] = useState(null);
  const [errors, setErrors] = useState({});

  const apiGet = `http://localhost:8080/api/ProductType/GetProdTypeByUkey/${uKey}`;
  const apiUpdate = `http://localhost:8080/api/ProductType/UpdateProdType`;

  // ================================
  // LOAD PRODUCT TYPE
  // ================================
  useEffect(() => {
    fetch(apiGet, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.json())
      .then((response) => {
        if (response.status === 200) {
          const data = response.data;
          setFormData({
            id: data.id,
            name: data.name,
            description: data.description,
            typeCode: data.typeCode,
          });

          setOriginalData({
            name: data.name,
            description: data.description,
          });
        } else {
          toast.error("Failed to load product type");
        }
      })
      .catch((err) => console.error("Fetch error:", err));
  }, [apiGet]);

  // ================================
  // HANDLE CHANGE
  // ================================
  const handleChange = (e) => {
    setFormData((p) => ({
      ...p,
      [e.target.name]: e.target.value,
    }));
    setErrors((p) => ({ ...p, [e.target.name]: "" }));
  };

  // ================================
  // VALIDATION
  // ================================
  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.description.trim())
      newErrors.description = "Description is required";
    return newErrors;
  };

  // ================================
  // CHECK IF CHANGED
  // ================================
  const isChanged = () => {
    if (!originalData) return false;
    return (
      originalData.name !== formData.name ||
      originalData.description !== formData.description
    );
  };

  // ================================
  // SUBMIT UPDATE
  // ================================
  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim(),
    };

    try {
      const response = await fetch(`${apiUpdate}/${formData.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok && result.status === 200) {
        toast.success("Product type updated successfully");
        onSubmit();
        onClose();
      } else {
        toast.error(result.message || "Update failed");
      }
    } catch (error) {
      console.error("API ERROR:", error);
      toast.error("Something went wrong during update");
    }
  };

  return (
    <div className="modal-backdrop show">
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">
            <h3>Edit Product Type | {formData.typeCode}</h3>
            <div className="small-muted">Modify product type details</div>
          </div>
          <button className="btn-ghost" onClick={onClose}>✖</button>
        </div>

        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="form-col scrollable">
            <div className="form-grid">

              <div>
                <label>Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                />
                {errors.name && (
                  <div className="error-msg">{errors.name}</div>
                )}
              </div>

              <div>
                <label>Description</label>
                <textarea
                  name="description"
                  rows={4}
                  value={formData.description}
                  onChange={handleChange}
                ></textarea>
                {errors.description && (
                  <div className="error-msg">{errors.description}</div>
                )}
              </div>

            </div>
          </div>

          <div className="modal-footer-fixed">
            <div className="modal-actions">
              <button className="btn-ghost" type="button" onClick={onClose}>
                Cancel
              </button>

              {isChanged() && (
                <button type="submit" className="submit-button">
                  Update Product Type
                </button>
              )}
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}
