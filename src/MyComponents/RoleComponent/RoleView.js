import React, { useState, useEffect } from "react";
import "../../Styles/Role/RoleAdd.css";

export default function RoleView({ uKey, onClose }) {
  const [roleData, setRoleData] = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetch(`http://localhost:8080/api/Roles/GetByUkey/${uKey}`, {
      method: "GET", credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then(r => r.json())
      .then(res => {
        if (res.status === 200 && res.data) setRoleData(res.data);
      })
      .catch(err => console.error("Error loading role:", err))
      .finally(() => setLoading(false));
  }, [uKey]);

  /* Group assigned permissions by module */
  const grouped = {};
  roleData?.permissions?.forEach(p => {
    if (!grouped[p.module]) grouped[p.module] = [];
    grouped[p.module].push(p);
  });

  const totalPerms = roleData?.permissions?.length || 0;

  return (
    <div className="rl-backdrop">
      <div className="rl-modal">

        <div className="rl-top-beam" />
        <div className="rl-corner rl-tl" /><div className="rl-corner rl-tr" />
        <div className="rl-corner rl-bl" /><div className="rl-corner rl-br" />

        {/* HEADER */}
        <div className="rl-header">
          <div className="rl-header-left">
            <div className="rl-eyebrow">
              <span className="rl-eyebrow-dot" />
              ROLE RECORD
            </div>
            <h3 className="rl-title">
              <span className="rl-title-acc">//</span>
              {roleData?.roleCode ? `Role · ${roleData.roleCode}` : "View Role"}
            </h3>
          </div>
          <button className="rl-close" onClick={onClose} title="Close">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            ESC
          </button>
        </div>

        {/* WRAPPER — body scrolls, footer anchored */}
        <div className="rl-form-wrapper">

          {/* SCROLLABLE BODY */}
          <div className="rl-body">

            {/* Loading */}
            {loading && (
              <div className="rl-view-loading">
                <div className="rl-loader-ring"><div/><div/><div/><div/></div>
                Loading role…
              </div>
            )}

            {!loading && roleData && (
              <>
                {/* Role Name field */}
                <div className="rl-name-row">
                  <div className="rl-field">
                    <label>Role Name</label>
                    <div className="rl-readonly-wrap">
                      <input type="text" value={roleData.roleName} readOnly className="rl-readonly-input" />
                      <span className="rl-readonly-tag">READ ONLY</span>
                    </div>
                  </div>
                </div>

                {/* Permissions section */}
                <div className="rl-perms-section">
                  <div className="rl-perms-header">
                    <div className="rl-perms-title">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <rect x="1" y="1" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                        <rect x="7" y="1" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                        <rect x="1" y="7" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                        <rect x="7" y="7" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                      </svg>
                      Assigned Permissions
                    </div>
                    <span className="rl-perm-count rl-perm-count-active">
                      {totalPerms} permission{totalPerms !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="rl-modules-list">
                    {Object.keys(grouped).map((module, mi) => {
                      const perms = grouped[module];
                      return (
                        <div
                          key={module}
                          className="rl-module rl-module-open rl-module-view"
                          style={{ animationDelay: `${mi * 0.04}s` }}
                        >
                          {/* Module header — view only, no toggle */}
                          <div className="rl-module-header rl-module-header-view">
                            <div className="rl-module-left">
                              {/* Filled check — all assigned */}
                              <div className="rl-module-check rl-check-full">
                                <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                                  <path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </div>
                              <span className="rl-module-name">{module}</span>
                              <span className="rl-module-badge">{perms.length}</span>
                            </div>
                            <div className="rl-module-right">
                              <span className="rl-module-count">{perms.length} action{perms.length !== 1 ? "s" : ""}</span>
                            </div>
                          </div>

                          {/* Action chips — view only */}
                          <div className="rl-actions-grid">
                            {perms.map((p, pi) => (
                              <div
                                key={p.id}
                                className="rl-action rl-action-checked rl-action-view"
                                style={{ animationDelay: `${pi * 0.03}s` }}
                              >
                                <div className="rl-check rl-check-full">
                                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                                    <path d="M1 4L3 6L7 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                </div>
                                <span className="rl-action-label">{p.action}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    {Object.keys(grouped).length === 0 && (
                      <div className="rl-view-empty">
                        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                          <circle cx="14" cy="14" r="12" stroke="rgba(59,130,246,0.22)" strokeWidth="1.5"/>
                          <path d="M10 14h8" stroke="rgba(59,130,246,0.35)" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                        No permissions assigned
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>{/* END .rl-body */}

          {/* FOOTER — anchored, never overlaps */}
          <div className="rl-footer">
            <button className="rl-btn-cancel" onClick={onClose}>Close</button>
          </div>

        </div>{/* END .rl-form-wrapper */}

      </div>
    </div>
  );
}
