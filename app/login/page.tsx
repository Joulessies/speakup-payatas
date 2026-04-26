"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2, UserCircle2, Lock, Eye, EyeOff } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type LoginRole = "user" | "admin";

export default function LoginPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [role, setRole] = useState<LoginRole>("user");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Login failed");
        setLoading(false);
        return;
      }

      const next = new URLSearchParams(window.location.search).get("next");
      router.push(next || data.redirect_to || (role === "admin" ? "/admin" : "/"));
      router.refresh();
    } catch {
      setError("Unable to login right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`flex-1 flex items-center justify-center px-4 ${isDark ? "bg-[#0a0a0f]" : "bg-gray-50"}`}>
      <Card className={`w-full max-w-md shadow-xl ${isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-white border-gray-100"}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-center mb-2">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
              isDark ? "bg-indigo-500/15" : "bg-indigo-50"
            }`}>
              <ShieldCheck className={`h-5 w-5 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />
            </div>
          </div>
          <div className="text-center">
            <CardTitle className="text-xl">Sign in to SpeakUp</CardTitle>
          </div>
          <CardDescription className="text-center">
            Access your account as a resident or admin.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-1">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <p className={`text-[11px] font-semibold uppercase tracking-wide mb-2 ${
                isDark ? "text-white/45" : "text-gray-500"
              }`}>
                Account Type
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole("user")}
                  className={`h-10 rounded-lg text-sm font-medium border transition-colors ${
                    role === "user"
                      ? isDark
                        ? "bg-white/12 border-white/20 text-white"
                        : "bg-gray-100 border-gray-300 text-gray-900"
                      : isDark
                        ? "bg-white/[0.03] border-white/[0.08] text-white/55 hover:bg-white/[0.06]"
                        : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  User
                </button>
                <button
                  type="button"
                  onClick={() => setRole("admin")}
                  className={`h-10 rounded-lg text-sm font-medium border transition-colors ${
                    role === "admin"
                      ? isDark
                        ? "bg-white/12 border-white/20 text-white"
                        : "bg-gray-100 border-gray-300 text-gray-900"
                      : isDark
                        ? "bg-white/[0.03] border-white/[0.08] text-white/55 hover:bg-white/[0.06]"
                        : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  Admin
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className={`text-xs font-medium ${isDark ? "text-white/70" : "text-gray-700"}`}>
                Username
              </label>
              <div className="relative">
                <UserCircle2 className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${
                  isDark ? "text-white/35" : "text-gray-400"
                }`} />
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={`${role} username`}
                  autoComplete="username"
                  className="pl-9"
                />
              </div>
            </div>

            <p className={`text-[11px] ${isDark ? "text-white/45" : "text-gray-500"}`}>
              {role === "admin"
                ? "Admin login requires password."
                : "Enter your name/username to continue."}
            </p>
            {role === "admin" && (
              <div className="space-y-1.5">
                <label className={`text-xs font-medium ${isDark ? "text-white/70" : "text-gray-700"}`}>
                  Password
                </label>
                <div className="relative">
                  <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${
                    isDark ? "text-white/35" : "text-gray-400"
                  }`} />
                  <Input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password"
                    autoComplete="current-password"
                    className="pl-9 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors ${
                      isDark
                        ? "text-white/50 hover:text-white hover:bg-white/[0.08]"
                        : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                    }`}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
            {error && (
              <div className={`text-xs px-3 py-2 rounded-lg border ${
                isDark ? "text-red-300 border-red-500/25 bg-red-500/10" : "text-red-600 border-red-200 bg-red-50"
              }`}>
                {error}
              </div>
            )}
            <Button
              type="submit"
              className="w-full h-10 font-semibold"
              disabled={loading || !username.trim() || (role === "admin" && !password.trim())}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
            </Button>
            <p className={`text-[11px] text-center ${isDark ? "text-white/35" : "text-gray-500"}`}>
              Demo accounts: admin/admin123 and user (username-only)
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
