import React from "react";
import "../Styles/Home.css";
import dashBoardImage from "../Images/28439.jpg"
import img1 from "../Images/3741.jpg";
import img2 from "../Images/4698.jpg";
import img3 from "../Images/4862.jpg";
import img4 from "../Images/28439.jpg";
import img5 from "../Images/32881-NYSF7H.jpg";
import img6 from "../Images/60261.jpg";
import img7 from "../Images/2282382.jpg";
import img8 from "../Images/O4WHN50.jpg";
import img9 from "../Images/OQECWY0.jpg";


export default function Home() {
  const user = JSON.parse(localStorage.getItem("vmsUser")) || {};
  const name = user?.data?.name || "Vendors";

  return (
    <>
      <section className="hero">
       <div className="hero-text">
  <h1>
    Namaste
    <span className="namaste-icon" aria-hidden="true">
     <svg xmlns="http://www.w3.org/2000/svg" height="48px" viewBox="0 -960 960 960" width="48px" fill="#FFFFFF"><path d="M631-320v-102l-49-90q-18 2-29.5 15.5T541-465v227l96 158h-70l-86-141v-244q0-35 20-62.5t52-38.5l-66-122q-20-38-16.5-80t32.5-71l60-60 278 324 40 495h-61l-38-472-222-259-14 14q-14 14-17 33.5t6 36.5l156 290v117h-60Zm-361 0v-117l156-290q9-17 6-36.5T415-797l-14-14-222 259-38 472H80l40-495 278-324 60 60q29 29 32.5 71T474-688l-66 122q32 11 52 38.5t20 62.5v244L394-80h-70l96-158v-227q0-18-11.5-31.5T379-512l-49 90v102h-60Z"/></svg>
    </span>
    , {name}!
    <br />
    <span>Empower Your Shop.</span>
  </h1>

  <p>
    Track products, monitor requests, generate reports, and take quick actions — all
    in one place.
  </p>

  <button className="btn-primary">Get Started</button>
</div>

<div className="hero-grid">
  {[img1, img2, img3, img4, img5, img6, img7, img8, img9].map((src, index) => (
    <img key={index} src={src} alt={`hero-${index}`} className="hero-img" />
  ))}
</div>

      </section>

      <div className="cards-container">
        {/* card 1 */}
        <div className="card">
          <div className="card-header">
            <h3>Vendors</h3>
            <span className="status boosted">Active</span>
          </div>
          <div style={{ textAlign: "center", margin: "20px 0" }}>
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/6/6a/Vendor_icon.png"
              width="60"
              alt="Vendors"
            />
          </div>
          <div className="card-metrics">
            <div>
              <span style={{ fontSize: 24, fontWeight: 700 }}>58</span>
              <div>Active Vendors</div>
            </div>
          </div>
        </div>

        {/* card 2 */}
        <div className="card">
          <div className="card-header">
            <h3>Products</h3>
            <span className="status free">Available</span>
          </div>
          <div style={{ textAlign: "center", margin: "20px 0" }}>
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/6/65/Box_icon.png"
              width="60"
              alt="Products"
            />
          </div>
          <div className="card-metrics">
            <div>
              <span style={{ fontSize: 24, fontWeight: 700 }}>142</span>
              <div>Products</div>
            </div>
          </div>
        </div>

        {/* card 3 */}
        <div className="card">
          <div className="card-header">
            <h3>Requests</h3>
            <span className="status live">Pending</span>
          </div>
          <div style={{ textAlign: "center", margin: "20px 0" }}>
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/4/44/Clipboard_icon.png"
              width="60"
              alt="Requests"
            />
          </div>
          <div className="card-metrics">
            <div>
              <span style={{ fontSize: 24, fontWeight: 700 }}>23</span>
              <div>Pending Requests</div>
            </div>
          </div>
        </div>

        {/* card 4 */}
        <div className="card">
          <div className="card-header">
            <h3>Payments</h3>
            <span className="status draft">Due</span>
          </div>
          <div style={{ textAlign: "center", margin: "20px 0" }}>
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/8/88/Money_icon.png"
              width="60"
              alt="Payments"
            />
          </div>
          <div className="card-metrics">
            <div>
              <span style={{ fontSize: 24, fontWeight: 700 }}>12</span>
              <div>Payments Due</div>
            </div>
          </div>
        </div>
      </div>

      {/* quick actions + favorites */}
      <div className="cards-container quick-fav">
        <div className="panel card interactive quick-actions">
          <h3>Quick Actions</h3>
          <button>Add Vendor</button>
          <button>Add Product</button>
          <button>Generate Report</button>
          <button>Track Requests</button>
        </div>

        <div className="panel card interactive favorites">
          <h3>My Favorites</h3>
          <button>Favorite Vendor 1</button>
          <button>Favorite Product 1</button>
          <button>Favorite Vendor 2</button>
          <button>Favorite Product 2</button>
        </div>
      </div>
    </>
  );
}
