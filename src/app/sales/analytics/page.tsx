"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import api from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";
import dayjs from "dayjs";
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  BarChart3,
  ArrowLeft,
  Loader2,
  Trophy,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Package,
  Zap,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = "daily" | "weekly" | "monthly" | "annual";

interface DataPoint {
  label: string;
  sales: number;
  transactions: number;
  dateKey: string;
}

interface TopProduct {
  id: number;
  name: string;
  sku: string;
  price: number;
  totalQuantitySold: number;
  totalRevenue: number;
  numberOfSales: number;
}

type SortField = "revenue" | "units" | "transactions";
type SortDir = "asc" | "desc";

// ─── Period helpers ───────────────────────────────────────────────────────────

function getPeriodLabel(period: Period, offset: number): string {
  if (period === "daily") {
    const d = dayjs().add(offset, "day");
    if (offset === 0) return "Today";
    if (offset === -1) return "Yesterday";
    return d.format("MMM D, YYYY");
  }
  if (period === "weekly") {
    const start = dayjs().add(offset, "week").startOf("week");
    const end = dayjs().add(offset, "week").endOf("week");
    if (offset === 0) return "This Week";
    if (offset === -1) return "Last Week";
    return `${start.format("MMM D")} – ${end.format("MMM D, YYYY")}`;
  }
  if (period === "monthly") {
    const d = dayjs().add(offset, "month");
    if (offset === 0) return "This Month";
    if (offset === -1) return "Last Month";
    return d.format("MMMM YYYY");
  }
  // annual
  const d = dayjs().add(offset, "year");
  if (offset === 0) return "This Year";
  if (offset === -1) return "Last Year";
  return d.format("YYYY");
}

