"use client"
import { useNoIndex } from "@/hooks/useNoIndex"

import { useState, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { apiClient } from "@/lib/apiClient"


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
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl mb-6 border border-red-100 dark:border-red-900/30">
                    Invalid or missing reset link.
                </div>
                <Link
                    href="/forgot-password"
                    className="inline-block px-6 py-3 bg-blue-600 text-white font-bold rounded-xl"
                >
                    Request New Link
                </Link>
            </div>
        )
    }

    return (
        <div className="w-full">
            <div className="text-center mb-8">
                <div className="size-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600 dark:text-indigo-400">
                    <span className="material-symbols-outlined text-3xl">vpn_key</span>
                </div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                    Reset Password
                </h1>
                <p className="text-slate-500 dark:text-slate-400">
                    Enter your new password below
                </p>
            </div>

            {status === "success" ? (
                <div className="text-center animate-fade-in-up">
                    <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 p-4 rounded-xl mb-6 border border-green-200 dark:border-green-900/30">
                        {message}
                    </div>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    {status === "error" && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm border border-red-100 dark:border-red-900/30">
                            {message}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                            New Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                            placeholder="••••••••"
                            required
                            minLength={8}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                            Confirm Password
                        </label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={status === "loading"}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2 mt-2"
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
        <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 font-sans">
            <Navbar />
            <div className="flex items-center justify-center min-h-[calc(100vh-80px)] px-4">
                <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8">
                    <Suspense fallback={<div className="text-center p-8">Loading...</div>}>
                        <ResetPasswordForm />
                    </Suspense>
                </div>
            </div>
        </div>
    )
}
