import React from "react";
import { Routes, Route } from "react-router-dom";
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

// Layouts
import Layout from "./MyComponents/CommonComponent/Layout";
import LayoutModule from "./MyComponents/CommonComponent/LayoutModule";


// Module Pages
import Product from "./MyComponents/ProductComponent/Product";
import ProductType from "./MyComponents/ProductTypeComponent/ProductType";
import Vendor from "./MyComponents/VendorComponent/Vendor";
import Report from "./MyComponents/ReportComponent/Reports";
import Inventory from "./MyComponents/InventoryComponent/Inventory";
import Sales from "./MyComponents/SalesComponent/Sales";
import Role from "./MyComponents/RoleComponent/Role";
import Unauthorized from "./MyComponents/SecurityComponent/Unauthorized";
import GenerateReport from "./MyComponents/ReportComponent/GenerateReport";
import VendorOnboarding from "./MyComponents/VendorOnboarding";
import SalesAddNew from "./MyComponents/SalesComponent/SalesAddNew";

// 🔒 FRONTEND MODULE GUARD
import ModuleGuard from "./MyComponents/SecurityComponent/ModuleGuard";

function App() {
  return (
    <>
    {/* 🔥 GLOBAL TOAST CONTAINER */}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        closeOnClick
        pauseOnHover
      />
    <Routes>
      {/* LOGIN PAGE */}
      <Route
        path="/"
        element={
          <>
            <div className="container">
              <LoginSection />
              <VMSSection />
            </div>
            <Footer />
          </>
        }
      />

      {/* HOME PAGE */}
      <Route path="/home" element={<Layout />}>
        <Route index element={<Home />} />
      </Route>

            <Route path="/onboarding" element={<Layout />}>
        <Route index element={<VendorOnboarding />} />
      </Route>

      <Route path="/setting" element={<Layout />}>
        <Route index element={<Setting />} />
      </Route>
      {/* MODULE PAGES */}
      <Route path="/master" element={<LayoutModule />}>

        {/* PRODUCT */}
        <Route
          path="product"
          element={
            <ModuleGuard moduleName="PRODUCT">
              <Product />
            </ModuleGuard>
          }
        />

        {/* PRODUCT TYPE */}
        <Route
          path="product-type"
          element={
            <ModuleGuard moduleName="PRODUCT_TYPE">
              <ProductType />
            </ModuleGuard>
          }
        />

        {/* VENDOR */}
        <Route
          path="vendor"
          element={
            <ModuleGuard moduleName="VENDOR">
              <Vendor />
            </ModuleGuard>
          }
        />

        {/* REPORTS */}
        <Route
          path="reports"
          element={
            <ModuleGuard moduleName="REPORTS">
              <Report />
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

        {/* INVENTORY */}
        <Route
          path="inventory"
          element={
            <ModuleGuard moduleName="INVENTORY">
              <Inventory />
            </ModuleGuard>
          }
        />

        {/* SALES */}
        <Route
          path="sales"
          element={
            <ModuleGuard moduleName="SALES">
              <Sales />
            </ModuleGuard>
          }
        />

        {/* ROLES */}
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
      </Route>
      
      {/* UNAUTHORIZED PAGE */}
      <Route path="/unauthorized" element={<Unauthorized />} />
    </Routes>
    </>
  );
}

export default App;
