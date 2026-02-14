"use client";

import React, { useEffect, useState, useMemo } from "react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import api from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";
import dayjs from "dayjs";
import {
  ChevronRight,
  Package,
  Tag,
  Building2,
  Calendar as CalendarIcon,
  Search,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Users,
  Loader2,
  Filter,
  X,
} from "lucide-react";
import { motion } from "framer-motion";

interface Discount {
  id: number;
  name: string;
  type: string;
  value: number;
}

interface SaleItem {
  product: {
    id?: number;
    name: string;
  };
  quantity: number;
  price: number;
  discountedPrice?: number | null;
  discountAmount?: number;
  discount?: Discount | null;
}

interface Seller {
  id: number;
  name: string;
  email: string;
}

interface Branch {
  id: number;
  name: string;
  code: string;
}

interface Sale {
  id: number;
  subtotal?: number;
  totalDiscount?: number;
  totalAmount: number;
  cashAmount?: number;
  changeAmount?: number;
  soldAt: string;
  soldBy: string | number;
  seller?: Seller | null;
  branch?: Branch | null;
  items: SaleItem[];
}

interface User {
  id: number;
  branchId: number;
  currentBranchId: number | null;
  role: string;
  branch?: Branch;
  currentBranch?: Branch;
}

const SalesReportPage = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeBranch, setActiveBranch] = useState<Branch | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("date_desc");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchSales();
    }
  }, [currentUser]);

  const fetchCurrentUser = async () => {
    try {
      setLoading(true);
      const res = await api.get("/auth/me");
      setCurrentUser(res.data);

      const branch = res.data.currentBranch || res.data.branch;
      setActiveBranch(branch);
    } catch (error) {
      console.error("Error fetching user:", error);
      toast.error("Failed to fetch user information");
    } finally {
      setLoading(false);
    }
  };

  const fetchSales = async () => {
    try {
      setLoading(true);
      const res = await api.get("/sales");

      const transformedSales = res.data.map((sale: any) => ({
        ...sale,
        subtotal: sale.subtotal ? Number(sale.subtotal) : null,
        totalDiscount: sale.totalDiscount ? Number(sale.totalDiscount) : 0,
        totalAmount: Number(sale.totalAmount),
        cashAmount: sale.cashAmount ? Number(sale.cashAmount) : null,
        changeAmount: sale.changeAmount ? Number(sale.changeAmount) : null,
        items: sale.items.map((item: any) => ({
          ...item,
          price: Number(item.price),
          quantity: Number(item.quantity),
          discountedPrice: item.discountedPrice
            ? Number(item.discountedPrice)
            : null,
          discountAmount: item.discountAmount
            ? Number(item.discountAmount)
            : 0,
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

  const filteredSales = useMemo(() => {
    let filtered = sales;

    if (search) {
      filtered = filtered.filter(
        (sale) =>
          sale.id.toString().includes(search) ||
          sale.items.some((item) =>
            item.product?.name?.toLowerCase().includes(search.toLowerCase()),
          ) ||
          sale.seller?.name?.toLowerCase().includes(search.toLowerCase()) ||
          sale.branch?.name?.toLowerCase().includes(search.toLowerCase()) ||
          sale.branch?.code?.toLowerCase().includes(search.toLowerCase()),
      );
    }

    if (dateFrom) {
      filtered = filtered.filter(
        (sale) => new Date(sale.soldAt).getTime() >= dateFrom.getTime(),
      );
    }

    if (dateTo) {
      const endOfDay = new Date(dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      filtered = filtered.filter(
        (sale) => new Date(sale.soldAt).getTime() <= endOfDay.getTime(),
      );
    }

    if (sortBy === "date_asc") {
      filtered = [...filtered].sort(
        (a, b) => new Date(a.soldAt).getTime() - new Date(b.soldAt).getTime(),
      );
    } else if (sortBy === "date_desc") {
      filtered = [...filtered].sort(
        (a, b) => new Date(b.soldAt).getTime() - new Date(a.soldAt).getTime(),
      );
    } else if (sortBy === "amount_asc") {
      filtered = [...filtered].sort((a, b) => a.totalAmount - b.totalAmount);
    } else if (sortBy === "amount_desc") {
      filtered = [...filtered].sort((a, b) => b.totalAmount - a.totalAmount);
    }

    return filtered;
  }, [sales, search, sortBy, dateFrom, dateTo]);

  const handleRowClick = (sale: Sale) => {
    setSelectedSale(sale);
    setDialogOpen(true);
  };

  const getProductSummary = (items: SaleItem[]) => {
    if (items.length === 0) return "No items";
    if (items.length === 1) {
      return items[0].product?.name || "Unknown product";
    }
    return `${items[0].product?.name || "Unknown"} +${items.length - 1} more`;
  };

  const getTotalItems = (items: SaleItem[]) => {
    return items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  };

  const getItemSubtotal = (item: SaleItem) => {
    const price = item.discountedPrice ?? item.price ?? 0;
    return price * (item.quantity || 0);
  };

  const hasDiscounts = (sale: Sale) => {
    return sale.items.some((item) => item.discount || item.discountedPrice);
  };

  const summaryStats = useMemo(() => {
    const totalRevenue = filteredSales.reduce(
      (sum, sale) => sum + (sale.totalAmount || 0),
      0,
    );
    const totalDiscount = filteredSales.reduce(
      (sum, sale) => sum + (sale.totalDiscount || 0),
      0,
    );
    const totalTransactions = filteredSales.length;
    const totalItems = filteredSales.reduce(
      (sum, sale) => sum + getTotalItems(sale.items),
      0,
    );
    const avgTransaction =
      totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    return {
      totalRevenue,
      totalDiscount,
      totalTransactions,
      totalItems,
      avgTransaction,
    };
  }, [filteredSales]);

  const isViewingAllBranches =
    currentUser?.role === "admin" && !currentUser?.currentBranchId;

  const hasActiveFilters = search || dateFrom || dateTo || sortBy !== "date_desc";

  const clearFilters = () => {
    setSearch("");
    setSortBy("date_desc");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center h-screen bg-gradient-to-br from-emerald-50 to-green-50">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-emerald-600 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Loading sales data...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50 pb-24">
        <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                  Sales Report
                </h1>
                {activeBranch && (
                  <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                    <Building2 className="h-4 w-4 text-emerald-600" />
                    <span>
                      {isViewingAllBranches
                        ? "All Branches"
                        : `${activeBranch.name} (${activeBranch.code})`}
                    </span>
                  </div>
                )}
              </div>

              <Button
                variant="outline"
                onClick={() => fetchSales()}
                className="border-emerald-300 hover:bg-emerald-50 self-start sm:self-auto"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Refresh Data
              </Button>
            </div>

            {/* Branch Alert */}
            {!isViewingAllBranches && activeBranch && (
              <Card className="p-4 bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-200">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0">
                    <Building2 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">
                      Branch Filter Active
                    </p>
                    <p className="text-sm text-gray-600">
                      Showing sales for{" "}
                      <strong className="text-emerald-700">
                        {activeBranch.name}
                      </strong>{" "}
                      branch only
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </motion.div>

          {/* Summary Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
          >
            <Card className="p-5 bg-white border-2 border-emerald-100 hover:border-emerald-300 hover:shadow-lg transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
              </div>
              <p className="text-sm font-medium text-gray-600 mb-1">
                Total Revenue
              </p>
              <p className="text-2xl font-bold text-gray-800">
                ₱{summaryStats.totalRevenue.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </Card>

            <Card className="p-5 bg-white border-2 border-emerald-100 hover:border-emerald-300 hover:shadow-lg transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                  <Tag className="h-6 w-6 text-white" />
                </div>
              </div>
              <p className="text-sm font-medium text-gray-600 mb-1">
                Total Discounts
              </p>
              <p className="text-2xl font-bold text-emerald-600">
                ₱{summaryStats.totalDiscount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </Card>

            <Card className="p-5 bg-white border-2 border-emerald-100 hover:border-emerald-300 hover:shadow-lg transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                  <ShoppingCart className="h-6 w-6 text-white" />
                </div>
              </div>
              <p className="text-sm font-medium text-gray-600 mb-1">
                Transactions
              </p>
              <p className="text-2xl font-bold text-gray-800">
                {summaryStats.totalTransactions}
              </p>
            </Card>

            <Card className="p-5 bg-white border-2 border-emerald-100 hover:border-emerald-300 hover:shadow-lg transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                  <Package className="h-6 w-6 text-white" />
                </div>
              </div>
              <p className="text-sm font-medium text-gray-600 mb-1">
                Items Sold
              </p>
              <p className="text-2xl font-bold text-gray-800">
                {summaryStats.totalItems}
              </p>
            </Card>

            <Card className="p-5 bg-white border-2 border-emerald-100 hover:border-emerald-300 hover:shadow-lg transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
              </div>
              <p className="text-sm font-medium text-gray-600 mb-1">
                Avg Transaction
              </p>
              <p className="text-2xl font-bold text-gray-800">
                ₱{summaryStats.avgTransaction.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </Card>
          </motion.div>

          {/* Filters Section */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-4 border-2 border-emerald-100">
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by ID, product, seller, or branch..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                  />
                </div>

                {/* Mobile Filter Toggle */}
                <Button
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                  className="md:hidden border-emerald-300 hover:bg-emerald-50"
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                  {hasActiveFilters && (
                    <Badge className="ml-2 bg-emerald-600">Active</Badge>
                  )}
                </Button>

                {/* Desktop Filters */}
                <div className="hidden md:flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="border-emerald-300 hover:bg-emerald-50"
                      >
                        <CalendarIcon className="w-4 h-4 mr-2" />
                        {dateFrom
                          ? dayjs(dateFrom).format("MMM D, YYYY")
                          : "From date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={dateFrom}
                        onSelect={setDateFrom}
                      />
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="border-emerald-300 hover:bg-emerald-50"
                      >
                        <CalendarIcon className="w-4 h-4 mr-2" />
                        {dateTo
                          ? dayjs(dateTo).format("MMM D, YYYY")
                          : "To date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={dateTo}
                        onSelect={setDateTo}
                      />
                    </PopoverContent>
                  </Popover>

                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[180px] border-emerald-300 hover:bg-emerald-50">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date_desc">
                        Date (Newest first)
                      </SelectItem>
                      <SelectItem value="date_asc">
                        Date (Oldest first)
                      </SelectItem>
                      <SelectItem value="amount_desc">
                        Amount (High → Low)
                      </SelectItem>
                      <SelectItem value="amount_asc">
                        Amount (Low → High)
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      onClick={clearFilters}
                      className="text-red-600 hover:bg-red-50"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Clear
                    </Button>
                  )}
                </div>
              </div>

              {/* Mobile Filters Dropdown */}
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="md:hidden mt-4 pt-4 border-t border-emerald-100 space-y-3"
                >
                  <div className="grid grid-cols-2 gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="border-emerald-300 hover:bg-emerald-50 justify-start"
                        >
                          <CalendarIcon className="w-4 h-4 mr-2" />
                          {dateFrom
                            ? dayjs(dateFrom).format("MMM D")
                            : "From date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={dateFrom}
                          onSelect={setDateFrom}
                        />
                      </PopoverContent>
                    </Popover>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="border-emerald-300 hover:bg-emerald-50 justify-start"
                        >
                          <CalendarIcon className="w-4 h-4 mr-2" />
                          {dateTo ? dayjs(dateTo).format("MMM D") : "To date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={dateTo}
                          onSelect={setDateTo}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-full border-emerald-300 hover:bg-emerald-50">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date_desc">
                        Date (Newest first)
                      </SelectItem>
                      <SelectItem value="date_asc">
                        Date (Oldest first)
                      </SelectItem>
                      <SelectItem value="amount_desc">
                        Amount (High → Low)
                      </SelectItem>
                      <SelectItem value="amount_asc">
                        Amount (Low → High)
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {hasActiveFilters && (
                    <Button
                      variant="outline"
                      onClick={clearFilters}
                      className="w-full text-red-600 hover:bg-red-50 border-red-200"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Clear All Filters
                    </Button>
                  )}
                </motion.div>
              )}
            </Card>
          </motion.div>

          {/* Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {filteredSales.length === 0 ? (
              <Card className="p-12 text-center border-2 border-dashed border-emerald-200">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-50 mb-4">
                  <Package className="h-10 w-10 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  No sales records found
                </h3>
                <p className="text-gray-600 mb-4">
                  Try adjusting your filters or date range
                </p>
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    onClick={clearFilters}
                    className="border-emerald-300 hover:bg-emerald-50"
                  >
                    Clear Filters
                  </Button>
                )}
              </Card>
            ) : (
              <Card className="overflow-hidden border-2 border-emerald-100">
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-emerald-50 to-green-50 hover:from-emerald-50 hover:to-green-50">
                        <TableHead className="font-bold text-gray-800">
                          ID
                        </TableHead>
                        <TableHead className="font-bold text-gray-800">
                          Date & Time
                        </TableHead>
                        {isViewingAllBranches && (
                          <TableHead className="font-bold text-gray-800">
                            Branch
                          </TableHead>
                        )}
                        <TableHead className="font-bold text-gray-800">
                          Products
                        </TableHead>
                        <TableHead className="font-bold text-gray-800">
                          Items
                        </TableHead>
                        <TableHead className="font-bold text-gray-800">
                          Amount
                        </TableHead>
                        <TableHead className="font-bold text-gray-800">
                          Sold By
                        </TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSales.map((sale) => (
                        <TableRow
                          key={sale.id}
                          className="cursor-pointer hover:bg-emerald-50 transition-colors"
                          onClick={() => handleRowClick(sale)}
                        >
                          <TableCell className="font-semibold text-emerald-700">
                            #{sale.id}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-gray-600">
                            {dayjs(sale.soldAt).format("MMM D, YYYY h:mm A")}
                          </TableCell>
                          {isViewingAllBranches && (
                            <TableCell>
                              {sale.branch ? (
                                <Badge
                                  variant="outline"
                                  className="bg-emerald-50 text-emerald-700 border-emerald-200"
                                >
                                  {sale.branch.code}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  -
                                </span>
                              )}
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="truncate max-w-[200px] text-gray-800">
                                {getProductSummary(sale.items)}
                              </span>
                              {sale.items.length > 1 && (
                                <Badge
                                  variant="secondary"
                                  className="bg-gray-100"
                                >
                                  {sale.items.length} items
                                </Badge>
                              )}
                              {hasDiscounts(sale) && (
                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                                  <Tag className="h-3 w-3 mr-1" />
                                  Discount
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium text-gray-800">
                            {getTotalItems(sale.items)}
                          </TableCell>
                          <TableCell className="font-bold text-emerald-600">
                            ₱
                            {(sale.totalAmount || 0).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell className="text-gray-600">
                            {sale.seller?.name || sale.soldBy}
                          </TableCell>
                          <TableCell>
                            <ChevronRight className="h-5 w-5 text-emerald-600" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-emerald-100">
                  {filteredSales.map((sale) => (
                    <motion.div
                      key={sale.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleRowClick(sale)}
                      className="p-4 hover:bg-emerald-50 active:bg-emerald-100 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-bold text-emerald-700 text-lg">
                            #{sale.id}
                          </p>
                          <p className="text-xs text-gray-500">
                            {dayjs(sale.soldAt).format("MMM D, YYYY h:mm A")}
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">
                            Products
                          </span>
                          <span className="text-sm font-medium text-gray-800">
                            {getProductSummary(sale.items)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Items</span>
                          <span className="text-sm font-medium text-gray-800">
                            {getTotalItems(sale.items)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-emerald-100">
                          <span className="text-sm font-semibold text-gray-800">
                            Total
                          </span>
                          <span className="text-lg font-bold text-emerald-600">
                            ₱
                            {(sale.totalAmount || 0).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                          {hasDiscounts(sale) && (
                            <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                              <Tag className="h-3 w-3 mr-1" />
                              Discount
                            </Badge>
                          )}
                          <span className="text-xs text-gray-500">
                            by {sale.seller?.name || sale.soldBy}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </Card>
            )}
          </motion.div>
        </div>

        {/* Transaction Details Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-gray-800">
                Transaction Details
              </DialogTitle>
              <DialogDescription className="text-base">
                <span className="font-semibold text-emerald-700">
                  #{selectedSale?.id}
                </span>{" "}
                •{" "}
                {selectedSale &&
                  dayjs(selectedSale.soldAt).format("MMM D, YYYY h:mm A")}
              </DialogDescription>
            </DialogHeader>

            {selectedSale && (
              <div className="space-y-6">
                {/* Transaction Info */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl border-2 border-emerald-200">
                  {selectedSale.branch && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                        Branch
                      </p>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-emerald-600" />
                        <p className="font-semibold text-gray-800">
                          {selectedSale.branch.name}
                        </p>
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                      Sold By
                    </p>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-emerald-600" />
                      <p className="font-semibold text-gray-800">
                        {selectedSale.seller?.name || selectedSale.soldBy}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                      Total Items
                    </p>
                    <p className="font-semibold text-gray-800">
                      {getTotalItems(selectedSale.items)}
                    </p>
                  </div>
                </div>

                {/* Items Table */}
                <div>
                  <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <Package className="h-5 w-5 text-emerald-600" />
                    Items Purchased
                  </h3>
                  <div className="border-2 border-emerald-100 rounded-xl overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gradient-to-r from-emerald-50 to-green-50 hover:from-emerald-50 hover:to-green-50">
                          <TableHead className="font-bold">Product</TableHead>
                          <TableHead className="text-right font-bold">
                            Qty
                          </TableHead>
                          <TableHead className="text-right font-bold">
                            Unit Price
                          </TableHead>
                          <TableHead className="text-right font-bold">
                            Subtotal
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedSale.items.map((item, idx) => (
                          <React.Fragment key={idx}>
                            <TableRow>
                              <TableCell className="font-medium text-gray-800">
                                {item.product?.name || "Unknown product"}
                              </TableCell>
                              <TableCell className="text-right text-gray-800">
                                {item.quantity || 0}
                              </TableCell>
                              <TableCell className="text-right">
                                {item.discountedPrice ? (
                                  <div className="space-y-1">
                                    <span className="block line-through text-gray-400 text-sm">
                                      ₱{(item.price || 0).toFixed(2)}
                                    </span>
                                    <span className="block text-emerald-600 font-bold">
                                      ₱{item.discountedPrice.toFixed(2)}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-gray-800">
                                    ₱{(item.price || 0).toFixed(2)}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-bold text-gray-800">
                                ₱
                                {getItemSubtotal(item).toLocaleString(
                                  undefined,
                                  {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  },
                                )}
                              </TableCell>
                            </TableRow>
                            {item.discount && (
                              <TableRow className="bg-emerald-50/50">
                                <TableCell
                                  colSpan={4}
                                  className="text-sm text-emerald-700 py-2"
                                >
                                  <div className="flex items-center gap-2">
                                    <Tag className="h-4 w-4" />
                                    <span className="font-semibold">
                                      {item.discount.name}
                                    </span>
                                    {item.discountAmount &&
                                      item.discountAmount > 0 && (
                                        <span className="text-xs">
                                          (Saved: ₱
                                          {item.discountAmount.toFixed(2)})
                                        </span>
                                      )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Total Summary */}
                <div className="space-y-3">
                  {selectedSale.subtotal && selectedSale.subtotal > 0 && (
                    <div className="flex justify-between items-center text-gray-600">
                      <span>Subtotal</span>
                      <span className="font-semibold">
                        ₱{selectedSale.subtotal.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {selectedSale.totalDiscount &&
                    selectedSale.totalDiscount > 0 && (
                      <div className="flex justify-between items-center text-emerald-600 font-semibold">
                        <span>Total Discount</span>
                        <span>-₱{selectedSale.totalDiscount.toFixed(2)}</span>
                      </div>
                    )}
                  <div className="flex justify-between items-center p-4 bg-gradient-to-r from-emerald-600 to-green-600 rounded-xl text-white">
                    <p className="font-bold text-lg">Total Amount</p>
                    <p className="font-bold text-2xl">
                      ₱
                      {(selectedSale.totalAmount || 0).toLocaleString(
                        undefined,
                        {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        },
                      )}
                    </p>
                  </div>
                  {selectedSale.cashAmount && (
                    <>
                      <div className="flex justify-between items-center text-gray-600">
                        <span>Cash Received</span>
                        <span className="font-semibold">
                          ₱{selectedSale.cashAmount.toFixed(2)}
                        </span>
                      </div>
                      {selectedSale.changeAmount !== null &&
                        selectedSale.changeAmount !== undefined && (
                          <div className="flex justify-between items-center text-gray-600">
                            <span>Change</span>
                            <span className="font-semibold">
                              ₱{selectedSale.changeAmount.toFixed(2)}
                            </span>
                          </div>
                        )}
                    </>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
};

export default SalesReportPage;