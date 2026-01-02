import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../Styles/Setting.css";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function Settings() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [shopName, setShopName] = useState("");
  const [email, setEmail] = useState("");
  const [isEditingShop, setIsEditingShop] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState(
    "https://via.placeholder.com/140"
  );

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const fetchUrl = "http://localhost:8080/api/Vendor/SettingDetails";

  /* ================= FETCH SETTINGS ================= */
  useEffect(() => {
    fetch(fetchUrl, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 200) {
          setShopName(data.data.shopName);
          setEmail(data.data.email);
          if (data.data.profilePhoto) {
            setProfilePhoto(data.data.profilePhoto);
          }
        } else {
          toast.error(data.message || "Failed to load settings");
        }
      })
      .catch(() => {
        toast.error("Unable to fetch settings");
      });
  }, []);

  /* ================= SHOP NAME ================= */
  const handleShopEdit = () => setIsEditingShop(true);

  const handleShopSubmit = () => {
    if (!shopName.trim()) {
      toast.warning("Shop name cannot be empty");
      return;
    }

    fetch("http://localhost:8080/api/Vendor/UpdateShopName", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopName }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 200) {
          toast.success(data.message || "Shop name updated");
          setIsEditingShop(false);
        } else {
          toast.error(data.message || "Failed to update shop name");
        }
      })
      .catch(() => toast.error("Shop name update failed"));
  };

  /* ================= PASSWORD ================= */
  const handlePasswordUpdate = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.warning("All password fields are required");
      return;
    }
    if(currentPassword === newPassword) {
      toast.error("New password must be different from current password");
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirm new password do not match");
      return;
    }

    fetch("http://localhost:8080/api/Vendor/UpdatePassword", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email,
        oldPassword: currentPassword,
        newPassword: newPassword,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 200) {
          toast.success(data.message || "Password updated successfully");
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        } else {
          toast.error(data.message || "Password update failed");
        }
      })
      .catch(() => toast.error("Something went wrong"));
  };

  /* ================= PROFILE PHOTO ================= */
  const handleChangePhotoClick = () => {
    fileInputRef.current.click();
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setProfilePhoto(URL.createObjectURL(file));

    // optional upload API later
    // const formData = new FormData();
    // formData.append("photo", file);
  };

  /* ================= NAVIGATION ================= */
  const handleCancel = () => navigate("/home");

  return (
    <div className="settings-container">
      <ToastContainer position="top-right" autoClose={3000} />

      <h2 className="settings-title">Account Settings</h2>

      {/* ================= PROFILE ================= */}
      <div className="settings-card">
        <h3>Profile Information</h3>

        <div className="profile-photo">
          <img src={profilePhoto} alt="Profile" />
          <button className="btn-secondary" onClick={handleChangePhotoClick}>
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
                type="text"
                value={shopName}
                disabled={!isEditingShop}
                onChange={(e) => setShopName(e.target.value)}
              />
              {!isEditingShop ? (
                <button className="btn-link" onClick={handleShopEdit}>
                  Change
                </button>
              ) : (
                <button
                  className="btn-link success"
                  onClick={handleShopSubmit}
                >
                  Submit
                </button>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} disabled />
          </div>
        </div>
      </div>

      {/* ================= PASSWORD ================= */}
      <div className="settings-card">
        <h3>Change Password</h3>

        <div className="form-row">
          <div className="form-group">
            <label>Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group full-width">
            <label>Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
        </div>

        <div className="section-actions">
          <button className="btn-primary" onClick={handlePasswordUpdate}>
            Update Password
          </button>
        </div>
      </div>

      <div className="section-actions right">
        <button className="btn-secondary" onClick={handleCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
