"use client"
import { useNoIndex } from "@/hooks/useNoIndex"

import React, { useState, useEffect } from "react"
import { useAuth } from "@/context/auth-context"
import { useAuthGuard } from "@/hooks/useAuthGuard"
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell
} from "recharts"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Navbar } from "@/components/navbar"


export default function AnalysisPage() {
    const { user, loading } = useAuthGuard('/analysis')
    const router = useRouter()

    const [stats, setStats] = useState({
        total_tests: 0,
        average_score: 0,
        tests_passed: 0
    })
    const [historyData, setHistoryData] = useState<any[]>([])
    const [subjectData, setSubjectData] = useState<any[]>([])
    const [loadingStats, setLoadingStats] = useState(true)

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const token = localStorage.getItem('auth_token')
                const res = await fetch('http://127.0.0.1:8000/api/exams/dashboard_stats/', {
                    headers: {
                        'Authorization': `Token ${token}`
                    }
                })
                if (res.ok) {
                    const data = await res.json()
                    setStats({
                        total_tests: data.total_tests,
                        average_score: data.average_score,
                        tests_passed: data.tests_passed
                    })
                    setHistoryData(data.history || [])

                    // Map subject performance to chart format with colors
                    const colors = ['#4F46E5', '#F59E0B', '#0EA5E9', '#EF4444', '#10B981', '#8B5CF6']
                    const mappedSubjects = (data.subject_performance || []).map((subj: any, index: number) => ({
                        name: subj.name || 'Unknown',
                        score: subj.score,
                        color: colors[index % colors.length]
                    }))
                    setSubjectData(mappedSubjects)
                }
            } catch (error) {
                console.error("Failed to fetch dashboard stats", error)
            } finally {
                setLoadingStats(false)
            }
        }

        if (user && !loading) {
            fetchStats()
        }
    }, [user, loading])

    // Don't render anything while checking auth
    if (loading) {
        return null
    }

    // User must be authenticated to reach this point (auth guard handles redirect)
    if (!user) {
        return null
    }

    // Only show loading stats spinner for authenticated users
    if (loadingStats) {
        return (
            <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="size-10 border-4 border-indigo-500/30 border-t-indigo-600 rounded-full animate-spin"></div>
                    <p className="text-slate-400 font-medium animate-pulse">Gathering insights...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 transition-colors duration-500 font-sans">
            <Navbar />
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-12">

                {/* Header Section */}
                <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="animate-fade-in-up">
                        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">
                            Performance Analysis
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 text-lg max-w-2xl leading-relaxed">
                            Welcome back, <span className="text-indigo-600 font-semibold">{user?.username}</span>. Here’s a breakdown of your learning journey and growth.
                        </p>
                    </div>

                    <button
                        onClick={() => router.push('/')}
                        className="animate-fade-in-up md:self-center px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 active:scale-95"
                        style={{ animationDelay: '0.1s' }}
                    >
                        Start New Test
                    </button>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Left Column: Stats & Charts */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* Key Metrics Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: "Tests Taken", value: stats.total_tests, icon: "assignment", color: "blue", delay: 0.1 },
                                { label: "Avg. Score", value: `${stats.average_score}%`, icon: "analytics", color: "indigo", delay: 0.2 },
                                { label: "Tests Passed", value: stats.tests_passed, icon: "check_circle", color: "emerald", delay: 0.3 }, // Changed from Accuracy to Tests Passed
                                { label: "Study Time", value: "12h", icon: "schedule", color: "amber", delay: 0.4 }, // Mock for now
                            ].map((stat) => (
                                <div
                                    key={stat.label}
                                    className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 group animate-fade-in-up"
                                    style={{ animationDelay: `${stat.delay}s` }}
                                >
                                    <div className={`size-10 rounded-xl bg-${stat.color}-50 dark:bg-${stat.color}-900/20 text-${stat.color}-600 dark:text-${stat.color}-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                                        <span className="material-symbols-outlined">{stat.icon}</span>
                                    </div>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">{stat.label}</p>
                                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
                                </div>
                            ))}
                        </div>

                        {/* Main Chart Card */}
                        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Score History</h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Your performance over the last 7 tests.</p>
                                </div>
                                <select className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20">
                                    <option>Last 7 Tests</option>
                                    <option>Last 30 Days</option>
                                    <option>All Time</option>
                                </select>
                            </div>

                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={historyData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="name"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#94a3b8', fontSize: 12 }}
                                            dy={10}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#94a3b8', fontSize: 12 }}
                                        />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            cursor={{ stroke: '#6366f1', strokeWidth: 2 }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="score"
                                            stroke="#6366f1"
                                            strokeWidth={3}
                                            fillOpacity={1}
                                            fill="url(#colorScore)"
                                            animationDuration={2000}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                    </div>

                    {/* Right Column: Insights & Weak Areas */}
                    <div className="space-y-8">

                        {/* AI Insight Card */}
                        <div className="relative overflow-hidden rounded-3xl p-[1px] bg-gradient-to-br from-indigo-500/30 to-purple-500/30 shadow-xl shadow-indigo-500/10 animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/95 to-purple-700/95 backdrop-blur-xl"></div>

                            {/* Content Container */}
                            <div className="relative h-full bg-gradient-to-br from-indigo-950/20 to-purple-900/20 rounded-[23px] p-8 flex flex-col items-start text-white">

                                {/* Ambient Background Glow */}
                                <div className="absolute -top-24 -right-24 w-64 h-64 bg-purple-500/30 rounded-full blur-3xl pointer-events-none"></div>
                                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-500/30 rounded-full blur-3xl pointer-events-none"></div>

                                {/* Badge & Header */}
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="p-2.5 bg-white/10 rounded-xl border border-white/20 backdrop-blur-md shadow-lg shadow-indigo-500/20">
                                        <span className="material-symbols-outlined text-indigo-300">auto_awesome</span>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold tracking-tight text-white">AI Learning Insight</h3>
                                        <p className="text-xs text-indigo-200 font-medium tracking-wide uppercase">Personalized Recommendation</p>
                                    </div>
                                </div>

                                {/* Insight Text */}
                                <div className="mb-8 relative z-10">
                                    <p className="text-xl md:text-2xl font-medium leading-relaxed text-indigo-50 mb-3">
                                        Focus on <span className="text-white font-bold decoration-indigo-400/50 underline decoration-2 underline-offset-4">General Awareness</span> to boost your overall rank.
                                    </p>
                                    <p className="flex items-start gap-2 text-sm text-indigo-200/80 leading-relaxed font-light">
                                        <span className="material-symbols-outlined text-sm mt-0.5 shrink-0">info</span>
                                        Your accuracy in GA (45%) is significantly lower than your average accuracy (78%), impacting your total percentile.
                                    </p>
                                </div>

                                {/* Actions */}
                                <div className="w-full mt-auto space-y-4">
                                    <button
                                        onClick={() => {
                                            const btn = document.getElementById('practice-ga-btn');
                                            if (btn) {
                                                const originalText = btn.innerText;
                                                btn.innerHTML = `
                                                    <span class="inline-block w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mr-2"></span>
                                                    Preparing personalized practice...
                                                `;
                                                btn.classList.add('cursor-not-allowed', 'opacity-90');

                                                setTimeout(() => {
                                                    router.push('/exams?subject=general_awareness&mode=practice');
                                                }, 1500);
                                            }
                                        }}
                                        id="practice-ga-btn"
                                        className="relative group w-full py-3.5 px-6 bg-white text-indigo-700 font-bold rounded-xl shadow-[0_0_20px_-5px_theme('colors.indigo.500')] hover:shadow-[0_0_25px_-5px_theme('colors.indigo.400')] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-300 flex items-center justify-center overflow-hidden"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
                                        <span className="relative z-10">Practice General Awareness</span>
                                    </button>

                                    <div className="text-center">
                                        <button className="text-xs md:text-sm font-medium text-indigo-200 hover:text-white transition-colors flex items-center justify-center gap-1 mx-auto hover:gap-2 duration-300 group">
                                            View weak General Awareness topics
                                            <span className="material-symbols-outlined text-sm group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Subject Performance */}
                        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 animate-fade-in-up" style={{ animationDelay: '0.7s' }}>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Subject Proficiency</h3>
                            <div className="h-[250px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={subjectData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                                        <XAxis type="number" hide />
                                        <YAxis
                                            dataKey="name"
                                            type="category"
                                            axisLine={false}
                                            tickLine={false}
                                            width={80}
                                            tick={{ fill: '#64748b', fontSize: 13, fontWeight: 600 }}
                                        />
                                        <Tooltip
                                            cursor={{ fill: 'transparent' }}
                                            contentStyle={{ borderRadius: '8px' }}
                                        />
                                        <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={20} animationDuration={1500}>
                                            {subjectData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Empty State / CTA (Supportive) */}
                        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-center animate-fade-in-up" style={{ animationDelay: '0.8s' }}>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
                                "Success is the sum of small efforts, repeated day in and day out."
                            </p>
                            <button className="text-indigo-600 font-bold text-sm hover:underline">
                                Read Study Tips →
                            </button>
                        </div>

                    </div>

                </div>
            </div>
        </div>
    )
}
