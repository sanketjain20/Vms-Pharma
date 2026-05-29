import React, { useEffect } from "react";
import { toast } from "react-toastify";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

export default function DownloadModal({ isOpen, onClose, moduleName, id, onSubmit }) {

    useEffect(() => {
        if (!isOpen || !id) return;

        const downloadInvoice = async () => {
            try {
                const response = await apiClient(
                    `${API_BASE_URL}/api/Invoice/GenerateInvoice/${id}/1`,
                    {
                        method: "GET",
                        credentials: "include",
                        headers: { "Content-Type": "application/json" },
                    }
                );

                const result = await response.json();

                if (result.status !== 200 || !result.data) {
                    throw new Error(result.message || "Failed to generate invoice");
                }

                // ✅ Decode Base64
                const decodedHTML = atob(result.data);

                // ✅ Parse HTML
                const parser = new DOMParser();
                const doc = parser.parseFromString(decodedHTML, "text/html");

                // ✅ Create container
                const container = document.createElement("div");
                container.innerHTML = doc.body.innerHTML;

                container.style.position = "fixed";
                container.style.top = "-9999px";
                container.style.left = "-9999px";
                container.style.width = "800px";
                container.style.background = "#ffffff";
                container.style.padding = "20px";

                document.body.appendChild(container);

                // ✅ Fix layout issues
                container.querySelectorAll(".sv-backdrop").forEach(el => {
                    el.style.display = "block";
                });

                container.querySelectorAll(".sv-modal").forEach(el => {
                    el.style.margin = "0 auto";
                    el.style.width = "800px";
                    el.style.background = "#ffffff";
                    el.style.color = "#000";
                });

                container.querySelectorAll("table, th, td").forEach(el => {
                    el.style.color = "#000";
                });

                // FORCE FULL LIGHT THEME FOR PDF
container.querySelectorAll("*").forEach(el => {
    el.style.background = "transparent";
    el.style.color = "#000";
    el.style.borderColor = "#ccc";
});

// Fix headers / highlights
container.querySelectorAll("th").forEach(el => {
    el.style.background = "#e5e7eb";
    el.style.color = "#000";
});

// Fix cards (invoice number, date)
container.querySelectorAll(".sv-meta-card").forEach(el => {
    el.style.background = "#f3f4f6";
    el.style.color = "#000";
});

// Fix totals section
container.querySelectorAll(".sv-totals-row").forEach(el => {
    el.style.color = "#000";
});

// Fix "Due" red box
container.querySelectorAll(".sv-totals-due").forEach(el => {
    el.style.color = "#dc2626";
    el.style.border = "1px solid #dc2626";
    el.style.background = "#fee2e2";
});

                // ✅ WAIT (important)
                await new Promise(resolve => setTimeout(resolve, 500));

                // 🎯 VERY IMPORTANT: capture ONLY invoice
                const target = container.querySelector(".sv-modal") || container;

                target.style.display = "block";
                target.style.opacity = "1";

                // ✅ Canvas capture
                const canvas = await html2canvas(target, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: "#ffffff"
                });

                const imgData = canvas.toDataURL("image/png");

                // ✅ PDF generate
                const pdf = new jsPDF("p", "mm", "a4");

                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

                pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);

                const timestamp = new Date()
                    .toISOString()
                    .replace(/[-:.]/g, "");

                pdf.save(`${moduleName}_${timestamp}.pdf`);

                // cleanup
                container.remove();

                toast.success("Invoice downloaded successfully!");

                onClose();
                onSubmit();

            } catch (err) {
                console.error(err);
                toast.error(err.message || "Failed to download invoice.");
            }
        };

        downloadInvoice();
    }, [isOpen, id]);

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h3>Downloading {moduleName} invoice...</h3>
                <p>Please wait while the invoice is being generated.</p>
            </div>
        </div>
    );
}