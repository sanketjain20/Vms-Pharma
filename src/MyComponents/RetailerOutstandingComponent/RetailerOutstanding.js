import React from "react";
import DynamicGrid from "../CommonComponent/DynamicGrid";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../../Styles/Inventory.css";
import "../../Styles/RetailerOutstanding/RetailerOutstanding.css";

export default function RetailerOutstanding() {

  const [ledgerRetailerId, setLedgerRetailerId] = React.useState(null);

  const columns = [
    { header: "Retailer Code",    field: "retailerCode",       width: "140px" },
    { header: "Shop Name",        field: "shopName",           width: "180px" },
    { header: "Owner",            field: "ownerName",          width: "150px" },
    { header: "Phone",            field: "phone",              width: "130px" },
    { header: "Unpaid Invoices",  field: "unpaidInvoiceCount", width: "130px" },
    { header: "Overdue",          field: "overdueInvoiceCount",width: "100px" },
    { header: "Credit (₹)",       field: "totalCredit",        width: "130px" },
    { header: "Partial (₹)",      field: "totalPartial",       width: "130px" },
    { header: "Total Due (₹)",    field: "totalOutstanding",   width: "140px" },
    { header: "Oldest Due Date",  field: "oldestDueDate",      width: "140px" },
    { header: "Actions",          field: "Action",             width: "120px" },
  ];

  return (
    <div className="i-container">

      {/* ── PAGE HEADER ── */}
      <div className="ro-page-header">
        <div className="ro-header-left">
          <div className="ro-eyebrow">
            <span className="ro-eyebrow-dot" />
            ACCOUNTS RECEIVABLE
          </div>
          <h2 className="ro-title">
            <span className="ro-title-slash">//</span>
            Retailer Outstanding
          </h2>
        </div>
        <div className="ro-header-right">
          <div className="ro-legend">
            <span className="ro-legend-dot ro-dot-red" />
            <span>Overdue</span>
          </div>
          <div className="ro-legend">
            <span className="ro-legend-dot ro-dot-amber" />
            <span>Due Soon</span>
          </div>
          <div className="ro-legend">
            <span className="ro-legend-dot ro-dot-blue" />
            <span>Pending</span>
          </div>
        </div>
      </div>

      {/*
        ── DynamicGrid with noPagination ──
        We override the ViewModal by intercepting the view action.
        Since DynamicGrid opens ViewModal on view click, we need
        to use the custom ledger modal instead.
        Solution: pass customViewComponent prop (add below).
      */}
      <DynamicGrid
        columns={columns}
        apiUrl="http://localhost:8080/api/RetailerLedger/Outstanding"
        Module="Retailer Outstanding"
        ModuleId="18"
        noPagination={true}
      />

      <ToastContainer position="top-center" autoClose={2000} />
    </div>
  );
}