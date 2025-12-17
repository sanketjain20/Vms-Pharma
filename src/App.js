import React from "react";
import { Routes, Route } from "react-router-dom";

import "./App.css";

// Pages & Components
import LoginSection from "./MyComponents/LoginComponent/LoginSection";
import VMSSection from "./MyComponents/LoginComponent/VMSSection";
import Home from "./MyComponents/Home";
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

// 🔒 FRONTEND MODULE GUARD
import ModuleGuard from "./MyComponents/SecurityComponent/ModuleGuard";

function App() {
  return (
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
      </Route>

      {/* UNAUTHORIZED PAGE */}
      <Route path="/unauthorized" element={<Unauthorized />} />
    </Routes>
  );
}

export default App;
