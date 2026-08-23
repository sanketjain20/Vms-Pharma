import React, { useEffect, useState } from "react";
import "../../Styles/CommonAEUDForm/FormShell.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

export default function SalesView({ uKey, onClose }) {
  const [sales, setSales] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!uKey) return;
    apiClient(`${API_BASE_URL}/api/Sales/GetSalesByUkey/${uKey}`, {
      method: "GET",
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
      const response = await apiClient(
        `${API_BASE_URL}/api/Invoice/GenerateInvoice/${sales.id}/1`,
        { method: "GET", headers: { "Content-Type": "application/json" } }
      );
      const result = await response.json();
      if (result.status !== 200 || !result.data) throw new Error(result.message || "Failed to generate invoice");

      // atob() only reverses base64 — it does NOT UTF-8 decode. It treats
      // every decoded byte as one Latin-1 char, so multi-byte UTF-8 chars
      // (₹, –, etc.) come out mangled ("â□" style garbage). Route the raw
      // bytes through TextDecoder("utf-8") to get correct characters.
      const binaryStr = atob(result.data);
      const bytes = Uint8Array.from(binaryStr, (c) => c.charCodeAt(0));
      const decodedHTML = new TextDecoder("utf-8").decode(bytes);

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

  // Product name comes back under different keys/shapes depending on the
  // endpoint — cover string fields under any likely name, and a nested
  // { name } object, instead of trusting one exact shape.
  const productLabel = (item) => {
    const v = item.product ?? item.productName ?? item.productDetails ?? item.Product ?? item.name;
    if (v == null || v === "") return "—";
    if (typeof v === "object") return v.name || v.productName || v.product || "—";
    return v;
  };

  if (!uKey) return null;

  return (
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--xl">
        <div className="afx-header">
          <div>
            <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />Sales Record</div>
            <h3 className="afx-title">{sales ? `Invoice · ${sales.invoiceNumber}` : "Loading…"}</h3>
          </div>
          <button className="afx-close" onClick={onClose} title="Close">
            <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            ESC
          </button>
        </div>

        <div className="afx-body">
          {error && <div className="afx-alert">{error}</div>}

          {!sales && !error && (
            <div className="afx-loading"><div className="afx-loader-ring"><div/><div/><div/></div></div>
          )}

          {sales && (
            <>
              <div className="afx-meta-cards" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                <div className="afx-meta-card">
                  <span className="afx-meta-card-label">Invoice Number</span>
                  <span className="afx-meta-card-val">{sales.invoiceNumber}</span>
                </div>
                <div className="afx-meta-card">
                  <span className="afx-meta-card-label">Billing Mode</span>
                  <span className="afx-meta-card-val"><span className="afx-tag">{sales.billingMode}</span></span>
                </div>
                <div className="afx-meta-card">
                  <span className="afx-meta-card-label">Date</span>
                  <span className="afx-meta-card-val">{sales.createdAt}</span>
                </div>
                <div className="afx-meta-card">
                  <span className="afx-meta-card-label">Retailer</span>
                  <span className="afx-meta-card-val">
                    {sales.retailerName
                      ? <>{sales.retailerName} <span className="afx-view-value--muted" style={{ fontSize: 11 }}>· {sales.retailerCode}</span></>
                      : <span className="afx-view-value--muted" style={{ fontSize: 12 }}>Walk-in customer</span>}
                  </span>
                </div>
                <div className="afx-meta-card">
                  <span className="afx-meta-card-label">Payment Type</span>
                  <span className="afx-meta-card-val">
                    <span
                      className="afx-tag"
                      style={
                        sales.paymentType === "PAID"   ? { color: "var(--afx-success)", background: "var(--afx-success-soft)" } :
                        sales.paymentType === "CREDIT" ? { color: "var(--afx-danger)",  background: "var(--afx-danger-soft)"  } : undefined
                      }
                    >
                      {sales.paymentType || "—"}
                    </span>
                  </span>
                </div>
                <div className="afx-meta-card">
                  <span className="afx-meta-card-label">Status / Due Date</span>
                  <span className="afx-meta-card-val">
                    <span
                      className="afx-tag"
                      style={Number(sales.remainingAmount) > 0
                        ? { color: "var(--afx-danger)", background: "var(--afx-danger-soft)" }
                        : { color: "var(--afx-success)", background: "var(--afx-success-soft)" }}
                    >
                      {Number(sales.remainingAmount) > 0 ? "Pending" : "Paid"}
                    </span>
                    {sales.dueDate && (
                      <span className="afx-view-value--muted" style={{ fontSize: 11, marginLeft: 6 }}>Due: {sales.dueDate}</span>
                    )}
                  </span>
                </div>
              </div>

              <div className="afx-section-title">Line Items ({sales.items?.length || 0})</div>
              {!sales.items?.length ? (
                <div className="afx-items-empty">
                  <p>No line items found on this record.</p>
                </div>
              ) : (
              <div className="afx-line-table" style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Batch No</th>
                      <th>Expiry</th>
                      <th>HSN</th>
                      <th>Qty</th>
                      <th>Price (₹)</th>
                      <th>GST (₹)</th>
                      <th>Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      try {
                        return (sales.items || []).map((item, idx) => {
                          if (!item) return null;
                          const qty = Number(item.quantity) || 0;
                          const price = Number(item.sellingPrice) || 0;
                          const tax = Number(item.taxAmount) || 0;
                          return (
                            <tr key={idx}>
                              <td style={{ color: "var(--afx-text-1)", fontWeight: 600 }}>{productLabel(item)}</td>
                              <td style={{ color: "var(--afx-accent)", fontFamily: "var(--afx-font-mono)", fontSize: 11 }}>{item.batchNumberSnapshot || "—"}</td>
                              <td style={{ fontSize: 11 }}>{item.expiryDateSnapshot || "—"}</td>
                              <td style={{ fontSize: 11 }}>{item.hsnCodeSnapshot || "—"}</td>
                              <td>{item.quantity ?? "—"}</td>
                              <td>{item.sellingPrice ?? "—"}</td>
                              <td>{tax.toFixed(2)}</td>
                              <td style={{ fontWeight: 700, color: "var(--afx-text-1)" }}>{Number(item.subtotal ?? qty * price + tax).toFixed(2)}</td>
                            </tr>
                          );
                        });
                      } catch (e) {
                        console.error("Failed to render sale line items:", e, sales.items);
                        return (
                          <tr><td colSpan={8} className="afx-alert" style={{ display: "table-cell" }}>
                            Couldn't display line items — unexpected data shape. Check the console for details.
                          </td></tr>
                        );
                      }
                    })()}
                  </tbody>
                </table>
              </div>
              )}

              <div className="afx-totals">
                <div className="afx-totals-row"><span>Items Total</span><span>₹{(sales.totalAmount).toFixed(2)}</span></div>
                <div className="afx-totals-row"><span>Total GST</span><span>₹{sales.totalTax}</span></div>
                <div className="afx-totals-row"><span>Discount</span><span className="afx-text-danger">−₹{sales.totalDiscount}</span></div>
                <div className="afx-totals-divider" />
                <div className="afx-totals-row afx-totals-grand"><span>Net Amount</span><span>₹{(sales.netAmount).toFixed(2)}</span></div>
                {Number(sales.remainingAmount) > 0 && (
                  <div className="afx-totals-row"><span>Due Amount</span><span className="afx-text-danger">₹{Number(sales.remainingAmount).toFixed(2)}</span></div>
                )}
              </div>
            </>
          )}
        </div>

        {sales && (
          <div className="afx-footer">
            <button className="afx-btn" onClick={onClose}>Close</button>
            <button className="afx-btn afx-btn--primary" onClick={handlePrint}>
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
