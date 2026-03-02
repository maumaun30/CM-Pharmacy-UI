"use client";

import { useEffect, useState, useMemo } from "react";

import api from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";
import RoleProtectedRoute from "@/components/RoleProtectedRoute";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Pencil,
  Trash,
  ToggleLeft,
  ToggleRight,
  Package,
  AlertTriangle,
  FileText,
  Calendar,
  Search,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Building2,
  ArrowRightLeft,
  Download,
  Upload,
  CheckSquare,
  Square,
  XSquare,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import dayjs from "dayjs";
import { motion } from "framer-motion";

interface Category {
  id: number;
  name: string;
}

interface Branch {
  id: number;
  name: string;
  code: string;
}

interface BranchStock {
  id: number;
  branchId: number;
  currentStock: number;
  minimumStock: number;
  maximumStock?: number;
  reorderPoint: number;
  branch: Branch;
}

interface Product {
  id: number;
  name: string;
  brandName: string;
  genericName?: string;
  sku: string;
  cost: number;
  price: number;
  dosage?: string;
  form?: string;
  expiryDate?: string;
  barcode?: string;
  requiresPrescription: boolean;
  status: "ACTIVE" | "INACTIVE";
  categoryId: number;
  category: Category;
  branchStocks: BranchStock[];
  totalStock: number;
  marginPercentage?: number;
  marginAmount?: number;
}

