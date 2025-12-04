import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import "../../Styles/Sales/AddSales.css";

export default function SalesAdd({ onClose, onSubmit }) {
  const [productTypes, setProductTypes] = useState([]);
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState(null);

  const [selectedType, setSelectedType] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");

  const [quantity, setQuantity] = useState("");
  const [taxInput, setTaxInput] = useState(""); // per product if product-wise
  const [taxType, setTaxType] = useState("PERCENT");

  const [lineItems, setLineItems] = useState([]);
  const [discountInput, setDiscountInput] = useState("");
  const [discountType, setDiscountType] = useState("PERCENT");

  const [billingMode, setBillingMode] = useState("SIMPLE");

  const [manualPrice, setManualPrice] = useState(""); // user-set price
  const [commonTax, setCommonTax] = useState(""); // global tax
  const [taxMode, setTaxMode] = useState("COMMON"); // COMMON or PRODUCT

  // Fetch Product Types
  useEffect(() => {
    fetch("http://localhost:8080/api/ProductType/GetAllProductType", {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => {
        if (!res.ok) throw new Error("403");
        return res.json();
      })
      .then((json) => {
        if (json.status === 200) {
          const list = json?.data?.productTypes ?? [];
          setProductTypes(Array.isArray(list) ? list : []);
        } else {
          toast.error(json.message || "Failed to load product types");
        }
      })
      .catch((err) => {
        if (err.message === "403") toast.error("Forbidden: Login required");
        else toast.error("Server error");
      });
  }, []);

  // Fetch Products by Type
  const handleTypeChange = (e) => {
    const id = e.target.value;
    setSelectedType(id);
    setSelectedProduct("");
    setInventory(null);
    setProducts([]);
    setManualPrice("");
    setTaxInput("");

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
      .catch(() => toast.error("Server error"));
  };

  // Fetch Inventory by Product
  const handleProductChange = (e) => {
    const id = e.target.value;
    setSelectedProduct(id);
    setManualPrice("");
    setTaxInput("");
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
      .catch(() => toast.error("Server error"));
  };

  // Add Line Item
  const addItem = () => {
    if (!selectedType || !selectedProduct) {
      return toast.error("Please select product type & product");
    }
    if (!quantity || quantity <= 0) return toast.error("Enter valid quantity");

    let price = inventory ? inventory.unitSellingPrice : parseFloat(manualPrice || 0);
    if (!inventory && (!manualPrice || manualPrice <= 0)) return toast.error("Enter valid selling price");

    let taxValue = taxMode === "COMMON" ? parseFloat(commonTax || 0) : parseFloat(taxInput || 0);
    if (taxValue < 0) return toast.error("Tax cannot be less than 0");

    let taxAmount = 0;
    if (taxType === "PERCENT") {
      taxAmount = (price * parseInt(quantity) * taxValue) / 100;
    } else {
      taxAmount = taxValue;
    }

    const product = products.find((p) => p.id === parseInt(selectedProduct));
    const item = {
      productId: parseInt(selectedProduct),
      productName: product?.name || "",
      quantity: parseInt(quantity),
      sellingPrice: price,
      taxAmount,
    };

    setLineItems([...lineItems, item]);

    setQuantity("");
    setTaxInput("");
    setManualPrice("");
    toast.success("Item added");
  };

  // Submit Sales
  const submitSales = async () => {
    if (lineItems.length === 0) return toast.error("Add at least one item");

    const totalAmount = lineItems.reduce(
      (sum, i) => sum + i.sellingPrice * i.quantity + i.taxAmount,
      0
    );

    if (discountInput < 0) return toast.error("Discount cannot be less than 0");

    const finalDiscount =
      discountType === "PERCENT"
        ? (totalAmount * (discountInput || 0)) / 100
        : parseFloat(discountInput || 0);

    const payload = {
      billingMode,
      totalDiscount: finalDiscount,
      items: lineItems,
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
        toast.success("Sales added successfully");
        onSubmit();
        onClose();
      } else {
        toast.error(result.message || "Failed to add sales");
      }
    } catch (err) {
      toast.error("Something went wrong");
    }
  };

  return (
    <div className="sales-modal show">
      <div className="sales-container">
        <div className="sales-header">
          <h3>Add Sales</h3>
          <button className="close-btn" onClick={onClose}>✖</button>
        </div>

        {/* Tax Mode Selection */}
        <div className="sales-section">
          <h4>Tax Settings</h4>
          <div className="radio-group">
            <label>
              <input
                type="radio"
                name="taxMode"
                value="COMMON"
                checked={taxMode === "COMMON"}
                onChange={() => setTaxMode("COMMON")}
              /> Common Tax
            </label>
            <label>
              <input
                type="radio"
                name="taxMode"
                value="PRODUCT"
                checked={taxMode === "PRODUCT"}
                onChange={() => setTaxMode("PRODUCT")}
              /> Product-wise Tax
            </label>
          </div>

          {taxMode === "COMMON" && (
            <div className="tax-row">
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

        {/* Product Section */}
        <div className="sales-section">
          <h4>Select Product</h4>

          <div className="product-row">
            <div>
              <label>Product Type</label>
              <select value={selectedType} onChange={handleTypeChange}>
                <option value="">-- Select Type --</option>
                {productTypes.map((pt) => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
              </select>
            </div>

            <div>
              <label>Product</label>
              <select value={selectedProduct} onChange={handleProductChange}>
                <option value="">-- Select Product --</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          {inventory ? (
            <div className="inv-box">
              <div>Selling Price: <b>₹{inventory.unitSellingPrice}</b></div>
              <div>Current Stock: <b>{inventory.currentQuantity}</b></div>
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
                  <select
                    value={taxType}
                    onChange={(e) => setTaxType(e.target.value)}
                  >
                    <option value="PERCENT">%</option>
                    <option value="FLAT">₹</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <button className="add-btn" onClick={addItem}>Add Item</button>
        </div>

        {/* Table */}
        {lineItems.length > 0 && (
          <div className="sales-section">
            <h4>Added Items</h4>
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Tax</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((it, idx) => (
                  <tr key={idx}>
                    <td>{it.productName}</td>
                    <td>{it.quantity}</td>
                    <td>₹{it.sellingPrice}</td>
                    <td>₹{it.taxAmount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Billing */}
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
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value)}
            >
              <option value="PERCENT">%</option>
              <option value="FLAT">₹</option>
            </select>
          </div>

          <label>Billing Mode</label>
          <select
            value={billingMode}
            onChange={(e) => setBillingMode(e.target.value)}
          >
            <option value="SIMPLE">SIMPLE</option>
            <option value="GST">GST</option>
          </select>
        </div>

        {/* Footer */}
        <div className="sales-footer">
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
          <button className="submit-btn" onClick={submitSales}>Submit Sales</button>
        </div>
      </div>
    </div>
  );
}
