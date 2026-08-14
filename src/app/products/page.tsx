"use client";

import { useEffect, useState, useMemo, useCallback } from "react";

import api from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";
import RoleProtectedRoute from "@/components/RoleProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { can } from "@/lib/permissions";

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
  Layers,
  Wand2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import dayjs from "dayjs";
import { motion } from "framer-motion";
import { downloadCSV } from "@/lib/csv";
import { buildExportCsv } from "@/lib/inventory-import/export";
import InventoryImportDialog from "@/components/inventory-import/InventoryImportDialog";
import type { MatchableProduct } from "@/lib/inventory-import/types";
import { generateSku } from "@/lib/sku";

interface Category {
  id: number;
  name: string;
}

interface Branch {
  id: number;
  name: string;
  code: string;
}

interface branch_stock {
  id: number;
  branch_id: number;
  current_stock: number;
  minimum_stock: number;
  maximum_stock?: number;
  reorder_point: number;
  branch: Branch;
}

interface Product {
  id: number;
  name: string;
  brand_name: string;
  generic_name?: string;
  sku: string;
  cost: number;
  price: number;
  dosage?: string;
  form?: string;
  expiry_date?: string;
  barcode?: string;
  requires_prescription: boolean;
  track_inventory: boolean;
  status: "ACTIVE" | "INACTIVE";
  category_id: number;
  category: Category;
  branch_stocks: branch_stock[];
  totalStock: number;
  margin_percentage?: number;
  margin_amount?: number;
}

// One delivery row from GET /stock/product/:id. The stocks table logs every
// movement; the batch modal only surfaces the incoming (PURCHASE) ones.
interface BatchRow {
  id: number;
  batch_number: string | null;
  expiry_date: string | null;
  quantity: number;
  unit_cost: string | number | null;
  supplier: string | null;
  transaction_type: string;
  created_at: string;
  branch?: Branch | null;
}

const calculateMargin = (price: number, cost: number) => {
  if (cost === 0) return 0;
  return ((price - cost) / cost) * 100;
};

const getStockForBranch = (product: Product, branch_id: number | null) => {
  if (!branch_id) return product.totalStock || 0;
  const bs = product.branch_stocks?.find((bs) => bs.branch_id === branch_id);
  return bs?.current_stock || 0;
};

const getStockStatus = (product: Product, branch_id: number | null) => {
  if (!branch_id) {
    const totalStock = product.totalStock || 0;
    if (totalStock === 0)
      return { label: "Out of Stock", color: "bg-red-100 text-red-800 border-red-200" };
    const hasLowStock = product.branch_stocks?.some(
      (bs) => bs.current_stock > 0 && bs.current_stock <= bs.reorder_point,
    );
    if (hasLowStock)
      return { label: "Low in Some Branches", color: "bg-yellow-100 text-yellow-800 border-yellow-200" };
    return { label: "In Stock", color: "bg-emerald-100 text-emerald-800 border-emerald-200" };
  }

  const branch_stock = product.branch_stocks?.find((bs) => bs.branch_id === branch_id);
  if (!branch_stock)
    return { label: "Not Available", color: "bg-gray-100 text-gray-800 border-gray-200" };

  const stock = branch_stock.current_stock || 0;
  const reorder = branch_stock.reorder_point || 20;
  const minimum = branch_stock.minimum_stock || 10;

  if (stock === 0) return { label: "Out of Stock", color: "bg-red-100 text-red-800 border-red-200" };
  if (stock <= minimum) return { label: "Critical", color: "bg-orange-100 text-orange-800 border-orange-200" };
  if (stock <= reorder) return { label: "Low Stock", color: "bg-yellow-100 text-yellow-800 border-yellow-200" };
  return { label: "In Stock", color: "bg-emerald-100 text-emerald-800 border-emerald-200" };
};

const isExpiringSoon = (expiry_date?: string) => {
  if (!expiry_date) return false;
  const daysUntilExpiry = dayjs(expiry_date).diff(dayjs(), "days");
  return daysUntilExpiry <= 30 && daysUntilExpiry >= 0;
};

const isExpired = (expiry_date?: string) => {
  if (!expiry_date) return false;
  return dayjs(expiry_date).isBefore(dayjs());
};