export default function ProductList() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    brandName: "",
    genericName: "",
    sku: "",
    barcode: "",
    cost: "",
    price: "",
    dosage: "",
    form: "",
    expiryDate: "",
    requiresPrescription: false,
    status: "ACTIVE" as "ACTIVE" | "INACTIVE",
    categoryId: "",
  });
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [importLoading, setImportLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<keyof Product>("id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [selectedProductForStock, setSelectedProductForStock] =
    useState<Product | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const [filterCategory, setFilterCategory] = useState<number | null>(null);
  const [bulkEditCategoryOpen, setBulkEditCategoryOpen] = useState(false);
  const [bulkEditCategoryId, setBulkEditCategoryId] = useState("");

  const [filterStatus, setFilterStatus] = useState<"" | "ACTIVE" | "INACTIVE">(
    "",
  );
  const [filterStockStatus, setFilterStockStatus] = useState<
    "" | "out" | "low" | "in"
  >("");

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paginated.forEach((p) => next.delete(p.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paginated.forEach((p) => next.add(p.id));
        return next;
      });
    }
  };

  const toggleSelectOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleExportCSV = () => {
    const rows = filtered.map((p) => ({
      ID: p.id,
      Name: p.name,
      "Brand Name": p.brandName,
      "Generic Name": p.genericName || "",
      SKU: p.sku,
      Barcode: p.barcode || "",
      Cost: p.cost.toFixed(2),
      Price: p.price.toFixed(2),
      Dosage: p.dosage || "",
      Form: p.form || "",
      Category: p.category?.name || "",
      "Requires Prescription": p.requiresPrescription ? "Yes" : "No",
      Status: p.status,
      "Expiry Date": p.expiryDate
        ? dayjs(p.expiryDate).format("YYYY-MM-DD")
        : "",
      "Total Stock": p.totalStock,
    }));

    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map(
            (h) =>
              `"${String(row[h as keyof typeof row]).replace(/"/g, '""')}"`,
          )
          .join(","),
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `products_${dayjs().format("YYYY-MM-DD")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} products`);
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      setImportLoading(true);
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter(Boolean);

        const parseCSVLine = (line: string): string[] => {
          const result: string[] = [];
          let current = "";
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
              } else {
                inQuotes = !inQuotes;
              }
            } else if (char === "," && !inQuotes) {
              result.push(current.trim());
              current = "";
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        };

        const headers = parseCSVLine(lines[0]).map((h) =>
          h.replace(/"/g, "").trim(),
        );

        const getValue = (row: string[], key: string) => {
          const idx = headers.indexOf(key);
          return idx >= 0 ? (row[idx]?.replace(/"/g, "").trim() ?? "") : "";
        };

        const parsedProducts = lines.slice(1).map((line) => {
          const row = parseCSVLine(line);
          return {
            name: getValue(row, "Name"),
            brandName: getValue(row, "Brand Name"),
            genericName: getValue(row, "Generic Name") || null,
            sku: getValue(row, "SKU"),
            barcode: getValue(row, "Barcode") || undefined,
            cost: parseFloat(getValue(row, "Cost")) || 0,
            price: parseFloat(getValue(row, "Price")) || 0,
            dosage: getValue(row, "Dosage") || null,
            form: getValue(row, "Form") || null,
            expiryDate: getValue(row, "Expiry Date") || null,
            requiresPrescription:
              getValue(row, "Requires Prescription") === "Yes",
            status:
              (getValue(row, "Status") as "ACTIVE" | "INACTIVE") || "ACTIVE",
            categoryName: getValue(row, "Category"),
          };
        });

        // Build a set of existing SKUs to skip duplicates
        const existingSkus = new Set(products.map((p) => p.sku));

        let success = 0;
        let skipped = 0;
        let failed = 0;

        for (const product of parsedProducts) {
          if (!product.name || !product.sku) {
            failed++;
            continue;
          }

          // Skip already-existing SKUs instead of failing
          if (existingSkus.has(product.sku)) {
            skipped++;
            continue;
          }

          let matchedCat = categories.find(
            (c) => c.name.toLowerCase() === product.categoryName.toLowerCase(),
          );
          if (!matchedCat) {
            if (!product.categoryName) {
              failed++;
              continue;
            }
            try {
              // Create the category on the fly
              const res = await api.post("/categories", {
                name: product.categoryName,
              });
              matchedCat = res.data;
              // Add to local categories so subsequent products reuse it
              setCategories((prev) => [...prev, res.data]);
              categories.push(res.data); // also update the local ref used in this loop
            } catch {
              failed++;
              continue;
            }
          }

          try {
            const { categoryName, ...productData } = product;
            if (matchedCat) {
              await api.post("/products", {
                ...productData,
                categoryId: matchedCat.id,
              });
            } else {
              // Handle the error: category was not found
              console.error("Category not found");
              // Optional: throw error or alert user
            }

            // Add to local set so duplicates within the CSV itself are also caught
            existingSkus.add(product.sku);
            success++;
          } catch (err: any) {
            // If it's a duplicate SKU/barcode error from server, count as skipped
            const msg = err.response?.data?.message || "";
            if (msg.includes("already exists")) {
              skipped++;
            } else {
              failed++;
            }
          }
        }

        const parts = [`Imported ${success} products`];
        if (skipped > 0) parts.push(`${skipped} skipped (already exist)`);
        if (failed > 0) parts.push(`${failed} failed`);
        toast.success(parts.join(", "));
        fetchProducts();
      } catch (err: any) {
        const msg = err.response?.data?.message || "";
        if (msg.includes("already exists")) {
          skipped++;
        } else {
          console.error(
            `Failed: ${product.name} (SKU: ${product.sku}) — ${msg}`,
          );
          failed++;
        }
      } finally {
        setImportLoading(false);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const fetchProducts = async () => {
    try {
      setFetchLoading(true);
      const params: any = {};
      if (selectedBranch) {
        params.branchId = selectedBranch;
      }

      const res = await api.get("/products", { params });
      const parsed = res.data.map((p: any) => ({
        ...p,
        cost: parseFloat(p.cost),
        price: parseFloat(p.price),
        totalStock: p.totalStock || 0,
        requiresPrescription: Boolean(p.requiresPrescription),
      }));
      setProducts(parsed);
    } catch (err) {
      toast.error("Failed to fetch products");
    } finally {
      setFetchLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get("/categories");
      setCategories(res.data);
    } catch {
      toast.error("Failed to load categories");
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await api.get("/branches");
      setBranches(res.data);
    } catch {
      toast.error("Failed to load branches");
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchBranches();
  }, [selectedBranch]);

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        brandName: product.brandName,
        genericName: product.genericName || "",
        sku: product.sku,
        barcode: product.barcode || "",
        cost: product.cost.toString(),
        price: product.price.toString(),
        dosage: product.dosage || "",
        form: product.form || "",
        expiryDate: product.expiryDate
          ? dayjs(product.expiryDate).format("YYYY-MM-DD")
          : "",
        requiresPrescription: product.requiresPrescription || false,
        status: product.status,
        categoryId: product.categoryId.toString(),
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: "",
        brandName: "",
        genericName: "",
        sku: "",
        barcode: "",
        cost: "",
        price: "",
        dosage: "",
        form: "",
        expiryDate: "",
        requiresPrescription: false,
        status: "ACTIVE",
        categoryId: "",
      });
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingProduct(null);
  };

  const handleSubmit = async () => {
    const {
      name,
      brandName,
      genericName,
      sku,
      barcode,
      cost,
      price,
      dosage,
      form,
      expiryDate,
      requiresPrescription,
      status,
      categoryId,
    } = formData;

    if (!name || !brandName || !sku || !cost || !price || !categoryId) {
      return toast.error(
        "Name, Brand Name, SKU, Cost, Price and Category are required",
      );
    }

    try {
      setLoading(true);
      const payload = {
        name,
        brandName,
        genericName: genericName || null,
        sku,
        barcode: formData.barcode || null,
        cost: parseFloat(cost),
        price: parseFloat(price),
        dosage: dosage || null,
        form: form || null,
        expiryDate: expiryDate || null,
        requiresPrescription,
        status,
        categoryId: parseInt(categoryId),
      };

      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, payload);
        toast.success("Product updated successfully");
      } else {
        await api.post("/products", payload);
        toast.success("Product created successfully");
      }
      handleCloseModal();
      fetchProducts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Error saving product");
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;

    try {
      await api.delete(`/products/${productToDelete.id}`);
      toast.success("Product deleted successfully");
      fetchProducts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Error deleting product");
    } finally {
      setDeleteOpen(false);
      setProductToDelete(null);
    }
  };

  const handleBulkDelete = async () => {
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) => api.delete(`/products/${id}`)),
      );
      toast.success(`Deleted ${selectedIds.size} products`);
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      fetchProducts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Error deleting products");
    }
  };

  const toggleProductStatus = async (product: Product) => {
    try {
      await api.patch(`/products/${product.id}/toggle-status`);
      toast.success(
        `Product ${product.status === "ACTIVE" ? "deactivated" : "activated"}`,
      );
      fetchProducts();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Error toggling product status",
      );
    }
  };

  const calculateMargin = (price: number, cost: number) => {
    if (cost === 0) return 0;
    return ((price - cost) / cost) * 100;
  };

  const getStockForBranch = (product: Product, branchId: number | null) => {
    if (!branchId) {
      return product.totalStock || 0;
    }
    const branchStock = product.branchStocks?.find(
      (bs) => bs.branchId === branchId,
    );
    return branchStock?.currentStock || 0;
  };

  const getStockStatus = (product: Product, branchId: number | null) => {
    if (!branchId) {
      // Overall stock status
      const totalStock = product.totalStock || 0;
      if (totalStock === 0) {
        return {
          label: "Out of Stock",
          color: "bg-red-100 text-red-800 border-red-200",
        };
      }
      // Check if any branch is low
      const hasLowStock = product.branchStocks?.some(
        (bs) => bs.currentStock > 0 && bs.currentStock <= bs.reorderPoint,
      );
      if (hasLowStock) {
        return {
          label: "Low in Some Branches",
          color: "bg-yellow-100 text-yellow-800 border-yellow-200",
        };
      }
      return {
        label: "In Stock",
        color: "bg-emerald-100 text-emerald-800 border-emerald-200",
      };
    }

    const branchStock = product.branchStocks?.find(
      (bs) => bs.branchId === branchId,
    );
    if (!branchStock) {
      return {
        label: "Not Available",
        color: "bg-gray-100 text-gray-800 border-gray-200",
      };
    }

    const stock = branchStock.currentStock || 0;
    const reorder = branchStock.reorderPoint || 20;
    const minimum = branchStock.minimumStock || 10;

    if (stock === 0) {
      return {
        label: "Out of Stock",
        color: "bg-red-100 text-red-800 border-red-200",
      };
    }
    if (stock <= minimum) {
      return {
        label: "Critical",
        color: "bg-orange-100 text-orange-800 border-orange-200",
      };
    }
    if (stock <= reorder) {
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

  const isExpiringSoon = (expiryDate?: string) => {
    if (!expiryDate) return false;
    const today = dayjs();
    const expiry = dayjs(expiryDate);
    const daysUntilExpiry = expiry.diff(today, "days");
    return daysUntilExpiry <= 30 && daysUntilExpiry >= 0;
  };

  const isExpired = (expiryDate?: string) => {
    if (!expiryDate) return false;
    return dayjs(expiryDate).isBefore(dayjs());
  };

  const filtered = useMemo(() => {
    let data = products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.brandName.toLowerCase().includes(search.toLowerCase()) ||
        p.genericName?.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase()) ||
        p.category?.name.toLowerCase().includes(search.toLowerCase());

      const matchesCategory =
        !filterCategory || p.categoryId === filterCategory;

      const matchesStatus = !filterStatus || p.status === filterStatus;

      const matchesStockStatus = (() => {
        if (!filterStockStatus) return true;
        const stock = getStockForBranch(p, selectedBranch);
        const reorderPoint = selectedBranch
          ? (p.branchStocks?.find((bs) => bs.branchId === selectedBranch)
              ?.reorderPoint ?? 20)
          : Math.min(...(p.branchStocks?.map((bs) => bs.reorderPoint) ?? [20]));
        if (filterStockStatus === "out") return stock === 0;
        if (filterStockStatus === "low")
          return stock > 0 && stock <= reorderPoint;
        if (filterStockStatus === "in") return stock > reorderPoint;
        return true;
      })();

      return (
        matchesSearch && matchesCategory && matchesStatus && matchesStockStatus
      );
    });

    data = data.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      return sortDir === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
    return data;
  }, [
    products,
    search,
    sortBy,
    sortDir,
    filterCategory,
    filterStatus,
    filterStockStatus,
    selectedBranch,
  ]);

  const paginated = useMemo(() => {
    const start = (page - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, page, perPage]);

  const totalPages = Math.ceil(filtered.length / perPage);

  const allSelected =
    paginated.length > 0 && paginated.every((p) => selectedIds.has(p.id));
  const someSelected = selectedIds.size > 0;

  const handleSort = (key: keyof Product) => {
    if (sortBy === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  const handleBulkEditCategory = async () => {
    if (!bulkEditCategoryId) return;
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          api.put(`/products/${id}`, {
            categoryId: parseInt(bulkEditCategoryId),
          }),
        ),
      );
      toast.success(`Updated category for ${selectedIds.size} products`);
      setSelectedIds(new Set());
      setBulkEditCategoryOpen(false);
      setBulkEditCategoryId("");
      fetchProducts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Error updating categories");
    }
  };

  const activeCount = products.filter((p) => p.status === "ACTIVE").length;
  const lowStockCount = selectedBranch
    ? products.filter((p) => {
        const branchStock = p.branchStocks?.find(
          (bs) => bs.branchId === selectedBranch,
        );
        return (
          branchStock && branchStock.currentStock <= branchStock.reorderPoint
        );
      }).length
    : products.filter((p) =>
        p.branchStocks?.some((bs) => bs.currentStock <= bs.reorderPoint),
      ).length;

  const totalValue = products.reduce((sum, p) => {
    const stock = selectedBranch
      ? getStockForBranch(p, selectedBranch)
      : p.totalStock;
    return sum + p.price * stock;
  }, 0);

  if (fetchLoading) {
    return (
      <RoleProtectedRoute allowedRoles={["admin"]}>
        <ProtectedRoute>
          <div className="flex items-center justify-center h-screen bg-gradient-to-br from-emerald-50 to-green-50">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-emerald-600 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">Loading products...</p>
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
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg">
                  <ShoppingBag className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                    Products
                  </h1>
                  <p className="text-sm text-gray-600">
                    Manage your product inventory across branches
                  </p>
                </div>
              </div>
              <div className="flex gap-2 self-start sm:self-auto">
                <Link href="/stock">
                  <Button
                    variant="outline"
                    className="border-emerald-300 hover:bg-emerald-50"
                  >
                    <Package className="h-4 w-4 mr-2" />
                    Stock Management
                  </Button>
                </Link>
                <Button
                  onClick={() => handleOpenModal()}
                  className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold shadow-lg"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              </div>
            </motion.div>

            {/* Import/Export + Bulk Actions Bar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 }}
            >
              <Card className="p-3 border-2 border-emerald-100">
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportCSV}
                      className="border-emerald-300 hover:bg-emerald-50 h-9"
                    >
                      <Download className="h-4 w-4 mr-2 text-emerald-600" />
                      Export CSV
                    </Button>
                    <label
                      className={
                        importLoading ? "pointer-events-none opacity-60" : ""
                      }
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-emerald-300 hover:bg-emerald-50 h-9 cursor-pointer"
                        disabled={importLoading}
                        asChild
                      >
                        <span>
                          {importLoading ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 text-emerald-600 animate-spin" />
                              Importing...
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-2 text-emerald-600" />
                              Import CSV
                            </>
                          )}
                        </span>
                      </Button>
                      <input
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={handleImportCSV}
                        disabled={importLoading}
                      />
                    </label>
                  </div>

                  {someSelected && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-3"
                    >
                      <span className="text-sm font-semibold text-gray-700">
                        {selectedIds.size} selected
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedIds(new Set())}
                        className="border-gray-300 hover:bg-gray-50 h-9"
                      >
                        <XSquare className="h-4 w-4 mr-1" />
                        Clear
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setBulkEditCategoryOpen(true)}
                        className="border-emerald-300 hover:bg-emerald-50 h-9"
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit Category
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setBulkDeleteOpen(true)}
                        className="bg-red-600 hover:bg-red-700 text-white h-9"
                      >
                        <Trash className="h-4 w-4 mr-1" />
                        Delete Selected
                      </Button>
                    </motion.div>
                  )}
                </div>
              </Card>
            </motion.div>

            {/* Branch Filter */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              <Card className="p-4 border-2 border-emerald-100">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-emerald-600" />
                  <Label className="font-semibold text-gray-700">
                    Filter by Branch:
                  </Label>
                  <select
                    value={selectedBranch || ""}
                    onChange={(e) => {
                      setSelectedBranch(
                        e.target.value ? Number(e.target.value) : null,
                      );
                      setPage(1);
                    }}
                    className="border-2 border-emerald-200 rounded-lg px-3 py-2 text-sm font-medium focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"
                  >
                    <option value="">All Branches</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name} ({branch.code})
                      </option>
                    ))}
                  </select>
                </div>
              </Card>
            </motion.div>

            {/* Stats Cards */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
            >
              <Card className="p-5 border-2 border-emerald-100 hover:border-emerald-300 hover:shadow-lg transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                      Total Products
                    </p>
                    <p className="text-3xl font-bold text-gray-800 mt-1">
                      {products.length}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                    <ShoppingBag className="h-6 w-6 text-white" />
                  </div>
                </div>
              </Card>

              <Card className="p-5 border-2 border-emerald-100 hover:border-emerald-300 hover:shadow-lg transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                      Active
                    </p>
                    <p className="text-3xl font-bold text-emerald-600 mt-1">
                      {activeCount}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                    <ToggleRight className="h-6 w-6 text-white" />
                  </div>
                </div>
              </Card>

              <Card className="p-5 border-2 border-orange-100 hover:border-orange-300 hover:shadow-lg transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                      Low Stock
                    </p>
                    <p className="text-3xl font-bold text-orange-600 mt-1">
                      {lowStockCount}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-orange-500 flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-white" />
                  </div>
                </div>
              </Card>

              <Card className="p-5 border-2 border-emerald-100 hover:border-emerald-300 hover:shadow-lg transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                      Inventory Value
                    </p>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">
                      ₱
                      {totalValue.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-white" />
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Search and Controls */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="p-4 border-2 border-emerald-100">
                <div className="flex flex-col gap-3">
                  {/* Search row */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      placeholder="Search by name, brand, generic, SKU, or category..."
                      className="pl-10 h-12 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                      value={search}
                      onChange={(e) => {
                        setPage(1);
                        setSearch(e.target.value);
                      }}
                    />
                  </div>

                  {/* Filters row */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Category Filter */}
                    <select
                      value={filterCategory || ""}
                      onChange={(e) => {
                        setFilterCategory(
                          e.target.value ? Number(e.target.value) : null,
                        );
                        setPage(1);
                      }}
                      className="border-2 border-emerald-200 rounded-lg px-3 py-2 text-sm font-medium focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"
                    >
                      <option value="">All Categories</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>

                    {/* Status Filter */}
                    <select
                      value={filterStatus}
                      onChange={(e) => {
                        setFilterStatus(
                          e.target.value as "" | "ACTIVE" | "INACTIVE",
                        );
                        setPage(1);
                      }}
                      className="border-2 border-emerald-200 rounded-lg px-3 py-2 text-sm font-medium focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"
                    >
                      <option value="">All Statuses</option>
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>

                    {/* Stock Status Filter */}
                    <select
                      value={filterStockStatus}
                      onChange={(e) => {
                        setFilterStockStatus(
                          e.target.value as "" | "out" | "low" | "in",
                        );
                        setPage(1);
                      }}
                      className="border-2 border-emerald-200 rounded-lg px-3 py-2 text-sm font-medium focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"
                    >
                      <option value="">All Stock</option>
                      <option value="out">Out of Stock</option>
                      <option value="low">Low Stock</option>
                      <option value="in">In Stock</option>
                    </select>

                    {/* Clear filters button — only shown when any filter is active */}
                    {(filterCategory ||
                      filterStatus ||
                      filterStockStatus ||
                      search) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFilterCategory(null);
                          setFilterStatus("");
                          setFilterStockStatus("");
                          setSearch("");
                          setPage(1);
                        }}
                        className="border-red-200 text-red-600 hover:bg-red-50 h-9"
                      >
                        <XSquare className="h-4 w-4 mr-1" />
                        Clear Filters
                      </Button>
                    )}

                    {/* Spacer + rows per page pushed to the right */}
                    <div className="ml-auto flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-600 whitespace-nowrap">
                        Rows per page:
                      </span>
                      <select
                        value={perPage}
                        onChange={(e) => {
                          setPage(1);
                          setPerPage(Number(e.target.value));
                        }}
                        className="border-2 border-emerald-200 rounded-lg px-3 py-2 text-sm font-medium focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"
                      >
                        {[5, 10, 20, 50].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Active filter badges */}
                  {(filterCategory || filterStatus || filterStockStatus) && (
                    <div className="flex flex-wrap gap-2">
                      {filterCategory && (
                        <Badge
                          variant="outline"
                          className="bg-emerald-50 text-emerald-700 border-emerald-300 gap-1 cursor-pointer"
                          onClick={() => {
                            setFilterCategory(null);
                            setPage(1);
                          }}
                        >
                          {
                            categories.find((c) => c.id === filterCategory)
                              ?.name
                          }
                          <XSquare className="h-3 w-3" />
                        </Badge>
                      )}
                      {filterStatus && (
                        <Badge
                          variant="outline"
                          className="bg-emerald-50 text-emerald-700 border-emerald-300 gap-1 cursor-pointer"
                          onClick={() => {
                            setFilterStatus("");
                            setPage(1);
                          }}
                        >
                          {filterStatus === "ACTIVE" ? "Active" : "Inactive"}
                          <XSquare className="h-3 w-3" />
                        </Badge>
                      )}
                      {filterStockStatus && (
                        <Badge
                          variant="outline"
                          className="bg-emerald-50 text-emerald-700 border-emerald-300 gap-1 cursor-pointer"
                          onClick={() => {
                            setFilterStockStatus("");
                            setPage(1);
                          }}
                        >
                          {filterStockStatus === "out"
                            ? "Out of Stock"
                            : filterStockStatus === "low"
                              ? "Low Stock"
                              : "In Stock"}
                          <XSquare className="h-3 w-3" />
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>

            {/* Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {paginated.length === 0 ? (
                <Card className="p-12 text-center border-2 border-dashed border-emerald-200">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-50 mb-4">
                    <ShoppingBag className="h-10 w-10 text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    No products found
                  </h3>
                  <p className="text-gray-600 mb-4">
                    {search
                      ? "Try adjusting your search"
                      : "Get started by adding your first product"}
                  </p>
                  {!search && (
                    <Button
                      onClick={() => handleOpenModal()}
                      className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Product
                    </Button>
                  )}
                </Card>
              ) : (
                <Card className="overflow-hidden border-2 border-emerald-100">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gradient-to-r from-emerald-50 to-green-50 hover:from-emerald-50 hover:to-green-50">
                          <TableHead className="w-10">
                            <button
                              onClick={toggleSelectAll}
                              className="flex items-center justify-center"
                            >
                              {allSelected ? (
                                <CheckSquare className="h-5 w-5 text-emerald-600" />
                              ) : someSelected ? (
                                <CheckSquare className="h-5 w-5 text-gray-400" />
                              ) : (
                                <Square className="h-5 w-5 text-gray-400" />
                              )}
                            </button>
                          </TableHead>
                          {[
                            // { key: "id", label: "ID" },
                            { key: "name", label: "Name" },
                            { key: "categoryName", label: "Category" },
                            // { key: "sku", label: "SKU" },
                            { key: "cost", label: "Cost" },
                            { key: "price", label: "Price" },
                            { key: "margin", label: "Margin %" },
                          ].map((col) => (
                            <TableHead
                              key={col.key}
                              className="cursor-pointer select-none font-bold text-gray-800 whitespace-nowrap"
                              onClick={() =>
                                handleSort(col.key as keyof Product)
                              }
                            >
                              <div className="flex items-center gap-2">
                                {col.label}
                                <ArrowUpDown className="h-4 w-4 text-emerald-600" />
                                {sortBy === col.key && (
                                  <span className="text-emerald-600 font-bold">
                                    {sortDir === "asc" ? "↑" : "↓"}
                                  </span>
                                )}
                              </div>
                            </TableHead>
                          ))}
                          <TableHead className="font-bold text-gray-800">
                            Stock
                          </TableHead>
                          <TableHead className="font-bold text-gray-800">
                            Stock Status
                          </TableHead>
                          <TableHead className="font-bold text-gray-800">
                            Status
                          </TableHead>
                          <TableHead className="text-center font-bold text-gray-800">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginated.map((prod) => {
                          const margin = calculateMargin(prod.price, prod.cost);
                          const marginColor =
                            margin < 20
                              ? "text-red-600"
                              : margin < 40
                                ? "text-amber-600"
                                : "text-emerald-600";

                          const stock = getStockForBranch(prod, selectedBranch);
                          const stockStatus = getStockStatus(
                            prod,
                            selectedBranch,
                          );
                          const expiringSoon = isExpiringSoon(prod.expiryDate);
                          const expired = isExpired(prod.expiryDate);

                          return (
                            <TableRow
                              key={prod.id}
                              className="hover:bg-emerald-50 transition-colors"
                            >
                              <TableCell>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleSelectOne(prod.id);
                                  }}
                                  className="flex items-center justify-center"
                                >
                                  {selectedIds.has(prod.id) ? (
                                    <CheckSquare className="h-5 w-5 text-emerald-600" />
                                  ) : (
                                    <Square className="h-5 w-5 text-gray-300 hover:text-gray-500" />
                                  )}
                                </button>
                              </TableCell>
                              {/* <TableCell>
                                <Badge
                                  variant="outline"
                                  className="bg-emerald-50 text-emerald-700 border-emerald-200"
                                >
                                  #{prod.id}
                                </Badge>
                              </TableCell> */}
                              <TableCell>
                                <div>
                                  <div className="font-semibold text-gray-800">
                                    {prod.name}
                                  </div>
                                  <div className="text-xs text-gray-600">
                                    {prod.brandName}
                                  </div>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {prod.requiresPrescription && (
                                      <Badge
                                        variant="outline"
                                        className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                                      >
                                        <FileText className="h-3 w-3 mr-1" />
                                        Rx
                                      </Badge>
                                    )}
                                    {expired && (
                                      <Badge
                                        variant="outline"
                                        className="text-xs bg-red-50 text-red-700 border-red-200"
                                      >
                                        <Calendar className="h-3 w-3 mr-1" />
                                        Expired
                                      </Badge>
                                    )}
                                    {!expired && expiringSoon && (
                                      <Badge
                                        variant="outline"
                                        className="text-xs bg-orange-50 text-orange-700 border-orange-200"
                                      >
                                        <Calendar className="h-3 w-3 mr-1" />
                                        Expiring Soon
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-gray-600">
                                {prod.category.name || "-"}
                              </TableCell>
                              {/* <TableCell className="font-mono text-sm text-gray-800">
                                {prod.sku}
                              </TableCell> */}
                              <TableCell className="font-semibold text-gray-800">
                                ₱{prod.cost.toFixed(2)}
                              </TableCell>
                              <TableCell className="font-semibold text-emerald-600">
                                ₱{prod.price.toFixed(2)}
                              </TableCell>
                              <TableCell className={`font-bold ${marginColor}`}>
                                {margin.toFixed(2)}%
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-gray-800">
                                    {stock}
                                  </span>
                                  {!selectedBranch && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedProductForStock(prod);
                                        setStockModalOpen(true);
                                      }}
                                      className="h-6 px-2 text-xs hover:bg-emerald-50"
                                    >
                                      <Building2 className="h-3 w-3 mr-1" />
                                      View by Branch
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={stockStatus.color}
                                >
                                  {stockStatus.label}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {prod.status === "ACTIVE" ? (
                                  <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">
                                    Active
                                  </Badge>
                                ) : (
                                  <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200">
                                    Inactive
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                                  <Link
                                    href={`/stock/add?productId=${prod.id}`}
                                  >
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 hover:bg-purple-50"
                                    >
                                      <Package className="h-4 w-4 text-purple-600" />
                                    </Button>
                                  </Link>

                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => toggleProductStatus(prod)}
                                    className="h-8 w-8 hover:bg-emerald-50"
                                  >
                                    {prod.status === "ACTIVE" ? (
                                      <ToggleRight className="h-4 w-4 text-emerald-600" />
                                    ) : (
                                      <ToggleLeft className="h-4 w-4 text-gray-400" />
                                    )}
                                  </Button>

                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleOpenModal(prod)}
                                    className="h-8 w-8 hover:bg-blue-50"
                                  >
                                    <Pencil className="h-4 w-4 text-blue-600" />
                                  </Button>

                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setProductToDelete(prod);
                                      setDeleteOpen(true);
                                    }}
                                    className="h-8 w-8 hover:bg-red-50"
                                  >
                                    <Trash className="h-4 w-4 text-red-600" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              )}
            </motion.div>

            {/* Pagination */}
            {paginated.length > 0 && (
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
                        {(page - 1) * perPage + 1}
                      </span>{" "}
                      -{" "}
                      <span className="font-semibold text-gray-800">
                        {Math.min(page * perPage, filtered.length)}
                      </span>{" "}
                      of{" "}
                      <span className="font-semibold text-gray-800">
                        {filtered.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="border-emerald-300 hover:bg-emerald-50"
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Previous
                      </Button>
                      <div className="px-3 py-1 bg-emerald-50 border-2 border-emerald-200 rounded-lg">
                        <span className="text-sm font-semibold text-emerald-700">
                          Page {page} of {totalPages}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={page === totalPages}
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

          {/* Add/Edit Modal */}
          <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogContent className="sm:max-w-3xl bg-white max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <ShoppingBag className="h-6 w-6 text-emerald-600" />
                  {editingProduct ? "Edit" : "Add"} Product
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Basic Info */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b-2 border-emerald-100">
                    <FileText className="h-5 w-5 text-emerald-600" />
                    <h3 className="font-bold text-gray-800">
                      Basic Information
                    </h3>
                  </div>
                  <div>
                    <Label className="mb-2 text-sm font-semibold text-gray-700">
                      Product Name *
                    </Label>
                    <Input
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="e.g., Paracetamol"
                      className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="mb-2 text-sm font-semibold text-gray-700">
                        Brand Name *
                      </Label>
                      <Input
                        value={formData.brandName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            brandName: e.target.value,
                          })
                        }
                        placeholder="e.g., Biogesic"
                        className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>
                    <div>
                      <Label className="mb-2 text-sm font-semibold text-gray-700">
                        Generic Name
                      </Label>
                      <Input
                        value={formData.genericName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            genericName: e.target.value,
                          })
                        }
                        placeholder="e.g., Acetaminophen"
                        className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <Label className="mb-2 text-sm font-semibold text-gray-700">
                        SKU *
                      </Label>
                      <Input
                        value={formData.sku}
                        onChange={(e) =>
                          setFormData({ ...formData, sku: e.target.value })
                        }
                        placeholder="e.g., MED001"
                        className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>
                    <div>
                      <Label className="mb-2 text-sm font-semibold text-gray-700">
                        Dosage
                      </Label>
                      <Input
                        value={formData.dosage}
                        onChange={(e) =>
                          setFormData({ ...formData, dosage: e.target.value })
                        }
                        placeholder="e.g., 500mg"
                        className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>
                    <div>
                      <Label className="mb-2 text-sm font-semibold text-gray-700">
                        Form
                      </Label>
                      <Input
                        value={formData.form}
                        onChange={(e) =>
                          setFormData({ ...formData, form: e.target.value })
                        }
                        placeholder="e.g., Tablet, Capsule"
                        className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="mb-2 text-sm font-semibold text-gray-700">
                      Barcode
                    </Label>
                    <Input
                      value={formData.barcode ?? ""}
                      onChange={(e) =>
                        setFormData({ ...formData, barcode: e.target.value })
                      }
                      placeholder="e.g., 1234567890123"
                      className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                    />
                  </div>
                </div>

                {/* Pricing */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b-2 border-emerald-100">
                    <DollarSign className="h-5 w-5 text-emerald-600" />
                    <h3 className="font-bold text-gray-800">Pricing</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="mb-2 text-sm font-semibold text-gray-700">
                        Cost *
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.cost}
                        onChange={(e) =>
                          setFormData({ ...formData, cost: e.target.value })
                        }
                        placeholder="0.00"
                        className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>
                    <div>
                      <Label className="mb-2 text-sm font-semibold text-gray-700">
                        Price *
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.price}
                        onChange={(e) =>
                          setFormData({ ...formData, price: e.target.value })
                        }
                        placeholder="0.00"
                        className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>
                  </div>
                  {formData.cost && formData.price && (
                    <div className="p-3 bg-emerald-50 border-2 border-emerald-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-emerald-600" />
                        <span className="text-sm font-semibold text-gray-800">
                          Margin:{" "}
                          <span className="text-emerald-600">
                            {calculateMargin(
                              parseFloat(formData.price),
                              parseFloat(formData.cost),
                            ).toFixed(2)}
                            %
                          </span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Additional Info */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b-2 border-emerald-100">
                    <Calendar className="h-5 w-5 text-emerald-600" />
                    <h3 className="font-bold text-gray-800">
                      Additional Information
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="mb-2 text-sm font-semibold text-gray-700">
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
                    <div>
                      <Label className="mb-2 text-sm font-semibold text-gray-700">
                        Category *
                      </Label>
                      <select
                        className="w-full border-2 border-emerald-200 rounded-lg px-3 py-2.5 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"
                        value={formData.categoryId}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            categoryId: e.target.value,
                          })
                        }
                      >
                        <option value="">Select category</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl border-2 border-emerald-200">
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id="requiresPrescription"
                        checked={formData.requiresPrescription}
                        onCheckedChange={(checked) =>
                          setFormData({
                            ...formData,
                            requiresPrescription: !!checked,
                          })
                        }
                        className="border-blue-600 data-[state=checked]:bg-blue-600"
                      />
                      <Label
                        htmlFor="requiresPrescription"
                        className="cursor-pointer font-semibold text-gray-800"
                      >
                        Requires Prescription
                      </Label>
                    </div>

                    <div>
                      <Label className="mb-2 text-sm font-semibold text-gray-700">
                        Status
                      </Label>
                      <select
                        className="w-full border-2 border-emerald-200 rounded-lg px-3 py-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"
                        value={formData.status}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            status: e.target.value as "ACTIVE" | "INACTIVE",
                          })
                        }
                      >
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={handleCloseModal}
                  disabled={loading}
                  className="w-full sm:w-auto border-gray-300"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Product"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Stock by Branch Modal */}
          <Dialog open={stockModalOpen} onOpenChange={setStockModalOpen}>
            <DialogContent className="sm:max-w-2xl bg-white">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <Building2 className="h-6 w-6 text-emerald-600" />
                  Stock by Branch - {selectedProductForStock?.name}
                </DialogTitle>
              </DialogHeader>

              <div className="py-4 space-y-3">
                {selectedProductForStock?.branchStocks &&
                selectedProductForStock.branchStocks.length > 0 ? (
                  selectedProductForStock.branchStocks.map((bs) => {
                    const stockStatus =
                      bs.currentStock === 0
                        ? {
                            label: "Out of Stock",
                            color: "bg-red-100 text-red-800",
                          }
                        : bs.currentStock <= bs.minimumStock
                          ? {
                              label: "Critical",
                              color: "bg-orange-100 text-orange-800",
                            }
                          : bs.currentStock <= bs.reorderPoint
                            ? {
                                label: "Low Stock",
                                color: "bg-yellow-100 text-yellow-800",
                              }
                            : {
                                label: "In Stock",
                                color: "bg-emerald-100 text-emerald-800",
                              };

                    return (
                      <Card
                        key={bs.id}
                        className="p-4 border-2 border-emerald-100 hover:border-emerald-300 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                              <Building2 className="h-5 w-5 text-emerald-600" />
                            </div>
                            <div>
                              <p className="font-bold text-gray-800">
                                {bs.branch.name}
                              </p>
                              <p className="text-sm text-gray-600">
                                Code: {bs.branch.code}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-2xl font-bold text-gray-800">
                                {bs.currentStock}
                              </p>
                              <p className="text-xs text-gray-600">
                                Reorder at: {bs.reorderPoint}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className={stockStatus.color}
                            >
                              {stockStatus.label}
                            </Badge>
                          </div>
                        </div>
                      </Card>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-gray-600">
                    No branch stock data available
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setStockModalOpen(false)}
                  className="border-gray-300"
                >
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Dialog */}
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogContent className="sm:max-w-md bg-white">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-red-600 flex items-center gap-2">
                  <AlertCircle className="h-6 w-6" />
                  Delete Product
                </DialogTitle>
              </DialogHeader>

              <div className="py-4">
                <p className="text-gray-700 mb-4">
                  Are you sure you want to delete{" "}
                  <span className="font-bold text-gray-900">
                    {productToDelete?.name}
                  </span>
                  ?
                </p>
                <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                  <div className="flex items-start gap-2 text-sm text-red-800">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>
                      This action cannot be undone. This will delete the product
                      and all its branch stock records.
                    </span>
                  </div>
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDeleteOpen(false);
                    setProductToDelete(null);
                  }}
                  className="w-full sm:w-auto border-gray-300"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmDelete}
                  className="w-full sm:w-auto bg-red-600 hover:bg-red-700"
                >
                  <Trash className="w-4 h-4 mr-2" />
                  Delete Product
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Bulk Delete Dialog */}
          <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
            <DialogContent className="sm:max-w-md bg-white">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-red-600 flex items-center gap-2">
                  <AlertCircle className="h-6 w-6" />
                  Delete {selectedIds.size} Products
                </DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <p className="text-gray-700 mb-4">
                  Are you sure you want to delete{" "}
                  <span className="font-bold text-gray-900">
                    {selectedIds.size} products
                  </span>
                  ?
                </p>
                <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                  <div className="flex items-start gap-2 text-sm text-red-800">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>
                      This action cannot be undone. All selected products and
                      their branch stock records will be permanently deleted.
                    </span>
                  </div>
                </div>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() => setBulkDeleteOpen(false)}
                  className="w-full sm:w-auto border-gray-300"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleBulkDelete}
                  className="w-full sm:w-auto bg-red-600 hover:bg-red-700"
                >
                  <Trash className="w-4 h-4 mr-2" />
                  Delete {selectedIds.size} Products
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {/* Bulk Edit Category Dialog */}
          <Dialog
            open={bulkEditCategoryOpen}
            onOpenChange={setBulkEditCategoryOpen}
          >
            <DialogContent className="sm:max-w-md bg-white">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <Pencil className="h-6 w-6 text-emerald-600" />
                  Edit Category for {selectedIds.size} Products
                </DialogTitle>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <p className="text-sm text-gray-600">
                  Select a new category to apply to all{" "}
                  <span className="font-semibold text-gray-800">
                    {selectedIds.size} selected products
                  </span>
                  .
                </p>
                <div>
                  <Label className="mb-2 text-sm font-semibold text-gray-700">
                    New Category *
                  </Label>
                  <select
                    className="w-full border-2 border-emerald-200 rounded-lg px-3 py-2.5 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"
                    value={bulkEditCategoryId}
                    onChange={(e) => setBulkEditCategoryId(e.target.value)}
                  >
                    <option value="">Select category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setBulkEditCategoryOpen(false);
                    setBulkEditCategoryId("");
                  }}
                  className="w-full sm:w-auto border-gray-300"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleBulkEditCategory}
                  disabled={!bulkEditCategoryId}
                  className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white"
                >
                  Apply to {selectedIds.size} Products
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </ProtectedRoute>
    </RoleProtectedRoute>
  );
}
