"use client";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import BranchSwitcher from "@/components/BranchSwitcher";

import {
  User,
  List,
  Percent,
  ShoppingCart,
  Activity,
  Menu,
  ChartNoAxesCombined,
  LogOut,
  Settings,
  UserCircle,
  Package,
  Users,
  Tag,
  Building2,
  TrendingUp,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

export default function Navbar() {
  const { user } = useAuth();
  const router = useRouter();

  const logout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  const brand = process.env.NEXT_PUBLIC_SITE_NAME
    ? process.env.NEXT_PUBLIC_SITE_NAME
    : "Brand Logo";

  return (
    <nav className="border-t-2 border-emerald-200 bg-white shadow-lg fixed bottom-0 left-0 w-full h-auto z-50">
      <div className="px-3 sm:px-4 py-3 flex justify-between items-center max-w-screen-2xl mx-auto">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
            <ShoppingCart className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-base sm:text-lg bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent hidden sm:inline">
            {brand}
          </span>
        </Link>

        {user && (
          <>
            {/* Desktop Navigation (xl and above - 1280px+) */}
            <div className="hidden xl:flex items-center gap-3">
              {/* Main Actions */}
              <div className="flex items-center gap-2">
                <Link href="/pos">
                  <Button
                    className="cursor-pointer bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold shadow-md hover:shadow-lg transition-all"
                    size="sm"
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    POS
                  </Button>
                </Link>
                <Link href="/sales">
                  <Button
                    className="cursor-pointer border-emerald-300 hover:bg-emerald-50 hover:border-emerald-400 font-medium"
                    variant="outline"
                    size="sm"
                  >
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Sales
                  </Button>
                </Link>
              </div>

              {/* Admin Actions */}
              {user.role === "admin" && (
                <div className="flex items-center gap-2 pl-3 border-l-2 border-emerald-200">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        className="cursor-pointer border-emerald-300 hover:bg-emerald-50 hover:border-emerald-400 font-medium"
                        variant="outline"
                        size="sm"
                      >
                        <List className="w-4 h-4 mr-2" />
                        Management
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      side="top"
                      align="end"
                      className="mb-2 w-52 border-emerald-200"
                    >
                      <DropdownMenuLabel className="text-emerald-700 font-bold">
                        Management
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link
                          href="/products"
                          className="cursor-pointer flex items-center"
                        >
                          <Package className="w-4 h-4 mr-2 text-emerald-600" />
                          Products
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link
                          href="/branches"
                          className="cursor-pointer flex items-center"
                        >
                          <Building2 className="w-4 h-4 mr-2 text-emerald-600" />
                          Branches
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link
                          href="/categories"
                          className="cursor-pointer flex items-center"
                        >
                          <List className="w-4 h-4 mr-2 text-emerald-600" />
                          Categories
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link
                          href="/discounts"
                          className="cursor-pointer flex items-center"
                        >
                          <Percent className="w-4 h-4 mr-2 text-emerald-600" />
                          Discounts
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link
                          href="/users"
                          className="cursor-pointer flex items-center"
                        >
                          <Users className="w-4 h-4 mr-2 text-emerald-600" />
                          Users
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        className="cursor-pointer border-emerald-300 hover:bg-emerald-50 hover:border-emerald-400 font-medium"
                        variant="outline"
                        size="sm"
                      >
                        <ChartNoAxesCombined className="w-4 h-4 mr-2" />
                        Inventory
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      side="top"
                      align="end"
                      className="mb-2 w-52 border-emerald-200"
                    >
                      <DropdownMenuLabel className="text-emerald-700 font-bold">
                        Inventory
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link
                          href="/stock"
                          className="cursor-pointer flex items-center"
                        >
                          <Package className="w-4 h-4 mr-2 text-emerald-600" />
                          Stock List
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link
                          href="/stock/add"
                          className="cursor-pointer flex items-center"
                        >
                          <Package className="w-4 h-4 mr-2 text-emerald-600" />
                          Add Stock
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link
                          href="/stock/adjust"
                          className="cursor-pointer flex items-center"
                        >
                          <ChartNoAxesCombined className="w-4 h-4 mr-2 text-emerald-600" />
                          Adjust Stock
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link
                          href="/stock/transactions"
                          className="cursor-pointer flex items-center"
                        >
                          <Activity className="w-4 h-4 mr-2 text-emerald-600" />
                          Transactions
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Link href="/logs">
                    <Button
                      className="cursor-pointer border-emerald-300 hover:bg-emerald-50 hover:border-emerald-400 font-medium"
                      variant="outline"
                      size="sm"
                    >
                      <Activity className="w-4 h-4 mr-2" />
                      Logs
                    </Button>
                  </Link>
                </div>
              )}

              <div className="pl-3 border-l-2 border-emerald-200">
                <BranchSwitcher />
              </div>

              {/* User Menu */}
              <div className="pl-3 border-l-2 border-emerald-200">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      className="cursor-pointer border-emerald-300 hover:bg-emerald-50 hover:border-emerald-400 font-medium"
                      variant="outline"
                      size="sm"
                    >
                      <UserCircle className="w-4 h-4 mr-2" />
                      <span className="max-w-[120px] truncate">
                        {user.fullName || user.username}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    side="top"
                    align="end"
                    className="mb-2 w-48 border-emerald-200"
                  >
                    <DropdownMenuLabel className="text-emerald-700">
                      <div className="flex flex-col">
                        <span className="font-bold">
                          {user.fullName || user.username}
                        </span>
                        <span className="text-xs text-gray-500 font-normal capitalize">
                          {user.role}
                        </span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link
                        href="/account"
                        className="cursor-pointer flex items-center"
                      >
                        <User className="w-4 h-4 mr-2 text-emerald-600" />
                        Account
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link
                        href="/settings"
                        className="cursor-pointer flex items-center"
                      >
                        <Settings className="w-4 h-4 mr-2 text-emerald-600" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-red-600 cursor-pointer font-medium"
                      onClick={logout}
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Tablet Navigation (md to xl - 768px to 1279px) */}
            <div className="hidden md:flex xl:hidden items-center gap-2">
              <Link href="/pos">
                <Button
                  className="cursor-pointer bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold shadow-md"
                  size="sm"
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  POS
                </Button>
              </Link>
              <Link href="/sales">
                <Button
                  className="cursor-pointer border-emerald-300 hover:bg-emerald-50 hover:border-emerald-400 font-medium"
                  variant="outline"
                  size="sm"
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Sales
                </Button>
              </Link>

              <div className="pl-2 border-l-2 border-emerald-200">
                <BranchSwitcher />
              </div>

              {/* Tablet Menu - Comprehensive Dropdown */}
              <div className="pl-2 border-l-2 border-emerald-200">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      className="cursor-pointer border-2 border-emerald-300 hover:bg-emerald-50"
                      variant="outline"
                      size="sm"
                    >
                      <Menu className="w-4 h-4 mr-2 text-emerald-600" />
                      Menu
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    side="top"
                    align="end"
                    className="mb-2 w-56 border-2 border-emerald-200 max-h-[70vh] overflow-y-auto"
                  >
                    {/* User Info */}
                    <DropdownMenuLabel className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center flex-shrink-0">
                          <UserCircle className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-800 truncate">
                            {user.fullName || user.username}
                          </p>
                          <p className="text-xs text-gray-500 capitalize">
                            {user.role}
                          </p>
                        </div>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    {/* Admin Section */}
                    {user.role === "admin" && (
                      <>
                        <DropdownMenuLabel className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
                          Management
                        </DropdownMenuLabel>
                        <DropdownMenuItem asChild>
                          <Link
                            href="/products"
                            className="cursor-pointer flex items-center py-2"
                          >
                            <Package className="w-4 h-4 mr-3 text-emerald-600" />
                            Products
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link
                            href="/branches"
                            className="cursor-pointer flex items-center py-2"
                          >
                            <Building2 className="w-4 h-4 mr-3 text-emerald-600" />
                            Branches
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link
                            href="/categories"
                            className="cursor-pointer flex items-center py-2"
                          >
                            <List className="w-4 h-4 mr-3 text-emerald-600" />
                            Categories
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link
                            href="/discounts"
                            className="cursor-pointer flex items-center py-2"
                          >
                            <Percent className="w-4 h-4 mr-3 text-emerald-600" />
                            Discounts
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link
                            href="/users"
                            className="cursor-pointer flex items-center py-2"
                          >
                            <Users className="w-4 h-4 mr-3 text-emerald-600" />
                            Users
                          </Link>
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
                          Inventory
                        </DropdownMenuLabel>
                        <DropdownMenuItem asChild>
                          <Link
                            href="/stock"
                            className="cursor-pointer flex items-center py-2"
                          >
                            <Package className="w-4 h-4 mr-3 text-emerald-600" />
                            Stock List
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link
                            href="/stock/add"
                            className="cursor-pointer flex items-center py-2"
                          >
                            <Package className="w-4 h-4 mr-3 text-emerald-600" />
                            Add Stock
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link
                            href="/stock/adjust"
                            className="cursor-pointer flex items-center py-2"
                          >
                            <ChartNoAxesCombined className="w-4 h-4 mr-3 text-emerald-600" />
                            Adjust Stock
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link
                            href="/stock/transactions"
                            className="cursor-pointer flex items-center py-2"
                          >
                            <Activity className="w-4 h-4 mr-3 text-emerald-600" />
                            Transactions
                          </Link>
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link
                            href="/logs"
                            className="cursor-pointer flex items-center py-2"
                          >
                            <Activity className="w-4 h-4 mr-3 text-emerald-600" />
                            Activity Logs
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}

                    {/* User Section */}
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
                      Account
                    </DropdownMenuLabel>
                    <DropdownMenuItem asChild>
                      <Link
                        href="/account"
                        className="cursor-pointer flex items-center py-2"
                      >
                        <User className="w-4 h-4 mr-3 text-emerald-600" />
                        My Account
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link
                        href="/settings"
                        className="cursor-pointer flex items-center py-2"
                      >
                        <Settings className="w-4 h-4 mr-3 text-emerald-600" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-red-600 cursor-pointer font-semibold py-2"
                      onClick={logout}
                    >
                      <LogOut className="w-4 h-4 mr-3" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Mobile Navigation (below md - under 768px) */}
            <div className="flex md:hidden items-center gap-2">
              <Link href="/pos">
                <Button
                  className="cursor-pointer h-10 w-10 p-0 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white shadow-md"
                  size="sm"
                >
                  <ShoppingCart className="w-5 h-5" />
                </Button>
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    className="cursor-pointer h-10 w-10 p-0 border-2 border-emerald-300 hover:bg-emerald-50"
                    variant="outline"
                    size="sm"
                  >
                    <Menu className="w-5 h-5 text-emerald-600" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="top"
                  align="end"
                  className="mb-2 w-64 border-2 border-emerald-200 max-h-[80vh] overflow-y-auto"
                >
                  {/* User Info */}
                  <DropdownMenuLabel className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center flex-shrink-0">
                        <UserCircle className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-800 truncate">
                          {user.fullName || user.username}
                        </p>
                        <p className="text-xs text-gray-500 capitalize">
                          {user.role}
                        </p>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  {/* Main Actions */}
                  <DropdownMenuLabel className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
                    Quick Actions
                  </DropdownMenuLabel>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/sales"
                      className="cursor-pointer flex items-center py-2"
                    >
                      <TrendingUp className="w-4 h-4 mr-3 text-emerald-600" />
                      Sales
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/logs"
                      className="cursor-pointer flex items-center py-2"
                    >
                      <Activity className="w-4 h-4 mr-3 text-emerald-600" />
                      Activity Logs
                    </Link>
                  </DropdownMenuItem>

                  {/* Admin Section */}
                  {user.role === "admin" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
                        Management
                      </DropdownMenuLabel>
                      <DropdownMenuItem asChild>
                        <Link
                          href="/products"
                          className="cursor-pointer flex items-center py-2"
                        >
                          <Package className="w-4 h-4 mr-3 text-emerald-600" />
                          Products
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link
                          href="/branches"
                          className="cursor-pointer flex items-center py-2"
                        >
                          <Building2 className="w-4 h-4 mr-3 text-emerald-600" />
                          Branches
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link
                          href="/categories"
                          className="cursor-pointer flex items-center py-2"
                        >
                          <List className="w-4 h-4 mr-3 text-emerald-600" />
                          Categories
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link
                          href="/discounts"
                          className="cursor-pointer flex items-center py-2"
                        >
                          <Percent className="w-4 h-4 mr-3 text-emerald-600" />
                          Discounts
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link
                          href="/users"
                          className="cursor-pointer flex items-center py-2"
                        >
                          <Users className="w-4 h-4 mr-3 text-emerald-600" />
                          Users
                        </Link>
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
                        Inventory
                      </DropdownMenuLabel>
                      <DropdownMenuItem asChild>
                        <Link
                          href="/stock"
                          className="cursor-pointer flex items-center py-2"
                        >
                          <Package className="w-4 h-4 mr-3 text-emerald-600" />
                          Stock List
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link
                          href="/stock/add"
                          className="cursor-pointer flex items-center py-2"
                        >
                          <Package className="w-4 h-4 mr-3 text-emerald-600" />
                          Add Stock
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link
                          href="/stock/adjust"
                          className="cursor-pointer flex items-center py-2"
                        >
                          <ChartNoAxesCombined className="w-4 h-4 mr-3 text-emerald-600" />
                          Adjust Stock
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link
                          href="/stock/transactions"
                          className="cursor-pointer flex items-center py-2"
                        >
                          <Activity className="w-4 h-4 mr-3 text-emerald-600" />
                          Transactions
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}

                  {/* User Section */}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
                    Account
                  </DropdownMenuLabel>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/account"
                      className="cursor-pointer flex items-center py-2"
                    >
                      <User className="w-4 h-4 mr-3 text-emerald-600" />
                      My Account
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/settings"
                      className="cursor-pointer flex items-center py-2"
                    >
                      <Settings className="w-4 h-4 mr-3 text-emerald-600" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-red-600 cursor-pointer font-semibold py-2"
                    onClick={logout}
                  >
                    <LogOut className="w-4 h-4 mr-3" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        )}
      </div>
    </nav>
  );
}