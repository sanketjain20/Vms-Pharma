import React, { useState, useEffect } from "react";
import "../../Styles/Role/RoleAdd.css";

export default function RoleView({ uKey, onClose }) {
  const [roleData, setRoleData] = useState(null);

  const apiGetRole = `http://localhost:8080/api/Roles/GetByUkey/${uKey}`;

  // --------------------------------------
  // LOAD ROLE DATA WITH PERMISSIONS ONLY
  // --------------------------------------
  useEffect(() => {
    fetch(apiGetRole, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.json())
      .then((response) => {
        if (response.status === 200 && response.data) {
          // Role permissions already contain module + action
          setRoleData(response.data);
        }
      })
      .catch((err) => console.error("Error loading role:", err));
  }, [apiGetRole]);

  if (!roleData) return null;

  // --------------------------------------
  // GROUP PERMISSIONS BY MODULE
  // --------------------------------------
  const grouped = {};
  roleData.permissions?.forEach((p) => {
    if (!grouped[p.module]) grouped[p.module] = [];
    grouped[p.module].push(p);
  });

  return (
    <div className="role-modal-backdrop show">
      <div className="role-modal">

        {/* HEADER */}
        <div className="role-modal-header">
          <div className="role-modal-title">
            <h3>View Role | {roleData.roleCode}</h3>
            <div className="role-small-muted">Role details & permissions</div>
          </div>

          <button className="role-btn-ghost-cross" onClick={onClose}>✖</button>
        </div>

        {/* VIEW BODY */}
        <div className="role-modal-body">
          <div className="role-form-grid">

            {/* ROLE NAME */}
            <div>
              <label>Role Name</label>
              <input
                type="text"
                value={roleData.roleName}
                readOnly
                className="role-readonly"
              />
            </div>

            {/* PERMISSIONS */}
            <div className="role-permissions-section">
              <h4>Permissions</h4>

              <div className="role-permissions-list">
                {Object.keys(grouped).map((module) => (
                  <div key={module} className="role-permission-module active">

                    {/* Module Header */}
                    <div className="role-permission-module-name">
                      {module}
                      <span className="role-permission-toggle">{">"}</span>
                    </div>

                    {/* Actions (ONLY those assigned to role) */}
                    <div className="role-permission-actions">
                      {grouped[module].map((p) => (
                        <div key={p.id} className="role-permission-action">
                          <span>{p.action}</span>
                        </div>
                      ))}
                    </div>

                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <div className="role-modal-footer-fixed">
            <button className="role-btn-ghost" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
