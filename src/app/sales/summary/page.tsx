"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import api from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";
import dayjs from "dayjs";
import { TrendingUp, DollarSign, Package, ShoppingCart } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface SaleItem {
  product: {
    id?: number;
    name: string;
  };
  quantity: number;
  price: number;
}

interface Sale {
  id: number;
  totalAmount: number;
  soldAt: string;
  soldBy: string | number;
  items: SaleItem[];
}

type TimeFilter = "daily" | "weekly" | "monthly" | "annually";

const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7c7c",
  "#a4de6c",
  "#d084d0",
];

const SalesSummaryPage = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("daily");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSales = async () => {
      try {
        setLoading(true);
        const res = await api.get("/sales");
        const transformedSales = res.data.map((sale: any) => ({
          ...sale,
          totalAmount: Number(sale.totalAmount),
          items: sale.items.map((item: any) => ({
            ...item,
            price: Number(item.price),
            quantity: Number(item.quantity),
          })),
        }));
        setSales(transformedSales);
      } catch (error) {
        console.error("Fetch sales error:", error);
        toast.error("Failed to fetch sales");
      } finally {
        setLoading(false);
      }
    };

    fetchSales();
  }, []);

  // Filter sales based on time period
  const filteredSales = useMemo(() => {
    const now = dayjs();
    let startDate: dayjs.Dayjs;

    switch (timeFilter) {
      case "daily":
        startDate = now.startOf("day");
        break;
      case "weekly":
        startDate = now.startOf("week");
        break;
      case "monthly":
        startDate = now.startOf("month");
        break;
      case "annually":
        startDate = now.startOf("year");
        break;
      default:
        startDate = now.startOf("day");
    }

    return sales.filter((sale) => dayjs(sale.soldAt).isAfter(startDate));
  }, [sales, timeFilter]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const totalRevenue = filteredSales.reduce(
      (sum, sale) => sum + (sale.totalAmount || 0),
      0
    );
    const totalTransactions = filteredSales.length;
    const totalItems = filteredSales.reduce(
      (sum, sale) =>
        sum + sale.items.reduce((s, item) => s + (item.quantity || 0), 0),
      0
    );
    const avgTransaction =
      totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    return { totalRevenue, totalTransactions, totalItems, avgTransaction };
  }, [filteredSales]);

  // Product sales data for pie chart
  const productSalesData = useMemo(() => {
    const productMap: Record<string, { revenue: number; quantity: number }> = {};

    filteredSales.forEach((sale) => {
      sale.items.forEach((item) => {
        const productName = item.product?.name || "Unknown Product";
        if (!productMap[productName]) {
          productMap[productName] = { revenue: 0, quantity: 0 };
        }
        productMap[productName].revenue += (item.price || 0) * (item.quantity || 0);
        productMap[productName].quantity += item.quantity || 0;
      });
    });

    return Object.entries(productMap)
      .map(([name, data]) => ({
        name,
        value: data.revenue,
        quantity: data.quantity,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Top 10 products
  }, [filteredSales]);

  // Sales by seller data for pie chart
  const sellerSalesData = useMemo(() => {
    const sellerMap: Record<string, number> = {};

    filteredSales.forEach((sale) => {
      const seller = sale.soldBy?.toString() || "Unknown";
      sellerMap[seller] = (sellerMap[seller] || 0) + (sale.totalAmount || 0);
    });

    return Object.entries(sellerMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredSales]);

  // Sales by quantity data for pie chart
  const quantitySalesData = useMemo(() => {
    const productMap: Record<string, number> = {};

    filteredSales.forEach((sale) => {
      sale.items.forEach((item) => {
        const productName = item.product?.name || "Unknown Product";
        productMap[productName] = (productMap[productName] || 0) + (item.quantity || 0);
      });
    });

    return Object.entries(productMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Top 10 by quantity
  }, [filteredSales]);

  const getTimeFilterLabel = () => {
    const now = dayjs();
    switch (timeFilter) {
      case "daily":
        return now.format("MMMM D, YYYY");
      case "weekly":
        return `Week of ${now.startOf("week").format("MMM D")} - ${now.endOf("week").format("MMM D, YYYY")}`;
      case "monthly":
        return now.format("MMMM YYYY");
      case "annually":
        return now.format("YYYY");
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-semibold">{payload[0].name}</p>
          <p className="text-sm text-muted-foreground">
            Revenue: {payload[0].value.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          {payload[0].payload.quantity !== undefined && (
            <p className="text-sm text-muted-foreground">
              Quantity: {payload[0].payload.quantity}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <ProtectedRoute>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Sales Summary</h1>
            <p className="text-muted-foreground mt-1">{getTimeFilterLabel()}</p>
          </div>

          <div className="flex items-center gap-2">
            <Select value={timeFilter} onValueChange={(value) => setTimeFilter(value as TimeFilter)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Time period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="annually">Annually</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Revenue
                </p>
                <p className="text-2xl font-bold mt-2">
                  {summaryStats.totalRevenue.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Transactions
                </p>
                <p className="text-2xl font-bold mt-2">
                  {summaryStats.totalTransactions}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                <ShoppingCart className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Items Sold
                </p>
                <p className="text-2xl font-bold mt-2">
                  {summaryStats.totalItems}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                <Package className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Avg Transaction
                </p>
                <p className="text-2xl font-bold mt-2">
                  {summaryStats.avgTransaction.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </Card>
        </div>

        {/* Charts */}
        {loading ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Loading sales data...</p>
          </Card>
        ) : filteredSales.length === 0 ? (
          <Card className="p-8 text-center">
            <Package className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
            <p className="text-muted-foreground">
              No sales data found for this period.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue by Product */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">
                Revenue by Product (Top 10)
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={productSalesData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name}: ${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {productSalesData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            {/* Sales by Seller */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Sales by Seller</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={sellerSalesData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name}: ${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {sellerSalesData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            {/* Quantity by Product */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">
                Quantity Sold by Product (Top 10)
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={quantitySalesData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name}: ${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {quantitySalesData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            {/* Product Performance Table */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Top Products</h3>
              <div className="space-y-3">
                {productSalesData.slice(0, 5).map((product, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-muted rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {product.quantity} units sold
                        </p>
                      </div>
                    </div>
                    <p className="font-semibold">
                      {product.value.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
};

export default SalesSummaryPage;