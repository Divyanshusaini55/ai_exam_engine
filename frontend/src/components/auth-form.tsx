"use client";

import { useNoIndex } from "@/hooks/useNoIndex";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { authApi } from "@/lib/api";
import { ArrowLeft, Loader2, Eye, EyeOff } from "lucide-react";

export function AuthForm({ defaultMode = "login" }: { defaultMode?: "login" | "register" }) {
  useNoIndex();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get("redirectTo") || "/dashboard";
  const { login } = useAuth();

  const [mode, setMode] = useState<"login" | "register">(defaultMode);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (mode === "login") {
        const res = await authApi.login({ username, password });
        const data = await res.json();
        
        if (res.ok) {
            login(data.token, data.refresh, {
                id: data.user_id,
                username: data.username,
                email: data.email,
                avatar_image: data.avatar_image,
                date_joined: new Date().toISOString()
            });
            router.replace(redirectTo);
        } else {
            setError(data.non_field_errors?.[0] || "Invalid credentials");
        }
      } else {
        const res = await authApi.register({ username, email, password });
        const data = await res.json();
        
        if (res.ok) {
            login(data.token, data.refresh, data.user);
            setSuccess("Account created successfully! Redirecting...");
            setTimeout(() => {
                router.replace("/dashboard");
            }, 1000);
        } else {
            let msg = "Registration failed";
            if (typeof data === "object") {
                const messages = Object.values(data).flat();
                if (messages.length > 0) msg = String(messages[0]);
            }
            setError(msg);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to authenticate");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center overflow-x-hidden bg-background px-6 py-10 text-primary">
      <div className="w-full max-w-md animate-fade-in">
        {/* TOP */}
        <div className="mb-10 text-center">
          <button
            onClick={() => router.back()}
            className="text-[11px] uppercase tracking-[0.35em] text-muted-foreground transition-colors hover:text-primary flex items-center justify-center gap-2 mx-auto"
          >
            <ArrowLeft className="size-3" /> Go Back
          </button>

          <h1 className="mt-6 text-4xl font-bold font-heading tracking-tight text-primary">
            {mode === "login" ? "Welcome back" : "Create account"}
          </h1>

          <p className="mt-4 text-sm leading-7 text-muted-foreground font-medium">
            Secure access to your AI-powered exam engine infrastructure.
          </p>
        </div>

        {/* CARD */}
        <div className="rounded-premium border border-border bg-card p-8 shadow-premium backdrop-blur-2xl">
          <form onSubmit={submit} className="space-y-6">
            {/* USERNAME */}
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block mb-2">Username</label>
              <input
                autoComplete="username"
                id="login-username-input"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-border bg-secondary px-4 py-3.5 text-primary outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary/30 focus:ring-2 focus:ring-primary/5 font-medium"
                placeholder="you"
              />
              {mode === "register" && (
                <p className="mt-1.5 text-[11px] text-muted-foreground font-medium">
                  Username can only contain letters, numbers, and @/./+/-/_ characters.
                </p>
              )}
            </div>

            {/* EMAIL (Only for Register) */}
            {mode === "register" && (
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block mb-2">Email</label>
                <input
                  autoComplete="email"
                  id="login-email-input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-border bg-secondary px-4 py-3.5 text-primary outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary/30 focus:ring-2 focus:ring-primary/5 font-medium"
                  placeholder="you@example.com"
                />
              </div>
            )}

            {/* PASSWORD */}
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block mb-2">Password</label>
              <div className="relative">
                <input
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  id="login-password-input"
                  type={showPassword ? "text" : "password"}
                  minLength={8}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-border bg-secondary px-4 py-3.5 pr-12 text-primary outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary/30 focus:ring-2 focus:ring-primary/5 font-medium"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {mode === "register" && (
                <p className="mt-1.5 text-[11px] text-muted-foreground font-medium">
                  Password must be at least 8 characters long and contain at least one number.
                </p>
              )}
            </div>

            {/* MESSAGES */}
            {error && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive font-semibold">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-xl border border-success/20 bg-success/10 px-4 py-3 text-sm text-success font-semibold">
                {success}
              </div>
            )}

            {/* SUBMIT */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground transition-all duration-300 hover:scale-[1.01] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 shadow-lg shadow-primary/10 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Please wait...
                </>
              ) : (
                mode === "login" ? "Sign In" : "Create Account"
              )}
            </button>

            {/* TOGGLE */}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError(null);
                setSuccess(null);
              }}
              className="w-full text-sm text-muted-foreground transition-colors hover:text-primary font-semibold"
            >
              {mode === "login" ? "Need an account? Register" : "Already registered? Sign in"}
            </button>
          </form>

          {/* FOOTER */}
          <div className="mt-8 border-t border-border pt-6 text-center flex justify-between items-center px-1">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">ExamIntel</p>
            {mode === "login" && (
                <Link prefetch={false} href="/forgot-password" className="text-xs text-muted-foreground hover:text-primary transition-colors underline decoration-dotted underline-offset-4 font-semibold">
                    Forgot password?
                </Link>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
