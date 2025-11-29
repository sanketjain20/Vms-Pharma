import React, { useState } from "react";
import "../../Styles/ProductForm.css"; 
import { toast } from "react-toastify";

export default function ProductTypeAdd({ onSubmit, onClose }) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name || !formData.name.trim())
      newErrors.name = "Product type name is mandatory";

    if (!formData.description || !formData.description.trim())
      newErrors.description = "Description is mandatory";

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const payload = {
      name: formData.name,
      description: formData.description,
    };

    try {
      const response = await fetch(
        "http://localhost:8080/api/ProductType/AddProdType",
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();

      if (response.ok && result.status === 200) {
        toast.success("Product Type added successfully");
        onSubmit();
        onClose();
      } else {
        toast.error(result.message || "Product Type creation failed");
      }
    } catch (error) {
      console.error("API ERROR:", error);
      toast.error("Something went wrong while saving product type");
    }
  };

  return (
    <div className="modal-backdrop show">
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">
            <h3>Add Product Type</h3>
            <div className="small-muted">Fill product type details</div>
          </div>

          <button className="btn-ghost" onClick={onClose} title="Close">
            ✖
          </button>
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
                  value={formData.description}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Enter description"
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

              <button type="submit" className="submit-button">
                Save Product Type
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
