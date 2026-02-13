"use client";

import { useEffect, useState, useMemo } from "react";
import api from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, Pencil, Trash, ToggleLeft, ToggleRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

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
  discountCategory: "PWD" | "SENIOR_CITIZEN" | "PROMOTIONAL" | "SEASONAL" | "OTHER";
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

  // --- Table UI states ---
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<keyof Discount>("id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [discountToDelete, setDiscountToDelete] = useState<Discount | null>(null);

  const fetchDiscounts = async () => {
    try {
      const res = await api.get("/discounts");
      setDiscounts(res.data);
    } catch (err) {
      toast.error("Failed to fetch discounts");
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
        productIds: formData.applicableTo === "SPECIFIC_PRODUCTS" ? formData.productIds : [],
        categoryIds: formData.applicableTo === "CATEGORIES" ? formData.categoryIds : [],
      };

      if (editingDiscount) {
        await api.put(`/discounts/${editingDiscount.id}`, payload);
        toast.success("Discount updated");
      } else {
        await api.post("/discounts", payload);
        toast.success("Discount created");
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
      toast.success("Discount deleted");
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

  // --- Derived Data: search, sort, paginate ---
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
      PWD: "bg-blue-100 text-blue-800",
      SENIOR_CITIZEN: "bg-purple-100 text-purple-800",
      PROMOTIONAL: "bg-green-100 text-green-800",
      SEASONAL: "bg-orange-100 text-orange-800",
      OTHER: "bg-gray-100 text-gray-800",
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

  return (
    <ProtectedRoute>
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-semibold">Discounts</h1>
          <Button
            className="cursor-pointer"
            variant="outline"
            onClick={() => handleOpenModal()}
          >
            <Plus />
            Add
          </Button>
        </div>

        {/* Search + Per Page Controls */}
        <div className="flex justify-between items-center mb-3">
          <Input
            placeholder="Search discounts..."
            className="max-w-sm"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
          <div className="flex items-center gap-2">
            <span className="text-sm">Rows per page:</span>
            <select
              value={perPage}
              onChange={(e) => {
                setPage(1);
                setPerPage(Number(e.target.value));
              }}
              className="border rounded px-2 py-1 text-sm"
            >
              {[5, 10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Card className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
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
                    className="cursor-pointer select-none"
                    onClick={() => handleSort(col.key as keyof Discount)}
                  >
                    {col.label}{" "}
                    {sortBy === col.key && (sortDir === "asc" ? "↑" : "↓")}
                  </TableHead>
                ))}
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((discount) => (
                <TableRow key={discount.id}>
                  <TableCell>{discount.id}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{discount.name}</div>
                      {discount.description && (
                        <div className="text-xs text-gray-500 truncate max-w-xs">
                          {discount.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getCategoryBadgeColor(discount.discountCategory)}>
                      {discount.discountCategory.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {discount.discountType === "PERCENTAGE" ? "%" : "₱"}
                  </TableCell>
                  <TableCell>
                    {discount.discountType === "PERCENTAGE"
                      ? `${discount.discountValue}%`
                      : `₱${discount.discountValue}`}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {discount.applicableTo === "ALL_PRODUCTS" && "All Products"}
                      {discount.applicableTo === "SPECIFIC_PRODUCTS" && 
                        `${discount.products?.length || 0} Products`}
                      {discount.applicableTo === "CATEGORIES" && 
                        `${discount.categories?.length || 0} Categories`}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(discount.startDate)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(discount.endDate)}
                  </TableCell>
                  <TableCell>
                    {isActive(discount) ? (
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center space-x-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          className="cursor-pointer"
                          variant="outline"
                          size="icon"
                          onClick={() => toggleDiscountStatus(discount)}
                        >
                          {discount.isEnabled ? (
                            <ToggleRight className="text-green-600" />
                          ) : (
                            <ToggleLeft className="text-gray-400" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="pointer-events-none">
                        <p>{discount.isEnabled ? "Disable" : "Enable"}</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          className="cursor-pointer"
                          variant="outline"
                          size="icon"
                          onClick={() => handleOpenModal(discount)}
                        >
                          <Pencil />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="pointer-events-none">
                        <p>Edit</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          className="cursor-pointer"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setDiscountToDelete(discount);
                            setDeleteOpen(true);
                          }}
                        >
                          <Trash color="red" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="pointer-events-none">
                        <p>Delete</p>
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* Pagination */}
        <div className="flex justify-between items-center mt-4 text-sm">
          <span>
            Showing {(page - 1) * perPage + 1} -{" "}
            {Math.min(page * perPage, filtered.length)} of {filtered.length}
          </span>
          <div className="space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </div>

        {/* Create/Edit Modal */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="sm:max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingDiscount ? "Edit" : "Add"} Discount
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label className="mb-1">Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., PWD Discount"
                  />
                </div>

                <div className="col-span-2">
                  <Label className="mb-1">Description</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Brief description"
                  />
                </div>

                <div>
                  <Label className="mb-1">Category *</Label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={formData.discountCategory}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        discountCategory: e.target.value as Discount["discountCategory"],
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
                  <Label className="mb-1">Type *</Label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={formData.discountType}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        discountType: e.target.value as "PERCENTAGE" | "FIXED_AMOUNT",
                      })
                    }
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FIXED_AMOUNT">Fixed Amount (₱)</option>
                  </select>
                </div>

                <div>
                  <Label className="mb-1">Value *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.discountValue}
                    onChange={(e) =>
                      setFormData({ ...formData, discountValue: e.target.value })
                    }
                    placeholder={formData.discountType === "PERCENTAGE" ? "20" : "100"}
                  />
                </div>

                <div>
                  <Label className="mb-1">Priority</Label>
                  <Input
                    type="number"
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: e.target.value })
                    }
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1">Start Date (Optional)</Label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData({ ...formData, startDate: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label className="mb-1">End Date (Optional)</Label>
                  <Input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) =>
                      setFormData({ ...formData, endDate: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Constraints */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1">Min Purchase Amount (Optional)</Label>
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
                  />
                </div>

                <div>
                  <Label className="mb-1">Max Discount Amount (Optional)</Label>
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
                  />
                </div>
              </div>

              {/* Applicability */}
              <div>
                <Label className="mb-1">Applicable To</Label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={formData.applicableTo}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      applicableTo: e.target.value as Discount["applicableTo"],
                      productIds: [],
                      categoryIds: [],
                    })
                  }
                >
                  <option value="ALL_PRODUCTS">All Products</option>
                  <option value="SPECIFIC_PRODUCTS">Specific Products</option>
                  <option value="CATEGORIES">Categories</option>
                </select>
              </div>

              {/* Product Selection */}
              {formData.applicableTo === "SPECIFIC_PRODUCTS" && (
                <div className="border rounded p-3 max-h-48 overflow-y-auto">
                  <Label className="mb-2 block">Select Products</Label>
                  {products.length === 0 ? (
                    <p className="text-sm text-gray-500">No products available</p>
                  ) : (
                    products.map((product) => (
                      <div key={product.id} className="flex items-center space-x-2 mb-2">
                        <Checkbox
                          id={`product-${product.id}`}
                          checked={formData.productIds.includes(product.id)}
                          onCheckedChange={() => handleProductSelection(product.id)}
                        />
                        <label
                          htmlFor={`product-${product.id}`}
                          className="text-sm cursor-pointer"
                        >
                          {product.name} ({product.sku}) - ₱{product.price}
                        </label>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Category Selection */}
              {formData.applicableTo === "CATEGORIES" && (
                <div className="border rounded p-3 max-h-48 overflow-y-auto">
                  <Label className="mb-2 block">Select Categories</Label>
                  {categories.length === 0 ? (
                    <p className="text-sm text-gray-500">No categories available</p>
                  ) : (
                    categories.map((category) => (
                      <div key={category.id} className="flex items-center space-x-2 mb-2">
                        <Checkbox
                          id={`category-${category.id}`}
                          checked={formData.categoryIds.includes(category.id)}
                          onCheckedChange={() => handleCategorySelection(category.id)}
                        />
                        <label
                          htmlFor={`category-${category.id}`}
                          className="text-sm cursor-pointer"
                        >
                          {category.name}
                        </label>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Checkboxes */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isEnabled"
                    checked={formData.isEnabled}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isEnabled: !!checked })
                    }
                  />
                  <label htmlFor="isEnabled" className="text-sm cursor-pointer">
                    Enabled
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="requiresVerification"
                    checked={formData.requiresVerification}
                    onCheckedChange={(checked) =>
                      setFormData({
                        ...formData,
                        requiresVerification: !!checked,
                      })
                    }
                  />
                  <label
                    htmlFor="requiresVerification"
                    className="text-sm cursor-pointer"
                  >
                    Requires Verification (e.g., ID check for PWD/Senior)
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="stackable"
                    checked={formData.stackable}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, stackable: !!checked })
                    }
                  />
                  <label htmlFor="stackable" className="text-sm cursor-pointer">
                    Stackable (can combine with other discounts)
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button onClick={handleSubmit} disabled={loading}>
                  {loading ? "Saving..." : "Save"}
                </Button>
                <Button variant="ghost" onClick={handleCloseModal}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent className="sm:max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="text-red-600">Delete Discount</DialogTitle>
            </DialogHeader>

            <p className="text-sm text-gray-600">
              Are you sure you want to delete{" "}
              <span className="font-semibold">{discountToDelete?.name}</span>?
              This action cannot be undone.
            </p>

            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="ghost"
                onClick={() => {
                  setDeleteOpen(false);
                  setDiscountToDelete(null);
                }}
              >
                Cancel
              </Button>

              <Button variant="destructive" onClick={confirmDelete}>
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
}