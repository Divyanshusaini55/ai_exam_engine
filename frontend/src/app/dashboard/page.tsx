"use client"

import { useAuth } from "@/context/auth-context"
import { useAuthGuard } from "@/hooks/useAuthGuard"
import { useRouter, usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Navbar } from "@/components/navbar"
import Link from "next/link"
import { miscApi } from "@/lib/api"
import { 
    GraduationCap, 
    BarChart3, 
    CheckCircle2, 
    Clock, 
    PlusCircle, 
    History, 
    Sparkles, 
    CircleUserRound, 
    HelpCircle,
    ArrowRight
} from "lucide-react"

interface Activity {
    id: number
    exam_id: number
    session_id: string
    exam_title: string
    score: number
    date: string
    category: string
}

interface DashboardStats {
    total_tests: number
    average_score: number
    tests_passed: number
    total_study_seconds: number
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
        total_study_seconds: 0,
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
            const res = await miscApi.getDashboardStats()
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

    if (loading) return null
    if (!user) return null

    const successRate = stats.total_tests > 0
        ? Math.round((stats.tests_passed / stats.total_tests) * 100)
        : 0

    const formatStudyTime = (totalSeconds: number) => {
        if (totalSeconds <= 0) return '0m'
        const hours = Math.floor(totalSeconds / 3600)
        const minutes = Math.floor((totalSeconds % 3600) / 60)
        if (hours > 0) return `${hours}h ${minutes > 0 ? `${minutes}m` : ''}`
        return `${minutes}m`
    }

