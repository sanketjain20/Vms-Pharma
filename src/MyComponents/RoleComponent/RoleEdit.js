import React, { useState, useEffect } from "react";
import "../../Styles/CommonAEUDForm/FormShell.css";
import { toast } from "react-toastify";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

export default function RoleEdit({ uKey, onClose, onSubmit }) {
  const [permissions, setPermissions]               = useState([]);
  const [groupedPermissions, setGroupedPermissions] = useState({});
  const [expandedModules, setExpandedModules]       = useState({});
  const [formData, setFormData] = useState({ id: "", roleName: "", permissionIds: [], roleCode: "" });
  const [errors, setErrors]     = useState({});
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [roleLoaded, setRoleLoaded] = useState(false);

  const apiGetRole        = `${API_BASE_URL}/api/Roles/GetByUkey/${uKey}`;
  const apiGetPermissions = `${API_BASE_URL}/api/Permissions/GetAll`;

  /* ── LOAD ALL PERMISSIONS ── */
  useEffect(() => {
    apiClient(apiGetPermissions, {
      method: "GET",
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
      .catch(err => console.error("Error loading permissions:", err))
      .finally(() => setPermissionsLoaded(true));
  }, []);

  /* ── LOAD ROLE BY UKEY ── */
  useEffect(() => {
    apiClient(apiGetRole, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })
      .then(r => r.json())
      .then(res => {
        if (res.status === 200 && res.data) {
          const role = res.data;
          setFormData({
            id: role.id,
            roleName: role.roleName,
            permissionIds: role.permissions.map(p => p.id),
            roleCode: role.roleCode,
          });
        } else { toast.error("Error loading role"); }
      })
      .catch(err => console.error("Role load error:", err))
      .finally(() => setRoleLoaded(true));
  }, [apiGetRole]);

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
    const validation = validate();
    if (Object.keys(validation).length > 0) { setErrors(validation); return; }

    try {
      const response = await apiClient(`${API_BASE_URL}/api/Roles/Update/${formData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleName: formData.roleName, permissionIds: formData.permissionIds }),
      });
      const result = await response.json();
      if (response.ok && result.status === 200) {
        toast.success("Role updated successfully");
        onSubmit(); onClose();
      } else { toast.error(result.message || "Update failed"); }
    } catch (error) {
      console.error("Update error:", error);
      toast.error("Something went wrong");
    }
  };

  const totalSelected = formData.permissionIds.length;
  const totalPerms    = permissions.length;
  const initialLoading = !permissionsLoaded || !roleLoaded;

  return (
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--lg">
        {initialLoading ? (
          <div className="afx-loading">
            <div className="afx-loader-ring"><div/><div/><div/></div>
          </div>
        ) : (
          <>
            <div className="afx-header">
              <div>
                <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />Edit Role</div>
                <h3 className="afx-title">{formData.roleCode ? `Role · ${formData.roleCode}` : "Edit Role"}</h3>
              </div>
              <button className="afx-close" onClick={onClose} title="Close">
                <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                ESC
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="afx-body">
                <div className="afx-grid">
                  <div className="afx-field afx-field--full">
                    <label className="afx-label">Role Name<span className="afx-req">*</span></label>
                    <input
                      type="text"
                      name="roleName"
                      className={`afx-input ${errors.roleName ? "afx-input--err" : ""}`}
                      value={formData.roleName}
                      onChange={handleChange}
                      placeholder="e.g. Store Manager"
                    />
                    {errors.roleName && <span className="afx-error">{errors.roleName}</span>}
                  </div>
                </div>

                <div>
                  <div className="afx-perms-head">
                    <div className="afx-perms-title">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <rect x="1" y="1" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                        <rect x="7" y="1" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                        <rect x="1" y="7" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                        <rect x="7" y="7" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                      </svg>
                      Permissions
                    </div>
                    <span className={`afx-perms-count ${totalSelected > 0 ? "is-active" : ""}`}>
                      {totalSelected} / {totalPerms} selected
                    </span>
                  </div>

                  {errors.permissionIds && <div className="afx-error" style={{ marginBottom: 8 }}>{errors.permissionIds}</div>}

                  <div className="afx-modules">
                    {Object.keys(groupedPermissions).map((module) => {
                      const perms    = groupedPermissions[module];
                      const isOpen   = expandedModules[module];
                      const ids      = perms.map(p => p.id);
                      const allSel   = ids.every(id => formData.permissionIds.includes(id));
                      const someSel  = ids.some(id => formData.permissionIds.includes(id));
                      const selCount = ids.filter(id => formData.permissionIds.includes(id)).length;

                      return (
                        <div key={module} className="afx-module">
                          <div className="afx-module-head" onClick={() => toggleModule(module)}>
                            <div className="afx-module-left">
                              <div
                                className={`afx-check ${allSel ? "is-full" : someSel ? "is-partial" : ""}`}
                                onClick={e => toggleModuleAll(module, perms, e)}
                                title={allSel ? "Deselect all" : "Select all"}
                              >
                                {allSel && <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                {!allSel && someSel && <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M2 4.5h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>}
                              </div>
                              <span className="afx-module-name">{module}</span>
                              {selCount > 0 && <span className="afx-module-badge">{selCount}</span>}
                            </div>
                            <div className="afx-module-right">
                              <span className="afx-module-count">{perms.length} actions</span>
                              <svg className={`afx-chevron ${isOpen ? "is-open" : ""}`} width="11" height="11" viewBox="0 0 11 11" fill="none">
                                <path d="M2 4L5.5 7.5L9 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </div>
                          </div>

                          {isOpen && (
                            <div className="afx-actions-grid">
                              {perms.map((p) => {
                                const checked = formData.permissionIds.includes(p.id);
                                return (
                                  <div key={p.id} className={`afx-action ${checked ? "is-checked" : ""}`} onClick={() => handlePermissionToggle(p.id)}>
                                    <div className={`afx-check ${checked ? "is-full" : ""}`}>
                                      {checked && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4L3 6L7 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                    </div>
                                    <span className="afx-action-label">{p.action}</span>
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
              </div>

              <div className="afx-footer">
                <button className="afx-btn" type="button" onClick={onClose}>Cancel</button>
                <button type="submit" className="afx-btn afx-btn--primary">Update Role</button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
