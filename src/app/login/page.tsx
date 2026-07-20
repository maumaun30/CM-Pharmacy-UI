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
  KeyRound,
  Copy,
  Download,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import GoogleSignInButton from "@/components/GoogleSignInButton";

const BRAND = process.env.NEXT_PUBLIC_SITE_NAME || "Brand Logo";

type LoginState = "idle" | "loading" | "success";
// credentials → (superadmin only) totp | setup → backup (setup only) → app
type LoginStep = "credentials" | "totp" | "setup" | "backup";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [state, setState] = useState<LoginState>("idle");
  const [showPassword, setShowPassword] = useState(false);
  // TOTP challenge (superadmin only)
  const [step, setStep] = useState<LoginStep>("credentials");
  const [preAuthToken, setPreAuthToken] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [otpauthUrl, setOtpauthUrl] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  // Full JWT held back while the backup codes are on screen — storing it
  // immediately would trigger the auth redirect and skip the codes.
  const [pendingToken, setPendingToken] = useState("");
  const router = useRouter();

  const { user, loading: authLoading, refreshUser } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && user) router.replace("/");
  }, [authLoading, user, router]);

  const isLoading = state !== "idle";
  const canSubmit =
    !isLoading && username.trim().length > 0 && password.length > 0;

  const finishLogin = async (token: string) => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage?.setItem?.("token", token);
      } catch {}
    }
    setState("success");
    // Brief success flourish before refreshing auth + redirect
    await refreshUser();
    setTimeout(() => router.push("/"), 600);
  };

  // Superadmin logins don't return a token — they return a 5-minute pre-auth
  // token plus a flag telling us which TOTP screen to show next.
  const handleChallenge = async (data: any) => {
    setPreAuthToken(data.preAuthToken);
    if (data.requires_totp_setup) {
      const res = await api.post("/auth/totp/setup", null, {
        headers: { Authorization: `Bearer ${data.preAuthToken}` },
      });
      setOtpauthUrl(res.data.otpauth_url);
      setStep("setup");
    } else {
      setStep("totp");
    }
    setTotpCode("");
    setState("idle");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setState("loading");
    setError("");

    try {
      const res = await api.post("/auth/login", { username, password });
      if (res.data.requires_totp || res.data.requires_totp_setup) {
        await handleChallenge(res.data);
        return;
      }
      await finishLogin(res.data.token);
    } catch (err: any) {
      setError(err.response?.data?.message || "Login failed. Please try again.");
      setState("idle");
    }
  };

  // Google sign-in: exchange the Google ID token for our JWT via /auth/google.
  // Same success path as password login; a 401 means the Google account
  // isn't linked to any staff user yet. A superadmin still owes a TOTP code.
  const handleGoogleCredential = async (idToken: string) => {
    setState("loading");
    setError("");
    try {
      const res = await api.post("/auth/google", { idToken });
      if (res.data.requires_totp || res.data.requires_totp_setup) {
        await handleChallenge(res.data);
        return;
      }
      await finishLogin(res.data.token);
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Google sign-in failed. Please try again.",
      );
      setState("idle");
    }
  };

  // Shared error handling for the TOTP endpoints: an expired pre-auth token
  // sends the user back to the password step; a wrong code lets them retry.
  const handleTotpError = (err: any) => {
    const message: string = err.response?.data?.message || "Verification failed";
    if (err.response?.status === 401 && /token/i.test(message)) {
      setStep("credentials");
      setPreAuthToken("");
      setError("Session expired. Please sign in again.");
    } else {
      setError(message);
    }
    setState("idle");
  };

  // Step "totp": existing enrollment — verify a 6-digit code or a backup code.
  const handleVerifyTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpCode.trim() || state !== "idle") return;
    setState("loading");
    setError("");
    try {
      const res = await api.post(
        "/auth/totp/verify",
        { code: totpCode.trim() },
        { headers: { Authorization: `Bearer ${preAuthToken}` } },
      );
      await finishLogin(res.data.token);
    } catch (err: any) {
      handleTotpError(err);
    }
  };

  // Step "setup": first enrollment — verify the first code, then show the
  // one-time backup codes before entering the app.
  const handleVerifySetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpCode.trim() || state !== "idle") return;
    setState("loading");
    setError("");
    try {
      const res = await api.post(
        "/auth/totp/verify-setup",
        { code: totpCode.trim() },
        { headers: { Authorization: `Bearer ${preAuthToken}` } },
      );
      setBackupCodes(res.data.backup_codes || []);
      setPendingToken(res.data.token);
      setStep("backup");
      setState("idle");
    } catch (err: any) {
      handleTotpError(err);
    }
  };

  const copyBackupCodes = async () => {
    try {
      await navigator.clipboard.writeText(backupCodes.join("\n"));
      toast.success("Backup codes copied");
    } catch {
      toast.error("Could not copy — select and copy manually");
    }
  };

  const downloadBackupCodes = () => {
    const blob = new Blob(
      [`${BRAND} — superadmin backup codes\n\n${backupCodes.join("\n")}\n`],
      { type: "text/plain" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
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
              className="mb-4 flex justify-center"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-wordmark.png"
                alt={BRAND}
                className="h-16 w-auto max-w-full object-contain"
              />
            </motion.div>
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

          {/* Login form */}
          {step === "credentials" && (
          <>
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

            {/* Password field */}
            <div className="space-y-2">
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
            </div>

            {/* Submit button */}
            <Button
              type="submit"
              className="w-full py-6 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              disabled={!canSubmit}
            >
              {state === "loading" ? (
                <span className="flex items-center justify-center gap-2">
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
          </>
          )}

          {/* ── TOTP: code prompt (already enrolled) ── */}
          {step === "totp" && (
            <form onSubmit={handleVerifyTotp} className="space-y-5">
              <div className="text-center space-y-1">
                <div className="mx-auto h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                  <KeyRound className="h-6 w-6 text-emerald-600" />
                </div>
                <p className="font-semibold text-gray-800">Two-factor authentication</p>
                <p className="text-sm text-gray-500">
                  Enter the 6-digit code from your authenticator app, or a backup code.
                </p>
              </div>
              <Input
                type="text"
                inputMode="text"
                autoComplete="one-time-code"
                placeholder="123456"
                className="text-center text-lg tracking-widest font-mono"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                disabled={isLoading}
                autoFocus
                required
              />
              <Button
                type="submit"
                className="w-full py-6 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold rounded-lg"
                disabled={isLoading || !totpCode.trim()}
              >
                Verify
              </Button>
              <button
                type="button"
                className="w-full text-sm text-gray-500 hover:text-emerald-600"
                onClick={() => {
                  setStep("credentials");
                  setPreAuthToken("");
                  setTotpCode("");
                  setError("");
                }}
              >
                Back to login
              </button>
            </form>
          )}

          {/* ── TOTP: forced first-time setup ── */}
          {step === "setup" && (
            <form onSubmit={handleVerifySetup} className="space-y-5">
              <div className="text-center space-y-1">
                <p className="font-semibold text-gray-800">Set up two-factor authentication</p>
                <p className="text-sm text-gray-500">
                  Scan this QR code with an authenticator app (Google Authenticator,
                  Authy, …), then enter the 6-digit code it shows.
                </p>
              </div>
              {otpauthUrl && (
                <div className="flex justify-center p-4 bg-white border-2 border-emerald-100 rounded-xl">
                  <QRCodeSVG value={otpauthUrl} size={180} />
                </div>
              )}
              <Input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                className="text-center text-lg tracking-widest font-mono"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                disabled={isLoading}
                autoFocus
                required
              />
              <Button
                type="submit"
                className="w-full py-6 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold rounded-lg"
                disabled={isLoading || !totpCode.trim()}
              >
                Verify & enable
              </Button>
            </form>
          )}

          {/* ── Backup codes (shown exactly once after setup) ── */}
          {step === "backup" && (
            <div className="space-y-5">
              <div className="text-center space-y-1">
                <p className="font-semibold text-gray-800">Save your backup codes</p>
                <p className="text-sm text-gray-500">
                  Each code works once if you lose your authenticator.
                  <span className="font-semibold text-red-600"> They will not be shown again.</span>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 p-4 bg-gray-50 border-2 border-gray-200 rounded-xl font-mono text-sm text-gray-800">
                {backupCodes.map((code) => (
                  <div key={code} className="text-center py-1">{code}</div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={copyBackupCodes}>
                  <Copy className="h-4 w-4 mr-2" /> Copy
                </Button>
                <Button type="button" variant="outline" className="flex-1" onClick={downloadBackupCodes}>
                  <Download className="h-4 w-4 mr-2" /> Download
                </Button>
              </div>
              <Button
                type="button"
                className="w-full py-6 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold rounded-lg"
                onClick={() => finishLogin(pendingToken)}
              >
                I saved them — continue
              </Button>
            </div>
          )}
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
