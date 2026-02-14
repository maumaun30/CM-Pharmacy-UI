"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  ArrowLeft,
  History,
  TrendingUp,
  TrendingDown,
  Building2,
  Loader2,
  Search,
  Filter,
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  User,
  Package,
  FileText,
  Truck,
  DollarSign,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

interface User {
  id: number;
  username: string;
  fullName: string;
}

interface Product {
  id: number;
  name: string;
  sku: string;
}

interface Branch {
  id: number;
  name: string;
  code: string;
}

interface StockTransaction {
  id: number;
  productId: number;
  transactionType: string;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  unitCost: number | null;
  totalCost: number | null;
  batchNumber: string | null;
  expiryDate: string | null;
  supplier: string | null;
  reason: string | null;
  createdAt: string;
  product: Product;
  user: User;
  branch?: Branch;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface CurrentUser {
  id: number;
  role: string;
  branchId: number;
  currentBranchId: number | null;
  branch?: Branch;
  currentBranch?: Branch;
}

const StockTransactionsPage = () => {
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 50,
    totalPages: 0,
  });
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [activeBranch, setActiveBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchTransactions();
    }
  }, [search, typeFilter, dateFrom, dateTo, currentUser]);

  const fetchCurrentUser = async () => {
    try {
      const res = await api.get("/auth/me");
      setCurrentUser(res.data);

      const branch = res.data.currentBranch || res.data.branch;
      setActiveBranch(branch);
    } catch (error) {
      console.error("Error fetching user:", error);
      toast.error("Failed to fetch user information");
    }
  };

  const fetchTransactions = async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
      });

      if (search) params.append("search", search);
      if (typeFilter !== "all") params.append("transactionType", typeFilter);
      if (dateFrom) params.append("dateFrom", dateFrom.toISOString());
      if (dateTo) params.append("dateTo", dateTo.toISOString());

      const res = await api.get(`/stock/transactions?${params.toString()}`);
      setTransactions(res.data.stocks);
      setPagination(res.data.pagination);
    } catch (error) {
      console.error("Fetch transactions error:", error);
      toast.error("Failed to fetch transactions");
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  };

  const getTransactionTypeInfo = (type: string) => {
    const types: Record<string, { label: string; color: string }> = {
      PURCHASE: {
        label: "Purchase",
        color: "bg-emerald-100 text-emerald-800 border-emerald-200",
      },
      INITIAL_STOCK: {
        label: "Initial Stock",
        color: "bg-blue-100 text-blue-800 border-blue-200",
      },
      RETURN: {
        label: "Return",
        color: "bg-purple-100 text-purple-800 border-purple-200",
      },
      SALE: {
        label: "Sale",
        color: "bg-yellow-100 text-yellow-800 border-yellow-200",
      },
      ADJUSTMENT: {
        label: "Adjustment",
        color: "bg-amber-100 text-amber-800 border-amber-200",
      },
      DAMAGE: {
        label: "Damage",
        color: "bg-red-100 text-red-800 border-red-200",
      },
      EXPIRED: {
        label: "Expired",
        color: "bg-orange-100 text-orange-800 border-orange-200",
      },
    };
    return (
      types[type] || {
        label: type.replace("_", " "),
        color: "bg-gray-100 text-gray-800 border-gray-200",
      }
    );
  };

  const handlePageChange = (newPage: number) => {
    fetchTransactions(newPage);
  };

  const isViewingAllBranches =
    currentUser?.role === "admin" && !currentUser?.currentBranchId;

  if (initialLoading) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center h-screen bg-gradient-to-br from-emerald-50 to-green-50">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-emerald-600 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Loading transactions...</p>
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
            className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <Link href="/stock">
                <Button
                  variant="outline"
                  size="icon"
                  className="border-emerald-300 hover:bg-emerald-50"
                >
                  <ArrowLeft className="h-5 w-5 text-emerald-600" />
                </Button>
              </Link>
              <div>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg">
                    <History className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                      Stock Transactions
                    </h1>
                    <p className="text-sm text-gray-600">
                      Complete history of all inventory movements
                    </p>
                  </div>
                </div>
                {activeBranch && (
                  <div className="flex items-center gap-2 ml-15 mt-2 text-sm text-gray-600">
                    <Building2 className="h-4 w-4 text-emerald-600" />
                    <span>
                      {isViewingAllBranches
                        ? "All Branches"
                        : `${activeBranch.name} (${activeBranch.code})`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Branch Info Alert */}
          {!isViewingAllBranches && activeBranch && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="p-5 bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-200">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0">
                    <Building2 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Branch Filter Active</p>
                    <p className="text-sm text-gray-600">
                      Showing transactions for{" "}
                      <strong className="text-emerald-700">{activeBranch.name}</strong>{" "}
                      branch only.
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Stats Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card className="p-5 border-2 border-emerald-100">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                  <History className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                    Total Transactions
                  </p>
                  <p className="text-2xl font-bold text-gray-800">
                    {pagination.total}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Filters */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-4 border-2 border-emerald-100">
              <div className="flex items-center gap-2 mb-4">
                <Filter className="h-5 w-5 text-emerald-600" />
                <h3 className="font-bold text-gray-800">Filters</h3>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search product..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                  />
                </div>

                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[180px] h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200">
                    <SelectValue placeholder="Transaction Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="PURCHASE">Purchase</SelectItem>
                    <SelectItem value="SALE">Sale</SelectItem>
                    <SelectItem value="RETURN">Return</SelectItem>
                    <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
                    <SelectItem value="DAMAGE">Damage</SelectItem>
                    <SelectItem value="EXPIRED">Expired</SelectItem>
                    <SelectItem value="INITIAL_STOCK">Initial Stock</SelectItem>
                  </SelectContent>
                </Select>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-[160px] h-11 border-emerald-200 hover:bg-emerald-50 justify-start"
                    >
                      <CalendarIcon className="h-4 w-4 mr-2 text-emerald-600" />
                      {dateFrom ? dayjs(dateFrom).format("MMM D, YYYY") : "From date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-[160px] h-11 border-emerald-200 hover:bg-emerald-50 justify-start"
                    >
                      <CalendarIcon className="h-4 w-4 mr-2 text-emerald-600" />
                      {dateTo ? dayjs(dateTo).format("MMM D, YYYY") : "To date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={dateTo} onSelect={setDateTo} />
                  </PopoverContent>
                </Popover>

                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch("");
                    setTypeFilter("all");
                    setDateFrom(undefined);
                    setDateTo(undefined);
                  }}
                  className="h-11 border-red-200 hover:bg-red-50 text-red-600"
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              </div>
            </Card>
          </motion.div>

          {/* Transactions Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {loading && !initialLoading ? (
              <Card className="p-12 text-center border-2 border-emerald-100">
                <Loader2 className="h-12 w-12 animate-spin text-emerald-600 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">Loading transactions...</p>
              </Card>
            ) : transactions.length === 0 ? (
              <Card className="p-12 text-center border-2 border-dashed border-emerald-200">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-50 mb-4">
                  <History className="h-10 w-10 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  No transactions found
                </h3>
                <p className="text-gray-600">
                  {search || typeFilter !== "all" || dateFrom || dateTo
                    ? "Try adjusting your filters"
                    : "No stock transactions recorded yet"}
                </p>
              </Card>
            ) : (
              <Card className="overflow-hidden border-2 border-emerald-100">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-emerald-50 to-green-50 hover:from-emerald-50 hover:to-green-50">
                        <TableHead className="font-bold text-gray-800 whitespace-nowrap">
                          Date & Time
                        </TableHead>
                        <TableHead className="font-bold text-gray-800 whitespace-nowrap">
                          Product
                        </TableHead>
                        {isViewingAllBranches && (
                          <TableHead className="font-bold text-gray-800 whitespace-nowrap">
                            Branch
                          </TableHead>
                        )}
                        <TableHead className="font-bold text-gray-800 whitespace-nowrap">
                          Type
                        </TableHead>
                        <TableHead className="font-bold text-gray-800 text-right whitespace-nowrap">
                          Qty Change
                        </TableHead>
                        <TableHead className="font-bold text-gray-800 text-right whitespace-nowrap">
                          Before
                        </TableHead>
                        <TableHead className="font-bold text-gray-800 text-right whitespace-nowrap">
                          After
                        </TableHead>
                        <TableHead className="font-bold text-gray-800 whitespace-nowrap">
                          Details
                        </TableHead>
                        <TableHead className="font-bold text-gray-800 whitespace-nowrap">
                          User
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((transaction) => {
                        const typeInfo = getTransactionTypeInfo(transaction.transactionType);
                        return (
                          <TableRow
                            key={transaction.id}
                            className="hover:bg-emerald-50 transition-colors"
                          >
                            <TableCell className="whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <CalendarIcon className="h-4 w-4 text-gray-400" />
                                <div>
                                  <div className="font-medium text-gray-800">
                                    {dayjs(transaction.createdAt).format("MMM D, YYYY")}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {dayjs(transaction.createdAt).format("h:mm A")}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-semibold text-gray-800">
                                  {transaction.product.name}
                                </div>
                                <div className="text-xs text-gray-500 font-mono">
                                  SKU: {transaction.product.sku}
                                </div>
                              </div>
                            </TableCell>
                            {isViewingAllBranches && (
                              <TableCell>
                                {transaction.branch ? (
                                  <Badge
                                    variant="outline"
                                    className="bg-blue-50 text-blue-700 border-blue-200"
                                  >
                                    <Building2 className="h-3 w-3 mr-1" />
                                    {transaction.branch.code}
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-gray-400">-</span>
                                )}
                              </TableCell>
                            )}
                            <TableCell>
                              <Badge variant="outline" className={typeInfo.color}>
                                {typeInfo.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div
                                className={`flex items-center justify-end gap-1 font-bold ${
                                  transaction.quantity > 0
                                    ? "text-emerald-600"
                                    : "text-red-600"
                                }`}
                              >
                                {transaction.quantity > 0 ? (
                                  <TrendingUp className="h-4 w-4" />
                                ) : (
                                  <TrendingDown className="h-4 w-4" />
                                )}
                                <span>
                                  {transaction.quantity > 0 ? "+" : ""}
                                  {transaction.quantity}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium text-gray-700">
                              {transaction.quantityBefore}
                            </TableCell>
                            <TableCell className="text-right font-bold text-gray-800">
                              {transaction.quantityAfter}
                            </TableCell>
                            <TableCell className="max-w-xs">
                              <div className="space-y-1 text-sm">
                                {transaction.supplier && (
                                  <div className="flex items-center gap-1 truncate">
                                    <Truck className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                    <span className="text-gray-600">Supplier:</span>
                                    <span className="font-medium text-gray-800">
                                      {transaction.supplier}
                                    </span>
                                  </div>
                                )}
                                {transaction.batchNumber && (
                                  <div className="flex items-center gap-1 truncate">
                                    <Package className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                    <span className="text-gray-600">Batch:</span>
                                    <span className="font-medium text-gray-800 font-mono">
                                      {transaction.batchNumber}
                                    </span>
                                  </div>
                                )}
                                {transaction.unitCost && (
                                  <div className="flex items-center gap-1">
                                    <DollarSign className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                                    <span className="text-gray-600">Cost:</span>
                                    <span className="font-semibold text-emerald-600">
                                      ₱
                                      {parseFloat(transaction.unitCost.toString()).toFixed(
                                        2,
                                      )}
                                    </span>
                                  </div>
                                )}
                                {transaction.reason && (
                                  <div className="flex items-start gap-1 truncate">
                                    <FileText className="h-3 w-3 text-gray-400 flex-shrink-0 mt-0.5" />
                                    <span className="text-gray-500 italic">
                                      {transaction.reason}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-gray-400" />
                                <span className="text-sm text-gray-700">
                                  {transaction.user.fullName}
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}
          </motion.div>

          {/* Pagination */}
          {transactions.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="p-4 border-2 border-emerald-100">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="text-sm text-gray-600">
                    Showing{" "}
                    <span className="font-semibold text-gray-800">
                      {(pagination.page - 1) * pagination.limit + 1}
                    </span>{" "}
                    -{" "}
                    <span className="font-semibold text-gray-800">
                      {Math.min(pagination.page * pagination.limit, pagination.total)}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-gray-800">
                      {pagination.total}
                    </span>{" "}
                    transactions
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page === 1 || loading}
                      className="border-emerald-300 hover:bg-emerald-50"
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Previous
                    </Button>
                    <div className="px-3 py-1 bg-emerald-50 border-2 border-emerald-200 rounded-lg">
                      <span className="text-sm font-semibold text-emerald-700">
                        Page {pagination.page} of {pagination.totalPages || 1}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page === pagination.totalPages || loading}
                      className="border-emerald-300 hover:bg-emerald-50"
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default StockTransactionsPage;