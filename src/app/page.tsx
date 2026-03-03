"use client";

import React, { useEffect, useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import api from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";
import SalesTrendChart from "@/components/SalesTrendChart";
import {
  ShoppingCart,
  TrendingUp,
  Package,
  DollarSign,
  AlertTriangle,
  Users,
  Building2,
  Activity,
  ArrowRight,
  Calendar,
  Clock,
  Loader2,
  PackageX,
  ChartNoAxesCombined,
  Percent,
  List,
  History,
  PackagePlus,
  Wifi,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import dayjs from "dayjs";
import { io, Socket } from "socket.io-client";

interface DashboardStats {
  todaySales: number;
  todayTransactions: number;
  lowStockCount: number;
  totalProducts: number;
  recentSales: Array<{
    id: number;
    createdAt: string;
    totalAmount: number;
    user: {
      fullName: string;
      username: string;
    };
  }>;
  outOfStockCount?: number;
  criticalStockCount?: number;
}

interface User {
  id: number;
  role: string;
  fullName: string;
  username: string;
  branchId: number;
  currentBranchId: number | null;
  branch?: {
    id: number;
    name: string;
    code: string;
  };
  currentBranch?: {
    id: number;
    name: string;
    code: string;
  };
}

const HomePage = () => {
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0,
    todayTransactions: 0,
    lowStockCount: 0,
    totalProducts: 0,
    recentSales: [],
  });
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeBranch, setActiveBranch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isConnected, setIsConnected] = useState(false);
  const [newSaleAnimation, setNewSaleAnimation] = useState(false);
  const [latestSaleEvent, setLatestSaleEvent] = useState<{
    id: number;
    totalAmount: number;
    soldAt: string;
    branchId: number;
  } | null>(null);

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    fetchCurrentUser();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchDashboardStats();
      initializeSocket();
    }

    return () => {
      if (socketRef.current) {
        // console.log("Cleaning up socket connection");
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [currentUser]);

  const initializeSocket = () => {
    if (socketRef.current) {
      // console.log("Socket already initialized");
      return;
    }

    const socketUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000";
    console.log("Connecting to Socket.IO server:", socketUrl);

    const newSocket = io(socketUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    newSocket.on("connect", () => {
      // console.log("✅ Socket connected:", newSocket.id);
      setIsConnected(true);
      // toast.success("Real-time updates connected", {
      //   icon: <Wifi className="h-4 w-4" />,
      // });

      // Join branch-specific room
      if (currentUser) {
        const isViewingAllBranches =
          currentUser.role === "admin" && !currentUser.currentBranchId;

        if (isViewingAllBranches) {
          // console.log("Admin viewing all branches - joining admin-all room");
          newSocket.emit("join-branch", null);
        } else {
          const branchId = currentUser.currentBranchId || currentUser.branchId;
          console.log("Joining branch room:", branchId);
          newSocket.emit("join-branch", branchId);
        }
      }
    });

    newSocket.on("connect_error", (error) => {
      console.error("❌ Socket connection error:", error);
      setIsConnected(false);
    });

    newSocket.on("disconnect", (reason) => {
      // console.log("Socket disconnected:", reason);
      setIsConnected(false);
      // toast.error("Real-time updates disconnected", {
      //   icon: <WifiOff className="h-4 w-4" />,
      // });
    });

    // Listen for new sales
    newSocket.on("sale:new", (saleData) => {
      // console.log("🛒 New sale received:", saleData);

      // Trigger animation
      setNewSaleAnimation(true);
      setTimeout(() => setNewSaleAnimation(false), 1000);

      // Show notification
      toast.success(
        `New sale: ₱${parseFloat(saleData.totalAmount).toLocaleString(
          undefined,
          {
            minimumFractionDigits: 2,
          },
        )}`,
        {
          icon: <ShoppingCart className="h-4 w-4" />,
        },
      );

      setLatestSaleEvent({
        id: saleData.id,
        totalAmount: parseFloat(saleData.totalAmount),
        soldAt: saleData.soldAt,
        branchId: saleData.branchId,
      });

      // Update stats with deduplication
      setStats((prev) => {
        const newSale = {
          id: saleData.id,
          createdAt: saleData.soldAt,
          totalAmount: parseFloat(saleData.totalAmount),
          user: saleData.user,
        };

        // Remove duplicate if it exists
        const existingSales = prev.recentSales.filter(
          (sale) => sale.id !== saleData.id,
        );

        return {
          ...prev,
          todaySales: prev.todaySales + parseFloat(saleData.totalAmount),
          todayTransactions: prev.todayTransactions + 1,
          recentSales: [newSale, ...existingSales].slice(0, 10),
        };
      });
    });

    // Listen for stock updates
    newSocket.on("stock:update", (stockData) => {
      // console.log("📦 Stock update received:", stockData);
      fetchDashboardStats();
    });

    // Listen for low stock alerts
    newSocket.on("stock:low-alert", (productData) => {
      // console.log("⚠️ Low stock alert:", productData);
      toast.warning(
        `Low stock alert: ${productData.name} (${productData.currentStock} remaining)`,
        {
          icon: <AlertTriangle className="h-4 w-4" />,
          duration: 5000,
        },
      );
      fetchDashboardStats();
    });

    // Listen for dashboard refresh requests
    newSocket.on("dashboard:refresh", () => {
      // console.log("🔄 Dashboard refresh requested");
      fetchDashboardStats();
    });

    socketRef.current = newSocket;
  };

  const fetchCurrentUser = async () => {
    try {
      const res = await api.get("/auth/me");
      setCurrentUser(res.data);
      const branch = res.data.currentBranch || res.data.branch;
      setActiveBranch(branch);
    } catch (error) {
      console.error("Error fetching user:", error);
      toast.error("Failed to fetch user information");
    }
  };

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const res = await api.get("/dashboard/stats");
      // console.log("📊 Dashboard stats fetched:", res.data);
      setStats(res.data);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      toast.error("Failed to fetch dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const isViewingAllBranches =
    currentUser?.role === "admin" && !currentUser?.currentBranchId;

  const isAdmin = currentUser?.role === "admin";

  // Quick actions based on user role
  const quickActions = [
    {
      title: "Point of Sale",
      description: "Process new transactions",
      icon: ShoppingCart,
      href: "/pos",
      color: "from-emerald-500 to-green-600",
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-200",
      roles: ["admin", "manager", "cashier"], // Available to all
    },
    {
      title: "Sales Report",
      description: "View sales analytics",
      icon: TrendingUp,
      href: "/sales",
      color: "from-blue-500 to-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      roles: ["admin", "manager", "cashier"], // Available to all
    },
    {
      title: "Stock Management",
      description: "Manage inventory levels",
      icon: Package,
      href: "/stock",
      color: "from-purple-500 to-purple-600",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-200",
      roles: ["admin"], // Admin only
    },
    {
      title: "Activity Logs",
      description: "Track system activities",
      icon: Activity,
      href: "/logs",
      color: "from-amber-500 to-orange-600",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
      roles: ["admin"], // Admin only
    },
  ].filter((action) => action.roles.includes(currentUser?.role || ""));

  const adminActions = [
    {
      title: "Products",
      icon: Package,
      href: "/products",
      color: "text-emerald-600",
    },
    {
      title: "Categories",
      icon: List,
      href: "/categories",
      color: "text-blue-600",
    },
    {
      title: "Discounts",
      icon: Percent,
      href: "/discounts",
      color: "text-purple-600",
    },
    {
      title: "Users",
      icon: Users,
      href: "/users",
      color: "text-amber-600",
    },
    {
      title: "Branches",
      icon: Building2,
      href: "/branches",
      color: "text-pink-600",
    },
  ];

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center h-screen bg-gradient-to-br from-emerald-50 to-green-50">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-emerald-600 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Loading dashboard...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50 pb-24">
        <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
          {/* Header with Connection Status */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                    Welcome back,{" "}
                    {currentUser?.fullName || currentUser?.username}!
                  </h1>
                  {/* Connection Status Indicator */}
                  <div className="flex items-center gap-2">
                    {isConnected ? (
                      <div className="relative">
                        <Wifi className="h-5 w-5 text-emerald-500" />
                        <span className="absolute -top-1 -right-1 h-2 w-2 bg-emerald-500 rounded-full animate-pulse"></span>
                      </div>
                    ) : (
                      <WifiOff className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                </div>
                <p className="text-gray-600 mt-1">
                  Here's what's happening with your store today
                  {isConnected && (
                    <span className="text-emerald-600 font-semibold">
                      {" "}
                      • Live
                    </span>
                  )}
                </p>
              </div>
              <div className="flex flex-col items-start md:items-end gap-1">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="h-4 w-4 text-emerald-600" />
                  <span className="font-medium">
                    {dayjs(currentTime).format("MMMM DD, YYYY")}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="h-4 w-4 text-emerald-600" />
                  <span className="font-medium">
                    {dayjs(currentTime).format("h:mm:ss A")}
                  </span>
                </div>
              </div>
            </div>

            {/* Branch Info */}
            {activeBranch && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Building2 className="h-4 w-4 text-emerald-600" />
                <span>
                  {isViewingAllBranches ? (
                    <span className="font-semibold text-emerald-700">
                      Viewing All Branches
                    </span>
                  ) : (
                    <>
                      Currently at:{" "}
                      <span className="font-semibold text-emerald-700">
                        {activeBranch.name} ({activeBranch.code})
                      </span>
                    </>
                  )}
                </span>
              </div>
            )}
          </motion.div>

          {/* Stats Cards with Animation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <motion.div
              key={`sales-${stats.todaySales}`}
              animate={newSaleAnimation ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 0.5 }}
            >
              <Card className="p-5 border-2 border-emerald-100 hover:border-emerald-300 hover:shadow-lg transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                      Today's Sales
                    </p>
                    <p className="text-3xl font-bold text-emerald-600 mt-2">
                      ₱
                      {stats.todaySales.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {stats.todayTransactions} transactions
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-white" />
                  </div>
                </div>
              </Card>
            </motion.div>

            <Card className="p-5 border-2 border-blue-100 hover:border-blue-300 hover:shadow-lg transition-all">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                    Transactions
                  </p>
                  <p className="text-3xl font-bold text-blue-600 mt-2">
                    {stats.todayTransactions}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Today's count</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-blue-500 flex items-center justify-center">
                  <ShoppingCart className="h-6 w-6 text-white" />
                </div>
              </div>
            </Card>

            {/* Show stock stats only for admins */}
            {isAdmin && (
              <>
                <Card className="p-5 border-2 border-orange-100 hover:border-orange-300 hover:shadow-lg transition-all">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                        Low Stock Items
                      </p>
                      <p className="text-3xl font-bold text-orange-600 mt-2">
                        {stats.lowStockCount}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Needs attention
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-orange-500 flex items-center justify-center">
                      <AlertTriangle className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </Card>

                <Card className="p-5 border-2 border-purple-100 hover:border-purple-300 hover:shadow-lg transition-all">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                        Total Products
                      </p>
                      <p className="text-3xl font-bold text-purple-600 mt-2">
                        {stats.totalProducts}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">In inventory</p>
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-purple-500 flex items-center justify-center">
                      <Package className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </Card>
              </>
            )}
          </motion.div>

          {/* Quick Actions - Role-based filtering */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Quick Actions
            </h2>
            <div
              className={`grid grid-cols-1 sm:grid-cols-2 ${isAdmin ? "lg:grid-cols-4" : "lg:grid-cols-2"} gap-4`}
            >
              {quickActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <Link key={index} href={action.href}>
                    <Card
                      className={`p-5 cursor-pointer transition-all border-2 ${action.borderColor} hover:shadow-lg group`}
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={`h-14 w-14 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0`}
                        >
                          <Icon className="h-7 w-7 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-800 text-lg truncate">
                            {action.title}
                          </p>
                          <p className="text-sm text-gray-600 line-clamp-2">
                            {action.description}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center text-emerald-600 text-sm font-semibold group-hover:gap-2 transition-all">
                        <span>Open</span>
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <SalesTrendChart
              isConnected={isConnected}
              latestSale={latestSaleEvent}
            />
          </motion.div>

          {/* Recent Sales and Admin Panel / Stock Alert */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Sales */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="overflow-hidden border-2 border-emerald-100">
                <div className="bg-gradient-to-r from-emerald-50 to-green-50 px-6 py-4 border-b-2 border-emerald-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                      <History className="h-5 w-5 text-emerald-600" />
                      Recent Sales
                      {isConnected && (
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-semibold">
                          Live
                        </span>
                      )}
                    </h3>
                    <Link href="/sales">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="hover:bg-emerald-100 text-emerald-700"
                      >
                        View All
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
                <div className="p-4">
                  {stats.recentSales.length === 0 ? (
                    <div className="text-center py-8">
                      <ShoppingCart className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500">No sales yet today</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <AnimatePresence mode="popLayout">
                        {stats.recentSales.slice(0, 5).map((sale) => (
                          <motion.div
                            key={`sale-${sale.id}`}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.3 }}
                            className="flex items-center justify-between p-3 border-2 border-gray-200 rounded-xl hover:bg-emerald-50 hover:border-emerald-300 transition-all"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className="bg-emerald-50 text-emerald-700 border-emerald-200"
                                >
                                  #{sale.id}
                                </Badge>
                                <span className="text-sm text-gray-600">
                                  {dayjs(sale.createdAt).format("h:mm A")}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                By {sale.user.fullName || sale.user.username}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-emerald-600">
                                ₱
                                {sale.totalAmount.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                })}
                              </p>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>

            {/* Admin Management Panel or Stock Alert (for non-admin) */}
            {isAdmin ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="overflow-hidden border-2 border-purple-100">
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4 border-b-2 border-purple-100">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                      <ChartNoAxesCombined className="h-5 w-5 text-purple-600" />
                      Admin Management
                    </h3>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-3">
                      {adminActions.map((action, index) => {
                        const Icon = action.icon;
                        return (
                          <Link key={index} href={action.href}>
                            <Card className="p-4 cursor-pointer hover:shadow-md transition-all border-2 border-gray-200 hover:border-purple-300 group">
                              <div className="flex flex-col items-center text-center gap-2">
                                <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                                  <Icon className={`h-6 w-6 ${action.color}`} />
                                </div>
                                <p className="font-semibold text-gray-800 text-sm">
                                  {action.title}
                                </p>
                              </div>
                            </Card>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </Card>
              </motion.div>
            ) : (
              /* Performance Summary for Non-Admin Users */
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="overflow-hidden border-2 border-blue-100">
                  <div className="bg-gradient-to-r from-blue-50 to-cyan-50 px-6 py-4 border-b-2 border-blue-100">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-blue-600" />
                      Your Performance
                    </h3>
                  </div>
                  <div className="p-6">
                    <div className="space-y-4">
                      <div className="text-center">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-emerald-100 to-green-100 mb-4">
                          <DollarSign className="h-10 w-10 text-emerald-600" />
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          Today's Sales
                        </p>
                        <p className="text-3xl font-bold text-emerald-600">
                          ₱
                          {stats.todaySales.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                        <p className="text-sm text-gray-500 mt-2">
                          {stats.todayTransactions} transactions completed
                        </p>
                      </div>
                      <div className="pt-4 border-t">
                        <Link href="/sales">
                          <Button className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white">
                            <TrendingUp className="h-4 w-4 mr-2" />
                            View Detailed Report
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default HomePage;
