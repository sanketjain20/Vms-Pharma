import React, { useState, useEffect, useRef } from "react";
import "../../Styles/ProductForm.css";
import { toast } from "react-toastify";

export default function EditProductForm({ uKey, onClose, onSubmit }) {
  const [productTypes, setProductTypes] = useState([]);
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    description: "",
    price: "",
    unit: "",
    product_type_id: "",
    productType: "", // coming from backend
  });

  const [originalData, setOriginalData] = useState(null);
  const [errors, setErrors] = useState({});
  const [activeTab, setActiveTab] = useState("details");

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const apiProductType = `http://localhost:8080/api/ProductType/GetAllProductType`;
  const apiGetProduct = `http://localhost:8080/api/Product/GetProductByUkey/${uKey}`;

  // ================================
  // LOAD PRODUCT TYPES
  // ================================
  useEffect(() => {
    fetch(apiProductType, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.json())
      .then((response) => {
        if (response.status === 200) {
          const dataObj = response.data;
          const list =
            Array.isArray(dataObj)
              ? dataObj
              : typeof dataObj === "object"
                ? Object.values(dataObj).find((v) => Array.isArray(v)) || []
                : [];
          setProductTypes(list);
        }
      })
      .catch((err) => console.error("Product type load error:", err));
  }, [apiProductType]); // added dependency to remove warning

  // ================================
  // LOAD PRODUCT DETAILS
  // ================================
  useEffect(() => {
    fetch(apiGetProduct, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.json())
      .then((response) => {
        if (response.status === 200 && response.data) {
          const product = response.data;

          setFormData((prev) => ({
            ...prev,
            ...product,
            productType: product.productType || "",
          }));

          setOriginalData({
            name: product.name,
            description: product.description,
            price: product.price,
            unit: product.unit,
            product_type_id: product.product_type_id,
          });
        } else {
          toast.error("Error loading product details");
        }
      })
      .catch((err) => console.error("Product load error:", err));
  }, [apiGetProduct]); // added dependency to remove warning

  // ================================
  // MAP productType NAME → product_type_id
  // ================================
  useEffect(() => {
    if (
      productTypes.length > 0 &&
      formData.productType &&
      !formData.product_type_id
    ) {
      const match = productTypes.find(
        (pt) =>
          pt.name.trim().toLowerCase() ===
          formData.productType.trim().toLowerCase()
      );
      if (match) {
        setFormData((prev) => ({
          ...prev,
          product_type_id: match.id,
        }));
      }
    }
  }, [productTypes, formData.productType]);

  // ================================
  // CLOSE DROPDOWN ON OUTSIDE CLICK
  // ================================
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ================================
  // HANDLE INPUT CHANGE
  // ================================
  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    setErrors((prev) => ({ ...prev, [e.target.name]: "" }));
  };

  // ================================
  // VALIDATION
  // ================================
  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.product_type_id)
      newErrors.product_type_id = "Product type is required";
    if (!formData.price) newErrors.price = "Price is required";
    if (!formData.unit) newErrors.unit = "Unit is required";
    return newErrors;
  };

  // ================================
  // CHECK IF DATA HAS CHANGED
  // ================================
  const isChanged = () => {
    if (!originalData) return false;

    const originalNormalized = {
      name: originalData.name ?? "",
      description: originalData.description ?? "",
      price: Number(originalData.price ?? 0),
      unit: originalData.unit ?? "",
      product_type_id: Number(originalData.product_type_id ?? 0),
    };

    const formNormalized = {
      name: formData.name ?? "",
      description: formData.description ?? "",
      price: Number(formData.price ?? 0),
      unit: formData.unit ?? "",
      product_type_id: Number(formData.product_type_id ?? 0),
    };

    return JSON.stringify(originalNormalized) !== JSON.stringify(formNormalized);
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
      name: formData.name,
      description: formData.description,
      price: parseFloat(formData.price),
      unit: formData.unit,
      product_type_id: formData.product_type_id,
    };

    try {
      const response = await fetch(
        `http://localhost:8080/api/Product/UpdateProd/${formData.id}`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();

      if (response.ok && result.status === 200) {
        toast.success("Product updated successfully");
        onSubmit();
        onClose();
      } else {
        toast.error(result.message || "Update failed");
      }
    } catch (error) {
      console.error("API ERROR:", error);
      toast.error("Something went wrong");
    }
  };

  return (
    <div className="modal-backdrop show">
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">
            <h3>Edit Product | {formData.productCode}</h3>
            <div className="small-muted">Modify product details</div>
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

            <button className="btn-ghost" onClick={onClose}>
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
                    value={formData.name || ""}
                    onChange={handleChange}
                  />
                  {errors.name && <div className="error-msg">{errors.name}</div>}
                </div>

                <div className="custom-select" ref={dropdownRef}>
                  <label>Product Type</label>
                  <div
                    className={`select-box ${dropdownOpen ? "active" : ""}`}
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                  >
                    <div className="selected">
                      {productTypes.find(
                        (pt) => pt.id === formData.product_type_id
                      )?.name || "Select Product Type"}
                    </div>

                    {dropdownOpen && (
                      <ul className="options">
                        {productTypes.map((pt) => (
                          <li
                            key={pt.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setFormData((prev) => ({
                                ...prev,
                                product_type_id: pt.id,
                              }));
                              setDropdownOpen(false);
                            }}
                          >
                            {pt.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {errors.product_type_id && (
                    <div className="error-msg">{errors.product_type_id}</div>
                  )}
                </div>

                <div>
                  <label>Description</label>
                  <textarea
                    name="description"
                    rows={4}
                    value={formData.description || ""}
                    onChange={handleChange}
                  ></textarea>
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
                    value={formData.price || ""}
                    onChange={handleChange}
                  />
                  {errors.price && <div className="error-msg">{errors.price}</div>}
                </div>

                <div>
                  <label>Unit</label>
                  <input
                    type="text"
                    name="unit"
                    value={formData.unit || ""}
                    onChange={handleChange}
                  />
                  {errors.unit && <div className="error-msg">{errors.unit}</div>}
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer-fixed">
            <div className="modal-actions">
              <button className="btn-ghost" type="button" onClick={onClose}>
                Cancel
              </button>

              {isChanged() && (
                <button type="submit" className="submit-button">
                  Update Product
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
