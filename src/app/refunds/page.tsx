"use client";

// Refund request review queue (admin/manager). Pending requests are approved
// or declined here; approval executes the refund server-side via the same
// atomic RPC as direct refunds. Realtime: the NotificationProvider dispatches
// "refund-requests:changed" on refund-request:new/resolved socket events and
// this page refetches.

import { useCallback, useEffect, useState } from "react";
import RoleProtectedRoute from "@/components/RoleProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Check, Clock, RotateCcw, X } from "lucide-react";
import {
  approveRefundRequest,
  declineRefundRequest,
  listRefundRequests,
  RefundRequest,
} from "@/lib/refundRequests";

function StatusBadge({ status }: { status: RefundRequest["status"] }) {
  if (status === "approved")
    return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Approved</Badge>;
  if (status === "declined")
    return <Badge className="bg-red-100 text-red-700 border-red-200">Declined</Badge>;
  return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Pending</Badge>;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
}

function RequestCard({
  request,
  onApprove,
  onDecline,
  busy,
}: {
  request: RefundRequest;
  onApprove?: (r: RefundRequest) => void;
  onDecline?: (r: RefundRequest) => void;
  busy: boolean;
}) {
  return (
    <Card className="border-emerald-100">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-gray-800">Sale #{request.sale_id}</span>
              <StatusBadge status={request.status} />
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {request.items.length} item{request.items.length !== 1 ? "s" : ""} ·{" "}
              <span className="font-semibold text-gray-800">
                ₱{Number(request.total_refund).toFixed(2)}
              </span>
            </p>
            {request.reason && (
              <p className="text-sm text-gray-500 mt-1 italic">“{request.reason}”</p>
            )}
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDate(request.created_at)} · by {request.requester?.name || "Unknown"}
            </p>
            {request.status !== "pending" && (
              <p className="text-xs text-gray-500 mt-1">
                {request.status === "approved" ? "Approved" : "Declined"} by{" "}
                {request.reviewer?.name || "Unknown"}
                {request.reviewed_at ? ` · ${formatDate(request.reviewed_at)}` : ""}
                {request.review_note ? ` — “${request.review_note}”` : ""}
              </p>
            )}
          </div>
          {request.status === "pending" && onApprove && onDecline && (
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={busy}
                onClick={() => onApprove(request)}
                className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Check className="w-4 h-4 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => onDecline(request)}
                className="cursor-pointer border-red-300 text-red-600 hover:bg-red-50"
              >
                <X className="w-4 h-4 mr-1" />
                Decline
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function RefundRequestsPage() {
  const [pending, setPending] = useState<RefundRequest[]>([]);
  const [resolved, setResolved] = useState<RefundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<RefundRequest | null>(null);
  const [declineTarget, setDeclineTarget] = useState<RefundRequest | null>(null);
  const [declineNote, setDeclineNote] = useState("");

  const fetchAll = useCallback(async () => {
    try {
      const [p, all] = await Promise.all([
        listRefundRequests({ status: "pending", limit: 50 }),
        listRefundRequests({ limit: 50 }),
      ]);
      setPending(p.refund_requests);
      setResolved(all.refund_requests.filter((r) => r.status !== "pending"));
    } catch {
      toast.error("Failed to load refund requests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Realtime: refetch when the socket layer reports queue changes.
  useEffect(() => {
    const handler = () => fetchAll();
    window.addEventListener("refund-requests:changed", handler);
    return () => window.removeEventListener("refund-requests:changed", handler);
  }, [fetchAll]);

  const handleApprove = useCallback(async () => {
    if (!confirmTarget) return;
    try {
      setBusy(true);
      const res = await approveRefundRequest(confirmTarget.id);
      toast.success(`Refund of ₱${Number(res.refund_request.total_refund).toFixed(2)} processed`);
      setConfirmTarget(null);
      await fetchAll();
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { message?: string } } };
      if (e?.response?.status === 409) {
        toast.error("Already reviewed by someone else");
      } else {
        toast.error(e?.response?.data?.message || "Failed to approve request");
      }
      setConfirmTarget(null);
      await fetchAll();
    } finally {
      setBusy(false);
    }
  }, [confirmTarget, fetchAll]);

  const handleDecline = useCallback(async () => {
    if (!declineTarget) return;
    try {
      setBusy(true);
      await declineRefundRequest(declineTarget.id, declineNote.trim() || undefined);
      toast.success("Refund request declined");
      setDeclineTarget(null);
      setDeclineNote("");
      await fetchAll();
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { message?: string } } };
      if (e?.response?.status === 409) {
        toast.error("Already reviewed by someone else");
      } else {
        toast.error(e?.response?.data?.message || "Failed to decline request");
      }
      setDeclineTarget(null);
      await fetchAll();
    } finally {
      setBusy(false);
    }
  }, [declineTarget, declineNote, fetchAll]);

  return (
    <RoleProtectedRoute allowedRoles={["admin", "manager"]}>
      <div className="min-h-screen bg-gradient-to-br from-emerald-50/40 to-green-50/40 pb-24">
        <div className="max-w-3xl mx-auto px-4 pt-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-md">
              <RotateCcw className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Refund Requests</h1>
              <p className="text-sm text-gray-500">
                Review refunds requested by cashiers — approving processes the refund immediately.
              </p>
            </div>
          </div>

          <Tabs defaultValue="pending">
            <TabsList className="mb-4">
              <TabsTrigger value="pending" className="cursor-pointer">
                Pending{pending.length > 0 ? ` (${pending.length})` : ""}
              </TabsTrigger>
              <TabsTrigger value="resolved" className="cursor-pointer">
                Resolved
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="space-y-3">
              {loading ? (
                <p className="text-center text-gray-500 py-10">Loading…</p>
              ) : pending.length === 0 ? (
                <p className="text-center text-gray-500 py-10">No pending refund requests 🎉</p>
              ) : (
                pending.map((r) => (
                  <RequestCard
                    key={r.id}
                    request={r}
                    busy={busy}
                    onApprove={setConfirmTarget}
                    onDecline={(req) => {
                      setDeclineNote("");
                      setDeclineTarget(req);
                    }}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="resolved" className="space-y-3">
              {resolved.length === 0 ? (
                <p className="text-center text-gray-500 py-10">No resolved requests yet</p>
              ) : (
                resolved.map((r) => <RequestCard key={r.id} request={r} busy={busy} />)
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Approve confirmation */}
        <Dialog open={!!confirmTarget} onOpenChange={(open) => !open && setConfirmTarget(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Approve refund request?</DialogTitle>
              <DialogDescription>
                This immediately refunds ₱{Number(confirmTarget?.total_refund ?? 0).toFixed(2)} for
                Sale #{confirmTarget?.sale_id} and restores stock. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" className="cursor-pointer" onClick={() => setConfirmTarget(null)} disabled={busy}>
                Cancel
              </Button>
              <Button
                className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleApprove}
                disabled={busy}
              >
                {busy ? "Processing…" : "Approve & Refund"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Decline with note */}
        <Dialog open={!!declineTarget} onOpenChange={(open) => !open && setDeclineTarget(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Decline refund request</DialogTitle>
              <DialogDescription>
                Declining Sale #{declineTarget?.sale_id}&apos;s request notifies the cashier. Optionally
                explain why.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              placeholder="Reason (optional) — e.g. item was opened"
              value={declineNote}
              onChange={(e) => setDeclineNote(e.target.value)}
              rows={3}
            />
            <DialogFooter>
              <Button variant="outline" className="cursor-pointer" onClick={() => setDeclineTarget(null)} disabled={busy}>
                Cancel
              </Button>
              <Button
                variant="outline"
                className="cursor-pointer border-red-300 text-red-600 hover:bg-red-50"
                onClick={handleDecline}
                disabled={busy}
              >
                {busy ? "Declining…" : "Decline Request"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RoleProtectedRoute>
  );
}
