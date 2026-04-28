import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
});

function readToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    if (typeof window.localStorage?.getItem !== "function") return null;
    return window.localStorage.getItem("token");
  } catch {
    return null;
  }
}

api.interceptors.request.use((config) => {
  const token = readToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
