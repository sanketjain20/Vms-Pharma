import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../Styles/NavBarModule.css";

export default function NavBarModule({ sidebarOpen }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem("vmsUser")) || {};
  const vendorName = user?.data?.name || "Vendor";

  const initials = vendorName
    .split(" ")
    .map(n => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

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
        localStorage.removeItem("vmsUser");
        navigate("/");
      } else {
        alert("Logout failed");
      }
    } catch (error) {
      console.error("Logout error:", error);
      alert("An error occurred during logout");
    }
  };

  const handleSettings = () => {
    navigate("/settings");
  };

  return (
    <header>
      <div className="topbar-right">
        <div className="profile" onClick={handleProfileClick}>
          {initials}
          {dropdownOpen && (
            <div className="profile-dropdown">
              <div className="dropdown-item" onClick={handleSettings}>
                Settings
              </div>
              <div className="dropdown-item" onClick={handleLogout}>
                Logout
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
