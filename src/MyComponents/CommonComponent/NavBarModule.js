import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../../Styles/NavBarModule.css";
import udoyralogo from "../../Images/udoyraname.png";
import udyorawingslogo from "../../Images/udyora_wings.svg";

export default function NavBarModule({ sidebarOpen }) {
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
      const res = await fetch("http://localhost:8080/api/auth/logout", {
        method: "POST",
        credentials: "include",
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

      {/* scanline */}
      <div className="nbm-scan" />

      {/* ── LEFT: Logo ─────────────────────────────────────── */}
      <div className="nbm-left">
        <img src={udoyralogo} alt="Udoyra" className="nbm-logo" />

        {vendorShop && (
          <div className="nbm-shop-pill">
            <span className="nbm-dot" />
            <span className="nbm-shop-name">{vendorShop}</span>
          </div>
        )}
      </div>

      {/* ── RIGHT: Greeting + Avatar ────────────────────────── */}
      <div className="nbm-right">

        <div className="nbm-greeting">
          <span className="nbm-hi">Hello,</span>
          <span className="nbm-name">{vendorName.split(" ")[0]}</span>
        </div>

        <div className="nbm-profile-wrap" ref={profileRef} onClick={() => setDropdownOpen(!dropdownOpen)}>

          {/* Avatar */}
          <div className={`nbm-avatar ${dropdownOpen ? "open" : ""}`}>
            {profileImage
              ? <img src={profileImage} alt="Profile" className="nbm-avatar-img" />
              : <span className="nbm-avatar-initials">{initials}</span>
            }
            <span className="nbm-avatar-ring" />
          </div>

          {/* Dropdown */}
          <div className={`nbm-dropdown ${dropdownOpen ? "show" : ""}`}>

            {/* User info header */}
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

            {/* Settings */}
            <button
              className="nbm-dd-item"
              onClick={(e) => { e.stopPropagation(); setDropdownOpen(false); navigate("/setting"); }}
            >
              <svg width="15" height="15" viewBox="0 -960 960 960" fill="currentColor">
                <path d="M370-80l-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-1 13.5l103 78-110 190-119-50q-11 8-23 15t-24 12L590-80H370Zm112-260q58 0 99-41t41-99q0-58-41-99t-99-41q-58 0-99 41t-41 99q0 58 41 99t99 41Z"/>
              </svg>
              <span>Settings</span>
            </button>

            {/* Logout */}
            <button
              className="nbm-dd-item nbm-dd-logout"
              onClick={(e) => { e.stopPropagation(); handleLogout(); }}
            >
              <svg width="15" height="15" viewBox="0 -960 960 960" fill="currentColor">
                <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h280v80H200Zm440-160-55-58 102-102H360v-80h327L585-622l55-58 200 200-200 200Z"/>
              </svg>
              <span>Logout</span>
            </button>

          </div>
        </div>
      </div>
    </header>
  );
}
