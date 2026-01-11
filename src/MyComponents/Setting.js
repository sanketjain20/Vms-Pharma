import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../Styles/Setting.css";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

/* ================= BLOB → BASE64 HELPER (ADDED) ================= */
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

  /* ================= STATE ================= */
  const [shopName, setShopName] = useState("");
  const [originalShopName, setOriginalShopName] = useState("");
  const [isEditingShop, setIsEditingShop] = useState(false);

  const [email, setEmail] = useState("");

  // REAL value from DB
  const [profilePhoto, setProfilePhoto] = useState(
    "https://via.placeholder.com/140"
  );
  const [originalProfilePhoto, setOriginalProfilePhoto] = useState(
    "https://via.placeholder.com/140"
  );

  // UI preview only
  const [previewPhoto, setPreviewPhoto] = useState(null);

  /* PASSWORD */
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  /* ================= FETCH SETTINGS ================= */
  useEffect(() => {
    fetch("http://localhost:8080/api/Vendor/SettingDetails", {
      method: "GET",
      credentials: "include",
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
        } else {
          toast.error(data.message || "Failed to load settings");
        }
      })
      .catch(() => toast.error("Unable to fetch settings"));
  }, []);

  /* ================= SHOP NAME ================= */
  const handleShopEdit = () => setIsEditingShop(true);

  const handleShopSave = () => {
    if (!shopName.trim()) {
      toast.warning("Shop name cannot be empty");
      return;
    }
    setIsEditingShop(false);
    toast.info("Shop name saved. Click Submit to apply changes.");
  };

  /* ================= PROFILE PHOTO ================= */
  const handleChangePhotoClick = () => fileInputRef.current.click();

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // ONLY preview (do NOT touch DB value)
    setPreviewPhoto(URL.createObjectURL(file));
    toast.info("Photo selected. Click Submit to apply.");
  };

  /* ================= GLOBAL SUBMIT ================= */
  const handleSubmitAll = async () => {
    let finalPhoto = previewPhoto ? previewPhoto : profilePhoto;

    // ✅ FIX: convert blob URL before saving
    if (finalPhoto && finalPhoto.startsWith("blob:")) {
      finalPhoto = await blobToBase64(finalPhoto);
    }

    if (
      shopName === originalShopName &&
      finalPhoto === originalProfilePhoto
    ) {
      toast.info("No changes to submit");
      return;
    }

    fetch("http://localhost:8080/api/Vendor/UpdateVendorSetting", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email,
        shopName: shopName,
        profilePicture: finalPhoto,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 200) {
          toast.success("Settings updated successfully");

          setOriginalShopName(shopName);
          setProfilePhoto(finalPhoto);
          setOriginalProfilePhoto(finalPhoto);
          setPreviewPhoto(null);
        } else {
          toast.error(data.message || "Failed to update settings");
        }
      })
      .catch(() => toast.error("Update failed. Please try again"));
  };

  /* ================= PASSWORD ================= */
  const handlePasswordUpdate = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.warning("All password fields are required");
      return;
    }

    if (currentPassword === newPassword) {
      toast.error("New password must be different");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    fetch("http://localhost:8080/api/Vendor/UpdatePassword", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        oldPassword: currentPassword,
        newPassword,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 200) {
          toast.success("Password updated");
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        } else {
          toast.error(data.message || "Password update failed");
        }
      });
  };

  const handleCancel = () => navigate("/home");

  /* ================= UI ================= */
  return (
    <div className="settings-container">
      <ToastContainer position="top-right" autoClose={3000} />

      <h2 className="settings-title">Account Settings</h2>

      {/* PROFILE */}
      <div className="settings-card">
        <h3>Profile Information</h3>

        <div className="profile-photo">
          <img src={previewPhoto || profilePhoto} alt="Profile" />

          <button className="set-btn-primary" onClick={handleChangePhotoClick}>
            Change Photo
          </button>

          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            style={{ display: "none" }}
            onChange={handlePhotoChange}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Shop Name</label>
            <div className="inline-edit">
              <input
                value={shopName}
                disabled={!isEditingShop}
                onChange={(e) => setShopName(e.target.value)}
              />

              {!isEditingShop ? (
                <button className="btn-link" onClick={handleShopEdit}>
                  Change
                </button>
              ) : (
                <button className="btn-link success" onClick={handleShopSave}>
                  Save
                </button>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>Email</label>
            <input value={email} disabled />
          </div>
        </div>
      </div>

      {/* PASSWORD */}
      <div className="settings-card">
        <h3>Change Password</h3>

        <div className="form-row">
          <input
            type="password"
            placeholder="Current Password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <input
            type="password"
            placeholder="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>

        <input
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <button className="set-btn-primary" onClick={handlePasswordUpdate}>
          Update Password
        </button>
      </div>

      {/* ACTIONS */}
      <div className="section-actions right">
        <button className="set-btn-primary" onClick={handleSubmitAll}>
          Submit
        </button>
        <button className="set-btn-secondary" onClick={handleCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
