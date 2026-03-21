import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../Styles/Setting.css";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const blobToBase64 = async (blobUrl) => {
  const response = await fetch(blobUrl);
  const blob = await response.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
};

export default function Settings() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [shopName, setShopName]                   = useState("");
  const [originalShopName, setOriginalShopName]   = useState("");
  const [isEditingShop, setIsEditingShop]         = useState(false);
  const [email, setEmail]                         = useState("");
  const [profilePhoto, setProfilePhoto]           = useState("https://via.placeholder.com/140");
  const [originalProfilePhoto, setOriginalProfilePhoto] = useState("https://via.placeholder.com/140");
  const [previewPhoto, setPreviewPhoto]           = useState(null);

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword]         = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentPassword, setCurrentPassword]     = useState("");
  const [newPassword, setNewPassword]             = useState("");
  const [confirmPassword, setConfirmPassword]     = useState("");

  useEffect(() => {
    fetch("http://localhost:8080/api/Vendor/SettingDetails", {
      method: "GET", credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 200) {
          setShopName(data.data.shopName);
          setOriginalShopName(data.data.shopName);
          setEmail(data.data.email);
          if (data.data.profilePhoto) {
            setProfilePhoto(data.data.profilePhoto);
            setOriginalProfilePhoto(data.data.profilePhoto);
          }
        } else toast.error(data.message || "Failed to load settings");
      })
      .catch(() => toast.error("Unable to fetch settings"));
  }, []);

  const handleShopSave = () => {
    if (!shopName.trim()) { toast.warning("Shop name cannot be empty"); return; }
    setIsEditingShop(false);
    toast.info("Shop name saved. Click Submit to apply changes.");
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPreviewPhoto(URL.createObjectURL(file));
    toast.info("Photo selected. Click Submit to apply.");
  };

  const handleSubmitAll = async () => {
    let finalPhoto = previewPhoto || profilePhoto;
    if (finalPhoto?.startsWith("blob:")) finalPhoto = await blobToBase64(finalPhoto);
    if (shopName === originalShopName && finalPhoto === originalProfilePhoto) {
      toast.info("No changes to submit"); return;
    }
    fetch("http://localhost:8080/api/Vendor/UpdateVendorSetting", {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, shopName, profilePicture: finalPhoto }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 200) {
          toast.success("Settings updated successfully");
          setOriginalShopName(shopName);
          setProfilePhoto(finalPhoto);
          setOriginalProfilePhoto(finalPhoto);
          setPreviewPhoto(null);
        } else toast.error(data.message || "Failed to update settings");
      })
      .catch(() => toast.error("Update failed. Please try again"));
  };

  const handlePasswordUpdate = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.warning("All password fields are required"); return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New and Confirm passwords do not match"); return;
    }
    fetch("http://localhost:8080/api/Vendor/UpdatePassword", {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, oldPassword: currentPassword, newPassword }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 200) {
          toast.success("Password updated");
          setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
        } else toast.error(data.message || "Password update failed");
      });
  };

  return (
    <div className="st-page">
      <ToastContainer position="top-right" autoClose={3000} theme="dark" />

      {/* ── Header ─────────────────────────────────────── */}
      <div className="st-header">
        <div className="st-header-left">
          <div className="st-eyebrow">Account Settings</div>
          <h1 className="st-title">Profile & Security</h1>
        </div>
      </div>

      {/* ── Profile Card ───────────────────────────────── */}
      <div className="st-card">
        <div className="st-card-header">
          <div className="st-card-dot" />
          <h3 className="st-card-title">Profile Information</h3>
        </div>

        <div className="st-profile-row">
          <div className="st-avatar-wrap">
            <img src={previewPhoto || profilePhoto} alt="Profile" className="st-avatar" />
            <button className="st-avatar-btn" onClick={() => fileInputRef.current.click()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
              </svg>
              Change Photo
            </button>
            <input type="file" ref={fileInputRef} accept="image/*" style={{ display: "none" }} onChange={handlePhotoChange} />
          </div>

          <div className="st-form-grid">
            <div className="st-field">
              <label className="st-label">Shop Name</label>
              <div className="st-inline">
                <input
                  className={`st-input ${!isEditingShop ? "st-input-disabled" : "st-input-active"}`}
                  value={shopName}
                  disabled={!isEditingShop}
                  onChange={(e) => setShopName(e.target.value)}
                />
                {!isEditingShop
                  ? <button className="st-link-btn" onClick={() => setIsEditingShop(true)}>Edit</button>
                  : <button className="st-link-btn st-link-success" onClick={handleShopSave}>Save</button>
                }
              </div>
            </div>

            <div className="st-field">
              <label className="st-label">Email Address</label>
              <input className="st-input st-input-disabled" value={email} disabled />
            </div>
          </div>
        </div>
      </div>

      {/* ── Password Card ──────────────────────────────── */}
      <div className="st-card">
        <div className="st-card-header">
          <div className="st-card-dot st-dot-purple" />
          <h3 className="st-card-title">Change Password</h3>
        </div>

        <div className="st-form-grid">
          {[
            { label: "Current Password", val: currentPassword, set: setCurrentPassword, show: showCurrentPassword, toggle: () => setShowCurrentPassword(!showCurrentPassword) },
            { label: "New Password",     val: newPassword,     set: setNewPassword,     show: showNewPassword,     toggle: () => setShowNewPassword(!showNewPassword) },
            { label: "Confirm Password", val: confirmPassword, set: setConfirmPassword, show: showConfirmPassword, toggle: () => setShowConfirmPassword(!showConfirmPassword) },
          ].map(({ label, val, set, show, toggle }) => (
            <div className="st-field" key={label}>
              <label className="st-label">{label}</label>
              <div className="st-pw-wrap">
                <input
                  className="st-input st-input-active"
                  type={show ? "text" : "password"}
                  placeholder={label}
                  value={val}
                  onChange={(e) => set(e.target.value)}
                />
                <button className="st-eye" onClick={toggle} type="button">
                  {show ? <FaEye /> : <FaEyeSlash />}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="st-card-actions">
          <button className="st-btn-primary" onClick={handlePasswordUpdate}>Update Password</button>
        </div>
      </div>

      {/* ── Footer Actions ─────────────────────────────── */}
      <div className="st-footer-actions">
        <button className="st-btn-secondary" onClick={() => navigate("/home")}>Cancel</button>
        <button className="st-btn-primary" onClick={handleSubmitAll}>Save Changes</button>
      </div>
    </div>
  );
}
