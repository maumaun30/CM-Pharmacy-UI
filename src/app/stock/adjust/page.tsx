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
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface Product {
  id: number;
  name: string;
  sku: string;
  currentStock: number;
}

const StockAdjustPage = () => {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
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
    const fetchProducts = async () => {
      try {
        const res = await api.get("/products");
        setProducts(res.data);
      } catch (error) {
        toast.error("Failed to fetch products");
      }
    };

    fetchProducts();
  }, []);

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!adjustFormData.productId || !adjustFormData.quantity || !adjustFormData.reason) {
      toast.error("All fields are required");
      return;
    }

    setLoading(true);
    try {
      await api.post("/stock/adjust", {
        productId: parseInt(adjustFormData.productId),
        quantity: parseInt(adjustFormData.quantity),
        reason: adjustFormData.reason,
      });

      toast.success("Stock adjusted successfully");
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

    setLoading(true);
    try {
      await api.post("/stock/loss", {
        productId: parseInt(lossFormData.productId),
        quantity: parseInt(lossFormData.quantity),
        transactionType: lossFormData.transactionType,
        reason: lossFormData.reason || null,
        batchNumber: lossFormData.batchNumber || null,
      });

      toast.success("Stock loss recorded successfully");
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
          <div>
            <h1 className="text-2xl font-bold">Stock Adjustment & Loss</h1>
            <p className="text-sm text-muted-foreground">
              Manually adjust stock or record damaged/expired items
            </p>
          </div>
        </div>

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
                <p className="text-sm text-muted-foreground">
                  Use this to manually adjust stock levels (positive or negative)
                </p>

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
                          {product.name} ({product.sku}) - Current: {product.currentStock}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Current Stock Display */}
                {selectedAdjustProduct && (
                  <div className="p-3 bg-muted rounded-lg">
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
                    placeholder="Use + for add, - for subtract (e.g., +10 or -5)"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter a positive number to add stock, or a negative number to remove
                  </p>
                </div>

                {/* New Stock Preview */}
                {selectedAdjustProduct && adjustFormData.quantity && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-muted-foreground">New Stock Level</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {selectedAdjustProduct.currentStock + parseInt(adjustFormData.quantity)}
                    </p>
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
                    placeholder="Enter reason for adjustment"
                    rows={3}
                  />
                </div>

                {/* Buttons */}
                <div className="flex gap-2 pt-4">
                  <Button type="submit" disabled={loading} className="flex-1">
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
                <p className="text-sm text-muted-foreground">
                  Record damaged or expired items to reduce stock
                </p>

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
                          {product.name} ({product.sku}) - Current: {product.currentStock}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Current Stock Display */}
                {selectedLossProduct && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Current Stock</p>
                    <p className="text-2xl font-bold">
                      {selectedLossProduct.currentStock}
                    </p>
                  </div>
                )}

                {/* Quantity */}
                <div className="space-y-2">
                  <Label>Quantity *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={lossFormData.quantity}
                    onChange={(e) =>
                      setLossFormData({ ...lossFormData, quantity: e.target.value })
                    }
                    placeholder="Enter quantity"
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
                    placeholder="Enter batch number if applicable"
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
                    placeholder="Enter reason or additional notes"
                    rows={3}
                  />
                </div>

                {/* Buttons */}
                <div className="flex gap-2 pt-4">
                  <Button type="submit" disabled={loading} className="flex-1">
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