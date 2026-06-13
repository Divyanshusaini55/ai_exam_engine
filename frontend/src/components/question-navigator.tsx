"use client"

import { Sparkles, Lock, LayoutGrid, Download } from "lucide-react"

interface QuestionNavigatorProps {
    currentQuestion: number
    totalQuestions: number
    onNavigate: (index: number) => void
    answeredQuestions: number[]
    visitedQuestions: number[]
    mode: 'exam' | 'learning'
    onModeChange: (mode: 'exam' | 'learning') => void
    pdfUrl?: string
    isLoggedIn: boolean
    onViewSummary: () => void
    questions: any[]
    reviewQuestions: Record<number, boolean>
    bookmarkedQuestions: Record<number, boolean>
}

export function QuestionNavigator({
    currentQuestion,
    totalQuestions,
    onNavigate,
    answeredQuestions,
    visitedQuestions,
    mode,
    onModeChange,
    pdfUrl,
    isLoggedIn,
    onViewSummary,
    questions,
    reviewQuestions,
    bookmarkedQuestions
}: QuestionNavigatorProps) {
    const handleDownload = () => {
        if (!isLoggedIn) {
            alert("Please login to download the question paper PDF.")
            return
        }
        if (pdfUrl) {
            window.open(pdfUrl, '_blank')
        } else {
            alert("PDF not available for this exam.")
        }
    }
    return (
        <aside className="hidden md:flex flex-col w-72 shrink-0 bg-card border border-border rounded-2xl shadow-sm overflow-hidden sticky top-24 max-h-[calc(100vh-120px)]">
            {/* Top Action Buttons */}
            <div className="p-4 flex flex-col gap-3 border-b border-border">
                {/* Mode Toggle */}
                <div className="flex bg-secondary p-1 rounded-[14px]">
                    <button 
                        onClick={() => onModeChange('exam')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-[12px] transition-all ${mode === 'exam' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-primary'}`}
                    >
                        Exam Mode
                    </button>
                    <button 
                        onClick={() => onModeChange('learning')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-[12px] transition-all ${mode === 'learning' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-primary'}`}
                    >
                        Learning Mode
                    </button>
                </div>

                {/* Summary Button */}
                <button 
                    onClick={onViewSummary}
                    className="w-full mt-1 py-2 bg-primary text-primary-foreground rounded-[14px] text-[13px] font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-95 shadow-sm"
                >
                    <Sparkles className="size-4" />
                    View Question Paper Summary
                </button>
                
                {/* Download Button */}
                <button 
                    onClick={handleDownload}
                    className="w-full py-2 bg-card text-primary border border-border rounded-[14px] text-[13px] font-bold flex items-center justify-center gap-2 hover:bg-secondary transition-all active:scale-95 shadow-sm"
                >
                    {isLoggedIn ? <Download className="size-4" /> : <Lock className="size-4" />}
                    Download PDF
                </button>
            </div>

            <div className="p-4 border-b border-border bg-background/30">
                <h3 className="font-bold text-primary flex items-center gap-2">
                    <LayoutGrid className="size-4 text-primary" />
                    navigator
                </h3>
                <div className="flex justify-between items-center mt-2">
                    <p className="text-xs text-muted-foreground">
                        {answeredQuestions.length}/{totalQuestions} Attempted
                    </p>
                    <div className="flex gap-1">
                        <span className="size-2 rounded-full bg-success" title="Answered" />
                        {mode === 'exam' && (
                            <span className="size-2 rounded-full bg-orange-500" title="Skipped" />
                        )}
                        <span className="size-2 rounded-full bg-indigo-500 dark:bg-white" title="Review" />
                        <span className="size-2 rounded-full bg-yellow-500" title="Bookmarked" />
                        <span className="size-2 rounded-full bg-muted" title="Not Visited" />
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <div className="grid grid-cols-5 gap-3">
                    {Array.from({ length: totalQuestions }).map((_, i) => {
                        const qNum = i + 1
                        const qId = questions[i]?.id
                        const isCurrent = currentQuestion === qNum
                        const isAnswered = answeredQuestions.includes(qNum)
                        const isVisited = visitedQuestions.includes(qNum)
                        const isSkipped = isVisited && !isAnswered && !isCurrent
                        const isReview = qId ? !!reviewQuestions[qId] : false
                        const isBookmarked = qId ? !!bookmarkedQuestions[qId] : false

                        // Determine Style
                        let buttonStyle = "bg-background text-muted-foreground border border-border hover:bg-secondary"

                        if (isCurrent) {
                            buttonStyle = "bg-primary text-primary-foreground border-primary shadow-premium scale-105 z-10 ring-4 ring-primary/20"
                        } else if (isAnswered) {
                            buttonStyle = "bg-success/10 text-success border-success/20 hover:bg-success/20"
                        } else if (mode === 'exam' && isSkipped) {
                            buttonStyle = "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 hover:bg-orange-500/20"
                        } else if (isReview) {
                            buttonStyle = "bg-indigo-500/10 dark:bg-white/10 text-indigo-600 dark:text-white border-indigo-500/20 dark:border-white/20 hover:bg-indigo-500/20 dark:hover:bg-white/20"
                        } else if (isBookmarked) {
                            buttonStyle = "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20 hover:bg-yellow-500/20"
                        }

                        return (
                            <button
                                key={qNum}
                                onClick={() => onNavigate(qNum)}
                                className={`
                                    relative size-9 rounded-full text-[13px] font-bold transition-all duration-200
                                    flex items-center justify-center shrink-0
                                    ${buttonStyle}
                                `}
                            >
                                {qNum}
                                {(isAnswered || isCurrent) && !isReview && !isBookmarked && (
                                    <span className={`absolute -top-1 left-1/2 -translate-x-1/2 size-1.5 rounded-full ${isCurrent ? (isAnswered ? 'bg-success' : 'bg-primary') : 'bg-success'}`}></span>
                                )}
                                {isBookmarked && (
                                    <span className="absolute -top-1 -right-1 size-2 rounded-full bg-yellow-500" title="Bookmarked"></span>
                                )}
                                {isReview && (
                                    <span className="absolute -bottom-1 -right-1 size-2 rounded-full bg-indigo-500 dark:bg-white" title="Review"></span>
                                )}
                            </button>
                        )
                    })}
                </div>
            </div>

            <div className="p-4 bg-background/30 border-t border-border text-[11px] text-muted-foreground flex flex-col gap-2 font-medium">
                <div className="grid grid-cols-2 gap-y-3 gap-x-2">
                    <div className="flex items-center gap-2">
                        <span className="size-3 rounded-full bg-primary"></span> Current
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="size-3 rounded-full bg-success"></span> Answered
                    </div>
                    {mode === 'exam' && (
                        <div className="flex items-center gap-2">
                            <span className="size-3 rounded-full bg-orange-500"></span> Skipped
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <span className="size-3 rounded-full bg-indigo-500 dark:bg-white"></span> Review
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="size-3 rounded-full bg-yellow-500"></span> Bookmarked
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="size-3 rounded-full bg-background border border-border"></span> Not Visited
                    </div>
                </div>
            </div>
        </aside>
    )
}
