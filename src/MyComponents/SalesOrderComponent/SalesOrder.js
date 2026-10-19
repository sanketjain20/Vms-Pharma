import React, { useState } from "react";
import ReactDOM from "react-dom";
import DynamicGrid from "../CommonComponent/DynamicGrid";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import { toast } from "react-toastify";
import SalesAdd from "../SalesComponent/SalesAdd";
import SalesEdit from "../SalesComponent/SalesEdit";
import SalesView from "../SalesComponent/SalesView";
import "../../Styles/CommonAEUDForm/FormShell.css";
import "../../Styles/Inventory.css";

const config = { title: "Sales orders", singular: "Sales order", base: "SalesOrder", list: "GetAllSalesOrdersPaged", detail: "GetSalesOrderByUKey", add: "AddSalesOrder", update: "UpdateSalesOrder", cancel: "CancelSalesOrder", id: 36, number: "orderNumber", party: "retailerName", date: "orderDate", actions: { DRAFT: ["ConfirmSalesOrder", "Confirm"], CONFIRMED: ["ConvertToSale", "Create invoice"] } };

export default function SalesOrder() {
  const [form, setForm] = useState(null);
  const [detailState, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const detail = null; // Legacy drawer is intentionally disabled; use SalesView below.
  const baseUrl = `${API_BASE_URL}/api/${config.base}`;
  const columns = [
    { field: config.number, header: "Document" },
    { field: config.party, header: config.id === 38 ? "From godown" : "Party" },
    ...(config.id === 38 ? [{ field: "toGodownName", header: "To godown" }] : []),
    { field: config.date, header: "Date" },
    { field: "status", header: "Status" },
    { field: config.id === 38 ? "totalUnits" : config.id === 37 ? "totalValue" : "netAmount", header: config.id === 38 ? "Units" : "Amount" },
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
      let body = "{}";
      if (action === "ConvertToSale") {
        // The convert/invoice endpoint accepts an explicit items list, but an
        // empty body also works (backend defaults to all pending lines). We send
        // the order's godown so the invoice lands in the right place.
        const order = await api(`${baseUrl}/${config.detail}/${row.uKey}`);
        body = JSON.stringify({
          godownId: order.godownId || null,
          paymentType: order.paymentType || null,
          amountPaid: order.amountPaid ?? null,
          dueDate: order.dueDate || null,
          billingMode: order.billingMode || null,
          autoApplySchemes: order.autoApplySchemes != null ? order.autoApplySchemes : null,
        });
      }
      await api(`${baseUrl}/${action}/${row.uKey}`, { method: "POST", body });
      window.dispatchEvent(new Event("document-grid-refresh"));
      setDetail(null);
      toast.success(`${config.singular} updated successfully.`);
    } catch (e) { setError(e.message || "Action failed"); }
    finally { setBusy(false); }
  };
  const actions = (row, { can, ActionIcon }) => <>
    <button className="dg-icon-btn dg-icon-btn--view" title="View" aria-label="View" onClick={async () => { try { setDetail(await api(`${baseUrl}/${config.detail}/${row.uKey}`)); } catch (e) { setError(e.message); } }}><ActionIcon.View /></button>
    {config.update && row.status === "DRAFT" && can("Edit") && <button className="dg-icon-btn dg-icon-btn--edit" title="Edit" aria-label="Edit" onClick={async () => { try { setForm(await api(`${baseUrl}/${config.detail}/${row.uKey}`)); } catch (e) { setError(e.message); } }}><ActionIcon.Edit /></button>}
    {config.actions[row.status] && can("Edit") && <button className="dg-icon-btn dg-icon-btn--activate" title={config.actions[row.status][1]} aria-label={config.actions[row.status][1]} disabled={busy} onClick={() => perform(row, config.actions[row.status][0])}><ActionIcon.Activate /></button>}
    {row.status !== "CANCELLED" && can("Disable") && <button className="dg-icon-btn dg-icon-btn--disable" disabled={busy} title="Cancel" aria-label="Cancel" onClick={() => perform(row, config.cancel)}><ActionIcon.Disable /></button>}
  </>;
  return <div className="i-container">
    <h2 className="i-title">🧾 SALES ORDER</h2>
    {detailState && ReactDOM.createPortal(<SalesView documentMode uKey={detailState.uKey} onClose={() => setDetail(null)} />, document.body)}
    {error && <div className="ops-error" role="alert">{error}<button onClick={() => setError("")}>Dismiss</button></div>}
    <DynamicGrid Module={config.title} ModuleId={String(config.id)} apiUrl={`${baseUrl}/${config.list}`} columns={columns} customActionsOnly customAddAction={() => setForm({})} customAddLabel={`Add ${config.singular}`} extraActions={actions} />
    {form && ReactDOM.createPortal(form.uKey
      ? <SalesEdit documentMode uKey={form.uKey} onClose={() => setForm(null)} onSubmit={() => { setForm(null); window.dispatchEvent(new Event("document-grid-refresh")); }} />
      : <SalesAdd documentMode onClose={() => setForm(null)} onSubmit={() => { setForm(null); window.dispatchEvent(new Event("document-grid-refresh")); }} />
    , document.body)}
    {detail && ReactDOM.createPortal(<div className="ops-backdrop" role="presentation" onMouseDown={e => e.target === e.currentTarget && setDetail(null)}><section className="ops-drawer" role="dialog" aria-modal="true"><header><div><span className="ops-eyebrow">DOCUMENT DETAILS</span><h2>{detail[config.number] || config.singular}</h2></div><button className="ops-close" onClick={() => setDetail(null)}>Ã—</button></header><div className="ops-detail-grid"><div><span>Party / source</span><strong>{detail[config.party] || detail.toGodownName || "â€”"}</strong></div><div><span>Status</span><strong>{detail.status || "â€”"}</strong></div><div><span>Date</span><strong>{detail[config.date] || "â€”"}</strong></div><div><span>Amount / units</span><strong>{detail.netAmount ?? detail.totalValue ?? detail.totalUnits ?? "â€”"}</strong></div></div><h3>Items</h3><div className="ops-item-list">{(detail.items || []).map((item, i) => <div key={item.id || i}><strong>{item.productName || `Product ${item.productId}`}</strong><span>{item.quantity} units</span></div>)}</div><footer><button className="ops-button ops-button-quiet" onClick={() => setDetail(null)}>Close</button></footer></section></div>, document.body)}
  </div>;
}

