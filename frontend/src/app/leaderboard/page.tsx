"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/context/auth-context"
import { examApi } from "@/lib/api"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Navbar } from "@/components/navbar"

export default function LeaderboardPage() {
    const { user } = useAuth()
    const router = useRouter()
    const [leaderboard, setLeaderboard] = useState<any[]>([])
    const [exams, setExams] = useState<any[]>([])
    const [selectedExam, setSelectedExam] = useState<string>("") // "" = Global
    const [loading, setLoading] = useState(true)

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
        <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 font-sans transition-colors duration-500">
            <Navbar />
            <div className="max-w-5xl mx-auto px-4 md:px-8 py-10">

                {/* Header & Filter */}
                <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-8 animate-fade-in-up">
                    <div className="relative">
                        <div className="absolute -left-12 -top-12 size-40 bg-yellow-400/10 rounded-full blur-3xl pointer-events-none"></div>
                        <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3 relative z-10 tracking-tight">
                            <span className="text-4xl filter drop-shadow-md">🏆</span> Leaderboard
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg relative z-10 max-w-md leading-relaxed">
                            Compete with top learners and track your global standing.
                        </p>
                    </div>

                    <div className="w-full md:w-72 bg-white dark:bg-slate-900 p-1.5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                        <select
                            value={selectedExam}
                            onChange={(e) => setSelectedExam(e.target.value)}
                            className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-none text-slate-900 dark:text-white font-bold text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer"
                        >
                            <option value="">Global Reputation</option>
                            {exams.map((exam: any) => (
                                <option key={exam.id} value={exam.id}>{exam.title}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Content Area */}
                {loading ? (
                    <div className="min-h-[400px] flex flex-col items-center justify-center gap-4">
                        <div className="size-10 border-4 border-indigo-500/30 border-t-indigo-600 rounded-full animate-spin"></div>
                        <p className="text-slate-400 font-medium animate-pulse">Calculating rankings...</p>
                    </div>
                ) : (
                    <>
                        {leaderboard.length === 0 ? (
                            <div className="bg-white dark:bg-slate-900 rounded-3xl p-16 text-center shadow-sm border border-slate-100 dark:border-slate-800 animate-fade-in-up">
                                <div className="size-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <span className="material-symbols-outlined text-4xl text-slate-400">emoji_events</span>
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No rankings yet</h3>
                                <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-8">
                                    Be the first pioneer to take a test and claim the top spot on the leaderboard!
                                </p>
                                <Link
                                    href="/"
                                    className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30 transition-all hover:-translate-y-1 active:scale-95"
                                >
                                    Take a Challenge
                                </Link>
                            </div>
                        ) : (
                            <>
                                {/* TOP 3 PODIUM */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 items-end animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                                    {[0, 1, 2].map((orderIndex) => {
                                        const entry = topThree[orderIndex]
                                        if (!entry) return null

                                        const isFirst = orderIndex === 0
                                        const isSecond = orderIndex === 1
                                        const isThird = orderIndex === 2

                                        // CSS Order for visual sorting:
                                        // Mobile: 1-2-3 (Natural Order)
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
                                                    relative flex flex-col items-center p-6 rounded-3xl shadow-sm border transition-transform duration-300 hover:-translate-y-2
                                                    ${isFirst
                                                        ? "bg-gradient-to-b from-yellow-50 to-white dark:from-yellow-900/10 dark:to-slate-900 border-yellow-200 dark:border-yellow-900/50 z-10 md:-mt-8 md:mb-4 shadow-yellow-500/10"
                                                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"}
                                                `}
                                            >
                                                <div className="absolute -top-4">
                                                    {isFirst && <span className="text-4xl filter drop-shadow-md">🥇</span>}
                                                    {isSecond && <span className="text-3xl filter drop-shadow-sm grayscale-[0.5]">🥈</span>}
                                                    {isThird && <span className="text-3xl filter drop-shadow-sm grayscale-[0.8] sepia-[0.5]">🥉</span>}
                                                </div>

                                                <div className={`
                                                    size-16 rounded-full flex items-center justify-center text-xl font-bold text-white mb-4 shadow-md
                                                    ${isFirst ? "bg-gradient-to-br from-yellow-400 to-orange-500" :
                                                        isSecond ? "bg-gradient-to-br from-slate-300 to-slate-500" :
                                                            "bg-gradient-to-br from-orange-300 to-amber-700"}
                                                `}>
                                                    {entry.username[0].toUpperCase()}
                                                </div>

                                                <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate max-w-full text-center">
                                                    {entry.username}
                                                </h3>
                                                <div className="flex items-center gap-1.5 mt-1 mb-3">
                                                    <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{entry.score}</span>
                                                    <span className="text-xs font-medium text-slate-500 uppercase">Points</span>
                                                </div>

                                                <div className="w-full py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-center">
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                                                        {selectedExam ? "Accuracy" : "Tests"}
                                                    </p>
                                                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                                                        {selectedExam ? `${entry.percentage}%` : entry.exams_taken}
                                                    </p>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* REST OF LEADERBOARD */}
                                {restOfLeaderboard.length > 0 && (
                                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead className="bg-slate-50 dark:bg-slate-800/50">
                                                    <tr>
                                                        <th className="px-6 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest w-24">Rank</th>
                                                        <th className="px-6 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Learner</th>
                                                        <th className="px-6 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">
                                                            {selectedExam ? "Score" : "Reputation"}
                                                        </th>
                                                        <th className="px-6 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">
                                                            {selectedExam ? "Accuracy" : "Tests Taken"}
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                    {restOfLeaderboard.map((entry, idx) => (
                                                        <tr
                                                            key={entry.rank}
                                                            className={`
                                                                group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors
                                                                ${user && user.username === entry.username ? "bg-indigo-50/60 dark:bg-indigo-900/10 hover:bg-indigo-50 dark:hover:bg-indigo-900/20" : ""}
                                                            `}
                                                        >
                                                            <td className="px-6 py-4">
                                                                <span className="font-mono font-bold text-slate-400 group-hover:text-indigo-600 transition-colors">
                                                                    #{entry.rank}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="size-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500">
                                                                        {entry.username[0].toUpperCase()}
                                                                    </div>
                                                                    <span className={`font-bold ${user && user.username === entry.username ? "text-indigo-700 dark:text-indigo-400" : "text-slate-700 dark:text-slate-300"}`}>
                                                                        {entry.username} {user && user.username === entry.username && "(You)"}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <span className="font-mono font-bold text-slate-900 dark:text-white">
                                                                    {entry.score}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
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
                        <div className="mt-12 text-center animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
                            <div className="inline-block p-8 rounded-3xl bg-gradient-to-br from-indigo-900 to-slate-900 text-white shadow-xl shadow-indigo-900/20 relative overflow-hidden max-w-2xl w-full">
                                <div className="absolute top-0 left-0 p-32 bg-indigo-500/20 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
                                <div className="relative z-10">
                                    <p className="text-lg font-medium text-indigo-200 mb-6 italic">
                                        "Consistency beats talent when talent doesn't practice."
                                    </p>
                                    <Link
                                        href="/"
                                        className="inline-flex items-center gap-2 px-6 py-3 bg-white text-indigo-900 font-bold rounded-xl hover:bg-indigo-50 transition-colors active:scale-95"
                                    >
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
