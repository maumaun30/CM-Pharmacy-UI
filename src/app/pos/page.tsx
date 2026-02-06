"use client";

import React, { useEffect, useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ProtectedRoute from "@/components/ProtectedRoute";
import { toast } from "sonner";
import api from "@/lib/api";
import { Loader2, Search, Printer, Tag, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { ShoppingCart, Trash } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";

interface Product {
  id: number;
  name: string;
  price: number;
  quantity: number;
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
}

const POSPage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loadingProductId, setLoadingProductId] = useState<number | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [lastAddedId, setLastAddedId] = useState<number | null>(null);
  const [mobileCartVisible, setMobileCartVisible] = useState(false);
  const [cartBtn, setCartBtn] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Discount dialog states
  const [showDiscountDialog, setShowDiscountDialog] = useState(false);
  const [selectedCartItem, setSelectedCartItem] = useState<CartItem | null>(
    null,
  );
  const [applicableDiscounts, setApplicableDiscounts] = useState<Discount[]>(
    [],
  );

  // Checkout dialog states
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(false);
  const [cashAmount, setCashAmount] = useState("");
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [currentReceipt, setCurrentReceipt] = useState<SaleReceipt | null>(
    null,
  );

  const receiptRef = useRef<HTMLDivElement>(null);

  const isMobile = useMediaQuery("(max-width: 767px)");

  // Filter products based on search query and active status
  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      product.status === "ACTIVE",
  );

  const fetchProducts = async () => {
    try {
      const res = await api.get("/products");
      const parsed = res.data.map((p: any) => ({
        ...p,
        price: parseFloat(p.price),
      }));
      setProducts(parsed);
    } catch (err) {
      toast.error("Failed to fetch products");
    }
  };

  // Update the useEffect to use the named function
  useEffect(() => {
    const fetchDiscounts = async () => {
      try {
        const res = await api.get("/discounts?activeOnly=true");
        setDiscounts(res.data);
      } catch (err) {
        toast.error("Failed to fetch discounts");
      }
    };

    fetchProducts();
    fetchDiscounts();
  }, []);

  const calculateDiscountedPrice = (price: number, discount: Discount) => {
    if (discount.discountType === "PERCENTAGE") {
      const discountAmount = (price * discount.discountValue) / 100;
      const finalDiscount = discount.maximumDiscountAmount
        ? Math.min(discountAmount, discount.maximumDiscountAmount)
        : discountAmount;
      return price - finalDiscount;
    } else {
      const discountAmount = Math.min(discount.discountValue, price);
      return price - discountAmount;
    }
  };

  const addToCart = async (product: Product) => {
    setLoadingProductId(product.id);

    // Simulate loading delay
    await new Promise((resolve) => setTimeout(resolve, 300));

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [...prev, { product, quantity: 1, appliedDiscount: null }];
    });

    setLoadingProductId(null);
    setLastAddedId(product.id);
  };

  const updateQuantity = (id: number, qty: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === id ? { ...item, quantity: qty } : item,
      ),
    );
  };

  const removeFromCart = (id: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== id));
    setLastAddedId(null);
  };

  const handleOpenDiscountDialog = async (cartItem: CartItem) => {
    setSelectedCartItem(cartItem);

    try {
      // Fetch applicable discounts for this product
      const res = await api.get(
        `/discounts/product/${cartItem.product.id}/applicable`,
      );
      setApplicableDiscounts(res.data);
      setShowDiscountDialog(true);
    } catch (err) {
      toast.error("Failed to fetch applicable discounts");
    }
  };

  const applyDiscount = (discount: Discount | null) => {
    if (!selectedCartItem) return;

    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === selectedCartItem.product.id) {
          if (discount) {
            const discountedPrice = calculateDiscountedPrice(
              item.product.price,
              discount,
            );
            return {
              ...item,
              appliedDiscount: discount,
              discountedPrice: discountedPrice,
            };
          } else {
            // Remove discount
            return {
              ...item,
              appliedDiscount: null,
              discountedPrice: undefined,
            };
          }
        }
        return item;
      }),
    );

    setShowDiscountDialog(false);
    setSelectedCartItem(null);

    if (discount) {
      toast.success(`${discount.name} applied`);
    } else {
      toast.success("Discount removed");
    }
  };

  const getItemTotal = (item: CartItem) => {
    const price = item.discountedPrice ?? item.product.price;
    return price * item.quantity;
  };

  const subtotal = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  );

  const totalDiscount = cart.reduce((sum, item) => {
    if (item.appliedDiscount && item.discountedPrice) {
      const discountPerItem = item.product.price - item.discountedPrice;
      return sum + discountPerItem * item.quantity;
    }
    return sum;
  }, 0);

  const total = subtotal - totalDiscount;

  const calculateChange = () => {
    const cash = parseFloat(cashAmount) || 0;
    return cash - total;
  };

  const handleCheckoutClick = () => {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    setShowCheckoutDialog(true);
    setCashAmount(total.toFixed(2));
  };

  const handleCheckout = async () => {
    const cash = parseFloat(cashAmount) || 0;

    if (cash < total) {
      toast.error("Cash amount is insufficient");
      return;
    }

    setCheckingOut(true);
    try {
      // Send cart with discount information to backend
      const saleData = {
        cart: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          price: item.product.price,
          discountId: item.appliedDiscount?.id || null,
          discountedPrice: item.discountedPrice || null,
        })),
        subtotal,
        totalDiscount,
        total,
        cashAmount: cash,
      };

      const res = await api.post("/sales", saleData);

      // Create receipt data
      const receipt: SaleReceipt = {
        items: [...cart],
        subtotal,
        totalDiscount,
        total,
        cashAmount: cash,
        change: cash - total,
        date: new Date(),
      };

      setCurrentReceipt(receipt);
      setShowCheckoutDialog(false);
      setShowReceiptDialog(true);

      // REFETCH PRODUCTS TO UPDATE QUANTITIES
      await fetchProducts();

      toast.success("Sale completed successfully");
    } catch (error: any) {
      const msg = error?.response?.data?.message || "Error during checkout";
      toast.error(msg);
    } finally {
      setCheckingOut(false);
    }
  };

  const handlePrintReceipt = () => {
    if (receiptRef.current) {
      const printWindow = window.open("", "", "width=800,height=600");
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Receipt</title>
              <style>
                body {
                  font-family: monospace;
                  padding: 20px;
                  max-width: 400px;
                  margin: 0 auto;
                }
                h2 { text-align: center; margin-bottom: 20px; }
                .receipt-info { margin-bottom: 10px; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { padding: 8px; text-align: left; }
                th { border-bottom: 2px solid #000; }
                .item-row { border-bottom: 1px dashed #ccc; }
                .discount-row { font-size: 0.9em; color: #666; padding-left: 20px; }
                .totals { margin-top: 20px; }
                .total-row { display: flex; justify-content: space-between; padding: 5px 0; }
                .total-row.final { border-top: 2px solid #000; font-weight: bold; font-size: 1.2em; padding-top: 10px; }
                .footer { text-align: center; margin-top: 30px; font-size: 0.9em; }
              </style>
            </head>
            <body>
              ${receiptRef.current.innerHTML}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  const handleNewSale = () => {
    setCart([]);
    setLastAddedId(null);
    setCashAmount("");
    setCurrentReceipt(null);
    setShowReceiptDialog(false);
  };

  const CartItemDisplay = ({ item }: { item: CartItem }) => (
    <div className="flex-grow flex justify-between items-start [&:not(:last-of-type)]:border-b-1 border-gray-200 p-5">
      <div className="flex-1">
        <div className="flex items-start justify-between mb-2">
          <p className="font-medium">{item.product.name}</p>
          <Button
            variant="ghost"
            size="sm"
            className="cursor-pointer h-6 w-6 p-0 ml-2"
            onClick={() => removeFromCart(item.product.id)}
          >
            <Trash className="h-4 w-4" />
          </Button>
        </div>

        {item.appliedDiscount && (
          <div className="flex items-center gap-2 mb-1">
            <Badge
              variant="outline"
              className="text-xs bg-green-50 text-green-700"
            >
              <Tag className="h-3 w-3 mr-1" />
              {item.appliedDiscount.name}
            </Badge>
          </div>
        )}

        <div className="flex items-center gap-2 text-sm">
          {item.appliedDiscount && item.discountedPrice ? (
            <>
              <span className="line-through text-gray-400">
                {item.product.price.toFixed(2)}
              </span>
              <span className="text-green-600 font-semibold">
                {item.discountedPrice.toFixed(2)}
              </span>
            </>
          ) : (
            <span>{item.product.price.toFixed(2)}</span>
          )}
          <span>×</span>
          <input
            type="number"
            className="w-16 inline-block p-2 outline-0 border-b-[1px] border-gray-200"
            min={1}
            max={item.product.quantity}
            value={item.quantity}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              updateQuantity(item.product.id, isNaN(val) || val < 1 ? 1 : val);
            }}
          />
          <span className="ml-auto font-semibold">
            {getItemTotal(item).toFixed(2)}
          </span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="cursor-pointer h-7 mt-2 text-xs"
          onClick={() => handleOpenDiscountDialog(item)}
        >
          <Tag className="h-3 w-3 mr-1" />
          {item.appliedDiscount ? "Change Discount" : "Apply Discount"}
        </Button>
      </div>
    </div>
  );

  return (
    <ProtectedRoute>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 p-5 h-full">
        {/* Product List */}
        <div className="md:col-span-2 overflow-auto h-[calc(100vh-104px)]">
          {/* Search Bar */}
          <div className="sticky top-0 bg-white z-10 py-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-full border-0 rounded-none border-b-2 shadow-none focus-visible:ring-0"
              />
            </div>
          </div>

          <ul className="grid grid-cols-1 gap-0">
            {filteredProducts.length === 0 ? (
              <li className="p-5 text-center text-gray-500">No items found</li>
            ) : (
              filteredProducts.map((product) => (
                <li
                  key={product.id}
                  className={`${
                    cart.find((item) => item.product.id === product.id) &&
                    "bg-gray-200"
                  } border-b-[1px] border-gray-200 hover:bg-gray-50 ease-in-out duration-300 cursor-pointer`}
                  onClick={() => addToCart(product)}
                >
                  <div className="p-5 flex justify-between">
                    <div>
                      <p className="font-medium text-md">{product.name}</p>
                      <p className="text-sm">Qty: {product.quantity}</p>
                    </div>
                    <p className="text-sm">
                      {product.price.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>

        {cartBtn && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 md:hidden">
            <Button
              onClick={() => {
                setMobileCartVisible(!mobileCartVisible);
                setCartBtn(false);
              }}
              className="cursor-pointer rounded-full h-14 w-14 p-0"
            >
              <ShoppingCart />
            </Button>
          </div>
        )}

        {/* Cart Summary */}
        {isMobile ? (
          <AnimatePresence>
            {mobileCartVisible && (
              <>
                {/* Backdrop */}
                <motion.div
                  className="fixed inset-0 bg-black/30 z-30"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => {
                    setMobileCartVisible(false);
                    setCartBtn(true);
                  }}
                />

                {/* Cart Panel */}
                <motion.div
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  transition={{ duration: 0.3 }}
                  className="fixed top-0 right-0 h-full w-[80%] bg-white shadow-lg z-40 md:hidden"
                >
                  <div className="flex justify-between items-center p-5 border-b-[1px] border-gray-200">
                    <p className="font-semibold text-lg">
                      <ShoppingCart />
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setMobileCartVisible(false);
                        setCartBtn(true);
                      }}
                    >
                      ✕
                    </Button>
                  </div>

                  <div className="overflow-y-auto h-[calc(100%-12rem)] px-5 pt-5 pb-15">
                    {cart.length === 0 ? (
                      <p className="text-sm">No items in cart.</p>
                    ) : (
                      cart.map((item) => (
                        <CartItemDisplay key={item.product.id} item={item} />
                      ))
                    )}
                  </div>

                  <div className="absolute bottom-0 left-0 w-full p-4 border-t-[1px] border-gray-200 bg-white">
                    {totalDiscount > 0 && (
                      <div className="flex justify-between text-sm mb-1">
                        <span>Subtotal:</span>
                        <span>{subtotal.toFixed(2)}</span>
                      </div>
                    )}
                    {totalDiscount > 0 && (
                      <div className="flex justify-between text-sm text-green-600 mb-2">
                        <span>Discount:</span>
                        <span>-{totalDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    <p className="font-semibold mb-2">
                      Total: {total.toFixed(2)}
                    </p>
                    <Button
                      onClick={handleCheckoutClick}
                      variant="outline"
                      className="cursor-pointer w-full px-5 py-2"
                      disabled={cart.length === 0}
                    >
                      Checkout
                    </Button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        ) : (
          <div className="p-0 md:p-5 border-0 md:border-l-[1px] border-gray-200">
            <div className="relative h-auto md:h-[100vh-120px]]">
              <div className="h-18 absolute top-0 left-0 w-full bg-white pb-5 border-b-[1px] border-gray-200">
                <ShoppingCart />
              </div>
              {cart.length === 0 ? (
                <div className="pt-21 pb-16 h-full overflow-auto">
                  <p className="text-sm">No items in cart.</p>
                </div>
              ) : (
                <div className="pt-21 pb-35 h-full max-h-[calc(100vh-9rem)] overflow-auto">
                  <div>
                    {cart.map((item) => (
                      <CartItemDisplay key={item.product.id} item={item} />
                    ))}
                  </div>
                  <div className="absolute bottom-0 left-0 w-full h-32 pt-5 space-y-2 bg-white border-t-[1px] border-gray-200">
                    {totalDiscount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>Subtotal:</span>
                        <span>{subtotal.toFixed(2)}</span>
                      </div>
                    )}
                    {totalDiscount > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Discount:</span>
                        <span>-{totalDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    <p className="font-semibold">Total: {total.toFixed(2)}</p>
                    <Button
                      onClick={handleCheckoutClick}
                      variant="outline"
                      className="w-full px-5 py-2 cursor-pointer"
                      disabled={cart.length === 0}
                    >
                      Checkout
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Discount Selection Dialog */}
      <Dialog open={showDiscountDialog} onOpenChange={setShowDiscountDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Apply Discount</DialogTitle>
            <DialogDescription>
              {selectedCartItem &&
                `Select a discount for ${selectedCartItem.product.name}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4 max-h-[400px] overflow-y-auto">
            {selectedCartItem?.appliedDiscount && (
              <Button
                variant="outline"
                className="w-full justify-start h-auto p-4 border-2 border-red-200"
                onClick={() => applyDiscount(null)}
              >
                <X className="h-4 w-4 mr-2" />
                Remove Current Discount
              </Button>
            )}

            {applicableDiscounts.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No applicable discounts available
              </p>
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
                    className={`w-full justify-start h-auto p-4 ${
                      isApplied ? "border-2 border-green-500 bg-green-50" : ""
                    }`}
                    onClick={() => applyDiscount(discount)}
                  >
                    <div className="w-full text-left">
                      <div className="flex items-start justify-between mb-1">
                        <div>
                          <p className="font-semibold">{discount.name}</p>
                          <p className="text-xs text-gray-500">
                            {discount.description}
                          </p>
                        </div>
                        <Badge variant="outline" className="ml-2">
                          {discount.discountType === "PERCENTAGE"
                            ? `${discount.discountValue}%`
                            : `₱${discount.discountValue}`}
                        </Badge>
                      </div>
                      {selectedCartItem && (
                        <div className="flex items-center gap-2 mt-2 text-sm">
                          <span className="line-through text-gray-400">
                            ₱{selectedCartItem.product.price.toFixed(2)}
                          </span>
                          <span className="font-semibold text-green-600">
                            ₱{discountedPrice.toFixed(2)}
                          </span>
                          <span className="text-xs text-gray-500">
                            (Save ₱{savings.toFixed(2)})
                          </span>
                        </div>
                      )}
                      {discount.requiresVerification && (
                        <Badge variant="secondary" className="mt-2 text-xs">
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
              variant="ghost"
              onClick={() => setShowDiscountDialog(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Checkout Dialog - Cash Input */}
      <Dialog open={showCheckoutDialog} onOpenChange={setShowCheckoutDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Payment</DialogTitle>
            <DialogDescription>
              Enter the cash amount received from customer
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="total">Total Amount</Label>
              <div className="text-2xl font-bold">
                ₱
                {total.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              {totalDiscount > 0 && (
                <div className="text-sm text-green-600">
                  Total Savings: ₱{totalDiscount.toFixed(2)}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cash">Cash Amount</Label>
              <Input
                id="cash"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
                className="text-xl"
                autoFocus
              />
            </div>

            {/* Quick Cash Buttons */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                Quick Cash
              </Label>
              <div className="flex flex-wrap gap-2">
                {[20, 50, 100, 200, 500, 1000].map((amount) => (
                  <Button
                    key={amount}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 min-w-[70px]"
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
                className="w-full"
                onClick={() => setCashAmount(total.toFixed(2))}
              >
                Exact Amount (₱{total.toFixed(2)})
              </Button>
            </div>

            {cashAmount && (
              <div className="space-y-2">
                <Label>Change</Label>
                <div
                  className={`text-2xl font-bold ${calculateChange() < 0 ? "text-red-500" : "text-green-600"}`}
                >
                  ₱
                  {calculateChange().toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCheckoutDialog(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleCheckout}
              disabled={checkingOut || parseFloat(cashAmount) < total}
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

      {/* Receipt Dialog */}
      <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Sale Completed</DialogTitle>
            <DialogDescription>Transaction successful</DialogDescription>
          </DialogHeader>

          {currentReceipt && (
            <div ref={receiptRef} className="py-4">
              <div className="text-center mb-4">
                <h2 className="text-xl font-bold">RECEIPT</h2>
                <p className="text-sm text-gray-500">
                  {currentReceipt.date.toLocaleString()}
                </p>
              </div>

              <div className="border-t border-b border-gray-300 py-4 mb-4">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-300">
                      <th className="text-left py-2">Item</th>
                      <th className="text-right py-2">Qty</th>
                      <th className="text-right py-2">Price</th>
                      <th className="text-right py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentReceipt.items.map((item) => (
                      <React.Fragment key={item.product.id}>
                        <tr className="border-b border-dashed border-gray-200">
                          <td className="py-2">{item.product.name}</td>
                          <td className="text-right">{item.quantity}</td>
                          <td className="text-right">
                            {(
                              item.discountedPrice ?? item.product.price
                            ).toFixed(2)}
                          </td>
                          <td className="text-right">
                            {getItemTotal(item).toFixed(2)}
                          </td>
                        </tr>
                        {item.appliedDiscount && (
                          <tr className="text-xs text-gray-600">
                            <td colSpan={4} className="py-1 pl-4">
                              <Tag className="h-3 w-3 inline mr-1" />
                              {item.appliedDiscount.name}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-lg">
                  <span>Subtotal:</span>
                  <span>{currentReceipt.subtotal.toFixed(2)}</span>
                </div>
                {currentReceipt.totalDiscount > 0 && (
                  <div className="flex justify-between text-lg text-green-600">
                    <span>Total Discount:</span>
                    <span>-{currentReceipt.totalDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-bold border-t border-gray-300 pt-2">
                  <span>Total:</span>
                  <span>{currentReceipt.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg">
                  <span>Cash:</span>
                  <span>{currentReceipt.cashAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xl font-bold border-t-2 border-gray-300 pt-2">
                  <span>Change:</span>
                  <span className="text-green-600">
                    {currentReceipt.change.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="text-center mt-6 text-sm text-gray-500">
                <p>Thank you for your purchase!</p>
                {currentReceipt.totalDiscount > 0 && (
                  <p className="text-green-600 font-semibold">
                    You saved ₱{currentReceipt.totalDiscount.toFixed(2)}!
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={handlePrintReceipt}
              className="flex items-center gap-2"
            >
              <Printer className="h-4 w-4" />
              Print Receipt
            </Button>
            <Button type="button" variant="outline" onClick={handleNewSale}>
              New Sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProtectedRoute>
  );
};

export default POSPage;
