"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { useAuth } from "@/context/auth-context"
import { examApi } from "@/lib/api"
import MarkdownRenderer from "@/components/markdown-renderer"
import {
    ArrowLeft,
    GraduationCap,
    CircleUserRound,
    FileText,
    Sparkles,
    LayoutDashboard,
    AlertTriangle
} from "lucide-react"

export default function SummaryPage() {
    const router = useRouter()
    const params = useParams()
    const { user } = useAuth()
    const examId = params.examId as string

    const [exam, setExam] = useState<any>(null)
    const [summaryData, setSummaryData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isGenerating, setIsGenerating] = useState(false)

    useEffect(() => {
        async function fetchExamAndSummary() {
            try {
                // 1. Fetch exam details for title
                const resExam = await examApi.get(examId)
                setExam(resExam.data)

                // 2. Fetch summary
                const resSummary = await examApi.getSummary(examId)
                setSummaryData(resSummary.data)

                if (resSummary.data?.status === 'processing' || resSummary.data?.status === 'queued') {
                    setIsGenerating(true)
                    startPolling()
                } else if (resSummary.data?.status === 'failed') {
                    setError("Failed to generate summary. Please try again later.")
                }

            } catch (err: any) {
                console.error("Failed to load summary page:", err)
                setError("Could not load the exam summary.")
            } finally {
                setLoading(false)
            }
        }
        
        fetchExamAndSummary()
    }, [examId])

    const startPolling = () => {
        const intervalId = setInterval(async () => {
            try {
                const res = await examApi.getSummary(examId)
                setSummaryData(res.data)
                
                if (res.data?.status === 'completed' || res.data?.status === 'failed') {
                    clearInterval(intervalId)
                    setIsGenerating(false)
                    if (res.data?.status === 'failed') {
                        setError("Failed to generate summary.")
                    }
                }
            } catch (e) {
                console.error("Error polling summary", e)
                clearInterval(intervalId)
                setIsGenerating(false)
            }
        }, 5000)
    }

    const handleBack = () => {
        router.back()
    }

    const handleGoToDashboard = () => {
        router.push(`/dashboard/${examId}`)
    }

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
                <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-muted-foreground font-medium">Loading Summary...</p>
            </div>
        )
    }

    const displaySummary = summaryData?.ai_summary || `## AI Summary Not Available\nNo summary has been generated for **${exam?.title || 'this exam'}** yet.`

    return (
        <div className="relative flex min-h-screen w-full flex-col bg-background overflow-x-hidden">
            {/* Top Navigation */}
            <header className="sticky top-0 z-50 bg-card border-b border-border shadow-sm">
                <div className="px-4 md:px-10 py-3 flex items-center justify-between">
                    <button onClick={handleBack} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                        <ArrowLeft className="size-5 text-muted-foreground" />
                        <div>
                            <div className="size-8 flex items-center justify-center bg-primary rounded-lg text-primary-foreground font-bold shadow-premium">
                                <GraduationCap className="size-5" />
                            </div>
                        </div>
                        <h2 className="text-lg font-bold leading-tight tracking-tight text-primary">
                            ExamIntel
                        </h2>
                    </button>

                    <nav className="hidden md:flex items-center gap-8">
                        <span className="text-primary font-medium text-sm border-b-2 border-primary pb-0.5">
                            AI Summary
                        </span>
                    </nav>

                    <div className="flex items-center gap-4">
                        <button className="group relative size-10 rounded-full border border-border p-[3px] shadow-sm hover:shadow-premium transition-all duration-300">
                            <div className="flex h-full w-full items-center justify-center rounded-full bg-secondary">
                                {user ? (
                                    <span className="text-sm font-bold text-primary">
                                        {user.username[0].toUpperCase()}
                                    </span>
                                ) : (
                                    <CircleUserRound className="size-5 text-muted-foreground" />
                                )}
                            </div>
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 flex flex-col items-center py-8 px-4 md:px-8">
                <div className="w-full max-w-5xl flex flex-col gap-6">

                    {/* Page Heading */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 animate-fade-in">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1 flex-wrap">
                                <button onClick={() => router.push('/')} className="hover:text-primary transition-colors">
                                    Exams
                                </button>
                                <span>›</span>
                                <button onClick={handleGoToDashboard} className="hover:text-primary transition-colors">
                                    Result
                                </button>
                                <span>›</span>
                                <span>Summary</span>
                            </div>
                            <h1 className="text-2xl md:text-2xl font-bold tracking-tight text-primary flex items-center gap-3">
                                {/* <Sparkles className="size-6 text-blue-500" /> */}
                                Question Paper Summary
                            </h1>
                            <p className="text-muted-foreground text-sm font-medium mt-1">
                                {exam?.title || "Exam"}
                            </p>
                        </div>
                        <button
                            onClick={handleGoToDashboard}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-secondary border border-border hover:bg-background text-primary transition-all text-sm font-bold active:scale-95 shadow-sm"
                        >
                            <LayoutDashboard className="size-4.5" /> Back to Dashboard
                        </button>
                    </div>

                    {/* Content Section */}
                    <div className="glass-panel rounded-2xl md:rounded-[32px] p-4 md:p-6 shadow-sm border border-border bg-card relative overflow-hidden animate-fade-in" style={{ animationDelay: '0.1s' }}>
                        
                        <div className="flex items-center justify-between mb-8 border-b border-border/50 pb-6">
                            <div>
                                <h2 className="text-xl font-bold text-primary tracking-tight flex items-center gap-2">
                                    <FileText className="size-5 text-muted-foreground" />
                                    AI-Generated Summary
                                </h2>
                                <p className="text-[12px] text-destructive font-bold mt-1 flex items-center gap-1.5">
                                    <AlertTriangle className="size-3.5" />
                                    This is AI-generated content and may contain mistakes.
                                </p>
                            </div>
                        </div>

                        {error ? (
                            <div className="py-12 flex flex-col items-center justify-center text-center">
                                <AlertTriangle className="size-12 text-destructive mb-4" />
                                <p className="text-primary font-bold">{error}</p>
                            </div>
                        ) : isGenerating ? (
                            <div className="flex flex-col items-center justify-center h-full py-20 space-y-4">
                                <div className="relative size-16 flex items-center justify-center">
                                    <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-ping" />
                                    <div className="size-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                                </div>
                                <div className="text-center">
                                    <h3 className="text-lg font-bold text-primary animate-pulse">Generating AI Summary...</h3>
                                    <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                                        Analyzing questions, subject distribution, and difficulty patterns. This may take a minute.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="prose dark:prose-invert prose-sm md:prose-base max-w-none prose-headings:text-primary prose-a:text-blue-500 font-crimson prose-headings:font-heading prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-h4:text-base prose-p:text-[17px] prose-li:text-[17px]">
                                <MarkdownRenderer content={displaySummary} variant="prose" className="!p-0 !border-0 !shadow-none !bg-transparent" />
                            </div>
                        )}
                        
                    </div>
                </div>
            </main>
        </div>
    )
}
