import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import "../../Styles/CommonAEUDForm/FormShell.css";
import { toastApiError } from "../../utils/toastMessage";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import { createPortal } from "react-dom";
import { calculateTcsPreview, partyHasPan } from "../../utils/taxPreview";
import {
  computeTotals, toItemPayload, fetchApplicable, withScheme, removeScheme, freeText, round2,
} from "../../utils/salesSchemes";

/* ─────────────────────────────────────────
   PRODUCT AVATAR — deterministic color + initials, no image needed
   (same helper as SalesAddNew.js, duplicated locally like SearchDrop is
   across the Purchase files — small, pure, no shared-module needed)
───────────────────────────────────────── */
function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}
function productInitials(name) {
  const parts = String(name || "?").trim().split(/\s+/).slice(0, 2);
  const s = parts.map(p => p[0]).join("").toUpperCase();
  return s || "?";
}
function productHue(name) {
  return hashString(String(name || "")) % 360;
}

/* ─────────────────────────────────────────
   SEARCHABLE DROPDOWN — portal-positioned so it floats above the modal's
   own scroll container instead of being clipped by it.
───────────────────────────────────────── */
const SearchableDropdown = ({
  label, options, selectedId, onSelect,
  search, setSearch, open, setOpen,
  placeholder, dropdownRef, error
}) => {
  const [coords, setCoords] = useState(null);
  const selectedOption = options.find(o => String(o.id) === String(selectedId));
  const displayValue = open ? search : (selectedOption?.name ?? "");
  const filtered = options.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase())
  );

  const updateCoords = () => {
    const rect = dropdownRef.current?.getBoundingClientRect();
    if (!rect) return;
    const listHeight = 200;
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropUp = spaceBelow < listHeight && rect.top > spaceBelow;
    setCoords({
      left: rect.left,
      width: rect.width,
      top: dropUp ? undefined : rect.bottom + 5,
      bottom: dropUp ? window.innerHeight - rect.top + 5 : undefined,
    });
  };

  const handleOpen = (e) => {
    e.stopPropagation();
    if (!open) setSearch("");
    updateCoords();
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    updateCoords();
    const handler = () => updateCoords();
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div className="afx-field" ref={dropdownRef}>
      <label className="afx-label">{label}</label>
      <div className="afx-searchdrop">
        <div className={`afx-searchdrop-face ${open ? "is-open" : ""} ${selectedOption ? "is-filled" : ""}`} onClick={handleOpen}>
          <input
            type="text" value={displayValue} placeholder={placeholder}
            onChange={e => setSearch(e.target.value)} onClick={handleOpen}
            style={{ background: "transparent", border: "none", outline: "none", color: "inherit", font: "inherit", width: "100%" }}
          />
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0 }}><path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        {open && coords && createPortal(
          <div
            className="afx-searchdrop-panel"
            style={{ position: "fixed", left: coords.left, width: coords.width, top: coords.top, bottom: coords.bottom }}
          >
            <div className="afx-searchdrop-list">
              {filtered.length === 0 ? (
                <div className="afx-searchdrop-empty">No results found</div>
              ) : filtered.map(o => (
                <div key={o.id}
                  className={`afx-searchdrop-item ${String(o.id) === String(selectedId) ? "is-selected" : ""}`}
                  onMouseDown={e => { e.preventDefault(); onSelect(o.id); setOpen(false); setSearch(""); }}
                >{o.name}</div>
              ))}
            </div>
          </div>,
          document.body
        )}
      </div>
      {error && <div className="afx-error">{error}</div>}
    </div>
  );
};

const GST_RATES = [0, 5, 12, 18, 28];

const PAYMENT_ICONS = {
  PAID:    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5l3 3 7-7"/></svg>,
  CREDIT:  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="8" cy="8" r="6.2"/><path d="M8 4.5V8l2.6 1.6"/></svg>,
  PARTIAL: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="8" cy="8" r="6.2"/><path d="M8 1.8A6.2 6.2 0 018 14.2" fill="currentColor" stroke="none"/></svg>,
};
const PAYMENT_TYPES = [
  { id: "PAID",    label: "Full Payment",        sub: "Pay the net amount now" },
  { id: "CREDIT",  label: "Credit (Pay Later)",  sub: "Pay later, on account" },
  { id: "PARTIAL", label: "Partial Payment",     sub: "Pay part now, rest later" },
];

