import React, { useState, useEffect } from "react";
import "../../Styles/Vendor/VendorAdd.css";
import { toast } from "react-toastify";

export default function VendorEdit({ uKey, onClose, onSubmit }) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [shopName, setShopName] = useState("");
    const [phone, setPhone] = useState("");
    const [roleId, setRoleId] = useState("");
    const [address, setAddress] = useState("");
    const [vendorPrefix, setVendorPrefix] = useState("");
    const [expiryDate, setExpiryDate] = useState("");
    const [roles, setRoles] = useState([]);
    const [errors, setErrors] = useState({});
    const [vendorId, setVendorId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showPass, setShowPass] = useState(false);

    const clearError = (field) => setErrors(p => ({ ...p, [field]: "" }));

    /* ── FETCH ROLES ── */
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

    /* ── FETCH VENDOR ── */
    useEffect(() => {
        if (!uKey) return;
        fetch(`http://localhost:8080/api/Vendor/GetVendorByUkey/${uKey}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
        })
            .then(r => r.json())
            .then(res => {
                if (res.status === 200 && res.data) {
                    const v = res.data;
                    setVendorId(v.id || v.uKey);
                    setName(v.name || "");
                    setEmail(v.email || "");
                    setPassword("");
                    setShopName(v.shopName || "");
                    setPhone(v.phone || "");
                    setAddress(v.address || "");
                    setVendorPrefix(v.vendorPrefix || "");
                    setExpiryDate(v.expiryDate || "");
                    if (roles.length > 0 && v.roleName) {
                        const matched = roles.find(r => r.roleName === v.roleName);
                        if (matched) setRoleId(matched.id);
                    }
                } else { toast.error(res.message || "Failed to fetch vendor"); }
            })
            .catch(() => toast.error("Network error"));
    }, [uKey, roles]);

    const validate = () => {
        let temp = {};
        if (!name.trim()) temp.name = "Name is required";
        if (!email.trim()) temp.email = "Email is required";
        if (!shopName.trim()) temp.shopName = "Shop name is required";
        if (!phone.trim()) temp.phone = "Phone number is required";
        if (!roleId) temp.roleId = "Please select a role";
        if (!address.trim()) temp.address = "Address is required";
        if (!expiryDate) temp.expiryDate = "Expiry date is required";
        setErrors(temp);
        return Object.keys(temp).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;
        setLoading(true);

        const payload = { name, email, password, shopName, phone, roleId: Number(roleId), address, expiryDate };

        try {
            const response = await fetch(`http://localhost:8080/api/Vendor/UpdateVendor/${vendorId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload),
            });
            const result = await response.json();
            if (response.ok && result.status === 200) {
                toast.success("Vendor updated successfully");
                onSubmit?.(); onClose?.();
            } else { toast.error(result.message || "Vendor update failed"); }
        } catch (error) {
            console.log(error);
            toast.error("Network error. Please try again!");
        } finally { setLoading(false); }
    };

    return (
        <div className="vd-backdrop">

            {/* ── LOADING OVERLAY ── */}
            {loading && (
                <div className="vd-loader-overlay">
                    <div className="vd-loader-ring">
                        <div /><div /><div /><div />
                    </div>
                    <span className="vd-loader-label">Updating vendor…</span>
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
                            EDIT VENDOR
                        </div>
                        <h2 className="vd-title">
                            <span className="vd-title-acc">//</span>
                            {vendorPrefix ? `Vendor · ${vendorPrefix}` : "Edit Vendor"}
                        </h2>
                    </div>
                    <button className="vd-close" onClick={onClose} title="Close">
                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                            <path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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
                            />
                            {errors.email && <span className="vd-err">{errors.email}</span>}
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
                            <label>Phone</label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => {
                                    const value = e.target.value.replace(/\D/g, "");
                                    if (value.length <= 10) setPhone(value);
                                }}
                                placeholder="Enter 8-10 digit number"
                                className={errors.phone ? "add-v-input-error" : ""}
                            />
                            {errors.phone && <div className="add-v-error-text">{errors.phone}</div>}
                        </div>

                    </div>

                    {/* Row 4 — Address (full) */}
                    <div className="vd-row">
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

                        <div className="vd-group">
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

                    {/* Row 5 — Vendor Prefix (readonly) / Expiry */}
                    <div className="vd-row">
                        <div className="vd-group">
                            <label>Vendor Prefix</label>
                            <div className="vd-readonly-wrap">
                                <input type="text" value={vendorPrefix} readOnly />
                                <span className="vd-readonly-tag">READ ONLY</span>
                            </div>
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
                            {loading ? "Updating…" : "Update Vendor"}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
