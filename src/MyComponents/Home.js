import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../Styles/Home.css";
import dashBoardImage from "../Images/28439.jpg";
import img1 from "../Images/3741.jpg";
import img2 from "../Images/4698.jpg";
import img3 from "../Images/4862.jpg";
import img4 from "../Images/28439.jpg";
import img5 from "../Images/32881-NYSF7H.jpg";
import img6 from "../Images/60261.jpg";
import img7 from "../Images/2282382.jpg";
import img8 from "../Images/O4WHN50.jpg";
import img9 from "../Images/OQECWY0.jpg";
import img10 from "../Images/8-bits-characters-gaming-assets.jpg";
import img11 from "../Images/enhanced-large-preview.jpg";
import img12 from "../Images/render.jpeg";
import img13 from "../Images/vmsimg.jpg";
import img14 from "../Images/variety-people-multitasking-3d-cartoon-scene.jpg";
import img15 from "../Images/render-preview1.jpg";
import img16 from "../Images/render-preview2.jpg";
import img17 from "../Images/render-preview3.jpg";
import img18 from "../Images/render-preview4.jpg";
import img19 from "../Images/render-preview5.jpg";
import img20 from "../Images/upload-preview6.jpg";
import img21 from "../Images/upload-preview7.jpg";

export default function Home() {
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem("vmsUser")) || {};
  const name = user?.data?.name || "Vendors";
const isLoggedIn = !!user?.data;


  /* =========================
     DASHBOARD COUNTS
  ========================= */
  const [counts, setCounts] = useState({
    vendors: 0,
    products: 0,
    requests: 0,
    payments: 0
  });

  /* useEffect(() => {
    fetch("http://localhost:8080/api/Dashboard/GetCounts", {
      credentials: "include"
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.status === 200) setCounts(d.data);
      });
  }, []); */

  /* =========================
     HERO IMAGES
  ========================= */
  const allImages = [
    img1, img2, img3, img4, img5, img6, img7,
    img8, img9, img10, img11, img12, img13, img14,
    img15, img16, img17, img18, img19, img20, img21
  ];

  const getRandomImages = (images, count) => {
    const shuffled = [...images].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };

  const heroImages = getRandomImages(allImages, 9);

  return (
    <>
      {/* ================= HERO ================= */}
      <div className="home-container">
      <section className="hero">
        <div className="hero-text">
          <h1>
            Namaste
            <span className="namaste-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" height="48px" viewBox="0 -960 960 960" width="48px" fill="#FFFFFF">
                <path d="M631-320v-102l-49-90q-18 2-29.5 15.5T541-465v227l96 158h-70l-86-141v-244q0-35 20-62.5t52-38.5l-66-122q-20-38-16.5-80t32.5-71l60-60 278 324 40 495h-61l-38-472-222-259-14 14q-14 14-17 33.5t6 36.5l156 290v117h-60Zm-361 0v-117l156-290q9-17 6-36.5T415-797l-14-14-222 259-38 472H80l40-495 278-324 60 60q29 29 32.5 71T474-688l-66 122q32 11 52 38.5t20 62.5v244L394-80h-70l96-158v-227q0-18-11.5-31.5T379-512l-49 90v102h-60Z" />
              </svg>
            </span>
            , {name}!
            <br />
            <span>Empower Your Shop.</span>
          </h1>

          <p>
            Track products, monitor requests, generate reports, and take quick actions — all
            in one place.
          </p>

          <button
            className="btn-primary"
            onClick={() => {
              if (isLoggedIn) {
                navigate("/onboarding");
              } else {
                navigate("/");
              }
            }}
          >
            Get Started
          </button>

        </div>

        <div className="hero-grid">
          {heroImages.map((src, index) => (
            <img
              key={index}
              src={src}
              alt={`hero-${index}`}
              className="hero-img"
            />
          ))}
        </div>
      </section>

      {/* ================= METRIC CARDS ================= */}
      <div className="cards-container">
        {/* Vendors */}
        <div className="card">
          <div
            className="card-header clickable"
            onClick={() => navigate("/master/salesshrt")}
          >
            <h3>Quick Sales</h3>
            <span className="status boosted">Active</span>
          </div>
          <div className="card-metrics">
            <span>{counts.vendors}</span>
            <div>Create Invoice</div>
          </div>
        </div>

        {/* Products */}
        <div className="card">
          <div
            className="card-header clickable"
            onClick={() => navigate("/master/product")}
          >
            <h3>Products</h3>
            <span className="status free">Available</span>
          </div>
          <div className="card-metrics">
            <span>{counts.products}</span>
            <div>Products</div>
          </div>
        </div>

        {/* Requests */}
        <div className="card">
          <div
            className="card-header clickable"
            onClick={() => navigate("/master/reports")}
          >
            <h3>Reports</h3>
            <span className="status live">Generated</span>
          </div>
          <div className="card-metrics">
            <span>{counts.requests}</span>
            <div>Generated Reports</div>
          </div>
        </div>

        {/* Payments */}
        <div className="card">
          <div
            className="card-header clickable"
            onClick={() => navigate("/master/dashboard")}
          >
            <h3>Dashboard</h3>
            <span className="status draft">Due</span>
          </div>
          <div className="card-metrics">
            <span>{counts.payments}</span>
            <div>Sales Info </div>
          </div>
        </div>
      </div>

      {/*
================= QUICK ACTIONS + FAVORITES =================
<div className="cards-container quick-fav">
  
  <div className="panel card interactive quick-actions">
    <h3>Quick Actions</h3>
    <button onClick={() => navigate("/vendors/add")}>Add Vendor</button>
    <button onClick={() => navigate("/products/add")}>Add Product</button>
    <button onClick={() => navigate("/reports")}>Generate Report</button>
    <button onClick={() => navigate("/requests")}>Track Requests</button>
  </div>

  <div className="panel card interactive favorites">
    <h3>My Favorites</h3>
    <button onClick={() => navigate("/vendors/1")}>Favorite Vendor 1</button>
    <button onClick={() => navigate("/products/1")}>Favorite Product 1</button>
    <button onClick={() => navigate("/vendors/2")}>Favorite Vendor 2</button>
    <button onClick={() => navigate("/products/2")}>Favorite Product 2</button>
  </div>

</div>

      </div>
      */}
      </div>
    </>
  );
}
