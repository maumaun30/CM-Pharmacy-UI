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
} from "lucide-react";
import Link from "next/link";

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

const StockDashboard = () => {
  const [summary, setSummary] = useState<StockSummary>({
    totalProducts: 0,
    outOfStock: 0,
    lowStock: 0,
    criticalStock: 0,
    recentTransactions: 0,
  });
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

    fetchData();
  }, []);

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
          <h1 className="text-2xl font-bold">Stock Management</h1>
          <div className="flex gap-2">
            <Link href="/stock/add">
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add Stock
              </Button>
            </Link>
            <Link href="/stock/transactions">
              <Button variant="outline">
                <History className="h-4 w-4 mr-2" />
                Transactions
              </Button>
            </Link>
            <Link href="/stock/reports">
              <Button variant="outline">
                <FileText className="h-4 w-4 mr-2" />
                Reports
              </Button>
            </Link>
          </div>
        </div>

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
        {lowStockProducts.length > 0 && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                Products Requiring Attention
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
                <Link href="/stock/low-stock">
                  <Button variant="outline" size="sm">
                    View All {lowStockProducts.length} Products
                  </Button>
                </Link>
              </div>
            )}
          </Card>
        )}
      </div>
    </ProtectedRoute>
  );
};

export default StockDashboard;