    const formatTakenDate = (dateString: string) => {
        const date = new Date(dateString)
        return date.toLocaleDateString("en-US", {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }


    return (
        <div className="min-h-screen bg-background font-sans transition-colors duration-500">
            <Navbar />
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-10">

                {/* ─── Header ─────────────────────────────── */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 animate-fade-in">
                    <div>
                        <h1 className="text-3xl font-extrabold text-primary tracking-tight mb-1">
                            Dashboard
                        </h1>
                        <p className="text-muted-foreground text-lg">
                            Welcome back, <span className="font-semibold text-primary">{user.username}</span>!
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        <span className="hidden md:block px-3 py-1 bg-card border border-border rounded-full text-xs font-mono text-muted-foreground shadow-sm">
                            ID: #{user.id.toString().padStart(6, '0')}
                        </span>
                        <Link prefetch={false}
                            href="/"
                            className="px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl shadow-premium hover:-translate-y-0.5 transition-all duration-300 active:scale-95 flex items-center gap-2"
                        >
                            <PlusCircle className="size-5" />
                            Start New Test
                        </Link>
                    </div>
                </header>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-10">
                    {[
                        { label: "Tests Taken", value: stats.total_tests, icon: GraduationCap, delay: 0.1, badge: "All Time" },
                        { label: "Avg. Score",  value: `${stats.average_score}%`, icon: BarChart3, delay: 0.2 },
                        { label: "Success Rate", value: `${successRate}%`, icon: CheckCircle2, delay: 0.3 },
                        { label: "Study Time",  value: formatStudyTime(stats.total_study_seconds), icon: Clock, delay: 0.4 },
                    ].map((stat) => {
                        const Icon = stat.icon
                        return (
                            <div
                                key={stat.label}
                                className="card-premium p-5 md:p-6 group animate-fade-in"
                                style={{ animationDelay: `${stat.delay}s` }}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    {/* Icon in a neutral beige container — consistent in both themes */}
                                    <div className="size-10 rounded-xl bg-secondary flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                        <Icon className="size-5" />
                                    </div>
                                    {stat.badge && (
                                        <span className="text-[10px] font-bold bg-secondary text-muted-foreground px-2 py-0.5 rounded-full">
                                            {stat.badge}
                                        </span>
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-2xl md:text-3xl font-bold text-primary mb-1">
                                        {isLoadingStats ? "—" : stat.value}
                                    </h3>
                                    <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
                                        {stat.label}
                                    </p>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* ─── Main: Activity + Sidebar ───────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Recent Activity */}
                    <div className="lg:col-span-2 space-y-6 animate-fade-in" style={{ animationDelay: '0.5s' }}>
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-primary">Recent Activity</h2>
                            <Link prefetch={false} href="/analysis"
                                className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors">
                                View Full Analysis
                            </Link>
                        </div>

                        {stats.total_tests === 0 ? (
                            <div className="card-premium rounded-3xl p-10 text-center">
                                <div className="inline-flex size-16 rounded-full bg-secondary items-center justify-center mb-4 text-muted-foreground">
                                    <History className="size-8" />
                                </div>
                                <h3 className="text-lg font-bold text-primary mb-2">No activity yet</h3>
                                <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                                    Your recent test results and study sessions will appear here once you start your journey.
                                </p>
                                <Link prefetch={false}
                                    href="/"
                                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-secondary border border-border text-primary font-bold rounded-xl hover:bg-background transition-all"
                                >
                                    Explore Exams
                                </Link>
                            </div>
                        ) : (
                            <div className="card-premium rounded-3xl overflow-hidden">
                                <div className="divide-y divide-border">
                                    {stats.recent_activities.map((activity) => (
                                        <div key={activity.id}
                                            className="p-5 flex items-center justify-between hover:bg-secondary/40 transition-colors group cursor-pointer"
                                            onClick={() => router.push(`/dashboard/${activity.exam_id}?session_id=${activity.session_id}`)}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="size-10 rounded-xl bg-secondary text-primary flex items-center justify-center font-bold text-sm uppercase">
                                                    {activity.category.slice(0, 3)}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-primary">{activity.exam_title}</h4>
                                                    <p className="text-xs text-muted-foreground font-medium">{formatTakenDate(activity.date)}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className={`block font-bold ${activity.score >= 50 ? 'text-success' : 'text-primary'}`}>
                                                    {activity.score}%
                                                </span>
                                                <span className="text-xs text-muted-foreground font-medium">Score</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="p-4 bg-secondary/30 text-center border-t border-border">
                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Showing recent results</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6 animate-fade-in" style={{ animationDelay: '0.6s' }}>

                        {/* Daily Motivation — on-theme, no purple */}
                        <div className="bg-primary rounded-premium p-8 text-primary-foreground shadow-premium relative overflow-hidden">
                            {/* Subtle texture overlay */}
                            <div
                                className="absolute inset-0 opacity-10"
                                style={{
                                    backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
                                    backgroundSize: "20px 20px"
                                }}
                            />
                            <div className="absolute top-0 right-0 size-36 bg-secondary/10 rounded-full blur-3xl pointer-events-none" />
                            <div className="relative z-10">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary-foreground/10 rounded-full text-xs font-bold mb-4 border border-primary-foreground/10">
                                    <Sparkles className="size-3.5" />
                                    Daily Motivation
                                </span>
                                <h3 className="text-[19px] font-bold leading-relaxed mb-4 text-primary-foreground">
                                    &ldquo;Believe you can and you&rsquo;re halfway there.&rdquo;
                                </h3>
                                <p className="text-primary-foreground/60 text-sm font-semibold">— Theodore Roosevelt</p>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="card-premium p-6 rounded-3xl">
                            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Quick Actions</h3>
                            <div className="space-y-1">
                                <Link prefetch={false} href="/settings"
                                    className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-secondary text-muted-foreground hover:text-primary transition-all duration-200 group font-medium">
                                    <CircleUserRound className="size-5 group-hover:text-primary transition-colors" />
                                    Edit Profile
                                </Link>
                                <Link prefetch={false} href="/help"
                                    className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-secondary text-muted-foreground hover:text-primary transition-all duration-200 group font-medium">
                                    <HelpCircle className="size-5 group-hover:text-primary transition-colors" />
                                    Help Center
                                </Link>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    )
}
