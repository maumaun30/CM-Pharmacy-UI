"use client";

import { useAuth } from "@/hooks/useAuth";
import api from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Mail,
  Shield,
  Lock,
  Save,
  X,
  Loader2,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
} from "lucide-react";
import { motion } from "framer-motion";

const AccountPage = () => {
  const { user } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setUsername(user.username || "");
      setEmail(user.email || "");
    }
  }, [user]);

  const hasChanges = () => {
    return (
      username !== user?.username ||
      email !== user?.email ||
      password.length > 0
    );
  };

  const validatePassword = (pwd: string) => {
    if (pwd.length === 0) return { valid: true, message: "" };
    if (pwd.length < 6)
      return { valid: false, message: "At least 6 characters required" };
    return { valid: true, message: "Strong password" };
  };

  const passwordValidation = validatePassword(password);
  const passwordsMatch = password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password && password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (password && password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (!username.trim()) {
      toast.error("Username is required");
      return;
    }

    setIsLoading(true);

    try {
      const updateData: {
        username?: string;
        email?: string;
        password?: string;
      } = {};

      if (username !== user?.username) {
        updateData.username = username;
      }

      if (email !== user?.email) {
        updateData.email = email;
      }

      if (password) {
        updateData.password = password;
      }

      if (Object.keys(updateData).length === 0) {
        toast.info("No changes to save");
        setIsLoading(false);
        return;
      }

      const res = await api.put("/auth/profile", updateData);

      toast.success("Profile updated successfully. Please log in again.");

      setPassword("");
      setConfirmPassword("");

      window.location.reload();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePin = async () => {
    if (pin && !/^\d{4,6}$/.test(pin)) {
      toast.error("PIN must be 4–6 digits");
      return;
    }
    try {
      await api.put("/auth/pin", { pin: pin || null });
      toast.success(pin ? "PIN saved" : "PIN removed");
      setPin("");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save PIN");
    }
  };

  const handleCancel = () => {
    setUsername(user?.username || "");
    setEmail(user?.email || "");
    setPassword("");
    setConfirmPassword("");
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50 pb-24">
        <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3"
          >
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg">
              <User className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                Account Settings
              </h1>
              <p className="text-sm text-gray-600">
                Manage your profile and security settings
              </p>
            </div>
          </motion.div>

          {/* User Info Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="p-5 bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-200">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-md">
                  <span className="text-2xl font-bold text-white">
                    {user?.username?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-800">
                    {user?.fullName || user?.username}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className="text-white capitalize bg-emerald-600 hover:bg-emerald-600">
                      {user?.role}
                    </Badge>
                    <span className="text-sm text-gray-600">
                      • {user?.email}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Main Form Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="overflow-hidden border-2 border-emerald-100 shadow-lg">
              <div className="bg-gradient-to-r from-emerald-50 to-green-50 px-6 py-4 border-b-2 border-emerald-100">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <User className="h-5 w-5 text-emerald-600" />
                  Profile Information
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Update your account details and email address
                </p>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Username */}
                <div className="space-y-2">
                  <Label
                    htmlFor="username"
                    className="flex items-center gap-2 text-sm font-semibold text-gray-700"
                  >
                    <User className="h-4 w-4 text-emerald-600" />
                    Username
                  </Label>
                  <div className="relative">
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      placeholder="Enter your username"
                      className="pl-4 h-12 border-2 border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                    />
                    {username && username !== user?.username && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label
                    htmlFor="email"
                    className="flex items-center gap-2 text-sm font-semibold text-gray-700"
                  >
                    <Mail className="h-4 w-4 text-emerald-600" />
                    Email Address
                  </Label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="Enter your email"
                      className="pl-4 h-12 border-2 border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                    />
                    {email && email !== user?.email && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Role (Read-only) */}
                <div className="space-y-2">
                  <Label
                    htmlFor="role"
                    className="flex items-center gap-2 text-sm font-semibold text-gray-700"
                  >
                    <Shield className="h-4 w-4 text-emerald-600" />
                    Role
                  </Label>
                  <Input
                    id="role"
                    value={user?.role || ""}
                    disabled
                    className="bg-gray-50 border-2 border-gray-200 h-12 capitalize text-gray-600 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Contact an administrator to change your role
                  </p>
                </div>

                {/* Divider */}
                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t-2 border-emerald-100"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-white px-4 text-sm font-semibold text-gray-600">
                      Security Settings
                    </span>
                  </div>
                </div>

                {/* Change Password Section */}
                <div className="space-y-4 p-4 bg-gradient-to-r from-emerald-50/50 to-green-50/50 rounded-xl border-2 border-emerald-100">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center flex-shrink-0">
                      <Lock className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-gray-800">
                        Change Password
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Leave blank to keep your current password
                      </p>
                    </div>
                  </div>

                  {/* New Password */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="password"
                      className="text-sm font-semibold text-gray-700"
                    >
                      New Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter new password"
                        minLength={6}
                        className="pr-10 h-12 border-2 border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                    {password && (
                      <div className="flex items-center gap-2 text-xs">
                        {passwordValidation.valid ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-600" />
                            <span className="text-emerald-600 font-medium">
                              {passwordValidation.message}
                            </span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-3 w-3 text-red-600" />
                            <span className="text-red-600 font-medium">
                              {passwordValidation.message}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="confirmPassword"
                      className="text-sm font-semibold text-gray-700"
                    >
                      Confirm New Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        minLength={6}
                        className="pr-10 h-12 border-2 border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                    {confirmPassword && (
                      <div className="flex items-center gap-2 text-xs">
                        {passwordsMatch ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-600" />
                            <span className="text-emerald-600 font-medium">
                              Passwords match
                            </span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-3 w-3 text-red-600" />
                            <span className="text-red-600 font-medium">
                              Passwords do not match
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* PIN Section */}
                <div className="space-y-4 p-4 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 rounded-xl border-2 border-blue-100">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                      <Shield className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-gray-800">
                        Quick PIN
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Set a 4–6 digit PIN for faster login
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-700">
                      PIN Code
                    </Label>
                    <Input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={pin}
                      onChange={(e) =>
                        setPin(e.target.value.replace(/\D/, "").slice(0, 6))
                      }
                      placeholder="Enter 4–6 digit PIN (blank to remove)"
                      className="h-12 border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 tracking-widest text-center text-lg"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleSavePin}
                    className="w-full h-10 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold"
                  >
                    {pin ? "Save PIN" : "Remove PIN"}
                  </Button>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button
                    type="submit"
                    disabled={isLoading || !hasChanges()}
                    className="flex-1 h-12 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Saving Changes...
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isLoading || !hasChanges()}
                    className="flex-1 sm:flex-none h-12 border-2 border-gray-300 hover:bg-gray-50 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <X className="w-5 h-5 mr-2" />
                    Cancel
                  </Button>
                </div>

                {/* Change Indicator */}
                {hasChanges() && !isLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-amber-50 border-2 border-amber-200 rounded-lg"
                  >
                    <div className="flex items-center gap-2 text-sm text-amber-800">
                      <AlertCircle className="h-4 w-4" />
                      <span className="font-medium">
                        You have unsaved changes
                      </span>
                    </div>
                  </motion.div>
                )}
              </form>
            </Card>
          </motion.div>

          {/* Info Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="p-5 bg-blue-50 border-2 border-blue-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-blue-900 mb-1">
                    Important Information
                  </h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>
                      • Changing your password will log you out of all devices
                    </li>
                    <li>
                      • Make sure to use a strong password with at least 6
                      characters
                    </li>
                    <li>• Your email must be unique across all accounts</li>
                  </ul>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

// Badge component (if not already imported)
const Badge = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
};

export default AccountPage;
