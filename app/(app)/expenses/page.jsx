"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Filter, Search, X, ChevronLeft, ChevronRight,
  TrendingUp, TrendingDown,
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import useAuthStore from "../../authStore";
import ExpenseDrawer from "../../components/ExpenseDrawer";
import ExpenseSummaryCards from "../../components/ExpenseSummaryCards";
import {
  getCategoryLabel,
  getCategoryIcon,
  getPaymentLabel,
  formatCurrency,
  formatDate,
  EXPENSE_CATEGORIES,
} from "../../../lib/expenseConstants";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const COLORS = [
  "#8b5cf6", "#06b6d4", "#f59e0b", "#10b981", "#ef4444",
  "#ec4899", "#6366f1", "#14b8a6", "#f97316", "#84cc16",
];

const ITEMS_PER_PAGE = 10;

export default function ExpensesPage() {
  const router = useRouter();
  const { user, token, isLoading, checkAuth } = useAuthStore();

  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDrawer, setShowDrawer] = useState(false);

  const [filterType, setFilterType] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
    if (user && token) fetchExpenses();
  }, [user, isLoading, token]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, filterCategory, searchQuery]);

  // ==============================
  // API
  // ==============================
  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/expenses/list`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: user?.id }),
      });
      const data = await res.json();
      if (res.ok) setExpenses(data.data || []);
    } catch (err) {
      console.error("Error fetching expenses:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = async (payload) => {
    try {
      const res = await fetch(`${API_URL}/expenses/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchExpenses();
        return { success: true };
      }
      return { success: false, error: data.message };
    } catch {
      return { success: false, error: "Network error" };
    }
  };

  const handleUpdateExpense = async (payload) => {
    try {
      const res = await fetch(`${API_URL}/expenses/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchExpenses();
        return { success: true };
      }
      return { success: false, error: data.message };
    } catch {
      return { success: false, error: "Network error" };
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    try {
      const res = await fetch(`${API_URL}/expenses/delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: user?.id, expenseId }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchExpenses();
        return { success: true };
      }
      return { success: false, error: data.message };
    } catch {
      return { success: false, error: "Network error" };
    }
  };

  const handleBatchAddExpense = async (expenseArray) => {
  try {
    const res = await fetch(`${API_URL}/expenses/create-batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        userId: user?.id,
        expenses: expenseArray,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      await fetchExpenses();
      return { success: true, count: data.count };
    }
    return { success: false, error: data.message };
  } catch {
    return { success: false, error: "Network error" };
  }
};

  // ==============================
  // FILTER + PAGINATION
  // ==============================
  const filteredExpenses = useMemo(() => {
    let list = [...expenses];
    if (filterType !== "all") list = list.filter((e) => e.type === Number(filterType));
    if (filterCategory !== "all") list = list.filter((e) => e.category === Number(filterCategory));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.description || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [expenses, filterType, filterCategory, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedExpenses = filteredExpenses.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  );

  const goToPage = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  // ==============================
  // ANALYTICS
  // ==============================
  const totals = useMemo(() => {
    const income = expenses
      .filter((e) => e.type === 1)
      .reduce((s, e) => s + Number(e.amount), 0);
    const spent = expenses
      .filter((e) => e.type === 2)
      .reduce((s, e) => s + Number(e.amount), 0);
    return { income, spent, balance: income - spent };
  }, [expenses]);

  const incomeVsExpense = useMemo(
    () => [
      { name: "Income", value: totals.income, fill: "#10b981" },
      { name: "Expense", value: totals.spent, fill: "#ef4444" },
    ],
    [totals]
  );

  const categoryData = useMemo(() => {
    const map = {};
    expenses
      .filter((e) => e.type === 2)
      .forEach((e) => {
        const label = getCategoryLabel(e.category);
        map[label] = (map[label] || 0) + Number(e.amount);
      });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  const paymentData = useMemo(() => {
    const map = {};
    expenses.forEach((e) => {
      const label = getPaymentLabel(e.paymentMethod);
      map[label] = (map[label] || 0) + Number(e.amount);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  if (isLoading || !user) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  return (
    <div className="p-3 lg:p-5">
      <div className="max-w-7xl mx-auto">

        {/* HEADER */}
        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              💰 Expenses
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Track your income and spending
            </p>
          </div>
          <button
            onClick={() => setShowDrawer(true)}
            className="px-3 py-2 text-xs font-medium bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Manage Expenses
          </button>
        </div>

        {/* SUMMARY CARDS */}
        <ExpenseSummaryCards expenses={expenses} />

        {/* =============================================
            MAIN 2-COLUMN LAYOUT
            Left = Table  |  Right = Analytics Sidebar
        ============================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">

          {/* ================= LEFT: Table ================= */}
          <div className="space-y-4 min-w-0">

            {/* FILTERS */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search expenses..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs focus:outline-none focus:border-violet-500 dark:text-white"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {[
                    { value: "all", label: "All" },
                    { value: "1", label: "Income" },
                    { value: "2", label: "Expense" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setFilterType(opt.value)}
                      className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition ${
                        filterType === opt.value
                          ? "bg-violet-600 text-white"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-gray-400" />
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="px-2 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 border-0 text-gray-700 dark:text-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="all">All Categories</option>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* TABLE */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              {loading ? (
                <div className="p-12 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
                </div>
              ) : filteredExpenses.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-4xl mb-3">💰</div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    No expenses found
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {expenses.length === 0
                      ? "Add your first transaction to get started"
                      : "Try adjusting your filters"}
                  </p>
                </div>
              ) : (
                <>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Expense
                        </th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">
                          Category
                        </th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">
                          Payment
                        </th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">
                          Date
                        </th>
                        <th className="px-4 py-2.5 text-right text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedExpenses.map((expense) => {
                        const isIncome = expense.type === 1;
                        return (
                          <tr
                            key={expense.id}
                            className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <span className="text-lg flex-shrink-0">
                                  {getCategoryIcon(expense.category)}
                                </span>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                    {expense.title}
                                  </p>
                                  {expense.description && (
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                      {expense.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-xs text-gray-600 dark:text-gray-400 hidden sm:table-cell">
                              {getCategoryLabel(expense.category)}
                            </td>
                            <td className="px-3 py-3 text-xs text-gray-600 dark:text-gray-400 hidden md:table-cell">
                              {getPaymentLabel(expense.paymentMethod)}
                            </td>
                            <td className="px-3 py-3 text-xs text-gray-600 dark:text-gray-400 hidden sm:table-cell">
                              {formatDate(expense.expenseDate)}
                            </td>
                            <td
                              className={`px-4 py-3 text-right text-sm font-bold ${
                                isIncome
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-rose-600 dark:text-rose-400"
                              }`}
                            >
                              {isIncome ? "+" : "−"}
                              {formatCurrency(expense.amount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        Showing{" "}
                        <span className="font-semibold text-gray-700 dark:text-gray-200">
                          {startIndex + 1}–
                          {Math.min(
                            startIndex + ITEMS_PER_PAGE,
                            filteredExpenses.length
                          )}
                        </span>{" "}
                        of{" "}
                        <span className="font-semibold text-gray-700 dark:text-gray-200">
                          {filteredExpenses.length}
                        </span>
                      </p>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => goToPage(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>

                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter(
                            (p) =>
                              p === 1 ||
                              p === totalPages ||
                              Math.abs(p - currentPage) <= 1
                          )
                          .reduce((acc, p, idx, arr) => {
                            if (idx > 0 && p - arr[idx - 1] > 1) acc.push("...");
                            acc.push(p);
                            return acc;
                          }, [])
                          .map((item, idx) =>
                            item === "..." ? (
                              <span
                                key={`e-${idx}`}
                                className="px-2 text-xs text-gray-400"
                              >
                                …
                              </span>
                            ) : (
                              <button
                                key={item}
                                onClick={() => goToPage(item)}
                                className={`min-w-[28px] h-7 px-2 text-xs font-medium rounded-lg transition ${
                                  currentPage === item
                                    ? "bg-violet-600 text-white"
                                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                }`}
                              >
                                {item}
                              </button>
                            )
                          )}

                        <button
                          onClick={() => goToPage(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ================= RIGHT: Analytics Sidebar ================= */}
          <aside className="lg:sticky lg:top-20 lg:self-start space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                📊 Analytics
              </h3>
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                Live
              </span>
            </div>

            {/* Income vs Expense mini bar */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Income vs Expense
              </p>
              <div className="h-28">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={incomeVsExpense}
                    margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                  >
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 9 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) =>
                        v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`
                      }
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#1f2937",
                        border: "none",
                        borderRadius: 8,
                        color: "white",
                        fontSize: 11,
                      }}
                      formatter={(value) => [formatCurrency(value), "Amount"]}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={50}>
                      {incomeVsExpense.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="flex items-center justify-between mt-2 text-[11px]">
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="w-3 h-3" />
                  {formatCurrency(totals.income)}
                </span>
                <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
                  <TrendingDown className="w-3 h-3" />
                  {formatCurrency(totals.spent)}
                </span>
              </div>
            </div>

            {/* Category breakdown */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                By Category
              </p>

              {categoryData.length > 0 ? (
                <>
                  <div className="h-32 mb-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={28}
                          outerRadius={50}
                          paddingAngle={2}
                        >
                          {categoryData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: "#1f2937",
                            border: "none",
                            borderRadius: 8,
                            color: "white",
                            fontSize: 11,
                          }}
                          formatter={(value) => formatCurrency(value)}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {categoryData.map((c, i) => {
                      const pct =
                        totals.spent > 0 ? (c.value / totals.spent) * 100 : 0;
                      return (
                        <div
                          key={c.name}
                          className="flex items-center gap-2 text-[11px]"
                        >
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: COLORS[i % COLORS.length] }}
                          />
                          <span className="flex-1 text-gray-700 dark:text-gray-300 truncate">
                            {c.name}
                          </span>
                          <span className="text-gray-400 text-[10px]">
                            {pct.toFixed(0)}%
                          </span>
                          <span className="font-medium text-gray-900 dark:text-white w-14 text-right">
                            {formatCurrency(c.value)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="text-xs text-gray-400 text-center py-6">
                  No data yet
                </p>
              )}
            </div>

            {/* Payment methods */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                By Payment Method
              </p>

              {paymentData.length > 0 ? (
                <div className="space-y-2.5">
                  {paymentData.map((p, i) => {
                    const max = Math.max(...paymentData.map((x) => x.value));
                    const pct = max > 0 ? (p.value / max) * 100 : 0;
                    return (
                      <div key={p.name} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-gray-700 dark:text-gray-300 font-medium">
                            {p.name}
                          </span>
                          <span className="text-gray-900 dark:text-white font-semibold">
                            {formatCurrency(p.value)}
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              background: COLORS[i % COLORS.length],
                            }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center py-4">
                  No data yet
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* DRAWER */}
<ExpenseDrawer
  isOpen={showDrawer}
  onClose={() => setShowDrawer(false)}
  expenses={expenses}
  onExpenseAdd={handleAddExpense}
  onExpenseUpdate={handleUpdateExpense}
  onExpenseDelete={handleDeleteExpense}
  onExpenseBatchAdd={handleBatchAddExpense}
  userId={user?.id}
/>
    </div>
  );
}