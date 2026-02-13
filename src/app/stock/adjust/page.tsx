// app/stock/adjust/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import api from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ArrowLeft, Building2, AlertTriangle } from "lucide-react";
import Link from "next/link";

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
      
      // Determine active branch
      const branch = res.data.currentBranch || res.data.branch;
      setActiveBranch(branch);
    } catch (error) {
      console.error("Error fetching user:", error);
      toast.error("Failed to fetch user information");
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

    if (!adjustFormData.productId || !adjustFormData.quantity || !adjustFormData.reason) {
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
      toast.error(error.response?.data?.message || "Error recording stock loss");
    } finally {
      setLoading(false);
    }
  };

  const selectedAdjustProduct = products.find(
    (p) => p.id === parseInt(adjustFormData.productId)
  );

  const selectedLossProduct = products.find(
    (p) => p.id === parseInt(lossFormData.productId)
  );

  return (
    <ProtectedRoute>
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/stock">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Stock Adjustment & Loss</h1>
            <p className="text-sm text-muted-foreground">
              Manually adjust stock or record damaged/expired items
            </p>
          </div>
        </div>

        {/* Branch Info Card */}
        {activeBranch && (
          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-900">
                  Adjusting stock at: <strong>{activeBranch.name}</strong>
                </p>
                <p className="text-xs text-blue-700">
                  Branch Code: {activeBranch.code}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="adjust">Manual Adjustment</TabsTrigger>
            <TabsTrigger value="loss">Damage/Expired</TabsTrigger>
          </TabsList>

          {/* Adjustment Tab */}
          <TabsContent value="adjust">
            <Card className="p-6">
              <form onSubmit={handleAdjustSubmit} className="space-y-4">
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <AlertTriangle className="h-4 w-4 inline mr-1" />
                    Use this to manually adjust stock levels (positive or negative). 
                    All adjustments are tracked and require a reason.
                  </p>
                </div>

                {/* Product Selection */}
                <div className="space-y-2">
                  <Label>Product *</Label>
                  <Select
                    value={adjustFormData.productId}
                    onValueChange={(value) =>
                      setAdjustFormData({ ...adjustFormData, productId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id.toString()}>
                          {product.name} ({product.sku}) - Current Stock: {product.currentStock}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Current Stock Display */}
                {selectedAdjustProduct && (
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Current Stock</p>
                    <p className="text-2xl font-bold">
                      {selectedAdjustProduct.currentStock}
                    </p>
                  </div>
                )}

                {/* Quantity Adjustment */}
                <div className="space-y-2">
                  <Label>Quantity Adjustment *</Label>
                  <Input
                    type="number"
                    value={adjustFormData.quantity}
                    onChange={(e) =>
                      setAdjustFormData({ ...adjustFormData, quantity: e.target.value })
                    }
                    placeholder="e.g., +10 or -5"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter a positive number to add stock, or a negative number to remove
                  </p>
                </div>

                {/* New Stock Preview */}
                {selectedAdjustProduct && adjustFormData.quantity && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-blue-700">New Stock Level</p>
                        <p className="text-2xl font-bold text-blue-900">
                          {selectedAdjustProduct.currentStock + parseInt(adjustFormData.quantity)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-blue-700">Change</p>
                        <p className={`text-xl font-semibold ${
                          parseInt(adjustFormData.quantity) > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {parseInt(adjustFormData.quantity) > 0 ? '+' : ''}
                          {adjustFormData.quantity}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Reason */}
                <div className="space-y-2">
                  <Label>Reason *</Label>
                  <Textarea
                    value={adjustFormData.reason}
                    onChange={(e) =>
                      setAdjustFormData({ ...adjustFormData, reason: e.target.value })
                    }
                    placeholder="Enter detailed reason for this adjustment (e.g., 'Physical count correction', 'System error fix')"
                    rows={3}
                  />
                </div>

                {/* Summary */}
                {adjustFormData.productId && adjustFormData.quantity && adjustFormData.reason && (
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-sm font-medium text-orange-900 mb-2">
                      Adjustment Summary
                    </p>
                    <div className="space-y-1 text-sm text-orange-800">
                      <p><strong>Product:</strong> {selectedAdjustProduct?.name}</p>
                      <p><strong>Branch:</strong> {activeBranch?.name}</p>
                      <p><strong>Adjustment:</strong> {adjustFormData.quantity} units</p>
                      <p><strong>Reason:</strong> {adjustFormData.reason}</p>
                    </div>
                  </div>
                )}

                {/* Buttons */}
                <div className="flex gap-2 pt-4">
                  <Button 
                    type="submit" 
                    disabled={loading || !activeBranch} 
                    className="flex-1"
                  >
                    {loading ? "Adjusting..." : "Adjust Stock"}
                  </Button>
                  <Link href="/stock">
                    <Button type="button" variant="outline">
                      Cancel
                    </Button>
                  </Link>
                </div>
              </form>
            </Card>
          </TabsContent>

          {/* Loss Tab */}
          <TabsContent value="loss">
            <Card className="p-6">
              <form onSubmit={handleLossSubmit} className="space-y-4">
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">
                    <AlertTriangle className="h-4 w-4 inline mr-1" />
                    Record damaged or expired items to reduce stock. This cannot be undone.
                  </p>
                </div>

                {/* Type Selection */}
                <div className="space-y-2">
                  <Label>Loss Type *</Label>
                  <Select
                    value={lossFormData.transactionType}
                    onValueChange={(value) =>
                      setLossFormData({ ...lossFormData, transactionType: value })
                    }
                  >
                    <SelectTrigger>
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
                  <Label>Product *</Label>
                  <Select
                    value={lossFormData.productId}
                    onValueChange={(value) =>
                      setLossFormData({ ...lossFormData, productId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id.toString()}>
                          {product.name} ({product.sku}) - Current Stock: {product.currentStock}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Current Stock Display */}
                {selectedLossProduct && (
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Current Stock</p>
                        <p className="text-2xl font-bold">
                          {selectedLossProduct.currentStock}
                        </p>
                      </div>
                      {lossFormData.quantity && (
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">After Loss</p>
                          <p className="text-2xl font-bold text-red-600">
                            {Math.max(0, selectedLossProduct.currentStock - parseInt(lossFormData.quantity))}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Quantity */}
                <div className="space-y-2">
                  <Label>Quantity *</Label>
                  <Input
                    type="number"
                    min="1"
                    max={selectedLossProduct?.currentStock}
                    value={lossFormData.quantity}
                    onChange={(e) =>
                      setLossFormData({ ...lossFormData, quantity: e.target.value })
                    }
                    placeholder="Enter quantity to remove"
                  />
                </div>

                {/* Batch Number */}
                <div className="space-y-2">
                  <Label>Batch Number</Label>
                  <Input
                    value={lossFormData.batchNumber}
                    onChange={(e) =>
                      setLossFormData({ ...lossFormData, batchNumber: e.target.value })
                    }
                    placeholder="Enter batch number if applicable (optional)"
                  />
                </div>

                {/* Reason */}
                <div className="space-y-2">
                  <Label>Reason/Notes</Label>
                  <Textarea
                    value={lossFormData.reason}
                    onChange={(e) =>
                      setLossFormData({ ...lossFormData, reason: e.target.value })
                    }
                    placeholder="Enter reason or additional notes (optional)"
                    rows={3}
                  />
                </div>

                {/* Summary */}
                {lossFormData.productId && lossFormData.quantity && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm font-medium text-red-900 mb-2">
                      Loss Summary
                    </p>
                    <div className="space-y-1 text-sm text-red-800">
                      <p><strong>Type:</strong> {lossFormData.transactionType === 'DAMAGE' ? 'Damaged' : 'Expired'}</p>
                      <p><strong>Product:</strong> {selectedLossProduct?.name}</p>
                      <p><strong>Branch:</strong> {activeBranch?.name}</p>
                      <p><strong>Quantity to Remove:</strong> {lossFormData.quantity} units</p>
                      {lossFormData.batchNumber && (
                        <p><strong>Batch:</strong> {lossFormData.batchNumber}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Buttons */}
                <div className="flex gap-2 pt-4">
                  <Button 
                    type="submit" 
                    disabled={loading || !activeBranch}
                    variant="destructive"
                    className="flex-1"
                  >
                    {loading ? "Recording..." : "Record Loss"}
                  </Button>
                  <Link href="/stock">
                    <Button type="button" variant="outline">
                      Cancel
                    </Button>
                  </Link>
                </div>
              </form>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ProtectedRoute>
  );
};

export default StockAdjustPage;