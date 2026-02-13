import React from "react";
import "../../Styles/Footer.css";

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer>
      © {currentYear} Udoyra.  All rights reserved.
    </footer>
  );
}

export default Footer;

