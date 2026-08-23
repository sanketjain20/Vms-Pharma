import React, { useState, useEffect } from "react";
import "../../Styles/CommonAEUDForm/FormShell.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

export default function RoleView({ uKey, onClose }) {
  const [roleData, setRoleData] = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    apiClient(`${API_BASE_URL}/api/Roles/GetByUkey/${uKey}`, {
      method: "GET",
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
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--lg">
        {loading ? (
          <div className="afx-loading">
            <div className="afx-loader-ring"><div/><div/><div/></div>
          </div>
        ) : (
          <>
            <div className="afx-header">
              <div>
                <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />Role Record</div>
                <h3 className="afx-title">{roleData?.roleCode ? `Role · ${roleData.roleCode}` : "View Role"}</h3>
              </div>
              <button className="afx-close" onClick={onClose} title="Close">
                <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                ESC
              </button>
            </div>

            <div className="afx-body">
              {roleData && (
                <>
                  <div className="afx-grid">
                    <div className="afx-field afx-field--full">
                      <label className="afx-label">Role Name</label>
                      <div className="afx-view-value">{roleData.roleName}</div>
                    </div>
                  </div>

                  <div className="afx-perms-head">
                    <div className="afx-perms-title">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <rect x="1" y="1" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                        <rect x="7" y="1" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                        <rect x="1" y="7" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                        <rect x="7" y="7" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                      </svg>
                      Assigned Permissions
                    </div>
                    <span className={`afx-perms-count ${totalPerms > 0 ? "is-active" : ""}`}>
                      {totalPerms} permission{totalPerms !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="afx-modules">
                    {Object.keys(grouped).map((module) => {
                      const perms = grouped[module];
                      return (
                        <div key={module} className="afx-module">
                          <div className="afx-module-head">
                            <div className="afx-module-left">
                              <div className="afx-check is-full">
                                <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              </div>
                              <span className="afx-module-name">{module}</span>
                              <span className="afx-module-badge">{perms.length}</span>
                            </div>
                            <div className="afx-module-right">
                              <span className="afx-module-count">{perms.length} action{perms.length !== 1 ? "s" : ""}</span>
                            </div>
                          </div>

                          <div className="afx-actions-grid">
                            {perms.map((p) => (
                              <div key={p.id} className="afx-action is-checked">
                                <div className="afx-check is-full">
                                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4L3 6L7 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </div>
                                <span className="afx-action-label">{p.action}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    {Object.keys(grouped).length === 0 && (
                      <div className="afx-items-empty">
                        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                          <circle cx="14" cy="14" r="12" stroke="rgba(59,130,246,0.22)" strokeWidth="1.5"/>
                          <path d="M10 14h8" stroke="rgba(59,130,246,0.35)" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                        No permissions assigned
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="afx-footer">
              <button className="afx-btn" onClick={onClose}>Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
