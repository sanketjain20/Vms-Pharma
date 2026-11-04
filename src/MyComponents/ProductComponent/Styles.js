import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import "../../Styles/CommonAEUDForm/FormShell.css";
import "../../Styles/Inventory.css";
import "../../Styles/Product/Styles.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import { sortSizes, splitInput, findVariant } from "../../utils/variants";

// Phase 7 — styles that come in sizes and colours: edit a style's details, its selling price and each variant's own
// price, add sizes or colours, and see the stock of every size × colour (this godown or all godowns).

const json = (res) => res.json();
const money = (v) => (v == null || v === "" ? "—" : `₹${Number(v).toFixed(2)}`);

export default function Styles() {
  const [styles, setStyles] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // the style being looked at (full view from Get)
  const [allGodowns, setAllGodowns] = useState(true);
  const [types, setTypes] = useState([]);

  const loadList = useCallback(() => {
    setLoading(true);
    apiClient(`${API_BASE_URL}/api/ProductStyle/List${search ? `?search=${encodeURIComponent(search)}` : ""}`, { method: "GET" })
      .then(json)
      .then((j) => setStyles(j?.status === 200 && Array.isArray(j.data) ? j.data : []))
      .catch(() => setStyles([]))
      .finally(() => setLoading(false));
  }, [search]);

  const open = useCallback((uKey, everyGodown = allGodowns) => {
    apiClient(`${API_BASE_URL}/api/ProductStyle/Get/${uKey}?allGodowns=${everyGodown}`, { method: "GET" })
      .then(json)
      .then((j) => { if (j?.status === 200) setSelected(j.data); else toast.error(j?.message || "Could not open the style."); })
      .catch(() => {});
  }, [allGodowns]);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => {
    apiClient(`${API_BASE_URL}/api/ProductType/GetAllProductType`, { method: "GET" })
      .then(json)
      .then((j) => { const d = j?.data; setTypes(Array.isArray(d) ? d : Object.values(d || {}).find(Array.isArray) || []); })
      .catch(() => {});
  }, []);

  const afterChange = (j) => {
    if (j?.status === 200) {
      toast.success(j.message);
      if (selected) open(selected.uKey);
      loadList();
      return true;
    }
    toast.error(j?.message || "Could not save.");
    return false;
  };

  return (
    <div className="i-container">
      <h2 className="i-title">👕 STYLES — SIZES &amp; COLOURS</h2>
      <div className="sty-layout">
        <aside className="sty-list" aria-label="Styles">
          <input className="afx-input" placeholder="Search styles…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {loading ? <div className="srl-note">Loading…</div> : styles.length === 0 ? (
            <div className="srl-note">No styles yet. Create one from Products → Add Product → Sizes &amp; colours.</div>
          ) : styles.map((s) => (
            <button key={s.uKey} type="button" className={`sty-primary-item ${selected?.uKey === s.uKey ? "is-active" : ""}`}
              onClick={() => open(s.uKey)}>
              <strong>{s.name}</strong>
              <span>{(s.variants || []).length} variants · {s.totalStock} in stock</span>
            </button>
          ))}
        </aside>

        <section className="sty-detail">
          {!selected ? (
            <div className="srl-note">Pick a style to edit it and see its stock by size and colour.</div>
          ) : (
            <StyleDetail key={selected.uKey} style={selected} types={types} allGodowns={allGodowns}
              onGodowns={(v) => { setAllGodowns(v); open(selected.uKey, v); }} onChanged={afterChange} />
          )}
        </section>
      </div>
    </div>
  );
}

const send = (url, method, body) => apiClient(`${API_BASE_URL}${url}`, {
  method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
}).then(json);

