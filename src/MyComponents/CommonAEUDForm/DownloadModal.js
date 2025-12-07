import React, { useEffect } from "react";
import { toast } from "react-toastify";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export default function DownloadModal({ isOpen, onClose, moduleName, id, onSubmit }) {

    useEffect(() => {
        if (!isOpen || !id) return;

        const downloadInvoice = async () => {
            try {
                const response = await fetch(
                    `http://localhost:8080/api/Invoice/GenerateInvoice/${id}/1`,
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

                // -------------------------
                // ✔ Base64 → HTML decode
                // -------------------------
                const base64HTML = result.data;
                const decodedHTML = atob(base64HTML);

                // -------------------------
                // ✔ Render HTML hidden
                // -------------------------
                const container = document.createElement("div");
                container.innerHTML = decodedHTML;
                container.style.position = "fixed";
                container.style.top = "-9999px";
                container.style.left = "-9999px";
                container.style.width = "800px"; // good for A4
                document.body.appendChild(container);

                // -------------------------
                // ✔ Convert HTML → Canvas
                // -------------------------
                const canvas = await html2canvas(container, {
                    scale: 2, // HD Quality
                    useCORS: true
                });

                const imgData = canvas.toDataURL("image/png");

                // -------------------------
                // ✔ Generate PDF
                // -------------------------
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
