"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Edit2,
  Clock,
  Sunrise,
  Sun,
  Sunset,
  Moon,
  Plus,
  FileSpreadsheet,
  X,
  Check,
  Flame,
  Target,
  Calendar,
  TrendingUp,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import useAuthStore from "../../authStore";
import ActivityDrawer from "../../components/ActivityDrawer";

export default function Dashboard() {
  const router = useRouter();
  const {
    user,
    activities,
    toggleActivity,
    isLoading,
    checkAuth,
    token,
    fetchActivities,
  } = useAuthStore();

  const API_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState("");
  const [currentYear, setCurrentYear] = useState("");
  const [dayLogs, setDayLogs] = useState({});
  const [showDrawer, setShowDrawer] = useState(false);
  const [canComplete, setCanComplete] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState({ hours: 0, minutes: 0 });

  // Inline quick-add
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickStart, setQuickStart] = useState("");
  const [quickEnd, setQuickEnd] = useState("");
  const [quickError, setQuickError] = useState("");
  const [quickAdding, setQuickAdding] = useState(false);

  // Stats from API
  const [stats, setStats] = useState(null);
  const [trend, setTrend] = useState([]);
  const [insights, setInsights] = useState([]);

  const today = new Date();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    setCurrentMonth(monthNames[currentDate.getMonth()]);
    setCurrentYear(currentDate.getFullYear().toString());

    const monthKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;
    const savedLogs = localStorage.getItem(`dayLogs_${monthKey}`);
    setDayLogs(savedLogs ? JSON.parse(savedLogs) : {});
  }, [user, isLoading, activities, currentDate]);

  const fetchTodayActivities = async () => {
    if (!token) return;
    try {
      const r = await fetch(`${API_URL}/activities/today`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      if (r.ok) {
        setCanComplete(data.canComplete);
        setTimeRemaining(data.timeRemaining || { hours: 0, minutes: 0 });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAnalytics = async () => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const [statsRes, trendRes, insightsRes] = await Promise.all([
        fetch(`${API_URL}/activities/stats`, { headers }),
        fetch(`${API_URL}/activities/trend?days=30`, { headers }),
        fetch(`${API_URL}/activities/insights`, { headers }),
      ]);

      const [statsData, trendData, insightsData] = await Promise.all([
        statsRes.json(),
        trendRes.json(),
        insightsRes.json(),
      ]);

      if (statsData.success) setStats(statsData.stats);
      if (trendData.success) setTrend(trendData.trend || []);
      if (insightsData.success) setInsights(insightsData.insights || []);
    } catch (err) {
      console.error("Analytics fetch error:", err);
    }
  };

  useEffect(() => {
    if (user && token) {
      fetchTodayActivities();
      fetchAnalytics();
    }
  }, [user, token]);

  // =====================
  // CRUD
  // =====================
  const handleAddActivity = async (name, icon, startTime, endTime) => {
    if (!token) return { success: false, error: "Not authenticated" };
    try {
      const r = await fetch(`${API_URL}/activities`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, icon, startTime, endTime }),
      });
      const data = await r.json();
      if (r.ok) {
        await fetchActivities();
        return { success: true };
      }
      return { success: false, error: data.message };
    } catch {
      return { success: false, error: "Network error" };
    }
  };

  const handleUpdateActivity = async (id, name, icon, startTime, endTime) => {
    if (!token) return { success: false, error: "Not authenticated" };
    try {
      const r = await fetch(`${API_URL}/activities/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, icon, startTime, endTime }),
      });
      const data = await r.json();
      if (r.ok) {
        await fetchActivities();
        return { success: true };
      }
      return { success: false, error: data.message };
    } catch {
      return { success: false, error: "Network error" };
    }
  };

  const handleDeleteActivity = async (id) => {
    if (!token) return { success: false, error: "Not authenticated" };
    try {
      const r = await fetch(`${API_URL}/activities/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      if (r.ok) {
        await fetchActivities();
        return { success: true };
      }
      return { success: false, error: data.message };
    } catch {
      return { success: false, error: "Network error" };
    }
  };

  const handleDeleteAllDefaults = async () => {
    if (!token) return { success: false, error: "Not authenticated" };
    try {
      const r = await fetch(`${API_URL}/activities/defaults/all`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      if (r.ok) {
        await fetchActivities();
        return { success: true, deletedCount: data.deletedCount };
      }
      return { success: false, error: data.message };
    } catch {
      return { success: false, error: "Network error" };
    }
  };

  // =====================
  // QUICK ADD
  // =====================
  const handleQuickAdd = async () => {
    setQuickError("");

    if (!quickName.trim()) {
      setQuickError("Name is required");
      return;
    }
    if (quickStart && quickEnd && quickStart >= quickEnd) {
      setQuickError("End time must be after start");
      return;
    }

    setQuickAdding(true);
    const res = await handleAddActivity(
      quickName.trim(),
      "📋",
      quickStart || "",
      quickEnd || ""
    );
    setQuickAdding(false);

    if (res.success) {
      setQuickName("");
      setQuickStart("");
      setQuickEnd("");
      setShowQuickAdd(false);
    } else {
      setQuickError(res.error || "Failed to add");
    }
  };

  const cancelQuickAdd = () => {
    setShowQuickAdd(false);
    setQuickName("");
    setQuickStart("");
    setQuickEnd("");
    setQuickError("");
  };

  // =====================
  // NAVIGATION
  // =====================
  const goToPrevMonth = () =>
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
    );
  const goToNextMonth = () =>
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
    );
  const goToCurrentMonth = () => setCurrentDate(new Date());

  // =====================
  // DATE HELPERS
  // =====================
  const isTodayDate = (dayIndex) =>
    currentDate.getFullYear() === today.getFullYear() &&
    currentDate.getMonth() === today.getMonth() &&
    dayIndex + 1 === today.getDate();

  const isPastDate = (dayIndex) => {
    const d = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      dayIndex + 1
    );
    d.setHours(0, 0, 0, 0);
    const tm = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    tm.setHours(0, 0, 0, 0);
    return d < tm;
  };

  const isFutureDate = (dayIndex) => {
    const d = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      dayIndex + 1
    );
    d.setHours(0, 0, 0, 0);
    const tm = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    tm.setHours(0, 0, 0, 0);
    return d > tm;
  };

  const canToggleDay = (dayIndex) => isTodayDate(dayIndex) && canComplete;

  const handleDayToggle = (activityId, dayIndex) => {
    if (!canToggleDay(dayIndex)) {
      if (isPastDate(dayIndex)) alert("❌ Cannot modify past days.");
      else if (isFutureDate(dayIndex)) alert("⏳ Cannot mark future days.");
      else if (!canComplete) alert("⏰ Time's up for today!");
      return;
    }
    const monthKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;
    const logKey = `${activityId}-day-${dayIndex}`;
    setDayLogs((prev) => {
      const next = { ...prev, [logKey]: !prev[logKey] };
      localStorage.setItem(`dayLogs_${monthKey}`, JSON.stringify(next));
      return next;
    });
    toggleActivity(activityId);

    // Refresh analytics after toggle so charts update
    setTimeout(() => fetchAnalytics(), 500);
  };

  // =====================
  // TIME
  // =====================
  const formatTime = (time) => {
    if (!time) return null;
    const [h, m] = time.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  };

  const getTimeOfDay = (time) => {
    if (!time)
      return { icon: <Clock className="w-3 h-3" />, color: "text-gray-400" };
    const hour = parseInt(time.split(":")[0]);
    if (hour < 6)
      return { icon: <Moon className="w-3 h-3" />, color: "text-indigo-500" };
    if (hour < 12)
      return { icon: <Sunrise className="w-3 h-3" />, color: "text-orange-500" };
    if (hour < 17)
      return { icon: <Sun className="w-3 h-3" />, color: "text-yellow-500" };
    if (hour < 20)
      return { icon: <Sunset className="w-3 h-3" />, color: "text-pink-500" };
    return { icon: <Moon className="w-3 h-3" />, color: "text-blue-500" };
  };

  // =====================
  // SORT
  // =====================
  const sortedActivities = useMemo(() => {
    const list = activities || [];
    return [...list].sort((a, b) => {
      if (a.startTime && !b.startTime) return -1;
      if (!a.startTime && b.startTime) return 1;
      if (a.startTime && b.startTime)
        return a.startTime.localeCompare(b.startTime);
      return (a.order || 0) - (b.order || 0);
    });
  }, [activities]);

  // =====================
  // CHART DATA
  // =====================
  const trendChartData = useMemo(
    () =>
      trend.map((d) => ({
        date: new Date(d.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        percentage: d.percentage,
      })),
    [trend]
  );

  const insightsChartData = useMemo(
    () =>
      insights.slice(0, 8).map((a) => ({
        name: a.name.length > 20 ? a.name.substring(0, 20) + "…" : a.name,
        percentage: a.percentage,
      })),
    [insights]
  );

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // =====================
  // CALCULATIONS
  // =====================
  const daysInMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0
  ).getDate();

  const weeks = [];
  let weekStart = 1;
  while (weekStart <= daysInMonth) {
    const weekEnd = Math.min(weekStart + 6, daysInMonth);
    weeks.push({
      label: `WEEK ${weeks.length + 1}`,
      days: `DAY ${weekStart} – ${weekEnd}`,
      start: weekStart - 1,
      end: weekEnd,
      total: weekEnd - weekStart + 1,
    });
    weekStart = weekEnd + 1;
  }

  const isCurrentMonth =
    currentDate.getMonth() === new Date().getMonth() &&
    currentDate.getFullYear() === new Date().getFullYear();

  return (
    <div className="p-2 lg:p-2">
      <div className="max-w-full mx-auto space-y-2">
        {/* TOP BAR */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={goToPrevMonth}
                className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition text-gray-700 dark:text-gray-300 text-sm"
              >
                ◀
              </button>
              <h2 className="text-base font-bold text-gray-900 dark:text-white px-2">
                {currentMonth} {currentYear}
              </h2>
              {!isCurrentMonth && (
                <button
                  onClick={goToCurrentMonth}
                  className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Today
                </button>
              )}
              <button
                onClick={goToNextMonth}
                className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition text-gray-700 dark:text-gray-300 text-sm"
              >
                ▶
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDrawer(true)}
                className="px-3 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Import
              </button>
              <button
                onClick={() => setShowDrawer(true)}
                className="px-3 py-1.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition flex items-center gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Manage Activities
              </button>
            </div>
          </div>
        </div>

        {/* ACTIVITY TABLE */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50">
                  <th className="px-2 py-2 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase border-r border-gray-200 dark:border-gray-700 sticky left-0 bg-gray-50 dark:bg-gray-900 z-20 min-w-[180px]">
                    ACTIVITY
                  </th>
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const isToday = isTodayDate(i);
                    const isPast = isPastDate(i);
                    const isFuture = isFutureDate(i);

                    if (isToday) {
                      return (
                        <th
                          key={`day-${i}`}
                          className="relative px-1 py-1 text-center border-r border-blue-300 dark:border-blue-800 min-w-[38px]"
                        >
                          <div className="relative mx-auto w-full max-w-[38px]">
                            <div className="absolute -inset-1 rounded-lg bg-gradient-to-b from-blue-400 via-blue-500 to-indigo-500 opacity-30 blur-sm animate-pulse"></div>
                            <div className="relative rounded-lg bg-gradient-to-b from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/40 py-1">
                              <div className="text-[11px] font-black leading-none">
                                {i + 1}
                              </div>
                              <div className="text-[7px] font-bold uppercase tracking-wider leading-tight mt-0.5 opacity-90">
                                Today
                              </div>
                            </div>
                          </div>
                        </th>
                      );
                    }

                    return (
                      <th
                        key={`day-${i}`}
                        className={`px-1 py-1 text-center text-[10px] font-bold border-r border-gray-200 dark:border-gray-700 min-w-[32px] ${
                          isPast
                            ? "text-gray-400 dark:text-gray-600"
                            : isFuture
                            ? "text-gray-400 dark:text-gray-600"
                            : "text-gray-600 dark:text-gray-300"
                        }`}
                      >
                        {i + 1}
                      </th>
                    );
                  })}
                </tr>
                <tr className="bg-gray-100 dark:bg-gray-700/30">
                  <th className="px-2 py-1 text-left text-[10px] font-bold text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 sticky left-0 bg-gray-100 dark:bg-gray-900 z-20">
                    Week
                  </th>
                  {weeks.map((week, index) => (
                    <th
                      key={`week-${index}`}
                      colSpan={week.total}
                      className="px-1 py-1 text-center text-[10px] font-bold text-blue-600 dark:text-blue-400 border-r border-gray-200 dark:border-gray-700"
                    >
                      WEEK {index + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedActivities.length === 0 ? (
                  <tr>
                    <td
                      colSpan={daysInMonth + 1}
                      className="px-4 py-16 text-center"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <div className="text-5xl">📋</div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          No activities yet
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Add your first activity below or import from Excel
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sortedActivities.map((activity, index) => {
                    const tod = getTimeOfDay(activity.startTime);
                    const hasTime = activity.startTime || activity.endTime;
                    const rowBg =
                      index % 2 === 0
                        ? "bg-white dark:bg-gray-800"
                        : "bg-gray-50/50 dark:bg-gray-800/50";
                    const stickyBg =
                      index % 2 === 0
                        ? "bg-white dark:bg-gray-800"
                        : "bg-gray-50 dark:bg-gray-900";

                    return (
                      <tr
                        key={activity.id}
                        className={`border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 ${rowBg}`}
                      >
                        <td
                          className={`px-2 py-1.5 text-xs text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 sticky left-0 z-10 min-w-[180px] ${stickyBg}`}
                        >
                          <div className="flex items-start gap-1.5">
                            <span className="text-sm mt-0.5">
                              {activity.icon || "📋"}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium">
                                {activity.name}
                              </div>
                              {hasTime ? (
                                <div
                                  className={`flex items-center gap-1 text-[10px] ${tod.color} mt-0.5`}
                                >
                                  {tod.icon}
                                  <span>
                                    {activity.startTime
                                      ? formatTime(activity.startTime)
                                      : ""}
                                    {activity.endTime
                                      ? ` → ${formatTime(activity.endTime)}`
                                      : ""}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                                  <Clock className="w-2.5 h-2.5" />
                                  <span>No time set</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        {Array.from({ length: daysInMonth }, (_, i) => {
                          const logKey = `${activity.id}-day-${i}`;
                          const isChecked = dayLogs[logKey] || false;
                          const isPast = isPastDate(i);
                          const isFuture = isFutureDate(i);
                          const isToday = isTodayDate(i);
                          const canToggle = isToday && canComplete;

                          let cellClass =
                            "px-1 py-1 text-center border-r border-gray-100 dark:border-gray-700 transition-all duration-150";

                          if (isChecked) {
                            cellClass +=
                              " bg-emerald-100 dark:bg-emerald-900/40 ring-1 ring-emerald-300 dark:ring-emerald-700 ring-inset";
                          } else if (isToday && canComplete) {
                            cellClass +=
                              " bg-blue-50 dark:bg-blue-900/15 hover:bg-emerald-50 dark:hover:bg-emerald-900/25";
                          } else if (isPast) {
                            cellClass += " bg-gray-50 dark:bg-gray-800/50";
                          }

                          if (canToggle) {
                            cellClass += " cursor-pointer";
                          } else {
                            cellClass += " cursor-not-allowed opacity-60";
                          }

                          if (isToday && !isChecked) {
                            cellClass +=
                              " ring-1 ring-blue-400 dark:ring-blue-500 ring-inset";
                          }

                          return (
                            <td
                              key={i}
                              className={cellClass}
                              onClick={() =>
                                handleDayToggle(activity.id, i)
                              }
                            >
                              <span
                                className={`text-lg inline-block transition-transform ${
                                  isChecked ? "scale-110" : ""
                                }`}
                              >
                                {isChecked ? "✅" : "☐"}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}

                {/* INLINE QUICK-ADD ROW */}
                <tr className="border-t border-gray-200 dark:border-gray-700">
                  <td
                    colSpan={daysInMonth + 1}
                    className="px-3 py-3 bg-white dark:bg-gray-800"
                  >
                    {showQuickAdd ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={quickName}
                            onChange={(e) => setQuickName(e.target.value)}
                            onKeyDown={(e) =>
                              e.key === "Enter" && handleQuickAdd()
                            }
                            placeholder="Activity name..."
                            autoFocus
                            className="min-w-[180px] px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          />
                          <div className="flex items-center gap-1.5">
                            <input
                              type="time"
                              value={quickStart}
                              onChange={(e) => setQuickStart(e.target.value)}
                              className="px-2 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                              title="Start time (optional)"
                            />
                            <span className="text-xs text-gray-400">→</span>
                            <input
                              type="time"
                              value={quickEnd}
                              onChange={(e) => setQuickEnd(e.target.value)}
                              className="px-2 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                              title="End time (optional)"
                            />
                          </div>
                          <button
                            onClick={handleQuickAdd}
                            disabled={quickAdding}
                            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {quickAdding ? (
                              <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></span>
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                            Add
                          </button>
                          <button
                            onClick={cancelQuickAdd}
                            className="p-2 text-gray-400 hover:text-red-500 transition"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        {quickError && (
                          <p className="text-[11px] text-red-500 px-1">
                            {quickError}
                          </p>
                        )}
                        <p className="text-[10px] text-gray-400 px-1">
                          Time is optional. Leave blank to add without a time
                          slot.
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => setShowQuickAdd(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Activity
                        </button>
                        <button
                          onClick={() => setShowDrawer(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          Import
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ============================================
            COMPACT STAT CHIPS ROW
        ============================================ */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <StatChip
              icon={<Flame className="w-4 h-4 text-orange-500" />}
              label="Current Streak"
              value={`${stats.currentStreak || 0} day${
                stats.currentStreak === 1 ? "" : "s"
              }`}
              sub={`Best: ${stats.bestStreak || 0}`}
            />
            <StatChip
              icon={<Target className="w-4 h-4 text-emerald-500" />}
              label="Completion Rate"
              value={`${stats.completionRate || 0}%`}
              sub="This month"
              progress={stats.completionRate || 0}
              progressColor="bg-emerald-500"
            />
            <StatChip
              icon={<Calendar className="w-4 h-4 text-blue-500" />}
              label="Tracked Days"
              value={`${stats.trackedDays || 0} / ${stats.totalDays || 30}`}
              sub="This month"
              progress={
                stats.totalDays > 0
                  ? (stats.trackedDays / stats.totalDays) * 100
                  : 0
              }
              progressColor="bg-blue-500"
            />
            <StatChip
              icon={<TrendingUp className="w-4 h-4 text-violet-500" />}
              label="Activities"
              value={stats.activitiesCount || 0}
              sub="Tracked daily"
            />
          </div>
        )}

        {/* ============================================
            ACTIVITY PERFORMANCE CHART
        ============================================ */}
        {insightsChartData.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  🎯 Activity Performance
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  Completion rate per activity
                </p>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={insightsChartData}
                  layout="vertical"
                  margin={{ left: 20, right: 30, top: 5, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e5e7eb"
                    className="dark:opacity-20"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={140}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#1f2937",
                      border: "none",
                      borderRadius: 8,
                      color: "white",
                      fontSize: 12,
                    }}
                    formatter={(value) => [`${value}%`, "Completion"]}
                  />
                  <Bar dataKey="percentage" radius={[0, 6, 6, 0]}>
                    {insightsChartData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={
                          entry.percentage >= 80
                            ? "#10b981"
                            : entry.percentage >= 50
                            ? "#f59e0b"
                            : "#ef4444"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ============================================
            30-DAY TREND CHART
        ============================================ */}
        {trendChartData.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  📈 30-Day Trend
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  Daily completion percentage
                </p>
              </div>
            </div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendChartData}>
                  <defs>
                    <linearGradient
                      id="colorPct"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#8b5cf6"
                        stopOpacity={0.4}
                      />
                      <stop
                        offset="95%"
                        stopColor="#8b5cf6"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e5e7eb"
                    className="dark:opacity-20"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    interval={Math.floor(trendChartData.length / 8)}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#1f2937",
                      border: "none",
                      borderRadius: 8,
                      color: "white",
                      fontSize: 12,
                    }}
                    formatter={(value) => [`${value}%`, "Completion"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="percentage"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fill="url(#colorPct)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* DRAWER */}
      <ActivityDrawer
        isOpen={showDrawer}
        onClose={() => setShowDrawer(false)}
        activities={sortedActivities}
        onActivityAdd={handleAddActivity}
        onActivityUpdate={handleUpdateActivity}
        onActivityDelete={handleDeleteActivity}
        onDeleteAllDefaults={handleDeleteAllDefaults}
        onActivityImported={fetchActivities}
        canComplete={canComplete}
        timeRemaining={timeRemaining}
        token={token}
      />
    </div>
  );
}

// ================================
// STAT CHIP COMPONENT
// ================================
function StatChip({ icon, label, value, sub, progress, progressColor }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <div className="flex-shrink-0">{icon}</div>
        <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide truncate">
          {label}
        </p>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="text-lg font-bold text-gray-900 dark:text-white">
          {value}
        </span>
      </div>
      {progress !== undefined && (
        <div className="mt-1 w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1">
          <div
            className={`h-1 rounded-full transition-all ${
              progressColor || "bg-violet-500"
            }`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          ></div>
        </div>
      )}
      {sub && (
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
          {sub}
        </p>
      )}
    </div>
  );
}