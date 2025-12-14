import React, { useEffect, useState } from "react";
import "../../Styles/Vendor/VendorView.css";
import { toast } from "react-toastify";

export default function VendorView({ uKey, onClose}) {
    const [vendor, setVendor] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!uKey) return;

        fetch(`http://localhost:8080/api/Vendor/GetVendorByUkey/${uKey}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
        })
            .then((res) => res.json())
            .then((res) => {
                if (res.status === 200) {
                    setVendor(res.data);
                } else {
                    toast.error(res.message || "Failed to load vendor");
                }
            })
            .catch(() => toast.error("Network error"))
            .finally(() => setLoading(false));
    }, [uKey]);

    if (loading) {
        return <div className="view-v-loading">Loading vendor details...</div>;
    }

    if (!vendor) {
        return <div className="view-v-loading">Vendor not found</div>;
    }

    return (
        <div className="view-v-backdrop">
            <div className="view-v-container">

                {/* Header */}
                <div className="view-v-header">
                    <h2 className="view-v-title">View Vendor | {vendor.vendorCode}</h2>
                    <button className="view-v-close-btn" onClick={onClose}>
                        ✖
                    </button>
                </div>

                <div className="view-v-form">

                    <div className="view-v-form-row">
                        <div className="view-v-form-group">
                            <label>Name</label>
                            <input type="text" value={vendor.name} readOnly />
                        </div>

                        <div className="view-v-form-group">
                            <label>Email</label>
                            <input type="text" value={vendor.email} readOnly />
                        </div>
                    </div>

                    <div className="view-v-form-row">
                        <div className="view-v-form-group">
                            <label>Phone</label>
                            <input type="text" value={vendor.phone} readOnly />
                        </div>

                        <div className="view-v-form-group">
                            <label>Role</label>
                            <input type="text" value={vendor.roleName} readOnly />
                        </div>
                    </div>

                    <div className="view-v-form-row">
                        <div className="view-v-form-group">
                            <label>Shop Name</label>
                            <input type="text" value={vendor.shopName} readOnly />
                        </div>

                        <div className="view-v-form-group">
                            <label>Vendor Code</label>
                            <input type="text" value={vendor.vendorCode} readOnly />
                        </div>
                    </div>

                    <div className="view-v-form-row">
                        <div className="view-v-form-group full-width">
                            <label>Address</label>
                            <textarea rows="2" value={vendor.address} readOnly />
                        </div>
                    </div>

                    <div className="view-v-form-row">
                        <div className="view-v-form-group">
                            <label>Status</label>
                            <input
                                type="text"
                                value={vendor.disable === 1 ? "Disabled" : "Active"}
                                readOnly
                            />
                        </div>
                    </div>

                    <div className="view-v-footer">
                        <button className="view-v-btn-close" onClick={onClose}>
                            Close
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}
