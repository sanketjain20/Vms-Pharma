import { useRef, useEffect } from "react";

const FilterMenu = ({ id, children, openFilter, setOpenFilter }) => {
  const menuRef = useRef();

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenFilter(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [setOpenFilter]);

  return (
    <div style={{ position: "relative" }} ref={menuRef}>
      <button
        onClick={() => setOpenFilter(openFilter === id ? null : id)}
        style={{
          background: "#222",
          color: "#fff",
          border: "1px solid #555",
          borderRadius: "6px",
          padding: "4px 8px",
          cursor: "pointer",
        }}
      >
        ⚙️
      </button>

      <div
        style={{
          position: "absolute",
          top: "40px",
          right: "0",
          background: "#111",
          border: "1px solid #444",
          borderRadius: "8px",
          padding: "12px",
          zIndex: 10,
          minWidth: "190px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",

          /* ✨ Animation */
          opacity: openFilter === id ? 1 : 0,
          transform: openFilter === id ? "translateY(0px)" : "translateY(-10px)",
          pointerEvents: openFilter === id ? "auto" : "none",
          transition: "all 0.25s ease",
        }}
      >
        {children}
      </div>
    </div>
  );
};
