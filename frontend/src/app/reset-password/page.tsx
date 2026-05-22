"use client"
import { useNoIndex } from "@/hooks/useNoIndex"

import { useState, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { apiClient } from "@/lib/apiClient"
import { Key } from "lucide-react"


function ResetPasswordForm() {
    const router = useRouter()
    const searchParams = useSearchParams()

    // Get query params
    const uid = searchParams.get("uid")
    const token = searchParams.get("token")

    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
    const [message, setMessage] = useState("")

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (password !== confirmPassword) {
            setStatus("error")
            setMessage("Passwords do not match")
            return
        }

        if (password.length < 8) {
            setStatus("error")
            setMessage("Password must be at least 8 characters long")
            return
        }

        if (!uid || !token) {
            setStatus("error")
            setMessage("Invalid reset link. Please request a new one.")
            return
        }

        setStatus("loading")
        setMessage("")

        try {
            const res = await apiClient.post('/auth/password-reset/confirm/', {
                uid,
                token,
                password
            })

            const data = await res.json()

            if (res.ok) {
                setStatus("success")
                setMessage("Password reset successful! Redirecting to login...")
                setTimeout(() => {
                    router.push("/login")
                }, 2000)
            } else {
                setStatus("error")
                setMessage(data.error || "Invalid or expired token.")
            }
        } catch (err) {
            setStatus("error")
            setMessage("Network error. Please try again later.")
        }
    }

    if (!uid || !token) {
        return (
            <div className="text-center">
                <div className="bg-destructive/10 text-destructive p-4 rounded-xl mb-6 border border-destructive/30">
                    Invalid or missing reset link.
                </div>
                <Link prefetch={false}
                    href="/forgot-password"
                    className="inline-block px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl shadow-premium"
                >
                    Request New Link
                </Link>
            </div>
        )
    }

    return (
        <div className="w-full">
            <div className="text-center mb-8">
                <div className="size-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                    <Key className="size-8" />
                </div>
                <h1 className="text-2xl font-bold text-primary mb-2">
                    Reset Password
                </h1>
                <p className="text-muted-foreground">
                    Enter your new password below
                </p>
            </div>

            {status === "success" ? (
                <div className="text-center animate-fade-in">
                    <div className="bg-success/10 text-success p-4 rounded-xl mb-6 border border-success/30">
                        {message}
                    </div>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    {status === "error" && (
                        <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm border border-destructive/30">
                            {message}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-primary mb-1.5">
                            New Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 bg-background dark:bg-secondary border border-border rounded-xl focus:ring-2 focus:ring-primary/30 outline-none transition-all"
                            placeholder="••••••••"
                            required
                            minLength={8}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-primary mb-1.5">
                            Confirm Password
                        </label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-4 py-3 bg-background dark:bg-secondary border border-border rounded-xl focus:ring-2 focus:ring-primary/30 outline-none transition-all"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={status === "loading"}
                        className="w-full py-3 bg-primary hover:opacity-90 text-primary-foreground font-bold rounded-xl transition-all shadow-premium disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2 mt-2"
                    >
                        {status === "loading" ? (
                            <>
                                <span className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Resetting...
                            </>
                        ) : (
                            "Reset Password"
                        )}
                    </button>
                </form>
            )}
        </div>
    )
}

export default function ResetPasswordPage() {
    useNoIndex() // Prevent search engine indexing
    return (
        <div className="min-h-screen bg-background  font-sans">
            <Navbar />
            <div className="flex items-center justify-center min-h-[calc(100vh-80px)] px-4">
                <div className="max-w-md w-full bg-card rounded-2xl shadow-xl border border-border p-8">
                    <Suspense fallback={<div className="text-center p-8">Loading...</div>}>
                        <ResetPasswordForm />
                    </Suspense>
                </div>
            </div>
        </div>
    )
}
