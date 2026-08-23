import React, { useEffect } from "react";
import { toast } from "react-toastify";
import jsPDF from "jspdf";
import ModalShell from "../CommonComponent/ModalShell";
import "../../Styles/DownloadModal.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import { beginGlobalBusy } from "../../utils/globalBusy";

export default function DownloadModal({ isOpen, onClose, moduleName, id, onSubmit }) {

    useEffect(() => {
        if (!isOpen || !id) return;

        const downloadInvoice = async () => {
            let iframe = null;
            const stopBusy = beginGlobalBusy("Downloading invoice...");

            try {
                const response = await apiClient(
                    `${API_BASE_URL}/api/Invoice/GenerateInvoice/${id}/1`,
                    {
                        method: "GET",
                        headers: { "Content-Type": "application/json" },
                    }
                );

                const result = await response.json();

                if (result.status !== 200 || !result.data) {
                    throw new Error(result.message || "Failed to generate invoice");
                }

                // ── Decode Base64 -> UTF-8 HTML ─────────────────────────────
                // atob() only reverses base64 — it does NOT UTF-8 decode.
                // It treats every decoded byte as one Latin-1 char, so any
                // multi-byte UTF-8 character (₹, –, etc.) comes out mangled
                // ("â□" style garbage). Route the raw bytes through
                // TextDecoder("utf-8") to get correct characters.
                const binaryStr = atob(result.data);
                const bytes = Uint8Array.from(binaryStr, (c) => c.charCodeAt(0));
                const decodedHTML = new TextDecoder("utf-8").decode(bytes);

                // ── Render full HTML (head + body) into a hidden iframe ─────
                // Using an iframe preserves the <style> block from <head>,
                // Google Fonts, and all CSS — nothing gets stripped.
                iframe = document.createElement("iframe");
                iframe.style.position  = "fixed";
                iframe.style.top       = "-9999px";
                iframe.style.left      = "-9999px";
                iframe.style.width     = "600px";   // matches .inv-paper width + padding
                iframe.style.height    = "1px";      // will auto-expand
                iframe.style.border    = "none";
                iframe.style.visibility = "hidden";
                document.body.appendChild(iframe);

                // Write the full decoded HTML into the iframe
                iframe.contentDocument.open();
                iframe.contentDocument.write(decodedHTML);
                iframe.contentDocument.close();

                // ── Wait for fonts & layout to settle ──────────────────────
                await new Promise(resolve => {
                    iframe.onload = resolve;
                    // fallback in case onload already fired
                    setTimeout(resolve, 1200);
                });

                // Extra wait for Google Fonts to render
                await new Promise(resolve => setTimeout(resolve, 600));

                // ── Get the actual invoice element inside the iframe ────────
                const iframeDoc  = iframe.contentDocument;
                const invoiceEl  = iframeDoc.querySelector(".inv-paper")
                                || iframeDoc.querySelector(".sv-modal")
                                || iframeDoc.body;

                // Resize iframe height to match content so nothing is clipped
                iframe.style.height = `${invoiceEl.scrollHeight + 60}px`;
                await new Promise(resolve => setTimeout(resolve, 200));

                // ── Capture with html2canvas ────────────────────────────────
                // html2canvas runs inside the iframe's window context
                const { default: html2canvas } = await import("html2canvas");

                const canvas = await html2canvas(invoiceEl, {
                    scale           : 2,
                    useCORS         : true,
                    allowTaint      : false,
                    backgroundColor : "#ffffff",
                    windowWidth     : 600,
                    scrollX         : 0,
                    scrollY         : 0,
                    logging         : false,
                });

                // ── Generate PDF ────────────────────────────────────────────
                const imgData  = canvas.toDataURL("image/png");
                const pdf      = new jsPDF("p", "mm", "a4");
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

                pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);

                const timestamp = new Date().toISOString().replace(/[-:.]/g, "");
                pdf.save(`${moduleName}_${timestamp}.pdf`);

                toast.success("Invoice downloaded successfully!");
                onClose();
                onSubmit();

            } catch (err) {
                console.error(err);
                toast.error(err.message || "Failed to download invoice.");
            } finally {
                stopBusy();
                // Always clean up the iframe
                if (iframe && iframe.parentNode) {
                    iframe.parentNode.removeChild(iframe);
                }
            }
        };

        downloadInvoice();
    }, [isOpen, id]);

    if (!isOpen) return null;

    return (
        <ModalShell
            open
            tone="accent"
            title={`Downloading ${moduleName} invoice`}
            size="sm"
            hideClose
            busy
        >
            <div className="dl-progress">
                <div className="dl-ring">
                    <span />
                </div>
                <p className="dl-text">
                    Please wait while the invoice is generated — this closes automatically when it's ready.
                </p>
            </div>
        </ModalShell>
    );
}