"use client";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

import { User, List, Percent, ShoppingCart } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
    <nav className="border-t border-gray-200 p-4 flex justify-between fixed bottom-0 left-0 w-full h-16 bg-white">
      <div className="font-bold">{brand}</div>

      {user && (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4">
            <Link href="/pos">
              <Button className="cursor-pointer" variant="outline" size="sm">
                <ShoppingCart />
                POS
              </Button>
            </Link>
            <Link href="/sales">
              <Button className="cursor-pointer" variant="outline" size="sm">
                <Percent />
                Sales
              </Button>
            </Link>
          </div>

          {user.role === "admin" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="cursor-pointer" variant="outline" size="sm">
                  <List />
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
                  <Link href="/users">Users</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="cursor-pointer" variant="outline" size="sm">
                <User />
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
              <DropdownMenuItem className="text-red-600" onClick={logout}>
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </nav>
  );
}
