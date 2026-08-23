import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../../Styles/NavBarModule.css";
import udoyralogo from "../../Images/udoyraname.png";
import ThemeToggle from "./ThemeToggle";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

export default function NavBarModule({ sidebarOpen, theme, onToggleTheme }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [scrolled, setScrolled]         = useState(false);
  const navigate    = useNavigate();
  const profileRef  = useRef(null);

  const user         = JSON.parse(localStorage.getItem("vmsUser")) || {};
  const vendorName   = user?.data?.name      || "Vendor";
  const vendorShop   = user?.data?.shopName  || "";
  const profileImage = user?.data?.profilePhoto || null;

  const initials = vendorName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  /* scroll shadow */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* close on outside click */
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
    <header className={`nbm-bar ${sidebarOpen ? "shifted" : ""} ${scrolled ? "scrolled" : ""}`}>

      <div className="nbm-left">
        <span className="nbm-logo-wrap">
          <img src={udoyralogo} alt="Udoyra" className="nbm-logo" />
        </span>

        {vendorShop && (
          <div className="nbm-shop-badge">
            <span className="nbm-shop-badge-icon">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1.5 6.3l1-4.1h11l1 4.1" />
                <path d="M2 6.3v6.7a1 1 0 001 1h10a1 1 0 001-1V6.3" />
                <path d="M1.5 6.3a1.9 1.9 0 003.8 0M5.3 6.3a1.9 1.9 0 003.8 0M9.1 6.3a1.9 1.9 0 003.8 0" />
                <path d="M6.2 14v-3.2h3.6V14" />
              </svg>
            </span>
            <span className="nbm-shop-badge-name">{vendorShop}</span>
          </div>
        )}
      </div>

      <div className="nbm-right">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />

        <div className="nbm-greeting">
          <span className="nbm-hi">Hello,</span>
          <span className="nbm-name">{vendorName.split(" ")[0]}</span>
        </div>

        <div className="nbm-profile-wrap" ref={profileRef} onClick={() => setDropdownOpen(!dropdownOpen)}>
          <div className={`nbm-avatar ${dropdownOpen ? "open" : ""}`}>
            {profileImage
              ? <img src={profileImage} alt="Profile" className="nbm-avatar-img" />
              : <span className="nbm-avatar-initials">{initials}</span>
            }
            <span className="nbm-avatar-status" />
          </div>

          <div className={`nbm-dropdown ${dropdownOpen ? "show" : ""}`}>
            <div className="nbm-dd-user">
              <div className="nbm-dd-avatar-sm">
                {profileImage
                  ? <img src={profileImage} alt="" />
                  : <span>{initials}</span>
                }
              </div>
              <div className="nbm-dd-info">
                <div className="nbm-dd-name">{vendorName}</div>
                {vendorShop && <div className="nbm-dd-shop">{vendorShop}</div>}
              </div>
            </div>

            <div className="nbm-dd-divider" />

            <button
              className="nbm-dd-item"
              onClick={(e) => { e.stopPropagation(); setDropdownOpen(false); navigate("/setting"); }}
            >
              <span className="nbm-dd-icon-chip nbm-dd-icon-chip--settings">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="8" cy="8" r="2.4" />
                  <path d="M8 1.5v1.6M8 12.9v1.6M14.5 8h-1.6M3.1 8H1.5M12.4 3.6l-1.1 1.1M4.7 11.3l-1.1 1.1M12.4 12.4l-1.1-1.1M4.7 4.7L3.6 3.6" />
                </svg>
              </span>
              <span>Settings</span>
            </button>

            <button
              className="nbm-dd-item nbm-dd-logout"
              onClick={(e) => { e.stopPropagation(); handleLogout(); }}
            >
              <span className="nbm-dd-icon-chip nbm-dd-icon-chip--logout">
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