function formatCurrency(n: number) {
  return `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCompact(n: number) {
  if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₱${(n / 1_000).toFixed(1)}k`;
  return `₱${n.toFixed(0)}`;
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border-2 border-emerald-200 rounded-xl shadow-lg p-3 min-w-[160px]">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{label}</p>
      <p className="text-base font-bold text-emerald-600">
        {formatCurrency(Number(payload[0]?.value ?? 0))}
      </p>
      {payload[1] && (
        <p className="text-xs text-gray-500 mt-1">
          {payload[1].value} transaction{payload[1].value !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
};

const BarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border-2 border-emerald-200 rounded-xl shadow-lg p-3 min-w-[140px]">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{label}</p>
      <p className="text-base font-bold text-blue-600">
        {payload[0]?.value ?? 0} transactions
      </p>
    </div>
  );
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  title: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  gradient: string;
  delay?: number;
}

const KpiCard = ({ title, value, sub, icon, gradient, delay = 0 }: KpiCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay }}
  >
    <Card className="border-2 border-emerald-100 bg-white hover:shadow-md transition-shadow p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-800 mt-1 truncate">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1 truncate">{sub}</p>}
        </div>
        <div className={`h-10 w-10 rounded-xl ${gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}>
          {icon}
        </div>
      </div>
    </Card>
  </motion.div>
);

// ─── Sort header helper ───────────────────────────────────────────────────────

function SortHeader({
  label,
  field,
  active,
  dir,
  onSort,
}: {
  label: string;
  field: SortField;
  active: SortField;
  dir: SortDir;
  onSort: (f: SortField) => void;
}) {
  const isActive = active === field;
  return (
    <button
      onClick={() => onSort(field)}
      className="flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-emerald-600 transition-colors"
    >
      {label}
      {isActive ? (
        dir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SalesAnalyticsPage() {
  const [period, setPeriod] = useState<Period>("monthly");
  const [offset, setOffset] = useState(0);
  const [direction, setDirection] = useState<"left" | "right">("left");

  const [trendData, setTrendData] = useState<DataPoint[]>([]);
  const [totalSales, setTotalSales] = useState(0);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [trendLoading, setTrendLoading] = useState(true);

  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [topLimit, setTopLimit] = useState("10");
  const [topLoading, setTopLoading] = useState(true);

  const [sortField, setSortField] = useState<SortField>("revenue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // ── Fetch trend data ──────────────────────────────────────────────────────

  const fetchTrend = useCallback(async () => {
    try {
      setTrendLoading(true);
      const res = await api.get("/dashboard/sales-trend", {
        params: { mode: period, offset },
      });
      setTrendData(res.data.points);
      setTotalSales(res.data.totalSales);
      setTotalTransactions(res.data.totalTransactions);
    } catch (err) {
      console.error("Trend fetch error:", err);
    } finally {
      setTrendLoading(false);
    }
  }, [period, offset]);

  useEffect(() => { fetchTrend(); }, [fetchTrend]);

  // ── Fetch top products ────────────────────────────────────────────────────

  const fetchTopProducts = useCallback(async () => {
    try {
      setTopLoading(true);
      const res = await api.get("/dashboard/analytics-top-products", {
        params: { period, offset, limit: topLimit },
      });
      setTopProducts(res.data);
    } catch (err) {
      console.error("Top products fetch error:", err);
    } finally {
      setTopLoading(false);
    }
  }, [period, offset, topLimit]);

  useEffect(() => { fetchTopProducts(); }, [fetchTopProducts]);

  // ── Period navigation ─────────────────────────────────────────────────────

  const handlePrev = () => {
    setDirection("right");
    setOffset((o) => o - 1);
  };

  const handleNext = () => {
    setDirection("left");
    setOffset((o) => Math.min(o + 1, 0));
  };

  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
    setOffset(0);
  };

  // ── Computed KPIs ─────────────────────────────────────────────────────────

  const avgTransaction = totalTransactions > 0 ? totalSales / totalTransactions : 0;

  const bestPoint = useMemo(() => {
    if (!trendData.length) return null;
    return trendData.reduce((best, pt) => (pt.sales > best.sales ? pt : best), trendData[0]);
  }, [trendData]);

  // ── Sorted breakdown table ────────────────────────────────────────────────

  const sortedBreakdown = useMemo(() => {
    const copy = [...trendData];
    copy.sort((a, b) => {
      const valA = sortField === "revenue" ? a.sales : sortField === "units" ? a.transactions : a.transactions;
      const valB = sortField === "revenue" ? b.sales : sortField === "units" ? b.transactions : b.transactions;
      return sortDir === "desc" ? valB - valA : valA - valB;
    });
    return copy;
  }, [trendData, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  // ── Sorted top products ────────────────────────────────────────────────────

  const sortedTopProducts = useMemo(() => {
    const copy = [...topProducts];
    copy.sort((a, b) => {
      const valA = sortField === "revenue" ? a.totalRevenue : sortField === "units" ? a.totalQuantitySold : a.numberOfSales;
      const valB = sortField === "revenue" ? b.totalRevenue : sortField === "units" ? b.totalQuantitySold : b.numberOfSales;
      return sortDir === "desc" ? valB - valA : valA - valB;
    });
    return copy;
  }, [topProducts, sortField, sortDir]);

  const periodLabel = getPeriodLabel(period, offset);
  const isCurrentPeriod = offset === 0;

  const PERIODS: { key: Period; label: string }[] = [
    { key: "daily",   label: "Daily"   },
    { key: "weekly",  label: "Weekly"  },
    { key: "monthly", label: "Monthly" },
    { key: "annual",  label: "Annual"  },
  ];

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-green-50 pb-24">
        <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 lg:px-6 pt-5 space-y-5">

          {/* ── Header ── */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <Link href="/sales">
                <Button variant="outline" size="sm" className="border-2 border-emerald-200 hover:bg-emerald-50 h-9 w-9 p-0">
                  <ArrowLeft className="h-4 w-4 text-emerald-600" />
                </Button>
              </Link>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                  Sales Analytics
                </h1>
                <p className="text-xs text-gray-500 mt-0.5">Performance overview & product insights</p>
              </div>
            </div>

            {/* Period tabs */}
            <div className="flex items-center gap-1 bg-white border-2 border-emerald-100 rounded-xl p-1 self-start sm:self-auto">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => handlePeriodChange(p.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    period === p.key
                      ? "bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-sm"
                      : "text-gray-600 hover:bg-emerald-50"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </motion.div>

          {/* ── Period navigator ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="border-2 border-emerald-100 bg-white px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrev}
                  className="border-2 border-emerald-200 hover:bg-emerald-50 h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4 text-emerald-600" />
                </Button>

                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                    <TrendingUp className="h-3.5 w-3.5 text-white" />
                  </div>
                  <span className="font-bold text-gray-800 text-sm sm:text-base">{periodLabel}</span>
                  {isCurrentPeriod && (
                    <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs px-2 py-0.5">Live</Badge>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNext}
                  disabled={isCurrentPeriod}
                  className="border-2 border-emerald-200 hover:bg-emerald-50 h-8 w-8 p-0 disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4 text-emerald-600" />
                </Button>
              </div>
            </Card>
          </motion.div>

          {/* ── KPI Cards ── */}
          {trendLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="border-2 border-emerald-100 h-24 animate-pulse bg-emerald-50/50" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard
                title="Total Revenue"
                value={formatCurrency(totalSales)}
                sub={`${periodLabel}`}
                icon={<DollarSign className="h-5 w-5 text-white" />}
                gradient="bg-gradient-to-br from-emerald-500 to-green-600"
                delay={0.05}
              />
              <KpiCard
                title="Transactions"
                value={totalTransactions.toLocaleString()}
                sub={`${periodLabel}`}
                icon={<ShoppingCart className="h-5 w-5 text-white" />}
                gradient="bg-gradient-to-br from-blue-500 to-blue-600"
                delay={0.1}
              />
              <KpiCard
                title="Avg. per Transaction"
                value={formatCurrency(avgTransaction)}
                sub="Average sale value"
                icon={<BarChart3 className="h-5 w-5 text-white" />}
                gradient="bg-gradient-to-br from-purple-500 to-purple-600"
                delay={0.15}
              />
              <KpiCard
                title="Best Period"
                value={bestPoint?.label ?? "—"}
                sub={bestPoint ? formatCurrency(bestPoint.sales) : "No data"}
                icon={<Zap className="h-5 w-5 text-white" />}
                gradient="bg-gradient-to-br from-amber-500 to-orange-500"
                delay={0.2}
              />
            </div>
          )}

          {/* ── Charts ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Revenue chart */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <Card className="border-2 border-emerald-100 bg-white p-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                    <TrendingUp className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-800 text-sm">Revenue Trend</h2>
                    <p className="text-xs text-gray-400">{periodLabel}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-base font-bold text-emerald-600">{formatCompact(totalSales)}</p>
                    <p className="text-xs text-gray-400">total</p>
                  </div>
                </div>

                {trendLoading ? (
                  <div className="h-56 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
                  </div>
                ) : trendData.every((p) => p.sales === 0) ? (
                  <div className="h-56 flex flex-col items-center justify-center text-gray-400">
                    <BarChart3 className="h-10 w-10 mb-2 opacity-30" />
                    <p className="text-sm">No revenue data</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={trendData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: "#9ca3af" }}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "#9ca3af" }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => formatCompact(v).replace("₱", "")}
                        width={36}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="sales"
                        name="Revenue"
                        stroke="#10b981"
                        strokeWidth={2}
                        fill="url(#salesGrad)"
                        dot={false}
                        activeDot={{ r: 5, fill: "#10b981" }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </motion.div>

            {/* Transactions bar chart */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="border-2 border-emerald-100 bg-white p-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                    <BarChart3 className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-800 text-sm">Transaction Volume</h2>
                    <p className="text-xs text-gray-400">{periodLabel}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-base font-bold text-blue-600">{totalTransactions.toLocaleString()}</p>
                    <p className="text-xs text-gray-400">total</p>
                  </div>
                </div>

                {trendLoading ? (
                  <div className="h-56 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
                  </div>
                ) : trendData.every((p) => p.transactions === 0) ? (
                  <div className="h-56 flex flex-col items-center justify-center text-gray-400">
                    <BarChart3 className="h-10 w-10 mb-2 opacity-30" />
                    <p className="text-sm">No transaction data</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={trendData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="txnGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.9} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.5} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eff6ff" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: "#9ca3af" }}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "#9ca3af" }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        width={28}
                      />
                      <Tooltip content={<BarTooltip />} />
                      <Bar
                        dataKey="transactions"
                        name="Transactions"
                        fill="url(#txnGrad)"
                        radius={[3, 3, 0, 0]}
                        maxBarSize={32}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </motion.div>
          </div>

          {/* ── Top Products ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <Card className="border-2 border-emerald-100 bg-white">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-emerald-50">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                    <Trophy className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-800 text-sm">Top Selling Products</h2>
                    <p className="text-xs text-gray-400">{periodLabel}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Show top</span>
                  <Select value={topLimit} onValueChange={setTopLimit}>
                    <SelectTrigger className="w-20 h-8 text-xs border-2 border-emerald-200 focus:ring-emerald-400">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {topLoading ? (
                <div className="h-40 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
                </div>
              ) : topProducts.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center text-gray-400">
                  <Package className="h-10 w-10 mb-2 opacity-30" />
                  <p className="text-sm">No product sales this period</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-emerald-50/60 hover:bg-emerald-50/60">
                        <TableHead className="w-10 text-center text-xs font-bold text-gray-500">#</TableHead>
                        <TableHead className="text-xs font-bold text-gray-500">Product</TableHead>
                        <TableHead className="text-xs font-bold text-gray-500 hidden sm:table-cell">SKU</TableHead>
                        <TableHead className="text-xs text-right">
                          <SortHeader label="Units Sold" field="units" active={sortField} dir={sortDir} onSort={handleSort} />
                        </TableHead>
                        <TableHead className="text-xs text-right">
                          <SortHeader label="Revenue" field="revenue" active={sortField} dir={sortDir} onSort={handleSort} />
                        </TableHead>
                        <TableHead className="text-xs text-right hidden md:table-cell">
                          <SortHeader label="# Sales" field="transactions" active={sortField} dir={sortDir} onSort={handleSort} />
                        </TableHead>
                        <TableHead className="text-xs text-right hidden lg:table-cell text-gray-500 font-bold">Unit Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence>
                        {sortedTopProducts.map((product, idx) => (
                          <motion.tr
                            key={product.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2, delay: idx * 0.03 }}
                            className="border-b border-emerald-50 hover:bg-emerald-50/40 transition-colors"
                          >
                            <TableCell className="text-center py-2.5">
                              {idx === 0 ? (
                                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-white text-xs font-bold">1</span>
                              ) : idx === 1 ? (
                                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-300 text-white text-xs font-bold">2</span>
                              ) : idx === 2 ? (
                                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-400 text-white text-xs font-bold">3</span>
                              ) : (
                                <span className="text-xs text-gray-400 font-medium">{idx + 1}</span>
                              )}
                            </TableCell>
                            <TableCell className="py-2.5">
                              <span className="font-semibold text-gray-800 text-sm">{product.name}</span>
                            </TableCell>
                            <TableCell className="py-2.5 hidden sm:table-cell">
                              <Badge variant="outline" className="text-xs border-emerald-200 text-gray-500 font-mono">
                                {product.sku}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2.5 text-right font-semibold text-gray-700 text-sm">
                              {product.totalQuantitySold.toLocaleString()}
                            </TableCell>
                            <TableCell className="py-2.5 text-right font-bold text-emerald-600 text-sm">
                              {formatCurrency(product.totalRevenue)}
                            </TableCell>
                            <TableCell className="py-2.5 text-right text-gray-600 text-sm hidden md:table-cell">
                              {product.numberOfSales.toLocaleString()}
                            </TableCell>
                            <TableCell className="py-2.5 text-right text-gray-500 text-sm hidden lg:table-cell">
                              {formatCurrency(product.price)}
                            </TableCell>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          </motion.div>

          {/* ── Period Breakdown Table ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="border-2 border-emerald-100 bg-white">
              <div className="flex items-center gap-2 p-4 border-b border-emerald-50">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                  <BarChart3 className="h-3.5 w-3.5 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-800 text-sm">Period Breakdown</h2>
                  <p className="text-xs text-gray-400">Revenue & transactions by {period === "annual" ? "month" : period === "monthly" ? "day" : period === "weekly" ? "day" : "hour"}</p>
                </div>
              </div>

              {trendLoading ? (
                <div className="h-40 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-purple-50/40 hover:bg-purple-50/40">
                        <TableHead className="text-xs font-bold text-gray-500">
                          {period === "annual" ? "Month" : period === "monthly" ? "Day" : period === "weekly" ? "Day" : "Hour"}
                        </TableHead>
                        <TableHead className="text-xs text-right">
                          <SortHeader label="Revenue" field="revenue" active={sortField} dir={sortDir} onSort={handleSort} />
                        </TableHead>
                        <TableHead className="text-xs text-right">
                          <SortHeader label="Transactions" field="transactions" active={sortField} dir={sortDir} onSort={handleSort} />
                        </TableHead>
                        <TableHead className="text-xs font-bold text-gray-500 text-right hidden sm:table-cell">Avg / Txn</TableHead>
                        <TableHead className="text-xs font-bold text-gray-500 text-right hidden md:table-cell">% of Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedBreakdown.map((point, idx) => {
                        const pct = totalSales > 0 ? (point.sales / totalSales) * 100 : 0;
                        const avg = point.transactions > 0 ? point.sales / point.transactions : 0;
                        const isEmpty = point.sales === 0 && point.transactions === 0;
                        return (
                          <TableRow
                            key={point.dateKey}
                            className={`border-b border-emerald-50 hover:bg-emerald-50/30 transition-colors ${isEmpty ? "opacity-40" : ""}`}
                          >
                            <TableCell className="py-2 font-medium text-gray-700 text-sm">{point.label}</TableCell>
                            <TableCell className="py-2 text-right">
                              <span className={`font-bold text-sm ${point.sales > 0 ? "text-emerald-600" : "text-gray-400"}`}>
                                {point.sales > 0 ? formatCurrency(point.sales) : "—"}
                              </span>
                            </TableCell>
                            <TableCell className="py-2 text-right text-sm text-gray-600">
                              {point.transactions > 0 ? point.transactions.toLocaleString() : "—"}
                            </TableCell>
                            <TableCell className="py-2 text-right text-sm text-gray-500 hidden sm:table-cell">
                              {avg > 0 ? formatCurrency(avg) : "—"}
                            </TableCell>
                            <TableCell className="py-2 text-right hidden md:table-cell">
                              {pct > 0 ? (
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-20 h-1.5 bg-emerald-100 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-gradient-to-r from-emerald-400 to-green-500 rounded-full"
                                      style={{ width: `${Math.min(pct, 100)}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-gray-500 w-10 text-right">{pct.toFixed(1)}%</span>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-300">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Summary footer */}
              {!trendLoading && totalSales > 0 && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-4 py-3 bg-emerald-50/60 border-t border-emerald-100 text-sm">
                  <span className="text-gray-500 font-medium">
                    {trendData.filter((p) => p.sales > 0).length} active period{trendData.filter((p) => p.sales > 0).length !== 1 ? "s" : ""} of {trendData.length}
                  </span>
                  <div className="flex items-center gap-4">
                    <span className="text-gray-500">Total: <span className="font-bold text-emerald-600">{formatCurrency(totalSales)}</span></span>
                    <span className="text-gray-500">Txns: <span className="font-bold text-blue-600">{totalTransactions.toLocaleString()}</span></span>
                  </div>
                </div>
              )}
            </Card>
          </motion.div>

        </div>
      </div>
    </ProtectedRoute>
  );
}
