import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import "../../Styles/Sales/AddSales.css";

export default function SalesEdit({ uKey, onClose, onSubmit }) {
  const [productTypes, setProductTypes] = useState([]);
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState(null);

  const [selectedType, setSelectedType] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(""); 

  const [quantity, setQuantity] = useState("");
  const [taxInput, setTaxInput] = useState("");
  const [taxMode, setTaxMode] = useState("PERCENT");

  const [manualPrice, setManualPrice] = useState("");
  const [lineItems, setLineItems] = useState([]);
  const [editIndex, setEditIndex] = useState(null);

  const [discountInput, setDiscountInput] = useState("");
  const [discountType, setDiscountType] = useState("RS");
  const [billingMode, setBillingMode] = useState("SIMPLE");
  const [saleId, setSaleId] = useState(null); 
  const [invoiceNumber, setInvoiceNumber] = useState("");

  const [errors, setErrors] = useState({});

  const safeJson = async (res) => {
    try {
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    fetch("http://localhost:8080/api/ProductType/GetAllProductType", {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" }
    })
      .then(safeJson)
      .then(json => {
        if (json?.data?.productTypes) setProductTypes(json.data.productTypes);
      });
  }, []);

  useEffect(() => {
    if (uKey) fetchSaleByUkey();
  }, [uKey]);

  const fetchSaleByUkey = () => {
    fetch(`http://localhost:8080/api/Sales/GetSalesByUkey/${uKey}`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" }
    })
      .then(safeJson)
      .then(json => {
        if (!json?.data) return toast.error("Sale not found");

        const sale = json.data;
        setSaleId(sale.id); 
        setInvoiceNumber(sale.invoiceNumber);

        setLineItems(
          sale.items.map(i => ({
            productId: i.productId,
            productName: i.product,
            quantity: i.quantity,
            sellingPrice: i.sellingPrice,
            taxAmount: i.taxAmount,
          }))
        );

        setDiscountInput(sale.totalDiscount || 0);
        setDiscountType("RS");
        setBillingMode(sale.billingMode || "SIMPLE");
      });
  };

  const handleTypeChange = (e) => {
    const typeId = e.target.value;
    setSelectedType(typeId);
    setSelectedProduct("");
    setInventory(null);
    setProducts([]);
    setErrors({});

    fetch(`http://localhost:8080/api/Product/GetProdByProdId/${typeId}`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" }
    })
      .then(safeJson)
      .then(json => setProducts(json?.data ?? []));
  };

  const handleProductChange = (e) => {
    const prodId = e.target.value;
    setSelectedProduct(prodId);
    setInventory(null);
    setErrors({});

    fetch(`http://localhost:8080/api/Inventory/GetInventoryByProdId/${prodId}`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" }
    })
      .then(safeJson)
      .then(json => setInventory(json?.data || null));
  };

  const addOrUpdateItem = () => {
    let tempErrors = {};
    if (!selectedType) tempErrors.selectedType = "Select product type";
    if (!selectedProduct) tempErrors.selectedProduct = "Select product";
    if (!quantity || quantity <= 0) tempErrors.quantity = "Enter valid quantity";

    const product = products.find(p => p.id === parseInt(selectedProduct));
    if (!product) tempErrors.selectedProduct = tempErrors.selectedProduct || "Invalid product";

    let price = inventory ? inventory.unitSellingPrice : parseFloat(manualPrice);
    if (!price) tempErrors.manualPrice = "Enter valid price";

    let taxVal = taxMode === "PERCENT" ? parseFloat(taxInput || 0) : parseFloat(taxInput || 0);
    if (taxVal < 0) tempErrors.taxInput = "Tax cannot be less than 0";

    setErrors(tempErrors);
    if (Object.keys(tempErrors).length > 0) return;

    const taxAmount = taxMode === "PERCENT" 
      ? (price * quantity * (taxInput || 0)) / 100 
      : parseFloat(taxInput || 0);

    const item = {
      productId: parseInt(selectedProduct),
      productName: product.name,
      quantity: parseInt(quantity),
      sellingPrice: price,
      taxAmount
    };

    let updated = [...lineItems];
    if (editIndex !== null) {
      updated[editIndex] = item;
      setEditIndex(null);
    } else {
      updated.push(item);
    }

    setLineItems(updated);
    clearForm();
    toast.success("Item saved");
  };

  const clearForm = () => {
    setSelectedType("");
    setSelectedProduct("");
    setQuantity("");
    setTaxInput("");
    setManualPrice("");
    setInventory(null);
    setTaxMode("PERCENT");
    setErrors({});
  };

  const editItem = async (index) => {
    const it = lineItems[index];
    setEditIndex(index);

    const allProductsRes = await fetch("http://localhost:8080/api/Product/GetAllProduct", {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" }
    });
    const allProductsJson = await safeJson(allProductsRes);
    const allProducts = allProductsJson?.data?.products || [];
    const product = allProducts.find(p => p.id === it.productId);
    if (!product) return;

    const typeId = product.productTypeId;
    setSelectedType(typeId);

    const prodsRes = await fetch(`http://localhost:8080/api/Product/GetProdByProdId/${typeId}`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" }
    });
    const prodsJson = await safeJson(prodsRes);
    setProducts(prodsJson?.data || []);

    setSelectedProduct(it.productId);
    setQuantity(it.quantity);
    setManualPrice(it.sellingPrice);
    setTaxInput(it.taxAmount);
    setTaxMode("RS");

    const invRes = await fetch(`http://localhost:8080/api/Inventory/GetInventoryByProdId/${it.productId}`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" }
    });
    const invJson = await safeJson(invRes);
    setInventory(invJson?.data || null);
    setErrors({});
  };

  const deleteItem = (index) => {
    const updated = [...lineItems];
    updated.splice(index, 1);
    setLineItems(updated);
  };

  const updateSale = () => {
    let tempErrors = {};
    if (lineItems.length === 0) tempErrors.lineItems = "Add at least one item";
    if (!saleId) tempErrors.saleId = "Sale ID not available";
    setErrors(tempErrors);
    if (Object.keys(tempErrors).length > 0) return;

    const payload = {
      totalDiscount: parseFloat(discountInput || 0),
      items: lineItems.map(it => ({
        productId: it.productId,
        quantity: it.quantity,
        sellingPrice: it.sellingPrice,
        taxAmount: it.taxAmount
      }))
    };

    fetch(`http://localhost:8080/api/Sales/UpdateSales/${saleId}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(safeJson)
      .then(json => {
        if (json?.status === 200 || json?.success) {
          toast.success("Sales updated");
          onSubmit();
          onClose();
        } else toast.error(json?.message || "Update failed");
      });
  };

  return (
    <div className="sales-modal show">
      <div className="sales-container">
        <div className="sales-header">
          <h3>Edit Sales | {invoiceNumber}</h3>
          <button className="close-btn" onClick={onClose}>✖</button>
        </div>

        <div className="sales-section">
          <div className="product-row">
            <div>
              <label>Product Type</label>
              <select value={selectedType} onChange={handleTypeChange}>
                <option value="">-- Select Type --</option>
                {productTypes.map(pt => (
                  <option key={pt.id} value={pt.id}>{pt.name}</option>
                ))}
              </select>
              {errors.selectedType && <div className="error">{errors.selectedType}</div>}
            </div>
            <div>
              <label>Product</label>
              <select value={selectedProduct} onChange={handleProductChange}>
                <option value="">-- Select Product --</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {errors.selectedProduct && <div className="error">{errors.selectedProduct}</div>}
            </div>
          </div>

          {inventory && (
            <div className="inv-box">
              <div>Selling Price: <b>₹{inventory.unitSellingPrice}</b></div>
              <div>Current Stock: <b>{inventory.currentQuantity}</b></div>
            </div>
          )}

          {!inventory && selectedProduct && (
            <div className="inv-box">
              <label>Set Selling Price</label>
              <input
                type="number"
                value={manualPrice}
                onChange={(e) => setManualPrice(e.target.value)}
                placeholder="Enter selling price"
              />
              {errors.manualPrice && <div className="error">{errors.manualPrice}</div>}
            </div>
          )}

          <div className="quantity-tax-row">
            <div>
              <label>Qty</label>
              <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              {errors.quantity && <div className="error">{errors.quantity}</div>}
            </div>
            <div>
              <label>Tax</label>
              <div style={{ display: "flex", gap: "5px" }}>
                <input type="number" value={taxInput} onChange={(e) => setTaxInput(e.target.value)} style={{ width: "120px" }} />
                <select value={taxMode} onChange={(e) => setTaxMode(e.target.value)} style={{ width: "60px" }}>
                  <option value="PERCENT">%</option>
                  <option value="RS">₹</option>
                </select>
              </div>
              {errors.taxInput && <div className="error">{errors.taxInput}</div>}
            </div>
          </div>

          <button className="add-btn" onClick={addOrUpdateItem}>
            {editIndex !== null ? "Update Item" : "Add Item"}
          </button>
          {errors.lineItems && <div className="error">{errors.lineItems}</div>}
        </div>

        <div className="sales-section">
          <table className="sales-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Tax</th>
                <th style={{ textAlign: "center" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((it, i) => (
                <tr key={i}>
                  <td>{it.productName}</td>
                  <td>{it.quantity}</td>
                  <td>{it.sellingPrice}</td>
                  <td>{it.taxAmount}</td>
                  <td style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
                    <span onClick={() => editItem(i)} title="Edit" style={{ cursor: "pointer" }}>
                      <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#000000">
                        <path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/>
                      </svg>
                    </span>
                    <span onClick={() => deleteItem(i)} title="Delete" style={{ cursor: "pointer" }}>
                      <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#000000">
                        <path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/>
                      </svg>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="sales-section">
          <h4>Billing</h4>
          <label>Discount</label>
          <div className="tax-row">
            <input type="number" value={discountInput} onChange={(e) => setDiscountInput(e.target.value)} min="0" />
            <select value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
              <option value="PERCENT">%</option>
              <option value="RS">₹</option>
            </select>
          </div>

          <label>Billing Mode</label>
          <select value={billingMode} onChange={(e) => setBillingMode(e.target.value)}>
            <option value="SIMPLE">SIMPLE</option>
            <option value="GST">GST</option>
          </select>
        </div>

        <div className="sales-footer">
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
          <button className="submit-btn" onClick={updateSale}>Update Sale</button>
        </div>
      </div>
    </div>
  );
}
