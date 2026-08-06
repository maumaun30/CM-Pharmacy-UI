"use client";

import React, { useState, useEffect, useCallback } from "react";

import api from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
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
import ProductCombobox from "@/components/ProductCombobox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import dayjs from "dayjs";
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
  Upload,
  Download,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Product {
  id: number;
  name: string;
  sku: string;
  barcode?: string;
  category?: string;
  cost: number;
  price: number;
  current_stock: number;
}

interface Branch {
  id: number;
  name: string;
  code: string;
}

interface ImportPreviewRow {
  csvName: string;
  csvSku: string;
  csvBarcode: string;
  csvDelta: number;
  matchedProduct: Product | null;
  matchedBy: "sku" | "barcode" | "name" | null;
  status: "matched" | "unmatched";
}

const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
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

// The adjustment column is a DELTA, not a target level: +10 adds ten, -5 removes
// five. "Total Stock" is the header the /stock/add export already writes, so the
// same exported file works on both pages; "Adjustment" is accepted as an alias
// for files people build by hand. parseInt handles a leading "+" fine.
const ADJUSTMENT_HEADERS = ["Adjustment", "Total Stock"];

const REASON_MAX = 500;

const StockAdjustPage = () => {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const activeBranch = user?.currentBranch ?? user?.branch ?? null;

  const [products, setProducts] = useState<Product[]>([]);
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

  // CSV bulk-adjust state
  const [importLoading, setImportLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreviewRow[] | null>(
    null,
  );
  const [showUnmatched, setShowUnmatched] = useState(false);
  const [importConfirmLoading, setImportConfirmLoading] = useState(false);
  const [importReason, setImportReason] = useState("Physical count correction");

  const fetchProducts = useCallback(async (): Promise<Product[]> => {
    try {
      // Adjustments target the user's active branch, so resolve each product's
      // stock AT that branch. /products returns per-branch rows in branch_stocks
      // (snake_case); the top-level currentStock is camelCase and only present
      // when branchId is passed — reading it as current_stock is what produced
      // the NaN / blank stock. Map defensively so a missing row shows 0, not NaN.
      const branchId = activeBranch?.id;
      const res = await api.get("/products", {
        params: branchId ? { branchId } : {},
      });
      const mapped: Product[] = res.data.map((p: any) => {
        const bs = branchId
          ? p.branch_stocks?.find((b: any) => b.branch_id === branchId)
          : null;
        const raw = bs?.current_stock ?? p.currentStock ?? p.totalStock ?? 0;
        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode ?? undefined,
          category: p.category?.name ?? "",
          cost: parseFloat(p.cost) || 0,
          price: parseFloat(p.price) || 0,
          current_stock: Number(raw) || 0,
        };
      });
      setProducts(mapped);
      return mapped;
    } catch {
      toast.error("Failed to fetch products");
      return [];
    } finally {
      setFetchLoading(false);
    }
  }, [activeBranch?.id]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

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

  // Mirrors the /stock/add export so one exported file can be filled in and
  // replayed on either page. "Adjustment" ships blank as the fill-in column;
  // Category/Cost/Price are reference-only here (adjustments never touch them).
  const handleExportCSV = () => {
    if (!activeBranch) return;

    const rows = products.map((p) => ({
      Name: p.name,
      SKU: p.sku,
      Barcode: p.barcode || "",
      Category: p.category || "",
      Cost: p.cost.toFixed(2),
      Price: p.price.toFixed(2),
      "Current Stock": p.current_stock,
      Adjustment: "",
    }));

    const headers = Object.keys(rows[0] ?? {});
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
    const safeBranch = activeBranch.name.replace(/[^a-z0-9]+/gi, "-");
    a.download = `stock_adjust_${safeBranch}_${dayjs().format("YYYY-MM-DD_HHmm")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} products`);
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter(Boolean);

        const headers = parseCSVLine(lines[0]).map((h) => h.trim());

        // parseCSVLine already unescapes RFC4180 doubled quotes, so don't strip
        // quotes again — product names containing a " (e.g. 5" Syringe) would
        // get mangled and fail to match.
        const getValue = (row: string[], key: string) => {
          const idx = headers.indexOf(key);
          return idx >= 0 ? (row[idx]?.trim() ?? "") : "";
        };
        const deltaHeader =
          ADJUSTMENT_HEADERS.find((h) => headers.includes(h)) ?? null;

        if (!deltaHeader) {
          toast.error(
            'CSV needs an "Adjustment" (or "Total Stock") column with the +/- quantity',
          );
          setImportLoading(false);
          return;
        }

        const parsedRows = lines
          .slice(1)
          .map((line) => {
            const row = parseCSVLine(line);
            return {
              name: getValue(row, "Name"),
              sku: getValue(row, "SKU"),
              barcode: getValue(row, "Barcode"),
              delta: parseInt(getValue(row, deltaHeader)) || 0,
            };
          })
          .filter((r) => r.name || r.sku); // skip blank rows

        // Always refetch so matching runs against live stock, not a stale closure
        const freshProducts = await fetchProducts();

        const bySkuMap = new Map<string, Product>();
        const byBarcodeMap = new Map<string, Product>();
        const byNameMap = new Map<string, Product>();

        for (const p of freshProducts) {
          if (p.sku) bySkuMap.set(p.sku.toLowerCase(), p);
          if (p.barcode) byBarcodeMap.set(p.barcode.toLowerCase(), p);
          if (p.name) byNameMap.set(p.name.toLowerCase(), p);
        }

        const preview: ImportPreviewRow[] = parsedRows.map((row) => {
          let matchedProduct: Product | null = null;
          let matchedBy: ImportPreviewRow["matchedBy"] = null;

          // Priority: SKU > Barcode > Name
          if (row.sku && bySkuMap.has(row.sku.toLowerCase())) {
            matchedProduct = bySkuMap.get(row.sku.toLowerCase())!;
            matchedBy = "sku";
          } else if (
            row.barcode &&
            byBarcodeMap.has(row.barcode.toLowerCase())
          ) {
            matchedProduct = byBarcodeMap.get(row.barcode.toLowerCase())!;
            matchedBy = "barcode";
          } else if (row.name && byNameMap.has(row.name.toLowerCase())) {
            matchedProduct = byNameMap.get(row.name.toLowerCase())!;
            matchedBy = "name";
          }

          return {
            csvName: row.name,
            csvSku: row.sku,
            csvBarcode: row.barcode,
            csvDelta: row.delta,
            matchedProduct,
            matchedBy,
            status: matchedProduct ? "matched" : "unmatched",
          };
        });

        setImportPreview(preview);
      } catch {
        toast.error("Failed to parse CSV file");
      } finally {
        setImportLoading(false);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleConfirmImport = async () => {
    if (!importPreview || !activeBranch) return;

    const reason = importReason.trim();
    if (!reason) {
      toast.error("A reason is required for bulk adjustments");
      return;
    }

    // Zero means "no change" — the whole point of exporting every product is
    // that most rows stay blank. Only non-zero deltas are sent.
    const toImport = importPreview.filter(
      (r) => r.status === "matched" && r.csvDelta !== 0,
    );

    if (toImport.length === 0) {
      toast.error("No matched products with a non-zero adjustment");
      return;
    }

    setImportConfirmLoading(true);
    let success = 0;
    let failed = 0;
    let firstError = "";

    // Process in parallel batches of 20 to avoid overwhelming the server
    const BATCH_SIZE = 20;
    for (let i = 0; i < toImport.length; i += BATCH_SIZE) {
      const batch = toImport.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((row) =>
          api.post("/stock/adjust", {
            productId: row.matchedProduct!.id,
            quantity: row.csvDelta,
            reason,
          }),
        ),
      );

      for (const result of results) {
        if (result.status === "fulfilled") {
          success++;
        } else {
          failed++;
          if (!firstError) {
            const err = (result as PromiseRejectedResult).reason;
            firstError =
              err?.response?.data?.message ||
              err?.message ||
              "Unknown server error";
          }
        }
      }
    }

    setImportConfirmLoading(false);
    setImportPreview(null);

    if (failed > 0 && success === 0) {
      toast.error(`Bulk adjustment failed: ${firstError}`);
    } else if (failed > 0) {
      toast.warning(
        `Adjusted ${success} products, ${failed} failed. First error: ${firstError}`,
      );
      router.push("/stock");
    } else {
      toast.success(`Successfully adjusted stock for ${success} products`);
      router.push("/stock");
    }
  };

  const matchedRows =
    importPreview?.filter((r) => r.status === "matched") ?? [];
  const unmatchedRows =
    importPreview?.filter((r) => r.status === "unmatched") ?? [];
  const applicableRows = matchedRows.filter((r) => r.csvDelta !== 0);
  // The API clamps at zero (Math.max(0, before + qty)), so a deduction bigger
  // than what's on hand silently lands at 0 instead of erroring. Flag it here.
  const clampedRows = applicableRows.filter(
    (r) => r.matchedProduct!.current_stock + r.csvDelta < 0,
  );

  const selectedAdjustProduct = products.find(
    (p) => p.id === parseInt(adjustFormData.productId),
  );

  const selectedLossProduct = products.find(
    (p) => p.id === parseInt(lossFormData.productId),
  );

  const adjustQuantity = parseInt(adjustFormData.quantity) || 0;
  const newAdjustStock = selectedAdjustProduct
    ? selectedAdjustProduct.current_stock + adjustQuantity
    : 0;

  const lossQuantity = parseInt(lossFormData.quantity) || 0;
  const newLossStock = selectedLossProduct
    ? Math.max(0, selectedLossProduct.current_stock - lossQuantity)
    : 0;

  if (authLoading || fetchLoading) {
    return (
      <RoleProtectedRoute requiredPermissions={["stock.write"]}>
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
    <RoleProtectedRoute requiredPermissions={["stock.write"]}>
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
                <TabsContent value="adjust" className="mt-6 space-y-6">
                  {/* ── CSV BULK ADJUSTMENT SECTION ── */}
                  <Card className="overflow-hidden border-2 border-orange-100">
                    <div className="bg-gradient-to-r from-orange-50 to-amber-50 px-6 py-4 border-b-2 border-orange-100 flex items-center justify-between">
                      <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Upload className="h-5 w-5 text-orange-600" />
                        Bulk Adjust via CSV
                      </h3>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleExportCSV}
                          disabled={!activeBranch || products.length === 0}
                          className="border-orange-300 hover:bg-orange-50 cursor-pointer"
                        >
                          <Download className="h-4 w-4 mr-2 text-orange-600" />
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
                            className="border-orange-300 hover:bg-orange-50 cursor-pointer"
                            disabled={importLoading}
                            asChild
                          >
                            <span>
                              {importLoading ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 text-orange-600 animate-spin" />
                                  Parsing...
                                </>
                              ) : (
                                <>
                                  <Upload className="h-4 w-4 mr-2 text-orange-600" />
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
                    </div>

                    <div className="px-6 py-3 space-y-3">
                      <p className="text-xs text-gray-500">
                        CSV must include an{" "}
                        <span className="font-semibold text-gray-700">
                          Adjustment
                        </span>{" "}
                        column (the{" "}
                        <span className="font-semibold text-gray-700">
                          Total Stock
                        </span>{" "}
                        column from the Add Stock export is also accepted). The
                        value is a{" "}
                        <span className="font-semibold text-gray-700">
                          change
                        </span>
                        , not a target level:{" "}
                        <span className="font-semibold text-emerald-700">
                          +10
                        </span>{" "}
                        adds ten,{" "}
                        <span className="font-semibold text-red-700">-5</span>{" "}
                        deducts five, and blank or{" "}
                        <span className="font-semibold text-gray-700">0</span>{" "}
                        rows are skipped. Products are matched by{" "}
                        <span className="font-semibold text-gray-700">SKU</span>{" "}
                        first, then{" "}
                        <span className="font-semibold text-gray-700">
                          Barcode
                        </span>
                        , then{" "}
                        <span className="font-semibold text-gray-700">Name</span>
                        . The{" "}
                        <span className="font-semibold text-gray-700">
                          Category
                        </span>
                        ,{" "}
                        <span className="font-semibold text-gray-700">Cost</span>{" "}
                        and{" "}
                        <span className="font-semibold text-gray-700">
                          Price
                        </span>{" "}
                        columns are for reference only and are ignored on import.
                      </p>
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                          <FileText className="h-4 w-4 text-orange-600" />
                          Reason for all rows *
                        </Label>
                        <Input
                          value={importReason}
                          maxLength={REASON_MAX}
                          onChange={(e) => setImportReason(e.target.value)}
                          placeholder="e.g., Physical count correction — Aug 2026"
                          className="h-11 border-orange-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                        />
                      </div>
                    </div>

                    {/* Import Preview */}
                    <AnimatePresence>
                      {importPreview && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="px-6 pb-6 space-y-4"
                        >
                          {/* Summary */}
                          <div className="flex flex-wrap gap-3 p-4 bg-gray-50 border-2 border-gray-200 rounded-xl">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                              <span className="text-sm font-semibold text-gray-700">
                                {matchedRows.length} matched
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <AlertCircle className="h-5 w-5 text-amber-500" />
                              <span className="text-sm font-semibold text-gray-700">
                                {unmatchedRows.length} unmatched
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <TrendingUp className="h-5 w-5 text-emerald-600" />
                              <span className="text-sm font-semibold text-gray-700">
                                {
                                  applicableRows.filter((r) => r.csvDelta > 0)
                                    .length
                                }{" "}
                                additions
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <TrendingDown className="h-5 w-5 text-red-500" />
                              <span className="text-sm font-semibold text-gray-700">
                                {
                                  applicableRows.filter((r) => r.csvDelta < 0)
                                    .length
                                }{" "}
                                deductions
                              </span>
                            </div>
                          </div>

                          {clampedRows.length > 0 && (
                            <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl flex items-start gap-3">
                              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                              <div className="text-sm text-red-800">
                                <p className="font-semibold mb-1">
                                  {clampedRows.length} row
                                  {clampedRows.length === 1 ? "" : "s"} deduct
                                  more than is on hand
                                </p>
                                <p>
                                  Stock cannot go below zero — those products
                                  will land at 0 instead of the negative value.
                                  They are marked below.
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Matched rows table */}
                          {matchedRows.length > 0 && (
                            <div>
                              <p className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-1">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                Matched Products
                              </p>
                              <div className="border-2 border-orange-100 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                                <table className="w-full text-sm">
                                  <thead className="bg-orange-50 sticky top-0">
                                    <tr>
                                      <th className="text-left px-3 py-2 font-semibold text-gray-700">
                                        Product
                                      </th>
                                      <th className="text-left px-3 py-2 font-semibold text-gray-700">
                                        Matched By
                                      </th>
                                      <th className="text-right px-3 py-2 font-semibold text-gray-700">
                                        Current
                                      </th>
                                      <th className="text-right px-3 py-2 font-semibold text-gray-700">
                                        Adjustment
                                      </th>
                                      <th className="text-right px-3 py-2 font-semibold text-gray-700">
                                        New Stock
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {matchedRows.map((row, i) => {
                                      const current =
                                        row.matchedProduct!.current_stock;
                                      const raw = current + row.csvDelta;
                                      const clamped = raw < 0;
                                      return (
                                        <tr
                                          key={i}
                                          className="border-t border-orange-50 hover:bg-orange-50/50"
                                        >
                                          <td className="px-3 py-2 text-gray-800 font-medium">
                                            {row.matchedProduct?.name}
                                          </td>
                                          <td className="px-3 py-2">
                                            <Badge
                                              variant="outline"
                                              className={
                                                row.matchedBy === "sku"
                                                  ? "bg-blue-50 text-blue-700 border-blue-200 text-xs"
                                                  : row.matchedBy === "barcode"
                                                    ? "bg-purple-50 text-purple-700 border-purple-200 text-xs"
                                                    : "bg-gray-50 text-gray-700 border-gray-200 text-xs"
                                              }
                                            >
                                              {row.matchedBy?.toUpperCase()}
                                            </Badge>
                                          </td>
                                          <td className="px-3 py-2 text-right text-gray-600">
                                            {current}
                                          </td>
                                          <td
                                            className={`px-3 py-2 text-right font-bold ${
                                              row.csvDelta > 0
                                                ? "text-emerald-700"
                                                : row.csvDelta < 0
                                                  ? "text-red-700"
                                                  : "text-gray-400"
                                            }`}
                                          >
                                            {row.csvDelta === 0 ? (
                                              <span className="font-normal">
                                                skipped (0)
                                              </span>
                                            ) : (
                                              `${row.csvDelta > 0 ? "+" : ""}${row.csvDelta}`
                                            )}
                                          </td>
                                          <td className="px-3 py-2 text-right">
                                            {row.csvDelta === 0 ? (
                                              <span className="text-gray-400">
                                                —
                                              </span>
                                            ) : clamped ? (
                                              <span className="font-bold text-red-600">
                                                0
                                                <span className="ml-1 text-xs font-normal">
                                                  (clamped from {raw})
                                                </span>
                                              </span>
                                            ) : (
                                              <span className="font-bold text-gray-800">
                                                {raw}
                                              </span>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {/* Unmatched rows (collapsible) */}
                          {unmatchedRows.length > 0 && (
                            <div>
                              <button
                                type="button"
                                onClick={() => setShowUnmatched((v) => !v)}
                                className="text-sm font-semibold text-amber-600 flex items-center gap-1 hover:underline"
                              >
                                <AlertCircle className="h-4 w-4" />
                                {unmatchedRows.length} unmatched rows (will be
                                skipped)
                                {showUnmatched ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </button>
                              <AnimatePresence>
                                {showUnmatched && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mt-2 border-2 border-amber-100 rounded-xl overflow-hidden max-h-48 overflow-y-auto"
                                  >
                                    <table className="w-full text-sm">
                                      <thead className="bg-amber-50 sticky top-0">
                                        <tr>
                                          <th className="text-left px-3 py-2 font-semibold text-gray-700">
                                            CSV Name
                                          </th>
                                          <th className="text-left px-3 py-2 font-semibold text-gray-700">
                                            SKU
                                          </th>
                                          <th className="text-left px-3 py-2 font-semibold text-gray-700">
                                            Barcode
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {unmatchedRows.map((row, i) => (
                                          <tr
                                            key={i}
                                            className="border-t border-amber-50"
                                          >
                                            <td className="px-3 py-2 text-gray-600">
                                              {row.csvName || "—"}
                                            </td>
                                            <td className="px-3 py-2 text-gray-500 font-mono text-xs">
                                              {row.csvSku || "—"}
                                            </td>
                                            <td className="px-3 py-2 text-gray-500 font-mono text-xs">
                                              {row.csvBarcode || "—"}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )}

                          {/* Action buttons */}
                          <div className="flex gap-3">
                            <Button
                              onClick={handleConfirmImport}
                              disabled={
                                importConfirmLoading ||
                                applicableRows.length === 0 ||
                                !importReason.trim()
                              }
                              className="flex-1 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-bold"
                            >
                              {importConfirmLoading ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Adjusting...
                                </>
                              ) : (
                                <>
                                  <Package className="h-4 w-4 mr-2" />
                                  Confirm Adjustment ({applicableRows.length}{" "}
                                  products)
                                </>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => setImportPreview(null)}
                              disabled={importConfirmLoading}
                              className="border-gray-300 hover:bg-gray-50"
                            >
                              <X className="h-4 w-4 mr-1" />
                              Cancel
                            </Button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>

                  {/* Divider */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-orange-100" />
                    <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                      or adjust single product
                    </span>
                    <div className="flex-1 h-px bg-orange-100" />
                  </div>

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
                        <ProductCombobox
                          products={products}
                          value={adjustFormData.productId}
                          onValueChange={(value) =>
                            setAdjustFormData({
                              ...adjustFormData,
                              productId: value,
                            })
                          }
                          triggerClassName="border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                        />
                      </div>

                      {/* Current Stock Display */}
                      {selectedAdjustProduct && (
                        <div className="p-5 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border-2 border-gray-200">
                          <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
                            Current Stock Level
                          </p>
                          <p className="text-3xl font-bold text-gray-800">
                            {selectedAdjustProduct.current_stock}
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
                        <ProductCombobox
                          products={products}
                          value={lossFormData.productId}
                          onValueChange={(value) =>
                            setLossFormData({
                              ...lossFormData,
                              productId: value,
                            })
                          }
                          triggerClassName="border-red-200 focus:border-red-500 focus:ring-2 focus:ring-red-200"
                        />
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
                                {selectedLossProduct.current_stock}
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
                          max={selectedLossProduct?.current_stock}
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
