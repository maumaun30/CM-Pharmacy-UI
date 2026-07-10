"use client";

import React, { useEffect, useMemo, useState } from "react";

import api from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";
import RoleProtectedRoute from "@/components/RoleProtectedRoute";
import { roleLabel, permissionLabel } from "@/lib/permissions";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { motion } from "framer-motion";
import { ShieldCheck, Check, Minus, Loader2, AlertCircle } from "lucide-react";

type RoleRow = { role: string; permissions: string[] };
type RolesResponse = { permissions: string[]; roles: RoleRow[] };

// Colour per role, reusing the palette already used on the Users page.
function roleBadgeClass(role: string): string {
  switch (role) {
    case "admin":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "manager":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "cashier":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

export default function SettingsPage() {
  const [data, setData] = useState<RolesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await api.get<RolesResponse>("/auth/roles");
        if (active) setData(res.data);
      } catch {
        if (active) setError("Could not load the roles matrix.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Group the flat permission list by resource ("products.write" -> "products")
  // so the table reads as labelled sections.
  const groups = useMemo(() => {
    if (!data) return [] as { resource: string; keys: string[] }[];
    const order: string[] = [];
    const byResource: Record<string, string[]> = {};
    for (const key of data.permissions) {
      const resource = key.split(".")[0];
      if (!byResource[resource]) {
        byResource[resource] = [];
        order.push(resource);
      }
      byResource[resource].push(key);
    }
    return order.map((resource) => ({ resource, keys: byResource[resource] }));
  }, [data]);

  const has = (role: RoleRow, key: string) => role.permissions.includes(key);

  return (
    <RoleProtectedRoute requiredPermissions={["users.read"]}>
      <ProtectedRoute>
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50 pb-24">
          <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3"
            >
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg">
                <ShieldCheck className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                  Roles &amp; Permissions
                </h1>
                <p className="text-sm text-gray-600">
                  What each role can do. Defined in code — update the matrix in the
                  API&apos;s <code className="text-emerald-700">config/permissions.js</code>.
                </p>
              </div>
            </motion.div>

            {/* Role summary chips */}
            {data && (
              <div className="flex flex-wrap gap-2">
                {data.roles.map((r) => (
                  <Badge
                    key={r.role}
                    variant="outline"
                    className={`${roleBadgeClass(r.role)} capitalize`}
                  >
                    {roleLabel(r.role)} · {r.permissions.length} permissions
                  </Badge>
                ))}
              </div>
            )}

            {/* States */}
            {loading && (
              <Card className="p-10 flex items-center justify-center border-emerald-100">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-600 mr-2" />
                <span className="text-gray-600">Loading matrix…</span>
              </Card>
            )}

            {error && !loading && (
              <Card className="p-6 flex items-center gap-3 border-red-200 bg-red-50">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <span className="text-red-700">{error}</span>
              </Card>
            )}

            {/* Matrix */}
            {data && !loading && (
              <Card className="border-emerald-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-emerald-50/60">
                        <TableHead className="min-w-[220px]">Capability</TableHead>
                        {data.roles.map((r) => (
                          <TableHead key={r.role} className="text-center capitalize">
                            {roleLabel(r.role)}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groups.map((group) => (
                        <React.Fragment key={group.resource}>
                          <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                            <TableCell
                              colSpan={data.roles.length + 1}
                              className="font-semibold text-emerald-700 capitalize"
                            >
                              {group.resource}
                            </TableCell>
                          </TableRow>
                          {group.keys.map((key) => (
                            <TableRow key={key}>
                              <TableCell className="text-gray-700">
                                {permissionLabel(key)}
                                <span className="block text-xs text-gray-400">
                                  {key}
                                </span>
                              </TableCell>
                              {data.roles.map((r) => (
                                <TableCell key={r.role} className="text-center">
                                  {has(r, key) ? (
                                    <Check className="h-4 w-4 text-emerald-600 mx-auto" />
                                  ) : (
                                    <Minus className="h-4 w-4 text-gray-300 mx-auto" />
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}
          </div>
        </div>
      </ProtectedRoute>
    </RoleProtectedRoute>
  );
}
