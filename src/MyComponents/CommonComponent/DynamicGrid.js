import React, { useEffect, useState } from "react";
import "../../Styles/DynamicGrid.css";
import { FaSearch, FaEdit, FaEye, FaBan } from "react-icons/fa";
import ModuleModal from "../CommonAEUDForm/ModuleModal";
import EditModal from "../CommonAEUDForm/EditModal";
import ViewModal from "../CommonAEUDForm/ViewModal";
import StatusModal from "../CommonAEUDForm/StatusModal";

export default function DynamicGrid({ columns = [], apiUrl, Module }) {
  const [data, setData] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchText, setSearchText] = useState("");

  // ADD modal
  const [isModalOpen, setIsModalOpen] = useState(false);

  // EDIT modal
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editUkey, setEditUkey] = useState(null);

  // VIEW modal
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewUkey, setViewUkey] = useState(null);

  // STATUS modal
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [statusUkey, setStatusUkey] = useState(null);
  const [statusDisableValue, setStatusDisableValue] = useState(0);

  /* ---------------------- Fetch API ---------------------- */
  const refreshGrid = React.useCallback(() => {
    fetch(`${apiUrl}/${page}/${size}`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.json())
      .then((response) => {
        if (response.status === 200) {
          const dataObj = response.data;

          const list = Array.isArray(dataObj)
            ? dataObj
            : typeof dataObj === "object"
              ? Object.values(dataObj).find((v) => Array.isArray(v)) || []
              : [];

          setData(list);
          setTotalPages(dataObj?.totalPages || 1);
        }
      })
      .catch((err) => console.error(err));
  }, [apiUrl, page, size]);

  useEffect(() => {
    refreshGrid();
  }, [refreshGrid]);

  /* ---------------------- Filters ---------------------- */
  const filteredData = data
    ?.filter((row) => {
      if (selectedStatus === "all") return true;

      let rowStatus = "";

      if (row.status) {
        rowStatus = row.status.toLowerCase();
      } else if (row.disable !== undefined) {
        rowStatus = row.disable === 0 ? "active" : "inactive";
      }

      return rowStatus === selectedStatus;
    })
    .filter((row) =>
      searchText
        ? Object.values(row)
          .join(" ")
          .toLowerCase()
          .includes(searchText.toLowerCase())
        : true
    );

  /* ---------------------- Width ---------------------- */
  const computedWidths = () => {
    return columns.map(
      (c) => c.width || `${Math.floor(100 / columns.length)}%`
    );
  };

  const widths = computedWidths();

  /* ---------------------- Action handlers ---------------------- */
  const handleEdit = (row) => {
    setEditUkey(row.uKey);
    setIsEditOpen(true);
  };

  const handleView = (row) => {
    setViewUkey(row.uKey);
    setIsViewOpen(true);
  };

  const handleDisable = (row) => {
    setStatusUkey(row.uKey);
    setStatusDisableValue(0);
    setIsStatusOpen(true);
  };

  const handleActivate = (row) => {
    setStatusUkey(row.uKey);
    setStatusDisableValue(1);
    setIsStatusOpen(true);
  };

  return (
    <div className="grid-wrapper">
      {/* Search + Add */}
      <div className="search-add-container">
        <div className="search-wrapper">
          <input
            type="text"
            className="search-input"
            placeholder="Search here..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <FaSearch className="search-icon" />
        </div>
        <button className="add-button" onClick={() => setIsModalOpen(true)}>
          Add New {Module}
        </button>
      </div>

      {/* Status filters */}
      <div className="status-filters">
        <span
          className={`status-chip ${selectedStatus === "all" ? "active" : ""}`}
          onClick={() => setSelectedStatus("all")}
        >
          All
        </span>
        <span
          className={`status-chip ${selectedStatus === "active" ? "active" : ""
            }`}
          onClick={() => setSelectedStatus("active")}
        >
          Active
        </span>
        <span
          className={`status-chip ${selectedStatus === "inactive" ? "active" : ""
            }`}
          onClick={() => setSelectedStatus("inactive")}
        >
          Inactive
        </span>
      </div>

      {/* Table */}
      <div className="grid-container">
        {/* Header */}
        <table className="grid-table">
          <colgroup>
            {widths.map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} title={col.header}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
        </table>

        {/* Body */}
        <div className="scroll-body">
          <table className="grid-table">
            <colgroup>
              {widths.map((w, i) => (
                <col key={i} style={{ width: w }} />
              ))}
            </colgroup>
            <tbody>
              {filteredData?.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {columns.map((col, colIndex) => {
                    if (col.field === "Action") {
                      return (
                        <td key={colIndex} className="action-column">
                          {selectedStatus === "inactive" ? (
                            <span
                              className="action-icon"
                              title="Activate"
                              onClick={() => handleActivate(row)}
                              style={{ cursor: "pointer" }}
                              dangerouslySetInnerHTML={{
                                __html:
                                  '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#2da109ff"><path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/></svg>',
                              }}
                            />
                          ) : (
                            <>
                              <span
                                className="action-icon"
                                title="Edit"
                                onClick={() => handleEdit(row)}
                                style={{ cursor: "pointer" }}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  height="24px"
                                  viewBox="0 -960 960 960"
                                  width="24px"
                                  fill="#504f4fff"
                                >
                                  <path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z" />
                                </svg>
                              </span>

                              <span
                                className="action-icon"
                                title="View"
                                onClick={() => handleView(row)}
                                style={{ cursor: "pointer" }}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  height="24px"
                                  viewBox="0 -960 960 960"
                                  width="24px"
                                  fill="#504f4fff"
                                >
                                  <path d="M274-360q31 0 55.5-18t34.5-47l15-46q16-48-8-88.5T302-600H161l19 157q5 35 31.5 59t62.5 24Zm412 0q36 0 62.5-24t31.5-59l19-157H659q-45 0-69 41t-8 89l14 45q10 29 34.5 47t55.5 18Zm-412 80q-66 0-115.5-43.5T101-433L80-600H40v-80h262q44 0 80.5 21.5T440-600h81q21-37 57.5-58.5T659-680h261v80h-40l-21 167q-8 66-57.5 109.5T686-280q-57 0-102.5-32.5T520-399l-15-45q-2-7-4-14.5t-4-21.5h-34q-2 12-4 19.5t-4 14.5l-15 46q-18 54-63.5 87T274-280Z" />
                                </svg>
                              </span>


                              <span
                                className="action-icon"
                                title="Disable"
                                onClick={() => handleDisable(row)}
                                style={{ cursor: "pointer" }}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  height="24px"
                                  viewBox="0 -960 960 960"
                                  width="24px"
                                  fill="#EA3323"
                                >
                                  <path d="M819-28 701-146q-48 32-103.5 49T480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-62 17-117.5T146-701L27-820l57-57L876-85l-57 57ZM480-160q45 0 85.5-12t76.5-33L487-360l-63 64-170-170 56-56 114 114 7-8-226-226q-21 36-33 76.5T160-480q0 133 93.5 226.5T480-160Zm335-100-59-59q21-35 32.5-75.5T800-480q0-133-93.5-226.5T480-800q-45 0-85.5 11.5T319-756l-59-59q48-31 103.5-48T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 61-17 116.5T815-260ZM602-474l-56-56 104-104 56 56-104 104Zm-64-64ZM424-424Z" />
                                  \  </svg>
                              </span>

                            </>
                          )}
                        </td>
                      );
                    }

                    const value = row[col.field];
                    return (
                      <td
                        key={colIndex}
                        title={
                          value !== undefined && value !== null
                            ? String(value)
                            : ""
                        }
                      >
                        {value !== undefined && value !== null
                          ? String(value)
                          : ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="grid-pagination">
          <button
            onClick={() => setPage((p) => Math.max(p - 1, 0))}
            disabled={page === 0}
          >
            ◀
          </button>

          <span>
            Page {page + 1} of {totalPages}
          </span>

          <button
            onClick={() =>
              setPage((p) => Math.min(p + 1, totalPages - 1))
            }
            disabled={page + 1 >= totalPages}
          >
            ▶
          </button>

          <select
            value={size}
            onChange={(e) => {
              setSize(Number(e.target.value));
              setPage(0);
            }}
          >
            <option value={5}>5 / page</option>
            <option value={10}>10 / page</option>
            <option value={20}>20 / page</option>
          </select>
        </div>
      </div>

      {/* ADD */}
      <ModuleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        moduleName={Module}
        onSubmit={refreshGrid}
      />

      {/* EDIT */}
      <EditModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        moduleName={Module}
        uKey={editUkey}
        onSubmit={refreshGrid}
      />

      {/* VIEW */}
      {isViewOpen && (
        <ViewModal
          isOpen={isViewOpen}
          onClose={() => {
            setIsViewOpen(false);
            setViewUkey(null);
          }}
          moduleName={Module}
          uKey={viewUkey}
        />
      )}

      {/* STATUS (FIXED) */}
      <StatusModal
        isOpen={isStatusOpen}
        onClose={() => setIsStatusOpen(false)}
        moduleName={Module}
        uKey={statusUkey}
        isDisable={statusDisableValue}
        onSubmit={refreshGrid}
      />
    </div>
  );
}
