import axios from "axios";

export interface User {
  id: string;
  username: string;
  email?: string;
  role: string;
  fullName: string;
}

export async function verifyToken(): Promise<boolean> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;
  if (!token) return false;

  try {
    const res = await axios.get(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/profile`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return !!res.data;
  } catch (err) {
    return false;
  }
}

export function requireAuth() {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
    }
  }
}
