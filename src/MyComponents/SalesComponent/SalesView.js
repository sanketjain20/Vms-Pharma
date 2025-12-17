// SalesView.js
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

  /* =======================
     ✔ ADDED: PRINT HANDLER
     (does NOT download)
     ======================= */
  const handlePrint = async () => {
    try {
      const response = await fetch(
        `http://localhost:8080/api/Invoice/GenerateInvoice/${sales.id}/1`,
        {
          method: "GET",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        }
      );

      const result = await response.json();

      if (result.status !== 200 || !result.data) {
        throw new Error(result.message || "Failed to generate invoice");
      }

      // Base64 → HTML
      const decodedHTML = atob(result.data);

      // Open new window for print preview
      const printWindow = window.open("", "_blank");

      printWindow.document.open();
      printWindow.document.write(decodedHTML);
      printWindow.document.close();

      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
      };

    } catch (err) {
      console.error("Print error:", err);
      alert("Failed to open print preview");
    }
  };

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

            </div>

            {/* ITEMS TABLE */}
            <h4 style={{ marginTop: "20px" }}>Items</h4>

            <table className="sales-items-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Selling Price (Rs.)</th>
                  <th>Item Amount (Rs.)</th>
                  <th>Tax (Rs.)</th>
                  <th>Amount(Incl. Tax) (Rs.)</th>
                </tr>
              </thead>

              <tbody>
                {sales.items?.map((item, idx) => (
                  <tr key={idx}>
                    <td>{item.product}</td>
                    <td>{item.quantity}</td>
                    <td>{item.sellingPrice}</td>
                    <td>{(item.quantity * item.sellingPrice).toFixed(2)}</td>
                    <td>{item.taxAmount}</td>
                    <td>{(item.subtotal).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* TOTALS BELOW TABLE */}
            <div className="sales-totals-right">
              <div className="totals-row">
                <span>Total Items Amount (Rs.)</span>
                <span>{(sales.totalAmount).toFixed(2)}</span>
              </div>
              <div className="totals-row">
                <span>Total Tax (Rs.)</span>
                <span>{sales.totalTax}</span>
              </div>
              <div className="totals-row">
                <span>Discount (Rs.)</span>
                <span>{sales.totalDiscount}</span>
              </div>
              <div className="totals-row net-amount">
                <span><b>Net Amount (Rs.)</b></span>
                <span><b>{(sales.netAmount).toFixed(2)}</b></span>
              </div>
            </div>

          </div>
        </div>

        {/* FOOTER */}
        <div className="modal-footer-fixed sales-view-footer">
          <button
            className="sales-view-btn-print"
            onClick={handlePrint}
          >
            🖨 Print
          </button>
        </div>

      </div>
    </div>
  );
}