export default function SalesAdd({ onClose, onSubmit, documentMode = false }) {
  // ── State ─────────────────────────────────────────────────────────────────
  const [productTypes, setProductTypes]       = useState([]);
  const [products, setProducts]               = useState([]);
  const [inventory, setInventory]             = useState(null);
  const [selectedType, setSelectedType]       = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity]               = useState("");
  const [taxInput, setTaxInput]               = useState("");
  const [taxType, setTaxType]                 = useState("PERCENT");
  const [lineItems, setLineItems]             = useState([]);
  const [editIndex, setEditIndex]             = useState(null);
  const [discountInput, setDiscountInput]     = useState("");
  const [discountType, setDiscountType]       = useState("PERCENT");
  const [billingMode, setBillingMode]         = useState("CASH");
  const [commonTax, setCommonTax]             = useState("18");
  const [taxMode, setTaxMode]                 = useState("COMMON");
  const [errors, setErrors]                   = useState({});
  const [activeTab, setActiveTab]             = useState("Tax");
  const [viewMode, setViewMode]               = useState("tabs"); // "tabs" | "all"
  const [amountPaid, setAmountPaid]           = useState("");
  const [allProducts, setAllProducts]         = useState([]);
  const lastLoadedType                        = useRef(null);
  const [typeSearch, setTypeSearch]           = useState("");
  const [productSearch, setProductSearch]     = useState("");
  const [typeDropdownOpen, setTypeDropdownOpen]       = useState(false);
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const typeDropdownRef    = useRef(null);
  const productDropdownRef = useRef(null);
  const [scanValue, setScanValue] = useState("");
  const scanRef = useRef(null);

  // ── Schemes: each line gets the best matching scheme suggested; the clerk can remove it ──
  const lineKeyRef = useRef(0);
  const lineItemsRef = useRef([]);
  const [schemePending, setSchemePending] = useState(0);

  // ── Pharma fields ─────────────────────────────────────────────────────────
  const [retailers, setRetailers]                     = useState([]);
  const [selectedRetailer, setSelectedRetailer]       = useState("");
  const [retailerSearch, setRetailerSearch]           = useState("");
  const [retailerDropdownOpen, setRetailerDropdownOpen] = useState(false);
  const retailerDropdownRef = useRef(null);
  const [creditPaymentType, setCreditPaymentType]     = useState("PAID");
  const [dueDate, setDueDate]                         = useState("");
  const [availableBatches, setAvailableBatches]       = useState([]);
  const [selectedBatchId, setSelectedBatchId]         = useState("");
  const [batchesLoading, setBatchesLoading]           = useState(false);

  /* ── TCS preview (see Utils/tcsPreview.js) ──
     Best-effort only — the backend is the source of truth at submit time.
     Silently stays "not enabled" if the current role lacks TCS View
     permission or any of these calls fail; sale creation itself was never
     permission-gated, only this preview is. */
  const [tcsSetting, setTcsSetting]                   = useState(null);
  const [retailerTaxInfo, setRetailerTaxInfo]         = useState(null);
  const [retailerTurnover, setRetailerTurnover]       = useState(null);

  /* ── FETCH RETAILERS ── */
  useEffect(() => {
    apiClient(`${API_BASE_URL}/api/Retailer/Dropdown`, {
      method: "GET", headers: { "Content-Type": "application/json" },
    })
      .then(r => r.json())
      .then(json => setRetailers(
        (json?.data ?? []).map(r => ({ id: r.id, uKey: r.uKey, name: r.shopName + " · " + r.ownerName }))
      ))
      .catch(() => {});
  }, []);

  /* ── FETCH VENDOR'S TCS SETTING (once) ── */
  useEffect(() => {
    apiClient(`${API_BASE_URL}/api/TcsSetting/Get`, { method: "GET" })
      .then(r => r.json())
      .then(json => setTcsSetting(json?.status === 200 ? json.data : null))
      .catch(() => setTcsSetting(null));
  }, []);

  /* ── FETCH SELECTED RETAILER'S PAN/GSTIN + FY TURNOVER, for the TCS preview ── */
  useEffect(() => {
    setRetailerTaxInfo(null);
    setRetailerTurnover(null);
    const retailer = retailers.find(r => String(r.id) === String(selectedRetailer));
    if (!retailer?.uKey || !tcsSetting?.enabled) return;

    apiClient(`${API_BASE_URL}/api/Retailer/Get/${retailer.uKey}`, { method: "GET" })
      .then(r => r.json())
      .then(json => setRetailerTaxInfo(json?.status === 200 ? json.data : null))
      .catch(() => setRetailerTaxInfo(null));

    apiClient(`${API_BASE_URL}/api/TcsSetting/GetPartyTurnover/${retailer.uKey}`, { method: "GET" })
      .then(r => r.json())
      .then(json => setRetailerTurnover(json?.status === 200 ? json.data : null))
      .catch(() => setRetailerTurnover(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRetailer, tcsSetting?.enabled]);

  /* ── FETCH PRODUCT TYPES ── */
  useEffect(() => {
    apiClient(`${API_BASE_URL}/api/ProductType/GetAllProductType`, {
      method: "GET", headers: { "Content-Type": "application/json" },
    })
      .then(r => r.json())
      .then(json => {
        const list = json?.data?.productTypes ?? [];
        setProductTypes(Array.isArray(list) ? list : []);
      })
      .catch(() => {});
  }, []);

  /* ── FETCH ALL PRODUCTS ── */
  useEffect(() => {
    apiClient(`${API_BASE_URL}/api/Product/GetAllProduct`, {
      method: "GET", headers: { "Content-Type": "application/json" },
    })
      .then(r => r.json())
      .then(json => {
        const dataObj = json?.data;
        const list = Array.isArray(dataObj)
          ? dataObj
          : typeof dataObj === "object"
            ? Object.values(dataObj).find(v => Array.isArray(v)) || []
            : [];
        setAllProducts(list);
        setProducts(list);
      })
      .catch(() => { setAllProducts([]); setProducts([]); });
  }, []);

  /* ── FETCH BATCHES — only show warning AFTER response ── */
  useEffect(() => {
    if (!selectedProduct) {
      setAvailableBatches([]);
      setSelectedBatchId("");
      setBatchesLoading(false);
      return;
    }
    setBatchesLoading(true);
    setAvailableBatches([]);
    apiClient(`${API_BASE_URL}/api/Sales/GetAvailableBatches/${selectedProduct}`, {
      method: "GET",
    })
      .then(r => r.json())
      .then(json => {
        if (json?.status === 200) setAvailableBatches(json.data ?? []);
        else setAvailableBatches([]);
      })
      .catch(() => setAvailableBatches([]))
      .finally(() => setBatchesLoading(false));
  }, [selectedProduct]);

  /* ── HANDLERS ── */
  const handleTypeChange = (e) => {
    const id = e.target.value;
    setSelectedType(id);
    setSelectedProduct("");
    setInventory(null);
    setProducts([]);
    setTaxInput("");
    setErrors({});
    setAvailableBatches([]);
    setSelectedBatchId("");
    setBatchesLoading(false);
    // Product Type is an optional filter, not a required step — clearing it
    // (the "All" chip) should show every product again, not leave the list
    // empty until another type is picked.
    if (!id) { setProducts(allProducts); return; }
    apiClient(`${API_BASE_URL}/api/Product/GetProdByProdId/${id}`, { method: "GET" })
      .then(r => r.json())
      .then(json => { const list = json?.data ?? []; setProducts(Array.isArray(list) ? list : []); })
      .catch(() => {});
  };

  const handleProductChange = (e) => {
    const id = e.target.value;
    setSelectedProduct(id);
    setTaxInput("");
    setErrors({});
    setAvailableBatches([]);
    setSelectedBatchId("");
    setBatchesLoading(false);
    if (!id) return;
    apiClient(`${API_BASE_URL}/api/Inventory/GetInventoryByProdId/${id}`, { method: "GET" })
      .then(r => r.json())
      .then(json => { if (json.status === 200) setInventory(json.data); else setInventory(null); })
      .catch(() => {});
  };

  /* ── AUTO SET TYPE ── */
  useEffect(() => {
    if (!selectedProduct) return;
    apiClient(`${API_BASE_URL}/api/ProductType/GetProdTypeByProductId/${selectedProduct}`)
      .then(r => r.json())
      .then(json => {
        const typeId = json?.data?.productTypeId || json?.data?.id;
        if (typeId && typeId !== selectedType) {
          setSelectedType(typeId);
          if (lastLoadedType.current !== typeId) {
            lastLoadedType.current = typeId;
            apiClient(`${API_BASE_URL}/api/Product/GetProdByProdId/${typeId}`)
              .then(r => r.json())
              .then(json => { const list = json?.data ?? []; setProducts(Array.isArray(list) ? list : []); })
              .catch(() => {});
          }
        }
      })
      .catch(() => {});
  }, [selectedProduct]);

  /* ── CLICK OUTSIDE ── */
  useEffect(() => {
    const handler = (e) => {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target))       { setTypeDropdownOpen(false); setTypeSearch(""); }
      if (productDropdownRef.current && !productDropdownRef.current.contains(e.target)) { setProductDropdownOpen(false); setProductSearch(""); }
      if (retailerDropdownRef.current && !retailerDropdownRef.current.contains(e.target)) { setRetailerDropdownOpen(false); setRetailerSearch(""); }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const safeJson = async (res) => { try { return await res.json(); } catch { return null; } };

  /* ── CLEAR PRODUCT FORM ── */
  const clearProductForm = () => {
    setSelectedType("");
    setSelectedProduct("");
    setProducts(allProducts);
    setInventory(null);
    setQuantity("");
    setTaxInput("");
    setAvailableBatches([]);
    setSelectedBatchId("");
    setBatchesLoading(false);
    setEditIndex(null);
    setErrors({});
    setTypeSearch("");
    setProductSearch("");
  };

  /* ── Stock helpers for the currently-selected product's inventory ── */
  const outOfStock = !!inventory && inventory.currentQuantity <= 0;
  const lowStock    = !!inventory && inventory.currentQuantity > 0 && inventory.currentQuantity <= 10;
  const noPriceConfigured = !!selectedProduct && !batchesLoading && !inventory;

  /* ── QUANTITY STEPPER ── */
  const stepQuantity = (delta) => {
    const next = (parseInt(quantity) || 0) + delta;
    if (next < 1) return;
    if (inventory && next > inventory.currentQuantity) { toast.error("Exceeds available stock"); return; }
    setQuantity(String(next));
  };

  /* ── SCHEME SUGGESTION ──
     Asks the server which scheme fits a line and attaches it. Runs after the line is already on screen, so adding an
     item never waits on it; a result is dropped if the line was changed or removed in the meantime. The server
     checks the scheme again on save, so a missed suggestion is harmless. */
  const suggestScheme = async (line, retailerId) => {
    setSchemePending(n => n + 1);
    const applicable = await fetchApplicable({
      productId: line.productId, retailerId, quantity: line.quantity, unitPrice: line.sellingPrice,
    });
    setSchemePending(n => n - 1);
    setLineItems(prev => prev.map(l =>
      l.lineKey === line.lineKey && !l.schemeOff && l.quantity === line.quantity && l.sellingPrice === line.sellingPrice
        ? withScheme(l, applicable)
        : l
    ));
  };

  useEffect(() => { lineItemsRef.current = lineItems; }, [lineItems]);

  /* A different retailer can mean a different scheme (retailer-specific ones), so look again for every line. */
  useEffect(() => {
    lineItemsRef.current.filter(l => !l.schemeOff).forEach(l => suggestScheme(l, selectedRetailer || null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRetailer]);

  const dropScheme = (i) => setLineItems(prev => prev.map((l, idx) => (idx === i ? removeScheme(l) : l)));
  const retryScheme = (i) => {
    const l = { ...lineItems[i], schemeOff: false };
    setLineItems(prev => prev.map((x, idx) => (idx === i ? l : x)));
    suggestScheme(l, selectedRetailer || null);
  };

  /* ── ADD ITEM ── */
  const addItem = () => {
    let tempErrors = {};
    if (!selectedProduct)   tempErrors.selectedProduct = "Select product";

    // Selling price always comes from inventory/product configuration —
    // there is no manual/adhoc price entry.
    if (selectedProduct && !inventory) {
      tempErrors.selectedProduct = "Selling price is not configured for this product";
    } else if (inventory && inventory.currentQuantity <= 0) {
      tempErrors.selectedProduct = "This product is out of stock";
    }

    if (!quantity || quantity <= 0) {
      tempErrors.quantity = "Enter valid quantity";
    } else if (inventory && parseInt(quantity) > inventory.currentQuantity) {
      tempErrors.quantity = "Exceeds available stock";
    }

    const price = inventory ? inventory.unitSellingPrice : 0;
    const taxValue = taxMode === "COMMON" ? parseFloat(commonTax || 0) : parseFloat(taxInput || 0);
    if (taxValue < 0)                                     tempErrors.taxInput       = "Tax cannot be negative";
    setErrors(tempErrors);
    if (Object.keys(tempErrors).length > 0) {
      toast.error(Object.values(tempErrors)[0]);
      return;
    }

    const product   = products.find(p => p.id === parseInt(selectedProduct));
    const taxAmount = taxType === "PERCENT" ? (price * quantity * taxValue) / 100 : taxValue;

    const item = {
      lineKey: editIndex !== null ? lineItems[editIndex].lineKey : ++lineKeyRef.current,
      schemeOff: editIndex !== null ? !!lineItems[editIndex].schemeOff : false,
      schemeId: null, schemeName: "", schemeDescription: "", freeQuantity: 0, schemeDiscount: 0,
      productId:   parseInt(selectedProduct),
      productName: product?.name || "",
      quantity:    parseInt(quantity),
      sellingPrice: price,
      taxAmount,
      gstRate: taxMode === "COMMON" ? parseFloat(commonTax || 0) : parseFloat(taxInput || 0),
      batchId: selectedBatchId ? parseInt(selectedBatchId) : null,
      batchNumber: selectedBatchId
        ? availableBatches.find(b => String(b.batchId) === String(selectedBatchId))?.batchNumber || ""
        : "AUTO",
      expiryDate: selectedBatchId
        ? availableBatches.find(b => String(b.batchId) === String(selectedBatchId))?.expiryDate || ""
        : "",
    };

    const updated = [...lineItems];
    if (editIndex !== null) { updated[editIndex] = item; setEditIndex(null); }
    else updated.push(item);

    setLineItems(updated);
    clearProductForm();
    if (!item.schemeOff) suggestScheme(item, selectedRetailer || null);
  };

  const deleteItem = (i) => { const u = [...lineItems]; u.splice(i, 1); setLineItems(u); };

  /* ── BARCODE SCAN-TO-SELECT ──
     A USB/Bluetooth barcode scanner behaves like a keyboard — it types the
     code then fires Enter, which the scan input below submits on. Matches
     the already-loaded product list first, falling back to a live lookup
     for a product added since this form opened. Scanning only SELECTS the
     product type + product (same as picking them from the dropdowns) and
     loads its inventory/batches — it deliberately does not set a quantity
     or add a line item. Quantity is always a manual choice by the user,
     who then clicks "+ Add Item" themselves. */
  const handleBarcodeScan = async (rawCode) => {
    const code = rawCode.trim();
    if (!code) return;

    let product = allProducts.find(p => p.barcode === code);

    if (!product) {
      try {
        const res  = await apiClient(`${API_BASE_URL}/api/Product/GetProductByBarcode/${encodeURIComponent(code)}`, { method: "GET" });
        const json = await safeJson(res);
        if (json?.status === 200 && json?.data) {
          product = json.data;
          setAllProducts(prev => prev.some(p => p.id === product.id) ? prev : [...prev, product]);
        }
      } catch {
        toast.error("Barcode lookup failed");
        return;
      }
    }

    if (!product) {
      toast.error(`No product found for barcode "${code}"`);
      return;
    }

    // handleTypeChange resets `products` to [] and kicks off its own fetch
    // for the type's product list — called first so our merge below (which
    // guarantees the scanned product is in that list immediately, without
    // waiting on the network) isn't clobbered by it.
    handleTypeChange({ target: { value: product.productTypeId ?? "" } });
    setProducts(prev => prev.some(p => p.id === product.id) ? prev : [...prev, product]);
    handleProductChange({ target: { value: product.id } });
    setQuantity("");

    toast.success(`${product.name} selected — enter quantity and Add Item`);
  };

  const editItem = async (index) => {
    const it = lineItems[index];
    setEditIndex(index);
    setSelectedProduct(it.productId);
    setQuantity(it.quantity);
    setTaxInput(it.taxAmount);
    setSelectedBatchId(it.batchId || "");
    setErrors({});
    try {
      const pRes  = await apiClient(`${API_BASE_URL}/api/Product/GetProductById/${it.productId}`, { method: "GET" });
      const pJson = await safeJson(pRes);
      if (pJson?.data) {
        const typeId = pJson.data.productTypeId;
        setSelectedType(typeId);
        lastLoadedType.current = typeId;
        const lRes  = await apiClient(`${API_BASE_URL}/api/Product/GetProdByProdId/${typeId}`, { method: "GET" });
        const lJson = await safeJson(lRes);
        if (Array.isArray(lJson?.data)) setProducts(lJson.data);
        const iRes  = await apiClient(`${API_BASE_URL}/api/Inventory/GetInventoryByProdId/${it.productId}`, { method: "GET" });
        const iJson = await safeJson(iRes);
        if (iJson?.status === 200) setInventory(iJson.data);
      }
    } catch {
      // backend unreachable — global toast already covers it; the line
      // item's own fields (set above) still populate the edit fields.
    }
  };

  /* ── TOTALS ──
     One calculation (utils/salesSchemes.js) that mirrors the server: scheme discount first, then the invoice
     discount on what is left, GST on the discounted value. With no scheme and no discount it is the same sum as before. */
  const totals = computeTotals({
    lines: lineItems,
    manualDiscount: discountInput,
    discountType,
    commonRate: taxMode === "COMMON" && taxType === "PERCENT" ? parseFloat(commonTax || 0) : null,
  });
  const lineTotal    = totals.gross;
  const lineTaxTotal = round2(totals.lines.reduce((s, r) => s + r.clientTax, 0));
  const totalAmount  = lineTotal + lineTaxTotal;

  const schemeDiscAmt   = totals.schemeDiscount;
  const discAmt         = totals.manualDiscount;
  const discountedTotal = totals.taxable;   // Taxable Value
  const gstAmount       = totals.tax;
  const netAmount       = totals.net;

  // TCS is only ever charged against a retailer (SalesCommonRepository skips
  // it entirely for a walk-in sale), matching the backend condition exactly.
  const tcsPreview = (selectedRetailer && tcsSetting?.enabled)
    ? calculateTcsPreview({
        cumulativeBefore: retailerTurnover?.cumulativeConsideration || 0,
        consideration: netAmount,
        threshold: tcsSetting.thresholdAmount,
        ratePercent: tcsSetting.ratePercent,
        ratePercentWithoutPan: tcsSetting.ratePercentWithoutPan,
        hasPan: partyHasPan(retailerTaxInfo?.pan, retailerTaxInfo?.gstNumber),
      })
    : { taxable: 0, rate: 0, tcs: 0 };
  const payableAmount = round2(netAmount + tcsPreview.tcs);

  useEffect(() => {
    if (creditPaymentType === "PAID") setAmountPaid(payableAmount.toFixed(2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creditPaymentType, payableAmount]);

  /* ── SUBMIT ── */
  const submitSales = async () => {
    let tempErrors = {};
    if (lineItems.length === 0)                          tempErrors.lineItems    = "Add at least one item";
    if (creditPaymentType !== "CREDIT" && !billingMode)  tempErrors.billingMode  = "Select billing mode";
    if (discountInput < 0)                               tempErrors.discountInput = "Discount cannot be negative";
    if (totals.discountTooLarge)                         tempErrors.discountInput = "Discount cannot be more than the value of the goods after schemes";
    if (creditPaymentType === "PAID" && parseFloat(amountPaid) !== payableAmount)
      tempErrors.amountPaid = "Amount must be equal to the payable amount";
    if (creditPaymentType === "PARTIAL") {
      if (!amountPaid || amountPaid <= 0)               tempErrors.amountPaid = "Enter valid amount paid";
      else if (parseFloat(amountPaid) >= payableAmount) tempErrors.amountPaid = "Partial payment must be less than total";
    }
    if (creditPaymentType === "CREDIT" && parseFloat(amountPaid) !== 0)
      tempErrors.amountPaid = "Amount paid must be 0 for credit";
    if (creditPaymentType === "CREDIT" && !dueDate)     tempErrors.dueDate = "Due date is required for credit";
    if (creditPaymentType === "PARTIAL" && !dueDate)    tempErrors.dueDate = "Due date is required for partial payment";
    setErrors(tempErrors);
    if (Object.keys(tempErrors).length > 0) return;

    if (schemePending > 0) {
      toast.info("Still checking schemes — try again in a moment");
      return;
    }

    try {
      const orderPayload = {
        retailerId: selectedRetailer ? parseInt(selectedRetailer) : null,
        godownId: Number(localStorage.getItem("activeGodownId") || 0) || null,
        orderDate: new Date().toISOString().slice(0, 10), expectedDate: null, terms: "", notes: "",
        billingMode, paymentType: creditPaymentType, dueDate: dueDate || null,
        amountPaid: parseFloat(amountPaid || 0), totalDiscount: totals.manualDiscount,
        autoApplySchemes: true,
        items: lineItems.map(item => ({ productId: item.productId, quantity: item.quantity,
          unitPrice: Number(item.sellingPrice || 0), gstRate: Number(item.gstRate || 0), schemeId: item.schemeId || null })),
      };
      const response = await apiClient(`${API_BASE_URL}/api/${documentMode ? "SalesOrder/AddSalesOrder" : "Sales/AddSales"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(documentMode ? orderPayload : {
          billingMode,
          totalDiscount: totals.manualDiscount, // what the clerk gave; the server adds the schemes' discount itself
          amountPaid: parseFloat(amountPaid),
          remainingAmount: parseFloat((payableAmount - amountPaid).toFixed(2)),
          retailerId: selectedRetailer ? parseInt(selectedRetailer) : null,
          paymentType: creditPaymentType,
          dueDate: dueDate || null,
          items: toItemPayload(lineItems, totals),
        }),
      });
      const result = await safeJson(response);
      if (response.ok && result?.status === 200) {
        toast.success(result?.message || (documentMode ? "Sales order added successfully" : "Sale added successfully"));
        onSubmit();
        onClose();
      } else {
        toastApiError(result, "Failed to add sale");
      }
    } catch (err) {
      toast.error(err?.message || "Network error. Please try again.");
    }
  };

  /* ── RENDER ──
     Two views over the same three section fragments: "tabs" (default — one
     section on screen at a time, tab bar controls which) and "all" (every
     section rendered as its own titled panel, stacked top to bottom — the
     same pattern the dashboard uses to lay out its widgets, not a side-by-
     side split). Each fragment is built once and reused by whichever view
     is active, so the two can never drift apart. */
  const taxSection = (
    <div className="afx-field">
      <label className="afx-label">GST Mode</label>
      <div className="afx-seg-row">
        <button type="button" className={`afx-seg-btn ${taxMode === "COMMON" ? "is-active" : ""}`} onClick={() => setTaxMode("COMMON")}>Common GST</button>
        <button type="button" className={`afx-seg-btn ${taxMode === "PRODUCT" ? "is-active" : ""}`} onClick={() => setTaxMode("PRODUCT")}>Product-wise GST</button>
      </div>
      {taxMode === "COMMON" ? (
        <div className="afx-select-wrap" style={{ marginTop: 8 }}>
          <select className="afx-select" value={commonTax} onChange={e => setCommonTax(e.target.value)}>
            {GST_RATES.map(r => (
              <option key={r} value={r}>
                {r}% GST{r === 18 ? " (Standard)" : r === 0 ? " (Exempt)" : ""}
              </option>
            ))}
          </select>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      ) : (
        <div className="afx-select-wrap" style={{ marginTop: 8 }}>
          <select className="afx-select" value={taxType} onChange={e => setTaxType(e.target.value)}>
            <option value="PERCENT">% GST Rate</option>
            <option value="FLAT">₹ Flat Amount</option>
          </select>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      )}
    </div>
  );

  const productSection = (
    <>
      <div className="afx-subpanel">
        <div className="afx-subpanel-header">Find Product</div>
        <div className="afx-subpanel-body">
          <form
            className="afx-scan-field"
            onSubmit={e => {
              e.preventDefault();
              const code = scanValue;
              setScanValue("");
              handleBarcodeScan(code);
              scanRef.current?.focus();
            }}
            title="Scan a barcode — selects the product type + product; you choose the quantity"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3v10M5 3v10M7.5 3v10M10 3v10M12.5 3v10M14 3v10" />
            </svg>
            <input
              ref={scanRef}
              type="text"
              placeholder="Scan or type barcode, then press Enter…"
              value={scanValue}
              onChange={e => setScanValue(e.target.value)}
              autoComplete="off"
            />
          </form>

          <div className="afx-field">
            <label className="afx-label">Product Type <span style={{ fontWeight: 400, color: "var(--afx-text-3)" }}>(optional filter)</span></label>
            <div className="afx-chip-row">
              <button
                type="button"
                className={`afx-chip ${!selectedType ? "is-active" : ""}`}
                onClick={() => handleTypeChange({ target: { value: "" } })}
              >All</button>
              {productTypes.map(t => (
                <button
                  key={t.id}
                  type="button"
                  className={`afx-chip ${String(selectedType) === String(t.id) ? "is-active" : ""}`}
                  onClick={() => handleTypeChange({ target: { value: t.id } })}
                >{t.name}</button>
              ))}
            </div>
            {errors.selectedType && <div className="afx-error">{errors.selectedType}</div>}
          </div>

          <SearchableDropdown
            label="Product" options={products} selectedId={selectedProduct}
            onSelect={id => handleProductChange({ target: { value: id } })}
            search={productSearch} setSearch={setProductSearch}
            open={productDropdownOpen} setOpen={setProductDropdownOpen}
            placeholder="Search product…" dropdownRef={productDropdownRef} error={errors.selectedProduct}
          />

          {/* Inventory info — price & stock are always read from product configuration */}
          {inventory ? (
            <div className="afx-card">
              <div className="afx-card-row"><span>Selling Price</span><strong>₹{inventory.unitSellingPrice}</strong></div>
              <div className="afx-card-row">
                <span>Current Stock</span>
                <strong className={outOfStock ? "afx-text-danger" : lowStock ? "" : "afx-text-success"} style={lowStock ? { color: "var(--afx-warning)" } : undefined}>
                  {inventory.currentQuantity}{outOfStock ? " · Out of stock" : lowStock ? " · Low stock" : ""}
                </strong>
              </div>
              {outOfStock && (
                <div className="afx-error">This product is out of stock and cannot be added. Add stock via Purchase first.</div>
              )}
            </div>
          ) : noPriceConfigured ? (
            <div className="afx-alert">Selling price is not configured for this product. Please set it up in Products first.</div>
          ) : null}

          {/* Batch loading shimmer */}
          {selectedProduct && batchesLoading && (
            <div className="afx-card" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <span className="afx-spinner" style={{ borderColor: "var(--afx-border)", borderTopColor: "var(--afx-accent)" }} />
              <span style={{ fontSize: 12, color: "var(--afx-text-3)" }}>Loading batches…</span>
            </div>
          )}

          {/* Batch selector — only after load */}
          {selectedProduct && !batchesLoading && availableBatches.length > 0 && (
            <div className="afx-card">
              <div className="afx-section-title" style={{ padding: 0 }}>Batch Selection</div>
              <div className="afx-select-wrap">
                <select className="afx-select" value={selectedBatchId} onChange={e => setSelectedBatchId(e.target.value)}>
                  <option value="">Auto-select (FIFO — oldest expiry first)</option>
                  {availableBatches.map(b => (
                    <option key={b.batchId} value={b.batchId}>
                      {b.batchNumber} · Exp: {b.expiryDate} · Qty: {b.availableQuantity}
                      {b.expiryStatus === "EXPIRING_SOON" ? " (expiring soon)" : b.expiryStatus === "EXPIRED" ? " (expired)" : ""}
                    </option>
                  ))}
                </select>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              {selectedBatchId && (() => {
                const b = availableBatches.find(x => String(x.batchId) === String(selectedBatchId));
                return b ? (
                  <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--afx-text-2)", flexWrap: "wrap" }}>
                    <span>Batch: <strong style={{ color: "var(--afx-accent)" }}>{b.batchNumber}</strong></span>
                    <span>Expiry: <strong style={{
                      color: b.expiryStatus === "EXPIRING_SOON" ? "var(--afx-warning)"
                        : b.expiryStatus === "EXPIRED" ? "var(--afx-danger)" : "var(--afx-success)"
                    }}>{b.expiryDate}</strong></span>
                    <span>MRP: <strong style={{ color: "var(--afx-text-1)" }}>₹{b.mrp}</strong></span>
                    <span>Stock: <strong style={{ color: "var(--afx-text-1)" }}>{b.availableQuantity}</strong></span>
                  </div>
                ) : null;
              })()}
            </div>
          )}

          {/* No batches warning */}
          {selectedProduct && !batchesLoading && availableBatches.length === 0 && (
            <div className="afx-alert">No batches available for this product. Add stock via Purchase first.</div>
          )}
        </div>
      </div>

      <div className="afx-subpanel">
        <div className="afx-subpanel-header">Quantity &amp; Tax</div>
        <div className="afx-subpanel-body">
          <div className="afx-grid">
            <div className="afx-field">
              <label className="afx-label">Quantity</label>
              <div className="afx-qty">
                <button type="button" className="afx-qty-btn" onClick={() => stepQuantity(-1)} disabled={outOfStock || (parseInt(quantity) || 0) <= 1}>−</button>
                <input
                  className={`afx-qty-input ${errors.quantity ? "afx-input--err" : ""}`}
                  style={errors.quantity ? { borderColor: "var(--afx-danger)" } : undefined}
                  type="number" value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  min="1" placeholder="Enter qty"
                  disabled={outOfStock}
                />
                <button type="button" className="afx-qty-btn" onClick={() => stepQuantity(1)} disabled={outOfStock}>+</button>
              </div>
              {errors.quantity && <div className="afx-error">{errors.quantity}</div>}
            </div>
            {taxMode === "PRODUCT" && (
              <div className="afx-field">
                <label className="afx-label">GST {taxType === "PERCENT" ? "Rate (%)" : "Amount (₹)"}</label>
                {taxType === "PERCENT" ? (
                  <div className="afx-select-wrap">
                    <select className="afx-select" value={taxInput} onChange={e => setTaxInput(e.target.value)}>
                      <option value="">Select GST rate</option>
                      {GST_RATES.map(r => (
                        <option key={r} value={r}>{r}%{r === 18 ? " (Standard)" : ""}</option>
                      ))}
                    </select>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                ) : (
                  <input
                    className="afx-input"
                    type="number" value={taxInput}
                    onChange={e => setTaxInput(e.target.value)}
                    placeholder="Flat GST amount" min="0"
                  />
                )}
                {errors.taxInput && <div className="afx-error">{errors.taxInput}</div>}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="afx-btn" onClick={clearProductForm}>Clear All</button>
            <button type="button" className="afx-btn afx-btn--primary" onClick={addItem} disabled={outOfStock || noPriceConfigured}>
              {editIndex !== null ? "Update Item" : "+ Add Item"}
            </button>
          </div>
          {errors.lineItems && <div className="afx-error">{errors.lineItems}</div>}
        </div>
      </div>

      <div className="afx-subpanel">
        <div className="afx-subpanel-header">Line Items</div>
        <div className="afx-subpanel-body">
          {lineItems.length === 0 ? (
            <div className="afx-items-empty">No items added yet</div>
          ) : (
            <>
              <div className="afx-line-list">
                {lineItems.map((it, idx) => (
                  <div key={idx} className="afx-line-row">
                    <div className="afx-line-avatar" style={{ "--hue": productHue(it.productName) }}>
                      {productInitials(it.productName)}
                    </div>
                    <div className="afx-line-info">
                      <span className="afx-line-name">{it.productName}</span>
                      <span className="afx-line-meta">
                        ₹{it.sellingPrice} × {it.quantity}
                        {it.freeQuantity > 0 && <strong className="afx-text-success"> {freeText(it)}</strong>}
                        {it.batchNumber && it.batchNumber !== "AUTO" && ` · Batch ${it.batchNumber}`}
                        {it.expiryDate && ` · Exp ${it.expiryDate}`}
                      </span>
                      {it.schemeId && (
                        <span className="afx-line-meta" data-testid="line-scheme">
                          Scheme: {it.schemeName}{it.schemeDiscount > 0 && ` · −₹${it.schemeDiscount.toFixed(2)}`}
                          {" "}<button type="button" className="afx-link-btn" onClick={() => dropScheme(idx)}>Remove</button>
                        </span>
                      )}
                      {!it.schemeId && it.schemeOff && (
                        <span className="afx-line-meta">
                          No scheme <button type="button" className="afx-link-btn" onClick={() => retryScheme(idx)}>Apply scheme</button>
                        </span>
                      )}
                    </div>
                    <span className="afx-line-total">₹{(totals.lines[idx].post * (1 + totals.lines[idx].rate)).toFixed(2)}</span>
                    <div className="afx-line-actions">
                      <button type="button" className="afx-icon-btn" onClick={() => editItem(idx)} title="Edit">
                        <svg width="12" height="12" viewBox="0 -960 960 960" fill="currentColor"><path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Z"/></svg>
                      </button>
                      <button type="button" className="afx-remove-btn" onClick={() => deleteItem(idx)} title="Delete">
                        <svg width="12" height="12" viewBox="0 -960 960 960" fill="currentColor"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360Z"/></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="afx-totals" style={{ marginTop: 10 }}>
                <div className="afx-totals-row afx-totals-grand"><span>Total (incl. GST)</span><span>₹{totalAmount.toFixed(2)}</span></div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );

  const billingSection = (
    <>
      <SearchableDropdown
                label="Retailer (optional — leave empty for walk-in)"
                options={retailers} selectedId={selectedRetailer}
                onSelect={id => setSelectedRetailer(id)}
                search={retailerSearch} setSearch={setRetailerSearch}
                open={retailerDropdownOpen} setOpen={setRetailerDropdownOpen}
                placeholder="Search retailer…" dropdownRef={retailerDropdownRef}
                error={errors.retailerId}
              />

              <div className="afx-field">
                <label className="afx-label">Discount</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="afx-input"
                    type="number" value={discountInput}
                    onChange={e => setDiscountInput(e.target.value)}
                    min="0" placeholder="0"
                  />
                  <select className="afx-select" style={{ width: 80, flexShrink: 0 }} value={discountType} onChange={e => setDiscountType(e.target.value)}>
                    <option value="PERCENT">%</option>
                    <option value="FLAT">₹</option>
                  </select>
                </div>
                {errors.discountInput && <div className="afx-error">{errors.discountInput}</div>}
              </div>

              {creditPaymentType !== "CREDIT" && (
                <div className="afx-field">
                  <label className="afx-label">Billing Mode</label>
                  <div className="afx-seg-row">
                    {[["CASH", "Cash"], ["ONLINE", "Online / UPI"], ["CARD", "Card"]].map(([val, lbl]) => (
                      <button
                        key={val} type="button"
                        className={`afx-seg-btn ${billingMode === val ? "is-active" : ""}`}
                        onClick={() => setBillingMode(val)}
                      >{lbl}</button>
                    ))}
                  </div>
                  {errors.billingMode && <div className="afx-error">{errors.billingMode}</div>}
                </div>
              )}

              {/* ── Totals breakdown ── */}
              <div className="afx-totals">
                <div className="afx-totals-row"><span>Subtotal</span><span style={{ color: "var(--afx-text-1)" }}>₹{lineTotal.toFixed(2)}</span></div>
                {schemeDiscAmt > 0 && (
                  <div className="afx-totals-row"><span>Scheme discount</span><span className="afx-text-danger">−₹{schemeDiscAmt.toFixed(2)}</span></div>
                )}
                {discAmt > 0 && (
                  <div className="afx-totals-row"><span>Discount</span><span className="afx-text-danger">−₹{discAmt.toFixed(2)}</span></div>
                )}
                {totals.freeUnits > 0 && (
                  <div className="afx-totals-row"><span>Free units (stock reduced, not charged)</span><span className="afx-text-success">{totals.freeUnits}</span></div>
                )}
                <div className="afx-totals-row"><span>Taxable Value</span><span style={{ color: "var(--afx-text-1)" }}>₹{discountedTotal.toFixed(2)}</span></div>
                <div className="afx-totals-row"><span>GST</span><span style={{ color: "var(--afx-text-1)" }}>₹{gstAmount.toFixed(2)}</span></div>
                {tcsPreview.tcs > 0 && (
                  <div className="afx-totals-row">
                    <span>TCS{tcsSetting?.sectionCode ? ` (${tcsSetting.sectionCode})` : ""} @ {tcsPreview.rate}%</span>
                    <span>₹{tcsPreview.tcs.toFixed(2)}</span>
                  </div>
                )}
                <div className="afx-totals-divider" />
                <div className="afx-totals-row afx-totals-grand"><span>Payable Amount</span><span>₹{payableAmount.toFixed(2)}</span></div>
                {tcsPreview.tcs > 0 && (
                  <div className="afx-totals-hint" style={{ fontSize: 12, color: "var(--afx-text-2)" }}>
                    Includes ₹{tcsPreview.tcs.toFixed(2)} TCS collected on this retailer's crossing of the FY threshold —
                    estimated; the invoice will show the exact final figure.
                  </div>
                )}
              </div>

              <div className="afx-field">
                <label className="afx-label">Payment Type</label>
                <div className="afx-pay-tile-row">
                  {PAYMENT_TYPES.map(({ id, label, sub }) => (
                    <button
                      key={id} type="button"
                      className={`afx-pay-tile ${creditPaymentType === id ? "is-active" : ""}`}
                      onClick={() => {
                        setCreditPaymentType(id);
                        if (id === "PAID")    setAmountPaid(payableAmount.toFixed(2));
                        if (id === "CREDIT")  setAmountPaid("0");
                        if (id === "PARTIAL") setAmountPaid("");
                      }}
                    >
                      <span className="afx-pay-tile-icon">{PAYMENT_ICONS[id]}</span>
                      <span className="afx-pay-tile-text">
                        <span className="afx-pay-tile-label">{label}</span>
                        <span className="afx-pay-tile-sub">{sub}</span>
                      </span>
                      {creditPaymentType === id && (
                        <span className="afx-pay-tile-check">
                          <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.2 2.2L8 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {(creditPaymentType === "CREDIT" || creditPaymentType === "PARTIAL") && (
                <div className="afx-field">
                  <label className="afx-label">Due Date</label>
                  <input className="afx-input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                  {errors.dueDate && <div className="afx-error">{errors.dueDate}</div>}
                </div>
              )}

              <div className="afx-field">
                <label className="afx-label">Amount Paid (₹)</label>
                <input
                  className="afx-input"
                  type="number" value={amountPaid}
                  onChange={e => setAmountPaid(e.target.value)}
                  disabled={creditPaymentType === "PAID" || creditPaymentType === "CREDIT"}
                  min="0" placeholder="0.00"
                />
                {errors.amountPaid && <div className="afx-error">{errors.amountPaid}</div>}
              </div>

      {creditPaymentType !== "PAID" && (
        <div className="afx-totals">
          <div className="afx-totals-row afx-totals-grand">
            <span>Due Amount</span>
            <span className="afx-text-danger">₹{Math.max(0, payableAmount - parseFloat(amountPaid || 0)).toFixed(2)}</span>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="afx-backdrop afx-backdrop--full">
      <div className="afx-modal afx-modal--full">
        <div className="afx-header">
          <div>
            <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />New Transaction</div>
            <h3 className="afx-title">Add Sales</h3>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {viewMode === "tabs" && (
              <div className="afx-tabs" style={{ padding: 0, background: "none", border: "none" }}>
                {["Tax", "Product", "Billing"].map(tab => (
                  <button type="button" key={tab} className={`afx-tab ${activeTab === tab ? "is-active" : ""}`} onClick={() => setActiveTab(tab)}>
                    {tab}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              className={`afx-toggle ${viewMode === "all" ? "is-on" : ""}`}
              onClick={() => setViewMode(v => v === "all" ? "tabs" : "all")}
              title="Show every section at once, instead of one tab at a time"
            >
              <span className="afx-toggle-label">All sections</span>
              <span className="afx-toggle-track" />
            </button>
            <button className="afx-close" onClick={onClose} title="Close">
              <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              ESC
            </button>
          </div>
        </div>

        <div className="afx-body">
          {viewMode === "all" ? (
            <div className="afx-stack">
              <div className="afx-panel">
                <div className="afx-panel-header">
                  <span className="afx-panel-title">GST / Tax Settings</span>
                </div>
                {taxSection}
              </div>
              <div className="afx-panel">
                <div className="afx-panel-header">
                  <span className="afx-panel-title">Products</span>
                  <span className="afx-panel-count">{lineItems.length} item{lineItems.length !== 1 ? "s" : ""}</span>
                </div>
                {productSection}
              </div>
              <div className="afx-panel">
                <div className="afx-panel-header">
                  <span className="afx-panel-title">Billing &amp; Payment</span>
                </div>
                {billingSection}
              </div>
            </div>
          ) : (
            <>
              {activeTab === "Tax" && taxSection}
              {activeTab === "Product" && productSection}
              {activeTab === "Billing" && billingSection}
            </>
          )}
        </div>

        <div className="afx-footer">
          <button className="afx-btn" onClick={onClose}>Cancel</button>
          <button className="afx-btn afx-btn--primary" onClick={submitSales}>Submit Sales</button>
        </div>
      </div>
    </div>
  );
}
