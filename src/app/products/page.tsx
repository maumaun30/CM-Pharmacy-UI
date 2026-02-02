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
import { Plus, Pencil, Trash } from "lucide-react";

interface Category {
  id: number;
  name: string;
}

interface Product {
  id: number;
  name: string;
  sku: string;
  cost: number;
  price: number;
  quantity: number;
  categoryId: number;
  category: Category;
}

export default function ProductList() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    cost: "",
    price: "",
    quantity: "",
    categoryId: "",
  });
  const [loading, setLoading] = useState(false);

  // --- Table UI states ---
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<keyof Product>("id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  const fetchProducts = async () => {
    try {
      const res = await api.get("/products");
      setProducts(res.data);
    } catch (err) {
      toast.error("Failed to fetch products");
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
    fetchProducts();
    fetchCategories();
  }, []);

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        sku: product.sku,
        cost: product.cost.toString(),
        price: product.price.toString(),
        quantity: product.quantity.toString(),
        categoryId: product.categoryId.toString(),
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: "",
        sku: "",
        cost: "",
        price: "",
        quantity: "",
        categoryId: "",
      });
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingProduct(null);
    setFormData({
      name: "",
      sku: "",
      cost: "",
      price: "",
      quantity: "",
      categoryId: "",
    });
  };

  const handleSubmit = async () => {
    const { name, sku, cost, price, quantity, categoryId } = formData;
    if (!name || !sku || !cost || !price || !categoryId) {
      return toast.error("Name, SKU, Price and Category are required");
    }

    try {
      setLoading(true);
      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, {
          name,
          sku,
          cost: parseFloat(cost),
          price: parseFloat(price),
          quantity: parseInt(quantity),
          categoryId: parseInt(categoryId),
        });
        toast.success("Product updated");
      } else {
        await api.post("/products", {
          name,
          sku,
          cost: parseFloat(cost),
          price: parseFloat(price),
          quantity: parseInt(quantity),
          categoryId: parseInt(categoryId),
        });
        toast.success("Product created");
      }
      handleCloseModal();
      fetchProducts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Error saving product");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/products/${id}`);
      toast.success("Product deleted");
      fetchProducts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Error deleting product");
    }
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;

    try {
      await api.delete(`/products/${productToDelete.id}`);
      toast.success("Product deleted");
      fetchProducts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Error deleting product");
    } finally {
      setDeleteOpen(false);
      setProductToDelete(null);
    }
  };

  // --- Derived Data: search, sort, paginate ---
  const filtered = useMemo(() => {
    let data = products.filter(
      (p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase()) ||
        p.category?.name.toLowerCase().includes(search.toLowerCase()),
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
  }, [products, search, sortBy, sortDir]);

  const paginated = useMemo(() => {
    const start = (page - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, page, perPage]);

  const totalPages = Math.ceil(filtered.length / perPage);

  const handleSort = (key: keyof Product) => {
    if (sortBy === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  return (
    <ProtectedRoute>
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-semibold">Products</h1>
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
            placeholder="Search products..."
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
                  { key: "sku", label: "SKU" },
                  { key: "cost", label: "Cost" },
                  { key: "price", label: "Price" },
                  { key: "quantity", label: "Qty" },
                  { key: "category", label: "Category" },
                ].map((col) => (
                  <TableHead
                    key={col.key}
                    className="cursor-pointer select-none"
                    onClick={() => handleSort(col.key as keyof Product)}
                  >
                    {col.label}{" "}
                    {sortBy === col.key && (sortDir === "asc" ? "↑" : "↓")}
                  </TableHead>
                ))}
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((prod) => (
                <TableRow key={prod.id}>
                  <TableCell>{prod.id}</TableCell>
                  <TableCell>{prod.name}</TableCell>
                  <TableCell>{prod.sku}</TableCell>
                  <TableCell>{prod.cost}</TableCell>
                  <TableCell>{prod.price}</TableCell>
                  <TableCell>{prod.quantity}</TableCell>
                  <TableCell>{prod.category?.name || "-"}</TableCell>
                  <TableCell className="text-center space-x-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          className="cursor-pointer"
                          variant="outline"
                          size="icon"
                          onClick={() => handleOpenModal(prod)}
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
                            setProductToDelete(prod);
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

        {/* Modal */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="sm:max-w-md bg-white">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? "Edit" : "Add"} Product
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>SKU</Label>
                <Input
                  value={formData.sku}
                  onChange={(e) =>
                    setFormData({ ...formData, sku: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Cost</Label>
                <Input
                  type="number"
                  value={formData.cost}
                  onChange={(e) =>
                    setFormData({ ...formData, cost: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Price</Label>
                <Input
                  type="number"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({ ...formData, price: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, quantity: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Category</Label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={formData.categoryId}
                  onChange={(e) =>
                    setFormData({ ...formData, categoryId: e.target.value })
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

              <div className="flex justify-end space-x-2">
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

        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent className="sm:max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="text-red-600">Delete Product</DialogTitle>
            </DialogHeader>

            <p className="text-sm text-gray-600">
              Are you sure you want to delete{" "}
              <span className="font-semibold">{productToDelete?.name}</span>?
              This action cannot be undone.
            </p>

            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="ghost"
                onClick={() => {
                  setDeleteOpen(false);
                  setProductToDelete(null);
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
