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
  Percent,
  Search,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Tag,
  Calendar,
  DollarSign,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { motion } from "framer-motion";

interface Product {
  id: number;
  name: string;
  sku: string;
  price: number;
}

interface Category {
  id: number;
  name: string;
}

interface Discount {
  id: number;
  name: string;
  description: string;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  discountCategory:
    | "PWD"
    | "SENIOR_CITIZEN"
    | "PROMOTIONAL"
    | "SEASONAL"
    | "OTHER";
  startDate: string | null;
  endDate: string | null;
  isEnabled: boolean;
  requiresVerification: boolean;
  applicableTo: "ALL_PRODUCTS" | "SPECIFIC_PRODUCTS" | "CATEGORIES";
  minimumPurchaseAmount: number | null;
  maximumDiscountAmount: number | null;
  priority: number;
  stackable: boolean;
  products?: Product[];
  categories?: Category[];
}

export default function DiscountList() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    discountType: "PERCENTAGE" as "PERCENTAGE" | "FIXED_AMOUNT",
    discountValue: "",
    discountCategory: "OTHER" as Discount["discountCategory"],
    startDate: "",
    endDate: "",
    isEnabled: true,
    requiresVerification: false,
    applicableTo: "ALL_PRODUCTS" as Discount["applicableTo"],
    minimumPurchaseAmount: "",
    maximumDiscountAmount: "",
    priority: "0",
    stackable: false,
    productIds: [] as number[],
    categoryIds: [] as number[],
  });
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<keyof Discount>("id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [discountToDelete, setDiscountToDelete] = useState<Discount | null>(
    null,
  );

  const fetchDiscounts = async () => {
    try {
      setFetchLoading(true);
      const res = await api.get("/discounts");
      setDiscounts(res.data);
    } catch (err) {
      toast.error("Failed to fetch discounts");
    } finally {
      setFetchLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await api.get("/products");
      setProducts(res.data);
    } catch {
      toast.error("Failed to load products");
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

  useEffect(() => {
    fetchDiscounts();
    fetchProducts();
    fetchCategories();
  }, []);

  const handleOpenModal = (discount?: Discount) => {
    if (discount) {
      setEditingDiscount(discount);
      setFormData({
        name: discount.name,
        description: discount.description || "",
        discountType: discount.discountType,
        discountValue: discount.discountValue.toString(),
        discountCategory: discount.discountCategory,
        startDate: discount.startDate ? discount.startDate.split("T")[0] : "",
        endDate: discount.endDate ? discount.endDate.split("T")[0] : "",
        isEnabled: discount.isEnabled,
        requiresVerification: discount.requiresVerification,
        applicableTo: discount.applicableTo,
        minimumPurchaseAmount: discount.minimumPurchaseAmount?.toString() || "",
        maximumDiscountAmount: discount.maximumDiscountAmount?.toString() || "",
        priority: discount.priority.toString(),
        stackable: discount.stackable,
        productIds: discount.products?.map((p) => p.id) || [],
        categoryIds: discount.categories?.map((c) => c.id) || [],
      });
    } else {
      setEditingDiscount(null);
      setFormData({
        name: "",
        description: "",
        discountType: "PERCENTAGE",
        discountValue: "",
        discountCategory: "OTHER",
        startDate: "",
        endDate: "",
        isEnabled: true,
        requiresVerification: false,
        applicableTo: "ALL_PRODUCTS",
        minimumPurchaseAmount: "",
        maximumDiscountAmount: "",
        priority: "0",
        stackable: false,
        productIds: [],
        categoryIds: [],
      });
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingDiscount(null);
  };

  const handleSubmit = async () => {
    const { name, discountType, discountValue, discountCategory } = formData;
    if (!name || !discountType || !discountValue || !discountCategory) {
      return toast.error("Name, Type, Value and Category are required");
    }

    try {
      setLoading(true);
      const payload = {
        name,
        description: formData.description || null,
        discountType,
        discountValue: parseFloat(discountValue),
        discountCategory,
        startDate: formData.startDate || null,
        endDate: formData.endDate || null,
        isEnabled: formData.isEnabled,
        requiresVerification: formData.requiresVerification,
        applicableTo: formData.applicableTo,
        minimumPurchaseAmount: formData.minimumPurchaseAmount
          ? parseFloat(formData.minimumPurchaseAmount)
          : null,
        maximumDiscountAmount: formData.maximumDiscountAmount
          ? parseFloat(formData.maximumDiscountAmount)
          : null,
        priority: parseInt(formData.priority),
        stackable: formData.stackable,
        productIds:
          formData.applicableTo === "SPECIFIC_PRODUCTS"
            ? formData.productIds
            : [],
        categoryIds:
          formData.applicableTo === "CATEGORIES" ? formData.categoryIds : [],
      };

      if (editingDiscount) {
        await api.put(`/discounts/${editingDiscount.id}`, payload);
        toast.success("Discount updated successfully");
      } else {
        await api.post("/discounts", payload);
        toast.success("Discount created successfully");
      }
      handleCloseModal();
      fetchDiscounts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Error saving discount");
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!discountToDelete) return;

    try {
      await api.delete(`/discounts/${discountToDelete.id}`);
      toast.success("Discount deleted successfully");
      fetchDiscounts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Error deleting discount");
    } finally {
      setDeleteOpen(false);
      setDiscountToDelete(null);
    }
  };

  const toggleDiscountStatus = async (discount: Discount) => {
    try {
      await api.patch(`/discounts/${discount.id}/toggle`);
      toast.success(`Discount ${!discount.isEnabled ? "enabled" : "disabled"}`);
      fetchDiscounts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Error toggling discount");
    }
  };

  const handleProductSelection = (productId: number) => {
    setFormData((prev) => ({
      ...prev,
      productIds: prev.productIds.includes(productId)
        ? prev.productIds.filter((id) => id !== productId)
        : [...prev.productIds, productId],
    }));
  };

  const handleCategorySelection = (categoryId: number) => {
    setFormData((prev) => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(categoryId)
        ? prev.categoryIds.filter((id) => id !== categoryId)
        : [...prev.categoryIds, categoryId],
    }));
  };

  const filtered = useMemo(() => {
    let data = discounts.filter(
      (d) =>
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.description?.toLowerCase().includes(search.toLowerCase()) ||
        d.discountCategory.toLowerCase().includes(search.toLowerCase()),
    );
    data = data.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      if (typeof aVal === "boolean" && typeof bVal === "boolean") {
        return sortDir === "asc"
          ? Number(aVal) - Number(bVal)
          : Number(bVal) - Number(aVal);
      }
      return sortDir === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
    return data;
  }, [discounts, search, sortBy, sortDir]);

  const paginated = useMemo(() => {
    const start = (page - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, page, perPage]);

  const totalPages = Math.ceil(filtered.length / perPage);

  const handleSort = (key: keyof Discount) => {
    if (sortBy === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  const getCategoryBadgeColor = (category: Discount["discountCategory"]) => {
    const colors = {
      PWD: "bg-blue-100 text-blue-800 border-blue-200",
      SENIOR_CITIZEN: "bg-purple-100 text-purple-800 border-purple-200",
      PROMOTIONAL: "bg-emerald-100 text-emerald-800 border-emerald-200",
      SEASONAL: "bg-amber-100 text-amber-800 border-amber-200",
      OTHER: "bg-gray-100 text-gray-800 border-gray-200",
    };
    return colors[category];
  };

  const formatDate = (date: string | null) => {
    if (!date) return "Indefinite";
    return new Date(date).toLocaleDateString();
  };

  const isActive = (discount: Discount) => {
    if (!discount.isEnabled) return false;
    const now = new Date();
    const start = discount.startDate ? new Date(discount.startDate) : null;
    const end = discount.endDate ? new Date(discount.endDate) : null;

    if (start && start > now) return false;
    if (end && end < now) return false;
    return true;
  };

  const activeCount = discounts.filter(isActive).length;
  const inactiveCount = discounts.length - activeCount;

  if (fetchLoading) {
    return (
      <RoleProtectedRoute allowedRoles={["admin"]}>
        <ProtectedRoute>
          <div className="flex items-center justify-center h-screen bg-gradient-to-br from-emerald-50 to-green-50">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-emerald-600 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">Loading discounts...</p>
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
                  <Percent className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                    Discounts
                  </h1>
                  <p className="text-sm text-gray-600">
                    Manage promotional offers and special pricing
                  </p>
                </div>
              </div>
              <Button
                onClick={() => handleOpenModal()}
                className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold shadow-lg self-start sm:self-auto"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Discount
              </Button>
            </motion.div>

            {/* Stats Cards */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-4"
            >
              <Card className="p-5 border-2 border-emerald-100 hover:border-emerald-300 hover:shadow-lg transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                      Total Discounts
                    </p>
                    <p className="text-3xl font-bold text-gray-800 mt-1">
                      {discounts.length}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                    <Tag className="h-6 w-6 text-white" />
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

              <Card className="p-5 border-2 border-emerald-100 hover:border-emerald-300 hover:shadow-lg transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                      Inactive
                    </p>
                    <p className="text-3xl font-bold text-red-600 mt-1">
                      {inactiveCount}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-gray-400 flex items-center justify-center">
                    <ToggleLeft className="h-6 w-6 text-white" />
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
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      placeholder="Search discounts..."
                      className="pl-10 h-12 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                      value={search}
                      onChange={(e) => {
                        setPage(1);
                        setSearch(e.target.value);
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
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
                    <Percent className="h-10 w-10 text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    No discounts found
                  </h3>
                  <p className="text-gray-600 mb-4">
                    {search
                      ? "Try adjusting your search"
                      : "Create your first discount to start offering special pricing"}
                  </p>
                  {!search && (
                    <Button
                      onClick={() => handleOpenModal()}
                      className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Discount
                    </Button>
                  )}
                </Card>
              ) : (
                <Card className="overflow-hidden border-2 border-emerald-100">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gradient-to-r from-emerald-50 to-green-50 hover:from-emerald-50 hover:to-green-50">
                          {[
                            { key: "id", label: "ID" },
                            { key: "name", label: "Name" },
                            { key: "discountCategory", label: "Category" },
                            { key: "discountType", label: "Type" },
                            { key: "discountValue", label: "Value" },
                            { key: "applicableTo", label: "Applies To" },
                            { key: "startDate", label: "Start" },
                            { key: "endDate", label: "End" },
                            { key: "isEnabled", label: "Status" },
                          ].map((col) => (
                            <TableHead
                              key={col.key}
                              className="cursor-pointer select-none font-bold text-gray-800 whitespace-nowrap"
                              onClick={() =>
                                handleSort(col.key as keyof Discount)
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
                          <TableHead className="text-center font-bold text-gray-800 whitespace-nowrap">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginated.map((discount) => (
                          <TableRow
                            key={discount.id}
                            className="hover:bg-emerald-50 transition-colors"
                          >
                            <TableCell>
                              <Badge
                                variant="outline"
                                className="bg-emerald-50 text-emerald-700 border-emerald-200"
                              >
                                #{discount.id}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-semibold text-gray-800">
                                  {discount.name}
                                </div>
                                {discount.description && (
                                  <div className="text-xs text-gray-500 truncate max-w-xs">
                                    {discount.description}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={getCategoryBadgeColor(
                                  discount.discountCategory,
                                )}
                              >
                                {discount.discountCategory.replace("_", " ")}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className="bg-blue-50 text-blue-700 border-blue-200"
                              >
                                {discount.discountType === "PERCENTAGE"
                                  ? "%"
                                  : "₱"}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-bold text-emerald-600">
                              {discount.discountType === "PERCENTAGE"
                                ? `${discount.discountValue}%`
                                : `₱${discount.discountValue}`}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className="text-xs bg-gray-50"
                              >
                                {discount.applicableTo === "ALL_PRODUCTS" &&
                                  "All Products"}
                                {discount.applicableTo ===
                                  "SPECIFIC_PRODUCTS" &&
                                  `${discount.products?.length || 0} Products`}
                                {discount.applicableTo === "CATEGORIES" &&
                                  `${discount.categories?.length || 0} Categories`}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-gray-600">
                              {formatDate(discount.startDate)}
                            </TableCell>
                            <TableCell className="text-sm text-gray-600">
                              {formatDate(discount.endDate)}
                            </TableCell>
                            <TableCell>
                              {isActive(discount) ? (
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
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => toggleDiscountStatus(discount)}
                                  className="h-8 w-8 hover:bg-emerald-50"
                                >
                                  {discount.isEnabled ? (
                                    <ToggleRight className="h-4 w-4 text-emerald-600" />
                                  ) : (
                                    <ToggleLeft className="h-4 w-4 text-gray-400" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleOpenModal(discount)}
                                  className="h-8 w-8 hover:bg-blue-50"
                                >
                                  <Pencil className="h-4 w-4 text-blue-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setDiscountToDelete(discount);
                                    setDeleteOpen(true);
                                  }}
                                  className="h-8 w-8 hover:bg-red-50"
                                >
                                  <Trash className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
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

          {/* Create/Edit Modal */}
          <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogContent className="sm:max-w-3xl bg-white max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <Percent className="h-6 w-6 text-emerald-600" />
                  {editingDiscount ? "Edit" : "Add"} Discount
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Basic Info */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b-2 border-emerald-100">
                    <Tag className="h-5 w-5 text-emerald-600" />
                    <h3 className="font-bold text-gray-800">
                      Basic Information
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <Label className="mb-2 text-sm font-semibold text-gray-700">
                        Discount Name *
                      </Label>
                      <Input
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        placeholder="e.g., PWD Discount, Summer Sale"
                        className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <Label className="mb-2 text-sm font-semibold text-gray-700">
                        Description
                      </Label>
                      <Input
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            description: e.target.value,
                          })
                        }
                        placeholder="Brief description of the discount"
                        className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>

                    <div>
                      <Label className="mb-2 text-sm font-semibold text-gray-700">
                        Category *
                      </Label>
                      <select
                        className="w-full border-2 border-emerald-200 rounded-lg px-3 py-2.5 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"
                        value={formData.discountCategory}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            discountCategory: e.target
                              .value as Discount["discountCategory"],
                          })
                        }
                      >
                        <option value="PWD">PWD</option>
                        <option value="SENIOR_CITIZEN">Senior Citizen</option>
                        <option value="PROMOTIONAL">Promotional</option>
                        <option value="SEASONAL">Seasonal</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>

                    <div>
                      <Label className="mb-2 text-sm font-semibold text-gray-700">
                        Discount Type *
                      </Label>
                      <select
                        className="w-full border-2 border-emerald-200 rounded-lg px-3 py-2.5 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"
                        value={formData.discountType}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            discountType: e.target.value as
                              | "PERCENTAGE"
                              | "FIXED_AMOUNT",
                          })
                        }
                      >
                        <option value="PERCENTAGE">Percentage (%)</option>
                        <option value="FIXED_AMOUNT">Fixed Amount (₱)</option>
                      </select>
                    </div>

                    <div>
                      <Label className="mb-2 text-sm font-semibold text-gray-700">
                        Discount Value *
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.discountValue}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            discountValue: e.target.value,
                          })
                        }
                        placeholder={
                          formData.discountType === "PERCENTAGE" ? "20" : "100"
                        }
                        className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>

                    <div>
                      <Label className="mb-2 text-sm font-semibold text-gray-700">
                        Priority
                      </Label>
                      <Input
                        type="number"
                        value={formData.priority}
                        onChange={(e) =>
                          setFormData({ ...formData, priority: e.target.value })
                        }
                        placeholder="0 (higher = applied first)"
                        className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>
                  </div>
                </div>

                {/* Date Range */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b-2 border-emerald-100">
                    <Calendar className="h-5 w-5 text-emerald-600" />
                    <h3 className="font-bold text-gray-800">Validity Period</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="mb-2 text-sm font-semibold text-gray-700">
                        Start Date (Optional)
                      </Label>
                      <Input
                        type="date"
                        value={formData.startDate}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            startDate: e.target.value,
                          })
                        }
                        className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>

                    <div>
                      <Label className="mb-2 text-sm font-semibold text-gray-700">
                        End Date (Optional)
                      </Label>
                      <Input
                        type="date"
                        value={formData.endDate}
                        onChange={(e) =>
                          setFormData({ ...formData, endDate: e.target.value })
                        }
                        className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>
                  </div>
                </div>

                {/* Constraints */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b-2 border-emerald-100">
                    <DollarSign className="h-5 w-5 text-emerald-600" />
                    <h3 className="font-bold text-gray-800">Constraints</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="mb-2 text-sm font-semibold text-gray-700">
                        Min Purchase Amount (Optional)
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.minimumPurchaseAmount}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            minimumPurchaseAmount: e.target.value,
                          })
                        }
                        placeholder="0.00"
                        className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>

                    <div>
                      <Label className="mb-2 text-sm font-semibold text-gray-700">
                        Max Discount Amount (Optional)
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.maximumDiscountAmount}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            maximumDiscountAmount: e.target.value,
                          })
                        }
                        placeholder="0.00"
                        className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>
                  </div>
                </div>

                {/* Applicability */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b-2 border-emerald-100">
                    <Tag className="h-5 w-5 text-emerald-600" />
                    <h3 className="font-bold text-gray-800">Applicable To</h3>
                  </div>

                  <div>
                    <select
                      className="w-full border-2 border-emerald-200 rounded-lg px-3 py-2.5 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"
                      value={formData.applicableTo}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          applicableTo: e.target
                            .value as Discount["applicableTo"],
                          productIds: [],
                          categoryIds: [],
                        })
                      }
                    >
                      <option value="ALL_PRODUCTS">All Products</option>
                      <option value="SPECIFIC_PRODUCTS">
                        Specific Products
                      </option>
                      <option value="CATEGORIES">Categories</option>
                    </select>
                  </div>

                  {/* Product Selection */}
                  {formData.applicableTo === "SPECIFIC_PRODUCTS" && (
                    <div className="border-2 border-emerald-200 rounded-lg p-4 max-h-64 overflow-y-auto bg-emerald-50/30">
                      <Label className="mb-3 block font-bold text-gray-800">
                        Select Products ({formData.productIds.length} selected)
                      </Label>
                      {products.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">
                          No products available
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {products.map((product) => (
                            <div
                              key={product.id}
                              className="flex items-center space-x-3 p-2 hover:bg-emerald-100 rounded transition-colors"
                            >
                              <Checkbox
                                id={`product-${product.id}`}
                                checked={formData.productIds.includes(
                                  product.id,
                                )}
                                onCheckedChange={() =>
                                  handleProductSelection(product.id)
                                }
                                className="border-emerald-600 data-[state=checked]:bg-emerald-600"
                              />
                              <label
                                htmlFor={`product-${product.id}`}
                                className="text-sm cursor-pointer flex-1"
                              >
                                <span className="font-medium text-gray-800">
                                  {product.name}
                                </span>
                                <span className="text-gray-500 ml-2">
                                  ({product.sku}) - ₱{product.price}
                                </span>
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Category Selection */}
                  {formData.applicableTo === "CATEGORIES" && (
                    <div className="border-2 border-emerald-200 rounded-lg p-4 max-h-64 overflow-y-auto bg-emerald-50/30">
                      <Label className="mb-3 block font-bold text-gray-800">
                        Select Categories ({formData.categoryIds.length}{" "}
                        selected)
                      </Label>
                      {categories.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">
                          No categories available
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {categories.map((category) => (
                            <div
                              key={category.id}
                              className="flex items-center space-x-3 p-2 hover:bg-emerald-100 rounded transition-colors"
                            >
                              <Checkbox
                                id={`category-${category.id}`}
                                checked={formData.categoryIds.includes(
                                  category.id,
                                )}
                                onCheckedChange={() =>
                                  handleCategorySelection(category.id)
                                }
                                className="border-emerald-600 data-[state=checked]:bg-emerald-600"
                              />
                              <label
                                htmlFor={`category-${category.id}`}
                                className="text-sm font-medium text-gray-800 cursor-pointer"
                              >
                                {category.name}
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Options */}
                <div className="space-y-3 p-4 bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl border-2 border-emerald-200">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="isEnabled"
                      checked={formData.isEnabled}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, isEnabled: !!checked })
                      }
                      className="border-emerald-600 data-[state=checked]:bg-emerald-600"
                    />
                    <label
                      htmlFor="isEnabled"
                      className="text-sm font-semibold text-gray-800 cursor-pointer"
                    >
                      Enable this discount
                    </label>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="requiresVerification"
                      checked={formData.requiresVerification}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          requiresVerification: !!checked,
                        })
                      }
                      className="border-blue-600 data-[state=checked]:bg-blue-600"
                    />
                    <label
                      htmlFor="requiresVerification"
                      className="text-sm font-semibold text-gray-800 cursor-pointer"
                    >
                      Requires Verification (e.g., ID check for PWD/Senior)
                    </label>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="stackable"
                      checked={formData.stackable}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, stackable: !!checked })
                      }
                      className="border-purple-600 data-[state=checked]:bg-purple-600"
                    />
                    <label
                      htmlFor="stackable"
                      className="text-sm font-semibold text-gray-800 cursor-pointer"
                    >
                      Stackable (can combine with other discounts)
                    </label>
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
                    "Save Discount"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation */}
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogContent className="sm:max-w-md bg-white">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-red-600 flex items-center gap-2">
                  <AlertCircle className="h-6 w-6" />
                  Delete Discount
                </DialogTitle>
              </DialogHeader>

              <div className="py-4">
                <p className="text-gray-700 mb-4">
                  Are you sure you want to delete{" "}
                  <span className="font-bold text-gray-900">
                    {discountToDelete?.name}
                  </span>
                  ?
                </p>
                <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                  <div className="flex items-start gap-2 text-sm text-red-800">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>
                      This action cannot be undone. This discount will be
                      permanently removed from the system.
                    </span>
                  </div>
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDeleteOpen(false);
                    setDiscountToDelete(null);
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
                  Delete Discount
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </ProtectedRoute>
    </RoleProtectedRoute>
  );
}
