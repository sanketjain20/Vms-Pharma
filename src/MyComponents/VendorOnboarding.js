import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../Styles/VendorOnboarding.css";

const steps = [
  {
    title: "Product Type",
    desc: "Create categories to structure your products.",
    icon: "📦",
    subs: ["Add Category", "Edit Type", "Enable / Disable"]
  },
  {
    title: "Products",
    desc: "Add products under types with pricing and units.",
    icon: "🛒",
    subs: ["Assign Type", "Set Price", "Unit & Tax"]
  },
  {
    title: "Product Inventory",
    desc: "Control stock and avoid overselling.",
    icon: "📊",
    subs: ["Add Stock", "Reduce Stock", "Live Availability"]
  },
  {
    title: "Sales & Invoice",
    desc: "Create sales and generate invoices automatically.",
    icon: "🧾",
    subs: ["Create Sale", "Download Invoice PDF", "Print Invoice"]
  },
  {
    title: "Reports",
    desc: "Analyze sales and payments using reports.",
    icon: "📈",
    subs: ["Sales Report", "Payment Report", "Export & Filters"]
  }
];

export default function VendorOnboardingFlow() {
  const [visible, setVisible] = useState(0);
  const refs = useRef([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (visible < steps.length) {
      const t = setTimeout(() => {
        setVisible(v => v + 1);
        refs.current[visible]?.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [visible]);

  return (
    <div className="timeline-page">
      <h1 className="timeline-title">Vendor Management System Flow</h1>
      <p className="timeline-subtitle">
        See how your business flows step by step
      </p>

      <div className="timeline">
        <div className="timeline-line" />

        {steps.map((step, i) => (
          <div
            key={i}
            ref={el => (refs.current[i] = el)}
            className={`timeline-item ${i < visible ? "show" : ""}`}
          >
            {/* LEFT */}
            {i % 2 === 0 && (
              <div className="side left">
                <div className="main-wrapper">
                  <div className="sub-branch left-branch">
                    {step.subs.map((s, idx) => (
                      <div
                        key={idx}
                        className="sub-box"
                        style={{ animationDelay: `${idx * 0.2}s` }}
                      >
                        {s}
                      </div>
                    ))}
                  </div>

                  <div className="main-box">
                    <div className="icon">{step.icon}</div>
                    <h3>{step.title}</h3>
                    <p>{step.desc}</p>
                  </div>
                </div>
              </div>
            )}

            {/* CENTER DOT */}
            <div className="center-dot" />

            {/* RIGHT */}
            {i % 2 !== 0 && (
              <div className="side right">
                <div className="main-wrapper">
                  <div className="main-box">
                    <div className="icon">{step.icon}</div>
                    <h3>{step.title}</h3>
                    <p>{step.desc}</p>
                  </div>

                  <div className="sub-branch right-branch">
                    {step.subs.map((s, idx) => (
                      <div
                        key={idx}
                        className="sub-box"
                        style={{ animationDelay: `${idx * 0.2}s` }}
                      >
                        {s}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {visible >= steps.length && (
        <div className="timeline-end">
          <button className="btn-primary" onClick={() => navigate("/home")}>
            Go to Dashboard
          </button>
        </div>
      )}
    </div>
  );
}
