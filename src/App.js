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
import ProductAdd from "./MyComponents/ProductComponent/ProductAdd";
import ProductType from "./MyComponents/ProductTypeComponent/ProductType";
import ProductTypeAdd from "./MyComponents/ProductTypeComponent/ProductTypeAdd";
import Vendor from "./MyComponents/VendorComponent/Vendor";
import VendorAdd from "./MyComponents/VendorComponent/VendorAdd";
import Reports from "./MyComponents/ReportComponent/Reports";
import Inventory from "./MyComponents/InventoryComponent/Inventory";
import InventoryAdd from "./MyComponents/InventoryComponent/InventoryAdd";
import Sales from "./MyComponents/SalesComponent/Sales";
import SalesAdd from "./MyComponents/SalesComponent/SalesAdd";

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
        <Route path="product/add" element={<ProductAdd />} />

        {/* Product Type */}
        <Route path="product-type" element={<ProductType />} />
        <Route path="prod type/add" element={<ProductTypeAdd />} />

        {/* Vendor */}
        <Route path="vendor" element={<Vendor />} />
        <Route path="vendor/add" element={<VendorAdd />} />

        {/* Reports */}
        <Route path="reports" element={<Reports />} />

        {/* Inventory */}
        <Route path="inventory" element={<Inventory />} />
        <Route path="inventory/add" element={<InventoryAdd />} />

        {/* Sales */}
        <Route path="sales" element={<Sales />} />
        <Route path="sales/add" element={<SalesAdd />} />
      </Route>
    </Routes>
  );
}

export default App;
