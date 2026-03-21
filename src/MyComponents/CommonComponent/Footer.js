import React from "react";
import "../../Styles/Footer.css";

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="vms-footer">

      {/* Top glow line */}
      <div className="footer-glow-line" />

      {/* Scanline sweep */}
      <div className="footer-scan" />

      <div className="footer-inner">

        {/* LEFT — Brand */}
        <div className="footer-brand">
          <span className="footer-logo-text">UDOYRA</span>
          <span className="footer-tagline">Vendor Management System</span>
        </div>

        {/* CENTER — Copyright */}
        <div className="footer-copy">
          <span className="footer-dot" />
          <span>© {currentYear} Udoyra. All rights reserved.</span>
          <span className="footer-dot" />
        </div>

        {/* RIGHT — Status */}
        <div className="footer-status">
          <span className="status-pulse" />
          <span className="f-status-text">System Online</span>
        </div>

      </div>
    </footer>
  );
}

export default Footer;
