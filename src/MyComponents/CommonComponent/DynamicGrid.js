import React, { useEffect, useState, useRef } from "react";
import "../../Styles/DynamicGrid.css";
import { FaSearch } from "react-icons/fa";
import ModuleModal from "../CommonAEUDForm/ModuleModal";
import EditModal from "../CommonAEUDForm/EditModal";
import ViewModal from "../CommonAEUDForm/ViewModal";
import StatusModal from "../CommonAEUDForm/StatusModal";
import DownlaodModal from "../CommonAEUDForm/DownloadModal";
import { Status } from "../Enums/Status.js";
import { toast } from "react-toastify";

export default function DynamicGrid({ columns = [], apiUrl, Module, ModuleId }) {
  const [data, setData] = useState([]);
  const [allData, setAllData] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [emptyMsg, setEmptyMsg] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editUkey, setEditUkey] = useState(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewUkey, setViewUkey] = useState(null);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [statusUkey, setStatusUkey] = useState(null);
  const [statusDisableValue, setStatusDisableValue] = useState(0);
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const [downloadId, setDownloadId] = useState(null);
  const [accessList, setAccessList] = useState([]);
  const [colWidths, setColWidths] = useState(() =>
  columns.map(c => c.width || `${Math.floor(100 / Math.max(columns.length, 1))}%`)
);
  const [hoveredRow, setHoveredRow] = useState(null);

  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  const can = (perm) => accessList.includes(perm);

  /* 3D CANVAS BACKGROUND */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const orbs = Array.from({ length: 4 }, (_, i) => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: 80 + Math.random() * 160,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      hue: [215, 225, 230, 210][i],
      alpha: 0.018 + Math.random() * 0.022,
    }));

    let tick = 0;
    const draw = () => {
      tick++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const horizon = canvas.height * 0.48;
      const vanishX = canvas.width / 2;
      const gridCount = 10;
      const speed = (tick * 0.2) % (canvas.height / gridCount);

      ctx.save();
      ctx.globalAlpha = 0.04;
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= gridCount; i++) {
        const y = horizon + speed + (i * (canvas.height - horizon)) / gridCount;
        if (y > canvas.height) continue;
        const spread = ((y - horizon) / (canvas.height - horizon)) * canvas.width * 1.3;
        ctx.beginPath();
        ctx.moveTo(vanishX - spread / 2, y);
        ctx.lineTo(vanishX + spread / 2, y);
        ctx.stroke();
      }
      for (let i = 0; i <= 14; i++) {
        const t = i / 14;
        const bx = vanishX - canvas.width * 0.65 + t * canvas.width * 1.3;
        ctx.beginPath();
        ctx.moveTo(vanishX, horizon);
        ctx.lineTo(bx, canvas.height + 10);
        ctx.stroke();
      }
      ctx.restore();

      orbs.forEach((o) => {
        o.x += o.vx; o.y += o.vy;
        if (o.x < -o.r) o.x = canvas.width + o.r;
        if (o.x > canvas.width + o.r) o.x = -o.r;
        if (o.y < -o.r) o.y = canvas.height + o.r;
        if (o.y > canvas.height + o.r) o.y = -o.r;
        const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
        g.addColorStop(0, `hsla(${o.hue},75%,55%,${o.alpha})`);
        g.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
      });

      const vig = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.height * 0.1, canvas.width / 2, canvas.height / 2, canvas.height * 0.9);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(0,0,0,0.6)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      animFrameRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { window.removeEventListener("resize", resize); cancelAnimationFrame(animFrameRef.current); };
  }, []);

  /* ACCESS */
  useEffect(() => {
    if (!Module) return;
    fetch(`http://localhost:8080/api/Access/GetUserModuleAccess/${ModuleId}`, { method: "GET", credentials: "include" })
      .then(r => r.json())
      .then(res => { if (res.status === 200 && Array.isArray(res.data)) setAccessList(res.data); });
  }, [Module]);

  const refreshGrid = React.useCallback(() => {
    fetch(`${apiUrl}/${page}/${size}`, { method: "GET", credentials: "include" })
      .then(r => r.json())
      .then(res => {
        if (res.status === 200) {
          const dataObj = res.data;
          const list = Array.isArray(dataObj) ? dataObj : Object.values(dataObj ?? {}).find(v => Array.isArray(v)) || [];
          setData(list);
          setTotalPages(dataObj?.totalPages || 1);
          setEmptyMsg(list.length ? "" : "No records found.");
        } else { toast.error(res.message); }
      });
    fetch(`${apiUrl}/0/100000`, { method: "GET", credentials: "include" })
      .then(r => r.json())
      .then(res => {
        if (res.status === 200) {
          const dataObj = res.data;
          const list = Array.isArray(dataObj) ? dataObj : Object.values(dataObj ?? {}).find(v => Array.isArray(v)) || [];
          setAllData(list);
        }
      });
  }, [apiUrl, page, size]);

  useEffect(() => { refreshGrid(); }, [refreshGrid]);

  useEffect(() => {
    fetch(`${apiUrl}/0/100000`, { method: "GET", credentials: "include" })
      .then(r => r.json())
      .then(res => {
        const dataObj = res.data;
        const list = Array.isArray(dataObj) ? dataObj : Object.values(dataObj ?? {}).find(v => Array.isArray(v)) || [];
        setAllData(list);
      });
  }, [apiUrl]);

  const counts = React.useMemo(() => {
    const all = allData.length;
    if (Module === "Sales") {
      return { all, payment_done: allData.filter(r => r.statusId === Status.PaymentDone).length, payment_pending: allData.filter(r => r.statusId === Status.PaymentPending).length };
    }
    return { all, active: allData.filter(r => r.disable === 0).length, inactive: allData.filter(r => r.disable === 1).length };
  }, [allData, Module]);

  const filteredData = allData
    .filter(row => {
      if (Module === "Sales") {
        if (selectedStatus === "all") return true;
        if (selectedStatus === "payment_done") return row.statusId === Status.PaymentDone;
        if (selectedStatus === "payment_pending") return row.statusId === Status.PaymentPending;
      } else {
        if (selectedStatus === "all") return true;
        if (row.disable !== undefined) return selectedStatus === (row.disable === 0 ? "active" : "inactive");
      }
      return true;
    })
    .filter(row => searchText ? Object.values(row).join(" ").toLowerCase().includes(searchText.toLowerCase()) : true);

  const pagedData = React.useMemo(() => {
    const start = page * size;
    return filteredData.slice(start, start + size);
  }, [filteredData, page, size]);

  useEffect(() => {
    const pages = Math.ceil(filteredData.length / size) || 1;
    setTotalPages(pages);
    if (page >= pages) setPage(0);
  }, [filteredData.length, size]);

  useEffect(() => { setPage(0); }, [selectedStatus]);

