"use client";
import { useState, useRef, useEffect } from "react";
import { X, Upload, Camera, Check, AlertCircle, Sparkles } from "lucide-react";
import Tesseract from "tesseract.js";
import { parseReceipt } from "../../lib/receiptParser";

export default function ReceiptScanner({ isOpen, onClose, onExtracted }) {
  const [imagePreview, setImagePreview] = useState(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("idle");
  const [extracted, setExtracted] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef(null);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setImagePreview(null);
      setProgress(0);
      setStatus("idle");
      setExtracted(null);
      setErrorMsg("");
    }
  }, [isOpen]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMsg("Please select an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg("Image is too large (max 10MB)");
      return;
    }

    setErrorMsg("");
    setExtracted(null);
    setStatus("scanning");
    setProgress(0);

    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);

    try {
      const result = await Tesseract.recognize(file, "eng", {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });

      const rawText = result.data.text || "";
      console.log("📄 OCR raw text:", rawText);

      const parsed = parseReceipt(rawText);
      console.log("✅ Parsed result:", parsed);

      setExtracted(parsed);
      setStatus("done");
    } catch (err) {
      console.error("OCR failed:", err);
      setErrorMsg("Could not read the receipt. Try a clearer photo.");
      setStatus("error");
    }
  };

  const handleUse = () => {
    if (!extracted) return;
    console.log("👉 Sending to parent:", extracted);
    onExtracted(extracted);
    onClose();
  };

  const reset = () => {
    setImagePreview(null);
    setProgress(0);
    setStatus("idle");
    setExtracted(null);
    setErrorMsg("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ✅ IMPORTANT: no early return. Render conditionally instead.
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[200] bg-black/60" onClick={onClose} />

      <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden pointer-events-auto max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                <Camera className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Scan Receipt
                </h3>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                  We'll read it and fill the form — image isn't saved
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5">
            {errorMsg && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{errorMsg}</span>
              </div>
            )}

            {status === "idle" && (
              <label
                htmlFor="receipt-upload"
                className="flex flex-col items-center justify-center gap-3 p-10 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl hover:border-violet-400 dark:hover:border-violet-500 cursor-pointer transition"
              >
                <div className="w-14 h-14 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Upload or take a photo
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    JPG, PNG · max 10MB
                  </p>
                </div>
                <input
                  id="receipt-upload"
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFile}
                />
              </label>
            )}

            {imagePreview && (
              <div className="space-y-4">
                <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                  <img
                    src={imagePreview}
                    alt="Receipt preview"
                    className="w-full max-h-64 object-contain bg-gray-50 dark:bg-gray-900"
                  />
                  {status === "scanning" && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="bg-white dark:bg-gray-800 rounded-lg px-4 py-3 text-center min-w-[180px]">
                        <Sparkles className="w-5 h-5 mx-auto mb-2 text-violet-500 animate-pulse" />
                        <p className="text-xs font-medium text-gray-900 dark:text-white mb-2">
                          Reading receipt...
                        </p>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                          <div
                            className="bg-violet-600 h-1.5 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                          {progress}%
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {status === "done" && extracted && (
                  <div className="p-4 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Check className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                      <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">
                        Extracted details
                      </p>
                    </div>
                    <ResultRow label="Title" value={extracted.title} />
                    <ResultRow
                      label="Amount"
                      value={
                        extracted.amount !== null
                          ? `₹${extracted.amount.toFixed(2)}`
                          : null
                      }
                    />
                    <ResultRow label="Date" value={extracted.date} />
                    <p className="text-[10px] text-violet-600 dark:text-violet-400 mt-2 pt-2 border-t border-violet-200 dark:border-violet-800">
                      💡 Auto-filled — please double-check before saving.
                    </p>
                  </div>
                )}

                {status !== "scanning" && (
                  <button
                    onClick={reset}
                    className="text-xs text-gray-500 hover:text-violet-600 transition"
                  >
                    Choose a different image
                  </button>
                )}
              </div>
            )}
          </div>

          {status === "done" && extracted && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex gap-2 flex-shrink-0">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleUse}
                className="flex-1 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition text-sm font-medium flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Use these values
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ResultRow({ label, value }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-violet-600 dark:text-violet-400">{label}</span>
      <span
        className={`font-medium text-right truncate ml-2 ${
          value
            ? "text-gray-900 dark:text-white"
            : "text-gray-400 dark:text-gray-500 italic"
        }`}
      >
        {value || "Not found"}
      </span>
    </div>
  );
}