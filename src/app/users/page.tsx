"use client";

import React, { useEffect, useState, useMemo } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import ProtectedRoute from "@/components/ProtectedRoute";
import {
  Plus,
  Pencil,
  Trash,
  Building2,
  Users as UsersIcon,
  Search,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  UserCircle,
  Mail,
  Phone,
  Shield,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { motion } from "framer-motion";

interface Branch {
  id: number;
  name: string;
  code: string;
}

type User = {
  id: number;
  username: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  contactNumber: string;
  branchId: number | null;
  isActive: boolean;
  branch: Branch | null;
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    role: "",
    firstName: "",
    lastName: "",
    contactNumber: "",
    isActive: false,
    branchId: "",
  });
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<keyof User>("id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const fetchUsers = async () => {
    try {
      setFetchLoading(true);
      const res = await api.get("/users");
      setUsers(res.data);
    } catch (error: any) {
      toast.error("Failed to fetch users");
    } finally {
      setFetchLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await api.get("/branches?isActive=true");
      setBranches(res.data);
    } catch (error) {
      console.error("Error fetching branches:", error);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchBranches();
  }, []);

  const handleOpenModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        contactNumber: user.contactNumber,
        isActive: user.isActive,
        branchId: user.branchId ? String(user.branchId) : "",
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: "",
        email: "",
        role: "",
        firstName: "",
        lastName: "",
        contactNumber: "",
        isActive: true,
        branchId: "",
      });
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingUser(null);
  };

  const handleSubmit = async () => {
    const {
      username,
      email,
      role,
      firstName,
      lastName,
      contactNumber,
      isActive,
      branchId,
    } = formData;
    if (!username.trim()) return toast.error("Username is required");
    if (!role) return toast.error("Role is required");
    if (!branchId) return toast.error("Branch is required");

    try {
      setLoading(true);
      const payload = {
        username,
        email,
        role,
        firstName,
        lastName,
        contactNumber,
        isActive,
        branchId: parseInt(branchId),
      };

      if (editingUser) {
        await api.put(`/users/${editingUser.id}`, payload);
        toast.success("User updated successfully");
      } else {
        await api.post("/users", payload);
        toast.success("User created successfully");
      }
      handleCloseModal();
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Error saving user");
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;

    try {
      await api.delete(`/users/${userToDelete.id}`);
      toast.success("User deleted successfully");
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Error deleting user");
    } finally {
      setDeleteOpen(false);
      setUserToDelete(null);
    }
  };

  const filtered = useMemo(() => {
    let data = users.filter(
      (u) =>
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        u.firstName.toLowerCase().includes(search.toLowerCase()) ||
        u.lastName.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        u.branch?.name.toLowerCase().includes(search.toLowerCase()) ||
        u.branch?.code.toLowerCase().includes(search.toLowerCase()),
    );
    data = data.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      return sortDir === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
    return data;
  }, [users, search, sortBy, sortDir]);

  const paginated = useMemo(() => {
    const start = (page - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, page, perPage]);

  const totalPages = Math.ceil(filtered.length / perPage);

  const handleSort = (key: keyof User) => {
    if (sortBy === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role.toLowerCase()) {
      case "admin":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "manager":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "cashier":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const activeCount = users.filter((u) => u.isActive).length;
  const inactiveCount = users.length - activeCount;

  if (fetchLoading) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center h-screen bg-gradient-to-br from-emerald-50 to-green-50">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-emerald-600 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Loading users...</p>
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
                <UsersIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                  Users
                </h1>
                <p className="text-sm text-gray-600">
                  Manage user accounts and permissions
                </p>
              </div>
            </div>
            <Button
              onClick={() => handleOpenModal()}
              className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold shadow-lg self-start sm:self-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </motion.div>

          {/* Stats Cards */}
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
                    Total Users
                  </p>
                  <p className="text-3xl font-bold text-gray-800 mt-1">
                    {users.length}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                  <UsersIcon className="h-6 w-6 text-white" />
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
                    {activeCount}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                  <UserCircle className="h-6 w-6 text-white" />
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
                    {inactiveCount}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-gray-400 flex items-center justify-center">
                  <UserCircle className="h-6 w-6 text-white" />
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Search and Controls */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-4 border-2 border-emerald-100">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    placeholder="Search by name, username, email, or branch..."
                    className="pl-10 h-12 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                    value={search}
                    onChange={(e) => {
                      setPage(1);
                      setSearch(e.target.value);
                    }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600 whitespace-nowrap">
                    Rows per page:
                  </span>
                  <select
                    value={perPage}
                    onChange={(e) => {
                      setPage(1);
                      setPerPage(Number(e.target.value));
                    }}
                    className="border-2 border-emerald-200 rounded-lg px-3 py-2 text-sm font-medium focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"
                  >
                    {[5, 10, 20, 50].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {paginated.length === 0 ? (
              <Card className="p-12 text-center border-2 border-dashed border-emerald-200">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-50 mb-4">
                  <UsersIcon className="h-10 w-10 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  No users found
                </h3>
                <p className="text-gray-600 mb-4">
                  {search
                    ? "Try adjusting your search"
                    : "Get started by adding your first user"}
                </p>
                {!search && (
                  <Button
                    onClick={() => handleOpenModal()}
                    className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                )}
              </Card>
            ) : (
              <Card className="overflow-hidden border-2 border-emerald-100">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-emerald-50 to-green-50 hover:from-emerald-50 hover:to-green-50">
                        {[
                          { key: "id", label: "ID" },
                          { key: "name", label: "Name" },
                          { key: "username", label: "Username" },
                          { key: "email", label: "Email" },
                          { key: "role", label: "Role" },
                          { key: "branch", label: "Branch" },
                          { key: "isActive", label: "Status" },
                        ].map((col) => (
                          <TableHead
                            key={col.key}
                            className="cursor-pointer select-none font-bold text-gray-800 whitespace-nowrap"
                            onClick={() => handleSort(col.key as keyof User)}
                          >
                            <div className="flex items-center gap-2">
                              {col.label}
                              <ArrowUpDown className="h-4 w-4 text-emerald-600" />
                              {sortBy === col.key && (
                                <span className="text-emerald-600 font-bold">
                                  {sortDir === "asc" ? "↑" : "↓"}
                                </span>
                              )}
                            </div>
                          </TableHead>
                        ))}
                        <TableHead className="text-center font-bold text-gray-800">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginated.map((user) => (
                        <TableRow
                          key={user.id}
                          className="hover:bg-emerald-50 transition-colors"
                        >
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="bg-emerald-50 text-emerald-700 border-emerald-200"
                            >
                              #{user.id}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-semibold text-gray-800">
                                {user.firstName} {user.lastName}
                              </div>
                              {user.contactNumber && (
                                <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                  <Phone className="h-3 w-3" />
                                  {user.contactNumber}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium text-gray-800">
                            {user.username}
                          </TableCell>
                          <TableCell className="text-sm text-gray-700">
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3 text-gray-400" />
                              {user.email}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={getRoleBadgeColor(user.role)}
                            >
                              <Shield className="h-3 w-3 mr-1" />
                              {user.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const branch = branches.find(
                                (b) => b.id === user.branchId,
                              );

                              return branch ? (
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4 text-emerald-600" />
                                  <div>
                                    <div className="font-semibold text-sm text-gray-800">
                                      {branch.name}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {branch.code}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400 italic">
                                  No branch assigned
                                </span>
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            {user.isActive ? (
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
                                onClick={() => handleOpenModal(user)}
                                className="h-8 w-8 hover:bg-blue-50"
                              >
                                <Pencil className="h-4 w-4 text-blue-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setUserToDelete(user);
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
              </Card>
            )}
          </motion.div>

          {/* Pagination */}
          {paginated.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="p-4 border-2 border-emerald-100">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="text-sm text-gray-600">
                    Showing{" "}
                    <span className="font-semibold text-gray-800">
                      {(page - 1) * perPage + 1}
                    </span>{" "}
                    -{" "}
                    <span className="font-semibold text-gray-800">
                      {Math.min(page * perPage, filtered.length)}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-gray-800">
                      {filtered.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="border-emerald-300 hover:bg-emerald-50"
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Previous
                    </Button>
                    <div className="px-3 py-1 bg-emerald-50 border-2 border-emerald-200 rounded-lg">
                      <span className="text-sm font-semibold text-emerald-700">
                        Page {page} of {totalPages}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={page === totalPages}
                      className="border-emerald-300 hover:bg-emerald-50"
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </div>

        {/* Add/Edit Modal */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="sm:max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <UsersIcon className="h-6 w-6 text-emerald-600" />
                {editingUser ? "Edit" : "Add"} User
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-5 py-4">
              <div>
                <Label className="mb-2 text-sm font-semibold text-gray-700">
                  Username *
                </Label>
                <Input
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  placeholder="johndoe"
                  className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-2 text-sm font-semibold text-gray-700">
                    First Name
                  </Label>
                  <Input
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    placeholder="John"
                    className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
                <div>
                  <Label className="mb-2 text-sm font-semibold text-gray-700">
                    Last Name
                  </Label>
                  <Input
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    placeholder="Doe"
                    className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-2 text-sm font-semibold text-gray-700">
                    Email
                  </Label>
                  <Input
                    value={formData.email}
                    type="email"
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="john@example.com"
                    className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
                <div>
                  <Label className="mb-2 text-sm font-semibold text-gray-700">
                    Contact Number
                  </Label>
                  <Input
                    value={formData.contactNumber}
                    type="tel"
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        contactNumber: e.target.value,
                      })
                    }
                    placeholder="+63 XXX XXX XXXX"
                    className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-2 text-sm font-semibold text-gray-700">
                    Role *
                  </Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) =>
                      setFormData({ ...formData, role: value })
                    }
                  >
                    <SelectTrigger className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cashier">Cashier</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="admin">Administrator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="mb-2 text-sm font-semibold text-gray-700">
                    Status
                  </Label>
                  <Select
                    value={String(formData.isActive)}
                    onValueChange={(value) =>
                      setFormData({ ...formData, isActive: value === "true" })
                    }
                  >
                    <SelectTrigger className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200">
                      <SelectValue placeholder="Active?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Active</SelectItem>
                      <SelectItem value="false">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="mb-2 text-sm font-semibold text-gray-700">
                  Branch *
                </Label>
                <Select
                  value={formData.branchId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, branchId: value })
                  }
                >
                  <SelectTrigger className="h-11 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={String(branch.id)}>
                        {branch.name} ({branch.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  "Save User"
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
                Delete User
              </DialogTitle>
            </DialogHeader>

            <div className="py-4">
              <p className="text-gray-700 mb-4">
                Are you sure you want to delete{" "}
                <span className="font-bold text-gray-900">
                  {userToDelete?.username}
                </span>
                ?
              </p>
              <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                <div className="flex items-start gap-2 text-sm text-red-800">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>
                    This action cannot be undone. This user will be permanently
                    removed from the system.
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteOpen(false);
                  setUserToDelete(null);
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
                Delete User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
}