useEffect(() => {
  if (columns.length > 0) {
    setColWidths(columns.map(c => c.width || `${Math.floor(100 / columns.length)}%`));
  }
}, []);

  const handleEdit = (row) => { setEditUkey(row.uKey); setIsEditOpen(true); };
  const handleView = (row) => { setViewUkey(row.uKey); setIsViewOpen(true); };
  const handleDisable = (row) => { setStatusUkey(row.uKey); setStatusDisableValue(0); setIsStatusOpen(true); };
  const handleActivate = (row) => { setStatusUkey(row.uKey); setStatusDisableValue(1); setIsStatusOpen(true); };
  const handleDownload = (row) => { setDownloadId(row.id); setIsDownloadOpen(true); };

// AFTER
const startResize = (index, e) => {
  e.preventDefault();
  const startX = e.clientX;
  const th = document.getElementById(`col-${index}`);
  const startWidth = th.getBoundingClientRect().width; // reads actual rendered width
  const onMouseMove = (mv) => {
    const newWidth = startWidth + (mv.clientX - startX);
    setColWidths(prev => {
      const u = [...prev];
      u[index] = `${Math.max(newWidth, 60)}px`;
      return u;
    });
  };
  const onMouseUp = () => {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  };
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
};

  /* ACTION ICONS */
  const IconEdit = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="15px" viewBox="0 -960 960 960" width="15px" fill="currentColor">
      <path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/>
    </svg>
  );
  const IconView = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="15px" viewBox="0 -960 960 960" width="15px" fill="currentColor">
      <path d="M274-360q31 0 55.5-18t34.5-47l15-46q16-48-8-88.5T302-600H161l19 157q5 35 31.5 59t62.5 24Zm412 0q36 0 62.5-24t31.5-59l19-157H659q-45 0-69 41t-8 89l14 45q10 29 34.5 47t55.5 18Zm-412 80q-66 0-115.5-43.5T101-433L80-600H40v-80h262q44 0 80.5 21.5T440-600h81q21-37 57.5-58.5T659-680h261v80h-40l-21 167q-8 66-57.5 109.5T686-280q-57 0-102.5-32.5T520-399l-15-45q-2-7-4-14.5t-4-21.5h-34q-2 12-4 19.5t-4 14.5l-15 46q-18 54-63.5 87T274-280Z"/>
    </svg>
  );
  const IconActivate = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="15px" viewBox="0 -960 960 960" width="15px" fill="currentColor">
      <path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/>
    </svg>
  );
  const IconDownload = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="15px" viewBox="0 -960 960 960" width="15px" fill="currentColor">
      <path d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"/>
    </svg>
  );
  const IconDisable = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="15px" viewBox="0 -960 960 960" width="15px" fill="currentColor">
      <path d="M819-28 701-146q-48 32-103.5 49T480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-62 17-117.5T146-701L27-820l57-57L876-85l-57 57ZM480-160q45 0 85.5-12t76.5-33L487-360l-63 64-170-170 56-56 114 114 7-8-226-226q-21 36-33 76.5T160-480q0 133 93.5 226.5T480-160Zm335-100-59-59q21-35 32.5-75.5T800-480q0-133-93.5-226.5T480-800q-45 0-85.5 11.5T319-756l-59-59q48-31 103.5-48T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 61-17 116.5T815-260ZM602-474l-56-56 104-104 56 56-104 104Zm-64-64ZM424-424Z"/>
    </svg>
  );
