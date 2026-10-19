import React, { useState } from "react";
import ReactDOM from "react-dom";
import DynamicGrid from "../CommonComponent/DynamicGrid";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import { toast } from "react-toastify";
import "../../Styles/CommonAEUDForm/FormShell.css";
import "../../Styles/Inventory.css";
import DeliveryChallanAdd from "./DeliveryChallanAdd";
import DeliveryChallanView from "./DeliveryChallanView";

const config = { title: "Delivery challans", singular: "Delivery challan", base: "DeliveryChallan", list: "GetAllDeliveryChallansPaged", detail: "GetDeliveryChallanByUKey", add: "AddDeliveryChallan", cancel: "CancelDeliveryChallan", id: 37, number: "challanNumber", party: "retailerName", date: "challanDate", actions: { ISSUED: ["ConvertToInvoice", "Create invoice"] } };

function readResponse(response) {
  return response.text().then(text => {
    if (!text || !text.trim()) return null;
    try { return JSON.parse(text); }
    catch { throw new Error(text.trim() || `Invalid server response (${response.status})`); }
  });
}

export default function DeliveryChallan() {
  const [form, setForm] = useState(null);
  const [detailUKey, setDetailUKey] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const baseUrl = `${API_BASE_URL}/api/${config.base}`;
  const columns = [
    { field: config.number, header: "Document" },
    { field: config.party, header: "Party" },
    { field: config.date, header: "Date" },
    { field: "status", header: "Status" },
    { field: "totalValue", header: "Amount" },
    { field: "Action", header: "Actions", width: "220px" },
  ];
  const api = async (url, options = {}) => {
    const response = await apiClient(url, options);
    const result = await readResponse(response);
    if (!response.ok || (result?.status != null && result.status !== 200)) {
      throw new Error(result?.message || result?.error || `Request failed (${response.status})`);
    }
    return result?.data;
  };
  const perform = async (row, action) => {
    try {
      setBusy(true); setError("");
      await api(`${baseUrl}/${action}/${row.uKey}`, { method: "POST", body: JSON.stringify({}) });
      window.dispatchEvent(new Event("document-grid-refresh"));
      setDetailUKey(null);
      toast.success(`${config.singular} updated successfully.`);
    } catch (e) { setError(e.message || "Action failed"); }
    finally { setBusy(false); }
  };
  const actions = (row, { can, ActionIcon }) => <>
    <button className="dg-icon-btn dg-icon-btn--view" title="View" aria-label="View" onClick={() => setDetailUKey(row.uKey)}><ActionIcon.View /></button>
    {config.update && row.status === "DRAFT" && can("Edit") && <button className="dg-icon-btn dg-icon-btn--edit" title="Edit" aria-label="Edit" onClick={() => { try { setForm(row); } catch (e) { setError(e.message); } }}><ActionIcon.Edit /></button>}
    {config.actions[row.status] && can("Edit") && <button className="dg-icon-btn dg-icon-btn--activate" title={config.actions[row.status][1]} aria-label={config.actions[row.status][1]} disabled={busy} onClick={() => perform(row, config.actions[row.status][0])}><ActionIcon.Activate /></button>}
    {row.status !== "CANCELLED" && can("Disable") && <button className="dg-icon-btn dg-icon-btn--disable" disabled={busy} title="Cancel" aria-label="Cancel" onClick={() => perform(row, config.cancel)}><ActionIcon.Disable /></button>}
  </>;
  return <main className="ops-page">
    {detailUKey && ReactDOM.createPortal(<DeliveryChallanView uKey={detailUKey} onClose={() => setDetailUKey(null)} />, document.body)}
    <header className="ops-header"><div><span className="ops-eyebrow">OPERATIONS / DOCUMENTS</span><h1>{config.title}</h1><p>Manage documents and their status.</p></div></header>
    {error && <div className="ops-error" role="alert">{error}<button onClick={() => setError("")}>Dismiss</button></div>}
    <DynamicGrid Module={config.title} ModuleId={String(config.id)} apiUrl={`${baseUrl}/${config.list}`} columns={columns} customActionsOnly customAddAction={() => setForm({})} customAddLabel={`Add ${config.singular}`} extraActions={actions} />
    {form && ReactDOM.createPortal(<DeliveryChallanAdd onClose={() => setForm(null)} onSubmit={() => { setForm(null); window.dispatchEvent(new Event("document-grid-refresh")); }} />, document.body)}
  </main>;
}
