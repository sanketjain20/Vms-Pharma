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
          className={`status-chip ${
            selectedStatus === "active" ? "active" : ""
          }`}
          onClick={() => setSelectedStatus("active")}
        >
          Active
        </span>
        <span
          className={`status-chip ${
            selectedStatus === "inactive" ? "active" : ""
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
                                  '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/></svg>',
                              }}
                            />
                          ) : (
                            <>
                              <FaEdit
                                className="action-icon"
                                title="Edit"
                                onClick={() => handleEdit(row)}
                              />
                              <FaEye
                                className="action-icon"
                                title="View"
                                onClick={() => handleView(row)}
                              />
                              <FaBan
                                className="action-icon"
                                title="Disable"
                                onClick={() => handleDisable(row)}
                              />
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