const totalColWidth = colWidths.reduce((sum, w) => sum + (parseInt(w) || 150), 0);
  return (
    <div className="dg-wrapper">
      {/* 3D canvas */}
      <canvas ref={canvasRef} className="dg-canvas" />
      <div className="dg-noise" />
      <div className="dg-top-beam" />

      <div className="dg-inner">

        {/* ── TOP BAR ── */}
        <div className="dg-topbar">
          <div className="dg-search-wrap">
            <FaSearch className="dg-search-icon" />
            <input
              type="text"
              className="dg-search"
              placeholder={`      Search ${Module || "records"}…`}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
            />
            {searchText && (
              <button className="dg-search-clear" onClick={() => setSearchText("")}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>

          <div className="dg-topbar-right">
            <div className="dg-record-count">
              <span className="dg-count-dot" />
              {filteredData.length} records
            </div>
            {can("Add") && (
              <button className="dg-add-btn" onClick={() => setIsModalOpen(true)}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                Add {Module}
              </button>
            )}
          </div>
        </div>

        {/* ── STATUS CHIPS ── */}
        <div className="dg-chips">
          {Module === "Sales" ? (
            <>
              {[
                { key: "all", label: "All", count: counts.all },
                { key: "payment_done", label: "Payment Done", count: counts.payment_done },
                { key: "payment_pending", label: "Pending", count: counts.payment_pending },
              ].map(c => (
                <button key={c.key} className={`dg-chip ${selectedStatus === c.key ? "dg-chip-active" : ""}`} onClick={() => setSelectedStatus(c.key)}>
                  {c.label}
                  <span className="dg-chip-count">{c.count}</span>
                </button>
              ))}
            </>
          ) : (
            <>
              {[
                { key: "all", label: "All", count: counts.all },
                { key: "active", label: "Active", count: counts.active, color: "green" },
                { key: "inactive", label: "Inactive", count: counts.inactive, color: "red" },
              ].map(c => (
                <button key={c.key} className={`dg-chip ${selectedStatus === c.key ? "dg-chip-active" : ""} ${c.color ? `dg-chip-${c.color}` : ""}`} onClick={() => setSelectedStatus(c.key)}>
                  {c.label}
                  <span className="dg-chip-count">{c.count}</span>
                </button>
              ))}
            </>
          )}
        </div>

        {/* ── TABLE SHELL ── */}
        <div className="dg-shell">
          <div className="dg-shell-header">
            <div className="dg-shell-title">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="1" y="1" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                <rect x="7" y="1" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                <rect x="1" y="7" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                <rect x="7" y="7" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
              </svg>
              Data Grid
            </div>
            <div className="dg-shell-meta">
              <span className="dg-shell-pulse" />
              {pagedData.length} of {filteredData.length} shown
            </div>
          </div>

          <div className="dg-scroll">
            <table
  className="dg-table"
  style={{
    width: "100%",
    minWidth: totalColWidth + "px",
  }}
>
              <colgroup>
                {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
              </colgroup>
              <thead>
                <tr>
                  {columns.map((col, idx) => (
                    <th key={idx} id={`col-${idx}`} title={col.header} className="dg-th"
  style={{ width: colWidths[idx], minWidth: colWidths[idx] }}
>
                      <span className="dg-th-inner">
                        <span className="dg-col-num">{String(idx + 1).padStart(2, "0")}</span>
                        {col.header}
                      </span>
                      <div className="dg-resizer" onMouseDown={e => startResize(idx, e)} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {emptyMsg && filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="dg-empty">
                      <div className="dg-empty-inner">
                        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                          <circle cx="14" cy="14" r="12" stroke="rgba(59,130,246,0.2)" strokeWidth="1.5"/>
                          <path d="M10 14h8M14 10v8" stroke="rgba(59,130,246,0.3)" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                        {emptyMsg}
                      </div>
                    </td>
                  </tr>
                ) : (
                  pagedData?.map((row, rowIdx) => (
                    <tr
                      key={rowIdx}
                      className={`dg-row ${hoveredRow === rowIdx ? "dg-row-hovered" : ""}`}
                      style={{ animationDelay: `${rowIdx * 0.025}s` }}
                      onMouseEnter={() => setHoveredRow(rowIdx)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      {columns.map((col, colIdx) => {
                        if (col.field === "Action") {
                          return (
                            <td key={colIdx} className="dg-action-cell">
                              {selectedStatus === "inactive" ? (
                                <>
                                  <button className="dg-action-btn view" title="View" onClick={() => handleView(row)}><IconView /></button>
                                  {can("Disable") && <button className="dg-action-btn activate" title="Activate" onClick={() => handleActivate(row)}><IconActivate /></button>}
                                </>
                              ) : (
                                <>
                                  {can("Edit") && <button className="dg-action-btn edit" title="Edit" onClick={() => handleEdit(row)}><IconEdit /></button>}
                                  <button className="dg-action-btn view" title="View" onClick={() => handleView(row)}><IconView /></button>
                                  {Module === "Sales" && can("Download") && <button className="dg-action-btn download" title="Download" onClick={() => handleDownload(row)}><IconDownload /></button>}
                                  {(!Module !== "Sales") && can("Disable") && <button className="dg-action-btn disable" title="Disable" onClick={() => handleDisable(row)}><IconDisable /></button>}
                                </>
                              )}
                            </td>
                          );
                        }

                        const value = row[col.field];
                        let displayValue = "";
                        if (value !== undefined && value !== null) {
                          if (typeof value === "number") displayValue = value.toFixed(2);
                          else displayValue = typeof value === "object" ? JSON.stringify(value) : String(value);
                        }

                        return (
                          <td key={colIdx} className="dg-td" title={displayValue}>
                            {displayValue || <span className="dg-td-empty">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ── PAGINATION ── */}
          <div className="dg-pagination">
            <button className="dg-page-btn" onClick={() => setPage(0)} disabled={page === 0}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M7 2L3 5L7 8M4 2L4 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button className="dg-page-btn" onClick={() => setPage(p => Math.max(p - 1, 0))} disabled={page === 0}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M7 2L3 5L7 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            <div className="dg-page-indicator">
              <span className="dg-page-cur">{page + 1}</span>
              <span className="dg-page-sep">/</span>
              <span className="dg-page-tot">{totalPages}</span>
            </div>

            <button className="dg-page-btn" onClick={() => setPage(p => Math.min(p + 1, totalPages - 1))} disabled={page + 1 >= totalPages}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M3 2L7 5L3 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button className="dg-page-btn" onClick={() => setPage(totalPages - 1)} disabled={page + 1 >= totalPages}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M3 2L7 5L3 8M6 2L6 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            <select className="dg-size-select" value={size} onChange={e => { setSize(Number(e.target.value)); setPage(0); }}>
              {[10, 25, 50, 100].map(s => <option key={s} value={s}>{s} / page</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* MODALS */}
      <ModuleModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} moduleName={Module} onSubmit={refreshGrid} />
      <EditModal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} moduleName={Module} uKey={editUkey} onSubmit={refreshGrid} />
      {isViewOpen && (
        <ViewModal isOpen={isViewOpen} onClose={() => { setIsViewOpen(false); setViewUkey(null); }} moduleName={Module} uKey={viewUkey} />
      )}
      <StatusModal isOpen={isStatusOpen} onClose={() => setIsStatusOpen(false)} moduleName={Module} uKey={statusUkey} isDisable={statusDisableValue} onSubmit={refreshGrid} />
      <DownlaodModal isOpen={isDownloadOpen} onClose={() => setIsDownloadOpen(false)} moduleName={Module} id={downloadId} onSubmit={refreshGrid} />
    </div>
  );
}
