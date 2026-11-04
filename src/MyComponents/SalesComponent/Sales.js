import React, { useState } from "react";
import DynamicGrid from "../CommonComponent/DynamicGrid";
import "../../Styles/Inventory.css";
import API_BASE_URL from "../../Config/api.config";
import CancelBillModal from "./CancelBillModal";
import CollectBalanceModal from "./CollectBalanceModal";

/** A cancelled bill keeps its number; the list marks it so its ₹0 isn't mistaken for a free sale. */
export const SALES_COLUMNS = [
  { header: "Invoice Number", field: "invoiceNumber", width: "200px", format: (v, row) => (row?.cancelled ? `${v} · Cancelled` : v) },
  { header: "Customer Name", field: "billedTo", width: "200px" },
  { header: "Net Amount (₹)", field: "netAmount", width: "205px" },
  { header: "Due Amount (₹)", field: "remainingAmount", width: "205px" },
  { header: "Billing Mode", field: "billingMode", width: "205px" },
  { header: "Date", field: "createdAt", width: "180px" },
  { header: "Actions", field: "Action", width: "200px" },
];

const refreshGrid = () => window.dispatchEvent(new Event("document-grid-refresh"));

export default function Sales() {
  const [cancelling, setCancelling] = useState(null); // the bill whose Cancel dialog is open
  const [collecting, setCollecting] = useState(null); // the bill whose Collect balance dialog is open

  // after the grid's own actions: "Collect balance" on any bill with money due (a retailer's goes through their
  // ledger, a walk-in's onto the bill), then "Cancel bill" last, for a role with the "Cancel Bill" permission (the
  // server checks the 24-hour limit, returns and e-invoices, and says why when it refuses)
  const actions = (row, { can, ActionIcon }) => {
    if (row.cancelled) return null;
    return (
      <>
        {Number(row.remainingAmount) > 0 && can("Edit") && (
          <button type="button" className="dg-icon-btn dg-icon-btn--payment" title="Collect balance" aria-label="Collect balance"
            onClick={() => setCollecting(row)}><ActionIcon.Payment /></button>
        )}
        {can("Cancel Bill") && (
          <button type="button" className="dg-icon-btn dg-icon-btn--disable" title="Cancel bill" aria-label="Cancel bill"
            onClick={() => setCancelling(row)}><ActionIcon.Cancel /></button>
        )}
      </>
    );
  };

  return (
    <div className="i-container">
      <h2 className="i-title">🧾 Sales</h2>

      <DynamicGrid
        columns={SALES_COLUMNS}
        apiUrl={`${API_BASE_URL}/api/Sales/GetAllSales`}
        Module="Sales"
        ModuleId="5"
        extraActions={actions}
      />

      {collecting && <CollectBalanceModal bill={collecting} onClose={() => setCollecting(null)} onCollected={refreshGrid} />}
      {cancelling && <CancelBillModal bill={cancelling} onClose={() => setCancelling(null)} onCancelled={refreshGrid} />}
    </div>
  );
}
