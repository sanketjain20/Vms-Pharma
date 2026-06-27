import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaSearch, FaUpload, FaDownload, FaTimes, FaFileExcel } from "react-icons/fa";
import { toast } from "react-toastify";
import "../../Styles/BulkUpload/BulkUpload.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

const normalizeMasters = (payload) => {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.content)) return payload.data.content;
  if (Array.isArray(payload?.masters)) return payload.masters;
  if (Array.isArray(payload)) return payload;
  return [];
};

export default function BulkUploadMasters() {
  const navigate = useNavigate();

  const [masters, setMasters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadingId, setUploadingId] = useState("");
  const [files, setFiles] = useState({});
  const [searchText, setSearchText] = useState("");
  // tracks which row has the upload drawer open
  const [activeUploadId, setActiveUploadId] = useState(null);
  // keeps the drawer mounted during the close animation
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const fetchMasters = async () => {
    setLoading(true);
    try {
      const response = await apiClient(
        `${API_BASE_URL}/api/bulk-upload/masters`,
        { method: "GET" }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || "Failed to fetch masters");
      }
      setMasters(normalizeMasters(payload));
    } catch (err) {
      toast.error(err.message || "Failed to fetch masters");
      setMasters([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMasters();
  }, []);

  const filteredMasters = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return masters;
    return masters.filter((m) =>
      [m.name, m.uploadName, m.moduleName, m.description, m.entityName]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [masters, searchText]);

  const activeMaster = useMemo(
    () => masters.find((m) => m.id === activeUploadId) || null,
    [masters, activeUploadId]
  );

  const handleFileChange = (master, file) => {
    setFiles((prev) => ({ ...prev, [master.id]: file }));
  };

  const downloadTemplate = async (master) => {
    try {
      const url = `${API_BASE_URL}/api/bulk-upload/template/${master.id}/${master.entityId}`;

      const response = await apiClient(url, {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error("Failed to download template");
      }

      const blob = await response.blob();

      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = `${master.name || "template"}.xlsx`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      toast.error(err.message || "Template download failed");
    }
  };

  const handleUpload = async (master) => {
    const file = files[master.id];
    if (!file) {
      toast.warning("Please select a file first");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("bulkUploadId", master.id);
    formData.append("entityId", master.entityId);

    setUploadingId(master.id);
    try {
      const response = await apiClient(`${API_BASE_URL}/api/bulk-upload`, {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Upload failed");
      toast.success(payload.message || "Upload started");
      closeDrawer();
      setFiles((prev) => { const next = { ...prev }; delete next[master.id]; return next; });
      navigate("/master/bulk-upload");
    } catch (err) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingId("");
    }
  };

  // Opens the drawer for a given master (slides in from the right)
  const openDrawer = (id) => {
    setIsClosing(false);
    setActiveUploadId(id);
    setDrawerVisible(true);
  };

  // Plays the slide-out animation, then unmounts
  const closeDrawer = () => {
    setIsClosing(true);
    setTimeout(() => {
      setDrawerVisible(false);
      setActiveUploadId(null);
      setIsClosing(false);
    }, 260);
  };

  const toggleUpload = (id) => {
    if (activeUploadId === id && drawerVisible) {
      closeDrawer();
    } else {
      openDrawer(id);
    }
  };

  // ESC key closes the drawer
  useEffect(() => {
    if (!drawerVisible) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerVisible]);

  return (
    <div className="bulkup-page">
      {/* HEADER */}
      <div className="bulkup-header">
        <div>
          <div className="bulkup-eyebrow">Master Uploads</div>
          <h2 className="bulkup-title">Bulk Upload Management</h2>
          <div className="bulkup-title-rule" />
        </div>
        <button
          className="bulkup-btn bulkup-btn-ghost"
          onClick={() => navigate("/master/bulk-upload")}
        >
          <FaArrowLeft /> Back
        </button>
      </div>

      {/* GRID SHELL */}
      <div className="bulkup-grid-shell">
        {/* TOOLBAR */}
        <div className="bulkup-toolbar">
          <div className="bulkup-search">
            <FaSearch />
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search masters..."
            />
          </div>
          <div className="bulkup-record-count">
            {filteredMasters.length} records
          </div>
        </div>

        {/* TABLE */}
        <div className="bulkup-table-wrap">
          <table className="bulkup-table bulkup-masters-table">
            <thead>
              <tr>
                <th style={{ width: "15%" }}>Code</th>
                <th style={{ width: "20%" }}>Name</th>
                <th style={{ width: "45%" }}>Description</th>
                <th style={{ width: "25%" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="bulkup-empty">Loading...</td>
                </tr>
              ) : filteredMasters.length === 0 ? (
                <tr>
                  <td colSpan={4} className="bulkup-empty">No records found</td>
                </tr>
              ) : (
                filteredMasters.map((master) => (
                  <tr key={master.id}>
                    <td className="bulkup-masters-code">
                      {master.code || "-"}
                    </td>
                    <td className="bulkup-masters-name">
                      {master.name || master.uploadName}
                    </td>
                    <td className="bulkup-masters-desc">
                      {master.description || "-"}
                    </td>
                    <td>
                      <div className="bulkup-actions">
                        <button
                          className="bulkup-btn bulkup-btn-sm"
                          title="Download template"
                          onClick={() => downloadTemplate(master)}
                        >
                          <FaDownload /> Template
                        </button>
                        <button
                          className={`bulkup-btn bulkup-btn-sm bulkup-btn-primary ${activeUploadId === master.id && drawerVisible ? "bulkup-btn-active" : ""}`}
                          title="Upload file"
                          onClick={() => toggleUpload(master.id)}
                        >
                          <FaUpload /> Upload
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RIGHT-SIDE UPLOAD DRAWER */}
      {drawerVisible && activeMaster && (
        <>
          <div
            className={`bulkup-drawer-overlay ${isClosing ? "bulkup-drawer-overlay-closing" : ""}`}
            onClick={closeDrawer}
          />
          <aside
            className={`bulkup-drawer ${isClosing ? "bulkup-drawer-closing" : ""}`}
            role="dialog"
            aria-label={`Upload file for ${activeMaster.name || activeMaster.uploadName}`}
          >
            <div className="bulkup-drawer-header">
              <div>
                <div className="bulkup-drawer-eyebrow">Bulk Upload</div>
                <h3 className="bulkup-drawer-title">
                  {activeMaster.name || activeMaster.uploadName}
                </h3>
              </div>
              <button
                className="bulkup-drawer-close"
                onClick={closeDrawer}
                title="Close"
                aria-label="Close upload panel"
              >
                <FaTimes />
              </button>
            </div>

            <div className="bulkup-drawer-body">
              {activeMaster.description && (
                <p className="bulkup-drawer-desc">{activeMaster.description}</p>
              )}

              <button
                className="bulkup-btn bulkup-btn-ghost bulkup-drawer-template-btn"
                onClick={() => downloadTemplate(activeMaster)}
              >
                <FaDownload /> Download Template
              </button>

              <label className="bulkup-dropzone">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => handleFileChange(activeMaster, e.target.files?.[0])}
                />
                <FaFileExcel className="bulkup-dropzone-icon" />
                <span className="bulkup-dropzone-title">
                  {files[activeMaster.id]?.name || "Choose a file to upload"}
                </span>
                <span className="bulkup-dropzone-sub">
                  .xlsx, .xls or .csv
                </span>
              </label>
            </div>

            <div className="bulkup-drawer-footer">
              <button
                className="bulkup-btn bulkup-btn-ghost"
                onClick={closeDrawer}
              >
                Cancel
              </button>
              <button
                className="bulkup-btn bulkup-btn-primary"
                disabled={uploadingId === activeMaster.id || !files[activeMaster.id]}
                onClick={() => handleUpload(activeMaster)}
              >
                <FaUpload />
                {uploadingId === activeMaster.id ? "Uploading..." : "Confirm Upload"}
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}