export function StyleDetail({ style, types, allGodowns, onGodowns, onChanged }) {
  const [details, setDetails] = useState({ name: style.name || "", description: style.description || "", unit: style.unit || "",
    hsnCode: style.hsnCode || "", product_type_id: style.productTypeId ?? "" });
  const [price, setPrice] = useState(style.price ?? "");
  const [more, setMore] = useState({ sizes: "", colors: "" });
  const [editing, setEditing] = useState(null); // { id, value } — a variant's own price being typed

  const sizes = useMemo(() => sortSizes(style.sizes || []), [style.sizes]);
  const colors = style.colors?.length ? style.colors : [""];
  const rows = sizes.length ? sizes : [""];
  const variants = (style.variants || []).map((v) => ({ ...v, variantSize: v.size, variantColor: v.color }));
  const cell = (size, color) => findVariant(variants, size, color);
  const rowTotal = (size) => colors.reduce((t, c) => t + (cell(size, c)?.stock || 0), 0);
  const colTotal = (color) => rows.reduce((t, s) => t + (cell(s, color)?.stock || 0), 0);

  const saveDetails = async (e) => {
    e.preventDefault();
    if (!details.name.trim()) { toast.error("Enter the style's name."); return; }
    onChanged(await send(`/api/ProductStyle/Update/${style.uKey}`, "PUT", {
      ...details, product_type_id: details.product_type_id ? Number(details.product_type_id) : null,
    }));
  };
  const savePrice = async () => onChanged(await send(`/api/ProductStyle/Price/${style.uKey}`, "PUT", { price }));
  const saveVariantPrice = async (id, value) => {
    if (await onChanged(await send(`/api/ProductStyle/VariantPrice/${id}`, "PUT", { price: value === "" ? null : value }))) setEditing(null);
  };
  const addMore = async () => {
    const body = { sizes: splitInput(more.sizes), colors: splitInput(more.colors) };
    if (!body.sizes.length && !body.colors.length) { toast.error("Type the new sizes or colours."); return; }
    if (onChanged(await send(`/api/ProductStyle/AddVariants/${style.uKey}`, "POST", body))) setMore({ sizes: "", colors: "" });
  };

  return (
    <div data-testid="style-detail">
      <h3 className="afx-title" style={{ marginBottom: 8 }}>{style.name} <span className="srl-note">{style.styleCode}</span></h3>

      <form className="afx-grid sty-card" onSubmit={saveDetails} aria-label="Style details">
        <div className="afx-field">
          <label className="afx-label" htmlFor="sty-name">Name</label>
          <input id="sty-name" className="afx-input" value={details.name} onChange={(e) => setDetails((d) => ({ ...d, name: e.target.value }))} />
        </div>
        <div className="afx-field">
          <label className="afx-label" htmlFor="sty-type">Product type</label>
          <select id="sty-type" className="afx-select" value={details.product_type_id} onChange={(e) => setDetails((d) => ({ ...d, product_type_id: e.target.value }))}>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name || t.typeName}</option>)}
          </select>
        </div>
        <div className="afx-field">
          <label className="afx-label" htmlFor="sty-unit">Unit</label>
          <input id="sty-unit" className="afx-input" value={details.unit} onChange={(e) => setDetails((d) => ({ ...d, unit: e.target.value }))} />
        </div>
        <div className="afx-field">
          <label className="afx-label" htmlFor="sty-hsn">HSN code</label>
          <input id="sty-hsn" className="afx-input" value={details.hsnCode} onChange={(e) => setDetails((d) => ({ ...d, hsnCode: e.target.value }))} />
        </div>
        <div className="afx-field afx-field--full">
          <label className="afx-label" htmlFor="sty-desc">Description</label>
          <input id="sty-desc" className="afx-input" value={details.description} onChange={(e) => setDetails((d) => ({ ...d, description: e.target.value }))} />
        </div>
        <div className="afx-field afx-field--full">
          <button type="submit" className="afx-btn afx-btn--primary">Save details (all variants)</button>
        </div>
      </form>

      <div className="sty-card sty-row">
        <label className="afx-label" htmlFor="sty-price">Style selling price (₹)</label>
        <input id="sty-price" className="afx-input" type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} style={{ maxWidth: 140 }} />
        <button type="button" className="afx-btn afx-btn--primary" onClick={savePrice}>Save price</button>
        <span className="srl-note">Sizes/colours without their own price follow it.</span>
      </div>

      <div className="sty-card">
        <div className="sty-row" style={{ justifyContent: "space-between" }}>
          <strong>Stock by size and colour</strong>
          <label className="afx-checkbox-label" style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={allGodowns} onChange={(e) => onGodowns(e.target.checked)} data-testid="all-godowns" />
            <span>All godowns</span>
          </label>
        </div>
        <div className="afx-line-table" style={{ overflowX: "auto" }}>
          <table data-testid="stock-matrix">
            <thead>
              <tr><th>Size \ Colour</th>{colors.map((c) => <th key={c || "-"}>{c || "—"}</th>)}<th>Total</th></tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s || "-"}>
                  <th scope="row">{s || "—"}</th>
                  {colors.map((c) => {
                    const v = cell(s, c);
                    if (!v) return <td key={c || "-"} className="srl-note">—</td>;
                    return (
                      <td key={c || "-"} data-testid={`cell-${s}-${c}`}>
                        <strong>{v.stock}</strong>
                        <div className="sty-price">
                          {editing?.id === v.id ? (
                            <span className="sty-row">
                              <input className="afx-input" type="number" min="0" aria-label={`Own price of ${v.name}`} value={editing.value}
                                onChange={(e) => setEditing({ id: v.id, value: e.target.value })} style={{ width: 90 }} />
                              <button type="button" className="afx-btn afx-btn--primary" onClick={() => saveVariantPrice(v.id, editing.value)}>Save</button>
                            </span>
                          ) : (
                            <button type="button" className="sty-primary-link" title="Set this size/colour's own price (empty = follow the style)"
                              onClick={() => setEditing({ id: v.id, value: v.ownPrice ?? "" })}>
                              {money(v.price)}{v.ownPrice != null ? " (own)" : ""}
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td><strong>{rowTotal(s)}</strong></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><th>Total</th>{colors.map((c) => <td key={c || "-"}><strong>{colTotal(c)}</strong></td>)}
                <td data-testid="stock-total"><strong>{style.totalStock}</strong></td></tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="sty-card sty-row">
        <input className="afx-input" placeholder="New sizes, e.g. XL, XXL" aria-label="New sizes" value={more.sizes}
          onChange={(e) => setMore((m) => ({ ...m, sizes: e.target.value }))} />
        <input className="afx-input" placeholder="New colours, e.g. Green" aria-label="New colours" value={more.colors}
          onChange={(e) => setMore((m) => ({ ...m, colors: e.target.value }))} />
        <button type="button" className="afx-btn afx-btn--primary" onClick={addMore}>Add sizes / colours</button>
      </div>
    </div>
  );
}
