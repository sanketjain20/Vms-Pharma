import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";   // 👈 for redirect

function LoginSection() {
  const navigate = useNavigate();

  const [step, setStep] = useState("user");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // 🔥 Browser Back Button Support
  useEffect(() => {
    const handlePopState = () => {
      setStep("user");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleNext = () => {
    if (email.trim()) {
      setStep("password");
      window.history.pushState({}, "");
    }
  };

  const handleLogin = async () => {
    const payload = {
      email: email.trim(),
      password: password.trim(),
    };

    try {
      setLoading(true);

      const response = await fetch("http://localhost:8080/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Login failed");

      const data = await response.json();
      console.log("Login Success:", data);

      // ✅ Save data in localStorage so you can use it on Home page
      localStorage.setItem("vmsUser", JSON.stringify(data));

      // 🚀 Redirect to Home Page
      navigate("/home");

    } catch (error) {
      alert("Invalid credentials or server error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-section">
      <h1 className="login-title">
        Vendor Login</h1>

      {step === "user" && (
        <div className="form-group">
          <label>Email</label>
          <input
            type="text"
            placeholder=" ✉️: Enter Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            disabled={!email.trim()}
            className={email.trim() ? "btn-active" : "btn-disabled"}
            onClick={handleNext}
          >
            Next
          </button>
        </div>
      )}

      {step === "password" && (
        <div className="form-group">
          <p style={{ fontSize: "12px", color: "#bbb", marginBottom: "6px" }}>
            Email: <strong>{email}</strong>
          </p>

          <label>Password</label>

          <div style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="🔑: Enter Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%", paddingRight: "40px" }}
            />

            <span
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute",
                right: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                cursor: "pointer",
                fontSize: "14px",
                color: "#bbb",
              }}
            >
              {showPassword ? "Hide" : "Show"}
            </span>
          </div>

          <button
            disabled={!password.trim() || loading}
            className={password.trim() ? "btn-active" : "btn-disabled"}
            onClick={handleLogin}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </div>
      )}

      <div className="contact-info">
        <p>Email: support@vms.com</p>
        <p>Phone: +91 9876543210</p>
      </div>
    </div>
  );
}

export default LoginSection;
