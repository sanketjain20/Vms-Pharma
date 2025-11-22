import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../Styles/Navbar.css";

export default function Navbar({ sidebarOpen }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate(); // ✅ Initialize navigate

  const user = JSON.parse(localStorage.getItem("vmsUser")) || {};
  const vendorName = user?.data?.name || "Vendor";
  const vendorShop = user?.data?.shopName || "";

  const initials = vendorName
    .split(" ")
    .map(n => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const vendorImage = user?.data?.vendorImage || null;

  const handleProfileClick = () => {
    setDropdownOpen(!dropdownOpen);
  };

  const handleLogout = async () => {
    try {
      const response = await fetch("http://localhost:8080/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        localStorage.removeItem("vmsUser"); // clear user data
        navigate("/"); // ✅ redirect to login page
      } else {
        alert("Logout failed");
      }
    } catch (error) {
      console.error("Logout error:", error);
      alert("An error occurred during logout");
    }
  };

  const handleSettings = () => {
    navigate("/settings"); // ✅ use React Router navigation
  };

  return (
    <header className={`topbar ${sidebarOpen ? "shifted" : ""}`}>
      <div className="logo-container">
        <span>VMS Digital</span>
        {vendorImage ? (
          <img src={vendorImage} alt={vendorShop} className="vendor-logo" />
        ) : (
          <span className="vendor-name">{vendorShop}</span>
        )}
      </div>

      <div className="topbar-right">
        <div className="profile" onClick={handleProfileClick}>
          {initials}
          {dropdownOpen && (
            <div className="profile-dropdown">
              <div className="dropdown-item" onClick={handleSettings}>
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#FFFFFF"><path d="M600-120h240v-33q-25-23-56-35t-64-12q-33 0-64 12t-56 35v33Zm120-120q25 0 42.5-17.5T780-300q0-25-17.5-42.5T720-360q-25 0-42.5 17.5T660-300q0 25 17.5 42.5T720-240ZM480-480Zm2-140q-58 0-99 41t-41 99q0 48 27 84t71 50q0-23 .5-44t8.5-38q-14-8-20.5-22t-6.5-30q0-25 17.5-42.5T482-540q15 0 28.5 7.5T533-512q11-5 23-7t24-2h36q-13-43-49.5-71T482-620ZM370-80l-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-85 65H696q-1-5-2-10.5t-3-10.5l86-65-39-68-99 42q-22-23-48.5-38.5T533-694l-13-106h-79l-14 106q-31 8-57.5 23.5T321-633l-99-41-39 68 86 64q-5 15-7 30t-2 32q0 16 2 31t7 30l-86 65 39 68 99-42q24 25 54 42t65 22v184h-70Zm210 40q-25 0-42.5-17.5T520-100v-280q0-25 17.5-42.5T580-440h280q25 0 42.5 17.5T920-380v280q0 25-17.5 42.5T860-40H580Z"/></svg>
                 Settings 
              </div>
              <div className="dropdown-item" onClick={handleLogout}>
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#FFFFFF"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h280v80H200Zm440-160-55-58 102-102H360v-80h327L585-622l55-58 200 200-200 200Z"/></svg>Logout
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
