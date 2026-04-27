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
import { Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";

interface Branch {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
}

export default function BranchSwitcher() {
  const { user, loading: authLoading } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<number | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (!user) return;
    setActiveBranchId(user.current_branch_id || user.branch_id);
    if (user.role === "admin") {
      fetchBranches();
    }
  }, [user]);

  const fetchBranches = async () => {
    try {
      const res = await api.get("/branches?is_active=true");
      setBranches(res.data);
    } catch (error) {
      console.error("Error fetching branches:", error);
      toast.error("Failed to fetch branches");
    }
  };

  const handleBranchSwitch = async (branch_id: string) => {
    try {
      setSwitching(true);
      await api.post("/auth/switch-branch", { branchId: parseInt(branch_id) });
      setActiveBranchId(parseInt(branch_id));
      toast.success("Branch switched successfully", {
        description: "Page will reload to update data",
      });
      setTimeout(() => window.location.reload(), 500);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to switch branch");
      setSwitching(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <Loader2 className="h-4 w-4 text-emerald-600 animate-spin" />
        <span className="text-sm text-gray-500">Loading...</span>
      </div>
    );
  }

  if (!user) return null;

  // Admin view — Branch switcher
  if (user.role === "admin") {
    const activeBranch = branches.find((b) => b.id === activeBranchId);

    return (
      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center justify-center h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 shadow-sm">
          <Building2 className="h-4 w-4 text-white" />
        </div>
        <Select
          value={activeBranchId?.toString()}
          onValueChange={handleBranchSwitch}
          disabled={switching}
        >
          <SelectTrigger className="w-[180px] border-2 border-emerald-300 hover:border-emerald-400 focus:ring-2 focus:ring-emerald-200 font-medium">
            <SelectValue placeholder="Select branch">
              {switching ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Switching...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Building2 className="h-3 w-3 sm:hidden" />
                  {activeBranch?.name}
                </span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="border-2 border-emerald-200">
            {branches.map((branch) => (
              <SelectItem key={branch.id} value={branch.id.toString()} className="cursor-pointer">
                <div className="flex items-center justify-between w-full gap-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3 w-3 text-emerald-600" />
                    <span className="font-medium">{branch.name}</span>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200"
                  >
                    {branch.code}
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  // Non-admin view — Static branch display
  if (user.branch) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-emerald-50 to-green-50 rounded-lg border-2 border-emerald-200 shadow-sm">
        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
          <Building2 className="h-4 w-4 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-gray-800 leading-tight">{user.branch.name}</span>
          <span className="text-xs text-emerald-600 leading-tight">{user.branch.code}</span>
        </div>
      </div>
    );
  }

  return null;
}
