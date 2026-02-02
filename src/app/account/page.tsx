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

const AccountPage = () => {
  const { user, setUser } = useAuth();
  
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Set default values when user data is available
  useEffect(() => {
    if (user) {
      setUsername(user.username || "");
      setEmail(user.email || "");
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
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
      const updateData: { username?: string; email?: string; password?: string } = {};
      
      if (username !== user?.username) {
        updateData.username = username;
      }
      
      if (email !== user?.email) {
        updateData.email = email;
      }
      
      if (password) {
        updateData.password = password;
      }

      // Only send request if there's something to update
      if (Object.keys(updateData).length === 0) {
        toast.info("No changes to save");
        setIsLoading(false);
        return;
      }

      const res = await api.put("/auth/profile", updateData);
      
      // Update user context with new data
      if (setUser && res.data.user) {
        setUser(res.data.user);
      }

      toast.success("Profile updated successfully");
      
      // Clear password fields
      setPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update profile");
    } finally {
      setIsLoading(false);
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
      <div className="p-6 space-y-4 max-w-2xl">
        <h1 className="text-2xl font-bold">Account Settings</h1>
        
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username */}
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="Enter your username"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email"
              />
            </div>

            {/* Role (Read-only) */}
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Input
                id="role"
                value={user?.role || ""}
                disabled
                className="bg-gray-50 capitalize"
              />
            </div>

            <hr className="my-6" />

            {/* Change Password Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Change Password</h3>
              <p className="text-sm text-muted-foreground">
                Leave blank to keep current password
              </p>

              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter new password"
                  minLength={6}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  minLength={6}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </ProtectedRoute>
  );
};

export default AccountPage;