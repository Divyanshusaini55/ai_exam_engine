"use client"

import { useAuth } from "@/context/auth-context"
import { useAuthGuard } from "@/hooks/useAuthGuard"
import { useRouter, usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Navbar } from "@/components/navbar"
import Link from "next/link"
import { apiClient } from "@/lib/apiClient"

interface Activity {
    id: number
    exam_title: string
    score: number
    date: string
    category: string
}

interface DashboardStats {
    total_tests: number
    average_score: number
    tests_passed: number
    recent_activities: Activity[]
}

export default function DashboardPage() {
    const { user, loading } = useAuthGuard('/dashboard')
    const router = useRouter()
    const pathname = usePathname()
    const [stats, setStats] = useState<DashboardStats>({
        total_tests: 0,
        average_score: 0,
        tests_passed: 0,
        recent_activities: []
    })
    const [isLoadingStats, setIsLoadingStats] = useState(true)

    useEffect(() => {
        if (user && !loading) {
            fetchStats()
        }
    }, [user, loading])

    const fetchStats = async () => {
        try {
            const res = await apiClient.get('/exams/dashboard_stats/')
            if (res.ok) {
                const data = await res.json()
                setStats(data)
            }
        } catch (err) {
            console.error("Failed to fetch dashboard stats", err)
        } finally {
            setIsLoadingStats(false)
        }
    }

    // Don't render anything while checking auth
    if (loading) {
        return null
    }

    // User must be authenticated to reach this point (auth guard handles redirect)
    if (!user) {
        return null
    }

    // Calculate generic success rate
    const successRate = stats.total_tests > 0
        ? Math.round((stats.tests_passed / stats.total_tests) * 100)
        : 0

    const formatRelativeTime = (dateString: string) => {
        const date = new Date(dateString)
        const now = new Date()
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

        if (diffInSeconds < 60) return 'Just now'
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
        if (diffInSeconds < 172800) return 'Yesterday'
        return `${Math.floor(diffInSeconds / 86400)} days ago`
    }

    // Set noindex meta tag for SEO
    useEffect(() => {
        const metaRobots = document.querySelector('meta[name="robots"]')
        if (metaRobots) {
            metaRobots.setAttribute('content', 'noindex, nofollow')
        } else {
            const meta = document.createElement('meta')
            meta.name = 'robots'
            meta.content = 'noindex, nofollow'
            document.head.appendChild(meta)
        }
    }, [])

    return (
        <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 font-sans transition-colors duration-500">
            <Navbar />
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-10">

                {/* Header Section */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 animate-fade-in-up">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-1">
                            Dashboard
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 text-lg">
                            Welcome back, <span className="font-semibold text-indigo-600 dark:text-indigo-400">{user.username}</span>!
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        <span className="hidden md:block px-3 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full text-xs font-mono text-slate-400 shadow-sm">
                            ID: #{user.id.toString().padStart(6, '0')}
                        </span>
                        <Link
                            href="/"
                            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:-translate-y-0.5 transition-all duration-300 active:scale-95 flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined text-[20px]">add_circle</span>
                            Start New Test
                        </Link>
                    </div>
                </header>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-10">
                    {[
                        { label: "Tests Taken", value: stats.total_tests, icon: "history_edu", color: "blue", delay: 0.1 },
                        { label: "Avg. Score", value: `${stats.average_score}%`, icon: "analytics", color: "indigo", delay: 0.2 },
                        { label: "Success Rate", value: `${successRate}%`, icon: "check_circle", color: "emerald", delay: 0.3 },
                        { label: "Study Time", value: "12h", icon: "schedule", color: "amber", delay: 0.4 }, // Mock data for now
                    ].map((stat) => (
                        <div
                            key={stat.label}
                            className="bg-white dark:bg-slate-900 p-5 md:p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 group animate-fade-in-up"
                            style={{ animationDelay: `${stat.delay}s` }}
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className={`size-10 rounded-xl bg-${stat.color}-50 dark:bg-${stat.color}-900/20 text-${stat.color}-600 dark:text-${stat.color}-400 flex items-center justify-center group-hover:scale-110 transition-transform`}>
                                    <span className="material-symbols-outlined">{stat.icon}</span>
                                </div>
                                {stat.label === "Tests Taken" && (
                                    <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full">All Time</span>
                                )}
                            </div>
                            <div>
                                <h3 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-1">{isLoadingStats ? "-" : stat.value}</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">{stat.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Main Content Area: Recent Activity & Quick Actions */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Recent Activity Section */}
                    <div className="lg:col-span-2 space-y-6 animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Recent Activity</h2>
                            <Link href="/analysis" className="text-sm font-bold text-indigo-600 hover:text-indigo-700 hover:underline">
                                View Full Analysis
                            </Link>
                        </div>

                        {stats.total_tests === 0 ? (
                            <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 border border-slate-100 dark:border-slate-800 shadow-sm text-center">
                                <div className="inline-flex size-16 rounded-full bg-slate-50 dark:bg-slate-800 items-center justify-center mb-4">
                                    <span className="material-symbols-outlined text-3xl text-slate-400">history_toggle_off</span>
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">No activity yet</h3>
                                <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-6">
                                    Your recent test results and study sessions will appear here once you start your journey.
                                </p>
                                <Link
                                    href="/"
                                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all"
                                >
                                    Explore Exams
                                </Link>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                                <div className="divide-y divide-slate-50 dark:divide-slate-800">
                                    {stats.recent_activities.map((activity) => (
                                        <div key={activity.id} className="p-5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer">
                                            <div className="flex items-center gap-4">
                                                <div className="size-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center font-bold text-sm uppercase">
                                                    {activity.category.slice(0, 3)}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-slate-900 dark:text-white">{activity.exam_title}</h4>
                                                    <p className="text-xs text-slate-500 font-medium">{formatRelativeTime(activity.date)}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className={`block font-bold ${activity.score >= 50 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                                                    {activity.score}%
                                                </span>
                                                <span className="text-xs text-slate-400 font-medium">Score</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 text-center border-t border-slate-100 dark:border-slate-800">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Showing recent results</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar: Motivation & Quick Links */}
                    <div className="space-y-6 animate-fade-in-up" style={{ animationDelay: '0.6s' }}>

                        {/* Daily Quote / Status */}
                        <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-3xl p-8 text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-24 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                            <div className="relative z-10">
                                <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-xs font-bold mb-4 backdrop-blur-sm">Daily Motivation</span>
                                <h3 className="text-xl font-bold leading-relaxed mb-4">
                                    "Believe you can and you're halfway there."
                                </h3>
                                <p className="text-indigo-100 text-sm font-medium opacity-80">- Theodore Roosevelt</p>
                            </div>
                        </div>

                        {/* Quick Links */}
                        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4">Quick Actions</h3>
                            <div className="space-y-3">
                                <Link href="/profile" className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group">
                                    <span className="material-symbols-outlined text-slate-400 group-hover:text-indigo-500 transition-colors">person</span>
                                    <span className="text-slate-600 dark:text-slate-300 font-medium group-hover:text-indigo-600 dark:group-hover:text-indigo-400">Edit Profile</span>
                                </Link>
                                <Link href="/help" className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group">
                                    <span className="material-symbols-outlined text-slate-400 group-hover:text-indigo-500 transition-colors">help</span>
                                    <span className="text-slate-600 dark:text-slate-300 font-medium group-hover:text-indigo-600 dark:group-hover:text-indigo-400">Help Center</span>
                                </Link>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    )
}
