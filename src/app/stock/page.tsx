"use client";

import React, { useEffect, useState } from "react";

import api from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";
import RoleProtectedRoute from "@/components/RoleProtectedRoute";

import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Package,
  PackageX,
  AlertTriangle,
  TrendingDown,
  Plus,
  History,
  Building2,
  Loader2,
  ChevronRight,
  PackagePlus,
} from "lucide-react";
import { motion } from "framer-motion";

interface Branch {
  id: number;
  name: string;
  code: string;
}

interface StockSummary {
  totalProducts: number;
  outOfStock: number;
  lowStock: number;
  criticalStock: number;
  recentTransactions: number;
}

interface LowStockProduct {
  id: number;
  name: string;
  sku: string;
  currentStock: number;
  minimumStock: number;
  reorderPoint: number;
  price: number;
}

interface User {
  id: number;
  role: string;
  branchId: number;
  currentBranchId: number | null;
  branch?: Branch;
  currentBranch?: Branch;
}

const StockDashboard = () => {
  const [summary, setSummary] = useState<StockSummary>({
    totalProducts: 0,
    outOfStock: 0,
    lowStock: 0,
    criticalStock: 0,
    recentTransactions: 0,
  });
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>(
    [],
  );
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeBranch, setActiveBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser]);

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

  const fetchData = async () => {
    try {
      setLoading(true);
      const [summaryRes, lowStockRes] = await Promise.all([
        api.get("/stock/summary"),
        api.get("/stock/low-stock"),
      ]);

      setSummary(summaryRes.data);
      setLowStockProducts(lowStockRes.data);
    } catch (error) {
      console.error("Error fetching stock data:", error);
      toast.error("Failed to fetch stock data");
    } finally {
      setLoading(false);
    }
  };

  const getStockStatus = (product: LowStockProduct) => {
    if (product.currentStock === 0) {
      return {
        label: "Out of Stock",
        color: "bg-red-100 text-red-800 border-red-200",
      };
    }
    if (product.currentStock <= product.minimumStock) {
      return {
        label: "Critical",
        color: "bg-orange-100 text-orange-800 border-orange-200",
      };
    }
    if (product.currentStock <= product.reorderPoint) {
      return {
        label: "Low Stock",
        color: "bg-yellow-100 text-yellow-800 border-yellow-200",
      };
    }
    return {
      label: "In Stock",
      color: "bg-emerald-100 text-emerald-800 border-emerald-200",
    };
  };

  const isViewingAllBranches =
    currentUser?.role === "admin" && !currentUser?.currentBranchId;

  if (loading) {
    return (
      <RoleProtectedRoute allowedRoles={["admin"]}>
        <ProtectedRoute>
          <div className="flex items-center justify-center h-screen bg-gradient-to-br from-emerald-50 to-green-50">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-emerald-600 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">Loading stock data...</p>
            </div>
          </div>
        </ProtectedRoute>
      </RoleProtectedRoute>
    );
  }

  return (
    <RoleProtectedRoute allowedRoles={["admin"]}>
      <ProtectedRoute>
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50 pb-24">
          <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg">
                    <Package className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                      Stock Management
                    </h1>
                    <p className="text-sm text-gray-600">
                      Monitor and manage your inventory levels
                    </p>
                  </div>
                </div>
                {activeBranch && (
                  <div className="flex items-center gap-2 ml-15 text-sm text-gray-600">
                    <Building2 className="h-4 w-4 text-emerald-600" />
                    <span>
                      {isViewingAllBranches
                        ? "All Branches"
                        : `${activeBranch.name} (${activeBranch.code})`}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 self-start sm:self-auto">
                <Link href="/stock/add">
                  <Button
                    variant="outline"
                    className="border-emerald-300 hover:bg-emerald-50"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Stock
                  </Button>
                </Link>
                <Link href="/stock/adjust">
                  <Button
                    variant="outline"
                    className="border-orange-300 hover:bg-orange-50"
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Adjust/Loss
                  </Button>
                </Link>
                <Link href="/stock/transactions">
                  <Button
                    variant="outline"
                    className="border-blue-300 hover:bg-blue-50"
                  >
                    <History className="h-4 w-4 mr-2" />
                    Transactions
                  </Button>
                </Link>
              </div>
            </motion.div>

            {/* Branch Info Alert */}
            {!isViewingAllBranches && activeBranch && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
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
                        You are viewing stock data for{" "}
                        <strong className="text-emerald-700">
                          {activeBranch.name}
                        </strong>{" "}
                        branch only.
                      </p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Summary Cards */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
            >
              <Card className="p-5 border-2 border-emerald-100 hover:border-emerald-300 hover:shadow-lg transition-all">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                    <Package className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                      Total Products
                    </p>
                    <p className="text-2xl font-bold text-gray-800">
                      {summary.totalProducts}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-5 border-2 border-red-100 hover:border-red-300 hover:shadow-lg transition-all">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-red-500 flex items-center justify-center">
                    <PackageX className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                      Out of Stock
                    </p>
                    <p className="text-2xl font-bold text-red-600">
                      {summary.outOfStock}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-5 border-2 border-orange-100 hover:border-orange-300 hover:shadow-lg transition-all">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-orange-500 flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                      Critical Stock
                    </p>
                    <p className="text-2xl font-bold text-orange-600">
                      {summary.criticalStock}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-5 border-2 border-yellow-100 hover:border-yellow-300 hover:shadow-lg transition-all">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-yellow-500 flex items-center justify-center">
                    <TrendingDown className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                      Low Stock
                    </p>
                    <p className="text-2xl font-bold text-yellow-600">
                      {summary.lowStock}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-5 border-2 border-emerald-100 hover:border-emerald-300 hover:shadow-lg transition-all">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                    <History className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                      Recent (7d)
                    </p>
                    <p className="text-2xl font-bold text-gray-800">
                      {summary.recentTransactions}
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Low Stock Alert */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {lowStockProducts.length > 0 ? (
                <Card className="overflow-hidden border-2 border-orange-200">
                  <div className="bg-gradient-to-r from-orange-50 to-red-50 px-6 py-4 border-b-2 border-orange-200">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-orange-600" />
                        Products Requiring Attention
                        {isViewingAllBranches && (
                          <Badge className="ml-2 bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200">
                            All Branches
                          </Badge>
                        )}
                      </h2>
                      <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 border-orange-200 self-start sm:self-auto">
                        {lowStockProducts.length} items
                      </Badge>
                    </div>
                  </div>

                  <div className="p-4 md:p-6">
                    <div className="space-y-3">
                      {lowStockProducts.slice(0, 10).map((product) => {
                        const status = getStockStatus(product);
                        return (
                          <div
                            key={product.id}
                            className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 border-2 border-gray-200 rounded-xl hover:bg-emerald-50 hover:border-emerald-300 transition-all"
                          >
                            <div className="flex-1">
                              <div className="flex items-start gap-3">
                                <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                                  <Package className="h-5 w-5 text-gray-600" />
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-800">
                                    {product.name}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    SKU:{" "}
                                    <span className="font-mono">
                                      {product.sku}
                                    </span>
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                              <div className="text-center min-w-[80px]">
                                <p className="text-xs text-gray-600 font-semibold uppercase tracking-wide">
                                  Current
                                </p>
                                <p className="text-lg font-bold text-gray-800">
                                  {product.currentStock}
                                </p>
                              </div>

                              <div className="text-center min-w-[80px]">
                                <p className="text-xs text-gray-600 font-semibold uppercase tracking-wide">
                                  Reorder
                                </p>
                                <p className="text-lg font-bold text-gray-800">
                                  {product.reorderPoint}
                                </p>
                              </div>

                              <Badge variant="outline" className={status.color}>
                                {status.label}
                              </Badge>

                              <Link href={`/stock/add?productId=${product.id}`}>
                                <Button
                                  size="sm"
                                  className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white shadow-md"
                                >
                                  <PackagePlus className="h-4 w-4 mr-1" />
                                  Restock
                                </Button>
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {lowStockProducts.length > 10 && (
                      <div className="mt-6 text-center">
                        <Button
                          variant="outline"
                          className="border-orange-300 hover:bg-orange-50"
                        >
                          View All {lowStockProducts.length} Products
                          <ChevronRight className="h-4 w-4 ml-2" />
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              ) : (
                <Card className="p-12 text-center border-2 border-dashed border-emerald-200">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-50 mb-4">
                    <Package className="h-10 w-10 text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    All Stock Levels Healthy
                  </h3>
                  <p className="text-gray-600">
                    No low stock products found. All items are well-stocked!
                  </p>
                </Card>
              )}
            </motion.div>

            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <h3 className="text-lg font-bold text-gray-800 mb-4">
                Quick Actions
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link href="/stock/add">
                  <Card className="p-6 hover:shadow-lg cursor-pointer transition-all border-2 border-emerald-100 hover:border-emerald-300 group">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Plus className="h-7 w-7 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-800 text-lg">
                          Add Stock
                        </p>
                        <p className="text-sm text-gray-600">
                          Record new purchases or returns
                        </p>
                      </div>
                    </div>
                  </Card>
                </Link>

                <Link href="/stock/adjust">
                  <Card className="p-6 hover:shadow-lg cursor-pointer transition-all border-2 border-orange-100 hover:border-orange-300 group">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-xl bg-orange-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <AlertTriangle className="h-7 w-7 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-800 text-lg">
                          Adjust Stock
                        </p>
                        <p className="text-sm text-gray-600">
                          Manual adjustments or record losses
                        </p>
                      </div>
                    </div>
                  </Card>
                </Link>

                <Link href="/stock/transactions">
                  <Card className="p-6 hover:shadow-lg cursor-pointer transition-all border-2 border-blue-100 hover:border-blue-300 group">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-xl bg-blue-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <History className="h-7 w-7 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-800 text-lg">
                          View History
                        </p>
                        <p className="text-sm text-gray-600">
                          See all stock transactions
                        </p>
                      </div>
                    </div>
                  </Card>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </ProtectedRoute>
    </RoleProtectedRoute>
  );
};

export default StockDashboard;
