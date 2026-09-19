"use client";
import { useState, useRef, useEffect } from "react";
import {
  X, Upload, Camera, Check, AlertCircle, Sparkles,
  Edit2, Trash2, Loader2,
} from "lucide-react";
import Tesseract from "tesseract.js";
import { parseReceipt } from "../../lib/receiptParser";
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  toDateInputValue,
  toTimestampMs,
} from "../../lib/expenseConstants";

const MAX_FILES = 10;

export default function BatchReceiptScanner({ isOpen, onClose, onBatchSave }) {
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const fileInputRef = useRef(null);

  // Use a ref to always read fresh items from inside async functions
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setItems([]);
      setSaving(false);
      setSaveError("");
    }
  }, [isOpen]);

  // ================================
  // SCAN ONE ITEM
  // ================================
  const scanItem = async (index) => {
    const targetItem = itemsRef.current[index];
    if (!targetItem || !targetItem.file) {
      console.warn("scanItem: no target at index", index);
      return;
    }

    // Mark as scanning
    setItems((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], status: "scanning", progress: 0 };
      }
      return next;
    });

    try {
      console.log(`🔍 Starting OCR for receipt ${index + 1}`);
      const result = await Tesseract.recognize(targetItem.file, "eng", {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setItems((prev) => {
              const next = [...prev];
              if (next[index] && next[index].status === "scanning") {
                next[index] = {
                  ...next[index],
                  progress: Math.round(m.progress * 100),
                };
              }
              return next;
            });
          }
        },
      });

      const parsed = parseReceipt(result.data.text || "");
      console.log(`✅ Parsed receipt ${index + 1}:`, parsed);

      setItems((prev) => {
        const next = [...prev];
        if (next[index]) {
          next[index] = {
            ...next[index],
            status: "done",
            progress: 100,
            data: {
              title: parsed.title || "",
              amount: parsed.amount !== null ? String(parsed.amount) : "",
              expenseDate: parsed.date || toDateInputValue(Date.now()),
              type: 2,
              category: 1,
              paymentMethod: 1,
              description: "",
            },
          };
        }
        return next;
      });
    } catch (err) {
      console.error(`❌ OCR failed for receipt ${index + 1}:`, err);
      setItems((prev) => {
        const next = [...prev];
        if (next[index]) {
          next[index] = {
            ...next[index],
            status: "error",
            error: "Could not read this receipt",
          };
        }
        return next;
      });
    }
  };

  // ================================
  // ADD FILES AND START SCANNING
  // ================================
  const handleFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const currentCount = itemsRef.current.length;
    if (currentCount + files.length > MAX_FILES) {
      alert(`You can only upload up to ${MAX_FILES} receipts at a time.`);
      return;
    }

    const validFiles = files.filter((f) => f.type.startsWith("image/"));
    if (validFiles.length === 0) return;

    // Build new items
    const newItems = validFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      status: "pending",
      data: null,
      error: "",
      progress: 0,
    }));

    const startIndex = currentCount;

    // Update state AND ref immediately
    const updated = [...itemsRef.current, ...newItems];
    itemsRef.current = updated;
    setItems(updated);

    // Kick off scans for the new items
    newItems.forEach((_, offset) => {
      const idx = startIndex + offset;
      // Small delay to let React render first
      setTimeout(() => scanItem(idx), 100 + offset * 50);
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ================================
  // EDIT / REMOVE
  // ================================
  const updateItem = (index, patch) => {
    setItems((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = {
          ...next[index],
          data: { ...next[index].data, ...patch },
        };
      }
      return next;
    });
  };

  const removeItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // ================================
  // DERIVED STATE
  // ================================
  const validItems = items.filter((it) => it.status === "done" && it.data);
  const totalAmount = validItems.reduce(
    (sum, it) => sum + (Number(it.data.amount) || 0),
    0
  );
  const isProcessing = items.some(
    (it) => it.status === "scanning" || it.status === "pending"
  );

  // ================================
  // SAVE ALL
  // ================================
  const handleSaveAll = async () => {
    setSaveError("");
    if (validItems.length === 0) {
      setSaveError("No valid receipts to save");
      return;
    }

    for (let i = 0; i < validItems.length; i++) {
      const d = validItems[i].data;
      if (!d.title?.trim()) {
        setSaveError(`Receipt ${i + 1}: title is required`);
        return;
      }
      if (!d.amount || Number(d.amount) <= 0) {
        setSaveError(`Receipt ${i + 1}: valid amount is required`);
        return;
      }
    }

    setSaving(true);

    const payload = validItems.map((it) => ({
      title: it.data.title.trim(),
      amount: Number(it.data.amount),
      type: Number(it.data.type),
      category: Number(it.data.category),
      paymentMethod: Number(it.data.paymentMethod),
      expenseDate: toTimestampMs(it.data.expenseDate),
      description: it.data.description?.trim() || "",
    }));

    const result = await onBatchSave(payload);
    setSaving(false);

    if (result.success) {
      onClose();
    } else {
      setSaveError(result.error || "Failed to save batch");
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[200] bg-black/60" onClick={onClose} />

      <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden pointer-events-auto max-h-[90vh] flex flex-col"
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
                  Scan Receipts (Bulk)
                </h3>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                  Upload up to {MAX_FILES} receipts — we'll read each and fill the forms
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
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {saveError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{saveError}</span>
              </div>
            )}

            {items.length === 0 && (
              <label
                htmlFor="batch-upload"
                className="flex flex-col items-center justify-center gap-3 p-10 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl hover:border-violet-400 dark:hover:border-violet-500 cursor-pointer transition"
              >
                <div className="w-14 h-14 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Select multiple receipt images
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Up to {MAX_FILES} images · JPG, PNG · max 10MB each
                  </p>
                </div>
                <input
                  id="batch-upload"
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFiles}
                />
              </label>
            )}

            {items.map((item, index) => (
              <BatchItemCard
                key={index}
                item={item}
                index={index}
                onUpdate={(patch) => updateItem(index, patch)}
                onRemove={() => removeItem(index)}
                onRetry={() => scanItem(index)}
              />
            ))}

            {items.length > 0 && items.length < MAX_FILES && (
              <label
                htmlFor="batch-upload-more"
                className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl hover:border-violet-400 dark:hover:border-violet-500 cursor-pointer transition text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-violet-600 dark:hover:text-violet-400"
              >
                <Upload className="w-4 h-4" />
                Add more receipts ({items.length}/{MAX_FILES})
                <input
                  id="batch-upload-more"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFiles}
                />
              </label>
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between gap-3 flex-shrink-0">
              <div className="text-xs">
                <p className="text-gray-500 dark:text-gray-400">
                  {validItems.length} valid
                  {isProcessing && " · processing..."}
                </p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  Total: ₹{totalAmount.toFixed(2)}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAll}
                  disabled={saving || validItems.length === 0 || isProcessing}
                  className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Save all {validItems.length}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ================================
// ITEM CARD
// ================================
function BatchItemCard({ item, index, onUpdate, onRemove, onRetry }) {
  const [editing, setEditing] = useState(false);

  if (item.status === "scanning" || item.status === "pending") {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-700">
          {item.preview && (
            <img src={item.preview} alt="" className="w-full h-full object-cover" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Receipt {index + 1}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <Sparkles className="w-3 h-3 text-violet-500 animate-pulse" />
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {item.status === "pending"
                ? "Starting..."
                : `Reading... ${item.progress}%`}
            </p>
          </div>
          <div className="mt-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
            <div
              className="bg-violet-600 h-1 rounded-full transition-all duration-200"
              style={{ width: `${item.progress || 0}%` }}
            ></div>
          </div>
        </div>
      </div>
    );
  }

  if (item.status === "error") {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-700">
          {item.preview && (
            <img src={item.preview} alt="" className="w-full h-full object-cover" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-red-700 dark:text-red-400">
            Receipt {index + 1} — couldn't read
          </p>
          <p className="text-[11px] text-red-600 dark:text-red-500 mt-0.5">
            {item.error || "Try a clearer photo"}
          </p>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={onRetry}
            className="px-2.5 py-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition text-[11px] font-medium"
          >
            Retry
          </button>
          <button
            onClick={onRemove}
            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  const d = item.data;

  return (
    <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-900/10 overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-700">
          {item.preview && (
            <img src={item.preview} alt="" className="w-full h-full object-cover" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {d.title || "(no title)"}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            ₹{Number(d.amount || 0).toFixed(2)} · {d.expenseDate}
          </p>
        </div>
        <button
          onClick={() => setEditing((v) => !v)}
          className="p-1.5 text-violet-600 hover:bg-violet-100 dark:hover:bg-violet-900/40 rounded-lg transition"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onRemove}
          className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {editing && (
        <div className="border-t border-violet-200 dark:border-violet-800 p-3 space-y-2 bg-white dark:bg-gray-800">
          <input
            type="text"
            value={d.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Title"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          />

          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              step="0.01"
              value={d.amount}
              onChange={(e) => onUpdate({ amount: e.target.value })}
              placeholder="Amount"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <input
              type="date"
              value={d.expenseDate}
              onChange={(e) => onUpdate({ expenseDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select
              value={d.category}
              onChange={(e) => onUpdate({ category: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <select
              value={d.paymentMethod}
              onChange={(e) =>
                onUpdate({ paymentMethod: Number(e.target.value) })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              {PAYMENT_METHODS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}