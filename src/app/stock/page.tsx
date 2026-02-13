// app/stock/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import api from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";
import {
  Package,
  PackageX,
  AlertTriangle,
  TrendingDown,
  Plus,
  History,
  FileText,
  Building2,
} from "lucide-react";
import Link from "next/link";

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
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);
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
      
      // Determine active branch
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
      return { label: "Out of Stock", color: "bg-red-100 text-red-800" };
    }
    if (product.currentStock <= product.minimumStock) {
      return { label: "Critical", color: "bg-orange-100 text-orange-800" };
    }
    if (product.currentStock <= product.reorderPoint) {
      return { label: "Low Stock", color: "bg-yellow-100 text-yellow-800" };
    }
    return { label: "In Stock", color: "bg-green-100 text-green-800" };
  };

  const isViewingAllBranches = currentUser?.role === "admin" && !currentUser?.currentBranchId;

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="p-6">
          <p>Loading stock data...</p>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Stock Management</h1>
            {activeBranch && (
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span>
                  {isViewingAllBranches ? "All Branches" : `${activeBranch.name} (${activeBranch.code})`}
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Link href="/stock/add">
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add Stock
              </Button>
            </Link>
            <Link href="/stock/adjust">
              <Button variant="outline">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Adjust/Loss
              </Button>
            </Link>
            <Link href="/stock/transactions">
              <Button variant="outline">
                <History className="h-4 w-4 mr-2" />
                Transactions
              </Button>
            </Link>
          </div>
        </div>

        {/* Branch Info Alert for Non-Admins */}
        {!isViewingAllBranches && activeBranch && (
          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="flex items-center gap-2 text-sm text-blue-800">
              <Building2 className="h-4 w-4" />
              <p>
                You are viewing stock data for <strong>{activeBranch.name}</strong> branch only.
              </p>
            </div>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Products</p>
                <p className="text-2xl font-bold">{summary.totalProducts}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 rounded-lg">
                <PackageX className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Out of Stock</p>
                <p className="text-2xl font-bold text-red-600">
                  {summary.outOfStock}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-100 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Critical Stock</p>
                <p className="text-2xl font-bold text-orange-600">
                  {summary.criticalStock}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <TrendingDown className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Low Stock</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {summary.lowStock}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <History className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Recent (7d)</p>
                <p className="text-2xl font-bold">{summary.recentTransactions}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Low Stock Alert */}
        {lowStockProducts.length > 0 ? (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                Products Requiring Attention
                {isViewingAllBranches && (
                  <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-700">
                    All Branches
                  </Badge>
                )}
              </h2>
              <Badge variant="outline" className="bg-orange-50 text-orange-700">
                {lowStockProducts.length} items
              </Badge>
            </div>

            <div className="space-y-3">
              {lowStockProducts.slice(0, 10).map((product) => {
                const status = getStockStatus(product);
                return (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-muted-foreground">
                            SKU: {product.sku}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          Current Stock
                        </p>
                        <p className="font-semibold">{product.currentStock}</p>
                      </div>

                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          Reorder Point
                        </p>
                        <p className="font-semibold">{product.reorderPoint}</p>
                      </div>

                      <Badge className={status.color}>{status.label}</Badge>

                      <Link href={`/stock/add?productId=${product.id}`}>
                        <Button size="sm" variant="outline">
                          <Plus className="h-4 w-4 mr-1" />
                          Restock
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            {lowStockProducts.length > 10 && (
              <div className="mt-4 text-center">
                <Button variant="outline" size="sm">
                  View All {lowStockProducts.length} Products
                </Button>
              </div>
            )}
          </Card>
        ) : (
          <Card className="p-8 text-center">
            <Package className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
            <p className="text-muted-foreground">
              No low stock products found. All items are well-stocked!
            </p>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/stock/add">
            <Card className="p-6 hover:bg-muted/50 cursor-pointer transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-lg">
                  <Plus className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold">Add Stock</p>
                  <p className="text-sm text-muted-foreground">
                    Record new purchases or returns
                  </p>
                </div>
              </div>
            </Card>
          </Link>

          <Link href="/stock/adjust">
            <Card className="p-6 hover:bg-muted/50 cursor-pointer transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-orange-100 rounded-lg">
                  <AlertTriangle className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <p className="font-semibold">Adjust Stock</p>
                  <p className="text-sm text-muted-foreground">
                    Manual adjustments or record losses
                  </p>
                </div>
              </div>
            </Card>
          </Link>

          <Link href="/stock/transactions">
            <Card className="p-6 hover:bg-muted/50 cursor-pointer transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <History className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold">View History</p>
                  <p className="text-sm text-muted-foreground">
                    See all stock transactions
                  </p>
                </div>
              </div>
            </Card>
          </Link>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default StockDashboard;