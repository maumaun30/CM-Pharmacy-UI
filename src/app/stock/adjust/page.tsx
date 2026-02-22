"use client";

import React, { useState, useEffect } from "react";

import api from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";
import RoleProtectedRoute from "@/components/RoleProtectedRoute";

import { useRouter } from "next/navigation";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  AlertTriangle,
  Loader2,
  Package,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  Trash2,
  FileText,
  XCircle,
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

const StockAdjustPage = () => {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeBranch, setActiveBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("adjust");

  const [adjustFormData, setAdjustFormData] = useState({
    productId: "",
    quantity: "",
    reason: "",
  });

  const [lossFormData, setLossFormData] = useState({
    productId: "",
    quantity: "",
    transactionType: "DAMAGE",
    reason: "",
    batchNumber: "",
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

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !adjustFormData.productId ||
      !adjustFormData.quantity ||
      !adjustFormData.reason
    ) {
      toast.error("All fields are required");
      return;
    }

    if (!activeBranch) {
      toast.error("No active branch. Please contact administrator.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/stock/adjust", {
        productId: parseInt(adjustFormData.productId),
        quantity: parseInt(adjustFormData.quantity),
        reason: adjustFormData.reason,
      });

      toast.success(`Stock adjusted successfully at ${activeBranch.name}`);
      router.push("/stock");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Error adjusting stock");
    } finally {
      setLoading(false);
    }
  };

  const handleLossSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!lossFormData.productId || !lossFormData.quantity) {
      toast.error("Product and quantity are required");
      return;
    }

    if (!activeBranch) {
      toast.error("No active branch. Please contact administrator.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/stock/loss", {
        productId: parseInt(lossFormData.productId),
        quantity: parseInt(lossFormData.quantity),
        transactionType: lossFormData.transactionType,
        reason: lossFormData.reason || null,
        batchNumber: lossFormData.batchNumber || null,
      });

      toast.success(`Stock loss recorded successfully at ${activeBranch.name}`);
      router.push("/stock");
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Error recording stock loss",
      );
    } finally {
      setLoading(false);
    }
  };

  const selectedAdjustProduct = products.find(
    (p) => p.id === parseInt(adjustFormData.productId),
  );

  const selectedLossProduct = products.find(
    (p) => p.id === parseInt(lossFormData.productId),
  );

  const adjustQuantity = parseInt(adjustFormData.quantity) || 0;
  const newAdjustStock = selectedAdjustProduct
    ? selectedAdjustProduct.currentStock + adjustQuantity
    : 0;

  const lossQuantity = parseInt(lossFormData.quantity) || 0;
  const newLossStock = selectedLossProduct
    ? Math.max(0, selectedLossProduct.currentStock - lossQuantity)
    : 0;

  if (fetchLoading) {
    return (
      <RoleProtectedRoute allowedRoles={["admin"]}>
        <ProtectedRoute>
          <div className="flex items-center justify-center h-screen bg-gradient-to-br from-emerald-50 to-green-50">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-emerald-600 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">Loading...</p>
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
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                      Stock Adjustment & Loss
                    </h1>
                    <p className="text-sm text-gray-600">
                      Manually adjust stock or record damaged/expired items
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
                        Adjusting stock at:{" "}
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

            {/* Tabs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2 h-12 bg-white border-2 border-emerald-200">
                  <TabsTrigger
                    value="adjust"
                    className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-green-600 data-[state=active]:text-white font-semibold"
                  >
                    <Package className="h-4 w-4 mr-2" />
                    Manual Adjustment
                  </TabsTrigger>
                  <TabsTrigger
                    value="loss"
                    className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-orange-500 data-[state=active]:text-white font-semibold"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Damage/Expired
                  </TabsTrigger>
                </TabsList>

                {/* Adjustment Tab */}
                <TabsContent value="adjust" className="mt-6">
                  <Card className="overflow-hidden border-2 border-emerald-100">
                    <div className="bg-gradient-to-r from-emerald-50 to-green-50 px-6 py-4 border-b-2 border-emerald-100">
                      <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Package className="h-5 w-5 text-emerald-600" />
                        Stock Adjustment Form
                      </h3>
                    </div>

                    <form
                      onSubmit={handleAdjustSubmit}
                      className="p-6 space-y-6"
                    >
                      <div className="p-4 bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-xl">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-amber-800">
                            <p className="font-semibold mb-1">
                              Important Notice
                            </p>
                            <p>
                              Use this to manually adjust stock levels (positive
                              or negative). All adjustments are tracked and
                              require a reason.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Product Selection */}
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-700">
                          Product *
                        </Label>
                        <Select
                          value={adjustFormData.productId}
                          onValueChange={(value) =>
                            setAdjustFormData({
                              ...adjustFormData,
                              productId: value,
                            })
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
                      {selectedAdjustProduct && (
                        <div className="p-5 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border-2 border-gray-200">
                          <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
                            Current Stock Level
                          </p>
                          <p className="text-3xl font-bold text-gray-800">
                            {selectedAdjustProduct.currentStock}
                          </p>
                        </div>
                      )}

                      {/* Quantity Adjustment */}
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-700">
                          Quantity Adjustment *
                        </Label>
                        <Input
                          type="number"
                          value={adjustFormData.quantity}
                          onChange={(e) =>
                            setAdjustFormData({
                              ...adjustFormData,
                              quantity: e.target.value,
                            })
                          }
                          placeholder="e.g., +10 or -5"
                          className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                        />
                        <p className="text-xs text-gray-600 flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          Enter a positive number to add stock, or a negative
                          number to remove
                        </p>
                      </div>

                      {/* New Stock Preview */}
                      {selectedAdjustProduct && adjustFormData.quantity && (
                        <div
                          className={`p-5 rounded-xl border-2 ${
                            adjustQuantity > 0
                              ? "bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200"
                              : "bg-gradient-to-r from-red-50 to-orange-50 border-red-200"
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                              <p
                                className={`text-sm font-semibold uppercase tracking-wide ${
                                  adjustQuantity > 0
                                    ? "text-emerald-700"
                                    : "text-red-700"
                                }`}
                              >
                                New Stock Level
                              </p>
                              <p
                                className={`text-3xl font-bold ${
                                  adjustQuantity > 0
                                    ? "text-emerald-700"
                                    : "text-red-700"
                                }`}
                              >
                                {newAdjustStock}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              {adjustQuantity > 0 ? (
                                <TrendingUp className="h-8 w-8 text-emerald-500" />
                              ) : (
                                <TrendingDown className="h-8 w-8 text-red-500" />
                              )}
                              <div className="text-right">
                                <p className="text-sm font-semibold text-gray-600 uppercase">
                                  Change
                                </p>
                                <p
                                  className={`text-2xl font-bold ${
                                    adjustQuantity > 0
                                      ? "text-emerald-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  {adjustQuantity > 0 ? "+" : ""}
                                  {adjustFormData.quantity}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Reason */}
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                          <FileText className="h-4 w-4 text-emerald-600" />
                          Reason *
                        </Label>
                        <Textarea
                          value={adjustFormData.reason}
                          onChange={(e) =>
                            setAdjustFormData({
                              ...adjustFormData,
                              reason: e.target.value,
                            })
                          }
                          placeholder="Enter detailed reason for this adjustment (e.g., 'Physical count correction', 'System error fix')"
                          rows={3}
                          className="border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                        />
                      </div>

                      {/* Summary */}
                      {adjustFormData.productId &&
                        adjustFormData.quantity &&
                        adjustFormData.reason && (
                          <div className="p-5 bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-200 rounded-xl">
                            <p className="font-bold text-gray-800 text-lg mb-3 flex items-center gap-2">
                              <AlertCircle className="h-5 w-5 text-orange-600" />
                              Adjustment Summary
                            </p>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Product:</span>
                                <span className="font-semibold text-gray-800">
                                  {selectedAdjustProduct?.name}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Branch:</span>
                                <span className="font-semibold text-gray-800">
                                  {activeBranch?.name}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">
                                  Adjustment:
                                </span>
                                <span
                                  className={`font-bold ${
                                    adjustQuantity > 0
                                      ? "text-emerald-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  {adjustQuantity > 0 ? "+" : ""}
                                  {adjustFormData.quantity} units
                                </span>
                              </div>
                              <div className="pt-2 border-t-2 border-orange-200">
                                <p className="text-gray-600 font-semibold mb-1">
                                  Reason:
                                </p>
                                <p className="text-gray-800">
                                  {adjustFormData.reason}
                                </p>
                              </div>
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
                              Adjusting...
                            </>
                          ) : (
                            <>
                              <Package className="w-5 h-5 mr-2" />
                              Adjust Stock
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
                </TabsContent>

                {/* Loss Tab */}
                <TabsContent value="loss" className="mt-6">
                  <Card className="overflow-hidden border-2 border-red-100">
                    <div className="bg-gradient-to-r from-red-50 to-orange-50 px-6 py-4 border-b-2 border-red-100">
                      <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Trash2 className="h-5 w-5 text-red-600" />
                        Stock Loss Record
                      </h3>
                    </div>

                    <form onSubmit={handleLossSubmit} className="p-6 space-y-6">
                      <div className="p-4 bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200 rounded-xl">
                        <div className="flex items-start gap-3">
                          <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-red-800">
                            <p className="font-semibold mb-1">Warning</p>
                            <p>
                              Record damaged or expired items to reduce stock.
                              This action cannot be undone.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Type Selection */}
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-700">
                          Loss Type *
                        </Label>
                        <Select
                          value={lossFormData.transactionType}
                          onValueChange={(value) =>
                            setLossFormData({
                              ...lossFormData,
                              transactionType: value,
                            })
                          }
                        >
                          <SelectTrigger className="h-11 border-red-200 focus:border-red-500 focus:ring-2 focus:ring-red-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="DAMAGE">Damaged</SelectItem>
                            <SelectItem value="EXPIRED">Expired</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Product Selection */}
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-700">
                          Product *
                        </Label>
                        <Select
                          value={lossFormData.productId}
                          onValueChange={(value) =>
                            setLossFormData({
                              ...lossFormData,
                              productId: value,
                            })
                          }
                        >
                          <SelectTrigger className="h-11 border-red-200 focus:border-red-500 focus:ring-2 focus:ring-red-200">
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
                      {selectedLossProduct && (
                        <div className="p-5 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border-2 border-gray-200">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                                Current Stock
                              </p>
                              <p className="text-3xl font-bold text-gray-800">
                                {selectedLossProduct.currentStock}
                              </p>
                            </div>
                            {lossFormData.quantity && lossQuantity > 0 && (
                              <>
                                <TrendingDown className="hidden sm:block h-8 w-8 text-red-500" />
                                <div className="text-right">
                                  <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                                    After Loss
                                  </p>
                                  <p className="text-3xl font-bold text-red-600">
                                    {newLossStock}
                                  </p>
                                  <p className="text-sm text-red-600 font-semibold">
                                    -{lossFormData.quantity}
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
                          <Package className="h-4 w-4 text-red-600" />
                          Quantity *
                        </Label>
                        <Input
                          type="number"
                          min="1"
                          max={selectedLossProduct?.currentStock}
                          value={lossFormData.quantity}
                          onChange={(e) =>
                            setLossFormData({
                              ...lossFormData,
                              quantity: e.target.value,
                            })
                          }
                          placeholder="Enter quantity to remove"
                          className="h-11 border-red-200 focus:border-red-500 focus:ring-2 focus:ring-red-200"
                        />
                      </div>

                      {/* Batch Number */}
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                          <FileText className="h-4 w-4 text-red-600" />
                          Batch Number
                        </Label>
                        <Input
                          value={lossFormData.batchNumber}
                          onChange={(e) =>
                            setLossFormData({
                              ...lossFormData,
                              batchNumber: e.target.value,
                            })
                          }
                          placeholder="Optional"
                          className="h-11 border-red-200 focus:border-red-500 focus:ring-2 focus:ring-red-200"
                        />
                      </div>

                      {/* Reason */}
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-700">
                          Reason/Notes
                        </Label>
                        <Textarea
                          value={lossFormData.reason}
                          onChange={(e) =>
                            setLossFormData({
                              ...lossFormData,
                              reason: e.target.value,
                            })
                          }
                          placeholder="Enter reason or additional notes (optional)"
                          rows={3}
                          className="border-red-200 focus:border-red-500 focus:ring-2 focus:ring-red-200"
                        />
                      </div>

                      {/* Summary */}
                      {lossFormData.productId &&
                        lossFormData.quantity &&
                        lossQuantity > 0 && (
                          <div className="p-5 bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200 rounded-xl">
                            <p className="font-bold text-gray-800 text-lg mb-3 flex items-center gap-2">
                              <Trash2 className="h-5 w-5 text-red-600" />
                              Loss Summary
                            </p>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Type:</span>
                                <span className="font-semibold text-gray-800">
                                  {lossFormData.transactionType === "DAMAGE"
                                    ? "Damaged"
                                    : "Expired"}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Product:</span>
                                <span className="font-semibold text-gray-800">
                                  {selectedLossProduct?.name}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Branch:</span>
                                <span className="font-semibold text-gray-800">
                                  {activeBranch?.name}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">
                                  Quantity to Remove:
                                </span>
                                <span className="font-bold text-red-600">
                                  {lossFormData.quantity} units
                                </span>
                              </div>
                              {lossFormData.batchNumber && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Batch:</span>
                                  <span className="font-semibold text-gray-800">
                                    {lossFormData.batchNumber}
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
                          variant="destructive"
                          className="flex-1 h-12 bg-red-600 hover:bg-red-700 font-bold shadow-lg"
                        >
                          {loading ? (
                            <>
                              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                              Recording...
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-5 h-5 mr-2" />
                              Record Loss
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
                </TabsContent>
              </Tabs>
            </motion.div>
          </div>
        </div>
      </ProtectedRoute>
    </RoleProtectedRoute>
  );
};

export default StockAdjustPage;
