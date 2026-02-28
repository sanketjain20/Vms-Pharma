import React, { useState, useEffect, useRef } from "react";
import "../../Styles/Product/ProductForm.css";
import "../../Styles/Inventory/InventoryEdit.css"
import { toast } from "react-toastify";

export default function InventoryEdit({ uKey, onClose, onSubmit }) {
  const dropdownRef = useRef(null);

  /* ================= NEW TYPE DROPDOWN REFS ================= */
  const typeDropdownRef = useRef(null);
  /* ========================================================== */

  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  /* ================= NEW STATES ================= */
  const [productTypes, setProductTypes] = useState([]);
  const [productTypeId, setProductTypeId] = useState("");
  const [typeSearch, setTypeSearch] = useState("");
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [allProducts, setAllProducts] = useState([]);
  const isInitialLoad = useRef(true);

  const [stockMenuOpen, setStockMenuOpen] = useState(false);
  const stockMenuRef = useRef(null);
  const [showStockScreen, setShowStockScreen] = useState(false);
  const [stockQty, setStockQty] = useState("");
  const [stockActionType, setStockActionType] = useState(null);
  const [stockMovementPayload, setStockMovementPayload] = useState(null);


  /* ============================================= */

  const [activeTab, setActiveTab] = useState("details");
  const [formData, setFormData] = useState({
    product_id: "",
    currentQuantity: "",
    reorderLevel: "",
    unitSellingPrice: "",
  });

  const [inventoryId, setInventoryId] = useState(null);
  const [originalData, setOriginalData] = useState(null);
  const [errors, setErrors] = useState({});

  const apiGetAllProducts = "http://localhost:8080/api/Product/GetAllProduct";
  const apiGetInventory = `http://localhost:8080/api/Inventory/GetInventoryByUkey/${uKey}`;
  const apiUpdateInventoryBase =
    "http://localhost:8080/api/Inventory/UpdateInventory";

  /* ================= FETCH ALL PRODUCTS ================= */
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
          setAllProducts(res.data.products); // NEW
        } else {
          toast.error("Failed to load products");
        }
      })
      .catch((err) => {
        console.error("Fetch products error:", err);
        toast.error("Failed to load products");
      });
  }, []);

  /* ================= FETCH PRODUCT TYPES ================= */
  useEffect(() => {
    fetch("http://localhost:8080/api/ProductType/GetAllProductType", {
      credentials: "include",
    })
      .then(res => res.json())
      .then(json => setProductTypes(json?.data?.productTypes || []));
  }, []);
  /* ======================================================= */

  useEffect(() => {
    if (products.length === 0) return;

    if (!isInitialLoad.current) return;

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
        setInventoryId(inv.id);

        const initialData = {
          product_id: inv.productId,
          currentQuantity: inv.currentQuantity || "",
          reorderLevel: inv.reorderLevel,
          unitSellingPrice: inv.unitSellingPrice,
          inventoryCode: inv.inventoryCode,
        };

        setFormData(initialData);
        setOriginalData(initialData);

        const matchedProduct = products.find((p) => p.id === inv.productId);
        if (matchedProduct) setSearchTerm(matchedProduct.name);
        else setSearchTerm("");

        /* ===== NEW: SET PRODUCT TYPE FROM API RESPONSE ===== */
        if (inv.productTypeId) {
          setProductTypeId(inv.productTypeId);
        }
        isInitialLoad.current = false;

        /* =================================================== */
      })
      .catch(() => toast.error("Error loading inventory"));
  }, [products]);

  /* ================= CLICK OUTSIDE ================= */
  useEffect(() => {
    const clickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target)) {
        setTypeDropdownOpen(false);
      }
      if (stockMenuRef.current && !stockMenuRef.current.contains(e.target)) {
        setStockMenuOpen(false);
      }

    };
    document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, []);
  /* ================================================= */

  /* ================= PRODUCT → TYPE API CALL ================= */
  useEffect(() => {
    if (!formData.product_id) return;

    fetch(`http://localhost:8080/api/ProductType/GetProdTypeByProductId/${formData.product_id}`, {
      credentials: "include",
    })
      .then(res => res.json())
      .then(json => {
        if (json?.data?.id) {
          setProductTypeId(json.data.id);
        }
      });
  }, [formData.product_id]);
  /* ========================================================== */

  /* ================= TYPE → PRODUCTS FILTER ================= */
  useEffect(() => {
    if (!productTypeId) {
      setProducts(allProducts);
      return;
    }

    fetch(`http://localhost:8080/api/Product/GetProdByProdId/${productTypeId}`, {
      credentials: "include",
    })
      .then(res => res.json())
      .then(json => setProducts(json?.data || []));
  }, [productTypeId]);
  /* ========================================================== */

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value === "" ? "" : Number(value),
    }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleProductSelect = (product) => {
    setFormData((prev) => ({ ...prev, product_id: product.id }));
    setSearchTerm(product.name);
    setDropdownOpen(false);
  };

  const validate = () => {
    const tempErrors = {};
    if (!formData.product_id) tempErrors.product_id = "Product is required";
    if (formData.reorderLevel === "" || formData.reorderLevel === null)
      tempErrors.reorderLevel = "Reorder level is required";
    if (formData.unitSellingPrice === "" || formData.unitSellingPrice === null)
      tempErrors.unitSellingPrice = "Unit selling price is required";
    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const detectChanges = () => {
    if (!originalData) return false;
    return (
      formData.product_id !== originalData.product_id ||
      formData.reorderLevel !== originalData.reorderLevel ||
      formData.unitSellingPrice !== originalData.unitSellingPrice
    );
  };

  const handleSubmit = () => {
    if (!validate()) return;
    if (!detectChanges() && !stockMovementPayload) {
      return toast.info("No changes to update");
    }
    if (!inventoryId) return toast.error("Inventory ID missing");

    const payload = {
      product_id: Number(formData.product_id),
      currentQuantity: Number(formData.currentQuantity),
      reorderLevel: Number(formData.reorderLevel),
      unitSellingPrice: Number(formData.unitSellingPrice),
      stockMovement: stockMovementPayload || null
    };

    fetch(`${apiUpdateInventoryBase}/${inventoryId}`, {
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
        } else toast.error(res.message || "Update failed");
      })
      .catch(() => toast.error("Error updating inventory"));
  };

  const filteredTypes = productTypes.filter(pt =>
    pt.name.toLowerCase().includes(typeSearch.toLowerCase())
  );

  const handleStockAction = (type) => {
    setStockActionType(type);   // moves to action screen
    setStockQty("");            // reset quantity
  };

  const handleStockUpdate = () => {
    const qty = Number(stockQty);
    const current = Number(formData.currentQuantity);

    if (!qty || qty <= 0) return toast.error("Enter valid quantity");

    let movementType = null;

    if (stockActionType === "add") {
      movementType = "ADD";
    }

    if (stockActionType === "reduce") {
      if (qty > current) return toast.error("Cannot reduce more than current stock");
      movementType = "SALE";
    }

    if (stockActionType === "damaged") {
      if (qty > current) return toast.error("Damaged qty exceeds stock");
      movementType = "DAMAGE";
    }

    if (stockActionType === "adjust") {
      movementType = "ADJUSTMENT";
    }

    const movementPayload = {
      productId: Number(formData.product_id),
      inventoryId: inventoryId,
      movementType: movementType,
      quantity: qty,
      unitSellingPrice: Number(formData.unitSellingPrice),
      referenceId: null,
      note: stockActionType,
    };

    setStockMovementPayload(movementPayload);

    toast.success("Stock movement prepared. Click Update Inventory to save.");
    setStockActionType(null);
    setShowStockScreen(false);
  };



  return (
    <div className="modal-backdrop show">
      <div className="modal">
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

            <button className="btn-ghost" onClick={onClose}>✖</button>
          </div>
        </div>

        <form className="modal-body">
          <div className="form-col scrollable">
            {/* ================= STOCK MANAGEMENT SCREEN ================= */}
            {showStockScreen ? (

              stockActionType ? (

                /* ================= ACTION INPUT SCREEN ================= */
                <div className="stock-screen">
                  <div className="stock-screen-header">
                    <h3>
                      {stockActionType === "add" && "Add Stock"}
                      {stockActionType === "reduce" && "Reduce Stock"}
                      {stockActionType === "damaged" && "Mark Damaged Stock"}
                      {stockActionType === "adjust" && "Adjust Stock Quantity"}
                    </h3>

                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => setStockActionType(null)}
                    >
                      ← Back
                    </button>
                  </div>

                  <div className="form-grid">

                    <div className="form-field">
                      <label>Current Quantity</label>
                      <input
                        type="number"
                        value={formData.currentQuantity}
                        readOnly
                        style={{ background: "#f1f1f1" }}
                      />
                    </div>

                    <div className="form-field">
                      <label>
                        {stockActionType === "adjust"
                          ? "Enter New Quantity"
                          : stockActionType === "damaged"
                            ? "Enter Damaged Quantity"
                            : "Enter Add/Reduce Quantity"}
                      </label>

                      <input
                        type="number"
                        value={stockQty}
                        onChange={(e) => setStockQty(e.target.value)}
                      />
                    </div>

                  </div>

                  <div style={{ marginTop: "20px" }}>
                    <button
                      type="button"
                      className="submit-button"
                      onClick={handleStockUpdate}
                    >
                      Confirm Update
                    </button>
                  </div>
                </div>

              ) : (

                /* ================= STOCK OPTIONS SCREEN ================= */
                <div className="stock-screen">
                  <div className="stock-screen-header">
                    <h3>Manage Stock</h3>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => setShowStockScreen(false)}
                    >
                      ← Back
                    </button>
                  </div>

                  <div className="stock-options-grid">
                    <div className="stock-card" onClick={() => handleStockAction("add")}>➕ Add Stock</div>
                    <div className="stock-card" onClick={() => handleStockAction("reduce")}>➖ Reduce Stock</div>
                    <div className="stock-card" onClick={() => handleStockAction("damaged")}>💥 Mark Damaged</div>
                    <div className="stock-card" onClick={() => handleStockAction("adjust")}>⚖ Adjust Stock</div>
                  </div>
                </div>

              )

            ) : (

              <>
                {activeTab === "details" && (
                  <div className="form-grid">
                    {/* 🔽 PRODUCT TYPE DROPDOWN */}
                    <div className="custom-select" ref={typeDropdownRef}>
                      <label>Product Type</label>
                      <div
                        className={`select-box ${typeDropdownOpen ? "active" : ""}`}
                        onClick={() => setTypeDropdownOpen(!typeDropdownOpen)}
                      >
                        <div className="selected">
                          {productTypes.find(t => t.id === productTypeId)?.name || "Select product type"}
                        </div>

                        {typeDropdownOpen && (
                          <ul className="options">
                            {filteredTypes.map(pt => (
                              <li
                                key={pt.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setProductTypeId(pt.id);
                                  setTypeDropdownOpen(false);
                                }}
                              >
                                {pt.name}
                              </li>
                            ))}
                            {filteredTypes.length === 0 && (
                              <li style={{ color: "#888" }}>No result found</li>
                            )}
                          </ul>
                        )}
                      </div>
                    </div>

                    {/* PRODUCT DROPDOWN */}
                    <div className="custom-select" ref={dropdownRef}>
                      <label>Select Product</label>
                      <div
                        className={`select-box ${dropdownOpen ? "active" : ""}`}
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                      >
                        <div className="selected">
                          {products.find((p) => p.id === formData.product_id)?.name || "Select Product"}
                        </div>

                        {dropdownOpen && (
                          <ul className="options">
                            {products.map((p) => (
                              <li
                                key={p.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleProductSelect(p);
                                }}
                              >
                                {p.name}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {errors.product_id && (
                        <div className="error-msg">{errors.product_id}</div>
                      )}
                    </div>
                  </div>
                )}

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
                      {errors.reorderLevel && (
                        <div className="error-msg">{errors.reorderLevel}</div>
                      )}
                    </div>

                    <div className="form-field">
                      <label>Unit Selling Price</label>
                      <input
                        type="number"
                        name="unitSellingPrice"
                        value={formData.unitSellingPrice}
                        onChange={handleChange}
                      />
                      {errors.unitSellingPrice && (
                        <div className="error-msg">{errors.unitSellingPrice}</div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="modal-footer-fixed">
            <div className="modal-actions">

              {!showStockScreen && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowStockScreen(true)}
                >
                  ⚙ Manage Stock
                </button>
              )}

              <button type="button" className="btn-ghost" onClick={onClose}>
                Cancel
              </button>

              {!showStockScreen && !stockActionType &&
                (detectChanges() || stockMovementPayload) && (
                  <button
                    type="button"
                    className="submit-button"
                    onClick={handleSubmit}
                  >
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
