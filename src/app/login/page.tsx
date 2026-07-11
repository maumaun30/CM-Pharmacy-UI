"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Lock,
  User,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import GoogleSignInButton from "@/components/GoogleSignInButton";

const BRAND = process.env.NEXT_PUBLIC_SITE_NAME || "Brand Logo";

type LoginState = "idle" | "loading" | "success";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [state, setState] = useState<LoginState>("idle");
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const [loginMode, setLoginMode] = useState<"password" | "pin">("password");
  const [pin, setPin] = useState("");

  const { user, loading: authLoading, refreshUser } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && user) router.replace("/");
  }, [authLoading, user, router]);

  const isLoading = state !== "idle";
  const canSubmit =
    !isLoading &&
    username.trim().length > 0 &&
    (loginMode === "password" ? password.length > 0 : pin.length >= 4);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setState("loading");
    setError("");

    try {
      const endpoint = loginMode === "pin" ? "/auth/login-pin" : "/auth/login";
      const payload =
        loginMode === "pin" ? { username, pin } : { username, password };

      const res = await api.post(endpoint, payload);
      if (typeof window !== "undefined") {
        try {
          window.localStorage?.setItem?.("token", res.data.token);
        } catch {}
      }
      setState("success");
      // Brief success flourish before refreshing auth + redirect
      await refreshUser();
      setTimeout(() => router.push("/"), 600);
    } catch (err: any) {
      setError(err.response?.data?.message || "Login failed. Please try again.");
      setState("idle");
    }
  };

  // Google sign-in: exchange the Google ID token for our JWT via /auth/google.
  // Same success path as password/PIN login; a 401 means the Google account
  // isn't linked to any staff user yet.
  const handleGoogleCredential = async (idToken: string) => {
    setState("loading");
    setError("");
    try {
      const res = await api.post("/auth/google", { idToken });
      if (typeof window !== "undefined") {
        try {
          window.localStorage?.setItem?.("token", res.data.token);
        } catch {}
      }
      setState("success");
      await refreshUser();
      setTimeout(() => router.push("/"), 600);
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Google sign-in failed. Please try again.",
      );
      setState("idle");
    }
  };

  // Initial auth check — avoid flashing the form for already-logged-in users
  if (authLoading || (user && !authLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-green-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
          <p className="text-gray-500 text-sm font-medium">
            {user ? "Redirecting..." : "Checking session..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-green-50 p-4 overflow-hidden">
      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -inset-[10px] opacity-30">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-300 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
          <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-green-300 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-teal-300 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
        </div>
      </div>

      {/* Login card */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative w-full max-w-md"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-green-600 rounded-2xl blur-xl opacity-20"></div>

        <div className="relative bg-white backdrop-blur-xl rounded-2xl shadow-2xl border border-green-200 p-8 overflow-hidden">
          {/* ── Loading / Success Overlay ── */}
          <AnimatePresence>
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm rounded-2xl"
              >
                <AnimatePresence mode="wait">
                  {state === "loading" && (
                    <motion.div
                      key="loader"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="flex flex-col items-center gap-4"
                    >
                      <div className="relative">
                        <div className="h-20 w-20 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg">
                          <ShieldCheck className="h-10 w-10 text-white" />
                        </div>
                        <div className="absolute -inset-2 rounded-full border-4 border-emerald-200 border-t-emerald-500 animate-spin" />
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-gray-800 text-lg">Signing you in</p>
                        <p className="text-sm text-gray-500 mt-0.5">Verifying credentials...</p>
                      </div>
                    </motion.div>
                  )}
                  {state === "success" && (
                    <motion.div
                      key="success"
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 260, damping: 20 }}
                      className="flex flex-col items-center gap-4"
                    >
                      <div className="h-20 w-20 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg">
                        <CheckCircle2 className="h-10 w-10 text-white" />
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-gray-800 text-lg">Welcome back!</p>
                        <p className="text-sm text-gray-500 mt-0.5">Taking you to the dashboard...</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Logo / Brand */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 mb-4 shadow-lg"
            >
              <Lock className="w-8 h-8 text-white" />
            </motion.div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">{BRAND}</h1>
            <p className="text-gray-600 text-sm">
              Welcome back! Please login to continue
            </p>
          </div>

          {/* Error message */}
          <AnimatePresence>
            {error && (
              <motion.div
                key="err"
                initial={{ opacity: 0, y: -8, x: 0 }}
                animate={{ opacity: 1, y: 0, x: [0, -6, 6, -4, 4, 0] }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4 }}
                className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-lg flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-red-700 text-sm font-medium">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mode toggle */}
          <div className="flex rounded-lg border border-gray-200 p-1 bg-gray-50 mb-4">
            {(["password", "pin"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setLoginMode(mode);
                  setError("");
                  setPin("");
                  setPassword("");
                }}
                disabled={isLoading}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200 capitalize disabled:opacity-50 ${
                  loginMode === mode
                    ? "bg-white text-emerald-700 shadow-sm border border-emerald-200"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {mode === "pin" ? "PIN Code" : "Password"}
              </button>
            ))}
          </div>

          {/* Login form */}
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Username field */}
            <div className="space-y-2">
              <label className="text-gray-700 text-sm font-medium block">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <Input
                  type="text"
                  placeholder="Enter your username"
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-500 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all duration-200"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                  autoComplete="username"
                  autoFocus
                  required
                />
              </div>
            </div>

            {/* Password / PIN field */}
            <AnimatePresence mode="wait">
              {loginMode === "password" ? (
                <motion.div
                  key="pw"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-2"
                >
                  <label className="text-gray-700 text-sm font-medium block">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      tabIndex={-1}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-emerald-600 transition-colors"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="pin"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-2"
                >
                  <label className="text-gray-700 text-sm font-medium block">
                    PIN Code
                  </label>
                  <div className="flex gap-2 justify-center">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <input
                        key={i}
                        type="password"
                        inputMode="numeric"
                        maxLength={1}
                        value={pin[i] || ""}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/, "");
                          const arr = pin.split("");
                          arr[i] = val;
                          setPin(arr.join("").slice(0, 6));
                          if (val && e.target.nextElementSibling) {
                            (
                              e.target.nextElementSibling as HTMLInputElement
                            ).focus();
                          }
                        }}
                        onKeyDown={(e) => {
                          if (
                            e.key === "Backspace" &&
                            !pin[i] &&
                            e.currentTarget.previousElementSibling
                          ) {
                            (
                              e.currentTarget
                                .previousElementSibling as HTMLInputElement
                            ).focus();
                          }
                        }}
                        className="w-12 h-14 text-center text-xl font-bold border-2 border-gray-300 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all bg-gray-50 disabled:opacity-50"
                        disabled={isLoading}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-center text-gray-500">
                    Enter your 4–6 digit PIN
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit button */}
            <Button
              type="submit"
              className="w-full py-6 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              disabled={!canSubmit}
            >
              {state === "loading" ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="animate-spin h-5 w-5" />
                  Signing in...
                </span>
              ) : state === "success" ? (
                <span className="flex items-center justify-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  Success
                </span>
              ) : (
                "Login"
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-xs font-medium text-gray-400">
                or continue with
              </span>
            </div>
          </div>

          {/* Google sign-in */}
          <GoogleSignInButton
            onCredential={handleGoogleCredential}
            text="signin_with"
          />
        </div>
      </motion.div>

      <style jsx>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}