function DocumentForm({ config, row, onClose, onSaved }) {
  const stock = config.id === 38; const challan = config.id === 37;
  const [activeTab, setActiveTab] = useState("DETAILS");
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const [catalog, setCatalog] = useState({ suppliers: [], retailers: [], godowns: [], products: [], productTypes: [] });
  const [productTypeId, setProductTypeId] = useState("");
  const [productSearch, setProductSearch] = useState({});
  const [form, setForm] = useState(() => ({
    partyId: String(row.supplierId || row.retailerId || ""), godownId: String(row.godownId || row.fromGodownId || ""), toGodownId: String(row.toGodownId || ""),
    date: row[config.date] || new Date().toISOString().slice(0, 10), expectedDate: row.expectedDate || "", terms: row.terms || "", notes: row.notes || "",
    supplierInvoiceNumber: row.supplierInvoiceNumber || "", invoiceDate: row.invoiceDate || "", paymentStatus: row.paymentStatus || "CREDIT",
    billingMode: row.billingMode || "SIMPLE", paymentType: row.paymentType || "CREDIT", dueDate: row.dueDate || "", amountPaid: row.amountPaid ?? "", totalDiscount: row.totalDiscount ?? "", autoApplySchemes: row.autoApplySchemes !== false,
    purpose: row.purpose || "SALE_PENDING_INVOICE", vehicleNumber: row.vehicleNumber || "", transporter: row.transporter || "", salesOrderUKey: row.salesOrderUKey || "",
    items: (row.items || []).map(item => ({ productId: String(item.productId || ""), quantity: Number(item.quantity || 1), unitCost: item.unitCost ?? "", unitPrice: item.unitPrice ?? "", gstRate: Number(item.gstRate ?? 18), schemeId: item.schemeId ?? "" })),
  }));
  React.useEffect(() => {
    let alive = true;
    const getList = async url => {
      const response = await apiClient(url, { method: "GET" }); const json = await response.json();
      const data = json?.data;
      if (Array.isArray(data)) return data;
      if (data && typeof data === "object") return Object.values(data).find(Array.isArray) || [];
      return [];
    };
    Promise.all([
      getList(`${API_BASE_URL}/api/Supplier/GetSupplierDropdown`),
      getList(`${API_BASE_URL}/api/Retailer/Dropdown`),
      getList(`${API_BASE_URL}/api/Godown/GetGodownDropdown`),
      getList(`${API_BASE_URL}/api/Product/GetAllProduct`),
      getList(`${API_BASE_URL}/api/ProductType/GetAllProductType`),
    ]).then(([suppliers, retailers, godowns, products, productTypes]) => {
      if (alive) setCatalog({ suppliers, retailers, godowns, products, productTypes });
    }).catch(() => { if (alive) setError("Unable to load product and party options. Refresh and try again."); });
    return () => { alive = false; };
  }, []);
  const set = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const updateItem = (index, key, value) => setForm(prev => ({ ...prev, items: prev.items.map((item, i) => i === index ? { ...item, [key]: value } : item) }));
  const addItem = () => setForm(prev => ({ ...prev, items: [...prev.items, { productId: "", quantity: 1, unitCost: "", unitPrice: "", gstRate: 18, schemeId: "" }] }));
  const removeItem = index => setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  const chooseProduct = (index, productId) => {
    const product = catalog.products.find(p => String(p.id) === String(productId));
    setForm(prev => ({ ...prev, items: prev.items.map((item, i) => i !== index ? item : {
      ...item, productId, unitCost: item.unitCost || product?.price || product?.costPrice || "",
      unitPrice: item.unitPrice || product?.sellingPrice || product?.price || "",
    }) }));
  };
  const chosenList = stock ? [] : config.id === 35 ? catalog.suppliers : catalog.retailers;
  const partyLabel = p => p.shopName || p.supplierName || p.name || `#${p.id}`;
  const productName = p => p.name || p.productName || `Product #${p.id}`;
  const filteredProducts = catalog.products.filter(p => !productTypeId || String(p.productTypeId ?? p.typeId ?? "") === productTypeId);
  const submit = async e => {
    e.preventDefault(); setError("");
    if (!stock && !form.partyId) { setError(`Select a ${config.id === 35 ? "supplier" : "retailer"}.`); return; }
    if (!form.godownId || (stock && (!form.toGodownId || form.godownId === form.toGodownId))) { setError("Choose valid source and destination godowns."); return; }
    if (!form.items.length || form.items.some(item => !item.productId || Number(item.quantity) < 1)) { setError("Choose a product and enter a quantity for every line item."); return; }
    const items = buildDocumentItems(config.id, form.items);
    const body = buildDocumentPayload(config, form, items);
    if (items.some(item => (item.unitCost != null && (!Number.isFinite(item.unitCost) || item.unitCost < 0)))) { setError("Enter a valid non-negative cost for every purchase order item."); return; }
    try {
      setSaving(true);
      const edit = Boolean(row.uKey); const path = edit ? `${config.update}/${row.uKey}` : config.add;
      const response = await apiClient(`${API_BASE_URL}/api/${config.base}/${path}`, { method: edit ? "PUT" : "POST", body: JSON.stringify(body) });
      const result = await readResponse(response);
      if (!response.ok || (result?.status != null && result.status !== 200)) {
        throw new Error(result?.message || result?.error || `Unable to save document (${response.status})`);
      }
      onSaved();
    } catch (err) { setError(err.message || "Unable to save document"); } finally { setSaving(false); }
  };
  const godownName = g => g.name || g.godownName || `Godown #${g.id}`;
  return <div className="afx-backdrop ops-document-backdrop"><form className="afx-modal afx-modal--xl ops-document-form" role="dialog" aria-modal="true" onSubmit={submit}>
    <div className="afx-header"><div><div className="afx-eyebrow"><span className="afx-eyebrow-dot" />{row.uKey ? "Edit" : "New"} {config.singular}</div><h3 className="afx-title">{row.uKey ? `Edit ${config.singular}` : `Create ${config.singular}`}</h3></div><button className="afx-close" type="button" onClick={onClose}>Ã—</button></div>
    <div className="afx-tabs ops-document-tabs" role="tablist" aria-label={`${config.singular} sections`}>
      {[{ id: "DETAILS", label: "Details" }, { id: "ITEMS", label: `Items${form.items.length ? ` (${form.items.length})` : ""}` }].map(tab => <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} className={`afx-tab ${activeTab === tab.id ? "is-active" : ""}`} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
    </div>
    <div className="afx-body">{activeTab === "DETAILS" && <div className="afx-grid">
      {!stock && <div className="afx-field"><label className="afx-label">{config.id === 35 ? "Supplier" : "Retailer"}<span className="afx-req">*</span></label><select className="afx-select" name="partyId" value={form.partyId} onChange={set} required><option value="">Select {config.id === 35 ? "supplier" : "retailer"}</option>{chosenList.map(p => <option key={p.id} value={p.id}>{partyLabel(p)}</option>)}</select></div>}
      <div className="afx-field"><label className="afx-label">{stock ? "From godown" : "Godown"}<span className="afx-req">*</span></label><select className="afx-select" name="godownId" value={form.godownId} onChange={set} required><option value="">Select godown</option>{catalog.godowns.map(g => <option key={g.id} value={g.id}>{godownName(g)}</option>)}</select></div>
      {stock && <div className="afx-field"><label className="afx-label">To godown<span className="afx-req">*</span></label><select className="afx-select" name="toGodownId" value={form.toGodownId} onChange={set} required><option value="">Select destination</option>{catalog.godowns.filter(g => String(g.id) !== form.godownId).map(g => <option key={g.id} value={g.id}>{godownName(g)}</option>)}</select></div>}
      <div className="afx-field"><label className="afx-label">{challan ? "Challan date" : stock ? "Transfer date" : "Order date"}<span className="afx-req">*</span></label><input className="afx-input" type="date" name="date" required value={form.date} onChange={set} /></div>
      {(config.id === 35 || config.id === 36) && <div className="afx-field"><label className="afx-label">Expected date</label><input className="afx-input" type="date" name="expectedDate" value={form.expectedDate} onChange={set} /></div>}
      {config.id === 35 && <><div className="afx-field"><label className="afx-label">Supplier invoice number</label><input className="afx-input" name="supplierInvoiceNumber" value={form.supplierInvoiceNumber} onChange={set} /></div><div className="afx-field"><label className="afx-label">Invoice date</label><input className="afx-input" type="date" name="invoiceDate" value={form.invoiceDate} onChange={set} /></div><div className="afx-field"><label className="afx-label">Payment status</label><select className="afx-select" name="paymentStatus" value={form.paymentStatus} onChange={set}><option value="PAID">Paid</option><option value="CREDIT">Credit</option><option value="PARTIAL">Partial</option></select></div></>}
      {config.id === 36 && <><div className="afx-field"><label className="afx-label">Billing mode</label><select className="afx-select" name="billingMode" value={form.billingMode} onChange={set}><option value="SIMPLE">Simple</option><option value="MEDICAL">Medical</option><option value="ADVANCED">Advanced</option></select></div><div className="afx-field"><label className="afx-label">Payment type</label><select className="afx-select" name="paymentType" value={form.paymentType} onChange={set}><option value="PAID">Paid</option><option value="CREDIT">Credit</option><option value="PARTIAL">Partial</option></select></div><div className="afx-field"><label className="afx-label">Invoice discount</label><input className="afx-input" type="number" min="0" step="0.01" name="totalDiscount" value={form.totalDiscount} onChange={set} /></div><div className="afx-field"><label className="afx-label"><input type="checkbox" checked={form.autoApplySchemes} onChange={e => setForm(p => ({ ...p, autoApplySchemes: e.target.checked }))} /> Apply schemes automatically</label></div></>}
      {(config.id === 35 || config.id === 36) && (form.paymentStatus === "CREDIT" || form.paymentStatus === "PARTIAL" || form.paymentType === "CREDIT" || form.paymentType === "PARTIAL") && <div className="afx-field"><label className="afx-label">Due date</label><input className="afx-input" type="date" name="dueDate" value={form.dueDate} onChange={set} /></div>}
      {(config.id === 35 || config.id === 36) && <div className="afx-field"><label className="afx-label">Amount paid</label><input className="afx-input" type="number" min="0" step="0.01" name="amountPaid" value={form.amountPaid} onChange={set} /></div>}
      {challan && <><div className="afx-field"><label className="afx-label">Purpose</label><select className="afx-select" name="purpose" value={form.purpose} onChange={set}><option value="SALE_PENDING_INVOICE">Sale pending invoice</option><option value="SAMPLE">Sample</option><option value="APPROVAL">Approval</option></select></div><div className="afx-field"><label className="afx-label">Sales order key (optional)</label><input className="afx-input" name="salesOrderUKey" value={form.salesOrderUKey} onChange={set} placeholder="Link a confirmed sales order" /></div></>}
      {(challan || stock) && <div className="afx-field"><label className="afx-label">Vehicle number</label><input className="afx-input" name="vehicleNumber" value={form.vehicleNumber} onChange={set} /></div>}
      {challan && <div className="afx-field"><label className="afx-label">Transporter</label><input className="afx-input" name="transporter" value={form.transporter} onChange={set} /></div>}
      {(config.id === 35 || config.id === 36) && <div className="afx-field afx-field--full"><label className="afx-label">Terms</label><textarea className="afx-textarea" name="terms" value={form.terms} onChange={set} /></div>}
      <div className="afx-field afx-field--full"><label className="afx-label">Notes</label><textarea className="afx-textarea" name="notes" value={form.notes} onChange={set} /></div>
    </div>}
    {activeTab === "ITEMS" && <>
    <div className="ops-order-items-head"><div><h4>Items</h4><span>{form.items.length} line{form.items.length === 1 ? "" : "s"}</span></div><button type="button" className="afx-line-add" onClick={addItem}>+ Add item</button></div>
    {config.id === 36 && catalog.productTypes.length > 0 && <div className="afx-field ops-product-type"><label className="afx-label">Product type</label><select className="afx-select" value={productTypeId} onChange={e => setProductTypeId(e.target.value)}><option value="">All product types</option>{catalog.productTypes.map(type => <option key={type.id || type.productTypeId} value={type.id || type.productTypeId}>{type.name || type.productTypeName}</option>)}</select></div>}
    <div className="ops-order-items">{form.items.map((item, index) => <article className="ops-order-item" key={index}>
      <div className="ops-order-item-top"><strong>Item {index + 1}</strong><button type="button" className="afx-remove-btn" onClick={() => removeItem(index)}>Remove</button></div>
      <div className="ops-order-item-fields">
        <div className="afx-field ops-item-product"><label className="afx-label">Product<span className="afx-req">*</span></label><input className="afx-input" value={productSearch[index] || ""} onChange={e => setProductSearch(prev => ({ ...prev, [index]: e.target.value }))} placeholder="Search products" /><select className="afx-select" value={item.productId} onChange={e => chooseProduct(index, e.target.value)} required><option value="">Select product</option>{filteredProducts.filter(p => productName(p).toLowerCase().includes((productSearch[index] || "").toLowerCase())).map(p => <option key={p.id} value={p.id}>{productName(p)}</option>)}</select></div>
        <div className="afx-field"><label className="afx-label">Quantity<span className="afx-req">*</span></label><input className="afx-input" type="number" min="1" step="1" value={item.quantity} onChange={e => updateItem(index, "quantity", e.target.value)} required /></div>
        {config.id === 35 && <div className="afx-field"><label className="afx-label">Unit cost <span className="ops-optional">Optional</span></label><input className="afx-input" type="number" min="0" step="0.01" value={item.unitCost} onChange={e => updateItem(index, "unitCost", e.target.value)} placeholder="Enter cost if known" /></div>}
        {[36, 37].includes(config.id) && <div className="afx-field"><label className="afx-label">Unit price</label><input className="afx-input" type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => updateItem(index, "unitPrice", e.target.value)} placeholder="Use godown price" /></div>}
        {config.id === 36 && <div className="afx-field"><label className="afx-label">Scheme ID</label><input className="afx-input" type="number" min="1" value={item.schemeId} onChange={e => updateItem(index, "schemeId", e.target.value)} placeholder="Optional" /></div>}
        {[35, 36].includes(config.id) && <div className="afx-field"><label className="afx-label">GST rate %</label><select className="afx-select" value={item.gstRate} onChange={e => updateItem(index, "gstRate", e.target.value)}>{[0, 5, 12, 18, 28].map(rate => <option key={rate} value={rate}>{rate}%</option>)}</select></div>}
      </div>
    </article>)}{!form.items.length && <div className="ops-order-items-empty">No items yet. Use â€œAdd itemâ€ to select products.</div>}</div>
    </>}
    </div>
    {error && <div className="ops-error" role="alert">{error}</div>}
    <div className="afx-footer"><button type="button" className="afx-btn" onClick={onClose}>Cancel</button><button className="afx-btn afx-btn--primary" disabled={saving}>{saving ? "Savingâ€¦" : row.uKey ? "Save changes" : `Create ${config.singular}`}</button></div>
  </form></div>;
}

