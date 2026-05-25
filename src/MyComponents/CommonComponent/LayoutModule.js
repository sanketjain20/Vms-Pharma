
import { Outlet } from "react-router-dom";
import NavBarModule from "./NavBarModule";
import Sidebar from "./Sidebar";
import Footer from "../CommonComponent/Footer";
import "../../Styles/layout.css";

function LayoutModule({ theme, onToggleTheme }) {

  return (
    <div className="layout">
      
      <Sidebar />

      
      <div className="layout-main ">
        <NavBarModule theme={theme} onToggleTheme={onToggleTheme} />
        <div className="layout-content">
          <Outlet />
        </div>
        <Footer />
      </div>
    </div>
  );
}

export default LayoutModule;
