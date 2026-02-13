// app/branches/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import api from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";
import {
  Building2,
  Plus,
  Pencil,
  Trash,
  ToggleLeft,
  ToggleRight,
  MapPin,
  Phone,
  Mail,
  User,
  Star,
} from "lucide-react";

interface Branch {
  id: number;
  name: string;
  code: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  phone: string;
  email: string;
  managerName: string;
  isActive: boolean;
  isMainBranch: boolean;
  operatingHours: any;
}

const BranchesPage = () => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    address: "",
    city: "",
    province: "",
    postalCode: "",
    phone: "",
    email: "",
    managerName: "",
    isActive: true,
    isMainBranch: false,
  });

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    try {
      const res = await api.get("/branches");
      setBranches(res.data);
    } catch (error) {
      toast.error("Failed to fetch branches");
    }
  };

  const handleOpenModal = (branch?: Branch) => {
    if (branch) {
      setEditingBranch(branch);
      setFormData({
        name: branch.name,
        code: branch.code,
        address: branch.address || "",
        city: branch.city || "",
        province: branch.province || "",
        postalCode: branch.postalCode || "",
        phone: branch.phone || "",
        email: branch.email || "",
        managerName: branch.managerName || "",
        isActive: branch.isActive,
        isMainBranch: branch.isMainBranch,
      });
    } else {
      setEditingBranch(null);
      setFormData({
        name: "",
        code: "",
        address: "",
        city: "",
        province: "",
        postalCode: "",
        phone: "",
        email: "",
        managerName: "",
        isActive: true,
        isMainBranch: false,
      });
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingBranch(null);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.code) {
      toast.error("Name and code are required");
      return;
    }

    try {
      setLoading(true);
      if (editingBranch) {
        await api.put(`/branches/${editingBranch.id}`, formData);
        toast.success("Branch updated");
      } else {
        await api.post("/branches", formData);
        toast.success("Branch created");
      }
      handleCloseModal();
      fetchBranches();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Error saving branch");
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!branchToDelete) return;

    try {
      await api.delete(`/branches/${branchToDelete.id}`);
      toast.success("Branch deleted");
      fetchBranches();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Error deleting branch");
    } finally {
      setDeleteOpen(false);
      setBranchToDelete(null);
    }
  };

  const toggleBranchStatus = async (branch: Branch) => {
    try {
      await api.patch(`/branches/${branch.id}/toggle`);
      toast.success(`Branch ${branch.isActive ? "deactivated" : "activated"}`);
      fetchBranches();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Error toggling branch status");
    }
  };

  const filteredBranches = branches.filter(
    (branch) =>
      branch.name.toLowerCase().includes(search.toLowerCase()) ||
      branch.code.toLowerCase().includes(search.toLowerCase()) ||
      branch.city?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ProtectedRoute>
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            Branches
          </h1>
          <Button variant="outline" onClick={() => handleOpenModal()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Branch
          </Button>
        </div>

        {/* Search */}
        <Input
          placeholder="Search branches..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />

        {/* Branches Table */}
        <Card className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBranches.map((branch) => (
                <TableRow key={branch.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{branch.code}</Badge>
                      {branch.isMainBranch && (
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{branch.name}</TableCell>
                  <TableCell>
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                      <div className="text-sm">
                        {branch.city && <div>{branch.city}</div>}
                        {branch.province && (
                          <div className="text-muted-foreground">
                            {branch.province}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm space-y-1">
                      {branch.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {branch.phone}
                        </div>
                      )}
                      {branch.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          {branch.email}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {branch.managerName && (
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-3 w-3 text-muted-foreground" />
                        {branch.managerName}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {branch.isActive ? (
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center space-x-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => toggleBranchStatus(branch)}
                    >
                      {branch.isActive ? (
                        <ToggleRight className="h-4 w-4 text-green-600" />
                      ) : (
                        <ToggleLeft className="h-4 w-4 text-gray-400" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleOpenModal(branch)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setBranchToDelete(branch);
                        setDeleteOpen(true);
                      }}
                    >
                      <Trash className="h-4 w-4 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* Create/Edit Modal */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="sm:max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingBranch ? "Edit" : "Add"} Branch
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1">Branch Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Main Branch"
                  />
                </div>
                <div>
                  <Label className="mb-1">Branch Code *</Label>
                  <Input
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value.toUpperCase() })
                    }
                    placeholder="MAIN"
                    maxLength={10}
                  />
                </div>
              </div>

              <div>
                <Label className="mb-1">Address</Label>
                <Input
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  placeholder="Street address"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="mb-1">City</Label>
                  <Input
                    value={formData.city}
                    onChange={(e) =>
                      setFormData({ ...formData, city: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label className="mb-1">Province</Label>
                  <Input
                    value={formData.province}
                    onChange={(e) =>
                      setFormData({ ...formData, province: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label className="mb-1">Postal Code</Label>
                  <Input
                    value={formData.postalCode}
                    onChange={(e) =>
                      setFormData({ ...formData, postalCode: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1">Phone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    placeholder="+63 XXX XXX XXXX"
                  />
                </div>
                <div>
                  <Label className="mb-1">Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="branch@pharmacy.com"
                  />
                </div>
              </div>

              <div>
                <Label className="mb-1">Manager Name</Label>
                <Input
                  value={formData.managerName}
                  onChange={(e) =>
                    setFormData({ ...formData, managerName: e.target.value })
                  }
                  placeholder="Branch manager"
                />
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isActive: !!checked })
                    }
                  />
                  <Label htmlFor="isActive" className="cursor-pointer">
                    Active
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isMainBranch"
                    checked={formData.isMainBranch}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isMainBranch: !!checked })
                    }
                  />
                  <Label htmlFor="isMainBranch" className="cursor-pointer">
                    Main Branch
                  </Label>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={handleCloseModal}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent className="sm:max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="text-red-600">Delete Branch</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600">
              Are you sure you want to delete{" "}
              <span className="font-semibold">{branchToDelete?.name}</span>? This
              action cannot be undone.
            </p>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => {
                  setDeleteOpen(false);
                  setBranchToDelete(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDelete}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
};

export default BranchesPage;