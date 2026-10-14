import React, { useEffect, useState } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./Styles/Toast.css";


import "./App.css";

// Pages & Components
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
import Accounting from "./MyComponents/AccountingComponent/Accounting";
import OperationsWorkspace from "./MyComponents/OperationsComponent/OperationsWorkspace";
import PurchaseOrder from "./MyComponents/PurchaseOrderComponent/PurchaseOrder";
import SalesOrder from "./MyComponents/SalesOrderComponent/SalesOrder";
import DeliveryChallan from "./MyComponents/DeliveryChallanComponent/DeliveryChallan";
import StockTransfer from "./MyComponents/StockTransferComponent/StockTransfer";
import Gstr2Recon from "./MyComponents/Gstr2ReconComponent/Gstr2Recon";
import EInvoice from "./MyComponents/EInvoiceComponent/EInvoice";
import FieldRep from "./MyComponents/FieldRepComponent/FieldRep";
import FieldOrder from "./MyComponents/FieldOrderComponent/FieldOrder";
import FieldCollection from "./MyComponents/FieldCollectionComponent/FieldCollection";
import EwayBill from "./MyComponents/EwayBillComponent/EwayBill";
import VendorOnboarding from "./MyComponents/VendorOnboarding";
import SalesAddNew from "./MyComponents/SalesComponent/SalesAddNew";
import Dashboard from "./MyComponents/DashboardComponent/Dashboard"
import Intelligence from "./MyComponents/IntelligenceComponent/Intelligence";
import JobScheduler from "./MyComponents/JobScheduler/JobScheduler";
import JobView from "./MyComponents/JobScheduler/JobSchedulerView";
import JobEdit from "./MyComponents/JobScheduler/JobSchedulerEdit";
import ForgotPassword from "./MyComponents/LoginComponent/ForgotPassword";
import SetPassword from "./MyComponents/LoginComponent/SetPassword";
import Retailer from "./MyComponents/RetailerComponent/Retailer";
import Manufacturer from "./MyComponents/ManufacturerComponent/Manufacturer";
import Godown from "./MyComponents/GodownComponent/Godown";
import Scheme from "./MyComponents/SchemeComponent/Scheme";
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
import MargImport from "./MyComponents/MargImportComponent/MargImport";
import ShortcutHelp from "./MyComponents/CommonComponent/ShortcutHelp";
// 🔒 FRONTEND MODULE GUARD
import ModuleGuard from "./MyComponents/SecurityComponent/ModuleGuard";
import RequireAuth from "./MyComponents/SecurityComponent/RequireAuth";
import GuestOnly from "./MyComponents/SecurityComponent/GuestOnly";
import RepApp from "./MyComponents/RepAppComponent/RepApp";
import { ImPodcast } from "react-icons/im";
import API_BASE_URL from "./Config/api.config";
import apiClient from "./Config/apiClient";

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("vmsTheme") || "dark");
  const [activeGodownId, setActiveGodownId] = useState(() => localStorage.getItem("activeGodownId") || "");
  const [godowns, setGodowns] = useState([]);

  useEffect(() => {
    document.body.dataset.theme = theme;
    localStorage.setItem("vmsTheme", theme);
  }, [theme]);

  // Load the vendor's godowns once authenticated, and reconcile the persisted
  // active-godown id against the live list — a single-godown vendor (the
  // common case pre-feature) never sees anything change; only guard against
  // firing before login exists, or every page load 401s on the login screen.
  useEffect(() => {
    let token = null;
    try { token = JSON.parse(localStorage.getItem("vmsUser") || "null")?.data?.token; } catch { /* clear or malformed session; auth guard handles it */ }
    if (!token) return;
    apiClient(`${API_BASE_URL}/api/Godown/GetGodownDropdown`, { method: "GET" })
      .then(r => r.json())
      .then(json => {
        if (json?.status !== 200 || !Array.isArray(json.data)) return;
        setGodowns(json.data);
        const stillValid = json.data.some(g => String(g.id) === activeGodownId);
        if (!stillValid) {
          const fallback = json.data.find(g => g.isDefault) || json.data[0];
          if (fallback) setActiveGodownId(String(fallback.id));
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeGodownId) localStorage.setItem("activeGodownId", activeGodownId);
  }, [activeGodownId]);

  // Switching godowns changes what every list/report reads (via the
  // X-Godown-Id header in apiClient) — a full reload is the simplest way to
  // guarantee every already-mounted screen (DynamicGrid has no external
  // refresh handle) picks up the new scope rather than showing stale data.
  const handleChangeGodown = (id) => {
    setActiveGodownId(String(id));
    window.location.reload();
  };

  useEffect(() => {
    installGlobalBusyFetchInterceptor();
  }, []);

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  };
const navigate = useNavigate();
const { pathname } = useLocation();
const isRepApp = pathname === "/rep" || pathname.startsWith("/rep/");
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
            <GuestOnly>
            <>
            <div className="login-page">

            <LoginPage />



            </div>
            <Footer />
</>
            </GuestOnly>
          }

        />


        <Route
          path="/forgotpassword"
          element={
            <GuestOnly>
              <>
                <div className="container">
                  <ForgotPassword />
                </div>
                <Footer />
              </>
            </GuestOnly>
          }
        />

        {/* Unguarded (unlike the routes above): the invitee has no session yet,
            and a stray existing session on the same browser shouldn't hijack
            an invite link via GuestOnly's redirect. */}
        <Route
          path="/set-password"
          element={
            <>
              <div className="container">
                <SetPassword />
              </div>
              <Footer />
            </>
          }
        />



        {/* Field-rep app: its own phone-first shell, no office Layout. */}
        <Route path="/rep" element={<RequireAuth allowRep><RepApp theme={theme} onToggleTheme={toggleTheme} /></RequireAuth>} />

        <Route path="/home" element={<RequireAuth><Layout theme={theme} onToggleTheme={toggleTheme} /></RequireAuth>}>
          <Route index element={<Home />} />
        </Route>

        <Route path="/onboarding" element={<RequireAuth><Layout theme={theme} onToggleTheme={toggleTheme} /></RequireAuth>}>
          <Route index element={<VendorOnboarding />} />
        </Route>

        <Route path="/shortcut-help" element={<RequireAuth><Layout theme={theme} onToggleTheme={toggleTheme} /></RequireAuth>}>
          <Route index element={<ShortcutHelp />} />
        </Route>

        <Route path="/setting" element={<RequireAuth><Layout theme={theme} onToggleTheme={toggleTheme} /></RequireAuth>}>
          <Route index element={<Setting />} />
        </Route>

        <Route path="/master" element={<RequireAuth><LayoutModule theme={theme} onToggleTheme={toggleTheme} activeGodownId={activeGodownId} godowns={godowns} onChangeGodown={handleChangeGodown} /></RequireAuth>}>

          
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
            path="godown"
            element={
              <ModuleGuard moduleName="GODOWN">
                <Godown />
              </ModuleGuard>
            }
          />

          <Route
            path="scheme"
            element={
              <ModuleGuard moduleName="SCHEME">
                <Scheme />
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
            path="accounting"
            element={<ModuleGuard moduleName="REPORTS"><Accounting /></ModuleGuard>}
          />

          <Route path="purchase-order" element={<ModuleGuard moduleName="PURCHASE_ORDER"><PurchaseOrder /></ModuleGuard>} />
          <Route path="sales-order" element={<ModuleGuard moduleName="SALES_ORDER"><SalesOrder /></ModuleGuard>} />
          <Route path="delivery-challan" element={<ModuleGuard moduleName="DELIVERY_CHALLAN"><DeliveryChallan /></ModuleGuard>} />
          <Route path="stock-transfer" element={<ModuleGuard moduleName="STOCK_TRANSFER"><StockTransfer /></ModuleGuard>} />
          <Route path="gst-return" element={<ModuleGuard moduleName="GST_RETURN"><OperationsWorkspace /></ModuleGuard>} />

          <Route
            path="gstr2-recon"
            element={
              <ModuleGuard moduleName="GSTR2_RECON">
                <Gstr2Recon />
              </ModuleGuard>
            }
          />

          <Route
            path="field-rep"
            element={
              <ModuleGuard moduleName="FIELD_REP">
                <FieldRep />
              </ModuleGuard>
            }
          />

          <Route
            path="field-collection"
            element={
              <ModuleGuard moduleName="FIELD_COLLECTION">
                <FieldCollection />
              </ModuleGuard>
            }
          />

          <Route
            path="field-order"
            element={
              <ModuleGuard moduleName="FIELD_ORDER">
                <FieldOrder />
              </ModuleGuard>
            }
          />

          <Route
            path="e-invoice"
            element={
              <ModuleGuard moduleName="E_INVOICE">
                <EInvoice />
              </ModuleGuard>
            }
          />

          <Route
            path="e-way-bill"
            element={
              <ModuleGuard moduleName="E_WAY_BILL">
                <EwayBill />
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

          {/* Import masters / outstanding / stock from Marg exports; shares the Bulk Upload permission. */}
          <Route
            path="marg-import"
            element={
              <ModuleGuard moduleName={["BULK_UPLOAD_MANAGEMENT", "BULKUPLOADMANAGEMENT", "BULK UPLOAD MANAGEMENT"]}>
                <MargImport />
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
            path="intelligence"
            element={
              <ModuleGuard moduleName="INTELLIGENCE">
                <Intelligence />
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
      {/* The office assistant calls office APIs a field rep can't use, and its bubble would sit on the rep app's tab bar. */}
      {!isRepApp && <VmsAssistant />}
      <GlobalBusyOverlay />
    </>
  );
}

export default App;
