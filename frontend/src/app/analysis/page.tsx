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
import { apiClient } from "@/lib/apiClient"
import { 
    ClipboardList, 
    BarChart3, 
    CheckCircle2, 
    Clock, 
    Sparkles, 
    Info, 
    ArrowRight 
} from "lucide-react"


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
                const res = await apiClient.get('/exams/dashboard_stats/')
                if (res.ok) {
                    const data = await res.json()
                    setStats({
                        total_tests: data.total_tests,
                        average_score: data.average_score,
                        tests_passed: data.tests_passed
                    })
                    setHistoryData(data.history || [])

                    // Map subject performance to chart format with colors
                    const colors = ['var(--primary)', 'var(--muted-foreground)', '#D6B97B', '#8A8A8A', '#5F5F5F']
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
            <div className="min-h-screen bg-background  flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="size-10 border-4 border-border border-t-primary rounded-full animate-spin"></div>
                    <p className="text-muted-foreground font-medium animate-pulse">Gathering insights...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background  transition-colors duration-500 font-sans">
            <Navbar />
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-12">

                {/* Header Section */}
                <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="animate-fade-in">
                        <h1 className="text-3xl md:text-4xl font-extrabold text-primary tracking-tight mb-2">
                            Performance Analysis
                        </h1>
                        <p className="text-muted-foreground text-lg max-w-2xl leading-relaxed">
                            Welcome back, <span className="text-primary font-semibold">{user?.username}</span>. Here’s a breakdown of your learning journey and growth.
                        </p>
                    </div>

                    <button
                        onClick={() => router.push('/')}
                        className="animate-fade-in md:self-center px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl shadow-premium hover:-translate-y-0.5 transition-all duration-300 active:scale-95"
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
                                { label: "Tests Taken", value: stats.total_tests, icon: ClipboardList, delay: 0.1 },
                                { label: "Avg. Score", value: `${stats.average_score}%`, icon: BarChart3, delay: 0.2 },
                                { label: "Tests Passed", value: stats.tests_passed, icon: CheckCircle2, delay: 0.3 },
                                { label: "Study Time", value: "12h", icon: Clock, delay: 0.4 },
                            ].map((stat) => {
                                const Icon = stat.icon
                                return (
                                    <div
                                        key={stat.label}
                                        className="bg-card p-6 rounded-2xl border border-border shadow-sm hover:shadow-md transition-all duration-300 group animate-fade-in"
                                        style={{ animationDelay: `${stat.delay}s` }}
                                    >
                                        <div className="size-10 rounded-xl bg-secondary text-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                            <Icon className="size-5" />
                                        </div>
                                        <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-1">{stat.label}</p>
                                        <p className="text-2xl font-bold text-primary">{stat.value}</p>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Main Chart Card */}
                        <div className="bg-card p-8 rounded-3xl shadow-sm border border-border animate-fade-in" style={{ animationDelay: '0.5s' }}>
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="text-xl font-bold text-primary">Score History</h3>
                                    <p className="text-muted-foreground text-sm mt-1">Your performance over the last 7 tests.</p>
                                </div>
                                <select className="bg-background dark:bg-secondary border border-border text-primary text-sm font-medium rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary/10">
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
                                                <stop offset="5%" stopColor="#111111" stopOpacity={0.25} />
                                                <stop offset="95%" stopColor="#111111" stopOpacity={0} />
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
                                            contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', color: 'var(--foreground)' }}
                                            cursor={{ stroke: 'var(--primary)', strokeWidth: 2 }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="score"
                                            stroke="var(--primary)"
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
                        <div className="relative overflow-hidden rounded-premium shadow-premium animate-fade-in bg-primary" style={{ animationDelay: '0.6s' }}>

                            {/* Content Container */}
                            <div className="relative h-full rounded-premium p-8 flex flex-col items-start text-primary-foreground">

                                {/* Ambient Background Glow */}
                                <div className="absolute -top-24 -right-24 w-64 h-64 bg-secondary/20 rounded-full blur-3xl pointer-events-none"></div>
                                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-secondary/20 rounded-full blur-3xl pointer-events-none"></div>

                                {/* Badge & Header */}
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="p-2.5 bg-primary-foreground/10 rounded-xl border border-primary-foreground/20">
                                        <Sparkles className="size-5 text-primary-foreground" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold tracking-tight text-primary-foreground">AI Learning Insight</h3>
                                        <p className="text-xs text-primary-foreground/60 font-medium tracking-wide uppercase">Personalized Recommendation</p>
                                    </div>
                                </div>

                                {/* Insight Text */}
                                <div className="mb-8 relative z-10">
                                    <p className="text-xl md:text-2xl font-medium leading-relaxed text-primary-foreground mb-3">
                                        Focus on <span className="text-primary-foreground font-bold underline decoration-2 underline-offset-4 decoration-primary-foreground/40">General Awareness</span> to boost your overall rank.
                                    </p>
                                    <p className="flex items-start gap-2 text-sm text-primary-foreground/60 leading-relaxed font-medium">
                                        <Info className="size-4 mt-0.5 shrink-0" />
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
                                                    <span class="inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2"></span>
                                                    Preparing personalized practice...
                                                `;
                                                btn.classList.add('cursor-not-allowed', 'opacity-90');

                                                setTimeout(() => {
                                                    router.push('/exams?subject=general_awareness&mode=practice');
                                                }, 1500);
                                            }
                                        }}
                                        id="practice-ga-btn"
                                        className="relative group w-full py-3.5 px-6 bg-card text-primary font-bold rounded-xl shadow-premium hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-300 flex items-center justify-center overflow-hidden"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
                                        <span className="relative z-10">Practice General Awareness</span>
                                    </button>

                                    <div className="text-center">
                                        <button className="text-xs md:text-sm font-medium text-primary-foreground/60 hover:text-primary-foreground transition-colors flex items-center justify-center gap-1 mx-auto hover:gap-2 duration-300 group">
                                            View weak General Awareness topics
                                            <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Subject Performance */}
                        <div className="bg-card p-8 rounded-3xl shadow-sm border border-border animate-fade-in" style={{ animationDelay: '0.7s' }}>
                            <h3 className="text-xl font-bold text-primary mb-6">Subject Proficiency</h3>
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
                        <div className="p-6 bg-secondary/30 rounded-2xl border border-dashed border-border text-center animate-fade-in" style={{ animationDelay: '0.8s' }}>
                            <p className="text-muted-foreground text-sm mb-4">
                                &ldquo;Success is the sum of small efforts, repeated day in and day out.&rdquo;
                            </p>
                            <button className="text-primary font-bold text-sm hover:underline">
                                Read Study Tips →
                            </button>
                        </div>

                    </div>

                </div>
            </div>
        </div>
    )
}
