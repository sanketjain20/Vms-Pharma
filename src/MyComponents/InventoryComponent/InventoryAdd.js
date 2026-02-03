import React, { useState, useEffect, useRef } from "react";
import "../../Styles/Product/ProductForm.css"; // Reuse same modal CSS
import { toast } from "react-toastify";

export default function InventoryAdd({ onSubmit, onClose }) {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  /* ================= NEW ADDITIONS ================= */
  const [allProducts, setAllProducts] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [typeSearch, setTypeSearch] = useState("");
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const typeDropdownRef = useRef(null);
  const lastLoadedType = useRef(null);
  /* ================================================= */

  const [activeTab, setActiveTab] = useState("details");

  const [formData, setFormData] = useState({
    product_id: "",
    currentQuantity: "",
    reorderLevel: "",
    unitSellingPrice: "",
  });

  /* ================= NEW FIELD ADDED SAFELY ================= */
  const [productTypeId, setProductTypeId] = useState("");
  /* ========================================================== */

  const [errors, setErrors] = useState({});

  const fetchUrl = "http://localhost:8080/api/Product/GetAllProduct";

  /** FETCH ALL PRODUCTS FOR DROPDOWN */
  useEffect(() => {
    fetch(fetchUrl, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.json())
      .then((response) => {
        if (response.status === 200 && response.data) {
          const dataObj = response.data;
          const list =
            Array.isArray(dataObj)
              ? dataObj
              : typeof dataObj === "object"
                ? Object.values(dataObj).find((v) => Array.isArray(v)) || []
                : [];

          setProducts(list);
          setAllProducts(list); // NEW
        }
      })
      .catch((err) => console.error("Error fetching products:", err));
  }, []);

  /* ================= FETCH PRODUCT TYPES ================= */
  useEffect(() => {
    fetch("http://localhost:8080/api/ProductType/GetAllProductType", {
      credentials: "include",
    })
      .then(res => res.json())
      .then(json => setProductTypes(json?.data?.productTypes || []));
  }, []);

  /** CLOSE DROPDOWN WHEN CLICK OUTSIDE */
  useEffect(() => {
    const clickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
        setSearchTerm("");
      }
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target)) {
        setTypeDropdownOpen(false);
        setTypeSearch("");
      }
    };
    document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, []);

  /** HANDLE FIELD CHANGE */
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  };

  /** VALIDATION */
  const validate = () => {
    const e = {};
    if (!formData.product_id)
      e.product_id = "Product selection is mandatory";
    if (!formData.currentQuantity)
      e.currentQuantity = "Current quantity is required";
    if (!formData.reorderLevel)
      e.reorderLevel = "Reorder level is required";
    if (!formData.unitSellingPrice)
      e.unitSellingPrice = "Unit selling price is required";
    return e;
  };

  /** SUBMIT FORM */
  const handleSubmit = async (e) => {
    e.preventDefault();
    const v = validate();
    if (Object.keys(v).length > 0) {
      setErrors(v);
      return;
    }

    const payload = {
      product_id: formData.product_id,
      currentQuantity: parseFloat(formData.currentQuantity),
      reorderLevel: parseFloat(formData.reorderLevel),
      unitSellingPrice: parseFloat(formData.unitSellingPrice),
    };

    try {
      const response = await fetch(
        "http://localhost:8080/api/Inventory/AddInventory",
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();

      if (response.ok && result.status === 200) {
        toast.success("Inventory added successfully!");
        onSubmit();
        onClose();
      } else {
        toast.error(result.message || "Failed to add inventory");
      }
    } catch (err) {
      console.error("Inventory Add Error:", err);
      toast.error("Error occurred while adding inventory");
    }
  };

  /** FILTER PRODUCTS WHILE SEARCHING */
  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  /* ================= NEW FILTERS ================= */
  const filteredTypes = productTypes.filter(pt =>
    pt.name.toLowerCase().includes(typeSearch.toLowerCase())
  );

  /* 🔥 LOAD PRODUCTS WHEN PRODUCT TYPE CHANGES */
  useEffect(() => {
    if (!productTypeId) {
      setProducts(allProducts);
      return;
    }
    if (lastLoadedType.current === productTypeId) return;
    lastLoadedType.current = productTypeId;

    fetch(`http://localhost:8080/api/Product/GetProdByProdId/${productTypeId}`, {
      credentials: "include",
    })
      .then(res => res.json())
      .then(json => setProducts((json?.data || []).filter(p => p.disable === 0)));
  }, [productTypeId, allProducts]);

  /* 🔥 WHEN PRODUCT SELECTED → FETCH ITS PRODUCT TYPE FROM API */
  useEffect(() => {
    if (!formData.product_id) return;

    fetch(`http://localhost:8080/api/ProductType/GetProdTypeByProductId/${formData.product_id}`, {
      credentials: "include",
    })
      .then(res => res.json())
      .then(json => {
        const typeId = json?.data?.productTypeId || json?.data?.id;
        if (typeId) setProductTypeId(typeId);
      })
      .catch(() => { });
  }, [formData.product_id]);

  return (
    <div className="modal-backdrop show">
      <div className="modal">
        {/* HEADER */}
        <div className="modal-header">
          <div className="modal-title">
            <h3>Add Inventory</h3>
            <div className="small-muted">Fill inventory details</div>
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

            <button className="btn-ghost" onClick={onClose} title="Close">
              ✖
            </button>
          </div>
        </div>

        {/* FORM BODY */}
        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="form-col scrollable">
            {activeTab === "details" && (
              <div className="form-grid">

                {/* PRODUCT TYPE DROPDOWN */}
                <div className="custom-select" ref={typeDropdownRef} style={{ width: "100%" }}>
                  <label>Product Type</label>
                  <div
                    className={`select-box ${typeDropdownOpen ? "active" : ""}`}
                    style={{ width: "100%" }}
                    onClick={() => setTypeDropdownOpen(!typeDropdownOpen)}
                  >
                    <input
                      type="text"
                      value={
                        typeDropdownOpen
                          ? typeSearch
                          : productTypes.find(t => t.id === productTypeId)?.name || "Select product type"
                      }
                      onChange={(e) => setTypeSearch(e.target.value)}
                      readOnly={!typeDropdownOpen}
                      className="select-input"
                      style={{ width: "100%", boxSizing: "border-box" }}
                    />
                    {typeDropdownOpen && (
                      <ul className="options">
                        {filteredTypes.map(pt => (
                          <li key={pt.id} onClick={() => { setProductTypeId(pt.id); setTypeDropdownOpen(false); }}>
                            {pt.name}
                          </li>
                        ))}
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
                    <input
                      type="text"
                      value={
                        dropdownOpen
                          ? searchTerm
                          : products.find((p) => p.id === formData.product_id)
                            ?.name || "Choose a product"
                      }
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDropdownOpen(true);
                      }}
                      readOnly={!dropdownOpen}
                      className="select-input"
                      style={{ border: "none", background: "transparent" }}
                    />

                    <ul className="options">
                      {dropdownOpen &&
                        filteredProducts.map((p) => (
                          <li
                            key={p.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setFormData({
                                ...formData,
                                product_id: p.id,
                              });
                              setDropdownOpen(false);
                              setSearchTerm("");
                            }}
                          >
                            {p.name}
                          </li>
                        ))}

                      {dropdownOpen && filteredProducts.length === 0 && (
                        <li style={{ color: "#888" }}>No result found</li>
                      )}
                    </ul>
                  </div>

                  {errors.product_id && (
                    <div className="error-msg">{errors.product_id}</div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "stock" && (
              <div className="form-grid">
                <div>
                  <label>Current Quantity</label>
                  <input
                    type="number"
                    name="currentQuantity"
                    value={formData.currentQuantity}
                    onChange={handleChange}
                  />
                  {errors.currentQuantity && (
                    <div className="error-msg">{errors.currentQuantity}</div>
                  )}
                </div>

                <div>
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

                <div>
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
          </div>

          <div className="modal-footer-fixed">
            <div className="modal-actions">
              <button className="btn-ghost" type="button" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="submit-button">
                Save Inventory
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
