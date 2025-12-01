import React from "react";
import { useNavigate } from "react-router-dom";
import "../../Styles/Unauthorized.css";

export default function Unauthorized() {
  const navigate = useNavigate();

  return (
    <div className="unauth-container">
      <div className="unauth-box">
        <h1 className="unauth-code">403</h1>
        <h2 className="unauth-title">Access Denied</h2>
        <p className="unauth-msg">
          You do not have permission to view this page.<br />
          Please contact your administrator if you believe this is a mistake.
        </p>

        <button className="unauth-btn" onClick={() => navigate("/home")}>
          Go Back Home
        </button>
      </div>
    </div>
  );
}
