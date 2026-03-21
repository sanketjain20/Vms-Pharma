import React, { useState, useEffect } from "react";
import "../../Styles/Role/RoleAdd.css";
import { toast } from "react-toastify";

export default function RoleForm({ onSubmit, onClose }) {
  const [permissions, setPermissions]               = useState([]);
  const [groupedPermissions, setGroupedPermissions] = useState({});
  const [expandedModules, setExpandedModules]       = useState({});
  const [formData, setFormData] = useState({ roleName: "", permissionIds: [] });
  const [errors, setErrors]     = useState({});

  useEffect(() => {
    fetch("http://localhost:8080/api/Permissions/GetAll", {
      method: "GET", credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then(r => r.json())
      .then(res => {
        if (res.status === 200 && res.data) {
          setPermissions(res.data);
          const grouped = {};
          res.data.forEach(p => {
            if (!grouped[p.module]) grouped[p.module] = [];
            grouped[p.module].push(p);
          });
          setGroupedPermissions(grouped);
          const allOpen = {};
          Object.keys(grouped).forEach(k => (allOpen[k] = true));
          setExpandedModules(allOpen);
        }
      })
      .catch(err => console.error("Error fetching permissions:", err));
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  };

  const handlePermissionToggle = (id) => {
    setFormData(prev => {
      const exists = prev.permissionIds.includes(id);
      return {
        ...prev,
        permissionIds: exists
          ? prev.permissionIds.filter(pid => pid !== id)
          : [...prev.permissionIds, id],
      };
    });
    setErrors(p => ({ ...p, permissionIds: "" }));
  };

  const toggleModule = (module) => {
    setExpandedModules(prev => ({ ...prev, [module]: !prev[module] }));
  };

  const toggleModuleAll = (module, perms, e) => {
    e.stopPropagation();
    const ids = perms.map(p => p.id);
    const allSelected = ids.every(id => formData.permissionIds.includes(id));
    setFormData(prev => ({
      ...prev,
      permissionIds: allSelected
        ? prev.permissionIds.filter(id => !ids.includes(id))
        : [...new Set([...prev.permissionIds, ...ids])],
    }));
    setErrors(p => ({ ...p, permissionIds: "" }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.roleName?.trim()) newErrors.roleName = "Role name is mandatory";
    if (formData.permissionIds.length === 0) newErrors.permissionIds = "Select at least one permission";
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) { setErrors(validationErrors); return; }
    try {
      const response = await fetch("http://localhost:8080/api/Roles/Add", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const result = await response.json();
      if (response.ok && result.status === 200) {
        toast.success("Role added successfully");
        onSubmit(); onClose();
      } else { toast.error(result.message || "Role creation failed"); }
    } catch (error) {
      console.error("API ERROR:", error);
      toast.error("Something went wrong while saving role");
    }
  };

  const totalSelected = formData.permissionIds.length;
  const totalPerms    = permissions.length;

  return (
    <div className="rl-backdrop">
      <div className="rl-modal">

        <div className="rl-top-beam" />
        <div className="rl-corner rl-tl" /><div className="rl-corner rl-tr" />
        <div className="rl-corner rl-bl" /><div className="rl-corner rl-br" />

        {/* HEADER */}
        <div className="rl-header">
          <div className="rl-header-left">
            <div className="rl-eyebrow"><span className="rl-eyebrow-dot" />NEW ROLE</div>
            <h3 className="rl-title"><span className="rl-title-acc">//</span>Add Role</h3>
          </div>
          <button className="rl-close" onClick={onClose} title="Close">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            ESC
          </button>
        </div>

        {/*
          KEY FIX: rl-form-wrapper is flex-column with flex:1 and min-height:0.
          rl-body is flex:1 overflow-y:auto  → scrolls independently.
          rl-footer is flex-shrink:0         → always visible at bottom, never overlaps.
        */}
        <form className="rl-form-wrapper" onSubmit={handleSubmit}>

          {/* SCROLLABLE CONTENT */}
          <div className="rl-body">

            {/* Role Name */}
            <div className="rl-name-row">
              <div className="rl-field">
                <label>Role Name</label>
                <input
                  type="text"
                  name="roleName"
                  value={formData.roleName}
                  onChange={handleChange}
                  placeholder="e.g. Store Manager"
                  className={errors.roleName ? "rl-input-err" : ""}
                />
                {errors.roleName && <span className="rl-err">{errors.roleName}</span>}
              </div>
            </div>

            {/* Permissions */}
            <div className="rl-perms-section">
              <div className="rl-perms-header">
                <div className="rl-perms-title">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <rect x="1" y="1" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                    <rect x="7" y="1" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                    <rect x="1" y="7" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                    <rect x="7" y="7" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                  </svg>
                  Permissions
                </div>
                <span className={`rl-perm-count ${totalSelected > 0 ? "rl-perm-count-active" : ""}`}>
                  {totalSelected} / {totalPerms} selected
                </span>
              </div>

              {errors.permissionIds && <span className="rl-err rl-err-perms">{errors.permissionIds}</span>}

              <div className="rl-modules-list">
                {Object.keys(groupedPermissions).map((module, mi) => {
                  const perms    = groupedPermissions[module];
                  const isOpen   = expandedModules[module];
                  const ids      = perms.map(p => p.id);
                  const allSel   = ids.every(id => formData.permissionIds.includes(id));
                  const someSel  = ids.some(id => formData.permissionIds.includes(id));
                  const selCount = ids.filter(id => formData.permissionIds.includes(id)).length;

                  return (
                    <div key={module} className={`rl-module ${isOpen ? "rl-module-open" : ""}`} style={{ animationDelay: `${mi * 0.04}s` }}>
                      <div className="rl-module-header" onClick={() => toggleModule(module)}>
                        <div className="rl-module-left">
                          <div
                            className={`rl-module-check ${allSel ? "rl-check-full" : someSel ? "rl-check-partial" : ""}`}
                            onClick={e => toggleModuleAll(module, perms, e)}
                            title={allSel ? "Deselect all" : "Select all"}
                          >
                            {allSel && <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                            {!allSel && someSel && <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M2 4.5h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>}
                          </div>
                          <span className="rl-module-name">{module}</span>
                          {selCount > 0 && <span className="rl-module-badge">{selCount}</span>}
                        </div>
                        <div className="rl-module-right">
                          <span className="rl-module-count">{perms.length} actions</span>
                          <svg className={`rl-chevron ${isOpen ? "rl-chevron-open" : ""}`} width="11" height="11" viewBox="0 0 11 11" fill="none">
                            <path d="M2 4L5.5 7.5L9 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      </div>

                      {isOpen && (
                        <div className="rl-actions-grid">
                          {perms.map((p, pi) => {
                            const checked = formData.permissionIds.includes(p.id);
                            return (
                              <div key={p.id} className={`rl-action ${checked ? "rl-action-checked" : ""}`} onClick={() => handlePermissionToggle(p.id)} style={{ animationDelay: `${pi * 0.03}s` }}>
                                <div className={`rl-check ${checked ? "rl-check-full" : ""}`}>
                                  {checked && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4L3 6L7 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                </div>
                                <span className="rl-action-label">{p.action}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>{/* END .rl-body */}

          {/* FOOTER — outside scroll body, always anchored to bottom */}
          <div className="rl-footer">
            <button className="rl-btn-cancel" type="button" onClick={onClose}>Cancel</button>
            <button type="submit" className="rl-btn-save">Save Role</button>
          </div>

        </form>

      </div>
    </div>
  );
}
