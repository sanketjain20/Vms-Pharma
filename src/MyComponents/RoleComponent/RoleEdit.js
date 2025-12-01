import React, { useState, useEffect } from "react";
import "../../Styles/Role/RoleAdd.css";
import { toast } from "react-toastify";

export default function RoleEdit({ uKey, onClose, onSubmit }) {
  const [permissions, setPermissions] = useState([]);
  const [groupedPermissions, setGroupedPermissions] = useState({});
  const [formData, setFormData] = useState({
    id: "",
    roleName: "",
    permissionIds: [],
  });
  const [errors, setErrors] = useState({});
  console.log("Editing role with uKey:", uKey);

  const apiGetRole = `http://localhost:8080/api/Roles/GetByUkey/${uKey}`;
  const apiGetPermissions = `http://localhost:8080/api/Permissions/GetAll`;

  // ===============================
  // LOAD ALL PERMISSIONS
  // ===============================
  useEffect(() => {
    fetch(apiGetPermissions, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.json())
      .then((response) => {
        if (response.status === 200 && response.data) {
          const perms = response.data;
          setPermissions(perms);

          const grouped = {};
          perms.forEach((p) => {
            if (!grouped[p.module]) grouped[p.module] = [];
            grouped[p.module].push(p);
          });

          setGroupedPermissions(grouped);
        }
      })
      .catch((err) => console.error("Error loading permissions:", err));
  }, []);

  // ===============================
  // LOAD ROLE DATA BY UKEY
  // ===============================
  useEffect(() => {
    fetch(apiGetRole, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.json())
      .then((response) => {
        if (response.status === 200 && response.data) {
          const role = response.data;

          setFormData({
            id: role.id,
            roleName: role.roleName,
            permissionIds: role.permissions.map((p) => p.id),
            roleCode:role.roleCode, // preselected
          });
        } else {
          toast.error("Error loading role");
        }
      })
      .catch((err) => console.error("Role load error:", err));
  }, [apiGetRole]);

  // ===============================
  // FORM INPUT CHANGE
  // ===============================
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  };

  // ===============================
  // TOGGLE PERMISSION
  // ===============================
  const handlePermissionToggle = (id) => {
    setFormData((prev) => {
      const exists = prev.permissionIds.includes(id);

      return {
        ...prev,
        permissionIds: exists
          ? prev.permissionIds.filter((pid) => pid !== id)
          : [...prev.permissionIds, id],
      };
    });
  };

  // ===============================
  // VALIDATION
  // ===============================
  const validate = () => {
    const newErrors = {};
    if (!formData.roleName.trim())
      newErrors.roleName = "Role name is mandatory";
    if (formData.permissionIds.length === 0)
      newErrors.permissionIds = "Select at least one permission";

    return newErrors;
  };

  // ===============================
  // SUBMIT UPDATE ROLE
  // ===============================
  const handleSubmit = async (e) => {
    e.preventDefault();

    const validation = validate();
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }

    const payload = {
      roleName: formData.roleName,
      permissionIds: formData.permissionIds,
    };

    try {
      const response = await fetch(
        `http://localhost:8080/api/Roles/Update/${formData.id}`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();

      if (response.ok && result.status === 200) {
        toast.success("Role updated successfully");
        onSubmit();
        onClose();
      } else {
        toast.error(result.message || "Update failed");
      }
    } catch (error) {
      console.error("Update error:", error);
      toast.error("Something went wrong");
    }
  };

  return (
    <div className="role-modal-backdrop show">
      <div className="role-modal">
        {/* Header */}
        <div className="role-modal-header">
          <div className="role-modal-title">
            <h3>Edit Role | {formData.roleCode}</h3>
            <div className="role-small-muted">Modify role permissions</div>
          </div>

          <button className="role-btn-ghost-cross" onClick={onClose}>
            ✖
          </button>
        </div>

        {/* FORM */}
        <form className="role-modal-body" onSubmit={handleSubmit}>
          <div className="role-form-grid">
            {/* ROLE NAME */}
            <div>
              <label>Role Name</label>
              <input
                type="text"
                name="roleName"
                value={formData.roleName}
                onChange={handleChange}
              />
              {errors.roleName && (
                <div className="role-error-msg">{errors.roleName}</div>
              )}
            </div>

            {/* PERMISSIONS */}
            <div className="role-permissions-section">
              <h4>Permissions</h4>

              <div className="role-permissions-list">
                {Object.keys(groupedPermissions).map((module) => {
                  const perms = groupedPermissions[module];

                  return (
                    <div
                      key={module}
                      className="role-permission-module"
                      onClick={(e) => {
                        if (e.target.classList.contains("role-permission-toggle")) {
                          e.currentTarget.classList.toggle("active");
                        }
                      }}
                    >
                      <div className="role-permission-module-name">
                        {module}
                        <span className="role-permission-toggle">{">"}</span>
                      </div>

                      <div className="role-permission-actions">
                        {perms.map((p) => (
                          <div key={p.id} className="role-permission-action">
                            <input
                              type="checkbox"
                              checked={formData.permissionIds.includes(p.id)}
                              onChange={() => handlePermissionToggle(p.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span>{p.action}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {errors.permissionIds && (
                <div className="role-error-msg">{errors.permissionIds}</div>
              )}
            </div>
          </div>

          {/* FOOTER BUTTONS */}
          <div className="role-modal-footer-fixed">
            <div className="role-modal-actions">
              <button className="role-btn-ghost" type="button" onClick={onClose}>
                Cancel
              </button>

              <button type="submit" className="role-submit-button">
                Update Role
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
