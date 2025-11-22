import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../../Styles/Sidebar.css";

// Icon Mapping (same as before)
const iconMap = { 
  home: ( <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#FFFFFF"><path d="M240-200h120v-240h240v240h120v-360L480-740 240-560v360Zm-80 80v-480l320-240 320 240v480H520v-240h-80v240H160Zm320-350Z"/></svg> ), 
  product: ( <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#FFFFFF"><path d="M440-183v-274L200-596v274l240 139Zm80 0 240-139v-274L520-457v274Zm-80 92L160-252q-19-11-29.5-29T120-321v-318q0-22 10.5-40t29.5-29l280-161q19-11 40-11t40 11l280 161q19 11 29.5 29t10.5 40v318q0 22-10.5 40T800-252L520-91q-19 11-40 11t-40-11Zm200-528 77-44-237-137-78 45 238 136Zm-160 93 78-45-237-137-78 45 237 137Z"/></svg> ), 
  producttype: ( <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#FFFFFF"><path d="m260-520 220-360 220 360H260ZM700-80q-75 0-127.5-52.5T520-260q0-75 52.5-127.5T700-440q75 0 127.5 52.5T880-260q0 75-52.5 127.5T700-80Zm-580-20v-320h320v320H120Zm580-60q42 0 71-29t29-71q0-42-29-71t-71-29q-42 0-71 29t-29 71q0 42 29 71t71 29Zm-500-20h160v-160H200v160Zm202-420h156l-78-126-78 126Zm78 0ZM360-340Zm340 80Z"/></svg> ),
  vendor: ( <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#FFFFFF"><path d="M480-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM160-160v-112q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440q66 0 130 15.5T736-378q29 15 46.5 43.5T800-272v112H160Zm80-80h480v-32q0-11-5.5-20T700-306q-54-27-109-40.5T480-360q-56 0-111 13.5T260-306q-9 5-14.5 14t-5.5 20v32Zm240-320q33 0 56.5-23.5T560-640q0-33-23.5-56.5T480-720q-33 0-56.5 23.5T400-640q0 33 23.5 56.5T480-560Zm0-80Zm0 400Z"/></svg> ), 
  inventory: ( <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#FFFFFF"><path d="M620-163 450-333l56-56 114 114 226-226 56 56-282 282Zm220-397h-80v-200h-80v120H280v-120h-80v560h240v80H200q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h167q11-35 43-57.5t70-22.5q40 0 71.5 22.5T594-840h166q33 0 56.5 23.5T840-760v200ZM480-760q17 0 28.5-11.5T520-800q0-17-11.5-28.5T480-840q-17 0-28.5 11.5T440-800q0 17 11.5 28.5T480-760Z"/></svg> ), 
  sale: ( <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#FFFFFF"><path d="M240-80q-50 0-85-35t-35-85v-120h120v-560l60 60 60-60 60 60 60-60 60 60 60-60 60 60 60-60 60 60 60-60v680q0 50-35 85t-85 35H240Zm480-80q17 0 28.5-11.5T760-200v-560H320v440h360v120q0 17 11.5 28.5T720-160ZM360-600v-80h240v80H360Zm0 120v-80h240v80H360Zm320-120q-17 0-28.5-11.5T640-640q0-17 11.5-28.5T680-680q17 0 28.5 11.5T720-640q0 17-11.5 28.5T680-600Zm0 120q-17 0-28.5-11.5T640-520q0-17 11.5-28.5T680-560q17 0 28.5 11.5T720-520q0 17-11.5 28.5T680-480ZM240-160h360v-80H200v40q0 17 11.5 28.5T240-160Zm-40 0v-80 80Z"/></svg> ), 
  default: ( <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#FFFFFF"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-507h560v-133H200v133Zm0 214h560v-134H200v134Zm0 213h560v-133H200v133Zm40-454v-80h80v80h-80Zm0 214v-80h80v80h-80Zm0 214v-80h80v80h-80Z"/></svg> ) 
};

// helper: normalize module name for comparisons
const normalize = (s = "") =>
  String(s).toLowerCase().replace(/[^a-z0-9]/g, "");

export default function Sidebar() {
  const [open, setOpen] = useState(false); // main sidebar open state
  const [modules, setModules] = useState([]);
  const [error, setError] = useState("");
  const [hoveredMenu, setHoveredMenu] = useState(null); // submenu hover
  const navigate = useNavigate();
  const sidebarRef = useRef(null); // ref for the sidebar
  const toggleRef = useRef(null);  // ref for the toggle button

  // Fetch modules
  useEffect(() => {
    fetch("http://localhost:8080/api/Access/GetModules", {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" }
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.status === 200 && Array.isArray(data.data)) {
          setModules(data.data);
        } else {
          setError("No modules available.");
        }
      })
      .catch(() => setError("Failed to load modules."));
  }, []);

  // Close main sidebar if click outside (but not toggle button)
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target) &&
        toggleRef.current &&
        !toggleRef.current.contains(event.target)
      ) {
        setOpen(false);
        setHoveredMenu(null); // also close submenu
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formatName = (name) =>
    name.toString().toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const handleNavigation = (moduleName) => {
    const routeName = moduleName.toLowerCase().replace(/_/g, "-");
    navigate(`/master/${routeName}`);
  };

  const findModuleOriginal = (targetNorm) =>
    modules.find((m) => normalize(m) === targetNorm) || null;

  const normalizedSet = new Set(modules.map((m) => normalize(m)));

  const hasProduct = normalizedSet.has("product");
  const hasProductType = normalizedSet.has("producttype");

  const originalProduct = findModuleOriginal("product");
  const originalProductType = findModuleOriginal("producttype");

  return (
    <>
      {/* Toggle Button */}
      <div className="sidebar-toggle" ref={toggleRef} onClick={() => setOpen(!open)}>☰</div>

      {/* Sidebar */}
      <aside ref={sidebarRef} className={`sidebar ${open ? "open" : ""}`}>
        <div className={`logo ${open ? "show" : ""}`}></div>

        <div className="nav-list">
          {/* HOME */}
          <div className="nav-item" data-tooltip="Home" onClick={() => navigate("/home")}>
            <span className="nav-icon">{iconMap.home}</span>
            <span className="nav-text">Home</span>
          </div>

          {/* PRODUCT & TYPE */}
          {(hasProduct || hasProductType) && (
            <div
              className="nav-item submenu-parent"
              data-tooltip="Product & Type"
              onMouseEnter={() => setHoveredMenu("product")}
              onMouseLeave={() => setHoveredMenu(null)}
            >
              <span className="nav-icon">{iconMap.product}</span>
              <span className="nav-text">Product & Type</span>

              {(open || hoveredMenu === "product") && (
                <div
                  className="submenu"
                  style={{ left: open ? 200 : 60 }}
                >
                  {hasProduct && (
                    <div className="submenu-item" onClick={() => handleNavigation(originalProduct || "Product")}>
                      <span className="nav-text">Product</span>
                    </div>
                  )}
                  {hasProductType && (
                    <div className="submenu-item" onClick={() => handleNavigation(originalProductType || "ProductType")}>
                      <span className="nav-text">Product Type</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* OTHER MODULES */}
          {modules.filter((m) => normalize(m) !== "product" && normalize(m) !== "producttype")
            .map((mod) => (
              <div
                key={mod}
                className="nav-item"
                data-tooltip={formatName(mod)}
                onClick={() => handleNavigation(mod)}
                onMouseEnter={() => setHoveredMenu(normalize(mod))}
                onMouseLeave={() => setHoveredMenu(null)}
              >
                <span className="nav-icon">{iconMap[normalize(mod)] || iconMap.default}</span>
                <span className="nav-text">{formatName(mod)}</span>
              </div>
            ))}

          {error && <div className="nav-item error"><span className="nav-text">{error}</span></div>}
        </div>
      </aside>
    </>
  );
}
