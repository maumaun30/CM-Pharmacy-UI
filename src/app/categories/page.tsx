"use client";

import React, { useEffect, useState, useMemo } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
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
import ProtectedRoute from "@/components/ProtectedRoute";
import {
  Plus,
  Pencil,
  Trash,
  List,
  Search,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { motion } from "framer-motion";

type Category = {
  id: number;
  name: string;
  description: string;
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<keyof Category>("id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(
    null,
  );

  const fetchCategories = async () => {
    try {
      setFetchLoading(true);
      const res = await api.get("/categories");
      setCategories(res.data);
    } catch (error: any) {
      toast.error("Failed to fetch categories");
    } finally {
      setFetchLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleOpenModal = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setFormData({ name: category.name, description: category.description });
    } else {
      setEditingCategory(null);
      setFormData({ name: "", description: "" });
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingCategory(null);
    setFormData({ name: "", description: "" });
  };

  const handleSubmit = async () => {
    const { name, description } = formData;
    if (!name.trim()) return toast.error("Category name is required");
    try {
      setLoading(true);
      if (editingCategory) {
        await api.put(`/categories/${editingCategory.id}`, {
          name,
          description,
        });
        toast.success("Category updated successfully");
      } else {
        await api.post("/categories", {
          name,
          description,
        });
        toast.success("Category created successfully");
      }
      handleCloseModal();
      fetchCategories();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Error saving category");
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!categoryToDelete) return;

    try {
      await api.delete(`/categories/${categoryToDelete.id}`);
      toast.success("Category deleted successfully");
      fetchCategories();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Error deleting category");
    } finally {
      setDeleteOpen(false);
      setCategoryToDelete(null);
    }
  };

  const filtered = useMemo(() => {
    let data = categories.filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase()),
    );
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
  }, [categories, search, sortBy, sortDir]);

  const paginated = useMemo(() => {
    const start = (page - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, page, perPage]);

  const totalPages = Math.ceil(filtered.length / perPage);

  const handleSort = (key: keyof Category) => {
    if (sortBy === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  if (fetchLoading) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center h-screen bg-gradient-to-br from-emerald-50 to-green-50">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-emerald-600 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Loading categories...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
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
                <List className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                  Categories
                </h1>
                <p className="text-sm text-gray-600">
                  Organize your products into categories
                </p>
              </div>
            </div>
            <Button
              onClick={() => handleOpenModal()}
              className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold shadow-lg self-start sm:self-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </Button>
          </motion.div>

          {/* Stats Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="p-5 bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                    Total Categories
                  </p>
                  <p className="text-3xl font-bold text-emerald-600 mt-1">
                    {categories.length}
                  </p>
                </div>
                <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                  <List className="h-8 w-8 text-white" />
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
                    placeholder="Search categories..."
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

          {/* Table/Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {paginated.length === 0 ? (
              <Card className="p-12 text-center border-2 border-dashed border-emerald-200">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-50 mb-4">
                  <List className="h-10 w-10 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  No categories found
                </h3>
                <p className="text-gray-600 mb-4">
                  {search
                    ? "Try adjusting your search"
                    : "Get started by adding your first category"}
                </p>
                {!search && (
                  <Button
                    onClick={() => handleOpenModal()}
                    className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Category
                  </Button>
                )}
              </Card>
            ) : (
              <Card className="overflow-hidden border-2 border-emerald-100">
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-emerald-50 to-green-50 hover:from-emerald-50 hover:to-green-50">
                        {[
                          { key: "id", label: "ID" },
                          { key: "name", label: "Name" },
                          { key: "description", label: "Description" },
                        ].map((col) => (
                          <TableHead
                            key={col.key}
                            className="cursor-pointer select-none font-bold text-gray-800"
                            onClick={() => handleSort(col.key as keyof Category)}
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
                        <TableHead className="text-center font-bold text-gray-800">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginated.map((cat) => (
                        <TableRow
                          key={cat.id}
                          className="hover:bg-emerald-50 transition-colors"
                        >
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className="bg-emerald-50 text-emerald-700 border-emerald-200"
                            >
                              #{cat.id}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-semibold text-gray-800">
                            {cat.name}
                          </TableCell>
                          <TableCell className="text-gray-700">
                            {cat.description || (
                              <span className="text-gray-400 italic">
                                No description
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenModal(cat)}
                                className="h-8 w-8 hover:bg-blue-50"
                              >
                                <Pencil className="h-4 w-4 text-blue-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setCategoryToDelete(cat);
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

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-emerald-100">
                  {paginated.map((cat) => (
                    <div
                      key={cat.id}
                      className="p-4 hover:bg-emerald-50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-bold text-gray-800 text-lg">
                              {cat.name}
                            </h3>
                            <Badge
                              variant="outline"
                              className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs"
                            >
                              #{cat.id}
                            </Badge>
                          </div>
                          {cat.description && (
                            <p className="text-sm text-gray-600">
                              {cat.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenModal(cat)}
                          className="flex-1 border-blue-300 hover:bg-blue-50"
                        >
                          <Pencil className="h-4 w-4 mr-2 text-blue-600" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setCategoryToDelete(cat);
                            setDeleteOpen(true);
                          }}
                          className="flex-1 border-red-300 hover:bg-red-50"
                        >
                          <Trash className="h-4 w-4 mr-2 text-red-600" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
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
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
          <DialogContent className="sm:max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <List className="h-6 w-6 text-emerald-600" />
                {editingCategory ? "Edit" : "Add"} Category
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-5 py-4">
              <div>
                <Label className="mb-2 text-sm font-semibold text-gray-700">
                  Category Name *
                </Label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Electronics, Clothing"
                  className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                />
              </div>
              <div>
                <Label className="mb-2 text-sm font-semibold text-gray-700">
                  Description (Optional)
                </Label>
                <Input
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Brief description of the category"
                  className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                />
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
                  "Save Category"
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
                Delete Category
              </DialogTitle>
            </DialogHeader>

            <div className="py-4">
              <p className="text-gray-700 mb-4">
                Are you sure you want to delete{" "}
                <span className="font-bold text-gray-900">
                  {categoryToDelete?.name}
                </span>
                ?
              </p>
              <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                <div className="flex items-start gap-2 text-sm text-red-800">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>
                    This action cannot be undone. Products in this category may
                    be affected.
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteOpen(false);
                  setCategoryToDelete(null);
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
                Delete Category
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
}