"use client"
import { useNoIndex } from "@/hooks/useNoIndex"

import { useState, Suspense } from "react"
import { useAuth } from "@/context/auth-context"
import { apiClient } from "@/lib/apiClient"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"


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
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950 px-4">
            <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-xl shadow-lg p-8 border border-slate-200 dark:border-slate-800">
                <div className="flex justify-center mb-6">
                    <div className="size-12 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                        <span className="material-symbols-outlined text-2xl">lock</span>
                    </div>
                </div>

                <h2 className="text-3xl font-bold text-center text-slate-900 dark:text-white mb-2">
                    Welcome Back
                </h2>
                <p className="text-center text-slate-500 dark:text-slate-400 mb-6">
                    Sign in to access your dashboard
                </p>

                {fromAuthGuard && (
                    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-sm flex items-center gap-2 border border-blue-100 dark:border-blue-900/30">
                        <span className="material-symbols-outlined text-lg">info</span>
                        Please login to access this page
                    </div>
                )}

                {error && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-center gap-2 border border-red-100 dark:border-red-900/30">
                        <span className="material-symbols-outlined text-lg">error</span>
                        {error}
                    </div>
                )}

                <Link
                    href="/"
                    className="w-full py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all mb-4 flex items-center justify-center gap-2"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                    Back to Home
                </Link>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                            Username
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            placeholder="Enter your username"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <div className="flex justify-end mt-1">
                        <Link href="/forgot-password" className="text-sm font-medium text-blue-600 hover:text-blue-500">
                            Forgot Password?
                        </Link>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all mt-4 shadow-lg shadow-blue-500/20 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center"
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
                    <Link href="/signup" className="text-blue-600 font-medium hover:underline">
                        Sign up now
                    </Link>
                </p>
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
