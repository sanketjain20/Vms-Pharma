import React, { useEffect, useState, useRef } from "react";
import "../../Styles/Sales/SalesAddNew.css";
import { toast } from "react-toastify";

/* ✅ ADDED IMPORT FOR SALES VIEW IF NEEDED */
import SalesView from "./SalesView"; // uncomment if SalesView is in another file

export default function SalesAddNew({ onClose, onSubmit }) {
  const [productTypes, setProductTypes] = useState([]);
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState(null);

  const [selectedType, setSelectedType] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [manualPrice, setManualPrice] = useState("");

  const [commonTax, setCommonTax] = useState(0);
  const [taxType, setTaxType] = useState("PERCENT");

  const [items, setItems] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [billingMode, setBillingMode] = useState("CASH");
  const [amountPaid, setAmountPaid] = useState(0);

  /* ✅ ADDED */
  const [errors, setErrors] = useState({});

  /* ✅ ADDED STATE FOR SALES VIEW */
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewUkey, setViewUkey] = useState(null);

  /* ✅ ADDED FOR SEARCH + SAFE FALLBACK */
  const [allProducts, setAllProducts] = useState([]);
  const [productSearch, setProductSearch] = useState("");

  /* ✅ PRODUCT TYPE DROPDOWN STATES */
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [typeSearch, setTypeSearch] = useState("");
  const typeDropdownRef = useRef(null);

  /* ✅ BILLING MODE DROPDOWN STATES */
  const [billingDropdownOpen, setBillingDropdownOpen] = useState(false);
  const [billingSearch, setBillingSearch] = useState("");
  const billingDropdownRef = useRef(null);


  /* ================= FETCH ================= */

  useEffect(() => {
    fetch("http://localhost:8080/api/ProductType/GetAllProductType", {
      credentials: "include",
    })
      .then(res => res.json())
      .then(json => setProductTypes(json?.data?.productTypes || []));

    /* ✅ FETCH ALL PRODUCTS AT START */
    fetch("http://localhost:8080/api/Product/GetAllProduct", {
      credentials: "include",
    })
      .then(res => res.json())
      .then(json => {
        setProducts(json?.data?.products || []);
        setAllProducts(json?.data?.products || []);
      });
  }, []);

  const loadProducts = (typeId) => {
    setSelectedType(typeId);
    setSelectedProduct(prev => prev);
    setInventory(null);
    setErrors({});

    /* ✅ ADDED: PREVENT EMPTY TYPE API CRASH */
    if (!typeId) {
      setProducts(allProducts);
      return;
    }

    fetch(`http://localhost:8080/api/Product/GetProdByProdId/${typeId}`, {
      credentials: "include",
    })
      .then(res => res.json())
      .then(json => setProducts(json?.data || []));
  };

  const loadInventory = async (prodId) => {
    setSelectedProduct(prodId);
    setErrors({});

    const selectedProd = products.find(p => p.id === +prodId);
    if (selectedProd && !selectedType) {
      /* ✅ FETCH PRODUCT TYPE IF TYPE NOT SELECTED */
      try {
        const res = await fetch(
          `http://localhost:8080/api/ProductType/GetProdTypeById/${selectedProd.productTypeId}`,
          { credentials: "include" }
        );
        const json = await res.json();
        if (json?.data) {
          setSelectedType(json.data.id);
        }
      } catch (err) {
        console.error("Failed to fetch product type:", err);
      }
    }

    fetch(`http://localhost:8080/api/Inventory/GetInventoryByProdId/${prodId}`, {
      credentials: "include",
    })
      .then(res => res.json())
      .then(json => setInventory(json?.status === 200 ? json.data : null));
  };

  // ✅ FIX: ALWAYS UPDATE PRODUCT TYPE WHEN PRODUCT CHANGES
  useEffect(() => {
    if (!selectedProduct) return;

    const prod = allProducts.find(p => p.id === +selectedProduct);
    if (!prod) return;

    if (prod.productTypeId !== +selectedType) {
      setSelectedType(prod.productTypeId);
      loadProducts(prod.productTypeId);
    }
  }, [selectedProduct]);

  /* ================= ADD ITEM ================= */
  // ✅ CLEAR LEFT PANEL INPUTS ONLY
  const clearInputs = () => {
    setSelectedType("");
    setSelectedProduct("");
    setProducts(allProducts);
    setInventory(null);
    setQuantity(1);
    setManualPrice("");
    setErrors({});
  };


  const addItem = () => {
    let tempErrors = {};

    if (!selectedProduct)
      tempErrors.product = "Select product";

    if (!quantity || quantity <= 0)
      tempErrors.quantity = "Quantity must be at least 1";

    const price = inventory
      ? inventory.unitSellingPrice
      : parseFloat(manualPrice);

    if (!price || price <= 0)
      tempErrors.price = "Enter valid selling price";

    /* ✅ DUPLICATE PRODUCT VALIDATION (ADDED) */
    const alreadyAdded = items.find(
      i => i.productId === +selectedProduct
    );
    if (alreadyAdded)
      tempErrors.product = "Product already added";

    setErrors(tempErrors);
    if (Object.keys(tempErrors).length > 0) return;

    const product = products.find(p => p.id === +selectedProduct);

    setItems(prev => [
      ...prev,
      {
        productId: +selectedProduct,
        productName: product?.name,
        quantity,
        price,
      },
    ]);

    /* ✅ RESET ALL DROPDOWNS & INPUTS (ADDED) */
    setSelectedType("");
    setSelectedProduct("");
    setProducts(allProducts);
    setInventory(null);
    setQuantity(1);
    setManualPrice("");
    setErrors({});
  };

  /* ================= ITEM CONTROLS ================= */

  const increaseQty = (index) => {
    const updated = [...items];
    updated[index].quantity += 1;
    setItems(updated);
  };

  const decreaseQty = (index) => {
    const updated = [...items];
    if (updated[index].quantity > 1) {
      updated[index].quantity -= 1;
      setItems(updated);
    }
  };

  const deleteItem = (index) => {
    const updated = [...items];
    updated.splice(index, 1);
    setItems(updated);
  };

  const billingModes = [
    { id: "CASH", name: "Cash" },
    { id: "ONLINE", name: "Online" },
    { id: "CARD", name: "Card" },
  ];

  const filteredProductTypes = productTypes.filter(pt =>
    pt.name.toLowerCase().includes(typeSearch.toLowerCase())
  );

  const filteredBillingModes = billingModes.filter(m =>
    m.name.toLowerCase().includes(billingSearch.toLowerCase())
  );

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }

      if (billingDropdownRef.current && !billingDropdownRef.current.contains(e.target)) {
        setBillingDropdownOpen(false);
      }

      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target)) {
        setTypeDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target)
      ) {
        setDropdownOpen(false);
      }

      if (
        billingDropdownRef.current &&
        !billingDropdownRef.current.contains(e.target)
      ) {
        setBillingDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  /* ================= CALC ================= */

  const subTotal = items.reduce(
    (sum, i) => sum + i.price * i.quantity,
    0
  );

  const taxValue = Number(commonTax) || 0;

  const taxAmount =
    taxType === "PERCENT"
      ? (subTotal * taxValue) / 100
      : taxValue;

  const total = subTotal + taxAmount - discount;

  // ✅ RESET AFTER SUCCESSFUL SUBMIT
  const resetAll = () => {
    setItems([]);
    setSelectedType("");
    setSelectedProduct("");
    setProducts(allProducts);
    setInventory(null);
    setQuantity(1);
    setManualPrice("");
    setCommonTax(0);
    setTaxType("PERCENT");
    setDiscount(0);
    setBillingMode("CASH");
    setAmountPaid(0);
    setErrors({});
  };

  /* ================= SUBMIT ================= */

  const submitSales = async () => {
    let tempErrors = {};

    if (items.length === 0)
      tempErrors.items = "Add at least one item";

    if (amountPaid < 0)
      tempErrors.amountPaid = "Invalid amount paid";

    if (amountPaid > total)
      tempErrors.amountPaid = "Amount paid cannot exceed total";

    setErrors(tempErrors);
    if (Object.keys(tempErrors).length > 0) return;

    const payload = {
      billingMode,
      totalDiscount: discount,
      amountPaid,
      remainingAmount: total - amountPaid,
      items: items.map(i => ({
        productId: i.productId,
        quantity: i.quantity,
        sellingPrice: i.price,
        taxAmount: items.length ? taxAmount / items.length : 0,
      })),
    };

    try {
      const res = await fetch("http://localhost:8080/api/Sales/AddSales", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to add sale");

      const data = await res.json();

      toast.success("Sale added successfully");

      setViewUkey(data.data?.uKey || null);
      setIsViewOpen(true);
      resetAll();


    } catch (error) {
      console.error("Error submitting sale:", error);
      toast.error("Failed to add sale");
    }
  };

  /* ================= UI ================= */

  const searchedProducts = allProducts.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  /* ✅ ADDED: CUSTOM DROPDOWN STATES */
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);

  /* ✅ ADDED: FILTERED PRODUCTS */
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  /* ✅ ADDED: CLICK OUTSIDE */
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="main-sales-new">
      <h1>New Sales</h1>
      <div className="sales-new-modal">
        <div className="sales-new-box">

          {/* LEFT */}
          <div className="left-panel">
            <h3>Add Item</h3>

            <label>Product Type</label>
            <div className="custom-select" ref={typeDropdownRef}>
              <label>Product Type</label>

              <div
                className={`select-box ${typeDropdownOpen ? "active" : ""}`}
                onClick={() => setTypeDropdownOpen(!typeDropdownOpen)}
              >
                <input
                  type="text"
                  value={
                    typeDropdownOpen
                      ? typeSearch
                      : productTypes.find(t => t.id === +selectedType)?.name || "Select product type"
                  }
                  onChange={(e) => setTypeSearch(e.target.value)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setTypeDropdownOpen(true);
                  }}
                  readOnly={!typeDropdownOpen}
                  className="select-input"
                />

                {typeDropdownOpen && (
                  <ul className="options">
                    {filteredProductTypes.map(pt => (
                      <li
                        key={pt.id}
                        onClick={() => {
                          loadProducts(pt.id);
                          setTypeDropdownOpen(false);
                          setTypeSearch("");
                        }}
                      >
                        {pt.name}
                      </li>
                    ))}

                    {filteredProductTypes.length === 0 && (
                      <li className="no-result">No result found</li>
                    )}
                  </ul>
                )}
              </div>
            </div>


            {/* ✅ ADDED: CUSTOM DROPDOWN */}
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
                      : products.find(p => p.id === +selectedProduct)?.name || "Choose a product"
                  }
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDropdownOpen(true);
                  }}
                  readOnly={!dropdownOpen}
                  className="select-input"
                />

                {dropdownOpen && (
                  <ul className="options">
                    {filteredProducts.map(p => (
                      <li
                        key={p.id}
                        onClick={() => {
                          loadInventory(p.id);
                          setDropdownOpen(false);
                          setSearchTerm("");
                        }}
                      >
                        {p.name}
                      </li>
                    ))}

                    {filteredProducts.length === 0 && (
                      <li className="no-result">No result found</li>
                    )}
                  </ul>
                )}
              </div>
            </div>

            {errors.product && <div className="error">{errors.product}</div>}

            {inventory ? (
              <div className="info-box">
                ₹{inventory.unitSellingPrice} | Stock: {inventory.currentQuantity}
              </div>
            ) : (
              <>
                <input className="inp-mrgn"
                  placeholder="Selling Price"
                  type="number"
                  value={manualPrice}
                  onChange={(e) => setManualPrice(e.target.value)}
                />
                {errors.price && <div className="error">{errors.price}</div>}
              </>
            )}

            <label>Quantity</label>
            <input
              type="number"
              value={quantity}
              min="1"
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Quantity"
            />

            <label>Common Tax</label>
            <div className="row">
              <input
                type="number"
                value={commonTax}
                onChange={(e) => setCommonTax(e.target.value)}
                placeholder="Tax"
              />
              <select
                value={taxType}
                onChange={(e) => setTaxType(e.target.value)}
              >
                <option value="PERCENT">%</option>
                <option value="FLAT">₹</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button className="sanbtn" onClick={addItem}>Add Item</button>
              <button className="sanbtn" onClick={clearInputs} type="button">
                Clear
              </button>
            </div>

          </div>

          {/* RIGHT */}
          <div className="right-panel">
            <h3>Items</h3>
            <div className="items-list">
              {items.map((i, idx) => (
                <div key={idx} className="item-row">
                  <div className="item-left">
                    <b className="item-name">{i.productName}</b>
                    <div className="qty-controls">
                      <button onClick={() => decreaseQty(idx)}>−</button>
                      <span>{i.quantity}</span>
                      <button onClick={() => increaseQty(idx)}>+</button>
                    </div>
                  </div>
                  <div className="item-right">
                    ₹{(i.price * i.quantity).toFixed(2)}
                    <button className="delete-btn" onClick={() => deleteItem(idx)}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="sub-head">Sub Total: ₹{subTotal.toFixed(2)}</div>
            <div className="sub-head">Tax: ₹{taxAmount.toFixed(2)}</div>
            <input placeholder="Discount" type="number" onChange={(e) => setDiscount(+e.target.value)} />
            <b>Total: ₹{total.toFixed(2)}</b>
            <div className="custom-select" ref={billingDropdownRef}>
              <label>Billing Mode</label>

              <div
                className={`select-box ${billingDropdownOpen ? "active" : ""}`}
                onClick={() => setBillingDropdownOpen(!billingDropdownOpen)}
              >
                <input
                  type="text"
                  value={
                    billingDropdownOpen
                      ? billingSearch
                      : billingModes.find(b => b.id === billingMode)?.name || "Select billing mode"
                  }
                  onChange={(e) => setBillingSearch(e.target.value)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setBillingDropdownOpen(true);
                  }}
                  readOnly={!billingDropdownOpen}
                  className="select-input"
                />

                {billingDropdownOpen && (
                  <ul className="options">
                    {filteredBillingModes.map(mode => (
                      <li
                        key={mode.id}
                        onClick={() => {
                          setBillingMode(mode.id);
                          setBillingDropdownOpen(false);
                          setBillingSearch("");
                        }}
                      >
                        {mode.name}
                      </li>
                    ))}

                    {filteredBillingModes.length === 0 && (
                      <li className="no-result">No result found</li>
                    )}
                  </ul>
                )}
              </div>
            </div>

            <input className="inp-mrgn" placeholder="Amount Paid" type="number"
              onChange={(e) => setAmountPaid(+e.target.value)} />
            <button className="submit sanbtn" onClick={submitSales}>
              Submit & View Invoice
            </button>
          </div>
        </div>

        {isViewOpen && (
          <SalesView
            uKey={viewUkey}
            onClose={() => {
              setIsViewOpen(false);
              setViewUkey(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
