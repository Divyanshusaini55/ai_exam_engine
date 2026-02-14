"use client"
import { useNoIndex } from "@/hooks/useNoIndex"

import { useState } from "react"
import { useAuth } from "@/context/auth-context"
import { apiClient } from "@/lib/apiClient"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AuthInput } from "@/components/AuthInput"


export default function SignupPage() {
    useNoIndex() // Prevent search engine indexing
    const [formData, setFormData] = useState({
        username: "",
        email: "",
        password: ""
    })
    const [confirmPassword, setConfirmPassword] = useState("")
    const [error, setError] = useState("")
    const [success, setSuccess] = useState("")
    const [loading, setLoading] = useState(false)
    const { login } = useAuth()
    const router = useRouter()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        setSuccess("")

        // Simple client-side check for confirm password without altering main logic flow significantly
        if (confirmPassword && formData.password !== confirmPassword) {
            setError("Passwords do not match")
            return
        }

        setLoading(true)

        try {
            const res = await apiClient.post('/auth/register/', formData)

            const data = await res.json()

            if (res.ok) {
                // ✅ Account created successfully
                login(data.token, data.user)
                setSuccess("Account created successfully! Redirecting to dashboard...")

                // Auto-redirect to dashboard after short delay for user to see success message
                setTimeout(() => {
                    router.push("/dashboard")
                }, 1500)
            } else {
                // Handle validation errors
                // data could be { username: ["error"], non_field_errors: ["..."] }
                let msg = "Registration failed"
                if (typeof data === "object") {
                    const messages = Object.values(data).flat()
                    if (messages.length > 0) msg = String(messages[0])
                }
                setError(msg)
                setLoading(false)
            }
        } catch (err) {
            console.error("Signup error:", err)
            setError("Something went wrong. Please check your connection.")
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950 px-4 py-8 relative">
            <div className="absolute top-6 left-6 md:top-8 md:left-8">
                <Link
                    href="/"
                    className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors text-sm font-medium"
                >
                    <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                    Back to Home
                </Link>
            </div>

            <div className="max-w-[480px] w-full">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none p-8 md:p-10 border border-slate-100 dark:border-slate-800/50">
                    <div className="flex justify-center mb-6">
                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500">
                            <span className="material-symbols-outlined text-3xl">psychology</span>
                            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">AI Exam Engine</span>
                        </div>
                    </div>

                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
                            Create Account
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400">
                            Join thousands of students preparing smarter
                        </p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm flex items-center gap-2 border border-red-100 dark:border-red-900/30">
                            <span className="material-symbols-outlined text-lg">error</span>
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-sm flex items-center gap-2 border border-emerald-100 dark:border-emerald-900/30">
                            <span className="material-symbols-outlined text-lg">check_circle</span>
                            {success}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                        <AuthInput
                            label="Username"
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            placeholder="Pick a username"
                            required
                        />

                        <AuthInput
                            label="Email Address"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="you@example.com"
                            required
                        />

                        <AuthInput
                            label="Password"
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            placeholder="Create a strong password"
                            required
                        />

                        <AuthInput
                            label="Confirm Password"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm your password"
                            required
                        />

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-semibold rounded-xl transition-all mt-2 shadow-lg shadow-emerald-500/25 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center"
                        >
                            {loading ? (
                                <span className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                "Create Account"
                            )}
                        </button>
                    </form>

                    <p className="mt-8 text-center text-sm text-slate-600 dark:text-slate-400">
                        Already have an account?{" "}
                        <Link href="/login" className="text-emerald-600 dark:text-emerald-500 font-semibold hover:underline">
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
