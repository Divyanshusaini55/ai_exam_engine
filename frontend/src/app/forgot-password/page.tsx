"use client"
import { useNoIndex } from "@/hooks/useNoIndex"

import { useState } from "react"
import Link from "next/link"
import { Navbar } from "@/components/navbar"


export default function ForgotPasswordPage() {
    useNoIndex() // Prevent search engine indexing
    const [email, setEmail] = useState("")
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
    const [message, setMessage] = useState("")

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setStatus("loading")
        setMessage("")

        try {
            const res = await fetch("http://127.0.0.1:8000/api/auth/password-reset/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            })

            const data = await res.json()

            if (res.ok) {
                setStatus("success")
                setMessage(data.message || "If this email is registered, a password reset link has been sent.")
            } else {
                setStatus("error")
                setMessage(data.error || "Something went wrong. Please try again.")
            }
        } catch (err) {
            setStatus("error")
            setMessage("Network error. Please try again later.")
        }
    }

    return (
        <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 font-sans">
            <Navbar />
            <div className="flex items-center justify-center min-h-[calc(100vh-80px)] px-4">
                <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8">
                    <div className="text-center mb-8">
                        <div className="size-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600 dark:text-blue-400">
                            <span className="material-symbols-outlined text-3xl">lock_reset</span>
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                            Forgot your password?
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400">
                            Enter your registered email to receive a reset link
                        </p>
                    </div>

                    {status === "success" ? (
                        <div className="text-center animate-fade-in-up">
                            <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 p-4 rounded-xl mb-6 border border-green-200 dark:border-green-900/30">
                                {message}
                            </div>
                            <Link
                                href="/login"
                                className="inline-block w-full py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition-colors"
                            >
                                Back to Login
                            </Link>
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
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                                    placeholder="name@example.com"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={status === "loading"}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                            >
                                {status === "loading" ? (
                                    <>
                                        <span className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    "Send Reset Link"
                                )}
                            </button>

                            <Link
                                href="/login"
                                className="text-center text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors mt-2"
                            >
                                Back to Login
                            </Link>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}
