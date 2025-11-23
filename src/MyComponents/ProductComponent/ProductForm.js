import React, { useState, useEffect, useRef } from "react";
import "../../Styles/ProductForm.css";

export default function ProductForm({ onSubmit, onClose }) {
  const [productTypes, setProductTypes] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    unit: "",
    product_type_id: "",
  });
  const [errors, setErrors] = useState({});
  const [activeTab, setActiveTab] = useState("details"); // tabs: details, pricingUnit
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const page = 0;
  const size = 100;
  const apiUrl = `http://localhost:8080/api/ProductType/GetAllProductType?page=${page}&size=${size}`;

  // Fetch product types
  useEffect(() => {
    fetch(apiUrl, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((response) => {
        if (response.status === 200 && response.data) {
          const dataObj = response.data;
          const list =
            Array.isArray(dataObj)
              ? dataObj
              : typeof dataObj === "object"
                ? Object.values(dataObj).find((v) => Array.isArray(v)) || []
                : [];
          setProductTypes(list);
        } else {
          console.error("API returned error status:", response.status);
        }
      })
      .catch((error) => console.error("Error fetching product types:", error));
  }, [apiUrl]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name || !formData.name.trim())
      newErrors.name = "Product name is mandatory";
    if (!formData.product_type_id || !formData.product_type_id.trim())
      newErrors.product_type_id = "Product type mandatory";
    if (!formData.price) newErrors.price = "Price is mandatory";
    if (!formData.unit) newErrors.unit = "Unit is mandatory";
    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    onSubmit("product", formData);
  };

  return (
    <div className="modal-backdrop show">
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">
            <h3>Add Product</h3>
            <div className="small-muted">Fill product details across tabs</div>
          </div>
          <div className="modal-controls">
            <div className="tab-row">
              {["details", "pricingUnit"].map((tab) => (
                <div
                  key={tab}
                  className={`tab ${activeTab === tab ? "active" : ""}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === "details" ? "Details" : "Pricing & Units"}
                </div>
              ))}
            </div>
            <button className="btn-ghost" onClick={onClose} title="Close">
              ✖
            </button>
          </div>
        </div>

        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="form-col scrollable">
            {activeTab === "details" && (
              <div className="form-grid">
                <div>
                  <label>Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                  />
                  {errors.name && <div className="error-msg">{errors.name}</div>}
                </div>

                <div>
                  <label>Description</label>
                  <input
                    type="text"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                  />
                </div>

                <div className="custom-select" ref={dropdownRef}>
                  <label>Product Type</label>
                  <div
                    className={`select-box ${dropdownOpen ? "active" : ""}`}
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                  >
                    <div className="selected">
                      {productTypes.find(pt => pt.id === formData.product_type_id)?.name || "Select Product Type"}
                    </div>
                    <ul className="options">
                      {productTypes.map((pt) => (
                        <li
                          key={pt.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setFormData({ ...formData, product_type_id: pt.id });
                            setDropdownOpen(false);
                          }}
                        >
                          {pt.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {errors.product_type_id && (
                    <div className="error-msg">{errors.product_type_id}</div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "pricingUnit" && (
              <div className="form-grid">
                <div>
                  <label>Price</label>
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleChange}
                  />
                  {errors.price && <div className="error-msg">{errors.price}</div>}
                </div>

                <div>
                  <label>Unit</label>
                  <input
                    type="text"
                    name="unit"
                    value={formData.unit}
                    onChange={handleChange}
                  />
                  {errors.unit && <div className="error-msg">{errors.unit}</div>}
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer-fixed">
            <div className="small-muted">All fields saved locally (demo).</div>
            <div className="modal-actions">
              <button className="btn-ghost" type="button" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="submit-button">
                Save Product
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
