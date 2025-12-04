import React, { useEffect } from "react";
import { toast } from "react-toastify";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export default function DownloadModal({ isOpen, onClose, moduleName, id, onSubmit }) {
    useEffect(() => {
        if (isOpen && id) {
            const downloadInvoice = async () => {
                try {
                    const response = await fetch(`http://localhost:8080/api/Invoice/GenerateInvoice/${id}/1`, { method: "GET", credentials: "include", headers: { "Content-Type": "application/json" } });
                    const result = await response.json();
                    if (result.status !== 200 || !result.data) throw new Error(result.message || "Failed to generate invoice");
                    const htmlString = atob(result.data);
                    const container = document.createElement("div");
                    container.style.position = "absolute";
                    container.style.left = "-9999px";
                    container.innerHTML = htmlString;
                    document.body.appendChild(container);
                    const canvas = await html2canvas(container, { scale: 2 });
                    const imgData = canvas.toDataURL("image/png");
                    const pdf = new jsPDF("p", "pt", "a4");
                    const pdfWidth = pdf.internal.pageSize.getWidth();
                    const pdfHeight = pdf.internal.pageSize.getHeight();
                    const imgWidth = (pdfWidth * 0.5);
                    const imgHeight = (canvas.height * imgWidth) / canvas.width;
                    const xOffset = (pdfWidth - imgWidth) / 2;
                    const yOffset = (pdfHeight - imgHeight) / 2;
                    pdf.addImage(imgData, "PNG", xOffset, yOffset, imgWidth, imgHeight); // centered and scaled
                    const timestamp = new Date().toISOString().replace(/[-:.]/g, "");
                    pdf.save(`${moduleName}_${timestamp}.pdf`);
                    document.body.removeChild(container);
                    toast.success(result.message || "Invoice downloaded successfully!");
                    onClose();
                    onSubmit();
                } catch (err) {
                    console.error(err);
                    toast.error(err.message || "Failed to download invoice.");
                }
            };
            downloadInvoice();
        }
    }, [isOpen, id, moduleName, onClose, onSubmit]);

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
