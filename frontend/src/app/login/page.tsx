"use client"
import { useNoIndex } from "@/hooks/useNoIndex"

import { useState, Suspense } from "react"
import { useAuth } from "@/context/auth-context"
import { apiClient } from "@/lib/apiClient"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { AuthInput } from "@/components/AuthInput"


function LoginForm() {
    useNoIndex() // Prevent search engine indexing
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const { login } = useAuth()
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const searchParams = useSearchParams()
    const redirectTo = searchParams.get("redirectTo") || "/dashboard"
    const fromAuthGuard = searchParams.get("from") === "auth-guard"

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        setLoading(true)

        try {
            const res = await apiClient.post('/auth/login/', {
                username,
                password
            })

            const data = await res.json()

            if (res.ok) {
                login(data.token, {
                    id: data.user_id,
                    username: data.username,
                    email: data.email,
                    date_joined: new Date().toISOString()
                })
                // Execute proper redirect using replacement to fix back button behavior
                router.replace(redirectTo)
            } else {
                setError(data.non_field_errors?.[0] || "Invalid credentials")
            }
        } catch (err) {
            setError("Something went wrong. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950 px-4 py-12 md:py-20 relative">
            <div className="absolute top-6 left-6 md:top-8 md:left-8">
                <Link
                    href="/"
                    className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors text-sm font-medium"
                >
                    <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                    Back to Home
                </Link>
            </div>

            <div className="max-w-[420px] w-full">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none p-8 md:p-10 border border-slate-100 dark:border-slate-800/50">
                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
                            Welcome Back
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400">
                            Sign in to access your AI study tools.
                        </p>
                    </div>

                    {fromAuthGuard && (
                        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-xl text-sm flex items-center gap-2 border border-blue-100 dark:border-blue-900/30">
                            <span className="material-symbols-outlined text-lg">info</span>
                            Please login to access this page
                        </div>
                    )}

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm flex items-center gap-2 border border-red-100 dark:border-red-900/30">
                            <span className="material-symbols-outlined text-lg">error</span>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                        <AuthInput
                            label="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter your username"
                            required
                        />

                        <AuthInput
                            label="Password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />

                        <div className="flex justify-end">
                            <Link href="/forgot-password" className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:hover:text-blue-400 transition-colors">
                                Forgot Password?
                            </Link>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center"
                        >
                            {loading ? (
                                <span className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                "Sign In"
                            )}
                        </button>
                    </form>

                    <p className="mt-8 text-center text-sm text-slate-600 dark:text-slate-400">
                        Don't have an account?{" "}
                        <Link href="/signup" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">
                            Sign up now
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <LoginForm />
        </Suspense>
    )
}
