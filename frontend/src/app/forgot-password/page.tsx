"use client"
import { useNoIndex } from "@/hooks/useNoIndex"

import { useState } from "react"
import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { apiClient } from "@/lib/apiClient"
import { KeyRound } from "lucide-react"


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
            const res = await apiClient.post('/auth/password-reset/', { email })

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
        <div className="min-h-screen bg-background  font-sans">
            <Navbar />
            <div className="flex items-center justify-center min-h-[calc(100vh-80px)] px-4">
                <div className="max-w-md w-full bg-card rounded-2xl shadow-xl border border-border p-8">
                    <div className="text-center mb-8">
                        <div className="size-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                            <KeyRound className="size-8" />
                        </div>
                        <h1 className="text-2xl font-bold text-primary mb-2">
                            Forgot your password?
                        </h1>
                        <p className="text-muted-foreground">
                            Enter your registered email to receive a reset link
                        </p>
                    </div>

                    {status === "success" ? (
                        <div className="text-center animate-fade-in">
                            <div className="bg-success/10 text-success p-4 rounded-xl mb-6 border border-success/30">
                                {message}
                            </div>
                            <Link prefetch={false}
                                href="/login"
                                className="inline-block w-full py-3 bg-secondary hover:bg-secondary dark:bg-secondary dark:hover:bg-slate-700 text-primary font-bold rounded-xl transition-colors"
                            >
                                Back to Login
                            </Link>
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
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-3 bg-background dark:bg-secondary border border-border rounded-xl focus:ring-2 focus:ring-primary/30 outline-none transition-all"
                                    placeholder="name@example.com"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={status === "loading"}
                                className="w-full py-3 bg-primary hover:opacity-90 text-primary-foreground font-bold rounded-xl transition-all shadow-premium disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
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

                            <Link prefetch={false}
                                href="/login"
                                className="text-center text-sm font-medium text-muted-foreground hover:text-primary dark:hover:text-slate-200 transition-colors mt-2"
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
