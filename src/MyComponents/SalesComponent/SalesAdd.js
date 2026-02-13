import React, { useState, useEffect, useRef } from "react";
import "../../Styles/Sales/AddSales.css";

export default function SalesAdd({ onClose, onSubmit }) {
  const [productTypes, setProductTypes] = useState([]);
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState(null);

  const [selectedType, setSelectedType] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");

  const [quantity, setQuantity] = useState("");
  const [taxInput, setTaxInput] = useState("");
  const [taxType, setTaxType] = useState("PERCENT");

  const [lineItems, setLineItems] = useState([]);
  const [editIndex, setEditIndex] = useState(null);

  const [discountInput, setDiscountInput] = useState("");
  const [discountType, setDiscountType] = useState("PERCENT");

  const [billingMode, setBillingMode] = useState("CASH");
  const [manualPrice, setManualPrice] = useState("");
  const [commonTax, setCommonTax] = useState("");
  const [taxMode, setTaxMode] = useState("COMMON");

  const [errors, setErrors] = useState({});
  const [activeTab, setActiveTab] = useState("Tax");

  const [paymentType, setPaymentType] = useState("FULL"); // FULL | PARTIAL
  const [amountPaid, setAmountPaid] = useState("");

  /* ================= NEW CASCADING STATES ================= */
  const [allProducts, setAllProducts] = useState([]);
  const lastLoadedType = useRef(null);
  /* ======================================================== */

  // 🔍 Searchable dropdown states
  const [typeSearch, setTypeSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");

  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);

  const typeDropdownRef = useRef(null);
  const productDropdownRef = useRef(null);



  useEffect(() => {
    fetch("http://localhost:8080/api/ProductType/GetAllProductType", {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.json())
      .then((json) => {
        const list = json?.data?.productTypes ?? [];
        setProductTypes(Array.isArray(list) ? list : []);
      })
      .catch(() => { });
  }, []);

  /* ================= LOAD ALL PRODUCTS INITIALLY ================= */
  useEffect(() => {
    fetch("http://localhost:8080/api/Product/GetAllProduct", {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then(res => res.json())
      .then(json => {
        const dataObj = json?.data;

        // 🔥 Extract array safely even if backend wraps it
        const list =
          Array.isArray(dataObj)
            ? dataObj
            : typeof dataObj === "object"
              ? Object.values(dataObj).find(v => Array.isArray(v)) || []
              : [];

        setAllProducts(list);
        setProducts(list); // THIS makes all products show initially
      })
      .catch(() => {
        setAllProducts([]);
        setProducts([]);
      });
  }, []);

  /* =============================================================== */


  const handleTypeChange = (e) => {
    const id = e.target.value;
    setSelectedType(id);
    setSelectedProduct("");
    setInventory(null);
    setProducts([]);
    setManualPrice("");
    setTaxInput("");
    setErrors({});

    if (!id) return;

    fetch(`http://localhost:8080/api/Product/GetProdByProdId/${id}`, {
      method: "GET",
      credentials: "include",
    })
      .then((res) => res.json())
      .then((json) => {
        const list = json?.data ?? [];
        setProducts(Array.isArray(list) ? list : []);
      })
      .catch(() => { });
  };

  const handleProductChange = (e) => {
    const id = e.target.value;
    setSelectedProduct(id);
    setManualPrice("");
    setTaxInput("");
    setErrors({});

    if (!id) return;

    fetch(`http://localhost:8080/api/Inventory/GetInventoryByProdId/${id}`, {
      method: "GET",
      credentials: "include",
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.status === 200) setInventory(json.data);
        else setInventory(null);
      })
      .catch(() => { });
  };

  /* ================= AUTO SET PRODUCT TYPE WHEN PRODUCT CHANGES ================= */
  useEffect(() => {
    if (!selectedProduct) return;

    fetch(`http://localhost:8080/api/ProductType/GetProdTypeByProductId/${selectedProduct}`, {
      credentials: "include",
    })
      .then(res => res.json())
      .then(json => {
        const typeId = json?.data?.productTypeId || json?.data?.id;
        if (typeId && typeId !== selectedType) {
          setSelectedType(typeId);

          // Load products of that detected type
          if (lastLoadedType.current !== typeId) {
            lastLoadedType.current = typeId;
            fetch(`http://localhost:8080/api/Product/GetProdByProdId/${typeId}`, {
              credentials: "include",
            })
              .then(res => res.json())
              .then(json => {
                const list = json?.data ?? [];
                setProducts(Array.isArray(list) ? list : []);
              });
          }
        }
      })
      .catch(() => { });
  }, [selectedProduct]);
  /* ============================================================================== */


  const safeJson = async (res) => {
    try {
      return await res.json();
    } catch {
      return null;
    }
  };

  const addItem = () => {
    let tempErrors = {};
    if (!selectedType) tempErrors.selectedType = "Select product type";
    if (!selectedProduct) tempErrors.selectedProduct = "Select product";
    if (!quantity || quantity <= 0) tempErrors.quantity = "Enter valid quantity";

    let price = inventory ? inventory.unitSellingPrice : parseFloat(manualPrice || 0);
    if (!inventory && (!manualPrice || manualPrice <= 0))
      tempErrors.manualPrice = "Enter valid selling price";

    let taxValue =
      taxMode === "COMMON" ? parseFloat(commonTax || 0) : parseFloat(taxInput || 0);
    if (taxValue < 0) tempErrors.taxInput = "Tax cannot be less than 0";

    setErrors(tempErrors);
    if (Object.keys(tempErrors).length > 0) return;

    const product = products.find((p) => p.id === parseInt(selectedProduct));

    let taxAmount = 0;
    if (taxType === "PERCENT") taxAmount = (price * quantity * taxValue) / 100;
    else taxAmount = taxValue;

    const item = {
      productId: parseInt(selectedProduct),
      productName: product?.name || "",
      quantity: parseInt(quantity),
      sellingPrice: price,
      taxAmount,
    };

    let updated = [...lineItems];
    if (editIndex !== null) {
      updated[editIndex] = item;
      setEditIndex(null);
    } else {
      updated.push(item);
    }

    setLineItems(updated);

    // ------------------------------------------------------
    // ✅ Reset fields after Add or Update
    // ------------------------------------------------------
    setSelectedType("");
    setSelectedProduct("");
    setProducts(allProducts); // restored full list
    setInventory(null);
    setQuantity("");
    setManualPrice("");
    setTaxInput("");
  };

  const deleteItem = (index) => {
    let updated = [...lineItems];
    updated.splice(index, 1);
    setLineItems(updated);
  };

  // ------------------------------------------------------
  // ✅ FULL AUTO-EDIT LOGIC (same as SalesEdit)
  // ------------------------------------------------------
  const editItem = async (index) => {
    const it = lineItems[index];
    setEditIndex(index);

    setSelectedProduct(it.productId);
    setQuantity(it.quantity);
    setManualPrice(it.sellingPrice);
    setTaxInput(it.taxAmount);
    setErrors({});

    const productRes = await fetch(
      `http://localhost:8080/api/Product/GetProductById/${it.productId}`,
      {
        method: "GET",
        credentials: "include",
      }
    );
    const productJson = await safeJson(productRes);

    if (productJson?.data) {
      const typeId = productJson.data.productTypeId;
      setSelectedType(typeId);
      lastLoadedType.current = typeId;

      const listRes = await fetch(
        `http://localhost:8080/api/Product/GetProdByProdId/${typeId}`,
        {
          method: "GET",
          credentials: "include",
        }
      );
      const listJson = await safeJson(listRes);

      if (Array.isArray(listJson?.data)) {
        setProducts(listJson.data);
      }

      const invRes = await fetch(
        `http://localhost:8080/api/Inventory/GetInventoryByProdId/${it.productId}`,
        {
          method: "GET",
          credentials: "include",
        }
      );
      const invJson = await safeJson(invRes);

      if (invJson?.status === 200) {
        setInventory(invJson.data);
      }
    }
  };

  const totalAmount = lineItems.reduce(
    (sum, i) => sum + i.sellingPrice * i.quantity + i.taxAmount,
    0
  );

  // 1️⃣ Total of line items (sellingPrice * quantity)
  const lineTotal = lineItems.reduce(
    (sum, i) => sum + i.sellingPrice * i.quantity,
    0
  );

  // 2️⃣ Total tax from line items (product-wise tax)
  const lineTaxTotal = lineItems.reduce((sum, i) => sum + i.taxAmount, 0);

  // 3️⃣ Total before tax (apply discount)
  const discountedTotal =
    discountInput > 0
      ? discountType === "PERCENT"
        ? lineTotal - (lineTotal * discountInput) / 100
        : lineTotal - discountInput
      : lineTotal;

  // 4️⃣ Common tax (if applicable)
  let commonTaxAmount = 0;
  if (taxMode === "COMMON" && commonTax > 0) {
    commonTaxAmount =
      taxType === "PERCENT" ? (discountedTotal * commonTax) / 100 : parseFloat(commonTax);
  }

  // 5️⃣ Final net amount including tax
  const netAmount = discountedTotal + (taxMode === "PRODUCT" ? lineTaxTotal : commonTaxAmount);



  useEffect(() => {
    if (paymentType === "FULL") {
      setAmountPaid(netAmount.toFixed(2));
    }
  }, [paymentType, netAmount]);

  const submitSales = async () => {
    let tempErrors = {};
    if (lineItems.length === 0) tempErrors.lineItems = "Add at least one item";
    if (!billingMode) tempErrors.billingMode = "Select billing mode";
    if (discountInput < 0) tempErrors.discountInput = "Discount cannot be less than 0";

    if (!amountPaid || amountPaid <= 0)
      tempErrors.amountPaid = "Enter valid amount paid";
    if (parseFloat(amountPaid) > netAmount)
      tempErrors.amountPaid = "Amount paid cannot exceed net amount";

    setErrors(tempErrors);
    if (Object.keys(tempErrors).length > 0) return;

    const finalDiscount =
      discountType === "PERCENT"
        ? (totalAmount * (discountInput || 0)) / 100
        : parseFloat(discountInput || 0);

    const payload = {
      billingMode,
      totalDiscount: finalDiscount,
      items: lineItems,
      amountPaid: parseFloat(amountPaid),
      remainingAmount: parseFloat((netAmount - amountPaid).toFixed(2))
    };

    try {
      const response = await fetch("http://localhost:8080/api/Sales/AddSales", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok && result.status === 200) {
        onSubmit();
        onClose();
      }
    } catch (err) { }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target)) {
        setTypeDropdownOpen(false);
        setTypeSearch("");
      }
      if (productDropdownRef.current && !productDropdownRef.current.contains(e.target)) {
        setProductDropdownOpen(false);
        setProductSearch("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredTypes = productTypes.filter((t) =>
    t.name.toLowerCase().includes(typeSearch.toLowerCase())
  );

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <div className="sales-modal show">
      <div className="sales-container">
        <div className="sales-header">
          <h3>Add Sales</h3>

          <div className="tabs-header">
            <button
              className={activeTab === "Tax" ? "active-tab" : ""}
              onClick={() => setActiveTab("Tax")}
            >
              Tax
            </button>
            <button
              className={activeTab === "Product" ? "active-tab" : ""}
              onClick={() => setActiveTab("Product")}
            >
              Product
            </button>
            <button
              className={activeTab === "Billing" ? "active-tab" : ""}
              onClick={() => setActiveTab("Billing")}
            >
              Billing
            </button>
            <button className="close-btn-sales" onClick={onClose}>
              ✖
            </button>
          </div>
        </div>

        {activeTab === "Tax" && (
          <div className="sales-section">
            <h4>Tax Settings</h4>
            <div className="tax-settings-container">
              <div className="tax-row-single">
                <label className="tax-option">
                  <input
                    type="radio"
                    name="taxMode"
                    value="COMMON"
                    checked={taxMode === "COMMON"}
                    onChange={() => setTaxMode("COMMON")}
                  />
                  Common Tax
                </label>
                {taxMode === "COMMON" && (
                  <div className="tax-inline-fields">
                    <input
                      type="number"
                      value={commonTax}
                      onChange={(e) => setCommonTax(e.target.value)}
                      placeholder="Enter common tax"
                      min="0"
                    />
                    <select value={taxType} onChange={(e) => setTaxType(e.target.value)}>
                      <option value="PERCENT">%</option>
                      <option value="FLAT">₹</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="tax-row-single">
                <label className="tax-option">
                  <input
                    type="radio"
                    name="taxMode"
                    value="PRODUCT"
                    checked={taxMode === "PRODUCT"}
                    onChange={() => setTaxMode("PRODUCT")}
                  />
                  Product-wise Tax
                </label>
              </div>
            </div>
          </div>
        )}

        {activeTab === "Product" && (
          <div className="sales-section">
            <h4>Select Product</h4>

            <div className="product-row">
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
                        : productTypes.find((t) => t.id === selectedType)?.name || "Select product type"
                    }
                    onChange={(e) => setTypeSearch(e.target.value)}
                    readOnly={!typeDropdownOpen}
                    className="select-input"
                  />

                  {typeDropdownOpen && (
                    <ul className="options scroll-options">
                      {filteredTypes.map((t) => (
                        <li
                          key={t.id}
                          onClick={() => {
                            handleTypeChange({ target: { value: t.id } });
                            setTypeDropdownOpen(false);
                            setTypeSearch("");
                          }}
                        >
                          {t.name}
                        </li>
                      ))}
                      {filteredTypes.length === 0 && <li>No result found</li>}
                    </ul>
                  )}
                </div>
                {errors.selectedType && <div className="error">{errors.selectedType}</div>}
              </div>


              <div className="custom-select" ref={productDropdownRef}>
                <label>Product</label>
                <div
                  className={`select-box ${productDropdownOpen ? "active" : ""}`}
                  onClick={() => setProductDropdownOpen(!productDropdownOpen)}
                >
                  <input
                    type="text"
                    value={
                      productDropdownOpen
                        ? productSearch
                        : products.find((p) => p.id === selectedProduct)?.name || "Select product"
                    }
                    onChange={(e) => setProductSearch(e.target.value)}
                    readOnly={!productDropdownOpen}
                    className="select-input"
                  />

                  {productDropdownOpen && (
                    <ul className="options scroll-options">
                      {filteredProducts.map((p) => (
                        <li
                          key={p.id}
                          onClick={() => {
                            handleProductChange({ target: { value: p.id } });
                            setProductDropdownOpen(false);
                            setProductSearch("");
                          }}
                        >
                          {p.name}
                        </li>
                      ))}
                      {filteredProducts.length === 0 && <li>No result found</li>}
                    </ul>
                  )}
                </div>
                {errors.selectedProduct && <div className="error">{errors.selectedProduct}</div>}
              </div>

            </div>

            {inventory ? (
              <div className="inv-box">
                <div>
                  Selling Price: <b>₹{inventory.unitSellingPrice}</b>
                </div>
                <div>
                  Current Stock: <b>{inventory.currentQuantity}</b>
                </div>
              </div>
            ) : selectedProduct ? (
              <div className="inv-box">
                <label>Set Selling Price</label>
                <input
                  type="number"
                  value={manualPrice}
                  onChange={(e) => setManualPrice(e.target.value)}
                  placeholder="Enter selling price"
                  min="0"
                />
                {errors.manualPrice && (
                  <div className="error">{errors.manualPrice}</div>
                )}
              </div>
            ) : null}

            <div className="quantity-tax-row">
              <div>
                <label>Quantity</label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min="1"
                />
                {errors.quantity && (
                  <div className="error">{errors.quantity}</div>
                )}
              </div>

              {taxMode === "PRODUCT" && (
                <div className="tax-column">
                  <label>Tax</label>
                  <div className="tax-input-row">
                    <input
                      type="number"
                      value={taxInput}
                      onChange={(e) => setTaxInput(e.target.value)}
                      placeholder="Enter tax"
                      min="0"
                    />
                    {errors.taxInput && (
                      <div className="error">{errors.taxInput}</div>
                    )}
                    <select value={taxType} onChange={(e) => setTaxType(e.target.value)}>
                      <option value="PERCENT">%</option>
                      <option value="FLAT">₹</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <button className="add-btn" onClick={addItem}>
              {editIndex !== null ? "Update Item" : "Add Item"}
            </button>
            {errors.lineItems && (
              <div className="error">{errors.lineItems}</div>
            )}

            {lineItems.length > 0 && (
              <div className="sales-section">
                <h4>Items</h4>
                <table className="sales-table">
                  <thead>
                    <tr>
                      <th>Product Name</th>
                      <th>Qty</th>
                      <th>Price (Rs.)</th>
                      <th>Line Amount (Rs.)</th>
                      <th>Tax (Rs.)</th>
                      <th>Amount(Incl. Tax) (Rs.)</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((it, idx) => (
                      <tr key={idx}>
                        <td>{it.productName}</td>
                        <td>{it.quantity}</td>
                        <td>{it.sellingPrice}</td>
                        <td>{(it.quantity * it.sellingPrice).toFixed(2)}</td>
                        <td>{it.taxAmount}</td>
                        <td>
                          {(it.quantity * it.sellingPrice + it.taxAmount).toFixed(2)}
                        </td>
                        <td
                          style={{
                            display: "flex",
                            justifyContent: "center",
                            gap: "10px",
                          }}
                        >
                          <span
                            onClick={() => editItem(idx)}
                            title="Edit"
                            style={{ cursor: "pointer" }}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              height="24px"
                              viewBox="0 -960 960 960"
                              width="24px"
                              fill="#000000"
                            >
                              <path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z" />
                            </svg>
                          </span>
                          <span
                            onClick={() => deleteItem(idx)}
                            title="Delete"
                            style={{ cursor: "pointer" }}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              height="24px"
                              viewBox="0 -960 960 960"
                              width="24px"
                              fill="#000000"
                            >
                              <path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z" />
                            </svg>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="total-amount">
                  <b>Total Amount(Incl. Tax): Rs {totalAmount.toFixed(2)}</b>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "Billing" && (
          <div className="sales-section">
            <h4>Billing</h4>
            <label>Discount</label>
            <div className="tax-row">
              <input
                type="number"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                min="0"
              />
              <select value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
                <option value="PERCENT">%</option>
                <option value="FLAT">₹</option>
              </select>
              {errors.discountInput && (
                <div className="error">{errors.discountInput}</div>
              )}
            </div>

            <label>Billing Mode</label>
            <select
              value={billingMode}
              onChange={(e) => setBillingMode(e.target.value)}
            >
              <option value="">-- Select Billing Mode --</option>
              <option value="CASH">CASH</option>
              <option value="ONLINE">ONLINE</option>
              <option value="CARD">CARD</option>

            </select>
            {errors.billingMode && (
              <div className="error">{errors.billingMode}</div>
            )}

            <div className="total-amount">
              <b>Net Amount: Rs {netAmount.toFixed(2)}</b>
            </div>

            {/* ===== ADDED UI ===== */}
            <label>Payment Type</label>
            <div style={{ display: "flex", gap: "20px" }}>
              <label>
                <input
                  type="radio"
                  checked={paymentType === "FULL"}
                  onChange={() => setPaymentType("FULL")}
                />{" "}
                Full
              </label>
              <label>
                <input
                  type="radio"
                  checked={paymentType === "PARTIAL"}
                  onChange={() => setPaymentType("PARTIAL")}
                />{" "}
                Partial
              </label>
            </div>

            <label>Amount Paid</label>
            <input
              type="number"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              disabled={paymentType === "FULL"}
              min="0"
            />
            {errors.amountPaid && <div className="error">{errors.amountPaid}</div>}
            {/* ==================== */}

          </div>


        )}

        <div className="sales-footer">
          <button className="cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="submit-btn" onClick={submitSales}>
            Submit Sales
          </button>
        </div>
      </div>
    </div>
  );
}
