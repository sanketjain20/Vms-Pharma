import React from "react";
import markForDark from "../../Images/udyora-mark-dark.png";
import markForLight from "../../Images/udyora-mark-light.png";

/* The Udyora "U" mark, picked for the theme it sits on:
   white-on-black in dark mode, black-on-white in light mode.
   Both are round 256px PNGs, transparent outside the circle
   (cropped from the brand files "Udyora - White on Black / Black on White"). */
export default function BrandMark({ theme, className = "" }) {
  const src = theme === "light" ? markForLight : markForDark;
  return <img src={src} alt="Udyora" className={className} data-theme-variant={theme === "light" ? "light" : "dark"} />;
}
