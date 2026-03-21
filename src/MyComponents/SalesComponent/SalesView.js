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
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.status === 200) setSales(data.data);
        else setError(data.message || "Failed to fetch sales");
      })
      .catch((err) => { console.error(err); setError(err.message); });
  }, [uKey]);

  const handlePrint = async () => {
    try {
      const response = await fetch(
        `http://localhost:8080/api/Invoice/GenerateInvoice/${sales.id}/1`,
        { method: "GET", credentials: "include", headers: { "Content-Type": "application/json" } }
      );
      const result = await response.json();
      if (result.status !== 200 || !result.data) throw new Error(result.message || "Failed to generate invoice");
      const decodedHTML = atob(result.data);
      const printWindow = window.open("", "_blank");
      printWindow.document.open();
      printWindow.document.write(decodedHTML);
      printWindow.document.close();
      printWindow.onload = () => { printWindow.focus(); printWindow.print(); };
    } catch (err) {
      console.error("Print error:", err);
      alert("Failed to open print preview");
    }
  };

  if (!uKey) return null;

  return (
    <div className="sv-backdrop">
      <div className="sv-modal">

        {/* Top beam */}
        <div className="sv-top-beam" />
        {/* Corner brackets */}
        <div className="sv-corner sv-tl" /><div className="sv-corner sv-tr" />
        <div className="sv-corner sv-bl" /><div className="sv-corner sv-br" />

        {/* ── HEADER ── */}
        <div className="sv-header">
          <div className="sv-header-left">
            <div className="sv-eyebrow">
              <span className="sv-eyebrow-dot" />
              SALES RECORD
            </div>
            <h3 className="sv-title">
              <span className="sv-title-acc">//</span>
              {sales ? `Invoice · ${sales.invoiceNumber}` : "Loading…"}
            </h3>
          </div>
          <button className="sv-close" onClick={onClose} title="Close">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            ESC
          </button>
        </div>

        {/* Divider */}
        <div className="sv-divider" />

        {/* ── BODY ── */}
        <div className="sv-body">

          {error && (
            <div className="sv-error">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M7 4.5V7.5M7 9.5h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              {error}
            </div>
          )}

          {!sales && !error && (
            <div className="sv-loading">
              <div className="sv-loader"><div/><div/><div/><div/></div>
              Loading invoice data…
            </div>
          )}

          {sales && (
            <>
              {/* ── META GRID ── */}
              <div className="sv-meta-grid">
                <div className="sv-meta-card">
                  <span className="sv-meta-label">Invoice Number</span>
                  <span className="sv-meta-value">{sales.invoiceNumber}</span>
                </div>
                <div className="sv-meta-card">
                  <span className="sv-meta-label">Billing Mode</span>
                  <span className="sv-meta-value">
                    <span className="sv-badge">{sales.billingMode}</span>
                  </span>
                </div>
                <div className="sv-meta-card">
                  <span className="sv-meta-label">Date</span>
                  <span className="sv-meta-value">{sales.createdAt}</span>
                </div>
                <div className="sv-meta-card">
                  <span className="sv-meta-label">Status</span>
                  <span className="sv-meta-value">
                    <span className={`sv-badge ${Number(sales.remainingAmount) > 0 ? "sv-badge-red" : "sv-badge-green"}`}>
                      {Number(sales.remainingAmount) > 0 ? "Partial" : "Paid"}
                    </span>
                  </span>
                </div>
              </div>

              {/* ── ITEMS TABLE ── */}
              <div className="sv-table-section">
                <div className="sv-table-header">
                  <div className="sv-table-title">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <rect x="1" y="1" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                      <rect x="7" y="1" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                      <rect x="1" y="7" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                      <rect x="7" y="7" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                    </svg>
                    Line Items
                  </div>
                  <span className="sv-item-count">{sales.items?.length || 0} items</span>
                </div>

                <div className="sv-table-wrap">
                  <table className="sv-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Qty</th>
                        <th>Price (₹)</th>
                        <th>Line Amt (₹)</th>
                        <th>GST (₹)</th>
                        <th>Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sales.items?.map((item, idx) => (
                        <tr key={idx} style={{ animationDelay: `${idx * 0.03}s` }}>
                          <td>{item.product}</td>
                          <td>{item.quantity}</td>
                          <td>{item.sellingPrice}</td>
                          <td>{(item.quantity * item.sellingPrice).toFixed(2)}</td>
                          <td>{item.taxAmount}</td>
                          <td className="sv-td-highlight">{(item.subtotal).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── TOTALS ── */}
              <div className="sv-totals">
                <div className="sv-totals-row">
                  <span>Items Total</span>
                  <span>₹{(sales.totalAmount).toFixed(2)}</span>
                </div>
                <div className="sv-totals-row">
                  <span>Total GST</span>
                  <span>₹{sales.totalTax}</span>
                </div>
                <div className="sv-totals-row">
                  <span>Discount</span>
                  <span className="sv-discount">−₹{sales.totalDiscount}</span>
                </div>
                <div className="sv-totals-divider" />
                <div className="sv-totals-row sv-totals-net">
                  <span>Net Amount</span>
                  <span>₹{(sales.netAmount).toFixed(2)}</span>
                </div>
                {Number(sales.remainingAmount) > 0 && (
                  <div className="sv-totals-row sv-totals-due">
                    <span>Due Amount</span>
                    <span>₹{Number(sales.remainingAmount).toFixed(2)}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── FOOTER ── */}
        {sales && (
          <div className="sv-footer">
            <button className="sv-btn-ghost" onClick={onClose}>Close</button>
            <button className="sv-btn-print" onClick={handlePrint}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M3 4.5V1.5h7V4.5M3 9.5H1.5V5.5h10V9.5H10M3 7.5h7v4H3v-4Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
              </svg>
              Print Invoice
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