export async function readResponse(response) {
  const text = await response.text();
  if (!text || !text.trim()) return null;
  try { return JSON.parse(text); }
  catch { throw new Error(text.trim() || `Invalid server response (${response.status})`); }
}

export function buildDocumentPayload(config, form, items) {
  if (config.id === 35) return { supplierId: Number(form.partyId), godownId: Number(form.godownId), orderDate: form.date, expectedDate: form.expectedDate || null, terms: form.terms, notes: form.notes, ...(form.paymentStatus ? { supplierInvoiceNumber: form.supplierInvoiceNumber || null, invoiceDate: form.invoiceDate || null, paymentStatus: form.paymentStatus, dueDate: form.dueDate || null, amountPaid: Number(form.amountPaid || 0) } : {}), items };
  if (config.id === 36) return { retailerId: Number(form.partyId), godownId: Number(form.godownId), orderDate: form.date, expectedDate: form.expectedDate || null, terms: form.terms, notes: form.notes, ...(form.billingMode ? { billingMode: form.billingMode, paymentType: form.paymentType, dueDate: form.dueDate || null, amountPaid: Number(form.amountPaid || 0), totalDiscount: Number(form.totalDiscount || 0), autoApplySchemes: form.autoApplySchemes !== false } : {}), items };
  if (config.id === 37) return { retailerId: Number(form.partyId), godownId: Number(form.godownId), salesOrderUKey: form.salesOrderUKey || null, challanDate: form.date, purpose: form.purpose, vehicleNumber: form.vehicleNumber, transporter: form.transporter, notes: form.notes, items };
  return { fromGodownId: Number(form.godownId), toGodownId: Number(form.toGodownId), transferDate: form.date, vehicleNumber: form.vehicleNumber, notes: form.notes, items };
}

export function buildDocumentItems(moduleId, formItems) {
  return formItems.map(item => ({
    productId: Number(item.productId), quantity: Number(item.quantity),
    ...(moduleId === 35 ? { unitCost: item.unitCost === "" || item.unitCost == null ? null : Number(item.unitCost), gstRate: Number(item.gstRate || 0) } : {}),
    ...([36, 37].includes(moduleId) ? { unitPrice: item.unitPrice === "" ? null : Number(item.unitPrice), ...(moduleId === 36 ? { gstRate: Number(item.gstRate || 0), schemeId: item.schemeId === "" || item.schemeId == null ? null : Number(item.schemeId) } : {}) } : {}),
  }));
}

