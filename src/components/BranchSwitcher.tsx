// components/BranchSwitcher.tsx
"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2 } from "lucide-react";
import { toast } from "sonner";

interface Branch {
  id: number;
  name: string;
  code: string;
}

interface User {
  branchId: number;
  currentBranchId: number | null;
  role: string;
  branch?: {
    id: number;
    name: string;
    code: string;
  };
}

export default function BranchSwitcher() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeBranchId, setActiveBranchId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    // Only fetch branches if user is admin
    if (currentUser?.role === "admin") {
      fetchBranches();
    }
  }, [currentUser]);

  const fetchBranches = async () => {
    try {
      const res = await api.get("/branches?isActive=true");
      setBranches(res.data);
    } catch (error) {
      console.error("Error fetching branches:", error);
      toast.error("Failed to fetch branches");
    }
  };

  const fetchCurrentUser = async () => {
    try {
      setLoading(true);
      const res = await api.get("/auth/me");
      setCurrentUser(res.data);
      setActiveBranchId(res.data.currentBranchId || res.data.branchId);
    } catch (error) {
      console.error("Error fetching user:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBranchSwitch = async (branchId: string) => {
    try {
      await api.post("/auth/switch-branch", { branchId: parseInt(branchId) });
      setActiveBranchId(parseInt(branchId));
      toast.success("Branch switched successfully");
      // Optionally reload the page to refresh data
      window.location.reload();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to switch branch");
    }
  };

  if (loading) {
    return null;
  }

  // Show branch switcher only for admins
  if (currentUser?.role === "admin") {
    return (
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <Select
          value={activeBranchId?.toString()}
          onValueChange={handleBranchSwitch}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select branch" />
          </SelectTrigger>
          <SelectContent>
            {branches.map((branch) => (
              <SelectItem key={branch.id} value={branch.id.toString()}>
                {branch.name} ({branch.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  // Show static branch display for non-admins
  if (currentUser?.branch) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{currentUser.branch.name}</span>
      </div>
    );
  }

  return null;
}
