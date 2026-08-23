import React, { useState, useEffect } from "react";
import "../../Styles/CommonAEUDForm/FormShell.css";
import { toast } from "react-toastify";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

const getLoggedInVendor = () => {
  try {
    return JSON.parse(localStorage.getItem("vmsUser"))?.data || {};
  } catch {
    return {};
  }
};

export default function VendorAdd({ onClose, onSubmit }) {
  const loggedInVendor = getLoggedInVendor();
  const useLoggedInVendorPrefix = loggedInVendor?.masterVendor === true && !!loggedInVendor?.vendorPrefix;
  const [name, setName]               = useState("");
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [shopName, setShopName]       = useState("");
  const [phone, setPhone]             = useState("");
  const [roleId, setRoleId]           = useState("");
  const [address, setAddress]         = useState("");
  const [vendorPrefix, setVendorPrefix] = useState("");
  const [expiryDate, setExpiryDate]   = useState("");
  const [masterVendor, setMasterVendor] = useState(true);
  const [subVendorLimit, setSubVendorLimit] = useState(0);
  const [roles, setRoles]             = useState([]);
  const [errors, setErrors]           = useState({});
  const [loading, setLoading]         = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showPass, setShowPass]       = useState(false);

  useEffect(() => {
    apiClient(`${API_BASE_URL}/api/Roles/getAll`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })
      .then(r => r.json())
      .then(res => { if (res.status === 200) setRoles(res.data); })
      .catch(err => console.log(err))
      .finally(() => setInitialLoading(false));
  }, []);

  const validate = () => {
    let temp = {};
    if (!name.trim())         temp.name         = "Name is required";
    if (!email.trim())        temp.email        = "Email is required";
    if (!password.trim())     temp.password     = "Password is required";
    if (!useLoggedInVendorPrefix && !shopName.trim()) temp.shopName = "Shop name is required";
    if (!phone.trim())        temp.phone        = "Phone number is required";
    if (!roleId)              temp.roleId       = "Please select a role";
    if (!useLoggedInVendorPrefix && !address.trim()) temp.address = "Address is required";
    if (!useLoggedInVendorPrefix && !vendorPrefix.trim()) temp.vendorPrefix = "Vendor prefix is required";
    if (!expiryDate)          temp.expiryDate   = "Expiry date is required";
    if (!useLoggedInVendorPrefix && masterVendor && (subVendorLimit === "" || Number(subVendorLimit) < 0)) {
      temp.subVendorLimit = "Worker credential limit cannot be negative";
    }
    setErrors(temp);
    return Object.keys(temp).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);

    const payload = {
      name,
      email,
      password,
      shopName: useLoggedInVendorPrefix ? loggedInVendor.shopName : shopName,
      phone,
      roleId: Number(roleId),
      address: useLoggedInVendorPrefix ? loggedInVendor.address : address,
      vendorPrefix: useLoggedInVendorPrefix ? loggedInVendor.vendorPrefix : vendorPrefix,
      expiryDate,
      masterVendor: useLoggedInVendorPrefix ? false : masterVendor,
      subVendorLimit: (useLoggedInVendorPrefix || !masterVendor) ? 0 : Number(subVendorLimit) || 0,
    };

    try {
      const response = await apiClient(`${API_BASE_URL}/api/Vendor/AddVendor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  if (initialLoading) return (
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--md">
        <div className="afx-loading">
          <div className="afx-loader-ring"><div/><div/><div/></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--md">
        <div className="afx-header">
          <div>
            <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />New Vendor</div>
            <h3 className="afx-title">Add Vendor</h3>
          </div>
          <button className="afx-close" onClick={onClose} title="Close">
            <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            ESC
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="afx-body">
            <div className="afx-grid">
              <div className="afx-field">
                <label className="afx-label">Name<span className="afx-req">*</span></label>
                <input
                  type="text"
                  className={`afx-input ${errors.name ? "afx-input--err" : ""}`}
                  value={name}
                  onChange={e => { setName(e.target.value); clearError("name"); }}
                  placeholder="Full name"
                />
                {errors.name && <span className="afx-error">{errors.name}</span>}
              </div>

              <div className="afx-field">
                <label className="afx-label">Email<span className="afx-req">*</span></label>
                <input
                  type="email"
                  className={`afx-input ${errors.email ? "afx-input--err" : ""}`}
                  value={email}
                  onChange={e => { setEmail(e.target.value); clearError("email"); }}
                  placeholder="email@domain.com"
                  pattern="^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
                />
                {errors.email && <span className="afx-error">{errors.email}</span>}
              </div>

              <div className="afx-field">
                <label className="afx-label">Password<span className="afx-req">*</span></label>
                <div className="afx-input-wrap">
                  <input
                    type={showPass ? "text" : "password"}
                    className={`afx-input ${errors.password ? "afx-input--err" : ""}`}
                    value={password}
                    onChange={e => { setPassword(e.target.value); clearError("password"); }}
                    placeholder="Set password"
                  />
                  <button type="button" className="afx-eye-btn" onClick={() => setShowPass(s => !s)} tabIndex={-1}>
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
                {errors.password && <span className="afx-error">{errors.password}</span>}
              </div>

              <div className="afx-field">
                <label className="afx-label">Phone<span className="afx-req">*</span></label>
                <input
                  type="tel"
                  className={`afx-input ${errors.phone ? "afx-input--err" : ""}`}
                  value={phone}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, "");
                    if (v.length <= 10) { setPhone(v); clearError("phone"); }
                  }}
                  placeholder="8–10 digit number"
                  pattern="\d{8,10}"
                  maxLength={10}
                />
                {errors.phone && <span className="afx-error">{errors.phone}</span>}
              </div>

              {!useLoggedInVendorPrefix && (
                <div className="afx-field">
                  <label className="afx-label">Shop Name<span className="afx-req">*</span></label>
                  <input
                    type="text"
                    className={`afx-input ${errors.shopName ? "afx-input--err" : ""}`}
                    value={shopName}
                    onChange={e => { setShopName(e.target.value); clearError("shopName"); }}
                    placeholder="Shop / business name"
                  />
                  {errors.shopName && <span className="afx-error">{errors.shopName}</span>}
                </div>
              )}

              <div className="afx-field">
                <label className="afx-label">Select Role<span className="afx-req">*</span></label>
                <div className="afx-select-wrap">
                  <select
                    className={`afx-select ${errors.roleId ? "afx-select--err" : ""}`}
                    value={roleId}
                    onChange={e => { setRoleId(e.target.value); clearError("roleId"); }}
                  >
                    <option value="">— Select Role —</option>
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.roleName}</option>
                    ))}
                  </select>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                {errors.roleId && <span className="afx-error">{errors.roleId}</span>}
              </div>

              {!useLoggedInVendorPrefix && (
                <div className="afx-field afx-field--full">
                  <label className="afx-label">Address<span className="afx-req">*</span></label>
                  <textarea
                    rows={2}
                    className={`afx-textarea ${errors.address ? "afx-textarea--err" : ""}`}
                    value={address}
                    onChange={e => { setAddress(e.target.value); clearError("address"); }}
                    placeholder="Full business address"
                  />
                  {errors.address && <span className="afx-error">{errors.address}</span>}
                </div>
              )}

              {!useLoggedInVendorPrefix && (
                <div className="afx-field">
                  <label className="afx-label">Vendor Prefix<span className="afx-req">*</span></label>
                  <input
                    type="text"
                    className={`afx-input ${errors.vendorPrefix ? "afx-input--err" : ""}`}
                    value={vendorPrefix}
                    onChange={e => { setVendorPrefix(e.target.value); clearError("vendorPrefix"); }}
                    placeholder="e.g. VND"
                  />
                  {errors.vendorPrefix && <span className="afx-error">{errors.vendorPrefix}</span>}
                </div>
              )}

              <div className="afx-field">
                <label className="afx-label">Account Validity Till<span className="afx-req">*</span></label>
                <input
                  type="date"
                  className={`afx-input ${errors.expiryDate ? "afx-input--err" : ""}`}
                  value={expiryDate}
                  onChange={e => { setExpiryDate(e.target.value); clearError("expiryDate"); }}
                />
                {errors.expiryDate && <span className="afx-error">{errors.expiryDate}</span>}
              </div>

              {!useLoggedInVendorPrefix && (
                <div className="afx-field">
                  <label className="afx-label">Master Vendor</label>
                  <label className="afx-switch-row">
                    <input
                      type="checkbox"
                      checked={masterVendor}
                      onChange={e => {
                        const checked = e.target.checked;
                        setMasterVendor(checked);
                        if (!checked) {
                          setSubVendorLimit(0);
                          clearError("subVendorLimit");
                        }
                      }}
                    />
                    <span className="afx-switch" />
                    <span className="afx-switch-text">
                      {masterVendor ? "Can create worker credentials" : "Cannot create worker credentials"}
                    </span>
                  </label>
                </div>
              )}

              {!useLoggedInVendorPrefix && masterVendor && (
                <div className="afx-field">
                  <label className="afx-label">Worker Credential Limit</label>
                  <input
                    type="number"
                    min="0"
                    className={`afx-input ${errors.subVendorLimit ? "afx-input--err" : ""}`}
                    value={subVendorLimit}
                    onChange={e => { setSubVendorLimit(e.target.value); clearError("subVendorLimit"); }}
                    placeholder="0"
                  />
                  {errors.subVendorLimit && <span className="afx-error">{errors.subVendorLimit}</span>}
                </div>
              )}
            </div>
          </div>

          <div className="afx-footer">
            <button type="button" className="afx-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="afx-btn afx-btn--primary" disabled={loading}>
              {loading ? <><span className="afx-spinner" /> Saving…</> : "Save Vendor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
