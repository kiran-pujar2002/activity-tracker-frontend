"use client";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import {
  X,
  Check,
  AlertCircle,
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  TrendingUp,
  TrendingDown,
  CalendarClock,
  Camera,
  Layers,
} from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from "./ui/drawer.jsx";
import ReceiptScanner from "./ReceiptScanner";
import BatchReceiptScanner from "./BatchReceiptScanner";
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  getCategoryIcon,
  formatCurrency,
  toDateInputValue,
  toTimestampMs,
  formatDate,
} from "../../lib/expenseConstants";

// ================================
// VALIDATION SCHEMA
// ================================
const expenseSchema = yup.object({
  title: yup
    .string()
    .trim()
    .required("Title is required")
    .max(100, "Title must be under 100 characters"),
  amount: yup
    .number()
    .typeError("Amount must be a number")
    .required("Amount is required")
    .positive("Amount must be greater than 0"),
  type: yup
    .number()
    .typeError("Type is required")
    .required("Type is required")
    .oneOf([1, 2], "Select a valid type"),
  category: yup
    .number()
    .typeError("Category is required")
    .required("Category is required"),
  paymentMethod: yup
    .number()
    .typeError("Payment method is required")
    .required("Payment method is required"),
  expenseDate: yup.string().required("Date is required"),
  description: yup.string().max(500, "Description is too long").nullable(),
});

