// app/stock/add/page.tsx
"use client";

import React, { useState, useEffect, Suspense } from "react";
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
import api from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ArrowLeft, Building2, Package } from "lucide-react";
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

// Extract the component that uses useSearchParams
const AddStockForm = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedProductId = searchParams.get("productId");

  const [products, setProducts] = useState<Product[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeBranch, setActiveBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(false);
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
    (p) => p.id === parseInt(formData.productId)
  );

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/stock">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Add Stock</h1>
          <p className="text-sm text-muted-foreground">
            Record new stock purchases or returns
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
                Adding stock to: <strong>{activeBranch.name}</strong>
              </p>
              <p className="text-xs text-blue-700">
                Branch Code: {activeBranch.code}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Form */}
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Transaction Type */}
          <div className="space-y-2">
            <Label>Transaction Type</Label>
            <Select
              value={formData.transactionType}
              onValueChange={(value) =>
                setFormData({ ...formData, transactionType: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PURCHASE">Purchase</SelectItem>
                <SelectItem value="RETURN">Return</SelectItem>
                <SelectItem value="INITIAL_STOCK">Initial Stock</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Product Selection */}
          <div className="space-y-2">
            <Label>Product *</Label>
            <Select
              value={formData.productId}
              onValueChange={(value) =>
                setFormData({ ...formData, productId: value })
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
          {selectedProduct && (
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Current Stock</p>
                  <p className="text-2xl font-bold">{selectedProduct.currentStock}</p>
                </div>
                {formData.quantity && (
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">After Addition</p>
                    <p className="text-2xl font-bold text-green-600">
                      {selectedProduct.currentStock + parseInt(formData.quantity)}
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
              value={formData.quantity}
              onChange={(e) =>
                setFormData({ ...formData, quantity: e.target.value })
              }
              placeholder="Enter quantity"
            />
          </div>

          {/* Unit Cost */}
          <div className="space-y-2">
            <Label>Unit Cost (₱)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={formData.unitCost}
              onChange={(e) =>
                setFormData({ ...formData, unitCost: e.target.value })
              }
              placeholder="0.00"
            />
            {formData.unitCost && formData.quantity && (
              <p className="text-sm text-muted-foreground">
                Total Cost: ₱
                {(parseFloat(formData.unitCost) * parseInt(formData.quantity)).toFixed(2)}
              </p>
            )}
          </div>

          {/* Batch Number */}
          <div className="space-y-2">
            <Label>Batch Number</Label>
            <Input
              value={formData.batchNumber}
              onChange={(e) =>
                setFormData({ ...formData, batchNumber: e.target.value })
              }
              placeholder="Enter batch number (optional)"
            />
          </div>

          {/* Expiry Date */}
          <div className="space-y-2">
            <Label>Expiry Date</Label>
            <Input
              type="date"
              value={formData.expiryDate}
              onChange={(e) =>
                setFormData({ ...formData, expiryDate: e.target.value })
              }
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          {/* Supplier */}
          <div className="space-y-2">
            <Label>Supplier</Label>
            <Input
              value={formData.supplier}
              onChange={(e) =>
                setFormData({ ...formData, supplier: e.target.value })
              }
              placeholder="Enter supplier name (optional)"
            />
          </div>

          {/* Summary Box */}
          {formData.productId && formData.quantity && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm font-medium text-green-900 mb-2">
                Transaction Summary
              </p>
              <div className="space-y-1 text-sm text-green-800">
                <p>
                  <strong>{formData.transactionType}:</strong> {formData.quantity} units
                </p>
                <p>
                  <strong>Product:</strong> {selectedProduct?.name}
                </p>
                <p>
                  <strong>Branch:</strong> {activeBranch?.name}
                </p>
                {formData.unitCost && (
                  <p>
                    <strong>Total Cost:</strong> ₱
                    {(parseFloat(formData.unitCost) * parseInt(formData.quantity)).toFixed(2)}
                  </p>
                )}
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
              {loading ? "Adding..." : "Add Stock"}
            </Button>
            <Link href="/stock">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
};

// Main page component with Suspense boundary
const AddStockPage = () => {
  return (
    <ProtectedRoute>
      <Suspense fallback={<div className="p-6 max-w-2xl mx-auto">Loading...</div>}>
        <AddStockForm />
      </Suspense>
    </ProtectedRoute>
  );
};

export default AddStockPage;