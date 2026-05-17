import React from "react";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import Footer from "./Footer";
import "../../Styles/layout.css";

function Layout({ theme, onToggleTheme }) {
  return (
    <div className="layout">
      <Sidebar />

      <div className="layout-main">
        <Navbar theme={theme} onToggleTheme={onToggleTheme} />

        <div className="layout-content">
          <Outlet />
        </div>
        <Footer />
      </div>
    </div>
  );
}

export default Layout;
