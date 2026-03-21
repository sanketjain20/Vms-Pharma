import React from "react";
import "../../Styles/Login/Login.css";

const features = [
  {
    icon: (
      <svg width="26" height="26" viewBox="0 -960 960 960" fill="currentColor">
        <path d="M440-183v-274L200-596v274l240 139Zm80 0 240-139v-274L520-457v274Zm-80 92L160-252q-19-11-29.5-29T120-321v-318q0-22 10.5-40t29.5-29l280-161q19-11 40-11t40 11l280 161q19 11 29.5 29t10.5 40v318q0 22-10.5 40T800-252L520-91q-19 11-40 11t-40-11Z"/>
      </svg>
    ),
    label: "Product Management",
    desc: "Organise and track every product across types and categories.",
    color: "cyan",
  },
  {
    icon: (
      <svg width="26" height="26" viewBox="0 -960 960 960" fill="currentColor">
        <path d="M480-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM160-160v-112q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440q66 0 130 15.5T736-378q29 15 46.5 43.5T800-272v112H160Z"/>
      </svg>
    ),
    label: "Vendor Tracking",
    desc: "Manage vendor profiles, roles, and performance at a glance.",
    color: "purple",
  },
  {
    icon: (
<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#07df8c"><path d="M120-120v-80l80-80v160h-80Zm160 0v-240l80-80v320h-80Zm160 0v-320l80 81v239h-80Zm160 0v-239l80-80v319h-80Zm160 0v-400l80-80v480h-80ZM120-327v-113l280-280 160 160 280-280v113L560-447 400-607 120-327Z"/></svg>
    ),
    label: "Sales Analytics",
    desc: "Real-time reports, invoice generation and payment tracking.",
    color: "green",
  },
  {
    icon: (
      <svg width="26" height="26" viewBox="0 -960 960 960" fill="currentColor">
        <path d="M520-600v-240h320v240H520ZM120-440v-400h320v400H120Zm400 320v-400h320v400H520Zm-400 0v-240h320v240H120Z"/>
      </svg>
    ),
    label: "Live Dashboard",
    desc: "Centralised overview of your entire operation in one screen.",
    color: "amber",
  },
];

export default function VMSSection() {
  return (
    <div className="vms-wrap">

      {/* Top accent line */}
      <div className="vms-accent-line" />

      <div className="vms-inner">
        {/* Brand mark */}
        <div className="vms-brand">
          <div className="vms-brand-letters">
            {"VMS".split("").map((c, i) => (
              <span key={i} className="vms-brand-char" style={{ animationDelay: `${i * 0.15}s` }}>{c}</span>
            ))}
          </div>
          <div className="vms-brand-sub">Vendor Management System</div>
        </div>

        {/* Tagline */}
        <p className="vms-tagline">
          Track vendors, products, and sales efficiently with modern analytics and full control — all in one place.
        </p>

        {/* Feature cards */}
        <div className="vms-features">
          {features.map(({ icon, label, desc, color }, i) => (
            <div key={i} className={`vms-feat vms-feat-${color}`}>
              <div className="vms-feat-icon">{icon}</div>
              <div className="vms-feat-body">
                <div className="vms-feat-label">{label}</div>
                <div className="vms-feat-desc">{desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom stat strip */}
        <div className="vms-stats">
          {[["Products","Managed"],["Invoices","Auto-generated"],["Reports","Instant"]].map(([a,b],i) => (
            <div key={i} className="vms-stat">
              <div className="vms-stat-label">{a}</div>
              <div className="vms-stat-sub">{b}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom fade */}
      <div className="vms-bottom-fade" />
    </div>
  );
}
