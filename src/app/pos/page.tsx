"use client";

import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
  memo,
} from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ProtectedRoute from "@/components/ProtectedRoute";
import { toast } from "sonner";
import api from "@/lib/api";
import {
  Loader2,
  Search,
  Printer,
  Tag,
  X,
  Building2,
  Scan,
  ShoppingCart,
  Trash,
  Plus,
  Minus,
  Check,
  Grid3x3,
  List,
  RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { io, Socket } from "socket.io-client";
import { useVirtualizer } from "@tanstack/react-virtual";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: number;
  name: string;
  sku: string;
  barcode?: string;
  price: number;
  currentStock: number;
  status: string;
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
  requiresVerification: boolean;
  isEnabled: boolean;
  maximumDiscountAmount: number;
}

interface CartItem {
  product: Product;
  quantity: number;
  appliedDiscount?: Discount | null;
  discountedPrice?: number;
}

interface SaleReceipt {
  items: CartItem[];
  subtotal: number;
  totalDiscount: number;
  total: number;
  cashAmount: number;
  change: number;
  date: Date;
  branchName: string;
  branchPhone: string;
  branchEmail: string;
  soldBy: string;
}

interface Branch {
  id: number;
  name: string;
  code: string;
  phone?: string;
  email?: string;
}

interface User {
  id: number;
  username: string;
  branchId: number;
  currentBranchId: number | null;
  role: string;
  branch?: Branch;
  currentBranch?: Branch;
}

type ViewMode = "grid" | "list";

// ─── Constants ────────────────────────────────────────────────────────────────

const GRID_ITEM_HEIGHT = 160;
const LIST_ITEM_HEIGHT = 88;
const GRID_COL_MIN_WIDTH = 180;
const GRID_GAP = 12;
const GRID_PADDING = 12;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calculateDiscountedPrice(price: number, discount: Discount): number {
  if (discount.discountType === "PERCENTAGE") {
    const discountAmount = (price * discount.discountValue) / 100;
    const finalDiscount = discount.maximumDiscountAmount
      ? Math.min(discountAmount, discount.maximumDiscountAmount)
      : discountAmount;
    return price - finalDiscount;
  }
  return price - Math.min(discount.discountValue, price);
}

function getItemTotal(item: CartItem): number {
  const price = item.discountedPrice ?? item.product.price;
  return price * item.quantity;
}

function useDebounce<T>(value: T, delay = 200): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// ─── Memoized sub-components ──────────────────────────────────────────────────

