import React, { useEffect, useState } from "react";
import "../../Styles/DynamicGrid.css";
import { FaSearch } from "react-icons/fa";
import { useNavigate } from "react-router-dom";


export default function DynamicGrid({ columns = [], apiUrl, Module }) {
  const [data, setData] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchText, setSearchText] = useState("");

  /* ---------------------- Fetch API ---------------------- */
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${apiUrl}/${page}/${size}`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.json())
      .then((response) => {
        if (response.status === 200) {
          const dataObj = response.data;
          const list =
            Array.isArray(dataObj)
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

  /* ---------------------- Search + Status Filter ---------------------- */
  const filteredData = data
    ?.filter((row) =>
      selectedStatus === "all"
        ? true
        : row.status?.toLowerCase() === selectedStatus
    )
    .filter((row) =>
      searchText
        ? Object.values(row)
          .join(" ")
          .toLowerCase()
          .includes(searchText.toLowerCase())
        : true
    );

  /* ---------------------- Column Width System ---------------------- */
  const computedWidths = () => {
    const count = columns.length || 1;
    return columns.map((c) => c.width || `${Math.floor(100 / count)}%`);
  };

  const widths = computedWidths();

  return (
    <div className="grid-wrapper">
      {/* Search + Add Section */}
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
        <button className="add-button" onClick={() => navigate(`/master/${Module.toLowerCase()}/add`)}>

          <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#ffffffff">
            <path d="M444-288h72v-156h156v-72H516v-156h-72v156H288v72h156v156ZM216-144q-29.7 0-50.85-21.15Q144-186.3 144-216v-528q0-29.7 21.15-50.85Q186.3-816 216-816h528q29.7 0 50.85 21.15Q816-773.7 816-744v528q0 29.7-21.15 50.85Q773.7-144 744-144H216Zm0-72h528v-528H216v528Zm0-528v528-528Z" />
          </svg>
          Add New {Module}
        </button>

      </div>

      {/* Status Filters */}
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

      {/* TABLE */}
      <div className="grid-container">
        {/* Header Table */}
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

        {/* Scrollable Body */}
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
    </div>
  );
}
