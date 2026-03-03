"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import api from "@/lib/api";
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Loader2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import dayjs from "dayjs";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = "daily" | "weekly" | "monthly";

interface DataPoint {
  label: string;       // x-axis label
  sales: number;       // ₱ amount
  transactions: number;
  // raw date string for deduplication/merging live updates
  dateKey: string;
}

interface SalesTrendChartProps {
  isConnected: boolean;
  // The parent passes new sale events down so this component
  // can react without its own socket instance
  latestSale?: {
    id: number;
    totalAmount: number;
    soldAt: string;
    branchId: number;
  } | null;
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white border-2 border-emerald-200 rounded-xl shadow-lg p-3 min-w-[140px]">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{label}</p>
      <p className="text-lg font-bold text-emerald-600">
        ₱{Number(payload[0]?.value || 0).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </p>
      <p className="text-xs text-gray-500 mt-1">
        {payload[1]?.value ?? 0} transaction{payload[1]?.value !== 1 ? "s" : ""}
      </p>
    </div>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Get the dateKey for a given sale timestamp + mode
function getSaleDateKey(soldAt: string, mode: Mode): string {
  const d = dayjs(soldAt);
  if (mode === "daily") return d.format("HH");           // "09", "14" ...
  if (mode === "weekly") return d.format("YYYY-MM-DD");  // "2026-03-03"
  return d.format("YYYY-MM");                            // "2026-03"
}

// Build the period label shown in the header
function getPeriodLabel(mode: Mode, offset: number): string {
  if (mode === "daily") {
    const d = dayjs().add(offset, "day");
    if (offset === 0) return "Today";
    if (offset === -1) return "Yesterday";
    return d.format("MMM D, YYYY");
  }
  if (mode === "weekly") {
    const start = dayjs().add(offset, "week").startOf("week");
    const end = dayjs().add(offset, "week").endOf("week");
    if (offset === 0) return "This Week";
    if (offset === -1) return "Last Week";
    return `${start.format("MMM D")} – ${end.format("MMM D, YYYY")}`;
  }
  // monthly
  const d = dayjs().add(offset, "month");
  if (offset === 0) return "This Month";
  if (offset === -1) return "Last Month";
  return d.format("MMMM YYYY");
}

// ─── Component ────────────────────────────────────────────────────────────────

const SalesTrendChart: React.FC<SalesTrendChartProps> = ({
  isConnected,
  latestSale,
}) => {
  const [mode, setMode] = useState<Mode>("daily");
  const [offset, setOffset] = useState(0); // 0 = current, -1 = previous, etc.
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSales, setTotalSales] = useState(0);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [direction, setDirection] = useState<"left" | "right">("left");

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/dashboard/sales-trend", {
        params: { mode, offset },
      });
      setData(res.data.points);
      setTotalSales(res.data.totalSales);
      setTotalTransactions(res.data.totalTransactions);
    } catch (err) {
      console.error("Sales trend fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [mode, offset]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Real-time: inject new sale into chart data ─────────────────────────────

  useEffect(() => {
    if (!latestSale || offset !== 0) return; // only update "current" period

    const soldAtKey = getSaleDateKey(latestSale.soldAt, mode);

    setData((prev) => {
      const updated = prev.map((point) => {
        if (point.dateKey === soldAtKey) {
          return {
            ...point,
            sales: point.sales + latestSale.totalAmount,
            transactions: point.transactions + 1,
          };
        }
        return point;
      });
      return updated;
    });

    setTotalSales((prev) => prev + latestSale.totalAmount);
    setTotalTransactions((prev) => prev + 1);
  }, [latestSale]);

  // ── Navigation ─────────────────────────────────────────────────────────────

  const handlePrev = () => {
    setDirection("right");
    setOffset((o) => o - 1);
  };

  const handleNext = () => {
    setDirection("left");
    setOffset((o) => Math.min(o + 1, 0));
  };

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    setOffset(0);
  };

  const isCurrent = offset === 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Card className="overflow-hidden border-2 border-emerald-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-50 to-green-50 px-5 py-4 border-b-2 border-emerald-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Left: title + live badge */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-800 text-base">Sales Summary</h3>
                {isConnected && isCurrent && (
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">
                    Live
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{getPeriodLabel(mode, offset)}</p>
            </div>
          </div>

          {/* Right: mode tabs + nav */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Mode selector */}
            <div className="flex items-center bg-white border-2 border-emerald-200 rounded-lg p-0.5">
              {(["daily", "weekly", "monthly"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => handleModeChange(m)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all capitalize ${
                    mode === m
                      ? "bg-emerald-500 text-white shadow-sm"
                      : "text-gray-500 hover:text-emerald-600"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Prev / Next navigation */}
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrev}
                className="h-8 w-8 p-0 border-emerald-200 hover:bg-emerald-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNext}
                disabled={isCurrent}
                className="h-8 w-8 p-0 border-emerald-200 hover:bg-emerald-50 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Period totals */}
        <div className="flex items-center gap-6 mt-3">
          <div>
            <p className="text-xs text-gray-500">Total Sales</p>
            <p className="text-xl font-bold text-emerald-600">
              ₱{totalSales.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
          <div className="w-px h-8 bg-emerald-200" />
          <div>
            <p className="text-xs text-gray-500">Transactions</p>
            <p className="text-xl font-bold text-gray-700">{totalTransactions}</p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-4">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center h-52"
            >
              <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
            </motion.div>
          ) : data.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-52 text-gray-400"
            >
              <TrendingUp className="h-10 w-10 mb-2 opacity-30" />
              <p className="text-sm">No sales data for this period</p>
            </motion.div>
          ) : (
            <motion.div
              key={`${mode}-${offset}`}
              initial={{ opacity: 0, x: direction === "left" ? 30 : -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction === "left" ? -30 : 30 }}
              transition={{ duration: 0.25 }}
            >
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart
                  data={data}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#d1fae5"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "#9ca3af", fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                    width={60}
                    tickFormatter={(v) =>
                      v >= 1000 ? `₱${(v / 1000).toFixed(1)}k` : `₱${v}`
                    }
                  />
                  <Tooltip content={<CustomTooltip />} />
                  {/* Hidden transactions line — used only in tooltip */}
                  <Area
                    type="monotone"
                    dataKey="transactions"
                    stroke="transparent"
                    fill="transparent"
                    strokeWidth={0}
                  />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fill="url(#salesGradient)"
                    dot={false}
                    activeDot={{
                      r: 5,
                      fill: "#10b981",
                      stroke: "#fff",
                      strokeWidth: 2,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
};

export default SalesTrendChart;