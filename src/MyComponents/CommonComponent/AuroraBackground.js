import React from "react";
import "../../Styles/AuroraBackground.css";

/* Fixed, full-viewport gradient-mesh backdrop. Home page only — see
   AuroraBackground.css for the theme-aware color tokens. */
export default function AuroraBackground() {
  return (
    <div className="aurora-bg" aria-hidden="true">
      <span className="aurora-blob aurora-blob-1" />
      <span className="aurora-blob aurora-blob-2" />
      <span className="aurora-blob aurora-blob-3" />
      <span className="aurora-blob aurora-blob-4" />
    </div>
  );
}
