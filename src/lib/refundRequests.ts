import api from "@/lib/api";

// ── Types (API responses are snake_case) ─────────────────────────────────────

export interface RefundRequestItem {
  saleItemId: number;
  quantity: number;
}

export interface RefundRequest {
  id: number;
  sale_id: number;
  branch_id: number;
  requested_by: number;
  items: RefundRequestItem[];
  reason: string | null;
  total_refund: number;
  status: "pending" | "approved" | "declined";
  reviewed_by: number | null;
  review_note: string | null;
  refund_id: number | null;
  created_at: string;
  reviewed_at: string | null;
  requester?: { id: number; name: string } | null;
  reviewer?: { id: number; name: string } | null;
  sale?: { id: number; total_amount: number; created_at: string } | null;
}

export interface AppNotification {
  id: number;
  user_id: number;
  type: "refund_request" | "refund_approved" | "refund_declined" | "low_stock";
  title: string;
  body: string;
  data: { refundRequestId?: number; saleId?: number; refundId?: number; productId?: number };
  branch_id: number | null;
  is_read: boolean;
  created_at: string;
}

// ── Refund requests ──────────────────────────────────────────────────────────

export async function createRefundRequest(
  saleId: number,
  payload: { items: RefundRequestItem[]; reason?: string }
) {
  const res = await api.post(`/sales/${saleId}/refund-requests`, payload);
  return res.data as { message: string; refund_request: RefundRequest };
}

export async function listRefundRequests(params?: {
  status?: string;
  mine?: boolean;
  page?: number;
  limit?: number;
}) {
  const res = await api.get("/refund-requests", {
    params: {
      status: params?.status,
      mine: params?.mine ? "true" : undefined,
      page: params?.page,
      limit: params?.limit,
    },
  });
  return res.data as { refund_requests: RefundRequest[]; total: number; page: number; limit: number };
}

export async function approveRefundRequest(id: number) {
  const res = await api.put(`/refund-requests/${id}/approve`);
  return res.data as { message: string; refund_request: RefundRequest; refund_id: number };
}

export async function declineRefundRequest(id: number, reviewNote?: string) {
  const res = await api.put(`/refund-requests/${id}/decline`, { reviewNote });
  return res.data as { message: string; refund_request: RefundRequest };
}

// ── Notifications ────────────────────────────────────────────────────────────

export async function listNotifications(params?: { unread?: boolean; page?: number; limit?: number }) {
  const res = await api.get("/notifications", {
    params: { unread: params?.unread ? "true" : undefined, page: params?.page, limit: params?.limit },
  });
  return res.data as {
    notifications: AppNotification[];
    unread_count: number;
    total: number;
    page: number;
    limit: number;
  };
}

export async function markNotificationRead(id: number) {
  const res = await api.put(`/notifications/${id}/read`);
  return res.data as { message: string };
}

export async function markAllNotificationsRead() {
  const res = await api.put("/notifications/read-all");
  return res.data as { message: string; updated: number };
}
