import React, { useState, useEffect } from "react";
import "../../Styles/Role/RoleAdd.css";
import { toast } from "react-toastify";

export default function RoleForm({ onSubmit, onClose }) {
  const [permissions, setPermissions] = useState([]);
  const [groupedPermissions, setGroupedPermissions] = useState({});
  const [formData, setFormData] = useState({
    roleName: "",
    permissionIds: [],
  });
  const [errors, setErrors] = useState({});

  const apiUrl = "http://localhost:8080/api/Permissions/GetAll";

  useEffect(() => {
    fetch(apiUrl, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.json())
      .then((response) => {
        if (response.status === 200 && response.data) {
          setPermissions(response.data);

          const grouped = {};
          response.data.forEach((p) => {
            if (!grouped[p.module]) grouped[p.module] = [];
            grouped[p.module].push(p);
          });
          setGroupedPermissions(grouped);
        }
      })
      .catch((err) => console.error("Error fetching permissions:", err));
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  };

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

  const validate = () => {
    const newErrors = {};
    if (!formData.roleName || !formData.roleName.trim())
      newErrors.roleName = "Role name is mandatory";
    if (formData.permissionIds.length === 0)
      newErrors.permissionIds = "Select at least one permission";
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      const response = await fetch("http://localhost:8080/api/Roles/Add", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok && result.status === 200) {
        toast.success("Role added successfully");
        onSubmit();
        onClose();
      } else {
        toast.error(result.message || "Role creation failed");
      }
    } catch (error) {
      console.error("API ERROR:", error);
      toast.error("Something went wrong while saving role");
    }
  };

  return (
    <div className="role-modal-backdrop show">
      <div className="role-modal">
        <div className="role-modal-header">
          <div className="role-modal-title">
            <h3>Add Role</h3>
            <div className="role-small-muted">Assign permissions to the role</div>
          </div>
          <button className="role-btn-ghost-cross" onClick={onClose} title="Close">
            ✖
          </button>
        </div>

        <form className="role-modal-body scrollable" onSubmit={handleSubmit}>
          <div className="role-form-grid">
            <div>
              <label>Name</label>
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

            <div className="role-permissions-section">
              <h4>Permissions</h4>

              {/* New module/block layout */}
              <div className="role-permissions-list">
                {Object.keys(groupedPermissions).map((module) => {
                  const perms = groupedPermissions[module];
                  return (
                    <div
                      key={module}
                      className={`role-permission-module`}
                      onClick={(e) => {
                        // Toggle only when arrow clicked
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

          <div className="role-modal-footer-fixed">
            <div className="role-modal-actions">
              <button className="role-btn-ghost" type="button" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="role-submit-button">
                Save Role
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
