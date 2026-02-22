"use client";

import React, { useState, useEffect, Suspense } from "react";

import api from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";
import RoleProtectedRoute from "@/components/RoleProtectedRoute";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  Package,
  Loader2,
  TrendingUp,
  DollarSign,
  Calendar,
  Truck,
  FileText,
  CheckCircle2,
  PackagePlus,
} from "lucide-react";
import { motion } from "framer-motion";

interface Product {
  id: number;
  name: string;
  sku: string;
  currentStock: number;
}

interface Branch {
  id: number;
  name: string;
  code: string;
}

interface User {
  id: number;
  role: string;
  branchId: number;
  currentBranchId: number | null;
  branch?: Branch;
  currentBranch?: Branch;
}

const AddStockForm = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedProductId = searchParams.get("productId");

  const [products, setProducts] = useState<Product[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeBranch, setActiveBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [formData, setFormData] = useState({
    productId: preselectedProductId || "",
    quantity: "",
    unitCost: "",
    batchNumber: "",
    expiryDate: "",
    supplier: "",
    transactionType: "PURCHASE",
  });

  useEffect(() => {
    fetchCurrentUser();
    fetchProducts();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const res = await api.get("/auth/me");
      setCurrentUser(res.data);

      const branch = res.data.currentBranch || res.data.branch;
      setActiveBranch(branch);
    } catch (error) {
      console.error("Error fetching user:", error);
      toast.error("Failed to fetch user information");
    } finally {
      setFetchLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await api.get("/products");
      setProducts(res.data);
    } catch (error) {
      toast.error("Failed to fetch products");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.productId || !formData.quantity) {
      toast.error("Product and quantity are required");
      return;
    }

    if (!activeBranch) {
      toast.error("No active branch. Please contact administrator.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/stock/add", {
        productId: parseInt(formData.productId),
        quantity: parseInt(formData.quantity),
        unitCost: formData.unitCost ? parseFloat(formData.unitCost) : null,
        batchNumber: formData.batchNumber || null,
        expiryDate: formData.expiryDate || null,
        supplier: formData.supplier || null,
        transactionType: formData.transactionType,
      });

      toast.success(`Stock added successfully to ${activeBranch.name}`);
      router.push("/stock");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Error adding stock");
    } finally {
      setLoading(false);
    }
  };

  const selectedProduct = products.find(
    (p) => p.id === parseInt(formData.productId),
  );

  const totalCost =
    formData.unitCost && formData.quantity
      ? parseFloat(formData.unitCost) * parseInt(formData.quantity)
      : 0;

  const newStock =
    selectedProduct && formData.quantity
      ? selectedProduct.currentStock + parseInt(formData.quantity)
      : 0;

  if (fetchLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-emerald-50 to-green-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <RoleProtectedRoute allowedRoles={["admin"]}>
      <ProtectedRoute>
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50 pb-24">
          <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-4"
            >
              <Link href="/stock">
                <Button
                  variant="outline"
                  size="icon"
                  className="border-emerald-300 hover:bg-emerald-50"
                >
                  <ArrowLeft className="h-5 w-5 text-emerald-600" />
                </Button>
              </Link>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                    <PackagePlus className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                      Add Stock
                    </h1>
                    <p className="text-sm text-gray-600">
                      Record new stock purchases or returns
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Branch Info Card */}
            {activeBranch && (
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
                      <p className="font-semibold text-gray-800">
                        Adding stock to:{" "}
                        <span className="text-emerald-700">
                          {activeBranch.name}
                        </span>
                      </p>
                      <p className="text-sm text-gray-600">
                        Branch Code: {activeBranch.code}
                      </p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="overflow-hidden border-2 border-emerald-100">
                <div className="bg-gradient-to-r from-emerald-50 to-green-50 px-6 py-4 border-b-2 border-emerald-100">
                  <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-emerald-600" />
                    Stock Entry Details
                  </h3>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                  {/* Transaction Type */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-700">
                      Transaction Type
                    </Label>
                    <Select
                      value={formData.transactionType}
                      onValueChange={(value) =>
                        setFormData({ ...formData, transactionType: value })
                      }
                    >
                      <SelectTrigger className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PURCHASE">Purchase</SelectItem>
                        <SelectItem value="RETURN">Return</SelectItem>
                        <SelectItem value="INITIAL_STOCK">
                          Initial Stock
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Product Selection */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-700">
                      Product *
                    </Label>
                    <Select
                      value={formData.productId}
                      onValueChange={(value) =>
                        setFormData({ ...formData, productId: value })
                      }
                    >
                      <SelectTrigger className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200">
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem
                            key={product.id}
                            value={product.id.toString()}
                          >
                            {product.name} ({product.sku}) - Stock:{" "}
                            {product.currentStock}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Current Stock Display */}
                  {selectedProduct && (
                    <div className="p-5 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border-2 border-gray-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                            Current Stock
                          </p>
                          <p className="text-3xl font-bold text-gray-800">
                            {selectedProduct.currentStock}
                          </p>
                        </div>
                        {formData.quantity &&
                          parseInt(formData.quantity) > 0 && (
                            <>
                              <div className="hidden sm:block">
                                <TrendingUp className="h-8 w-8 text-emerald-500" />
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                                  After Addition
                                </p>
                                <p className="text-3xl font-bold text-emerald-600">
                                  {newStock}
                                </p>
                                <p className="text-sm text-emerald-600 font-semibold">
                                  +{formData.quantity}
                                </p>
                              </div>
                            </>
                          )}
                      </div>
                    </div>
                  )}

                  {/* Quantity */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <Package className="h-4 w-4 text-emerald-600" />
                      Quantity *
                    </Label>
                    <Input
                      type="number"
                      min="1"
                      value={formData.quantity}
                      onChange={(e) =>
                        setFormData({ ...formData, quantity: e.target.value })
                      }
                      placeholder="Enter quantity"
                      className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                    />
                  </div>

                  {/* Unit Cost */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-emerald-600" />
                      Unit Cost (₱)
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.unitCost}
                      onChange={(e) =>
                        setFormData({ ...formData, unitCost: e.target.value })
                      }
                      placeholder="0.00"
                      className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                    />
                    {totalCost > 0 && (
                      <div className="p-3 bg-emerald-50 border-2 border-emerald-200 rounded-lg">
                        <p className="text-sm font-semibold text-gray-800">
                          Total Cost:{" "}
                          <span className="text-emerald-600">
                            ₱
                            {totalCost.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Batch Number */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-emerald-600" />
                        Batch Number
                      </Label>
                      <Input
                        value={formData.batchNumber}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            batchNumber: e.target.value,
                          })
                        }
                        placeholder="Optional"
                        className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>

                    {/* Expiry Date */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-emerald-600" />
                        Expiry Date
                      </Label>
                      <Input
                        type="date"
                        value={formData.expiryDate}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            expiryDate: e.target.value,
                          })
                        }
                        min={new Date().toISOString().split("T")[0]}
                        className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>
                  </div>

                  {/* Supplier */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <Truck className="h-4 w-4 text-emerald-600" />
                      Supplier
                    </Label>
                    <Input
                      value={formData.supplier}
                      onChange={(e) =>
                        setFormData({ ...formData, supplier: e.target.value })
                      }
                      placeholder="Enter supplier name (optional)"
                      className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                    />
                  </div>

                  {/* Summary Box */}
                  {formData.productId &&
                    formData.quantity &&
                    parseInt(formData.quantity) > 0 && (
                      <div className="p-5 bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-200 rounded-xl">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="h-8 w-8 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0">
                            <CheckCircle2 className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <p className="font-bold text-gray-800 text-lg">
                              Transaction Summary
                            </p>
                          </div>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Type:</span>
                            <span className="font-semibold text-gray-800">
                              {formData.transactionType}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Quantity:</span>
                            <span className="font-semibold text-gray-800">
                              {formData.quantity} units
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Product:</span>
                            <span className="font-semibold text-gray-800">
                              {selectedProduct?.name}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Branch:</span>
                            <span className="font-semibold text-gray-800">
                              {activeBranch?.name}
                            </span>
                          </div>
                          {totalCost > 0 && (
                            <div className="flex justify-between items-center pt-2 border-t-2 border-emerald-200">
                              <span className="text-gray-600 font-semibold">
                                Total Cost:
                              </span>
                              <span className="font-bold text-emerald-600 text-lg">
                                ₱
                                {totalCost.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                })}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                  {/* Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-4">
                    <Button
                      type="submit"
                      disabled={loading || !activeBranch}
                      className="flex-1 h-12 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-bold shadow-lg"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Adding Stock...
                        </>
                      ) : (
                        <>
                          <PackagePlus className="w-5 h-5 mr-2" />
                          Add Stock
                        </>
                      )}
                    </Button>
                    <Link href="/stock" className="flex-1 sm:flex-none">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full h-12 border-2 border-gray-300 hover:bg-gray-50"
                      >
                        Cancel
                      </Button>
                    </Link>
                  </div>
                </form>
              </Card>
            </motion.div>
          </div>
        </div>
      </ProtectedRoute>
    </RoleProtectedRoute>
  );
};

const AddStockPage = () => {
  return (
    <RoleProtectedRoute allowedRoles={["admin"]}>
      <ProtectedRoute>
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-screen bg-gradient-to-br from-emerald-50 to-green-50">
              <div className="text-center">
                <Loader2 className="h-12 w-12 animate-spin text-emerald-600 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">Loading...</p>
              </div>
            </div>
          }
        >
          <AddStockForm />
        </Suspense>
      </ProtectedRoute>
    </RoleProtectedRoute>
  );
};

export default AddStockPage;
