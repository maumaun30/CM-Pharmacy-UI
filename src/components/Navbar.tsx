"use client";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

import {
  User,
  List,
  Percent,
  ShoppingCart,
  Activity,
  Menu,
  ChartNoAxesCombined,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
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
    <nav className="border-t border-gray-200 p-4 flex justify-between items-center fixed bottom-0 left-0 w-full h-16 bg-white z-50">
      <div className="font-bold">{brand}</div>

      {user && (
        <>
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-2">
            {/* Main Actions */}
            <div className="flex items-center gap-2 border-r pr-2 mr-2">
              <Link href="/pos">
                <Button className="cursor-pointer" variant="outline" size="sm">
                  <ShoppingCart className="w-4 h-4" />
                  POS
                </Button>
              </Link>
              <Link href="/sales">
                <Button className="cursor-pointer" variant="outline" size="sm">
                  <Percent className="w-4 h-4" />
                  Sales
                </Button>
              </Link>
            </div>

            {/* Admin Actions */}
            {user.role === "admin" && (
              <div className="flex items-center gap-2 border-r pr-2 mr-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      className="cursor-pointer"
                      variant="outline"
                      size="sm"
                    >
                      <List className="w-4 h-4" />
                      CMS
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="top" align="end" className="mb-2">
                    <DropdownMenuItem asChild>
                      <Link href="/categories">Categories</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/products">Products</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/discounts">Discounts</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/users">Users</Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      className="cursor-pointer"
                      variant="outline"
                      size="sm"
                    >
                      <ChartNoAxesCombined className="w-4 h-4" />
                      Stocks
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="top" align="end" className="mb-2">
                    <DropdownMenuItem asChild>
                      <Link href="/stock">List</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/stock/add">Add</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/stock/adjust">Adjust</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/stock/transactions">Transactions</Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Link href="/logs">
                  <Button
                    className="cursor-pointer"
                    variant="outline"
                    size="sm"
                  >
                    <Activity className="w-4 h-4" />
                    Logs
                  </Button>
                </Link>
              </div>
            )}

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="cursor-pointer" variant="outline" size="sm">
                  <User className="w-4 h-4" />
                  {user.username}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" className="mb-2">
                <DropdownMenuItem asChild>
                  <Link href="/account">Account</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600" onClick={logout}>
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile Navigation */}
          <div className="flex md:hidden items-center gap-2">
            <Link href="/pos">
              <Button className="cursor-pointer" variant="outline" size="sm">
                <ShoppingCart className="w-4 h-4" />
              </Button>
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="cursor-pointer" variant="outline" size="sm">
                  <Menu className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" className="mb-2 w-48">
                {/* Main Actions */}
                <DropdownMenuItem asChild>
                  <Link href="/sales" className="flex items-center gap-2">
                    <Percent className="w-4 h-4" />
                    Sales
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/logs" className="flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Logs
                  </Link>
                </DropdownMenuItem>

                {/* Admin Section */}
                {user.role === "admin" && (
                  <>
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1.5 text-sm font-semibold text-gray-500">
                      CMS
                    </div>
                    <DropdownMenuItem asChild>
                      <Link href="/categories">Categories</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/products">Products</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/discounts">Discounts</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/users">Users</Link>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />
                    <div className="px-2 py-1.5 text-sm font-semibold text-gray-500">
                      Stocks
                    </div>
                    <DropdownMenuItem asChild>
                      <Link href="/stock">List</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/stock/add">Add</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/stock/adjust">Adjust</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/stock/transactions">Transactions</Link>
                    </DropdownMenuItem>
                  </>
                )}

                {/* User Section */}
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-sm font-semibold text-gray-500">
                  {user.username}
                </div>
                <DropdownMenuItem asChild>
                  <Link href="/account">Account</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600" onClick={logout}>
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </>
      )}
    </nav>
  );
}
