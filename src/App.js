import React, { useEffect, useState } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./Styles/Toast.css";


import "./App.css";

// Pages & Components
import LoginSection from "./MyComponents/LoginComponent/LoginSection";
import VMSSection from "./MyComponents/LoginComponent/VMSSection";
import Home from "./MyComponents/Home";
import Setting from "./MyComponents/Setting";
import Footer from "./MyComponents/CommonComponent/Footer";
import VmsAssistant from "./MyComponents/CommonComponent/VmsAssistant";
import GlobalBusyOverlay from "./MyComponents/CommonComponent/GlobalBusyOverlay";
import { installGlobalBusyFetchInterceptor } from "./utils/globalBusy";

// Layouts
import Layout from "./MyComponents/CommonComponent/Layout";
import LayoutModule from "./MyComponents/CommonComponent/LayoutModule";


// Module Pages
import Product from "./MyComponents/ProductComponent/Product";
import ProductType from "./MyComponents/ProductTypeComponent/ProductType";
import Vendor from "./MyComponents/VendorComponent/Vendor";
import Report from "./MyComponents/ReportComponent/Reports";
import Inventory from "./MyComponents/InventoryComponent/Inventory";
import ExpiryAlert from "./MyComponents/InventoryComponent/ExpiryAlert";
import ReorderAlert from "./MyComponents/InventoryComponent/ReorderAlert";
import Batch from "./MyComponents/InventoryComponent/Batch";
import Sales from "./MyComponents/SalesComponent/Sales";
import Role from "./MyComponents/RoleComponent/Role";
import Unauthorized from "./MyComponents/SecurityComponent/Unauthorized";
import OpenReport from "./MyComponents/ReportComponent/OpenReport";
import GenerateReport from "./MyComponents/ReportComponent/GenerateReport";
import VendorOnboarding from "./MyComponents/VendorOnboarding";
import SalesAddNew from "./MyComponents/SalesComponent/SalesAddNew";
import Dashboard from "./MyComponents/DashboardComponent/Dashboard"
import JobScheduler from "./MyComponents/JobScheduler/JobScheduler";
import JobView from "./MyComponents/JobScheduler/JobSchedulerView";
import JobEdit from "./MyComponents/JobScheduler/JobSchedulerEdit";
import ForgotPassword from "./MyComponents/LoginComponent/ForgotPassword";
import Retailer from "./MyComponents/RetailerComponent/Retailer";
import Manufacturer from "./MyComponents/ManufacturerComponent/Manufacturer";
import Supplier from "./MyComponents/SupplierComponent/Supplier";
import PaymentCollection from "./MyComponents/PaymentCollectionComponent/PaymentCollection";
import Purchase from "./MyComponents/PurchaseComponent/Purchase";
import PaymentCollectionPage from "./MyComponents/PaymentCollectionComponent/PaymentCollectionPage";
import SupplierPayment from "./MyComponents/SupplierPaymentComponent/SupplierPayment";
import LoginPage from "./MyComponents/LoginComponent/LoginPage";
import SalesReturn from "./MyComponents/SalesReturnComponent/SalesReturn";
import PurchaseReturn from "./MyComponents/PurchaseReturnComponent/PurchaseReturn";
import RetailerOutstanding from "./MyComponents/RetailerOutstandingComponent/RetailerOutstanding";
import SupplierOutstanding from "./MyComponents/SupplierOutstandingComponent/SupplierOutstanding";
import StockAdjustment from "./MyComponents/StockAdjustmentComponent/StockAdjustment";
import BulkUploadTransactions from "./MyComponents/BulkUploadComponent/BulkUploadTransactions";
import BulkUploadMasters from "./MyComponents/BulkUploadComponent/BulkUploadMasters";
import ShortcutHelp from "./MyComponents/CommonComponent/ShortcutHelp";
// 🔒 FRONTEND MODULE GUARD
import ModuleGuard from "./MyComponents/SecurityComponent/ModuleGuard";
import { ImPodcast } from "react-icons/im";

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("vmsTheme") || "dark");

  useEffect(() => {
    document.body.dataset.theme = theme;
    localStorage.setItem("vmsTheme", theme);
  }, [theme]);

  useEffect(() => {
    installGlobalBusyFetchInterceptor();
  }, []);

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  };
const navigate = useNavigate();
useEffect(() => {
  const shortcuts = {
    // MASTER MODULES
    p: "/master/product",
    v: "/master/vendor",
    t: "/master/product-type",
    s: "/master/sales",
    i: "/master/inventory",
    d: "/master/dashboard",
    r: "/master/reports",
    b: "/master/batch",
    a: "/master/alerts",
    k: "/master/stock-adjustment",
    q: "/master/salesshrt",
    // OTHER
    l: "/", // login
    o: "/onboarding",
    g: "/setting",
  };

  const handleKeyDown = (event) => {
    const tag = document.activeElement.tagName;

    // ❌ don't trigger while typing
    if (tag === "INPUT" || tag === "TEXTAREA") return;

    const key = event.key.toLowerCase();

    // Ctrl + Key shortcuts
    if (event.ctrlKey && shortcuts[key]) {
      event.preventDefault();
      navigate(shortcuts[key]);
    }

    // ALT shortcuts (faster ERP feel)
    if (event.altKey) {
      switch (key) {
        case "p":
          navigate("/master/product");
          break;
        case "v":
          navigate("/master/vendor");
          break;
        case "s":
          navigate("/master/sales");
          break;
        case "d":
          navigate("/master/dashboard");
          break;
        case "n":
          navigate("/master/salesshrt");
          break;
        default:
          break;
      }
    }

    // Function keys (ERP style)
    if (event.key === "F1") {
      event.preventDefault();
      navigate("/shortcut-help");
    }

    if (event.key === "F2") {
      event.preventDefault();
      navigate("/master/sales");
    }

    if (event.key === "F3") {
      event.preventDefault();
      navigate("/master/product");
    }
    if (event.key === "F4") {
      event.preventDefault();
      navigate("/master/salesshrt");
    }
    if (event.key === "F5") {
      event.preventDefault();
      navigate("/master/dashboard");
    }
  };

  window.addEventListener("keydown", handleKeyDown);

  return () => {
    window.removeEventListener("keydown", handleKeyDown);
  };
}, [navigate]);
  return (
    <>
      
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        closeOnClick
        pauseOnHover
        className="vms-toast-container"
      />
      <Routes>
        
        <Route
          path="/"
          element={
            <>
            <div className="login-page">
              
            <LoginPage />
              

              
            </div>
            <Footer />
</>
          }

        />


        <Route
          path="/forgotpassword"
          element={
            <>
              <div className="container">
                <ForgotPassword />
              </div>
              <Footer />
            </>
          }
        />


        
        <Route path="/home" element={<Layout theme={theme} onToggleTheme={toggleTheme} />}>
          <Route index element={<Home />} />
        </Route>

        <Route path="/onboarding" element={<Layout theme={theme} onToggleTheme={toggleTheme} />}>
          <Route index element={<VendorOnboarding />} />
        </Route>

        <Route path="/shortcut-help" element={<Layout theme={theme} onToggleTheme={toggleTheme} />}>
          <Route index element={<ShortcutHelp />} />
        </Route>

        <Route path="/setting" element={<Layout theme={theme} onToggleTheme={toggleTheme} />}>
          <Route index element={<Setting />} />
        </Route>
        
        <Route path="/master" element={<LayoutModule theme={theme} onToggleTheme={toggleTheme} />}>

          
          <Route
            path="product"
            element={
              <ModuleGuard moduleName="PRODUCT">
                <Product />
              </ModuleGuard>
            }
          />

          
          <Route
            path="product-type"
            element={
              <ModuleGuard moduleName="PRODUCT_TYPE">
                <ProductType />
              </ModuleGuard>
            }
          />

          
          <Route
            path="retailer"
            element={
              <ModuleGuard moduleName="RETAILER">
                <Retailer />
              </ModuleGuard>
            }
          />

          
          <Route
            path="manufacturer"
            element={
              <ModuleGuard moduleName="MANUFACTURER">
                <Manufacturer />
              </ModuleGuard>
            }
          />

          
          <Route
            path="supplier"
            element={
              <ModuleGuard moduleName="SUPPLIER">
                <Supplier />
              </ModuleGuard>
            }
          />

          
          <Route
            path="payment-collection"
            element={
              <ModuleGuard moduleName="PAYMENT_COLLECTION">
                <PaymentCollection />
              </ModuleGuard>
            }
          />


          
          <Route
            path="purchase"
            element={
              <ModuleGuard moduleName="PURCHASE">
                <Purchase />
              </ModuleGuard>
            }
          />

          <Route
            path="supplier-payment"
            element={
              <ModuleGuard moduleName="SUPPLIER_PAYMENT">
                <SupplierPayment />
              </ModuleGuard>
            }
          />

          <Route
            path="sales-return"
            element={
              <ModuleGuard moduleName="SALES_RETURN">
                <SalesReturn />
              </ModuleGuard>
            }
          />

          <Route
            path="purchase-return"
            element={
              <ModuleGuard moduleName="PURCHASE_RETURN">
                <PurchaseReturn />
              </ModuleGuard>
            }
          />

          <Route
            path="retailer-outstanding"
            element={
              <ModuleGuard moduleName="RETAILER_OUTSTANDING">
                <RetailerOutstanding />
              </ModuleGuard>
            }
          />

          <Route
            path="supplier-outstanding"
            element={
              <ModuleGuard moduleName="SUPPLIER_OUTSTANDING">
                <SupplierOutstanding />
              </ModuleGuard>
            }
          />
          
          <Route
            path="vendor"
            element={
              <ModuleGuard moduleName="VENDOR">
                <Vendor />
              </ModuleGuard>
            }
          />

          
          <Route
            path="reports"
            element={
              <ModuleGuard moduleName="REPORTS">
                <Report />
              </ModuleGuard>
            }
          />

          <Route
            path="reports/open"
            element={
              <ModuleGuard moduleName="REPORTS">
                <OpenReport />
              </ModuleGuard>
            }
          />

          <Route
            path="reports/generate"
            element={
              <ModuleGuard moduleName="REPORTS">
                <GenerateReport />
              </ModuleGuard>
            }
          />

          
          <Route
            path="inventory"
            element={
              <ModuleGuard moduleName="INVENTORY">
                <Inventory />
              </ModuleGuard>
            }
          />

          <Route
            path="alerts"
            element={
              <ModuleGuard moduleName="ALERTS">
                <ExpiryAlert />
              </ModuleGuard>
            }
          />

          <Route
            path="reorder-alerts"
            element={
              <ModuleGuard moduleName={["ALERTS", "REORDER_ALERTS", "LOW_STOCK_ALERTS"]}>
                <ReorderAlert />
              </ModuleGuard>
            }
          />

          <Route
            path="batch"
            element={
              <ModuleGuard moduleName="BATCH">
                <Batch />
              </ModuleGuard>
            }
          />

          <Route
            path="stock-adjustment"
            element={
              <ModuleGuard moduleName={["STOCK_ADJUSTMENT", "STOCKADJUSTMENT", "STOCK ADJUSTMENT"]}>
                <StockAdjustment />
              </ModuleGuard>
            }
          />

          <Route
            path="bulk-upload"
            element={
              <ModuleGuard moduleName={["BULK_UPLOAD_MANAGEMENT", "BULKUPLOADMANAGEMENT", "BULK UPLOAD MANAGEMENT"]}>
                <BulkUploadTransactions />
              </ModuleGuard>
            }
          />

          <Route
            path="bulk-upload/masters"
            element={
              <ModuleGuard moduleName={["BULK_UPLOAD_MANAGEMENT", "BULKUPLOADMANAGEMENT", "BULK UPLOAD MANAGEMENT "]}>
                <BulkUploadMasters />
              </ModuleGuard>
            }
          />

          
          <Route
            path="sales"
            element={
              <ModuleGuard moduleName="SALES">
                <Sales />
              </ModuleGuard>
            }
          />

          
          <Route
            path="roles"
            element={
              <ModuleGuard moduleName="ROLES">
                <Role />
              </ModuleGuard>
            }
          />

          <Route
            path="salesshrt"
            element={
              <ModuleGuard moduleName="SALES">
                <SalesAddNew />
              </ModuleGuard>
            }
          />

          <Route
            path="dashboard"
            element={
              <ModuleGuard moduleName="DASHBOARD">
                <Dashboard />
              </ModuleGuard>
            }
          />

          
          <Route
            path="job-scheduler"
            element={
              <ModuleGuard moduleName="JOB_SCHEDULER">
                <JobScheduler />
              </ModuleGuard>
            }
          />

          <Route
            path="job-scheduler/view/:id"
            element={
              <ModuleGuard moduleName="JOB_SCHEDULER">
                <JobView />
              </ModuleGuard>
            }
          />

          <Route
            path="job-scheduler/edit/:id"
            element={
              <ModuleGuard moduleName="JOB_SCHEDULER">
                <JobEdit />
              </ModuleGuard>
            }
          />
        </Route>

        
        <Route path="/unauthorized" element={<Unauthorized />} />
      </Routes>
      <VmsAssistant />
      <GlobalBusyOverlay />
    </>
  );
}

export default App;
