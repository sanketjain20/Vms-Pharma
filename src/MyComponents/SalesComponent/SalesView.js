import React, { useEffect, useState } from "react";
import "../../Styles/Sales/SalesView.css";

export default function SalesView({ uKey, onClose }) {
  const [sales, setSales] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!uKey) return;

    fetch(`http://localhost:8080/api/Sales/GetSalesByUkey/${uKey}`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status}: ${text || "No response body"}`);
        }
        return res.json();
      })
      .then((data) => {
        if (data.status === 200) {
          setSales(data.data);
        } else {
          setError(data.message || "Failed to fetch sales");
        }
      })
      .catch((err) => {
        console.error("Fetch error:", err);
        setError(err.message);
      });
  }, [uKey]);

  if (!uKey) return null;
  if (error) return <p style={{ color: "red" }}>{error}</p>;
  if (!sales) return <p>Loading...</p>;

  return (
    <div className="sales-view-modal-backdrop">
      <div className="sales-view-modal">

        {/* HEADER */}
        <div className="sales-view-modal-header">
          <div className="sales-view-modal-title">
            <h3>Sales | {sales.invoiceNumber}</h3>
          </div>
          <div className="sales-view-modal-controls">
            <button className="sales-view-btn-ghost" onClick={onClose}>✖</button>
          </div>
        </div>

        {/* BODY */}
        <div className="modal-body scrollable">
          <div className="sales-view">

            {/* 2-COLUMN GRID */}
            <div className="sales-grid">

              <div className="sales-row">
                <label>Invoice Number :</label>
                <span>{sales.invoiceNumber}</span>
              </div>

              <div className="sales-row">
                <label>Billing Mode :</label>
                <span>{sales.billingMode}</span>
              </div>

              <div className="sales-row">
                <label>Date :</label>
                <span>{sales.createdAt}</span>
              </div>

              <div className="sales-row">
                <label>Total Amount :</label>
                <span>₹{sales.totalAmount}</span>
              </div>

              <div className="sales-row">
                <label>Total Tax :</label>
                <span>₹{sales.totalTax}</span>
              </div>

              <div className="sales-row">
                <label>Total Discount :</label>
                <span>₹{sales.totalDiscount}</span>
              </div>

              <div className="sales-row" style={{ gridColumn: "1 / span 2" }}>
                <label>Net Amount :</label>
                <span><b>₹{sales.netAmount}</b></span>
              </div>

            </div>

            {/* ITEMS TABLE */}
            <h4 style={{ marginTop: "20px" }}>Items</h4>

            <table className="sales-items-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Selling Price</th>
                  <th>Tax</th>
                  <th>Subtotal</th>
                </tr>
              </thead>

              <tbody>
                {sales.items?.map((item, idx) => (
                  <tr key={idx}>
                    <td>{item.product}</td>
                    <td>{item.quantity}</td>
                    <td>₹{item.sellingPrice}</td>
                    <td>₹{item.taxAmount}</td>
                    <td>₹{item.subtotal}</td>
                  </tr>
                ))}
              </tbody>
            </table>

          </div>
        </div>

        <div className="modal-footer-fixed"></div>
      </div>
    </div>
  );
}
