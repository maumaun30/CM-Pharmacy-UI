// app/stock/transactions/page.tsx
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
import { ArrowLeft, History, TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";

interface User {
  id: number;
  username: string;
}

interface Product {
  id: number;
  name: string;
  sku: string;
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
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const StockTransactionsPage = () => {
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 50,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

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
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [search, typeFilter, dateFrom, dateTo]);

  const getTransactionColor = (type: string) => {
    const colors: Record<string, string> = {
      PURCHASE: "bg-green-100 text-green-800",
      INITIAL_STOCK: "bg-blue-100 text-blue-800",
      RETURN: "bg-purple-100 text-purple-800",
      SALE: "bg-yellow-100 text-yellow-800",
      ADJUSTMENT: "bg-orange-100 text-orange-800",
      DAMAGE: "bg-red-100 text-red-800",
      EXPIRED: "bg-gray-100 text-gray-800",
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  const handlePageChange = (newPage: number) => {
    fetchTransactions(newPage);
  };

  return (
    <ProtectedRoute>
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/stock">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <History className="h-6 w-6" />
              Stock Transactions
            </h1>
            <p className="text-sm text-muted-foreground">
              View all stock movements and transactions
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search product..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
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
                <Button variant="outline" className="w-[140px]">
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
                <Button variant="outline" className="w-[140px]">
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
            >
              Reset
            </Button>
          </div>
        </Card>

        {/* Transactions Table */}
        <Card className="p-4">
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Qty Change</TableHead>
                  <TableHead className="text-right">Before</TableHead>
                  <TableHead className="text-right">After</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>User</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="text-sm">
                      {dayjs(transaction.createdAt).format("MMM D, YYYY h:mm A")}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {transaction.product.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {transaction.product.sku}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={getTransactionColor(
                          transaction.transactionType
                        )}
                      >
                        {transaction.transactionType.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div
                        className={`flex items-center justify-end gap-1 ${
                          transaction.quantity > 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {transaction.quantity > 0 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                        <span className="font-semibold">
                          {transaction.quantity > 0 ? "+" : ""}
                          {transaction.quantity}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {transaction.quantityBefore}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {transaction.quantityAfter}
                    </TableCell>
                    <TableCell className="text-sm">
                      {transaction.supplier && (
                        <div>Supplier: {transaction.supplier}</div>
                      )}
                      {transaction.batchNumber && (
                        <div>Batch: {transaction.batchNumber}</div>
                      )}
                      {transaction.unitCost && (
                        <div>Cost: ₱{parseFloat(transaction.unitCost.toString()).toFixed(2)}</div>
                      )}
                      {transaction.reason && (
                        <div className="text-muted-foreground">
                          {transaction.reason}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {transaction.user.username}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        {/* Pagination */}
        <div className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.limit + 1} -{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total} transactions
          </div>
          <div className="space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default StockTransactionsPage;