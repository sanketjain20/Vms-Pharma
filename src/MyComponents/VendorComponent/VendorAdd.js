import React, { useState, useEffect } from "react";
import "../../Styles/Vendor/VendorAdd.css";
import { toast } from "react-toastify";

export default function VendorAdd({ onClose, onSubmit }) {
  const [name, setName]               = useState("");
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [shopName, setShopName]       = useState("");
  const [phone, setPhone]             = useState("");
  const [roleId, setRoleId]           = useState("");
  const [address, setAddress]         = useState("");
  const [vendorPrefix, setVendorPrefix] = useState("");
  const [expiryDate, setExpiryDate]   = useState("");
  const [roles, setRoles]             = useState([]);
  const [errors, setErrors]           = useState({});
  const [loading, setLoading]         = useState(false);
  const [showPass, setShowPass]       = useState(false);

  useEffect(() => {
    fetch("http://localhost:8080/api/Roles/getAll", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    })
      .then(r => r.json())
      .then(res => { if (res.status === 200) setRoles(res.data); })
      .catch(err => console.log(err));
  }, []);

  const validate = () => {
    let temp = {};
    if (!name.trim())         temp.name         = "Name is required";
    if (!email.trim())        temp.email        = "Email is required";
    if (!password.trim())     temp.password     = "Password is required";
    if (!shopName.trim())     temp.shopName     = "Shop name is required";
    if (!phone.trim())        temp.phone        = "Phone number is required";
    if (!roleId)              temp.roleId       = "Please select a role";
    if (!address.trim())      temp.address      = "Address is required";
    if (!vendorPrefix.trim()) temp.vendorPrefix = "Vendor prefix is required";
    if (!expiryDate)          temp.expiryDate   = "Expiry date is required";
    setErrors(temp);
    return Object.keys(temp).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);

    const payload = { name, email, password, shopName, phone, roleId: Number(roleId), address, vendorPrefix, expiryDate };

    try {
      const response = await fetch("http://localhost:8080/api/Vendor/AddVendor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (response.ok && result.status === 200) {
        toast.success("Vendor added successfully");
        onSubmit?.(); onClose?.();
      } else { toast.error(result.message || "Vendor creation failed"); }
    } catch (error) {
      console.log(error);
      toast.error("Network error. Please try again!");
    } finally { setLoading(false); }
  };

  const clearError = (field) => setErrors(p => ({ ...p, [field]: "" }));

  return (
    <div className="vd-backdrop">

      {/* ── LOADING OVERLAY ── */}
      {loading && (
        <div className="vd-loader-overlay">
          <div className="vd-loader-ring">
            <div /><div /><div /><div />
          </div>
          <span className="vd-loader-label">Creating vendor…</span>
        </div>
      )}

      <div className="vd-modal">
        {/* Top beam */}
        <div className="vd-top-beam" />
        {/* Corners */}
        <div className="vd-corner vd-tl" /><div className="vd-corner vd-tr" />
        <div className="vd-corner vd-bl" /><div className="vd-corner vd-br" />

        {/* ── HEADER ── */}
        <div className="vd-header">
          <div className="vd-header-left">
            <div className="vd-eyebrow">
              <span className="vd-eyebrow-dot" />
              NEW VENDOR
            </div>
            <h2 className="vd-title">
              <span className="vd-title-acc">//</span>
              Add Vendor
            </h2>
          </div>
          <button className="vd-close" onClick={onClose} title="Close">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            ESC
          </button>
        </div>

        {/* ── FORM ── */}
        <form className="vd-form" onSubmit={handleSubmit} noValidate>

          {/* Row 1 — Name / Email */}
          <div className="vd-row">
            <div className="vd-group">
              <label>Name</label>
              <input
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); clearError("name"); }}
                placeholder="Full name"
                className={errors.name ? "vd-input-err" : ""}
              />
              {errors.name && <span className="vd-err">{errors.name}</span>}
            </div>

            <div className="vd-group">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); clearError("email"); }}
                placeholder="email@domain.com"
                className={errors.email ? "vd-input-err" : ""}
                pattern="^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
              />
              {errors.email && <span className="vd-err">{errors.email}</span>}
            </div>
          </div>

          {/* Row 2 — Password / Phone */}
          <div className="vd-row">
            <div className="vd-group">
              <label>Password</label>
              <div className="vd-input-wrap">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={e => { setPassword(e.target.value); clearError("password"); }}
                  placeholder="Set password"
                  className={errors.password ? "vd-input-err" : ""}
                />
                <button type="button" className="vd-eye-btn" onClick={() => setShowPass(s => !s)} tabIndex={-1}>
                  {showPass ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M1 7C1 7 3 3 7 3s6 4 6 4-2 4-6 4-6-4-6-4Z" stroke="currentColor" strokeWidth="1.2"/>
                      <circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
                      <path d="M2 2l10 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M1 7C1 7 3 3 7 3s6 4 6 4-2 4-6 4-6-4-6-4Z" stroke="currentColor" strokeWidth="1.2"/>
                      <circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && <span className="vd-err">{errors.password}</span>}
            </div>

            <div className="vd-group">
              <label>Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, "");
                  if (v.length <= 10) { setPhone(v); clearError("phone"); }
                }}
                placeholder="8–10 digit number"
                className={errors.phone ? "vd-input-err" : ""}
                pattern="\d{8,10}"
                maxLength={10}
              />
              {errors.phone && <span className="vd-err">{errors.phone}</span>}
            </div>
          </div>

          {/* Row 3 — Shop Name / Role */}
          <div className="vd-row">
            <div className="vd-group">
              <label>Shop Name</label>
              <input
                type="text"
                value={shopName}
                onChange={e => { setShopName(e.target.value); clearError("shopName"); }}
                placeholder="Shop / business name"
                className={errors.shopName ? "vd-input-err" : ""}
              />
              {errors.shopName && <span className="vd-err">{errors.shopName}</span>}
            </div>

            <div className="vd-group">
              <label>Select Role</label>
              <select
                value={roleId}
                onChange={e => { setRoleId(e.target.value); clearError("roleId"); }}
                className={errors.roleId ? "vd-input-err" : ""}
              >
                <option value="">— Select Role —</option>
                {roles.map(r => (
                  <option key={r.id} value={r.id}>{r.roleName}</option>
                ))}
              </select>
              {errors.roleId && <span className="vd-err">{errors.roleId}</span>}
            </div>
          </div>

          {/* Row 4 — Address (full width) */}
          <div className="vd-row">
            <div className="vd-group vd-full">
              <label>Address</label>
              <textarea
                rows={2}
                value={address}
                onChange={e => { setAddress(e.target.value); clearError("address"); }}
                placeholder="Full business address"
                className={errors.address ? "vd-input-err" : ""}
              />
              {errors.address && <span className="vd-err">{errors.address}</span>}
            </div>
          </div>

          {/* Row 5 — Vendor Prefix / Expiry */}
          <div className="vd-row">
            <div className="vd-group">
              <label>Vendor Prefix</label>
              <input
                type="text"
                value={vendorPrefix}
                onChange={e => { setVendorPrefix(e.target.value); clearError("vendorPrefix"); }}
                placeholder="e.g. VND"
                className={errors.vendorPrefix ? "vd-input-err" : ""}
              />
              {errors.vendorPrefix && <span className="vd-err">{errors.vendorPrefix}</span>}
            </div>

            <div className="vd-group">
              <label>Account Validity Till</label>
              <input
                type="date"
                value={expiryDate}
                onChange={e => { setExpiryDate(e.target.value); clearError("expiryDate"); }}
                className={errors.expiryDate ? "vd-input-err" : ""}
              />
              {errors.expiryDate && <span className="vd-err">{errors.expiryDate}</span>}
            </div>
          </div>

          {/* ── FOOTER ── */}
          <div className="vd-footer">
            <button type="button" className="vd-btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="vd-btn-save" disabled={loading}>
              {loading ? "Saving…" : "Save Vendor"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
