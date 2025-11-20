
import { Outlet } from "react-router-dom";
import NavBarModule from "./NavBarModule";
import Sidebar from "./Sidebar";
import Footer from "./Footer";
import "../Styles/layout.css";

function LayoutModule() {

  return (
    <div className="layout">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className="layout-main ">
        <NavBarModule />
        <div className="layout-content">
          <Outlet />
        </div>
        <Footer />
      </div>
    </div>
  );
}

export default LayoutModule;