export default function ExpenseDrawer({
  isOpen,
  onClose,
  expenses = [],
  onExpenseAdd,
  onExpenseUpdate,
  onExpenseDelete,
  onExpenseBatchAdd,
  userId,
}) {
  const [view, setView] = useState("menu");
  const [editingExpense, setEditingExpense] = useState(null);
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showBatchScanner, setShowBatchScanner] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(expenseSchema),
    defaultValues: {
      title: "",
      amount: "",
      type: 2,
      category: 1,
      paymentMethod: 1,
      expenseDate: toDateInputValue(Date.now()),
      description: "",
    },
  });

  const selectedType = watch("type");

  // Reset form when view changes
  useEffect(() => {
    if (view === "add") {
      reset({
        title: "",
        amount: "",
        type: 2,
        category: 1,
        paymentMethod: 1,
        expenseDate: toDateInputValue(Date.now()),
        description: "",
      });
      setServerError("");
      setScanSuccess(false);
    } else if (view === "edit" && editingExpense) {
      reset({
        title: editingExpense.title || "",
        amount: editingExpense.amount || "",
        type: editingExpense.type || 2,
        category: editingExpense.category || 1,
        paymentMethod: editingExpense.paymentMethod || 1,
        expenseDate: toDateInputValue(editingExpense.expenseDate || Date.now()),
        description: editingExpense.description || "",
      });
      setServerError("");
    }
  }, [view, editingExpense, reset]);

  const resetAll = () => {
    setView("menu");
    setEditingExpense(null);
    setServerError("");
    setIsSubmitting(false);
    setScanSuccess(false);
    setShowScanner(false);
    setShowBatchScanner(false);
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  // ================================
  // SCANNER RESULT HANDLER
  // ================================
  const handleReceiptExtracted = (parsed) => {
    const opts = {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    };

    if (parsed.title) setValue("title", parsed.title, opts);
    if (parsed.amount !== null && parsed.amount !== undefined) {
      setValue("amount", String(parsed.amount), opts);
    }
    if (parsed.date) {
      setValue("expenseDate", parsed.date, opts);
    } else {
      setValue("expenseDate", toDateInputValue(Date.now()), opts);
    }

    setScanSuccess(true);
    setTimeout(() => setScanSuccess(false), 4000);
  };

  // ================================
  // SUBMIT
  // ================================
  const onSubmit = async (data) => {
    setServerError("");
    setIsSubmitting(true);

    const payload = {
      userId,
      title: data.title.trim(),
      amount: Number(data.amount),
      type: Number(data.type),
      category: Number(data.category),
      paymentMethod: Number(data.paymentMethod),
      expenseDate: toTimestampMs(data.expenseDate),
      description: data.description?.trim() || "",
    };

    let result;
    if (view === "edit" && editingExpense) {
      result = await onExpenseUpdate({
        ...payload,
        expenseId: editingExpense.id,
      });
    } else {
      result = await onExpenseAdd(payload);
    }

    setIsSubmitting(false);

    if (result.success) {
      setView("menu");
      setEditingExpense(null);
    } else {
      setServerError(result.error || "Failed to save expense");
    }
  };

  const onInvalid = (errs) => {
    console.error("Form validation failed:", errs);
    setServerError("Please fill all required fields correctly");
  };

  const handleDelete = async (expense) => {
    if (!window.confirm(`Delete "${expense.title}"?`)) return;
    setDeletingId(expense.id);
    const result = await onExpenseDelete(expense.id);
    setDeletingId(null);
    if (!result.success) {
      setServerError(result.error || "Failed to delete");
    }
  };

  const startEdit = (expense) => {
    setEditingExpense(expense);
    setView("edit");
  };

  // ================================
  // RENDER
  // ================================
  return (
    <>
      <Drawer
        open={isOpen}
        onOpenChange={(open) => {
          if (!open && !showScanner && !showBatchScanner) {
            handleClose();
          }
        }}
        direction="right"
      >
        <DrawerContent onPointerDownOutside={(e) => e.preventDefault()}>
          {/* HEADER */}
          <DrawerHeader className="!border-b-0">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                {view !== "menu" && (
                  <button
                    onClick={() => {
                      setView("menu");
                      setEditingExpense(null);
                      setServerError("");
                      setScanSuccess(false);
                    }}
                    className="p-1.5 -ml-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                )}
                <div>
                  <DrawerTitle>
                    {view === "menu" && "Manage Expenses"}
                    {view === "add" && "Add Expense"}
                    {view === "edit" && "Edit Expense"}
                  </DrawerTitle>
                  <DrawerDescription>
                    {view === "menu" &&
                      `${expenses.length} total expense${expenses.length !== 1 ? "s" : ""}`}
                    {view === "add" && "Record a new income or expense"}
                    {view === "edit" && "Update this transaction"}
                  </DrawerDescription>
                </div>
              </div>
              <DrawerClose asChild>
                <button
                  onClick={handleClose}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          {/* BODY */}
          <div className="flex-1 overflow-y-auto px-5 pb-5">
            {/* =====================
                VIEW: MENU
            ===================== */}
            {view === "menu" && (
              <>
                {serverError && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1">{serverError}</span>
                    <button
                      onClick={() => setServerError("")}
                      className="p-0.5 hover:bg-red-100 dark:hover:bg-red-800/50 rounded"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <button
                  onClick={() => setView("add")}
                  className="w-full flex items-center gap-4 p-4 mb-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition text-left"
                >
                  <div className="w-10 h-10 flex items-center justify-center bg-white/20 rounded-lg flex-shrink-0">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">Add Expense</p>
                    <p className="text-xs opacity-80 mt-0.5">
                      Record a new transaction
                    </p>
                  </div>
                </button>

                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Recent
                  </p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500">
                    {expenses.length} total
                  </p>
                </div>

                <div className="space-y-2">
                  {expenses.slice(0, 30).map((expense) => {
                    const isIncome = expense.type === 1;
                    return (
                      <div
                        key={expense.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 transition"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg text-xl flex-shrink-0">
                            {getCategoryIcon(expense.category)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {expense.title}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                              <CalendarClock className="w-3 h-3" />
                              <span>{formatDate(expense.expenseDate)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span
                            className={`text-sm font-bold ${
                              isIncome
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {isIncome ? "+" : "−"}
                            {formatCurrency(expense.amount)}
                          </span>
                          <button
                            onClick={() => startEdit(expense)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(expense)}
                            disabled={deletingId === expense.id}
                            className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {expenses.length === 0 && (
                    <div className="text-center py-12">
                      <div className="text-3xl mb-2">💰</div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        No expenses yet
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Add your first transaction to get started
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* =====================
                VIEW: ADD / EDIT
            ===================== */}
            {(view === "add" || view === "edit") && (
              <form
                onSubmit={handleSubmit(onSubmit, onInvalid)}
                className="space-y-4"
              >
                {serverError && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1">{serverError}</span>
                  </div>
                )}

                {/* SCAN OPTIONS (Add view only) */}
                {view === "add" && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setShowScanner(true)}
                      className="flex flex-col items-center gap-2 p-3 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 hover:border-violet-400 dark:hover:border-violet-600 rounded-xl transition group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center group-hover:bg-violet-200 dark:group-hover:bg-violet-900/60 transition">
                        <Camera className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">
                          📷 Scan One
                        </p>
                        <p className="text-[10px] text-violet-600/80 dark:text-violet-400/80 mt-0.5">
                          Single receipt
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowBatchScanner(true)}
                      className="flex flex-col items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 dark:hover:border-emerald-600 rounded-xl transition group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center group-hover:bg-emerald-200 dark:group-hover:bg-emerald-900/60 transition">
                        <Layers className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                          📚 Scan Bulk
                        </p>
                        <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
                          Multiple receipts
                        </p>
                      </div>
                    </button>
                  </div>
                )}

                {scanSuccess && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2">
                    <Check className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1">
                      Receipt scanned — fields auto-filled. Please double-check.
                    </span>
                  </div>
                )}

                {/* TYPE TOGGLE */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Type *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setValue("type", 1, { shouldValidate: true })
                      }
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 text-sm font-medium transition ${
                        selectedType === 1
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
                          : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                      }`}
                    >
                      <TrendingUp className="w-4 h-4" />
                      Income
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setValue("type", 2, { shouldValidate: true })
                      }
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 text-sm font-medium transition ${
                        selectedType === 2
                          ? "border-rose-500 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400"
                          : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                      }`}
                    >
                      <TrendingDown className="w-4 h-4" />
                      Expense
                    </button>
                  </div>
                  {errors.type && (
                    <p className="text-[11px] text-red-500 mt-1">
                      {errors.type.message}
                    </p>
                  )}
                </div>

                {/* TITLE */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Title *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Lunch, Salary, Cab fare..."
                    maxLength={100}
                    {...register("title")}
                    className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 text-sm dark:bg-gray-800 dark:text-white ${
                      errors.title
                        ? "border-red-400 focus:ring-red-500"
                        : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                    }`}
                  />
                  {errors.title && (
                    <p className="text-[11px] text-red-500 mt-1">
                      {errors.title.message}
                    </p>
                  )}
                </div>

                {/* AMOUNT */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...register("amount")}
                    className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 text-sm dark:bg-gray-800 dark:text-white ${
                      errors.amount
                        ? "border-red-400 focus:ring-red-500"
                        : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                    }`}
                  />
                  {errors.amount && (
                    <p className="text-[11px] text-red-500 mt-1">
                      {errors.amount.message}
                    </p>
                  )}
                </div>

                {/* DATE */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Date *
                  </label>
                  <input
                    type="date"
                    {...register("expenseDate")}
                    className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 text-sm dark:bg-gray-800 dark:text-white ${
                      errors.expenseDate
                        ? "border-red-400 focus:ring-red-500"
                        : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                    }`}
                  />
                  {errors.expenseDate && (
                    <p className="text-[11px] text-red-500 mt-1">
                      {errors.expenseDate.message}
                    </p>
                  )}
                </div>

                {/* CATEGORY */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Category *
                  </label>
                  <select
                    {...register("category")}
                    className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 text-sm dark:bg-gray-800 dark:text-white ${
                      errors.category
                        ? "border-red-400 focus:ring-red-500"
                        : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                    }`}
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {getCategoryIcon(cat.value)} {cat.label}
                      </option>
                    ))}
                  </select>
                  {errors.category && (
                    <p className="text-[11px] text-red-500 mt-1">
                      {errors.category.message}
                    </p>
                  )}
                </div>

                {/* PAYMENT METHOD */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Payment Method *
                  </label>
                  <select
                    {...register("paymentMethod")}
                    className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 text-sm dark:bg-gray-800 dark:text-white ${
                      errors.paymentMethod
                        ? "border-red-400 focus:ring-red-500"
                        : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                    }`}
                  >
                    {PAYMENT_METHODS.map((pm) => (
                      <option key={pm.value} value={pm.value}>
                        {pm.label}
                      </option>
                    ))}
                  </select>
                  {errors.paymentMethod && (
                    <p className="text-[11px] text-red-500 mt-1">
                      {errors.paymentMethod.message}
                    </p>
                  )}
                </div>

                {/* DESCRIPTION */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Description (Optional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Add more details..."
                    maxLength={500}
                    {...register("description")}
                    className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 text-sm resize-none dark:bg-gray-800 dark:text-white ${
                      errors.description
                        ? "border-red-400 focus:ring-red-500"
                        : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                    }`}
                  />
                  {errors.description && (
                    <p className="text-[11px] text-red-500 mt-1">
                      {errors.description.message}
                    </p>
                  )}
                </div>

                {/* ACTIONS */}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setView("menu");
                      setEditingExpense(null);
                      setServerError("");
                      setScanSuccess(false);
                    }}
                    className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    {view === "edit" ? "Update" : "Add"} Expense
                  </button>
                </div>
              </form>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* SINGLE RECEIPT SCANNER */}
      <ReceiptScanner
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onExtracted={handleReceiptExtracted}
      />

      {/* BATCH RECEIPT SCANNER */}
      <BatchReceiptScanner
        isOpen={showBatchScanner}
        onClose={() => setShowBatchScanner(false)}
        onBatchSave={onExpenseBatchAdd}
      />
    </>
  );
}