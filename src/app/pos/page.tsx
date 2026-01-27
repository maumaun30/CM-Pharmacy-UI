"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ProtectedRoute from "@/components/ProtectedRoute";
import { toast } from "sonner";
import api from "@/lib/api";
import { Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import Cart from "@/icons/Cart";
import Trash from "@/icons/Trash";

interface Product {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

interface CartItem {
  product: Product;
  quantity: number;
}

const POSPage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loadingProductId, setLoadingProductId] = useState<number | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [lastAddedId, setLastAddedId] = useState<number | null>(null);
  const [mobileCartVisible, setMobileCartVisible] = useState(false);
  const [cartBtn, setCartBtn] = useState(true);

  const isMobile = useMediaQuery("(max-width: 991px)");

  useEffect(() => {
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

    fetchProducts();
  }, []);

  products;

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
      return [...prev, { product, quantity: 1 }];
    });

    setLoadingProductId(null);
    setLastAddedId(product.id); // Mark as recently added
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

  const total = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  );

  const handleCheckout = async () => {
    setCheckingOut(true);
    try {
      const res = await api.post("/sales", { cart });
      setCart([]);
      setLastAddedId(null);
      toast.success("Sale completed successfully");
    } catch (error: any) {
      const msg = error?.response?.data?.message || "Error during checkout";
      toast.error(msg);
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 p-5 h-full">
        {/* Product List */}
        <div className="md:col-span-2 space-y-5 overflow-auto">
          <ul className="grid grid-cols-1 gap-0">
            {products.map((product) => (
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
                    ₱
                    {product.price.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
              </li>
            ))}
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
              <Cart color="white" />
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
                      <Cart />
                    </p>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setMobileCartVisible(false);
                        setCartBtn(true);
                      }}
                    >
                      ✕
                    </Button>
                  </div>

                  <div className="overflow-y-auto h-[calc(100%-8rem)] px-5 pt-5 pb-15">
                    {cart.length === 0 ? (
                      <p className="text-sm">No items in cart.</p>
                    ) : (
                      cart.map((item) => (
                        <div
                          key={item.product.id}
                          className="flex justify-between items-center py-5 [&:not(:last-of-type)]:border-b-1 border-gray-200"
                        >
                          <div>
                            <p className="font-medium">{item.product.name}</p>
                            <p className="text-sm">
                              ₱
                              {item.product.price.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{" "}
                              x{" "}
                              <input
                                type="number"
                                className="w-16 inline-block p-2 outline-0 border-b-[1px] border-gray-200"
                                min={1}
                                max={item.product.quantity}
                                value={item.quantity}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  updateQuantity(
                                    item.product.id,
                                    isNaN(val) || val < 1 ? 1 : val,
                                  );
                                }}
                              />
                            </p>
                          </div>
                          <Button
                            className="cursor-pointer"
                            variant="ghost"
                            onClick={() => removeFromCart(item.product.id)}
                          >
                            <Trash />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="absolute bottom-0 left-0 w-full p-4 border-t-[1px] border-gray-200 bg-white">
                    <p className="font-semibold mb-2">
                      Total: ₱
                      {total.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                    <Button
                      onClick={handleCheckout}
                      className="cursor-pointer w-full px-5 py-2"
                      disabled={checkingOut}
                    >
                      {checkingOut ? (
                        <Loader2 className="animate-spin h-5 w-5" />
                      ) : (
                        "Checkout"
                      )}
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
                <Cart />
              </div>
              {cart.length === 0 ? (
                <div className="pt-21 pb-16 h-full overflow-auto">
                  <p className="text-sm">No items in cart.</p>
                </div>
              ) : (
                <div className="pt-21 pb-29 h-full max-h-[calc(100vh-9rem)] overflow-auto">
                  <div>
                    {cart.map((item) => (
                      <div
                        key={item.product.id}
                        className="flex-grow flex justify-between items-center [&:not(:last-of-type)]:border-b-1 border-gray-200 p-5"
                      >
                        <div>
                          <p className="font-medium">{item.product.name}</p>
                          <p className="text-sm">
                            ₱
                            {item.product.price.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                            x{" "}
                            <input
                              type="number"
                              className="w-16 inline-block p-2 outline-0 border-b-[1px] border-gray-200"
                              min={1}
                              max={item.product.quantity}
                              value={item.quantity}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                updateQuantity(
                                  item.product.id,
                                  isNaN(val) || val < 1 ? 1 : val,
                                );
                              }}
                            />
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          className="cursor-pointer"
                          onClick={() => removeFromCart(item.product.id)}
                        >
                          <Trash />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="absolute bottom-0 left-0 w-full h-26 pt-5 space-y-5 bg-white border-t-[1px] border-gray-200">
                    <p className="font-semibold">
                      Total: ₱
                      {total.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                    <Button
                      onClick={handleCheckout}
                      className="w-full px-5 py-2 cursor-pointer"
                      disabled={checkingOut}
                    >
                      {checkingOut ? (
                        <Loader2 className="animate-spin mr-2 h-5 w-5" />
                      ) : (
                        "Checkout"
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
};

export default POSPage;