export default function ProductList() {
  const { user } = useAuth();
  // Stock thresholds are per-branch; edits target the branch the user is
  // currently switched to (BranchSwitcher), falling back to their home branch.
  const activeBranchId = user?.current_branch_id ?? user?.branch_id ?? null;
  const activeBranchName =
    user?.currentBranch?.name ?? user?.branch?.name ?? "your branch";
  // Product deletion stays admin-only (API: products.delete). Hide the destructive
  // controls from managers so they never hit a 403.
  const canDelete = can(user, "products.delete");

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    barcode: "",
    cost: "",
    price: "",
    expiry_date: "",
    requires_prescription: false,
    track_inventory: true,
    status: "ACTIVE" as "ACTIVE" | "INACTIVE",
    category_id: "",
    minimum_stock: "",
    reorder_point: "",
    maximum_stock: "",
    // Create-only: opening quantity, posted as a PURCHASE after the product exists.
    initial_stock: "",
    initial_stock_branch_id: "",
  });
  // True while the SKU field still holds a code we generated. Lets a category
  // change re-derive the SKU without ever overwriting one typed by hand.
  const [skuAutoFilled, setSkuAutoFilled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<keyof Product>("id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // Quick cost/price edit modal
  const [priceModalOpen, setPriceModalOpen] = useState(false);
  const [priceProduct, setPriceProduct] = useState<Product | null>(null);
  const [priceForm, setPriceForm] = useState({ cost: "", price: "" });

  // Quick add-stock modal (replaces the /stock/add link in row actions)
  const [addStockOpen, setAddStockOpen] = useState(false);
  const [addStockProduct, setAddStockProduct] = useState<Product | null>(null);
  const [addStockForm, setAddStockForm] = useState({
    quantity: "",
    cost: "",
    price: "",
    expiry_date: "",
    branch_id: "",
  });
  const [addStockLoading, setAddStockLoading] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchProduct, setBatchProduct] = useState<Product | null>(null);
  const [batchRows, setBatchRows] = useState<BatchRow[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

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
  const [filterExpiry, setFilterExpiry] = useState<"" | "expiring" | "expired">(
    "",
  );

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

  const toggleSelectOne = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      setFetchLoading(true);
      const params: any = {};
      if (activeBranchId) params.branch_id = activeBranchId;
      const res = await api.get("/products", { params });
      const parsed = res.data.map((p: any) => ({
        ...p,
        cost: parseFloat(p.cost),
        price: parseFloat(p.price),
        totalStock: p.totalStock || 0,
        requires_prescription: Boolean(p.requires_prescription),
        track_inventory: p.track_inventory !== false,
      }));
      setProducts(parsed);
    } catch {
      toast.error("Failed to fetch products");
    } finally {
      setFetchLoading(false);
    }
  }, [activeBranchId]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await api.get("/categories");
      setCategories(res.data);
    } catch {
      toast.error("Failed to load categories");
    }
  }, []);

  const fetchBranches = useCallback(async () => {
    try {
      const res = await api.get("/branches");
      setBranches(res.data);
    } catch {
      toast.error("Failed to load branches");
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetchCategories();
    fetchBranches();
  }, [fetchCategories, fetchBranches]);

  // Next free SKU for a category, derived from the SKUs already on this page
  // (`<CAT>-0001`). The API's unique check is still the authority — a race with
  // another user costs a rejected save, never a duplicate row.
  const nextSkuForCategory = useCallback(
    (categoryId: string) => {
      const category = categories.find((c) => String(c.id) === categoryId);
      return generateSku(
        category?.name,
        products.map((p) => p.sku),
      );
    },
    [categories, products],
  );

  const handleGenerateSku = useCallback(() => {
    if (!formData.category_id) {
      return toast.error("Select a category first — the SKU prefix comes from it");
    }
    setFormData((prev) => ({
      ...prev,
      sku: nextSkuForCategory(prev.category_id),
    }));
    setSkuAutoFilled(true);
  }, [formData.category_id, nextSkuForCategory]);

  const handleOpenModal = useCallback((product?: Product) => {
    setSkuAutoFilled(false);
    if (product) {
      setEditingProduct(product);
      // Prefill thresholds from the active branch's stock row (if any).
      const bs = product.branch_stocks?.find(
        (b) => b.branch_id === activeBranchId,
      );
      setFormData({
        name: product.name,
        sku: product.sku,
        barcode: product.barcode || "",
        cost: product.cost.toString(),
        price: product.price.toString(),
        expiry_date: product.expiry_date
          ? dayjs(product.expiry_date).format("YYYY-MM-DD")
          : "",
        requires_prescription: product.requires_prescription || false,
        track_inventory: product.track_inventory !== false,
        status: product.status,
        category_id: product.category_id.toString(),
        minimum_stock: bs?.minimum_stock != null ? String(bs.minimum_stock) : "",
        reorder_point: bs?.reorder_point != null ? String(bs.reorder_point) : "",
        maximum_stock: bs?.maximum_stock != null ? String(bs.maximum_stock) : "",
        initial_stock: "",
        initial_stock_branch_id: "",
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: "",
        sku: "",
        barcode: "",
        cost: "",
        price: "",
        expiry_date: "",
        requires_prescription: false,
        track_inventory: true,
        status: "ACTIVE",
        category_id: "",
        minimum_stock: "",
        reorder_point: "",
        maximum_stock: "",
        initial_stock: "",
        initial_stock_branch_id: "",
      });
    }
    setModalOpen(true);
  }, [activeBranchId]);

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setEditingProduct(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    const {
      name,
      sku,
      barcode,
      cost,
      price,
      expiry_date,
      requires_prescription,
      track_inventory,
      status,
      category_id,
      minimum_stock,
      reorder_point,
      maximum_stock,
      initial_stock,
      initial_stock_branch_id,
    } = formData;

    if (!name || !sku || !cost || !price || !category_id) {
      return toast.error(
        "Name, SKU, Cost, Price and Category are required",
      );
    }

    // Opening stock is create-only. Validate before the product is inserted so
    // a bad quantity doesn't leave a product behind with no stock movement.
    const openingQty = initial_stock !== "" ? parseInt(initial_stock) : 0;
    if (!editingProduct && initial_stock !== "") {
      if (isNaN(openingQty) || openingQty < 0) {
        return toast.error("Initial stock must be zero or a positive number");
      }
      if (openingQty > 0 && !activeBranchId && !initial_stock_branch_id) {
        return toast.error("Select a branch to receive the initial stock");
      }
    }

    try {
      setLoading(true);
      // API request contract is camelCase (see productController req.body); form
      // state stays snake_case because it mirrors the snake_case API responses.
      const payload = {
        name,
        sku,
        barcode: formData.barcode || null,
        cost: parseFloat(cost),
        price: parseFloat(price),
        expiryDate: expiry_date || null,
        requiresPrescription: requires_prescription,
        trackInventory: track_inventory,
        status,
        categoryId: parseInt(category_id),
      };

      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, payload);
        // Best-effort: update this branch's stock thresholds. Kept separate so a
        // missing stock.write permission doesn't fail the product save itself.
        if (
          activeBranchId &&
          (minimum_stock !== "" || reorder_point !== "" || maximum_stock !== "")
        ) {
          try {
            await api.patch(
              `/products/${editingProduct.id}/branch/${activeBranchId}/stock`,
              {
                minimumStock: minimum_stock !== "" ? parseInt(minimum_stock) : undefined,
                reorderPoint: reorder_point !== "" ? parseInt(reorder_point) : undefined,
                maximumStock: maximum_stock !== "" ? parseInt(maximum_stock) : undefined,
              },
            );
          } catch {
            toast.error("Product saved, but stock thresholds couldn't be updated");
          }
        }
        toast.success("Product updated successfully");
      } else {
        const res = await api.post("/products", payload);
        // Opening stock goes through /stock/add rather than the createProduct
        // branchStocks input, so it lands in the `stocks` ledger and shows up in
        // stock history and the Batches modal like any other delivery.
        if (openingQty > 0) {
          try {
            await api.post("/stock/add", {
              productId: res.data.id,
              quantity: openingQty,
              unitCost: parseFloat(cost),
              sellingPrice: parseFloat(price),
              expiryDate: expiry_date || undefined,
              branchId: initial_stock_branch_id !== ""
                ? parseInt(initial_stock_branch_id)
                : undefined,
            });
            toast.success(`Product created with ${openingQty} in stock`);
          } catch {
            toast.error(
              "Product created, but the initial stock couldn't be added — use Add Stock on the row",
            );
          }
        } else {
          toast.success("Product created successfully");
        }
      }
      handleCloseModal();
      fetchProducts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Error saving product");
    } finally {
      setLoading(false);
    }
  }, [editingProduct, formData, handleCloseModal, fetchProducts, activeBranchId]);

  const confirmDelete = useCallback(async () => {
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
  }, [productToDelete, fetchProducts]);

  const handleBulkDelete = useCallback(async () => {
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
  }, [selectedIds, fetchProducts]);

  const openPriceModal = useCallback((product: Product) => {
    setPriceProduct(product);
    setPriceForm({
      cost: product.cost.toString(),
      price: product.price.toString(),
    });
    setPriceModalOpen(true);
  }, []);

  const savePrice = useCallback(async () => {
    if (!priceProduct) return;
    const cost = parseFloat(priceForm.cost);
    const price = parseFloat(priceForm.price);
    if (isNaN(cost) || isNaN(price) || cost < 0 || price < 0) {
      return toast.error("Cost and Price must be valid numbers");
    }
    try {
      setLoading(true);
      await api.put(`/products/${priceProduct.id}`, { cost, price });
      // Patch the row in place instead of refetching the whole list — avoids
      // the full-table "Loading products..." flash for a two-field change.
      setProducts((prev) =>
        prev.map((p) => (p.id === priceProduct.id ? { ...p, cost, price } : p)),
      );
      toast.success("Pricing updated");
      setPriceModalOpen(false);
      setPriceProduct(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Error updating pricing");
    } finally {
      setLoading(false);
    }
  }, [priceProduct, priceForm]);

  const openAddStock = useCallback((product: Product) => {
    setAddStockProduct(product);
    setAddStockForm({ quantity: "", cost: "", price: "", expiry_date: "", branch_id: "" });
    setAddStockOpen(true);
  }, []);

  const saveAddStock = useCallback(async () => {
    if (!addStockProduct) return;
    const quantity = parseInt(addStockForm.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      return toast.error("Quantity must be a positive number");
    }
    // Admin in all-branches view has no session branch — the modal requires one.
    if (!activeBranchId && !addStockForm.branch_id) {
      return toast.error("Select a branch to receive the stock");
    }
    const targetBranchId = activeBranchId ?? parseInt(addStockForm.branch_id);
    const newCost = addStockForm.cost !== "" ? parseFloat(addStockForm.cost) : undefined;
    const newPrice = addStockForm.price !== "" ? parseFloat(addStockForm.price) : undefined;
    const newExpiry = addStockForm.expiry_date !== "" ? addStockForm.expiry_date : undefined;
    try {
      setAddStockLoading(true);
      await api.post("/stock/add", {
        productId: addStockProduct.id,
        quantity,
        unitCost: newCost,
        sellingPrice: newPrice,
        expiryDate: newExpiry,
        branchId: addStockForm.branch_id !== "" ? parseInt(addStockForm.branch_id) : undefined,
      });
      // Patch the row in place instead of refetching the whole list — avoids
      // the full-table "Loading products..." flash for a stock top-up.
      setProducts((prev) =>
        prev.map((p) => {
          if (p.id !== addStockProduct.id) return p;
          const branch_stocks = p.branch_stocks?.map((bs) =>
            bs.branch_id === targetBranchId
              ? { ...bs, current_stock: (bs.current_stock || 0) + quantity }
              : bs,
          );
          return {
            ...p,
            totalStock: (p.totalStock || 0) + quantity,
            cost: newCost ?? p.cost,
            price: newPrice ?? p.price,
            expiry_date: newExpiry ?? p.expiry_date,
            branch_stocks,
          };
        }),
      );
      toast.success(
        newCost !== undefined || newPrice !== undefined || newExpiry !== undefined
          ? "Stock added and product details updated"
          : "Stock added",
      );
      setAddStockOpen(false);
      setAddStockProduct(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Error adding stock");
    } finally {
      setAddStockLoading(false);
    }
  }, [addStockProduct, addStockForm, activeBranchId]);

  // Batch list = the product's incoming deliveries, each carrying its own batch
  // number and expiry. The API scopes rows to the caller's active branch (an
  // admin in all-branches view gets every branch, hence the Branch column).
  const openBatches = useCallback(async (product: Product) => {
    setBatchProduct(product);
    setBatchRows([]);
    setBatchOpen(true);
    setBatchLoading(true);
    try {
      const res = await api.get(`/stock/product/${product.id}`, {
        params: { limit: 200 },
      });
      const rows: BatchRow[] = (res.data?.stocks ?? []).filter(
        (r: BatchRow) => r.transaction_type === "PURCHASE",
      );
      // Soonest expiry first so what needs moving sits at the top; rows with no
      // expiry recorded sink to the bottom rather than masquerading as urgent.
      rows.sort((a, b) => {
        if (!a.expiry_date && !b.expiry_date)
          return dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf();
        if (!a.expiry_date) return 1;
        if (!b.expiry_date) return -1;
        return dayjs(a.expiry_date).valueOf() - dayjs(b.expiry_date).valueOf();
      });
      setBatchRows(rows);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Error loading batches");
    } finally {
      setBatchLoading(false);
    }
  }, []);

  const filtered = useMemo(() => {
    let data = products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.brand_name.toLowerCase().includes(search.toLowerCase()) ||
        p.generic_name?.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase()) ||
        p.category?.name.toLowerCase().includes(search.toLowerCase());

      const matchesCategory =
        !filterCategory || p.category_id === filterCategory;

      const matchesStatus = !filterStatus || p.status === filterStatus;

      const matchesStockStatus = (() => {
        if (!filterStockStatus) return true;
        const stock = getStockForBranch(p, activeBranchId);
        const reorder_point = activeBranchId
          ? (p.branch_stocks?.find((bs) => bs.branch_id === activeBranchId)
              ?.reorder_point ?? 20)
          : Math.min(
              ...(p.branch_stocks?.map((bs) => bs.reorder_point) ?? [20]),
            );
        if (filterStockStatus === "out") return stock === 0;
        if (filterStockStatus === "low")
          return stock > 0 && stock <= reorder_point;
        if (filterStockStatus === "in") return stock > reorder_point;
        return true;
      })();

      const matchesExpiry = (() => {
        if (!filterExpiry) return true;
        if (filterExpiry === "expired") return isExpired(p.expiry_date);
        return isExpiringSoon(p.expiry_date); // "expiring" = within 30 days
      })();

      return (
        matchesSearch &&
        matchesCategory &&
        matchesStatus &&
        matchesStockStatus &&
        matchesExpiry
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
    filterExpiry,
    activeBranchId,
  ]);

  // The import library takes a narrow product shape so it stays independent of
  // this page's Product interface. current_stock is branch-scoped, so resolve it
  // against the branch the user is actually looking at.
  const toMatchable = useCallback(
    (p: Product): MatchableProduct => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode ?? null,
      cost: p.cost,
      price: p.price,
      expiry_date: p.expiry_date ?? null,
      requires_prescription: p.requires_prescription,
      track_inventory: p.track_inventory,
      status: p.status,
      category_id: p.category_id,
      currentStock: getStockForBranch(p, activeBranchId ?? null),
    }),
    [activeBranchId],
  );

  // Full catalogue — the dialog matches CSV rows against this. Must NOT be the
  // filtered list, or a filtered-out SKU would be treated as a new product.
  const matchableProducts = useMemo(
    () => products.map(toMatchable),
    [products, toMatchable],
  );

  // What Export CSV writes: only the rows the user currently has in view.
  const exportProducts = useMemo(
    () => filtered.map(toMatchable),
    [filtered, toMatchable],
  );

  // Exports the FILTERED view, matching what the user is looking at and what
  // the old products export did. Safe with a partial file: the import only
  // touches columns present in the header and only sends rows that changed, so
  // products absent from the file are left alone.
  //
  // Note this is deliberately NOT the same list handed to the dialog. The dialog
  // needs every product for matching — give it the filtered list and any
  // filtered-out SKU in the CSV would look unmatched and be created as a
  // DUPLICATE product.
  const handleExportCSV = () => {
    if (exportProducts.length === 0) {
      toast.error("Nothing to export");
      return;
    }
    const csv = buildExportCsv(exportProducts, categories);
    downloadCSV(`inventory_${dayjs().format("YYYY-MM-DD_HHmm")}.csv`, csv);
    toast.success(`Exported ${exportProducts.length} products`);
  };

  const paginated = useMemo(() => {
    const start = (page - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, page, perPage]);

  const totalPages = Math.ceil(filtered.length / perPage);

  const allSelected =
    paginated.length > 0 && paginated.every((p) => selectedIds.has(p.id));
  const someSelected = selectedIds.size > 0;

  const handleSort = useCallback((key: keyof Product) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  }, [sortBy]);

  const handleBulkEditCategory = useCallback(async () => {
    if (!bulkEditCategoryId) return;
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          api.put(`/products/${id}`, { categoryId: parseInt(bulkEditCategoryId) }),
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
  }, [bulkEditCategoryId, selectedIds, fetchProducts]);

  const { activeCount, lowStockCount, totalValue } = useMemo(() => {
    const activeCount = products.filter((p) => p.status === "ACTIVE").length;
    const lowStockCount = activeBranchId
      ? products.filter((p) => {
          const bs = p.branch_stocks?.find((bs) => bs.branch_id === activeBranchId);
          return bs && bs.current_stock <= bs.reorder_point;
        }).length
      : products.filter((p) =>
          p.branch_stocks?.some((bs) => bs.current_stock <= bs.reorder_point),
        ).length;
    const totalValue = products.reduce((sum, p) => {
      const stock = activeBranchId ? getStockForBranch(p, activeBranchId) : p.totalStock;
      return sum + p.price * stock;
    }, 0);
    return { activeCount, lowStockCount, totalValue };
  }, [products, activeBranchId]);

  if (fetchLoading) {
    return (
      <RoleProtectedRoute requiredPermissions={["products.write"]}>
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
    <RoleProtectedRoute requiredPermissions={["products.write"]}>
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setImportOpen(true)}
                      className="border-emerald-300 hover:bg-emerald-50 h-9"
                    >
                      <Upload className="h-4 w-4 mr-2 text-emerald-600" />
                      Import CSV
                    </Button>
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
                      {canDelete && (
                        <Button
                          size="sm"
                          onClick={() => setBulkDeleteOpen(true)}
                          className="bg-red-600 hover:bg-red-700 text-white h-9"
                        >
                          <Trash className="h-4 w-4 mr-1" />
                          Delete Selected
                        </Button>
                      )}
                    </motion.div>
                  )}
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

                    {/* Expiry Filter */}
                    <select
                      value={filterExpiry}
                      onChange={(e) => {
                        setFilterExpiry(
                          e.target.value as "" | "expiring" | "expired",
                        );
                        setPage(1);
                      }}
                      className="border-2 border-emerald-200 rounded-lg px-3 py-2 text-sm font-medium focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"
                    >
                      <option value="">All Expiry</option>
                      <option value="expiring">Expiring Soon (≤30d)</option>
                      <option value="expired">Expired</option>
                    </select>

                    {/* Clear filters button — only shown when any filter is active */}
                    {(filterCategory ||
                      filterStatus ||
                      filterStockStatus ||
                      filterExpiry ||
                      search) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFilterCategory(null);
                          setFilterStatus("");
                          setFilterStockStatus("");
                          setFilterExpiry("");
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

                          const stock = getStockForBranch(prod, activeBranchId);
                          const stockStatus = getStockStatus(
                            prod,
                            activeBranchId,
                          );
                          const expiringSoon = isExpiringSoon(prod.expiry_date);
                          const expired = isExpired(prod.expiry_date);

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
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {prod.requires_prescription && (
                                      <Badge
                                        variant="outline"
                                        className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                                      >
                                        <FileText className="h-3 w-3 mr-1" />
                                        Rx
                                      </Badge>
                                    )}
                                    {prod.track_inventory === false && (
                                      <Badge
                                        variant="outline"
                                        className="text-xs bg-slate-100 text-slate-600 border-slate-200"
                                      >
                                        Non-stock
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
                              <TableCell
                                className="font-semibold text-gray-800 cursor-pointer hover:bg-emerald-50 rounded transition-colors"
                                onClick={() => openPriceModal(prod)}
                                title="Click to edit cost/price"
                              >
                                ₱{prod.cost.toFixed(2)}
                              </TableCell>
                              <TableCell
                                className="font-semibold text-emerald-600 cursor-pointer hover:bg-emerald-50 rounded transition-colors"
                                onClick={() => openPriceModal(prod)}
                                title="Click to edit cost/price"
                              >
                                ₱{prod.price.toFixed(2)}
                              </TableCell>
                              <TableCell className={`font-bold ${marginColor}`}>
                                {margin.toFixed(2)}%
                              </TableCell>
                              <TableCell
                                className="cursor-pointer hover:bg-emerald-50 rounded transition-colors"
                                onClick={() => openAddStock(prod)}
                                title="Click to add stock"
                              >
                                <span className="font-bold text-gray-800">
                                  {stock}
                                </span>
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
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openBatches(prod)}
                                    title="View batches & expiry"
                                    className="h-8 w-8 hover:bg-amber-50"
                                  >
                                    <Layers className="h-4 w-4 text-amber-600" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleOpenModal(prod)}
                                    title="Edit product"
                                    className="h-8 w-8 hover:bg-blue-50"
                                  >
                                    <Pencil className="h-4 w-4 text-blue-600" />
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
                  <div>
                    <Label className="mb-2 text-sm font-semibold text-gray-700">
                      SKU *
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={formData.sku}
                        onChange={(e) => {
                          setSkuAutoFilled(false);
                          setFormData({ ...formData, sku: e.target.value });
                        }}
                        placeholder="e.g., MED-0001"
                        className="h-11 flex-1 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleGenerateSku}
                        className="h-11 shrink-0 border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                      >
                        <Wand2 className="w-4 h-4 mr-2" />
                        Generate
                      </Button>
                    </div>
                    <p className="mt-1.5 text-xs text-gray-500">
                      Autofills as <span className="font-mono">CAT-0001</span>{" "}
                      from the category, continuing that prefix&apos;s numbering.
                    </p>
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
                        value={formData.expiry_date}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            expiry_date: e.target.value,
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
                        value={formData.category_id}
                        onChange={(e) => {
                          const category_id = e.target.value;
                          // Autofill the SKU on create when the field is empty or
                          // still holds a code we generated; a hand-typed SKU wins.
                          const autofill =
                            !editingProduct &&
                            !!category_id &&
                            (formData.sku === "" || skuAutoFilled);
                          setFormData({
                            ...formData,
                            category_id,
                            sku: autofill
                              ? nextSkuForCategory(category_id)
                              : formData.sku,
                          });
                          if (autofill) setSkuAutoFilled(true);
                        }}
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-linear-to-r from-emerald-50 to-green-50 rounded-xl border-2 border-emerald-200">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          id="requires_prescription"
                          checked={formData.requires_prescription}
                          onCheckedChange={(checked) =>
                            setFormData({
                              ...formData,
                              requires_prescription: !!checked,
                            })
                          }
                          className="border-blue-600 data-[state=checked]:bg-blue-600"
                        />
                        <Label
                          htmlFor="requires_prescription"
                          className="cursor-pointer font-semibold text-gray-800"
                        >
                          Requires Prescription
                        </Label>
                      </div>

                      <div className="flex items-start space-x-3">
                        <Checkbox
                          id="track_inventory"
                          checked={formData.track_inventory}
                          onCheckedChange={(checked) =>
                            setFormData({
                              ...formData,
                              track_inventory: !!checked,
                            })
                          }
                          className="mt-0.5 border-emerald-600 data-[state=checked]:bg-emerald-600"
                        />
                        <div>
                          <Label
                            htmlFor="track_inventory"
                            className="cursor-pointer font-semibold text-gray-800"
                          >
                            Track Inventory
                          </Label>
                          <p className="text-xs text-gray-500">
                            Uncheck for services / non-stock items — they sell
                            without stock limits.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label className="mb-2 text-sm font-semibold text-gray-700">
                        Status
                      </Label>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            status:
                              formData.status === "ACTIVE"
                                ? "INACTIVE"
                                : "ACTIVE",
                          })
                        }
                        className={`w-full flex items-center justify-between border-2 rounded-lg px-3 py-2 transition-colors ${
                          formData.status === "ACTIVE"
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                            : "border-gray-300 bg-gray-50 text-gray-500"
                        }`}
                      >
                        <span className="font-semibold">
                          {formData.status === "ACTIVE" ? "Active" : "Inactive"}
                        </span>
                        {formData.status === "ACTIVE" ? (
                          <ToggleRight className="h-6 w-6 text-emerald-600" />
                        ) : (
                          <ToggleLeft className="h-6 w-6 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Initial stock — create only. Posted as a PURCHASE after the
                    product exists, so it appears in stock history / batches. */}
                {!editingProduct && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b-2 border-emerald-100">
                      <Package className="h-5 w-5 text-emerald-600" />
                      <h3 className="font-bold text-gray-800">
                        Initial Stock
                        <span className="ml-2 text-xs font-medium text-gray-500">
                          optional
                        </span>
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="mb-2 text-sm font-semibold text-gray-700">
                          Quantity on hand
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          value={formData.initial_stock}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              initial_stock: e.target.value,
                            })
                          }
                          placeholder="0"
                          className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                        />
                      </div>
                      {activeBranchId ? (
                        <div className="flex items-end">
                          <p className="text-sm text-gray-600 pb-2.5">
                            Received at{" "}
                            <span className="font-semibold text-gray-800">
                              {activeBranchName}
                            </span>
                          </p>
                        </div>
                      ) : (
                        <div>
                          <Label className="mb-2 text-sm font-semibold text-gray-700">
                            Receiving branch
                            {formData.initial_stock !== "" &&
                              parseInt(formData.initial_stock) > 0 &&
                              " *"}
                          </Label>
                          <select
                            className="w-full border-2 border-emerald-200 rounded-lg px-3 py-2.5 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"
                            value={formData.initial_stock_branch_id}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                initial_stock_branch_id: e.target.value,
                              })
                            }
                          >
                            <option value="">Select branch</option>
                            {branches.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      Recorded as a stock delivery using the Cost, Price and
                      Expiry Date above, so it shows in stock history and
                      batches. Leave blank to start at zero.
                    </p>
                  </div>
                )}

                {/* Stock thresholds — edit only; targets the active branch's row */}
                {editingProduct && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b-2 border-emerald-100">
                      <Building2 className="h-5 w-5 text-emerald-600" />
                      <h3 className="font-bold text-gray-800">
                        Stock Thresholds
                        <span className="ml-2 text-xs font-medium text-gray-500">
                          {activeBranchName}
                        </span>
                      </h3>
                    </div>
                    {activeBranchId ? (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <Label className="mb-2 text-sm font-semibold text-gray-700">
                              Critical (min)
                            </Label>
                            <Input
                              type="number"
                              min="0"
                              value={formData.minimum_stock}
                              onChange={(e) =>
                                setFormData({ ...formData, minimum_stock: e.target.value })
                              }
                              placeholder="e.g., 10"
                              className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                            />
                          </div>
                          <div>
                            <Label className="mb-2 text-sm font-semibold text-gray-700">
                              Reorder (low)
                            </Label>
                            <Input
                              type="number"
                              min="0"
                              value={formData.reorder_point}
                              onChange={(e) =>
                                setFormData({ ...formData, reorder_point: e.target.value })
                              }
                              placeholder="e.g., 20"
                              className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                            />
                          </div>
                          <div>
                            <Label className="mb-2 text-sm font-semibold text-gray-700">
                              Maximum
                            </Label>
                            <Input
                              type="number"
                              min="0"
                              value={formData.maximum_stock}
                              onChange={(e) =>
                                setFormData({ ...formData, maximum_stock: e.target.value })
                              }
                              placeholder="optional"
                              className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                            />
                          </div>
                        </div>
                        <p className="text-xs text-gray-500">
                          Stock at or below Critical is flagged Critical; at or below
                          Reorder is Low Stock. Applies to {activeBranchName}.
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-gray-500">
                        Switch to a branch to set its stock thresholds.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                {editingProduct && canDelete && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setProductToDelete(editingProduct);
                      setModalOpen(false);
                      setDeleteOpen(true);
                    }}
                    disabled={loading}
                    className="w-full sm:w-auto sm:mr-auto border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                )}
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
                  className="w-full sm:w-auto bg-linear-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white"
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
          {/* Quick cost/price edit */}
          <Dialog open={priceModalOpen} onOpenChange={setPriceModalOpen}>
            <DialogContent className="sm:max-w-md bg-white">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <DollarSign className="h-6 w-6 text-emerald-600" />
                  Edit Pricing - {priceProduct?.name}
                </DialogTitle>
              </DialogHeader>

              <div className="py-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="mb-2 text-sm font-semibold text-gray-700">
                      Cost *
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={priceForm.cost}
                      onChange={(e) =>
                        setPriceForm({ ...priceForm, cost: e.target.value })
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
                      value={priceForm.price}
                      onChange={(e) =>
                        setPriceForm({ ...priceForm, price: e.target.value })
                      }
                      placeholder="0.00"
                      className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                    />
                  </div>
                </div>
                {priceForm.cost && priceForm.price && (
                  <div className="p-3 bg-emerald-50 border-2 border-emerald-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm font-semibold text-gray-800">
                        Margin:{" "}
                        <span className="text-emerald-600">
                          {calculateMargin(
                            parseFloat(priceForm.price),
                            parseFloat(priceForm.cost),
                          ).toFixed(2)}
                          %
                        </span>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setPriceModalOpen(false)}
                  className="border-gray-300"
                >
                  Cancel
                </Button>
                <Button
                  onClick={savePrice}
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Quick add stock */}
          <Dialog open={addStockOpen} onOpenChange={setAddStockOpen}>
            <DialogContent className="sm:max-w-md bg-white">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <Package className="h-6 w-6 text-purple-600" />
                  Add Stock - {addStockProduct?.name}
                </DialogTitle>
              </DialogHeader>

              <div className="py-4 space-y-4">
                {!activeBranchId && (
                  <div>
                    <Label className="mb-2 text-sm font-semibold text-gray-700">
                      Branch *
                    </Label>
                    <select
                      className="w-full border-2 border-emerald-200 rounded-lg px-3 py-2.5 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"
                      value={addStockForm.branch_id}
                      onChange={(e) =>
                        setAddStockForm({
                          ...addStockForm,
                          branch_id: e.target.value,
                        })
                      }
                    >
                      <option value="">Select branch</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <Label className="mb-2 text-sm font-semibold text-gray-700">
                    Quantity *
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    value={addStockForm.quantity}
                    onChange={(e) =>
                      setAddStockForm({
                        ...addStockForm,
                        quantity: e.target.value,
                      })
                    }
                    placeholder="0"
                    className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="mb-2 text-sm font-semibold text-gray-700">
                      New Cost
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={addStockForm.cost}
                      onChange={(e) =>
                        setAddStockForm({
                          ...addStockForm,
                          cost: e.target.value,
                        })
                      }
                      placeholder={addStockProduct ? addStockProduct.cost.toFixed(2) : "0.00"}
                      className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                    />
                  </div>
                  <div>
                    <Label className="mb-2 text-sm font-semibold text-gray-700">
                      New Price
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={addStockForm.price}
                      onChange={(e) =>
                        setAddStockForm({
                          ...addStockForm,
                          price: e.target.value,
                        })
                      }
                      placeholder={addStockProduct ? addStockProduct.price.toFixed(2) : "0.00"}
                      className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                    />
                  </div>
                </div>
                <div>
                  <Label className="mb-2 text-sm font-semibold text-gray-700">
                    New Expiry Date
                  </Label>
                  <Input
                    type="date"
                    value={addStockForm.expiry_date}
                    onChange={(e) =>
                      setAddStockForm({
                        ...addStockForm,
                        expiry_date: e.target.value,
                      })
                    }
                    className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                  />
                  {addStockProduct?.expiry_date && (
                    <p className="mt-1 text-xs text-gray-500">
                      Current: {dayjs(addStockProduct.expiry_date).format("MMM D, YYYY")}
                    </p>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  Leave a field blank to keep its current value. Filling
                  cost, price, or expiry also updates the product&apos;s
                  master record.
                </p>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setAddStockOpen(false)}
                  className="border-gray-300"
                >
                  Cancel
                </Button>
                <Button
                  onClick={saveAddStock}
                  disabled={addStockLoading}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {addStockLoading && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Add Stock
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Batch / expiry list */}
          <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
            <DialogContent className="sm:max-w-2xl bg-white">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <Layers className="h-6 w-6 text-amber-600" />
                  Batches - {batchProduct?.name}
                </DialogTitle>
              </DialogHeader>

              <div className="py-2">
                {batchLoading ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-gray-500">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading batches...
                  </div>
                ) : batchRows.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-10 text-gray-500">
                    <Package className="h-8 w-8 text-gray-300" />
                    <p className="text-sm">No deliveries recorded yet</p>
                  </div>
                ) : (
                  <div className="border-2 border-amber-100 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-amber-50 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2 font-semibold text-gray-700">
                            Batch No
                          </th>
                          <th className="text-left px-3 py-2 font-semibold text-gray-700">
                            Expiry
                          </th>
                          <th className="text-right px-3 py-2 font-semibold text-gray-700">
                            Qty In
                          </th>
                          <th className="text-left px-3 py-2 font-semibold text-gray-700">
                            Received
                          </th>
                          {!activeBranchId && (
                            <th className="text-left px-3 py-2 font-semibold text-gray-700">
                              Branch
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {batchRows.map((row) => {
                          const expired = isExpired(row.expiry_date ?? undefined);
                          const soon = isExpiringSoon(row.expiry_date ?? undefined);
                          return (
                            <tr
                              key={row.id}
                              className="border-t border-amber-50 hover:bg-amber-50/40"
                            >
                              <td className="px-3 py-2 font-mono text-xs text-gray-700">
                                {row.batch_number || "—"}
                              </td>
                              <td className="px-3 py-2">
                                {row.expiry_date ? (
                                  <Badge
                                    variant="outline"
                                    className={
                                      expired
                                        ? "bg-red-100 text-red-800 border-red-200"
                                        : soon
                                          ? "bg-amber-100 text-amber-800 border-amber-200"
                                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    }
                                  >
                                    {dayjs(row.expiry_date).format("MMM D, YYYY")}
                                    {expired
                                      ? " · Expired"
                                      : soon
                                        ? " · Soon"
                                        : ""}
                                  </Badge>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right font-bold text-emerald-700">
                                +{row.quantity}
                              </td>
                              <td className="px-3 py-2 text-gray-600 text-xs">
                                {dayjs(row.created_at).format("MMM D, YYYY")}
                              </td>
                              {!activeBranchId && (
                                <td className="px-3 py-2 text-gray-600 text-xs">
                                  {row.branch?.name || "—"}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="mt-3 text-xs text-gray-500">
                  Delivery history — quantity received per batch. Stock is
                  deducted from the branch total, not from a specific batch, so
                  these figures are not remaining-per-batch counts.
                </p>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setBatchOpen(false)}
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
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
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
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
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
                  className="w-full sm:w-auto bg-linear-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white"
                >
                  Apply to {selectedIds.size} Products
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <InventoryImportDialog
            open={importOpen}
            onOpenChange={setImportOpen}
            products={matchableProducts}
            categories={categories}
            branchId={activeBranchId ?? null}
            branchName={activeBranchName}
            onDone={() => {
              fetchProducts();
              fetchCategories();
            }}
          />
        </div>
      </ProtectedRoute>
    </RoleProtectedRoute>
  );
}
