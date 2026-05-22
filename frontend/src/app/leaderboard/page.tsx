"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/context/auth-context"
import { examApi } from "@/lib/api"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { Trophy, Sparkles, ChevronDown, Rocket, HelpCircle } from "lucide-react"
import { XPGuideModal } from "@/components/xp-guide-modal"

export default function LeaderboardPage() {
    const { user } = useAuth()
    const router = useRouter()
    const [leaderboard, setLeaderboard] = useState<any[]>([])
    const [exams, setExams] = useState<any[]>([])
    const [selectedExam, setSelectedExam] = useState<string>("") // "" = Global
    const [loading, setLoading] = useState(true)
    const [isXPModalOpen, setIsXPModalOpen] = useState(false)

    useEffect(() => {
        // Fetch exams for filter dropdown
        async function fetchExams() {
            try {
                const res = await examApi.list()
                if (res.data.results && Array.isArray(res.data.results)) {
                    setExams(res.data.results)
                } else if (Array.isArray(res.data)) {
                    setExams(res.data)
                } else {
                    setExams([])
                }
            } catch (err) {
                console.error("Failed to fetch exams", err)
            }
        }
        fetchExams()
    }, [])

    useEffect(() => {
        fetchLeaderboard()
    }, [selectedExam])

    const fetchLeaderboard = async () => {
        try {
            setLoading(true)
            const examId = selectedExam === "" ? undefined : selectedExam
            const res = await examApi.getLeaderboard(examId)
            setLeaderboard(res.data)
        } catch (err) {
            console.error("Failed to fetch leaderboard", err)
        } finally {
            setLoading(false)
        }
    }

    // Slice top 3 for podium
    const topThree = leaderboard.slice(0, 3)
    const restOfLeaderboard = leaderboard.slice(3)

    return (
        <div className="min-h-screen bg-background font-sans transition-colors duration-500 overflow-hidden">
            <Navbar />
            
            {/* Soft Ambient Blurs */}
            <div className="absolute top-0 right-0 size-[500px] bg-primary/5 rounded-full blur-[150px] pointer-events-none" />
            <div className="absolute top-[30%] left-[-10%] size-[500px] bg-secondary/80 rounded-full blur-[120px] pointer-events-none" />

            <XPGuideModal isOpen={isXPModalOpen} onClose={() => setIsXPModalOpen(false)} />

            <div className="max-w-5xl mx-auto px-4 md:px-8 py-16 relative z-10">

                {/* Header & Filter */}
                <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8 animate-fade-in">
                    <div className="relative">
                        <div className="flex items-center gap-3 mb-2">
                             <h1 className="text-[44px] md:text-[56px] font-bold font-heading text-primary tracking-tight leading-tight">
                                Leaderboard
                            </h1>
                        </div>
                        <p className="text-muted-foreground mt-2 text-[17px] font-medium relative z-10 max-w-md leading-relaxed">
                            Compete with top learners and track your global standing.
                        </p>
                    </div>

                    <div className="flex flex-col items-end gap-4 w-full md:w-auto">
                        <button 
                            onClick={() => setIsXPModalOpen(true)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 border border-border hover:bg-secondary transition-all group animate-fade-in"
                        >
                            <HelpCircle className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            <span className="text-xs font-bold text-muted-foreground group-hover:text-primary transition-colors">How to earn XP</span>
                        </button>

                        <div className="w-full md:w-72 relative group">
                            <select
                                value={selectedExam}
                                onChange={(e) => setSelectedExam(e.target.value)}
                                className="w-full appearance-none p-4 pr-12 rounded-2xl bg-card border border-border text-primary font-bold text-sm focus:ring-2 focus:ring-primary/10 outline-none cursor-pointer transition-all duration-300 shadow-sm"
                            >
                                <option value="">Global Reputation</option>
                                {exams.map((exam: any) => (
                                    <option key={exam.id} value={exam.id}>{exam.title}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none transition-transform group-hover:translate-y-[-40%]" />
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                {loading ? (
                    <div className="min-h-[400px] flex flex-col items-center justify-center gap-4">
                        <div className="size-10 border-4 border-secondary border-t-primary rounded-full animate-spin"></div>
                        <p className="text-muted-foreground font-medium animate-pulse">Computing standings...</p>
                    </div>
                ) : (
                    <>
                        {leaderboard.length === 0 ? (
                            <div className="bg-card rounded-premium p-16 text-center shadow-premium border border-border animate-fade-in">
                                <div className="size-20 bg-secondary rounded-[20px] flex items-center justify-center mx-auto mb-6 shadow-sm">
                                    <Trophy className="size-10 text-primary" />
                                </div>
                                <h3 className="text-[22px] font-bold font-heading text-primary mb-2">No rankings yet</h3>
                                <p className="text-muted-foreground max-w-sm mx-auto mb-8 font-medium">
                                    Be the first pioneer to take a test and claim the top spot on the leaderboard!
                                </p>
                                <Link prefetch={false}
                                    href="/"
                                    className="px-8 py-3.5 bg-primary text-primary-foreground font-bold rounded-xl shadow-premium hover:-translate-y-1 transition-all duration-300 inline-block"
                                >
                                    Take a Challenge
                                </Link>
                            </div>
                        ) : (
                            <>
                                {/* TOP 3 PODIUM */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 items-end animate-fade-in" style={{ animationDelay: '0.1s' }}>
                                    {[0, 1, 2].map((orderIndex) => {
                                        const entry = topThree[orderIndex]
                                        if (!entry) return null

                                        const isFirst = orderIndex === 0
                                        const isSecond = orderIndex === 1
                                        const isThird = orderIndex === 2

                                        // Desktop: 2-1-3 (Podium: Silver-Gold-Bronze)
                                        const orderClass = isFirst
                                            ? "order-1 md:order-2"
                                            : isSecond
                                                ? "order-2 md:order-1"
                                                : "order-3 md:order-3"


                                        return (
                                            <div
                                                key={entry.username}
                                                className={`
                                                    ${orderClass}
                                                    relative flex flex-col items-center p-8 rounded-premium shadow-premium transition-all duration-500 hover:-translate-y-2
                                                    ${isFirst
                                                        ? "bg-card border-2 border-primary/20 z-10 md:-mt-12 md:mb-6 shadow-2xl shadow-primary/10"
                                                        : "bg-card border border-border"}
                                                `}
                                            >
                                                {/* Glow for first place */}
                                                {isFirst && <div className="absolute inset-0 bg-primary/5 rounded-premium pointer-events-none" />}

                                                <div className="absolute -top-6">
                                                    {isFirst && <span className="text-[48px] filter drop-shadow-md">🥇</span>}
                                                    {isSecond && <span className="text-[40px] filter drop-shadow-sm grayscale-[0.8] brightness-125">🥈</span>}
                                                    {isThird && <span className="text-[40px] filter drop-shadow-sm sepia-[0.5] hue-rotate-[320deg] brightness-90">🥉</span>}
                                                </div>

                                                <div className={`
                                                    size-20 rounded-[20px] flex items-center justify-center text-[28px] font-bold text-primary mb-5 shadow-sm mt-4
                                                    ${isFirst ? "bg-primary/10" : isSecond ? "bg-secondary" : "bg-orange-500/10"}
                                                `}>
                                                    {entry.username[0].toUpperCase()}
                                                </div>

                                                <h3 className="text-[20px] font-bold font-heading text-primary truncate max-w-full text-center">
                                                    {entry.username}
                                                </h3>
                                                <div className="flex items-center gap-1.5 mt-1.5 mb-5">
                                                    <span className={`text-lg font-bold ${isFirst ? "text-primary" : "text-primary"}`}>{entry.score}</span>
                                                    <span className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest">Points</span>
                                                </div>

                                                <div className="w-full py-3 bg-secondary/50 border border-border rounded-xl text-center">
                                                    <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-widest mb-1">
                                                        {selectedExam ? "Accuracy" : "Tests Taken"}
                                                    </p>
                                                    <p className="text-[17px] font-bold text-primary">
                                                        {selectedExam ? `${entry.percentage}%` : entry.exams_taken}
                                                    </p>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* REST OF LEADERBOARD */}
                                {restOfLeaderboard.length > 0 && (
                                    <div className="bg-card rounded-premium shadow-premium border border-border overflow-hidden animate-fade-in p-2" style={{ animationDelay: '0.3s' }}>
                                        <div className="overflow-x-auto rounded-xl">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr>
                                                        <th className="px-6 py-5 text-[12px] font-bold text-muted-foreground uppercase tracking-widest w-24">Rank</th>
                                                        <th className="px-6 py-5 text-[12px] font-bold text-muted-foreground uppercase tracking-widest">Learner</th>
                                                        <th className="px-6 py-5 text-[12px] font-bold text-muted-foreground uppercase tracking-widest text-right">
                                                            {selectedExam ? "Score" : "Reputation"}
                                                        </th>
                                                        <th className="px-6 py-5 text-[12px] font-bold text-muted-foreground uppercase tracking-widest text-right">
                                                            {selectedExam ? "Accuracy" : "Tests Taken"}
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {restOfLeaderboard.map((entry, idx) => (
                                                        <tr
                                                            key={entry.rank}
                                                            className={`
                                                                group transition-colors duration-200 border-t border-border
                                                                ${user && user.username === entry.username ? "bg-primary/5" : "hover:bg-secondary/50"}
                                                            `}
                                                        >
                                                            <td className="px-6 py-5">
                                                                <span className="font-mono text-[15px] font-bold text-muted-foreground group-hover:text-primary transition-colors">
                                                                    #{entry.rank}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-5">
                                                                <div className="flex items-center gap-4">
                                                                    <div className="size-10 rounded-[10px] bg-secondary border border-border flex items-center justify-center text-[14px] font-bold text-primary shadow-sm">
                                                                        {entry.username[0].toUpperCase()}
                                                                    </div>
                                                                    <span className={`text-[15px] font-bold text-primary`}>
                                                                        {entry.username} {user && user.username === entry.username && <span className="text-primary font-medium ml-1">(You)</span>}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-5 text-right">
                                                                <span className="font-mono text-[16px] font-bold text-primary">
                                                                    {entry.score}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-5 text-right">
                                                                <span className="text-[15px] font-bold text-muted-foreground">
                                                                    {selectedExam ? `${entry.percentage}%` : entry.exams_taken}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Motivational Footer */}
                        <div className="mt-16 text-center animate-fade-in" style={{ animationDelay: '0.5s' }}>
                            <div className="inline-block p-12 rounded-premium bg-primary text-primary-foreground shadow-premium relative overflow-hidden max-w-3xl w-full border border-primary">
                                <div className="absolute top-0 left-0 p-32 bg-secondary/10 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
                                <div className="relative z-10 flex flex-col items-center">
                                    <Sparkles className="size-10 text-primary-foreground/80 mb-6" />
                                    <p className="text-[22px] md:text-[26px] font-medium font-heading leading-tight mb-8 italic">
                                        "Consistency beats talent when talent doesn't practice."
                                    </p>
                                    <Link prefetch={false}
                                        href="/"
                                        className="inline-flex items-center gap-2 px-8 py-4 bg-card text-primary font-bold rounded-xl hover:-translate-y-1 shadow-2xl transition-all duration-300"
                                    >
                                        <Rocket className="size-5" />
                                        Take a Test & Improve Rank
                                    </Link>
                                </div>
                            </div>
                        </div>

                    </>
                )}
            </div>
        </div>
    )
}
