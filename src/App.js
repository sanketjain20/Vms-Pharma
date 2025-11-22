import React from "react";
import { Routes, Route } from "react-router-dom";

import "./App.css";

// Pages & Components
import LoginSection from "./MyComponents/LoginSection";
import VMSSection from "./MyComponents/VMSSection";
import Home from "./MyComponents/Home";
import Footer from "./MyComponents/Footer";

// Layouts
import Layout from "./MyComponents/Layout";
import LayoutModule from "./MyComponents/LayoutModule";

// Module Pages
import Product from "./MyComponents/Product";
import ProductType from "./MyComponents/ProductType";
import Vendor from "./MyComponents/Vendor";
import Reports from "./MyComponents/Reports";
import Inventory from "./MyComponents/Inventory";
import Sales from "./MyComponents/Sales";

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
      <Route path="/app" element={<LayoutModule />}>
        <Route path="product" element={<Product />} />
        <Route path="product-type" element={<ProductType />} />
        <Route path="vendor" element={<Vendor />} />
        <Route path="reports" element={<Reports />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="sales" element={<Sales /> }/>
      </Route>
    </Routes>
  );
}

export default App;
