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
import { Textarea } from "@/components/ui/textarea";
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
  RotateCcw,
  Minus,
  Plus,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Discount {
  id: number;
  name: string;
  type: string;
  value: number;
}

interface SaleItem {
  id?: number;
  product: { id?: number; name: string };
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

interface RefundItem {
  id: number;
  product: { id: number; name: string };
  quantity: number;
  refundAmount: number;
}

interface Refund {
  id: number;
  totalRefund: number;
  reason: string | null;
  createdAt: string;
  refundedBy: { id: number; name: string } | null;
  items: RefundItem[];
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
  status?: "completed" | "partially_refunded" | "fully_refunded";
}

interface User {
  id: number;
  branchId: number;
  currentBranchId: number | null;
  role: string;
  branch?: Branch;
  currentBranch?: Branch;
}

// Qty to refund per saleItemId
type RefundCart = Record<number, number>;

// ─── Dialog views ─────────────────────────────────────────────────────────────
type DialogView = "details" | "refund" | "refund_history";

// ─── Component ────────────────────────────────────────────────────────────────

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
  const [dialogView, setDialogView] = useState<DialogView>("details");
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Refund state
  const [refundCart, setRefundCart] = useState<RefundCart>({});
  const [refundReason, setRefundReason] = useState("");
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundHistory, setRefundHistory] = useState<Refund[]>([]);
  const [refundHistoryLoading, setRefundHistoryLoading] = useState(false);
  // Tracks already-refunded quantities per saleItemId for current dialog
  const [alreadyRefunded, setAlreadyRefunded] = useState<Record<number, number>>({});

  // ── Fetchers ────────────────────────────────────────────────────────────────

  useEffect(() => { fetchCurrentUser(); }, []);
  useEffect(() => { if (currentUser) fetchSales(); }, [currentUser]);

  const fetchCurrentUser = async () => {
    try {
      setLoading(true);
      const res = await api.get("/auth/me");
      setCurrentUser(res.data);
      setActiveBranch(res.data.currentBranch || res.data.branch);
    } catch {
      toast.error("Failed to fetch user information");
    } finally {
      setLoading(false);
    }
  };

  const fetchSales = async () => {
    try {
      setLoading(true);
      const res = await api.get("/sales");
      const transformed = res.data.map((sale: any) => ({
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
          discountedPrice: item.discountedPrice ? Number(item.discountedPrice) : null,
          discountAmount: item.discountAmount ? Number(item.discountAmount) : 0,
        })),
      }));
      setSales(transformed);
    } catch {
      toast.error("Failed to fetch sales");
    } finally {
      setLoading(false);
    }
  };

  // Fetch refund history for a sale and compute already-refunded quantities
  const fetchRefundHistory = async (saleId: number) => {
    try {
      setRefundHistoryLoading(true);
      const res = await api.get(`/sales/${saleId}/refunds`);
      const refunds: Refund[] = res.data;
      setRefundHistory(refunds);

      // Build alreadyRefunded map: saleItemId → total refunded qty
      const map: Record<number, number> = {};
      for (const refund of refunds) {
        for (const item of refund.items) {
          map[item.id] = (map[item.id] || 0) + item.quantity;
        }
      }
      setAlreadyRefunded(map);
    } catch {
      toast.error("Failed to fetch refund history");
    } finally {
      setRefundHistoryLoading(false);
    }
  };

  // ── Dialog handlers ──────────────────────────────────────────────────────────

  const handleRowClick = (sale: Sale) => {
    setSelectedSale(sale);
    setDialogView("details");
    setRefundCart({});
    setRefundReason("");
    setRefundHistory([]);
    setAlreadyRefunded({});
    setDialogOpen(true);
    fetchRefundHistory(sale.id);
  };

  const handleOpenRefund = () => {
    setRefundCart({});
    setRefundReason("");
    setDialogView("refund");
  };

  const handleOpenHistory = () => setDialogView("refund_history");

  const handleBackToDetails = () => setDialogView("details");

  // ── Refund cart helpers ──────────────────────────────────────────────────────

  const getRefundableQty = (item: SaleItem): number => {
    if (!item.id) return 0;
    return item.quantity - (alreadyRefunded[item.id] || 0);
  };

  const adjustRefundQty = (itemId: number, delta: number, max: number) => {
    setRefundCart((prev) => {
      const current = prev[itemId] || 0;
      const next = Math.min(Math.max(current + delta, 0), max);
      if (next === 0) {
        const updated = { ...prev };
        delete updated[itemId];
        return updated;
      }
      return { ...prev, [itemId]: next };
    });
  };

  const refundTotal = useMemo(() => {
    if (!selectedSale) return 0;
    return selectedSale.items.reduce((sum, item) => {
      if (!item.id) return sum;
      const qty = refundCart[item.id] || 0;
      const unitPrice = item.discountedPrice ?? item.price;
      return sum + unitPrice * qty;
    }, 0);
  }, [refundCart, selectedSale]);

  const refundItemCount = Object.values(refundCart).reduce((a, b) => a + b, 0);

  // ── Submit refund ─────────────────────────────────────────────────────────────

  const handleSubmitRefund = async () => {
    if (!selectedSale) return;
    if (refundItemCount === 0) {
      toast.error("Please select at least one item to refund");
      return;
    }

    const items = Object.entries(refundCart)
      .filter(([, qty]) => qty > 0)
      .map(([saleItemId, quantity]) => ({
        saleItemId: Number(saleItemId),
        quantity,
      }));

    try {
      setRefundLoading(true);
      await api.post(`/sales/${selectedSale.id}/refunds`, {
        items,
        reason: refundReason.trim() || undefined,
      });

      toast.success(`Refund of ₱${refundTotal.toFixed(2)} processed successfully`);

      // Refresh everything
      await fetchSales();
      await fetchRefundHistory(selectedSale.id);

      // Update the selectedSale reference with fresh data
      setSales((prev) => {
        const updated = prev.find((s) => s.id === selectedSale.id);
        if (updated) setSelectedSale(updated);
        return prev;
      });

      setDialogView("details");
      setRefundCart({});
      setRefundReason("");
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Failed to process refund";
      toast.error(msg);
    } finally {
      setRefundLoading(false);
    }
  };

  // ── Filters / stats ──────────────────────────────────────────────────────────

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

    const sortMap: Record<string, (a: Sale, b: Sale) => number> = {
      date_asc: (a, b) => new Date(a.soldAt).getTime() - new Date(b.soldAt).getTime(),
      date_desc: (a, b) => new Date(b.soldAt).getTime() - new Date(a.soldAt).getTime(),
      amount_asc: (a, b) => a.totalAmount - b.totalAmount,
      amount_desc: (a, b) => b.totalAmount - a.totalAmount,
    };

    if (sortMap[sortBy]) filtered = [...filtered].sort(sortMap[sortBy]);
    return filtered;
  }, [sales, search, sortBy, dateFrom, dateTo]);

  const summaryStats = useMemo(() => {
    const totalRevenue = filteredSales.reduce((s, sale) => s + (sale.totalAmount || 0), 0);
    const totalDiscount = filteredSales.reduce((s, sale) => s + (sale.totalDiscount || 0), 0);
    const totalTransactions = filteredSales.length;
    const totalItems = filteredSales.reduce((s, sale) => s + sale.items.reduce((a, i) => a + (i.quantity || 0), 0), 0);
    const avgTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
    return { totalRevenue, totalDiscount, totalTransactions, totalItems, avgTransaction };
  }, [filteredSales]);

  const getProductSummary = (items: SaleItem[]) => {
    if (items.length === 0) return "No items";
    if (items.length === 1) return items[0].product?.name || "Unknown product";
    return `${items[0].product?.name || "Unknown"} +${items.length - 1} more`;
  };
  const getTotalItems = (items: SaleItem[]) => items.reduce((s, i) => s + (i.quantity || 0), 0);
  const getItemSubtotal = (item: SaleItem) => (item.discountedPrice ?? item.price ?? 0) * (item.quantity || 0);
  const hasDiscounts = (sale: Sale) => sale.items.some((i) => i.discount || i.discountedPrice);

  const isViewingAllBranches = currentUser?.role === "admin" && !currentUser?.currentBranchId;
  const hasActiveFilters = search || dateFrom || dateTo || sortBy !== "date_desc";
  const clearFilters = () => { setSearch(""); setSortBy("date_desc"); setDateFrom(undefined); setDateTo(undefined); };

  const getStatusBadge = (status?: string) => {
    if (!status || status === "completed") return null;
    if (status === "fully_refunded")
      return <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">Fully Refunded</Badge>;
    return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">Partial Refund</Badge>;
  };

  // ── Render ────────────────────────────────────────────────────────────────────

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
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                  Sales Report
                </h1>
                {activeBranch && (
                  <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                    <Building2 className="h-4 w-4 text-emerald-600" />
                    <span>{isViewingAllBranches ? "All Branches" : `${activeBranch.name} (${activeBranch.code})`}</span>
                  </div>
                )}
              </div>
              <Button variant="outline" onClick={fetchSales} className="border-emerald-300 hover:bg-emerald-50 self-start sm:self-auto">
                <TrendingUp className="w-4 h-4 mr-2" />
                Refresh Data
              </Button>
            </div>

            {!isViewingAllBranches && activeBranch && (
              <Card className="p-4 bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-200">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0">
                    <Building2 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Branch Filter Active</p>
                    <p className="text-sm text-gray-600">
                      Showing sales for <strong className="text-emerald-700">{activeBranch.name}</strong> branch only
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </motion.div>

          {/* Summary Cards */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: "Total Revenue", value: `₱${summaryStats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: <DollarSign className="h-6 w-6 text-white" />, color: "from-emerald-500 to-green-600" },
              { label: "Total Discounts", value: `₱${summaryStats.totalDiscount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: <Tag className="h-6 w-6 text-white" />, color: "from-green-500 to-emerald-600", valueClass: "text-emerald-600" },
              { label: "Transactions", value: summaryStats.totalTransactions, icon: <ShoppingCart className="h-6 w-6 text-white" />, color: "from-emerald-500 to-green-600" },
              { label: "Items Sold", value: summaryStats.totalItems, icon: <Package className="h-6 w-6 text-white" />, color: "from-green-500 to-emerald-600" },
              { label: "Avg Transaction", value: `₱${summaryStats.avgTransaction.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: <TrendingUp className="h-6 w-6 text-white" />, color: "from-emerald-500 to-green-600" },
            ].map((stat) => (
              <Card key={stat.label} className="p-5 bg-white border-2 border-emerald-100 hover:border-emerald-300 hover:shadow-lg transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}>{stat.icon}</div>
                </div>
                <p className="text-sm font-medium text-gray-600 mb-1">{stat.label}</p>
                <p className={`text-2xl font-bold ${(stat as any).valueClass || "text-gray-800"}`}>{stat.value}</p>
              </Card>
            ))}
          </motion.div>

          {/* Filters */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
            <Card className="p-4 border-2 border-emerald-100">
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input placeholder="Search by ID, product, seller, or branch..." value={search} onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200" />
                </div>
                <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="md:hidden border-emerald-300 hover:bg-emerald-50">
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                  {hasActiveFilters && <Badge className="ml-2 bg-emerald-600">Active</Badge>}
                </Button>
                <div className="hidden md:flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="border-emerald-300 hover:bg-emerald-50">
                        <CalendarIcon className="w-4 h-4 mr-2" />
                        {dateFrom ? dayjs(dateFrom).format("MMM D, YYYY") : "From date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} /></PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="border-emerald-300 hover:bg-emerald-50">
                        <CalendarIcon className="w-4 h-4 mr-2" />
                        {dateTo ? dayjs(dateTo).format("MMM D, YYYY") : "To date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateTo} onSelect={setDateTo} /></PopoverContent>
                  </Popover>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[180px] border-emerald-300 hover:bg-emerald-50"><SelectValue placeholder="Sort by" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date_desc">Date (Newest first)</SelectItem>
                      <SelectItem value="date_asc">Date (Oldest first)</SelectItem>
                      <SelectItem value="amount_desc">Amount (High → Low)</SelectItem>
                      <SelectItem value="amount_asc">Amount (Low → High)</SelectItem>
                    </SelectContent>
                  </Select>
                  {hasActiveFilters && (
                    <Button variant="ghost" onClick={clearFilters} className="text-red-600 hover:bg-red-50">
                      <X className="w-4 h-4 mr-2" />Clear
                    </Button>
                  )}
                </div>
              </div>
              {showFilters && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                  className="md:hidden mt-4 pt-4 border-t border-emerald-100 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="border-emerald-300 hover:bg-emerald-50 justify-start">
                          <CalendarIcon className="w-4 h-4 mr-2" />{dateFrom ? dayjs(dateFrom).format("MMM D") : "From date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} /></PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="border-emerald-300 hover:bg-emerald-50 justify-start">
                          <CalendarIcon className="w-4 h-4 mr-2" />{dateTo ? dayjs(dateTo).format("MMM D") : "To date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateTo} onSelect={setDateTo} /></PopoverContent>
                    </Popover>
                  </div>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-full border-emerald-300 hover:bg-emerald-50"><SelectValue placeholder="Sort by" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date_desc">Date (Newest first)</SelectItem>
                      <SelectItem value="date_asc">Date (Oldest first)</SelectItem>
                      <SelectItem value="amount_desc">Amount (High → Low)</SelectItem>
                      <SelectItem value="amount_asc">Amount (Low → High)</SelectItem>
                    </SelectContent>
                  </Select>
                  {hasActiveFilters && (
                    <Button variant="outline" onClick={clearFilters} className="w-full text-red-600 hover:bg-red-50 border-red-200">
                      <X className="w-4 h-4 mr-2" />Clear All Filters
                    </Button>
                  )}
                </motion.div>
              )}
            </Card>
          </motion.div>

          {/* Table */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            {filteredSales.length === 0 ? (
              <Card className="p-12 text-center border-2 border-dashed border-emerald-200">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-50 mb-4">
                  <Package className="h-10 w-10 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">No sales records found</h3>
                <p className="text-gray-600 mb-4">Try adjusting your filters or date range</p>
                {hasActiveFilters && (
                  <Button variant="outline" onClick={clearFilters} className="border-emerald-300 hover:bg-emerald-50">Clear Filters</Button>
                )}
              </Card>
            ) : (
              <Card className="overflow-hidden border-2 border-emerald-100">
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-emerald-50 to-green-50 hover:from-emerald-50 hover:to-green-50">
                        <TableHead className="font-bold text-gray-800">ID</TableHead>
                        <TableHead className="font-bold text-gray-800">Date & Time</TableHead>
                        {isViewingAllBranches && <TableHead className="font-bold text-gray-800">Branch</TableHead>}
                        <TableHead className="font-bold text-gray-800">Products</TableHead>
                        <TableHead className="font-bold text-gray-800">Items</TableHead>
                        <TableHead className="font-bold text-gray-800">Amount</TableHead>
                        <TableHead className="font-bold text-gray-800">Status</TableHead>
                        <TableHead className="font-bold text-gray-800">Sold By</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSales.map((sale) => (
                        <TableRow key={sale.id} className="cursor-pointer hover:bg-emerald-50 transition-colors" onClick={() => handleRowClick(sale)}>
                          <TableCell className="font-semibold text-emerald-700">#{sale.id}</TableCell>
                          <TableCell className="whitespace-nowrap text-gray-600">{dayjs(sale.soldAt).format("MMM D, YYYY h:mm A")}</TableCell>
                          {isViewingAllBranches && (
                            <TableCell>
                              {sale.branch ? (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">{sale.branch.code}</Badge>
                              ) : <span className="text-xs text-muted-foreground">-</span>}
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="truncate max-w-[200px] text-gray-800">{getProductSummary(sale.items)}</span>
                              {sale.items.length > 1 && <Badge variant="secondary" className="bg-gray-100">{sale.items.length} items</Badge>}
                              {hasDiscounts(sale) && (
                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                                  <Tag className="h-3 w-3 mr-1" />Discount
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium text-gray-800">{getTotalItems(sale.items)}</TableCell>
                          <TableCell className="font-bold text-emerald-600">
                            ₱{(sale.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>{getStatusBadge(sale.status) || <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">Completed</Badge>}</TableCell>
                          <TableCell className="text-gray-600">{sale.seller?.name || sale.soldBy}</TableCell>
                          <TableCell><ChevronRight className="h-5 w-5 text-emerald-600" /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-emerald-100">
                  {filteredSales.map((sale) => (
                    <motion.div key={sale.id} whileTap={{ scale: 0.98 }} onClick={() => handleRowClick(sale)}
                      className="p-4 hover:bg-emerald-50 active:bg-emerald-100 transition-colors cursor-pointer">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-emerald-700 text-lg">#{sale.id}</p>
                            {getStatusBadge(sale.status)}
                          </div>
                          <p className="text-xs text-gray-500">{dayjs(sale.soldAt).format("MMM D, YYYY h:mm A")}</p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Products</span>
                          <span className="text-sm font-medium text-gray-800">{getProductSummary(sale.items)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Items</span>
                          <span className="text-sm font-medium text-gray-800">{getTotalItems(sale.items)}</span>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-emerald-100">
                          <span className="text-sm font-semibold text-gray-800">Total</span>
                          <span className="text-lg font-bold text-emerald-600">
                            ₱{(sale.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 pt-2">
                          {hasDiscounts(sale) && <Badge className="bg-emerald-100 text-emerald-700 text-xs"><Tag className="h-3 w-3 mr-1" />Discount</Badge>}
                          <span className="text-xs text-gray-500">by {sale.seller?.name || sale.soldBy}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </Card>
            )}
          </motion.div>
        </div>

        {/* ─── Transaction Details / Refund Dialog ─────────────────────────────── */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <AnimatePresence mode="wait">

              {/* ── VIEW: Details ── */}
              {dialogView === "details" && selectedSale && (
                <motion.div key="details" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-gray-800">Transaction Details</DialogTitle>
                    <DialogDescription className="text-base flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-emerald-700">#{selectedSale.id}</span>
                      <span>•</span>
                      <span>{dayjs(selectedSale.soldAt).format("MMM D, YYYY h:mm A")}</span>
                      {getStatusBadge(selectedSale.status)}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-6 mt-4">
                    {/* Info grid */}
                    <div className="grid grid-cols-2 gap-4 p-4 bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl border-2 border-emerald-200">
                      {selectedSale.branch && (
                        <div>
                          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Branch</p>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-emerald-600" />
                            <p className="font-semibold text-gray-800">{selectedSale.branch.name}</p>
                          </div>
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Sold By</p>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-emerald-600" />
                          <p className="font-semibold text-gray-800">{selectedSale.seller?.name || selectedSale.soldBy}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Total Items</p>
                        <p className="font-semibold text-gray-800">{getTotalItems(selectedSale.items)}</p>
                      </div>
                    </div>

                    {/* Items Table */}
                    <div>
                      <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                        <Package className="h-5 w-5 text-emerald-600" />Items Purchased
                      </h3>
                      <div className="border-2 border-emerald-100 rounded-xl overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gradient-to-r from-emerald-50 to-green-50 hover:from-emerald-50 hover:to-green-50">
                              <TableHead className="font-bold">Product</TableHead>
                              <TableHead className="text-right font-bold">Qty</TableHead>
                              <TableHead className="text-right font-bold">Unit Price</TableHead>
                              <TableHead className="text-right font-bold">Subtotal</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedSale.items.map((item, idx) => (
                              <React.Fragment key={idx}>
                                <TableRow>
                                  <TableCell className="font-medium text-gray-800">{item.product?.name || "Unknown product"}</TableCell>
                                  <TableCell className="text-right text-gray-800">{item.quantity || 0}</TableCell>
                                  <TableCell className="text-right">
                                    {item.discountedPrice ? (
                                      <div className="space-y-1">
                                        <span className="block line-through text-gray-400 text-sm">₱{(item.price || 0).toFixed(2)}</span>
                                        <span className="block text-emerald-600 font-bold">₱{item.discountedPrice.toFixed(2)}</span>
                                      </div>
                                    ) : (
                                      <span className="text-gray-800">₱{(item.price || 0).toFixed(2)}</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right font-bold text-gray-800">
                                    ₱{getItemSubtotal(item).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </TableCell>
                                </TableRow>
                                {item.discount && (
                                  <TableRow className="bg-emerald-50/50">
                                    <TableCell colSpan={4} className="text-sm text-emerald-700 py-2">
                                      <div className="flex items-center gap-2">
                                        <Tag className="h-4 w-4" />
                                        <span className="font-semibold">{item.discount.name}</span>
                                        {item.discountAmount && item.discountAmount > 0 && (
                                          <span className="text-xs">(Saved: ₱{item.discountAmount.toFixed(2)})</span>
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

                    {/* Totals */}
                    <div className="space-y-3">
                      {selectedSale.subtotal && selectedSale.subtotal > 0 && (
                        <div className="flex justify-between items-center text-gray-600">
                          <span>Subtotal</span>
                          <span className="font-semibold">₱{selectedSale.subtotal.toFixed(2)}</span>
                        </div>
                      )}
                      {selectedSale.totalDiscount && selectedSale.totalDiscount > 0 && (
                        <div className="flex justify-between items-center text-emerald-600 font-semibold">
                          <span>Total Discount</span>
                          <span>-₱{selectedSale.totalDiscount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center p-4 bg-gradient-to-r from-emerald-600 to-green-600 rounded-xl text-white">
                        <p className="font-bold text-lg">Total Amount</p>
                        <p className="font-bold text-2xl">
                          ₱{(selectedSale.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      {selectedSale.cashAmount && (
                        <>
                          <div className="flex justify-between items-center text-gray-600">
                            <span>Cash Received</span>
                            <span className="font-semibold">₱{selectedSale.cashAmount.toFixed(2)}</span>
                          </div>
                          {selectedSale.changeAmount != null && (
                            <div className="flex justify-between items-center text-gray-600">
                              <span>Change</span>
                              <span className="font-semibold">₱{selectedSale.changeAmount.toFixed(2)}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Refund action buttons */}
                    {selectedSale.status !== "fully_refunded" && (
                      <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-gray-100">
                        <Button onClick={handleOpenRefund} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white">
                          <RotateCcw className="w-4 h-4 mr-2" />
                          Process Refund
                        </Button>
                        {refundHistory.length > 0 && (
                          <Button variant="outline" onClick={handleOpenHistory} className="flex-1 border-amber-300 text-amber-700 hover:bg-amber-50">
                            View Refund History
                            <Badge className="ml-2 bg-amber-100 text-amber-700">{refundHistory.length}</Badge>
                          </Button>
                        )}
                      </div>
                    )}
                    {selectedSale.status === "fully_refunded" && refundHistory.length > 0 && (
                      <div className="pt-2 border-t border-gray-100">
                        <Button variant="outline" onClick={handleOpenHistory} className="w-full border-amber-300 text-amber-700 hover:bg-amber-50">
                          View Refund History
                          <Badge className="ml-2 bg-amber-100 text-amber-700">{refundHistory.length}</Badge>
                        </Button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* ── VIEW: Process Refund ── */}
              {dialogView === "refund" && selectedSale && (
                <motion.div key="refund" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                  <DialogHeader>
                    <div className="flex items-center gap-3">
                      <Button variant="ghost" size="sm" onClick={handleBackToDetails} className="h-8 w-8 p-0 text-gray-500 hover:text-gray-800">
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      <div>
                        <DialogTitle className="text-2xl font-bold text-gray-800">Process Refund</DialogTitle>
                        <DialogDescription className="text-base">
                          Sale <span className="font-semibold text-emerald-700">#{selectedSale.id}</span> — select items and quantities to refund
                        </DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>

                  <div className="space-y-5 mt-4">
                    {/* Items with qty selectors */}
                    <div className="space-y-3">
                      {selectedSale.items.map((item, idx) => {
                        const itemId = item.id;
                        if (!itemId) return null;
                        const refundable = getRefundableQty(item);
                        const selected = refundCart[itemId] || 0;
                        const alreadyDone = alreadyRefunded[itemId] || 0;
                        const isFullyRefunded = refundable === 0;

                        return (
                          <div key={idx} className={`p-4 rounded-xl border-2 transition-all ${isFullyRefunded ? "border-gray-100 bg-gray-50 opacity-60" : selected > 0 ? "border-amber-300 bg-amber-50" : "border-emerald-100 bg-white"}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-800 truncate">{item.product?.name}</p>
                                <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 flex-wrap">
                                  <span>₱{(item.discountedPrice ?? item.price).toFixed(2)} each</span>
                                  <span>•</span>
                                  <span>Sold: {item.quantity}</span>
                                  {alreadyDone > 0 && (
                                    <>
                                      <span>•</span>
                                      <span className="text-amber-600 font-medium">Already refunded: {alreadyDone}</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              {isFullyRefunded ? (
                                <Badge className="bg-gray-100 text-gray-500 shrink-0">Fully Refunded</Badge>
                              ) : (
                                <div className="flex items-center gap-2 shrink-0">
                                  <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-emerald-300" onClick={() => adjustRefundQty(itemId, -1, refundable)} disabled={selected === 0}>
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <span className={`w-8 text-center font-bold text-sm ${selected > 0 ? "text-amber-700" : "text-gray-400"}`}>{selected}</span>
                                  <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-emerald-300" onClick={() => adjustRefundQty(itemId, 1, refundable)} disabled={selected >= refundable}>
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                  <span className="text-xs text-gray-400">/ {refundable}</span>
                                </div>
                              )}
                            </div>

                            {selected > 0 && (
                              <div className="mt-2 pt-2 border-t border-amber-200 flex justify-between text-sm">
                                <span className="text-amber-700">Refund amount</span>
                                <span className="font-bold text-amber-700">
                                  ₱{((item.discountedPrice ?? item.price) * selected).toFixed(2)}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Reason */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Reason for refund (optional)</label>
                      <Textarea
                        placeholder="e.g. Defective product, wrong item, customer request..."
                        value={refundReason}
                        onChange={(e) => setRefundReason(e.target.value)}
                        className="border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 resize-none"
                        rows={2}
                      />
                    </div>

                    {/* Summary bar */}
                    {refundItemCount > 0 && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        className="p-4 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl text-white">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium opacity-90">{refundItemCount} item{refundItemCount !== 1 ? "s" : ""} to refund</p>
                            <p className="text-2xl font-bold">₱{refundTotal.toFixed(2)}</p>
                          </div>
                          <RotateCcw className="h-8 w-8 opacity-40" />
                        </div>
                      </motion.div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                      <Button variant="outline" onClick={handleBackToDetails} className="flex-1 border-gray-300">Cancel</Button>
                      <Button onClick={handleSubmitRefund} disabled={refundItemCount === 0 || refundLoading}
                        className="flex-1 bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50">
                        {refundLoading ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
                        ) : (
                          <><CheckCircle2 className="w-4 h-4 mr-2" />Confirm Refund</>
                        )}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── VIEW: Refund History ── */}
              {dialogView === "refund_history" && selectedSale && (
                <motion.div key="history" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                  <DialogHeader>
                    <div className="flex items-center gap-3">
                      <Button variant="ghost" size="sm" onClick={handleBackToDetails} className="h-8 w-8 p-0 text-gray-500 hover:text-gray-800">
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      <div>
                        <DialogTitle className="text-2xl font-bold text-gray-800">Refund History</DialogTitle>
                        <DialogDescription>
                          Sale <span className="font-semibold text-emerald-700">#{selectedSale.id}</span>
                        </DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>

                  <div className="space-y-4 mt-4">
                    {refundHistoryLoading ? (
                      <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
                    ) : refundHistory.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <AlertCircle className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                        No refunds found for this sale
                      </div>
                    ) : (
                      refundHistory.map((refund) => (
                        <div key={refund.id} className="border-2 border-amber-100 rounded-xl overflow-hidden">
                          <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 flex items-start justify-between gap-3">
                            <div>
                              <p className="font-bold text-gray-800">Refund #{refund.id}</p>
                              <p className="text-sm text-gray-500">{dayjs(refund.createdAt).format("MMM D, YYYY h:mm A")}</p>
                              {refund.refundedBy && <p className="text-sm text-gray-600">By: {refund.refundedBy.name}</p>}
                              {refund.reason && <p className="text-sm text-amber-700 mt-1 italic">"{refund.reason}"</p>}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs text-gray-500">Total Refund</p>
                              <p className="text-xl font-bold text-amber-600">₱{Number(refund.totalRefund).toFixed(2)}</p>
                            </div>
                          </div>
                          <div className="divide-y divide-amber-50">
                            {refund.items.map((item) => (
                              <div key={item.id} className="px-4 py-2 flex items-center justify-between text-sm">
                                <span className="text-gray-700">{item.product.name} × {item.quantity}</span>
                                <span className="font-semibold text-gray-800">₱{Number(item.refundAmount).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
};

export default SalesReportPage;