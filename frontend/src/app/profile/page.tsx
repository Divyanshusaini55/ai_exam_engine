"use client"

import { useAuth } from "@/context/auth-context"
import { useRouter } from "next/navigation"
import { useEffect, useState, useMemo } from "react"
import { useTheme } from "next-themes"
import { ActivityCalendar } from "react-activity-calendar"
import { Navbar } from "@/components/navbar"
import { communityApi } from "@/lib/api"
import { XPGuideModal } from "@/components/xp-guide-modal"
import { 
    Calendar, 
    Mail, 
    Settings,
    CircleUserRound,
    Check,
    Heart,
    Image as ImageIcon,
    BarChart3,
    Trophy,
    Flame,
    MessageSquare,
    FileText,
    Eye,
    Bell,
    ChevronRight,
    PenTool,
    LogOut,
    Bookmark,
    Map as MapIcon
} from "lucide-react"
import { cn } from "@/lib/utils"

export default function ProfilePage() {
    const { user, loading, logout } = useAuth()
    const router = useRouter()

    const [activeTab, setActiveTab] = useState("official") 
    const [showProfilePic, setShowProfilePic] = useState(true)
    const [profileData, setProfileData] = useState<any>(null)
    const [userComments, setUserComments] = useState<any[]>([])
    const [statsLoading, setStatsLoading] = useState(true)
    const [isXPModalOpen, setIsXPModalOpen] = useState(false)
    const { theme } = useTheme()

    const heatmapData = useMemo(() => {
        if (!profileData) return []
        const data = [...(profileData.heatmap_activity || [])]
        const today = new Date()
        const oneYearAgo = new Date()
        oneYearAgo.setFullYear(today.getFullYear() - 1)
        
        const dataMap = new Map(data.map(d => [d.date, d]))
        const startDateStr = oneYearAgo.toISOString().split('T')[0]
        const endDateStr = today.toISOString().split('T')[0]
        
        if (!dataMap.has(startDateStr)) {
            data.push({ date: startDateStr, count: 0, level: 0 })
        }
        if (!dataMap.has(endDateStr)) {
            data.push({ date: endDateStr, count: 0, level: 0 })
        }
        
        return data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    }, [profileData])

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login?redirectTo=/profile")
            return
        }

        if (user) {
            const fetchData = async () => {
                setStatsLoading(true)
                try {
                    const [pRes, cRes] = await Promise.all([
                        communityApi.getProfile(),
                        communityApi.getMyComments()
                    ])
                    setProfileData(pRes.data)
                    setUserComments(cRes.data.results || cRes.data || [])
                } catch (error) {
                    console.error("Failed to fetch profile data:", error)
                } finally {
                    setStatsLoading(false)
                }
            }
            fetchData()
        }
    }, [user, loading, router])

    if (loading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="animate-spin size-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background font-sans selection:bg-primary/10">
            <Navbar />
            
            <main className="max-w-[1200px] mx-auto px-4 md:px-8 py-10">
                
                {/* 1. TOP PROFILE HEADER */}
                <section className="animate-fade-in mb-8">
                    <div className="bg-card rounded-[24px] border border-border shadow-premium overflow-hidden">
                        {/* Banner Image */}
                        <div className="h-48 relative w-full overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-indigo-50 opacity-40" />
                            <div className="absolute inset-0 opacity-20" style={{ 
                                backgroundImage: "url('https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=1200')", 
                                backgroundSize: 'cover',
                                backgroundPosition: 'center'
                            }} />
                            <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/5 to-transparent" />
                        </div>

                        <div className="px-8 md:px-10 pb-8 relative">
                            <div className="flex flex-col md:flex-row items-end justify-between gap-6 -mt-10">
                                <div className="flex flex-col md:flex-row items-end gap-6 w-full">
                                    {/* Avatar */}
                                    <div className="size-32 rounded-full border-[6px] border-card bg-secondary shadow-lg flex items-center justify-center text-4xl font-bold text-primary overflow-hidden shrink-0">
                                        {profileData?.avatar_char || user.username[0].toUpperCase()}
                                    </div>

                                    {/* User Details */}
                                    <div className="flex-1 pb-2">
                                        <h1 className="text-[28px] font-bold font-heading text-primary mb-1 tracking-tight">
                                            {user.username}
                                        </h1>
                                        <div className="flex flex-wrap items-center gap-4 text-muted-foreground text-sm font-medium">
                                            <div className="flex items-center gap-1.5">
                                                <Mail className="size-4 opacity-70" />
                                                {user.email}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Calendar className="size-4 opacity-70" />
                                                Joined {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Header Stats */}
                                    <div className="flex items-center justify-between md:justify-start gap-4 md:gap-12 bg-secondary/30 px-4 md:px-8 py-4 rounded-2xl border border-border/50 mb-1 w-full overflow-x-auto no-scrollbar">
                                        <div 
                                            className="text-center group/xp cursor-pointer relative"
                                            onClick={() => setIsXPModalOpen(true)}
                                        >
                                            <p className="text-xl md:text-2xl font-bold text-amber-600 font-heading">{profileData?.xp || 0}</p>
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest relative">
                                                XP 
                                                <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 px-2 py-0.5 rounded opacity-0 group-hover/xp:opacity-100 transition-opacity pointer-events-none hidden md:block shadow-sm">
                                                    How to earn
                                                </span>
                                            </p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xl font-bold text-primary font-heading">{profileData?.answers_count || 0}</p>
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Answers</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xl font-bold text-primary font-heading">{profileData?.comments_count || 0}</p>
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Comments</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xl font-bold text-primary font-heading">{profileData?.total_views || 0}</p>
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Views</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* LEFT SIDEBAR (4/12) */}
                    <div className="lg:col-span-4 flex flex-col gap-6">
                        
                        {/* Support Us Card */}
                        {/* <div className="card-premium p-6 bg-card border border-border shadow-sm flex flex-col gap-4">
                            <div className="flex items-center gap-3">
                                <div className="size-8 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-600">
                                    <Heart className="size-4 fill-current" />
                                </div>
                                <h3 className="text-sm font-bold text-primary tracking-tight">Support Us</h3>
                            </div>
                            <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                                Donate to remove ads and help keep this platform free for all students.
                            </p>
                            <button className="px-2 py-2.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold shadow-sm hover:opacity-90 transition-opacity active:scale-[0.98]">
                                Remove Ads
                            </button>
                        </div> */}

                        {/* Profile Picture Toggle */}
                        <div className="card-premium p-6 bg-card border border-border shadow-sm flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                                <div className="size-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground">
                                    <ImageIcon className="size-4" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-primary tracking-tight">Profile Picture</h3>
                                    <p className="text-[10px] text-muted-foreground font-medium">Show profile picture publicly</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowProfilePic(!showProfilePic)}
                                className={cn(
                                    "w-10 h-6 rounded-full transition-all duration-300 relative",
                                    showProfilePic ? "bg-primary" : "bg-border"
                                )}
                            >
                                <div className={cn(
                                    "absolute top-1 size-4 bg-white rounded-full shadow-sm transition-all duration-300",
                                    showProfilePic ? "left-5" : "left-1"
                                )} />
                            </button>
                        </div>

                        {/* Stats Card */}
                        <div className="card-premium p-6 bg-card border border-border shadow-sm">
                            <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.1em] mb-6">Stats</h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between group cursor-pointer" onClick={() => setActiveTab("official")}>
                                    <div className="flex items-center gap-3">
                                        <Trophy className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                        <span className="text-sm font-medium text-muted-foreground group-hover:text-primary">Official Attempts</span>
                                    </div>
                                    <span className="text-sm font-bold text-primary">{profileData?.official_attempts?.length || 0}</span>
                                </div>
                                <div className="flex items-center justify-between group cursor-pointer" onClick={() => setActiveTab("practice")}>
                                    <div className="flex items-center gap-3">
                                        <PenTool className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                        <span className="text-sm font-medium text-muted-foreground group-hover:text-primary">Practice Sessions</span>
                                    </div>
                                    <span className="text-sm font-bold text-primary">{profileData?.practice_sessions?.length || 0}</span>
                                </div>
                                <div className="flex items-center justify-between group cursor-pointer" onClick={() => setActiveTab("comments")}>
                                    <div className="flex items-center gap-3">
                                        <MessageSquare className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                        <span className="text-sm font-medium text-muted-foreground group-hover:text-primary">Comments</span>
                                    </div>
                                    <span className="text-sm font-bold text-primary">{profileData?.comments_count || 0}</span>
                                </div>
                                <div className="flex items-center justify-between group cursor-pointer" onClick={() => setActiveTab("roadmaps")}>
                                    <div className="flex items-center gap-3">
                                        <Bookmark className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                        <span className="text-sm font-medium text-muted-foreground group-hover:text-primary">Saved Roadmaps</span>
                                    </div>
                                    <span className="text-sm font-bold text-primary">{profileData?.bookmarked_roadmaps?.length || 0}</span>
                                </div>
                            </div>
                        </div>

                        {/* Gamification Card */}
                        <div className="card-premium p-6 bg-card border border-border shadow-sm">
                            <div className="flex items-center gap-3 mb-6">
                                <Trophy className="size-4 text-amber-500" />
                                <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.1em]">Gamification</h3>
                            </div>
                            <div className="space-y-5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Flame className="size-4 text-orange-500" />
                                        <span className="text-sm font-medium text-muted-foreground">Total XP</span>
                                    </div>
                                    <div className="px-2 py-1 bg-amber-500/10 text-amber-600 rounded-lg text-[10px] font-bold flex items-center gap-1">
                                        <Trophy className="size-3" />
                                        {profileData?.xp || 0} XP
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Flame className="size-4 text-orange-500" />
                                        <span className="text-sm font-medium text-muted-foreground">Streak</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-primary flex items-center gap-1">
                                            <Flame className="size-3 text-orange-600" /> 
                                            {profileData?.streak || 0} days
                                        </span>
                                        <span className="text-[10px] text-muted-foreground font-medium">(best: {profileData?.best_streak || 0})</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Manage Account Link */}
                        <div className="mt-2 space-y-2">
                            <button 
                                onClick={() => router.push('/settings')}
                                className="w-full py-3 rounded-[20px] border border-border bg-card text-muted-foreground text-sm font-bold hover:bg-secondary hover:text-primary transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm"
                            >
                                <Settings className="size-4" />
                                Settings
                            </button>
                            <button 
                                onClick={logout}
                                className="w-full py-3 rounded-[20px] border border-border bg-card text-muted-foreground text-sm font-bold hover:bg-secondary hover:text-destructive transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm"
                            >
                                <LogOut className="size-4" />
                                Sign Out
                            </button>
                        </div>
                    </div>

                    {/* RIGHT CONTENT (8/12) */}
                    <div className="lg:col-span-8 flex flex-col gap-6">
                        
                        {/* Activity Heatmap */}
                        <div className="card-premium p-6 bg-card border border-border shadow-sm flex flex-col">
                            <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.1em] mb-4">Contribution Activity</h3>
                            <div className="w-full overflow-x-auto pb-4 custom-scrollbar pl-2">
                                {!statsLoading && heatmapData.length > 0 && (
                                    <div className="min-w-max">
                                        <ActivityCalendar 
                                            data={heatmapData}
                                            theme={{
                                                light: ['#f1f5f9', '#bae6fd', '#7dd3fc', '#38bdf8', '#0284c7'],
                                                dark: ['#1e293b', '#0c4a6e', '#0369a1', '#0284c7', '#38bdf8'],
                                            }}
                                            colorScheme={theme === 'dark' ? 'dark' : 'light'}
                                            labels={{
                                                totalCount: '{{count}} contributions in the last year',
                                            }}
                                            showWeekdayLabels
                                            blockSize={12}
                                            blockMargin={5}
                                            fontSize={12}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Tabs Navigation */}
                        <div className="bg-secondary/30 p-1.5 rounded-2xl border border-border flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
                            <button 
                                onClick={() => setActiveTab("official")}
                                className={cn(
                                    "flex-1 py-2 sm:py-2 px-3 sm:px-6 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap min-w-max",
                                    activeTab === "official" 
                                        ? "bg-primary text-primary-foreground shadow-lg scale-[1.02]" 
                                        : "text-muted-foreground hover:bg-secondary/50"
                                )}
                            >
                                <Trophy className="size-3.5 sm:size-4" />
                                Official Attempts <span className="opacity-60 ml-0.5 sm:ml-1">{profileData?.official_attempts?.length || 0}</span>
                            </button>
                            <button 
                                onClick={() => setActiveTab("practice")}
                                className={cn(
                                    "flex-1 py-2 sm:py-2 px-3 sm:px-6 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap min-w-max",
                                    activeTab === "practice" 
                                        ? "bg-primary text-primary-foreground shadow-lg scale-[1.02]" 
                                        : "text-muted-foreground hover:bg-secondary/50"
                                )}
                            >
                                <PenTool className="size-3.5 sm:size-4" />
                                Practice Sessions <span className="opacity-60 ml-0.5 sm:ml-1">{profileData?.practice_sessions?.length || 0}</span>
                            </button>
                            <button 
                                onClick={() => setActiveTab("comments")}
                                className={cn(
                                    "flex-1 py-2 sm:py-2 px-3 sm:px-6 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap min-w-max",
                                    activeTab === "comments" 
                                        ? "bg-primary text-primary-foreground shadow-lg scale-[1.02]" 
                                        : "text-muted-foreground hover:bg-secondary/50"
                                )}
                            >
                                <MessageSquare className="size-3.5 sm:size-4" />
                                Comments <span className="opacity-60 ml-0.5 sm:ml-1">{userComments.length}</span>
                            </button>
                            <button 
                                onClick={() => setActiveTab("roadmaps")}
                                className={cn(
                                    "flex-1 py-2 sm:py-2 px-3 sm:px-6 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap min-w-max",
                                    activeTab === "roadmaps" 
                                        ? "bg-primary text-primary-foreground shadow-lg scale-[1.02]" 
                                        : "text-muted-foreground hover:bg-secondary/50"
                                )}
                            >
                                <Bookmark className="size-3.5 sm:size-4" />
                                Roadmaps <span className="opacity-60 ml-0.5 sm:ml-1">{profileData?.bookmarked_roadmaps?.length || 0}</span>
                            </button>
                        </div>

                        {/* Tab Content */}
                        <div className="flex flex-col gap-4 min-h-[400px]">
                            {statsLoading ? (
                                <div className="card-premium p-20 flex flex-col items-center justify-center">
                                    <div className="size-10 border-4 border-primary border-t-transparent animate-spin rounded-full" />
                                </div>
                            ) : activeTab === "official" && profileData?.official_attempts?.length > 0 ? (
                                <div className="space-y-4 animate-fade-in">
                                    {profileData.official_attempts.map((attempt: any) => (
                                        <div 
                                            key={attempt.id} 
                                            onClick={() => router.push(`/dashboard/${attempt.exam_id}?session_id=${attempt.session_id}`)}
                                            className="card-premium p-5 bg-card border border-border shadow-sm flex flex-col gap-3 group cursor-pointer hover:border-primary/50 transition-colors"
                                        >
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/20 shrink-0">
                                                        <Trophy className="size-5" />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-primary line-clamp-1">{attempt.exam_title}</h4>
                                                        <p className="text-[10px] text-muted-foreground font-medium">
                                                            Attempted on {new Date(attempt.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <span className="text-base font-extrabold text-primary">{attempt.percentage}%</span>
                                                    <p className="text-[10px] text-muted-foreground font-medium">Accuracy</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-6 text-xs text-muted-foreground font-medium">
                                                <span>Score: <strong className="text-primary font-bold">{attempt.score}</strong></span>
                                                <span>Total Questions: <strong className="text-primary font-bold">{attempt.total_questions}</strong></span>
                                                <span>Correct: <strong className="text-success font-bold">{attempt.correct_answers}</strong></span>
                                                <span>Duration: <strong className="text-primary font-bold">{Math.floor(attempt.duration / 60)}m {attempt.duration % 60}s</strong></span>
                                            </div>
                                            <div className="flex justify-end mt-1">
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        router.push(`/dashboard/${attempt.exam_id}?session_id=${attempt.session_id}`)
                                                    }}
                                                    className="text-[11px] font-bold text-primary flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity"
                                                >
                                                    View Detailed Analysis <ChevronRight className="size-3" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : activeTab === "practice" && profileData?.practice_sessions?.length > 0 ? (
                                <div className="space-y-4 animate-fade-in">
                                    {profileData.practice_sessions.map((session: any) => (
                                        <div 
                                            key={session.id} 
                                            onClick={() => router.push(`/dashboard/${session.exam_id}?session_id=${session.session_id}`)}
                                            className="card-premium p-5 bg-card border border-border shadow-sm flex flex-col gap-3 group cursor-pointer hover:border-primary/50 transition-colors"
                                        >
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="size-10 rounded-xl bg-secondary flex items-center justify-center text-primary font-bold border border-border shrink-0">
                                                        <PenTool className="size-5" />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-primary line-clamp-1">{session.exam_title}</h4>
                                                        <p className="text-[10px] text-muted-foreground font-medium">
                                                            Practiced on {new Date(session.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <span className="text-base font-extrabold text-primary">{session.accuracy}%</span>
                                                    <p className="text-[10px] text-muted-foreground font-medium">Accuracy</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-6 text-xs text-muted-foreground font-medium">
                                                <span>Score: <strong className="text-primary font-bold">{session.score}</strong></span>
                                                <span>Total Questions: <strong className="text-primary font-bold">{session.total_questions}</strong></span>
                                                <span>Correct: <strong className="text-success font-bold">{session.correct_answers}</strong></span>
                                                <span>Duration: <strong className="text-primary font-bold">{Math.floor(session.duration / 60)}m {session.duration % 60}s</strong></span>
                                            </div>
                                            <div className="flex justify-end mt-1">
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        router.push(`/dashboard/${session.exam_id}?session_id=${session.session_id}`)
                                                    }}
                                                    className="text-[11px] font-bold text-primary flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity"
                                                >
                                                    View Detailed Analysis <ChevronRight className="size-3" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : activeTab === "comments" && userComments.length > 0 ? (
                                <div className="space-y-4 animate-fade-in">
                                    {userComments.map((comment, i) => (
                                        <div 
                                            key={comment.id} 
                                            onClick={() => router.push(`/shift/${comment.exam_id || '1'}?q=${comment.question}&mode=learning&discussion=true`)}
                                            className="card-premium p-5 bg-card border border-border shadow-sm flex flex-col gap-3 group cursor-pointer hover:border-primary/50 transition-colors"
                                        >
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="size-10 rounded-xl bg-secondary flex items-center justify-center text-primary font-bold border border-border shadow-sm shrink-0">
                                                        {user.username[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-primary line-clamp-1">{comment.exam_title || `Question #${comment.question}`}</h4>
                                                        <p className="text-[10px] text-muted-foreground font-medium">
                                                            {new Date(comment.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-red-500 bg-red-500/5 px-2 py-1 rounded-lg shrink-0">
                                                    <Heart className="size-3 fill-current" />
                                                    <span className="text-[10px] font-bold">{comment.upvotes}</span>
                                                </div>
                                            </div>
                                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                                {comment.text}
                                            </p>
                                            <div className="flex justify-end mt-1">
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        router.push(`/shift/${comment.exam_id || '1'}?q=${comment.question}&mode=learning&discussion=true`)
                                                    }}
                                                    className="text-[11px] font-bold text-primary flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity"
                                                >
                                                    View Question <ChevronRight className="size-3" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : activeTab === "roadmaps" && profileData?.bookmarked_roadmaps?.length > 0 ? (
                                <div className="grid sm:grid-cols-2 gap-4 animate-fade-in">
                                    {profileData.bookmarked_roadmaps.map((roadmap: any) => (
                                        <div 
                                            key={roadmap.id} 
                                            onClick={() => router.push(`/roadmap/${roadmap.subcategory_slug}`)}
                                            className="card-premium p-6 bg-card border border-border shadow-sm flex flex-col gap-4 group cursor-pointer hover:border-primary/50 transition-colors"
                                        >
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/20">
                                                        <MapIcon className="size-5" />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-primary line-clamp-1">{roadmap.title}</h4>
                                                        <p className="text-[10px] text-muted-foreground font-medium">
                                                            {roadmap.subcategory_name}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            <p className="text-xs text-muted-foreground line-clamp-2">
                                                {roadmap.description}
                                            </p>
                                            <div className="text-[11px] font-bold text-primary flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity self-end mt-auto">
                                                View Roadmap <ChevronRight className="size-3" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="card-premium p-20 bg-card border border-border shadow-sm flex flex-col items-center justify-center text-center animate-fade-in h-full">
                                    <div className="size-20 rounded-full bg-secondary/50 flex items-center justify-center text-muted-foreground/30 mb-6">
                                        {activeTab === "official" ? (
                                            <Trophy className="size-10" />
                                        ) : activeTab === "practice" ? (
                                            <PenTool className="size-10" />
                                        ) : activeTab === "comments" ? (
                                            <MessageSquare className="size-10" />
                                        ) : activeTab === "roadmaps" ? (
                                            <Bookmark className="size-10" />
                                        ) : (
                                            <Bell className="size-10" />
                                        )}
                                    </div>
                                    <h3 className="text-lg font-bold text-primary mb-2">
                                        {activeTab === "official" ? "No official attempts yet" : 
                                         activeTab === "practice" ? "No practice sessions yet" : 
                                         activeTab === "comments" ? "No comments posted yet" : 
                                         activeTab === "roadmaps" ? "No saved roadmaps" :
                                         "No notifications yet"}
                                    </h3>
                                    <p className="text-sm text-muted-foreground font-medium max-w-[280px]">
                                        {activeTab === "official" ? "Take an exam under exam mode to see it here!" :
                                         activeTab === "practice" ? "Start practicing under learning mode to track your history." :
                                         activeTab === "comments" ? "Join the discussions on exam papers!" :
                                         activeTab === "roadmaps" ? "Bookmark roadmaps to easily find them later." :
                                         "We'll notify you about replies and rewards."}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            <XPGuideModal 
                isOpen={isXPModalOpen} 
                onClose={() => setIsXPModalOpen(false)} 
            />
        </div>
    )
}
