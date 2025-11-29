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
import Reports from "./MyComponents/ReportComponent/Reports";
import Inventory from "./MyComponents/InventoryComponent/Inventory";
import Sales from "./MyComponents/SalesComponent/Sales";
import Role from "./MyComponents/RoleComponent/Role";

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
        {/* Product */}
        <Route path="product" element={<Product />} />

        {/* Product Type */}
        <Route path="product-type" element={<ProductType />} />

        {/* Vendor */}
        <Route path="vendor" element={<Vendor />} />

        {/* Reports */}
        <Route path="reports" element={<Reports />} />

        {/* Inventory */}
        <Route path="inventory" element={<Inventory />} />

        {/* Sales */}
        <Route path="sales" element={<Sales />} />

        <Route path="roles" element={<Role />} />
      </Route>
    </Routes>
  );
}

export default App;