const CartItemDisplay = memo(
  ({
    item,
    onRemove,
    onUpdateQty,
    onOpenDiscount,
  }: {
    item: CartItem;
    onRemove: (id: number) => void;
    onUpdateQty: (id: number, qty: number) => void;
    onOpenDiscount: (item: CartItem) => void;
  }) => (
    <div className="p-4 border-b border-emerald-100 bg-white hover:bg-emerald-50/30 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 pr-3">
          <p className="font-semibold text-gray-800 text-sm mb-1">
            {item.product.name}
          </p>
          <p className="text-xs text-gray-500">SKU: {item.product.sku}</p>
          <p
            className={`text-xs mt-1 ${
              item.product.currentStock <= 10
                ? "text-orange-600 font-semibold"
                : "text-gray-500"
            }`}
          >
            Stock: {item.product.currentStock}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={() => onRemove(item.product.id)}
        >
          <Trash className="h-4 w-4" />
        </Button>
      </div>

      {item.appliedDiscount && (
        <Badge className="mb-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">
          <Tag className="h-3 w-3 mr-1" />
          {item.appliedDiscount.name}
        </Badge>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {item.appliedDiscount && item.discountedPrice ? (
            <div className="flex flex-col">
              <span className="text-xs line-through text-gray-400">
                ₱{item.product.price.toFixed(2)}
              </span>
              <span className="text-sm font-bold text-emerald-600">
                ₱{item.discountedPrice.toFixed(2)}
              </span>
            </div>
          ) : (
            <span className="text-sm font-semibold text-gray-800">
              ₱{item.product.price.toFixed(2)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0 border-emerald-300 hover:bg-emerald-50"
            onClick={() =>
              onUpdateQty(item.product.id, Math.max(1, item.quantity - 1))
            }
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="w-8 text-center font-semibold text-gray-800">
            {item.quantity}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0 border-emerald-300 hover:bg-emerald-50"
            onClick={() =>
              onUpdateQty(
                item.product.id,
                Math.min(item.product.currentStock, item.quantity + 1),
              )
            }
            disabled={item.quantity >= item.product.currentStock}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        <span className="text-sm font-bold text-gray-800 min-w-[70px] text-right">
          ₱{getItemTotal(item).toFixed(2)}
        </span>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="mt-2 h-7 text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 w-full"
        onClick={() => onOpenDiscount(item)}
      >
        <Tag className="h-3 w-3 mr-1" />
        {item.appliedDiscount ? "Change Discount" : "Apply Discount"}
      </Button>
    </div>
  ),
);
CartItemDisplay.displayName = "CartItemDisplay";

// ─── Product card (grid) ──────────────────────────────────────────────────────

const ProductGridCard = memo(
  ({
    product,
    inCart,
    isLoading,
    onAdd,
  }: {
    product: Product;
    inCart: boolean;
    isLoading: boolean;
    onAdd: (p: Product) => void;
  }) => (
    <motion.div
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => !isLoading && onAdd(product)}
      className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all h-full ${
        inCart
          ? "border-emerald-500 bg-emerald-50 shadow-md"
          : "border-gray-200 bg-white hover:border-emerald-300 hover:shadow-lg"
      }`}
    >
      {inCart && (
        <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center">
          <Check className="h-4 w-4 text-white" />
        </div>
      )}
      <div className="mb-3">
        <h3 className="font-bold text-gray-800 text-sm mb-1 line-clamp-2">
          {product.name}
        </h3>
        <p className="text-xs text-gray-500">{product.sku}</p>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-gray-500 mb-1">Stock</p>
          <p
            className={`text-sm font-semibold ${
              product.currentStock <= 10 ? "text-orange-600" : "text-gray-700"
            }`}
          >
            {product.currentStock}
          </p>
        </div>
        <p className="text-lg font-bold text-emerald-600">
          ₱{product.price.toFixed(2)}
        </p>
      </div>
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 rounded-xl flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        </div>
      )}
    </motion.div>
  ),
);
ProductGridCard.displayName = "ProductGridCard";

// ─── Product card (list) ──────────────────────────────────────────────────────

const ProductListCard = memo(
  ({
    product,
    inCart,
    isLoading,
    onAdd,
  }: {
    product: Product;
    inCart: boolean;
    isLoading: boolean;
    onAdd: (p: Product) => void;
  }) => (
    <motion.div
      whileHover={{ x: 4 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => !isLoading && onAdd(product)}
      className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all ${
        inCart
          ? "border-emerald-500 bg-emerald-50 shadow-md"
          : "border-gray-200 bg-white hover:border-emerald-300 hover:shadow-lg"
      }`}
    >
      <div className="flex items-center gap-4">
        {inCart && (
          <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
            <Check className="h-5 w-5 text-white" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-800 text-base mb-1 truncate">
            {product.name}
          </h3>
          <p className="text-sm text-gray-500">SKU: {product.sku}</p>
        </div>
        <div className="flex items-center gap-6 flex-shrink-0">
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">Stock</p>
            <p
              className={`text-base font-semibold ${
                product.currentStock <= 10 ? "text-orange-600" : "text-gray-700"
              }`}
            >
              {product.currentStock}
            </p>
          </div>
          <p className="text-2xl font-bold text-emerald-600 min-w-[100px] text-right">
            ₱{product.price.toFixed(2)}
          </p>
        </div>
      </div>
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 rounded-xl flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        </div>
      )}
    </motion.div>
  ),
);
ProductListCard.displayName = "ProductListCard";

// ─── GridView — proper standalone component ───────────────────────────────────

const GridView = memo(
  ({
    products,
    cartMap,
    loadingProductId,
    onAdd,
  }: {
    products: Product[];
    cartMap: Map<number, CartItem>;
    loadingProductId: number | null;
    onAdd: (p: Product) => void;
  }) => {
    const parentRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(0);

    useEffect(() => {
      const el = parentRef.current;
      if (!el) return;
      // Set initial width immediately
      setContainerWidth(el.getBoundingClientRect().width);
      const observer = new ResizeObserver(([entry]) => {
        setContainerWidth(entry.contentRect.width);
      });
      observer.observe(el);
      return () => observer.disconnect();
    }, []);

    const availableWidth = Math.max(0, containerWidth - GRID_PADDING * 2);
    const cols = Math.max(
      2,
      Math.floor(availableWidth / (GRID_COL_MIN_WIDTH + GRID_GAP)),
    );
    const colWidth = Math.floor(
      (availableWidth - GRID_GAP * (cols - 1)) / cols,
    );
    const rowCount = Math.ceil(products.length / cols);

    const rowVirtualizer = useVirtualizer({
      count: rowCount,
      getScrollElement: () => parentRef.current,
      estimateSize: () => GRID_ITEM_HEIGHT + GRID_GAP,
      overscan: 3,
    });

    return (
      <div
        ref={parentRef}
        className="h-full overflow-auto"
        style={{ padding: GRID_PADDING }}
      >
        <div
          style={{
            height: rowVirtualizer.getTotalSize(),
            width: "100%",
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const startIdx = virtualRow.index * cols;
            return (
              <div
                key={virtualRow.key}
                style={{
                  position: "absolute",
                  top: virtualRow.start,
                  left: 0,
                  width: "100%",
                  height: GRID_ITEM_HEIGHT,
                  display: "grid",
                  gridTemplateColumns: `repeat(${cols}, ${colWidth}px)`,
                  gap: GRID_GAP,
                }}
              >
                {Array.from({ length: cols }).map((_, colIdx) => {
                  const idx = startIdx + colIdx;
                  if (idx >= products.length) return <div key={colIdx} />;
                  const product = products[idx];
                  return (
                    <ProductGridCard
                      key={product.id}
                      product={product}
                      inCart={!!cartMap.get(product.id)}
                      isLoading={loadingProductId === product.id}
                      onAdd={onAdd}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  },
);
GridView.displayName = "GridView";

// ─── ListView — proper standalone component ───────────────────────────────────

const ListView = memo(
  ({
    products,
    cartMap,
    loadingProductId,
    onAdd,
  }: {
    products: Product[];
    cartMap: Map<number, CartItem>;
    loadingProductId: number | null;
    onAdd: (p: Product) => void;
  }) => {
    const parentRef = useRef<HTMLDivElement>(null);

    const rowVirtualizer = useVirtualizer({
      count: products.length,
      getScrollElement: () => parentRef.current,
      estimateSize: () => LIST_ITEM_HEIGHT + 12,
      overscan: 5,
    });

    return (
      <div
        ref={parentRef}
        className="h-full overflow-auto"
        style={{ padding: 12 }}
      >
        <div
          style={{
            height: rowVirtualizer.getTotalSize(),
            width: "100%",
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const product = products[virtualRow.index];
            return (
              <div
                key={virtualRow.key}
                style={{
                  position: "absolute",
                  top: virtualRow.start,
                  left: 0,
                  width: "100%",
                  height: LIST_ITEM_HEIGHT,
                }}
              >
                <ProductListCard
                  product={product}
                  inCart={!!cartMap.get(product.id)}
                  isLoading={loadingProductId === product.id}
                  onAdd={onAdd}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  },
);
ListView.displayName = "ListView";

// ─── Main component ───────────────────────────────────────────────────────────

const POSPage = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeBranch, setActiveBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);

  const [products, setProducts] = useState<Product[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loadingProductId, setLoadingProductId] = useState<number | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [mobileCartVisible, setMobileCartVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const socketRef = useRef<Socket | null>(null);
  const barcodeInputRef = useRef("");
  const barcodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Discount dialog
  const [showDiscountDialog, setShowDiscountDialog] = useState(false);
  const [selectedCartItem, setSelectedCartItem] = useState<CartItem | null>(null);
  const [applicableDiscounts, setApplicableDiscounts] = useState<Discount[]>([]);

  // Checkout
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(false);
  const [cashAmount, setCashAmount] = useState("");
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [currentReceipt, setCurrentReceipt] = useState<SaleReceipt | null>(null);

  const receiptRef = useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery("(max-width: 767px)");

  const debouncedSearch = useDebounce(searchQuery, 200);

  const cartMap = useMemo(
    () => new Map(cart.map((item) => [item.product.id, item])),
    [cart],
  );

  const filteredProducts = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return products.filter(
      (p) =>
        p.status === "ACTIVE" &&
        (p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)),
    );
  }, [products, debouncedSearch]);

  const { subtotal, totalDiscount, total } = useMemo(() => {
    let sub = 0;
    let disc = 0;
    for (const item of cart) {
      sub += item.product.price * item.quantity;
      if (item.appliedDiscount && item.discountedPrice != null) {
        disc += (item.product.price - item.discountedPrice) * item.quantity;
      }
    }
    return { subtotal: sub, totalDiscount: disc, total: sub - disc };
  }, [cart]);

  const calculateChange = useCallback(() => {
    return (parseFloat(cashAmount) || 0) - total;
  }, [cashAmount, total]);

  // ── Data fetching ────────────────────────────────────────────────────────────

  const fetchProducts = useCallback(async () => {
    try {
      const branchId = activeBranch?.id ?? currentUser?.branchId;
      const res = await api.get(`/products?branchId=${branchId}`);
      const parsed = res.data.map((p: any) => ({
        ...p,
        price: parseFloat(p.price) || 0,
        cost: parseFloat(p.cost) || 0,
        currentStock: p.branchStocks?.[0]?.currentStock ?? 0,
      }));
      setProducts(parsed);
    } catch {
      toast.error("Failed to fetch products");
    }
  }, [activeBranch, currentUser]);

  const fetchDiscounts = useCallback(async () => {
    try {
      const res = await api.get("/discounts?activeOnly=true");
      setDiscounts(res.data);
    } catch {
      toast.error("Failed to fetch discounts");
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await api.get("/auth/me");
        setCurrentUser(res.data);
        const branch = res.data.currentBranch ?? res.data.branch;
        setActiveBranch(branch);
        if (!branch)
          toast.error("No branch assigned. Please contact administrator.");
      } catch {
        toast.error("Failed to fetch user information");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchProducts();
      fetchDiscounts();
    }
  }, [currentUser, fetchProducts, fetchDiscounts]);

  // ── Socket.io ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser || !activeBranch) return;

    const baseURL =
      api.defaults.baseURL?.replace("/api", "") ?? "http://localhost:5000";
    const socket = io(baseURL, {
      auth: { token: localStorage.getItem("token") },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    socket.on("connect", () => socket.emit("join-branch", activeBranch.id));
    socket.on("connect_error", console.error);

    socket.on(
      "stock-updated",
      (data: { productId: number; newStock: number }) => {
        setProducts((prev) =>
          prev.map((p) =>
            p.id === data.productId ? { ...p, currentStock: data.newStock } : p,
          ),
        );
        setCart((prev) =>
          prev.map((item) => {
            if (item.product.id !== data.productId) return item;
            const newQty = Math.min(item.quantity, Math.max(0, data.newStock));
            if (newQty < item.quantity)
              toast.warning(
                `${item.product.name} stock updated. Quantity adjusted.`,
                { duration: 4000 },
              );
            return {
              ...item,
              quantity: newQty,
              product: { ...item.product, currentStock: data.newStock },
            };
          }),
        );
        setProducts((prev) => {
          const product = prev.find((p) => p.id === data.productId);
          if (product)
            toast.info(`${product.name} stock updated: ${data.newStock}`, {
              icon: <RefreshCw className="h-4 w-4" />,
              duration: 3000,
            });
          return prev;
        });
      },
    );

    socket.on("new-sale", () => fetchProducts());
    socket.on("dashboard-refresh", () => fetchProducts());

    return () => {
      socket.emit("leave-branch", activeBranch.id);
      socket.disconnect();
    };
  }, [currentUser, activeBranch, fetchProducts]);

  // ── Barcode scanner ──────────────────────────────────────────────────────────
  const dialogsOpen =
    showCheckoutDialog || showDiscountDialog || showReceiptDialog;

  const addToCart = useCallback(async (product: Product) => {
    if (product.currentStock <= 0) {
      toast.error(`${product.name} is out of stock`);
      return;
    }
    setLoadingProductId(product.id);
    await new Promise((r) => setTimeout(r, 200));
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.currentStock) {
          toast.error(`Maximum stock reached for ${product.name}`);
          return prev;
        }
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [...prev, { product, quantity: 1, appliedDiscount: null }];
    });
    setLoadingProductId(null);
  }, []);

  const handleBarcodeScanned = useCallback(
    (barcode: string) => {
      const product = products.find(
        (p) =>
          (p.barcode?.toLowerCase() === barcode.toLowerCase() ||
            p.sku.toLowerCase() === barcode.toLowerCase()) &&
          p.status === "ACTIVE",
      );
      if (product) {
        addToCart(product);
        toast.success(`Added: ${product.name}`, {
          icon: <Scan className="h-4 w-4" />,
        });
      } else {
        toast.error(`Product not found: ${barcode}`);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products],
  );

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        dialogsOpen
      )
        return;

      if (barcodeTimeoutRef.current) clearTimeout(barcodeTimeoutRef.current);

      if (e.key === "Enter" && barcodeInputRef.current.length > 0) {
        handleBarcodeScanned(barcodeInputRef.current.trim());
        barcodeInputRef.current = "";
        return;
      }

      if (e.key.length === 1) {
        barcodeInputRef.current += e.key;
        barcodeTimeoutRef.current = setTimeout(() => {
          barcodeInputRef.current = "";
        }, 100);
      }
    };

    window.addEventListener("keypress", handleKeyPress);
    return () => {
      window.removeEventListener("keypress", handleKeyPress);
      if (barcodeTimeoutRef.current) clearTimeout(barcodeTimeoutRef.current);
    };
  }, [dialogsOpen, handleBarcodeScanned]);

  // ── Cart actions ─────────────────────────────────────────────────────────────

  const updateQuantity = useCallback((id: number, qty: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === id ? { ...item, quantity: qty } : item,
      ),
    );
  }, []);

  const removeFromCart = useCallback((id: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== id));
  }, []);

  const handleOpenDiscountDialog = useCallback(async (cartItem: CartItem) => {
    setSelectedCartItem(cartItem);
    try {
      const res = await api.get(
        `/discounts/product/${cartItem.product.id}/applicable`,
      );
      setApplicableDiscounts(res.data);
      setShowDiscountDialog(true);
    } catch {
      toast.error("Failed to fetch applicable discounts");
    }
  }, []);

  const applyDiscount = useCallback(
    (discount: Discount | null) => {
      if (!selectedCartItem) return;
      setCart((prev) =>
        prev.map((item) => {
          if (item.product.id !== selectedCartItem.product.id) return item;
          if (discount) {
            return {
              ...item,
              appliedDiscount: discount,
              discountedPrice: calculateDiscountedPrice(
                item.product.price,
                discount,
              ),
            };
          }
          return { ...item, appliedDiscount: null, discountedPrice: undefined };
        }),
      );
      setShowDiscountDialog(false);
      setSelectedCartItem(null);
      toast.success(discount ? `${discount.name} applied` : "Discount removed");
    },
    [selectedCartItem],
  );

  const handleCheckoutClick = useCallback(() => {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    if (!activeBranch) {
      toast.error("No active branch.");
      return;
    }
    setShowCheckoutDialog(true);
    setCashAmount(total.toFixed(2));
  }, [cart.length, activeBranch, total]);

  const handleCheckout = useCallback(async () => {
    const cash = parseFloat(cashAmount) || 0;
    if (cash < total) {
      toast.error("Cash amount is insufficient");
      return;
    }
    if (!activeBranch) {
      toast.error("No active branch.");
      return;
    }

    setCheckingOut(true);
    try {
      await api.post("/sales", {
        cart: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          price: item.product.price,
          discountId: item.appliedDiscount?.id ?? null,
          discountedPrice: item.discountedPrice ?? null,
        })),
        subtotal,
        totalDiscount,
        total,
        cashAmount: cash,
      });

      setCurrentReceipt({
        items: [...cart],
        subtotal,
        totalDiscount,
        total,
        cashAmount: cash,
        change: cash - total,
        date: new Date(),
        branchName: activeBranch.name,
        branchPhone: activeBranch.phone ?? "",
        branchEmail: activeBranch.email ?? "",
        soldBy: currentUser?.username ?? "Unknown",
      });
      setShowCheckoutDialog(false);
      setShowReceiptDialog(true);
      await fetchProducts();
      toast.success("Sale completed successfully");
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? "Error during checkout");
    } finally {
      setCheckingOut(false);
    }
  }, [
    cashAmount,
    total,
    activeBranch,
    cart,
    subtotal,
    totalDiscount,
    currentUser,
    fetchProducts,
  ]);

  const handlePrintReceipt = useCallback(() => {
    if (!receiptRef.current) return;
    const pw = window.open("", "", "width=800,height=600");
    if (!pw) return;
    pw.document.write(`
      <html>
        <head>
          <title>Receipt</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 20px; max-width: 400px; margin: 0 auto; }
            h2 { text-align: center; margin-bottom: 20px; }
            .receipt-info { margin-bottom: 10px; text-align: center; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { padding: 8px; text-align: left; }
            th { border-bottom: 2px solid #000; }
            .item-row { border-bottom: 1px dashed #ccc; }
            .discount-row { font-size: 0.9em; color: #059669; padding-left: 20px; }
            .totals { margin-top: 20px; }
            .total-row { display: flex; justify-content: space-between; padding: 5px 0; }
            .total-row.final { border-top: 2px solid #000; font-weight: bold; font-size: 1.2em; padding-top: 10px; }
            .footer { text-align: center; margin-top: 30px; font-size: 0.9em; }
          </style>
        </head>
        <body>${receiptRef.current.innerHTML}</body>
      </html>
    `);
    pw.document.close();
    pw.print();
  }, []);

  const handleNewSale = useCallback(() => {
    setCart([]);
    setCashAmount("");
    setCurrentReceipt(null);
    setShowReceiptDialog(false);
  }, []);

  // ── Shared header controls ────────────────────────────────────────────────────

  const SearchBar = (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <Input
          type="text"
          placeholder="Search products by name or SKU..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-12 h-12 border-2 border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 rounded-xl text-base"
        />
      </div>
      <div className="flex border-2 border-gray-200 rounded-xl overflow-hidden bg-white">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setViewMode("grid")}
          className={`h-12 px-4 rounded-none ${
            viewMode === "grid"
              ? "bg-emerald-500 text-white hover:bg-emerald-600 hover:text-white"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          <Grid3x3 className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setViewMode("list")}
          className={`h-12 px-4 rounded-none border-l-2 border-gray-200 ${
            viewMode === "list"
              ? "bg-emerald-500 text-white hover:bg-emerald-600 hover:text-white"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          <List className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );

  // ── Product area (shared between desktop and mobile) ──────────────────────────

  const ProductArea = (
    <div className="h-full">
      {filteredProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center px-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
            <Search className="h-8 w-8 text-gray-400" />
          </div>
          <p className="text-gray-500 font-medium">No products found</p>
          <p className="text-gray-400 text-sm mt-1">Try a different search term</p>
        </div>
      ) : viewMode === "grid" ? (
        <GridView
          products={filteredProducts}
          cartMap={cartMap}
          loadingProductId={loadingProductId}
          onAdd={addToCart}
        />
      ) : (
        <ListView
          products={filteredProducts}
          cartMap={cartMap}
          loadingProductId={loadingProductId}
          onAdd={addToCart}
        />
      )}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center h-screen bg-gradient-to-br from-emerald-50 to-green-50">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-emerald-600 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Loading POS...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50">
        {/* ── Desktop Layout ───────────────────────────────────────────────────── */}
        <div className="hidden md:grid md:grid-cols-3 gap-0 h-screen pb-16">
          {/* Product panel */}
          <div className="md:col-span-2 flex flex-col border-r border-emerald-200 overflow-hidden">
            <div className="bg-white z-20 border-b border-emerald-200 shadow-sm p-4">
              {SearchBar}
            </div>
            <div className="flex-1 overflow-hidden">
              {ProductArea}
            </div>
          </div>

          {/* Cart sidebar */}
          <div className="flex flex-col bg-white border-l border-emerald-200 pb-5">
            <div className="p-4 border-b border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center">
                  <ShoppingCart className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-800">Shopping Cart</h2>
                  <p className="text-sm text-gray-600">
                    {cart.length} {cart.length === 1 ? "item" : "items"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-auto h-0 overflow-auto">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <div className="h-20 w-20 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                    <ShoppingCart className="h-10 w-10 text-emerald-300" />
                  </div>
                  <p className="text-gray-500 font-medium">Cart is empty</p>
                  <p className="text-gray-400 text-sm">
                    Scan or click products to add
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-emerald-100">
                  {cart.map((item) => (
                    <CartItemDisplay
                      key={item.product.id}
                      item={item}
                      onRemove={removeFromCart}
                      onUpdateQty={updateQuantity}
                      onOpenDiscount={handleOpenDiscountDialog}
                    />
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="border-t-2 border-emerald-200 bg-white p-4 space-y-3">
                {totalDiscount > 0 && (
                  <>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Subtotal</span>
                      <span>₱{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold text-emerald-600">
                      <span>Discount</span>
                      <span>-₱{totalDiscount.toFixed(2)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-xl font-bold text-gray-800 pt-2 border-t border-emerald-100">
                  <span>Total</span>
                  <span className="text-emerald-600">₱{total.toFixed(2)}</span>
                </div>
                <Button
                  onClick={handleCheckoutClick}
                  disabled={cart.length === 0 || !activeBranch}
                  className="w-full h-12 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-bold text-base shadow-lg"
                >
                  Proceed to Checkout
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* ── Mobile Layout ────────────────────────────────────────────────────── */}
        <div className="md:hidden flex flex-col h-screen pb-24 overflow-hidden">
          <div className="bg-white z-20 border-b border-emerald-200 shadow-sm p-4">
            {SearchBar}
          </div>
          <div className="flex-1 overflow-hidden">
            {ProductArea}
          </div>

          {!mobileCartVisible && cart.length > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="fixed bottom-20 right-6 z-30"
            >
              <Button
                onClick={() => setMobileCartVisible(true)}
                className="h-16 w-16 rounded-full bg-gradient-to-r from-emerald-600 to-green-600 shadow-2xl relative"
              >
                <ShoppingCart className="h-6 w-6 text-white" />
                <div className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-red-500 flex items-center justify-center border-2 border-white">
                  <span className="text-white text-xs font-bold">
                    {cart.length}
                  </span>
                </div>
              </Button>
            </motion.div>
          )}

          <AnimatePresence>
            {mobileCartVisible && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/50 z-40"
                  onClick={() => setMobileCartVisible(false)}
                />
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 30, stiffness: 300 }}
                  className="fixed bottom-0 left-0 right-0 bg-white z-50 rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col pb-20"
                >
                  <div className="flex justify-center pt-3 pb-2">
                    <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
                  </div>
                  <div className="px-6 py-4 border-b border-emerald-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center">
                          <ShoppingCart className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <h2 className="font-bold text-gray-800">Your Cart</h2>
                          <p className="text-sm text-gray-600">
                            {cart.length} {cart.length === 1 ? "item" : "items"}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setMobileCartVisible(false)}
                        className="h-10 w-10 p-0 rounded-full"
                      >
                        <X className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-auto">
                    {cart.map((item) => (
                      <CartItemDisplay
                        key={item.product.id}
                        item={item}
                        onRemove={removeFromCart}
                        onUpdateQty={updateQuantity}
                        onOpenDiscount={handleOpenDiscountDialog}
                      />
                    ))}
                  </div>
                  <div className="border-t-2 border-emerald-200 bg-white p-6 space-y-3">
                    {totalDiscount > 0 && (
                      <>
                        <div className="flex justify-between text-sm text-gray-600">
                          <span>Subtotal</span>
                          <span>₱{subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-semibold text-emerald-600">
                          <span>Discount</span>
                          <span>-₱{totalDiscount.toFixed(2)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between text-xl font-bold text-gray-800 pt-2 border-t border-emerald-100">
                      <span>Total</span>
                      <span className="text-emerald-600">
                        ₱{total.toFixed(2)}
                      </span>
                    </div>
                    <Button
                      onClick={() => {
                        setMobileCartVisible(false);
                        handleCheckoutClick();
                      }}
                      disabled={cart.length === 0 || !activeBranch}
                      className="w-full h-14 bg-gradient-to-r from-emerald-600 to-green-600 text-white font-bold text-lg shadow-lg"
                    >
                      Proceed to Checkout
                    </Button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Discount Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={showDiscountDialog} onOpenChange={setShowDiscountDialog}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-800">
              Apply Discount
            </DialogTitle>
            <DialogDescription>
              {selectedCartItem &&
                `Select a discount for ${selectedCartItem.product.name}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {selectedCartItem?.appliedDiscount && (
              <Button
                variant="outline"
                className="w-full justify-start h-auto p-4 border-2 border-red-200 hover:bg-red-50"
                onClick={() => applyDiscount(null)}
              >
                <X className="h-4 w-4 mr-2 text-red-600" />
                <span className="text-red-700 font-medium">
                  Remove Current Discount
                </span>
              </Button>
            )}
            {applicableDiscounts.length === 0 ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-3">
                  <Tag className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-gray-500 font-medium">
                  No discounts available
                </p>
              </div>
            ) : (
              applicableDiscounts.map((discount) => {
                const isApplied =
                  selectedCartItem?.appliedDiscount?.id === discount.id;
                const discountedPrice = selectedCartItem
                  ? calculateDiscountedPrice(
                      selectedCartItem.product.price,
                      discount,
                    )
                  : 0;
                const savings = selectedCartItem
                  ? selectedCartItem.product.price - discountedPrice
                  : 0;
                return (
                  <Button
                    key={discount.id}
                    variant="outline"
                    className={`w-full justify-start h-auto p-4 transition-all ${
                      isApplied
                        ? "border-2 border-emerald-500 bg-emerald-50 shadow-md"
                        : "border-2 border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/50"
                    }`}
                    onClick={() => applyDiscount(discount)}
                  >
                    <div className="w-full text-left space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-bold text-gray-800">
                            {discount.name}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            {discount.description}
                          </p>
                        </div>
                        <Badge className="ml-3 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 px-3 py-1">
                          {discount.discountType === "PERCENTAGE"
                            ? `${discount.discountValue}%`
                            : `₱${discount.discountValue}`}
                        </Badge>
                      </div>
                      {selectedCartItem && (
                        <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                          <span className="line-through text-gray-400 text-sm">
                            ₱{selectedCartItem.product.price.toFixed(2)}
                          </span>
                          <span className="font-bold text-emerald-600">
                            ₱{discountedPrice.toFixed(2)}
                          </span>
                          <span className="text-xs text-gray-600 ml-auto">
                            Save ₱{savings.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {discount.requiresVerification && (
                        <Badge
                          variant="secondary"
                          className="text-xs bg-amber-50 text-amber-700 border-amber-200"
                        >
                          ID Required
                        </Badge>
                      )}
                    </div>
                  </Button>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDiscountDialog(false)}
              className="w-full"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Checkout Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={showCheckoutDialog} onOpenChange={setShowCheckoutDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-800">
              Complete Payment
            </DialogTitle>
            <DialogDescription>
              Enter the cash amount received from customer
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-emerald-50 rounded-xl border-2 border-emerald-200">
              <Label className="text-sm text-gray-600 mb-2 block">
                Total Amount
              </Label>
              <div className="text-3xl font-bold text-emerald-600">
                ₱{total.toFixed(2)}
              </div>
              {totalDiscount > 0 && (
                <div className="text-sm text-emerald-700 mt-1 font-medium">
                  Total Savings: ₱{totalDiscount.toFixed(2)}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cash" className="text-sm font-semibold">
                Cash Amount
              </Label>
              <Input
                id="cash"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
                className="h-14 text-2xl font-bold text-center border-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-600">
                Quick Cash
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {[20, 50, 100, 200, 500, 1000].map((amount) => (
                  <Button
                    key={amount}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-12 font-semibold border-2 hover:border-emerald-500 hover:bg-emerald-50"
                    onClick={() => setCashAmount(amount.toString())}
                  >
                    ₱{amount}
                  </Button>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full h-12 font-semibold border-2 hover:border-emerald-500 hover:bg-emerald-50"
                onClick={() => setCashAmount(total.toFixed(2))}
              >
                Exact Amount
              </Button>
            </div>
            {cashAmount && (
              <div className="p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
                <Label className="text-sm text-gray-600 mb-2 block">
                  Change
                </Label>
                <div
                  className={`text-3xl font-bold ${calculateChange() < 0 ? "text-red-600" : "text-emerald-600"}`}
                >
                  ₱{Math.abs(calculateChange()).toFixed(2)}
                </div>
                {calculateChange() < 0 && (
                  <p className="text-sm text-red-600 mt-1 font-medium">
                    Insufficient cash amount
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCheckoutDialog(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCheckout}
              disabled={checkingOut || parseFloat(cashAmount) < total}
              className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-green-600 text-white font-bold"
            >
              {checkingOut ? (
                <>
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
                  Processing...
                </>
              ) : (
                "Complete Sale"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Receipt Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-emerald-600">
              Sale Completed
            </DialogTitle>
            <DialogDescription>
              Transaction completed successfully
            </DialogDescription>
          </DialogHeader>
          {currentReceipt && (
            <div ref={receiptRef} className="py-4 space-y-4">
              <div className="text-center pb-4 border-b-2 border-dashed border-gray-300">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  RECEIPT
                </h2>
                <p className="font-bold text-gray-800">
                  {currentReceipt.branchName}
                </p>
                {currentReceipt.branchPhone && (
                  <p className="text-sm text-gray-600">
                    {currentReceipt.branchPhone}
                  </p>
                )}
                {currentReceipt.branchEmail && (
                  <p className="text-sm text-gray-600">
                    {currentReceipt.branchEmail}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                {currentReceipt.items.map((item) => (
                  <div
                    key={item.product.id}
                    className="pb-2 border-b border-dashed border-gray-200"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800">
                          {item.product.name}
                        </p>
                        <p className="text-sm text-gray-600">
                          {item.quantity} × ₱
                          {(item.discountedPrice ?? item.product.price).toFixed(2)}
                        </p>
                      </div>
                      <p className="font-bold text-gray-800">
                        ₱{getItemTotal(item).toFixed(2)}
                      </p>
                    </div>
                    {item.appliedDiscount && (
                      <div className="flex items-center gap-1 text-xs text-emerald-600">
                        <Tag className="h-3 w-3" />
                        <span>{item.appliedDiscount.name}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="space-y-2 pt-2 border-t-2 border-gray-300">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>₱{currentReceipt.subtotal.toFixed(2)}</span>
                </div>
                {currentReceipt.totalDiscount > 0 && (
                  <div className="flex justify-between font-semibold text-emerald-600">
                    <span>Total Discount</span>
                    <span>-₱{currentReceipt.totalDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-bold text-gray-800 pt-2 border-t border-gray-300">
                  <span>Total</span>
                  <span>₱{currentReceipt.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Cash</span>
                  <span>₱{currentReceipt.cashAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xl font-bold text-emerald-600 pt-2 border-t-2 border-gray-300">
                  <span>Change</span>
                  <span>₱{currentReceipt.change.toFixed(2)}</span>
                </div>
              </div>
              <div className="text-center pt-4 border-t-2 border-dashed border-gray-300 text-sm text-gray-600 space-y-1">
                <p>Sold by: {currentReceipt.soldBy}</p>
                <p>{currentReceipt.date.toLocaleString()}</p>
                <p className="font-semibold text-gray-800 mt-3">
                  Thank you for your purchase!
                </p>
                {currentReceipt.totalDiscount > 0 && (
                  <p className="text-emerald-600 font-bold">
                    You saved ₱{currentReceipt.totalDiscount.toFixed(2)}!
                  </p>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handlePrintReceipt}
              className="w-full sm:w-auto flex items-center gap-2"
            >
              <Printer className="h-4 w-4" />
              Print Receipt
            </Button>
            <Button
              type="button"
              onClick={handleNewSale}
              className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-green-600 text-white font-bold"
            >
              New Sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProtectedRoute>
  );
};

export default POSPage;