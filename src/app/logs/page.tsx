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
  Activity,
  Filter,
  Search,
  Calendar as CalendarIcon,
  X,
  Loader2,
  User,
  Shield,
  Clock,
  Globe,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { motion } from "framer-motion";

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  fullName: string;
}

interface Log {
  id: number;
  userId: number | null;
  action: string;
  module: string;
  recordId: number | null;
  description: string;
  metadata: any;
  ipAddress: string | null;
  createdAt: string;
  user: User | null;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const LogsPage = () => {
  const [logs, setLogs] = useState<Log[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 50,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const fetchLogs = async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
      });

      if (search) params.append("search", search);
      if (actionFilter !== "all") params.append("action", actionFilter);
      if (moduleFilter !== "all") params.append("module", moduleFilter);
      if (dateFrom) params.append("dateFrom", dateFrom.toISOString());
      if (dateTo) params.append("dateTo", dateTo.toISOString());

      const res = await api.get(`/logs?${params.toString()}`);
      setLogs(res.data.logs);
      setPagination(res.data.pagination);
    } catch (error) {
      console.error("Fetch logs error:", error);
      toast.error("Failed to fetch logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [search, actionFilter, moduleFilter, dateFrom, dateTo]);

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      CREATE: "bg-emerald-100 text-emerald-800 border-emerald-200",
      UPDATE: "bg-blue-100 text-blue-800 border-blue-200",
      DELETE: "bg-red-100 text-red-800 border-red-200",
      LOGIN: "bg-purple-100 text-purple-800 border-purple-200",
      LOGOUT: "bg-gray-100 text-gray-800 border-gray-200",
      SALE: "bg-amber-100 text-amber-800 border-amber-200",
    };
    return colors[action] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  const handlePageChange = (newPage: number) => {
    fetchLogs(newPage);
  };

  const hasActiveFilters =
    search ||
    actionFilter !== "all" ||
    moduleFilter !== "all" ||
    dateFrom ||
    dateTo;

  const clearFilters = () => {
    setSearch("");
    setActionFilter("all");
    setModuleFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  if (loading && logs.length === 0) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center h-screen bg-gradient-to-br from-emerald-50 to-green-50">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-emerald-600 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Loading activity logs...</p>
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
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg">
                <Activity className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                  Activity Logs
                </h1>
                <p className="text-sm text-gray-600">
                  Track all system activities and changes
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => fetchLogs(pagination.page)}
              disabled={loading}
              className="border-emerald-300 hover:bg-emerald-50 self-start sm:self-auto"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <Activity className="w-4 h-4 mr-2" />
                  Refresh
                </>
              )}
            </Button>
          </motion.div>

          {/* Stats Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="p-5 bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                    Total Records
                  </p>
                  <p className="text-3xl font-bold text-emerald-600 mt-1">
                    {pagination.total.toLocaleString()}
                  </p>
                </div>
                <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                  <Activity className="h-8 w-8 text-white" />
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
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search logs by user, action, or description..."
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
                  <Select value={actionFilter} onValueChange={setActionFilter}>
                    <SelectTrigger className="w-[150px] border-emerald-300 hover:bg-emerald-50">
                      <SelectValue placeholder="Action" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Actions</SelectItem>
                      <SelectItem value="CREATE">Create</SelectItem>
                      <SelectItem value="UPDATE">Update</SelectItem>
                      <SelectItem value="DELETE">Delete</SelectItem>
                      <SelectItem value="LOGIN">Login</SelectItem>
                      <SelectItem value="SALE">Sale</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={moduleFilter} onValueChange={setModuleFilter}>
                    <SelectTrigger className="w-[150px] border-emerald-300 hover:bg-emerald-50">
                      <SelectValue placeholder="Module" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Modules</SelectItem>
                      <SelectItem value="products">Products</SelectItem>
                      <SelectItem value="sales">Sales</SelectItem>
                      <SelectItem value="users">Users</SelectItem>
                      <SelectItem value="categories">Categories</SelectItem>
                      <SelectItem value="discounts">Discounts</SelectItem>
                      <SelectItem value="auth">Auth</SelectItem>
                    </SelectContent>
                  </Select>

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
                  <Select value={actionFilter} onValueChange={setActionFilter}>
                    <SelectTrigger className="w-full border-emerald-300">
                      <SelectValue placeholder="Action" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Actions</SelectItem>
                      <SelectItem value="CREATE">Create</SelectItem>
                      <SelectItem value="UPDATE">Update</SelectItem>
                      <SelectItem value="DELETE">Delete</SelectItem>
                      <SelectItem value="LOGIN">Login</SelectItem>
                      <SelectItem value="SALE">Sale</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={moduleFilter} onValueChange={setModuleFilter}>
                    <SelectTrigger className="w-full border-emerald-300">
                      <SelectValue placeholder="Module" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Modules</SelectItem>
                      <SelectItem value="products">Products</SelectItem>
                      <SelectItem value="sales">Sales</SelectItem>
                      <SelectItem value="users">Users</SelectItem>
                      <SelectItem value="categories">Categories</SelectItem>
                      <SelectItem value="discounts">Discounts</SelectItem>
                      <SelectItem value="auth">Auth</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="grid grid-cols-2 gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="border-emerald-300 justify-start"
                        >
                          <CalendarIcon className="w-4 h-4 mr-2" />
                          {dateFrom
                            ? dayjs(dateFrom).format("MMM D")
                            : "From"}
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
                          className="border-emerald-300 justify-start"
                        >
                          <CalendarIcon className="w-4 h-4 mr-2" />
                          {dateTo ? dayjs(dateTo).format("MMM D") : "To"}
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

          {/* Logs Table/Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {logs.length === 0 ? (
              <Card className="p-12 text-center border-2 border-dashed border-emerald-200">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-50 mb-4">
                  <Activity className="h-10 w-10 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  No activity logs found
                </h3>
                <p className="text-gray-600 mb-4">
                  Try adjusting your filters or search terms
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
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-emerald-600" />
                            Timestamp
                          </div>
                        </TableHead>
                        <TableHead className="font-bold text-gray-800">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-emerald-600" />
                            User
                          </div>
                        </TableHead>
                        <TableHead className="font-bold text-gray-800">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-emerald-600" />
                            Role
                          </div>
                        </TableHead>
                        <TableHead className="font-bold text-gray-800">
                          Action
                        </TableHead>
                        <TableHead className="font-bold text-gray-800">
                          Module
                        </TableHead>
                        <TableHead className="font-bold text-gray-800">
                          Description
                        </TableHead>
                        <TableHead className="font-bold text-gray-800">
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-emerald-600" />
                            IP Address
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow
                          key={log.id}
                          className="hover:bg-emerald-50 transition-colors"
                        >
                          <TableCell className="text-sm text-gray-600 whitespace-nowrap">
                            {dayjs(log.createdAt).format("MMM D, YYYY h:mm:ss A")}
                          </TableCell>
                          <TableCell>
                            {log.user ? (
                              <div>
                                <div className="font-semibold text-gray-800">
                                  {log.user.fullName}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {log.user.username}
                                </div>
                              </div>
                            ) : (
                              <Badge variant="outline" className="bg-gray-50">
                                System
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {log.user ? (
                              <Badge
                                variant="outline"
                                className="capitalize bg-emerald-50 text-emerald-700 border-emerald-200"
                              >
                                {log.user.role}
                              </Badge>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`font-semibold ${getActionColor(log.action)}`}
                            >
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="capitalize font-medium text-gray-800">
                              {log.module}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-md">
                            <p className="truncate text-gray-700">
                              {log.description}
                            </p>
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {log.ipAddress || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-emerald-100">
                  {logs.map((log) => (
                    <div key={log.id} className="p-4 hover:bg-emerald-50 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge
                              variant="outline"
                              className={`font-semibold ${getActionColor(log.action)}`}
                            >
                              {log.action}
                            </Badge>
                            <span className="text-xs text-gray-500 capitalize">
                              {log.module}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">
                            {dayjs(log.createdAt).format("MMM D, YYYY h:mm A")}
                          </p>
                        </div>
                      </div>

                      <p className="text-sm text-gray-700 mb-3">
                        {log.description}
                      </p>

                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          {log.user ? (
                            <>
                              <User className="h-3 w-3 text-emerald-600" />
                              <span className="font-medium text-gray-800">
                                {log.user.fullName}
                              </span>
                              <Badge
                                variant="outline"
                                className="capitalize bg-emerald-50 text-emerald-700 border-emerald-200 text-xs"
                              >
                                {log.user.role}
                              </Badge>
                            </>
                          ) : (
                            <Badge variant="outline" className="bg-gray-50">
                              System
                            </Badge>
                          )}
                        </div>
                        {log.ipAddress && (
                          <div className="flex items-center gap-1 text-gray-500">
                            <Globe className="h-3 w-3" />
                            <span>{log.ipAddress}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </motion.div>

          {/* Pagination */}
          {logs.length > 0 && (
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
                      {Math.min(
                        pagination.page * pagination.limit,
                        pagination.total,
                      )}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-gray-800">
                      {pagination.total}
                    </span>{" "}
                    logs
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
                        Page {pagination.page} of {pagination.totalPages}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={
                        pagination.page === pagination.totalPages || loading
                      }
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

export default LogsPage;