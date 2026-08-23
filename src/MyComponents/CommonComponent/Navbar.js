import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../../Styles/Navbar.css";
import udyorawingslogo from "../../Images/udyora_wings.svg";
import ThemeToggle from "./ThemeToggle";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

export default function Navbar({ sidebarOpen, theme, onToggleTheme }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const profileRef = useRef(null);

  const user = JSON.parse(localStorage.getItem("vmsUser")) || {};
  const vendorName = user?.data?.name || "Vendor";
  const vendorShop = user?.data?.shopName || "";
  const profileImage = user?.data?.profilePhoto || null;

  const initials = vendorName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Scroll shadow effect
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target))
        setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = async () => {
    try {
      const res = await apiClient(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
      });
      if (res.ok) {
        localStorage.removeItem("vmsUser");
        navigate("/");
      } else {
        alert("Logout failed");
      }
    } catch (err) {
      console.error("Logout error:", err);
      alert("An error occurred during logout");
    }
  };

  return (
    <header className={`topbar ${sidebarOpen ? "shifted" : ""} ${scrolled ? "scrolled" : ""}`}>

      <div className="topbar-left">
        <img src={udyorawingslogo} alt="Udoyra" className="brand-logo" />

        {vendorShop && (
          <div className="shop-badge">
            <span className="shop-badge-icon">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1.5 6.3l1-4.1h11l1 4.1" />
                <path d="M2 6.3v6.7a1 1 0 001 1h10a1 1 0 001-1V6.3" />
                <path d="M1.5 6.3a1.9 1.9 0 003.8 0M5.3 6.3a1.9 1.9 0 003.8 0M9.1 6.3a1.9 1.9 0 003.8 0" />
                <path d="M6.2 14v-3.2h3.6V14" />
              </svg>
            </span>
            <span className="shop-badge-name">{vendorShop}</span>
          </div>
        )}
      </div>

      <div className="topbar-right">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />

        <div className="topbar-greeting">
          <span className="greeting-hi">Hello,</span>
          <span className="greeting-name">{vendorName.split(" ")[0]}</span>
        </div>

        <div className="profile-wrap" ref={profileRef} onClick={() => setDropdownOpen(!dropdownOpen)}>
          <div className={`profile-avatar ${dropdownOpen ? "open" : ""}`}>
            {profileImage
              ? <img src={profileImage} alt="Profile" className="avatar-img" />
              : <span className="avatar-initials">{initials}</span>
            }
            <span className="avatar-status" />
          </div>

          <div className={`profile-dropdown ${dropdownOpen ? "show" : ""}`}>
            <div className="dd-user">
              <div className="dd-avatar-sm">
                {profileImage
                  ? <img src={profileImage} alt="" />
                  : <span>{initials}</span>
                }
              </div>
              <div className="dd-info">
                <div className="dd-name">{vendorName}</div>
                {vendorShop && <div className="dd-shop">{vendorShop}</div>}
              </div>
            </div>

            <div className="dd-divider" />

            <button className="dd-item" onClick={() => { setDropdownOpen(false); navigate("/setting"); }}>
              <span className="dd-icon-chip dd-icon-chip--settings">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="8" cy="8" r="2.4" />
                  <path d="M8 1.5v1.6M8 12.9v1.6M14.5 8h-1.6M3.1 8H1.5M12.4 3.6l-1.1 1.1M4.7 11.3l-1.1 1.1M12.4 12.4l-1.1-1.1M4.7 4.7L3.6 3.6" />
                </svg>
              </span>
              <span>Settings</span>
            </button>

            <button className="dd-item dd-logout" onClick={handleLogout}>
              <span className="dd-icon-chip dd-icon-chip--logout">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3" />
                  <path d="M10.3 11.3l3.3-3.3-3.3-3.3" />
                  <path d="M13.4 8H6" />
                </svg>
              </span>
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
