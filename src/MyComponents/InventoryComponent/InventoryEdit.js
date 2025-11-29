import React, { useState, useEffect, useRef } from "react";
import "../../Styles/ProductForm.css"; // Shared CSS with Add
import { toast } from "react-toastify";

export default function InventoryEdit({ uKey, onClose, onSubmit }) {
  const dropdownRef = useRef(null);

  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const [activeTab, setActiveTab] = useState("details");
  const [formData, setFormData] = useState({
    product_id: "",
    currentQuantity: "",
    reorderLevel: "",
    unitSellingPrice: "",
  });

  const [inventoryId, setInventoryId] = useState(null); // Inventory ID for update
  const [originalData, setOriginalData] = useState(null);
  const [errors, setErrors] = useState({});

  const apiGetAllProducts = "http://localhost:8080/api/Product/GetAllProduct";
  const apiGetInventory = `http://localhost:8080/api/Inventory/GetInventoryByUkey/${uKey}`;
  const apiUpdateInventoryBase = "http://localhost:8080/api/Inventory/UpdateInventory";

  // ====================
  // Fetch all products
  // ====================
  useEffect(() => {
    fetch(apiGetAllProducts, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.json())
      .then((res) => {
        if (res.status === 200 && res.data && Array.isArray(res.data.products)) {
          setProducts(res.data.products);
        } else {
          toast.error("Failed to load products");
        }
      })
      .catch((err) => {
        console.error("Fetch products error:", err);
        toast.error("Failed to load products");
      });
  }, []);

  // ====================
  // Fetch inventory details
  // ====================
  useEffect(() => {
    if (products.length === 0) return;

    fetch(apiGetInventory, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.json())
      .then((res) => {
        if (!res.data) {
          toast.error("Inventory not found");
          return;
        }

        const inv = res.data;
        setInventoryId(inv.id); // store inventory ID

        const initialData = {
          product_id: inv.productId, // <-- mapped correctly
          currentQuantity: inv.currentQuantity || "",
          reorderLevel: inv.reorderLevel,
          unitSellingPrice: inv.unitSellingPrice,
          inventoryCode: inv.inventoryCode
        };

        setFormData(initialData);
        setOriginalData(initialData);

        // Bind product name from inventory
        const matchedProduct = products.find((p) => p.id === inv.productId);
        if (matchedProduct) setSearchTerm(matchedProduct.name);
        else setSearchTerm("");
      })
      .catch(() => toast.error("Error loading inventory"));
  }, [products]);

  // ====================
  // Close dropdown on outside click
  // ====================
  useEffect(() => {
    const clickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, []);

  // ====================
  // Handle input change
  // ====================
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value === "" ? "" : Number(value), // keep empty string for validation, convert to number otherwise
    }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleProductSelect = (product) => {
    setFormData((prev) => ({ ...prev, product_id: product.id }));
    setSearchTerm(product.name);
    setDropdownOpen(false);
  };

  // ====================
  // Validation
  // ====================
  const validate = () => {
    const tempErrors = {};
    if (!formData.product_id) tempErrors.product_id = "Product is required";
    if (formData.reorderLevel === "" || formData.reorderLevel === null) tempErrors.reorderLevel = "Reorder level is required";
    if (formData.unitSellingPrice === "" || formData.unitSellingPrice === null) tempErrors.unitSellingPrice = "Unit selling price is required";
    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  // ====================
  // Detect changes
  // ====================
  const detectChanges = () => {
    if (!originalData) return false;
    return (
      formData.product_id !== originalData.product_id ||
      formData.reorderLevel !== originalData.reorderLevel ||
      formData.unitSellingPrice !== originalData.unitSellingPrice
    );
  };

  // ====================
  // Submit update
  // ====================
  const handleSubmit = () => {
    if (!validate()) return;

    if (!detectChanges()) {
      toast.info("No changes to update");
      return;
    }

    if (!inventoryId) {
      toast.error("Inventory ID missing");
      return;
    }

    const payload = {
      product_id: Number(formData.product_id),
      currentQuantity: Number(formData.currentQuantity),
      reorderLevel: Number(formData.reorderLevel),
      unitSellingPrice: Number(formData.unitSellingPrice),
    };

    fetch(`${apiUpdateInventoryBase}/${inventoryId}`, { // pass inventory ID in URL
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    })
      .then((res) => res.json())
      .then((res) => {
        if (res.status === 200) {
          toast.success("Inventory updated successfully");
          onSubmit();
          onClose();
        } else {
          toast.error(res.message || "Update failed");
        }
      })
      .catch(() => toast.error("Error updating inventory"));
  };

  // ====================
  // Filtered products for dropdown
  // ====================
  const filteredProducts = dropdownOpen
    ? products.filter((p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : [];

  return (
    <div className="modal-backdrop show">
      <div className="modal">
        {/* HEADER WITH TABS */}
        <div className="modal-header">
          <div className="modal-title">
            <h3>Edit Inventory | {formData.inventoryCode} </h3>
            <div className="small-muted">Update inventory details</div>
          </div>

          <div className="modal-controls">
            <div className="tab-row">
              {["details", "stock"].map((tab) => (
                <div
                  key={tab}
                  className={`tab ${activeTab === tab ? "active" : ""}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === "details" ? "Product" : "Stock & Pricing"}
                </div>
              ))}
            </div>

            <button className="btn-ghost" onClick={onClose}>
              ✖
            </button>
          </div>
        </div>

        {/* FORM BODY */}
        <form className="modal-body">
          <div className="form-col scrollable">
            {/* TAB 1: PRODUCT SELECTION */}
            {activeTab === "details" && (
              <div className="form-grid">
                <div className="custom-select" ref={dropdownRef}>
                  <label>Select Product</label>
                  <div
                    className={`select-box ${dropdownOpen ? "active" : ""}`}
                    onClick={() => {
                      setDropdownOpen(!dropdownOpen);
                      if (!dropdownOpen) setSearchTerm("");
                    }}
                  >
                    <input
                      type="text"
                      value={
                        dropdownOpen ? searchTerm : products.find((p) => p.id === formData.product_id)?.name || ""
                      }
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        if (e.target.value === "") {
                          setFormData((prev) => ({ ...prev, product_id: "" }));
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      readOnly={!dropdownOpen}
                      className="select-input"
                    />
                    {dropdownOpen && (
                      <ul className="options">
                        {filteredProducts.length > 0 ? (
                          filteredProducts.map((p) => (
                            <li key={p.id} onClick={() => handleProductSelect(p)}>
                              {p.name}
                            </li>
                          ))
                        ) : (
                          <li className="no-results">No result found</li>
                        )}
                      </ul>
                    )}
                  </div>
                  {errors.product_id && <div className="error-msg">{errors.product_id}</div>}
                </div>
              </div>
            )}

            {/* TAB 2: STOCK DETAILS */}
            {activeTab === "stock" && (
              <div className="form-grid">
                <div className="form-field">
                  <label>Current Quantity</label>
                  <input
                    type="number"
                    name="currentQuantity"
                    value={formData.currentQuantity}
                    readOnly
                    style={{ backgroundColor: "#f0f0f0", cursor: "not-allowed" }}
                  />
                </div>

                <div className="form-field">
                  <label>Reorder Level</label>
                  <input
                    type="number"
                    name="reorderLevel"
                    value={formData.reorderLevel}
                    onChange={handleChange}
                  />
                  {errors.reorderLevel && <div className="error-msg">{errors.reorderLevel}</div>}
                </div>

                <div className="form-field">
                  <label>Unit Selling Price</label>
                  <input
                    type="number"
                    name="unitSellingPrice"
                    value={formData.unitSellingPrice}
                    onChange={handleChange}
                  />
                  {errors.unitSellingPrice && <div className="error-msg">{errors.unitSellingPrice}</div>}
                </div>
              </div>
            )}
          </div>

          {/* FOOTER */}
          <div className="modal-footer-fixed">
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={onClose}>
                Cancel
              </button>

              {/* Show Update button only if changes detected */}
              {detectChanges() && (
                <button type="button" className="submit-button" onClick={handleSubmit}>
                  Update Inventory
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
