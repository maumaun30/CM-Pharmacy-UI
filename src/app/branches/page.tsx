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
  Search,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
  const [fetchLoading, setFetchLoading] = useState(true);
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
      setFetchLoading(true);
      const res = await api.get("/branches");
      setBranches(res.data);
    } catch (error) {
      toast.error("Failed to fetch branches");
    } finally {
      setFetchLoading(false);
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
        toast.success("Branch updated successfully");
      } else {
        await api.post("/branches", formData);
        toast.success("Branch created successfully");
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
      toast.success("Branch deleted successfully");
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
      toast.error(
        error.response?.data?.message || "Error toggling branch status",
      );
    }
  };

  const filteredBranches = branches.filter(
    (branch) =>
      branch.name.toLowerCase().includes(search.toLowerCase()) ||
      branch.code.toLowerCase().includes(search.toLowerCase()) ||
      branch.city?.toLowerCase().includes(search.toLowerCase()),
  );

  if (fetchLoading) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center h-screen bg-gradient-to-br from-emerald-50 to-green-50">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-emerald-600 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Loading branches...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50 pb-24">
        <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                  Branches
                </h1>
                <p className="text-sm text-gray-600">
                  Manage your branch locations and details
                </p>
              </div>
            </div>
            <Button
              onClick={() => handleOpenModal()}
              className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold shadow-lg self-start sm:self-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Branch
            </Button>
          </motion.div>

          {/* Stats Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4"
          >
            <Card className="p-5 border-2 border-emerald-100 hover:border-emerald-300 hover:shadow-lg transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                    Total Branches
                  </p>
                  <p className="text-3xl font-bold text-gray-800 mt-1">
                    {branches.length}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-white" />
                </div>
              </div>
            </Card>

            <Card className="p-5 border-2 border-emerald-100 hover:border-emerald-300 hover:shadow-lg transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                    Active
                  </p>
                  <p className="text-3xl font-bold text-emerald-600 mt-1">
                    {branches.filter((b) => b.isActive).length}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                  <ToggleRight className="h-6 w-6 text-white" />
                </div>
              </div>
            </Card>

            <Card className="p-5 border-2 border-emerald-100 hover:border-emerald-300 hover:shadow-lg transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                    Inactive
                  </p>
                  <p className="text-3xl font-bold text-red-600 mt-1">
                    {branches.filter((b) => !b.isActive).length}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-gray-400 flex items-center justify-center">
                  <ToggleLeft className="h-6 w-6 text-white" />
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Search */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-4 border-2 border-emerald-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Search by name, code, or city..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-12 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                />
              </div>
            </Card>
          </motion.div>

          {/* Branches Table/Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {filteredBranches.length === 0 ? (
              <Card className="p-12 text-center border-2 border-dashed border-emerald-200">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-50 mb-4">
                  <Building2 className="h-10 w-10 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  No branches found
                </h3>
                <p className="text-gray-600 mb-4">
                  {search
                    ? "Try adjusting your search"
                    : "Get started by adding your first branch"}
                </p>
                {!search && (
                  <Button
                    onClick={() => handleOpenModal()}
                    className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Branch
                  </Button>
                )}
              </Card>
            ) : (
              <Card className="overflow-hidden border-2 border-emerald-100">
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-emerald-50 to-green-50 hover:from-emerald-50 hover:to-green-50">
                        <TableHead className="font-bold text-gray-800">
                          Code
                        </TableHead>
                        <TableHead className="font-bold text-gray-800">
                          Name
                        </TableHead>
                        <TableHead className="font-bold text-gray-800">
                          Location
                        </TableHead>
                        <TableHead className="font-bold text-gray-800">
                          Contact
                        </TableHead>
                        <TableHead className="font-bold text-gray-800">
                          Manager
                        </TableHead>
                        <TableHead className="font-bold text-gray-800">
                          Status
                        </TableHead>
                        <TableHead className="font-bold text-gray-800 text-center">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBranches.map((branch) => (
                        <TableRow
                          key={branch.id}
                          className="hover:bg-emerald-50 transition-colors"
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className="bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold"
                              >
                                {branch.code}
                              </Badge>
                              {branch.isMainBranch && (
                                <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold text-gray-800">
                            {branch.name}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-start gap-2">
                              <MapPin className="h-4 w-4 text-emerald-600 mt-1 flex-shrink-0" />
                              <div className="text-sm">
                                {branch.city && (
                                  <div className="font-medium text-gray-800">
                                    {branch.city}
                                  </div>
                                )}
                                {branch.province && (
                                  <div className="text-gray-600">
                                    {branch.province}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm space-y-1">
                              {branch.phone && (
                                <div className="flex items-center gap-2 text-gray-700">
                                  <Phone className="h-3 w-3 text-emerald-600" />
                                  {branch.phone}
                                </div>
                              )}
                              {branch.email && (
                                <div className="flex items-center gap-2 text-gray-700">
                                  <Mail className="h-3 w-3 text-emerald-600" />
                                  {branch.email}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {branch.managerName && (
                              <div className="flex items-center gap-2 text-sm text-gray-700">
                                <User className="h-3 w-3 text-emerald-600" />
                                {branch.managerName}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {branch.isActive ? (
                              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">
                                Active
                              </Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200">
                                Inactive
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => toggleBranchStatus(branch)}
                                className="h-8 w-8 hover:bg-emerald-50"
                              >
                                {branch.isActive ? (
                                  <ToggleRight className="h-4 w-4 text-emerald-600" />
                                ) : (
                                  <ToggleLeft className="h-4 w-4 text-gray-400" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenModal(branch)}
                                className="h-8 w-8 hover:bg-blue-50"
                              >
                                <Pencil className="h-4 w-4 text-blue-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setBranchToDelete(branch);
                                  setDeleteOpen(true);
                                }}
                                className="h-8 w-8 hover:bg-red-50"
                              >
                                <Trash className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-emerald-100">
                  {filteredBranches.map((branch) => (
                    <div
                      key={branch.id}
                      className="p-4 hover:bg-emerald-50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-bold text-gray-800 text-lg">
                              {branch.name}
                            </h3>
                            {branch.isMainBranch && (
                              <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs"
                            >
                              {branch.code}
                            </Badge>
                            {branch.isActive ? (
                              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-xs">
                                Active
                              </Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-800 hover:bg-red-100 text-xs">
                                Inactive
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        {(branch.city || branch.province) && (
                          <div className="flex items-start gap-2 text-sm">
                            <MapPin className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                            <span className="text-gray-700">
                              {branch.city}
                              {branch.city && branch.province && ", "}
                              {branch.province}
                            </span>
                          </div>
                        )}
                        {branch.phone && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-4 w-4 text-emerald-600" />
                            <span className="text-gray-700">{branch.phone}</span>
                          </div>
                        )}
                        {branch.email && (
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-4 w-4 text-emerald-600" />
                            <span className="text-gray-700">{branch.email}</span>
                          </div>
                        )}
                        {branch.managerName && (
                          <div className="flex items-center gap-2 text-sm">
                            <User className="h-4 w-4 text-emerald-600" />
                            <span className="text-gray-700">
                              {branch.managerName}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleBranchStatus(branch)}
                          className="flex-1 border-emerald-300 hover:bg-emerald-50"
                        >
                          {branch.isActive ? (
                            <>
                              <ToggleRight className="h-4 w-4 mr-2 text-emerald-600" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="h-4 w-4 mr-2 text-gray-400" />
                              Activate
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenModal(branch)}
                          className="border-blue-300 hover:bg-blue-50"
                        >
                          <Pencil className="h-4 w-4 text-blue-600" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setBranchToDelete(branch);
                            setDeleteOpen(true);
                          }}
                          className="border-red-300 hover:bg-red-50"
                        >
                          <Trash className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </motion.div>
        </div>

        {/* Create/Edit Modal */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="sm:max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Building2 className="h-6 w-6 text-emerald-600" />
                {editingBranch ? "Edit" : "Add"} Branch
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-2 text-sm font-semibold text-gray-700">
                    Branch Name *
                  </Label>
                  <Input
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Main Branch"
                    className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
                <div>
                  <Label className="mb-2 text-sm font-semibold text-gray-700">
                    Branch Code *
                  </Label>
                  <Input
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        code: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="MAIN"
                    maxLength={10}
                    className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
              </div>

              <div>
                <Label className="mb-2 text-sm font-semibold text-gray-700">
                  Address
                </Label>
                <Input
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  placeholder="Street address"
                  className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label className="mb-2 text-sm font-semibold text-gray-700">
                    City
                  </Label>
                  <Input
                    value={formData.city}
                    onChange={(e) =>
                      setFormData({ ...formData, city: e.target.value })
                    }
                    className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
                <div>
                  <Label className="mb-2 text-sm font-semibold text-gray-700">
                    Province
                  </Label>
                  <Input
                    value={formData.province}
                    onChange={(e) =>
                      setFormData({ ...formData, province: e.target.value })
                    }
                    className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
                <div>
                  <Label className="mb-2 text-sm font-semibold text-gray-700">
                    Postal Code
                  </Label>
                  <Input
                    value={formData.postalCode}
                    onChange={(e) =>
                      setFormData({ ...formData, postalCode: e.target.value })
                    }
                    className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-2 text-sm font-semibold text-gray-700">
                    Phone
                  </Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    placeholder="+63 XXX XXX XXXX"
                    className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
                <div>
                  <Label className="mb-2 text-sm font-semibold text-gray-700">
                    Email
                  </Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="branch@pharmacy.com"
                    className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
              </div>

              <div>
                <Label className="mb-2 text-sm font-semibold text-gray-700">
                  Manager Name
                </Label>
                <Input
                  value={formData.managerName}
                  onChange={(e) =>
                    setFormData({ ...formData, managerName: e.target.value })
                  }
                  placeholder="Branch manager"
                  className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-4 p-4 bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl border-2 border-emerald-200">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isActive: !!checked })
                    }
                    className="border-emerald-600 data-[state=checked]:bg-emerald-600"
                  />
                  <Label
                    htmlFor="isActive"
                    className="cursor-pointer font-semibold text-gray-800"
                  >
                    Active Branch
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isMainBranch"
                    checked={formData.isMainBranch}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isMainBranch: !!checked })
                    }
                    className="border-amber-600 data-[state=checked]:bg-amber-600"
                  />
                  <Label
                    htmlFor="isMainBranch"
                    className="cursor-pointer font-semibold text-gray-800 flex items-center gap-1"
                  >
                    <Star className="h-4 w-4 text-amber-500" />
                    Main Branch
                  </Label>
                </div>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={handleCloseModal}
                disabled={loading}
                className="w-full sm:w-auto border-gray-300"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Branch"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent className="sm:max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-red-600 flex items-center gap-2">
                <AlertCircle className="h-6 w-6" />
                Delete Branch
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-gray-700 mb-4">
                Are you sure you want to delete{" "}
                <span className="font-bold text-gray-900">
                  {branchToDelete?.name}
                </span>
                ?
              </p>
              <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                <div className="flex items-start gap-2 text-sm text-red-800">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>
                    This action cannot be undone. All data associated with this
                    branch will be permanently deleted.
                  </span>
                </div>
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteOpen(false);
                  setBranchToDelete(null);
                }}
                className="w-full sm:w-auto border-gray-300"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                className="w-full sm:w-auto bg-red-600 hover:bg-red-700"
              >
                <Trash className="w-4 h-4 mr-2" />
                Delete Branch
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
};

export default BranchesPage;