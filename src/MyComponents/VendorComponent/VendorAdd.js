import React, { useState, useEffect } from "react";
import "../../Styles/Vendor/VendorAdd.css";
import { toast } from "react-toastify";

export default function VendorAdd({ onClose, onSubmit }) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [shopName, setShopName] = useState("");
    const [phone, setPhone] = useState("");
    const [roleId, setRoleId] = useState("");
    const [address, setAddress] = useState("");
    const [vendorPrefix, setVendorPrefix] = useState("");
    const [roles, setRoles] = useState([]);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        fetch("http://localhost:8080/api/Roles/getAll", {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
        })
            .then((res) => res.json())
            .then((res) => {
                if (res.status === 200) setRoles(res.data);
            })
            .catch((err) => console.log(err));
    }, []);

    const validate = () => {
        let temp = {};
        if (!name.trim()) temp.name = "Name is required";
        if (!email.trim()) temp.email = "Email is required";
        if (!password.trim()) temp.password = "Password is required";
        if (!shopName.trim()) temp.shopName = "Shop name is required";
        if (!phone.trim()) temp.phone = "Phone number is required";
        if (!roleId) temp.roleId = "Please select a role";
        if (!address.trim()) temp.address = "Address is required";
        if (!vendorPrefix.trim()) temp.vendorPrefix = "Vendor prefix is required";

        setErrors(temp);
        return Object.keys(temp).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        const payload = {
            name,
            email,
            password,
            shopName,
            phone,
            roleId: Number(roleId),
            address,
            vendorPrefix,
        };

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
                onSubmit && onSubmit();
                onClose && onClose();
            } else {
                toast.error(result.message || "Vendor creation failed");
            }
        } catch (error) {
            console.log(error);
            toast.error("Network error. Please try again!");
        }
    };

    return (
        <div className="add-v-backdrop">
            <div className="add-v-container">
                {/* Header with Close Button */}
                <div className="add-v-header">
                    <h2 className="add-v-title">Add Vendor</h2>
                    <button className="add-v-close-btn" onClick={onClose}>
                        ✖
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="add-v-form">
                    <div className="add-v-form-row">
                        <div className="add-v-form-group">
                            <label>Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className={errors.name ? "add-v-input-error" : ""}
                            />
                            {errors.name && (
                                <div className="add-v-error-text">{errors.name}</div>
                            )}
                        </div>
                        <div className="add-v-form-group">
                            <label>Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className={errors.email ? "add-v-input-error" : ""}
                                placeholder="Enter a valid email"
                                pattern="^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
                                required
                            />
                            {errors.email && (
                                <div className="add-v-error-text">{errors.email}</div>
                            )}
                        </div>


                    </div>

                    <div className="add-v-form-row">
                        <div className="add-v-form-group">
                            <label>Password</label>
                            <input
                                type="text"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className={errors.password ? "add-v-input-error" : ""}
                            />
                            {errors.password && (
                                <div className="add-v-error-text">{errors.password}</div>
                            )}
                        </div>
                        <div className="add-v-form-group">
                            <label>Phone</label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => {
                                    // Only allow numbers
                                    const value = e.target.value.replace(/\D/g, "");
                                    // Limit to max 10 digits
                                    if (value.length <= 10) setPhone(value);
                                }}
                                className={errors.phone ? "add-v-input-error" : ""}
                                placeholder="Enter 8-10 digit number"
                                pattern="\d{8,10}" // validation pattern
                                required
                            />
                            {errors.phone && (
                                <div className="add-v-error-text">{errors.phone}</div>
                            )}
                        </div>

                    </div>

                    <div className="add-v-form-row">
                        <div className="add-v-form-group">
                            <label>Shop Name</label>
                            <input
                                type="text"
                                value={shopName}
                                onChange={(e) => setShopName(e.target.value)}
                                className={errors.shopName ? "add-v-input-error" : ""}
                            />
                            {errors.shopName && (
                                <div className="add-v-error-text">{errors.shopName}</div>
                            )}
                        </div>
                        <div className="add-v-form-group">
                            <label>Select Role</label>
                            <select
                                value={roleId}
                                onChange={(e) => setRoleId(e.target.value)}
                                className={errors.roleId ? "add-v-input-error" : ""}
                            >
                                <option value="">-- Select Role --</option>
                                {roles.map((r) => (
                                    <option key={r.id} value={r.id}>
                                        {r.roleName}
                                    </option>
                                ))}
                            </select>
                            {errors.roleId && (
                                <div className="add-v-error-text">{errors.roleId}</div>
                            )}
                        </div>
                    </div>

                    <div className="add-v-form-row">
                        <div className="add-v-form-group full-width">
                            <label>Address</label>
                            <textarea
                                rows="2"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                className={errors.address ? "add-v-input-error" : ""}
                            ></textarea>
                            {errors.address && (
                                <div className="add-v-error-text">{errors.address}</div>
                            )}
                        </div>
                    </div>

                    <div className="add-v-form-row">
                        <div className="add-v-form-group prefix">
                            <label>Vendor Prefix</label>
                            <input
                                type="text"
                                value={vendorPrefix}
                                onChange={(e) => setVendorPrefix(e.target.value)}
                                className={errors.vendorPrefix ? "add-v-input-error" : ""}
                            />
                            {errors.vendorPrefix && (
                                <div className="add-v-error-text">{errors.vendorPrefix}</div>
                            )}
                        </div>
                    </div>

                    <div className="add-v-footer">
                        <button
                            type="button"
                            className="add-v-btn-cancel"
                            onClick={onClose}
                        >
                            Cancel
                        </button>
                        <button type="submit" className="add-v-btn-save">
                            Save Vendor
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
