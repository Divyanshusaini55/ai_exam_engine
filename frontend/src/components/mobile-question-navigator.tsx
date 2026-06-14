"use client"

import { useRef, useEffect } from "react"

interface MobileQuestionNavigatorProps {
    currentQuestion: number
    totalQuestions: number
    onNavigate: (index: number) => void
    answeredQuestions: number[]
    visitedQuestions: number[]
    mode: 'exam' | 'learning'
    questions: any[]
    reviewQuestions: Record<number, boolean>
    bookmarkedQuestions: Record<number, boolean>
}

export function MobileQuestionNavigator({
    currentQuestion,
    totalQuestions,
    onNavigate,
    answeredQuestions,
    visitedQuestions,
    mode,
    questions,
    reviewQuestions,
    bookmarkedQuestions
}: MobileQuestionNavigatorProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const questionRefs = useRef<(HTMLButtonElement | null)[]>([])

    // Auto-scroll to center current question
    useEffect(() => {
        const currentButton = questionRefs.current[currentQuestion - 1]
        if (currentButton && containerRef.current) {
            currentButton.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center'
            })
        }
    }, [currentQuestion])

    return (
        <div className="md:hidden w-full bg-card border-b border-border shadow-sm shrink-0">
            <div
                ref={containerRef}
                className="flex items-center gap-2 px-4 py-3 overflow-x-auto scrollbar-hide"
                style={{
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                }}
            >
                {Array.from({ length: totalQuestions }).map((_, i) => {
                    const qNum = i + 1
                    const qId = questions[i]?.id
                    const isCurrent = currentQuestion === qNum
                    const isAnswered = answeredQuestions.includes(qNum)
                    const isVisited = visitedQuestions.includes(qNum)
                    const isSkipped = isVisited && !isAnswered && !isCurrent
                    const isReview = qId ? !!reviewQuestions[qId] : false
                    const isBookmarked = qId ? !!bookmarkedQuestions[qId] : false

                    // Determine button style
                    let buttonStyle = "bg-background text-muted-foreground border border-border"

                    if (isCurrent) {
                        buttonStyle = "bg-primary text-primary-foreground border-primary shadow-premium scale-103 z-10"
                    } else if (isAnswered) {
                        buttonStyle = "bg-success/10 text-success border-success/20"
                    } else if (mode === 'exam' && isSkipped) {
                        buttonStyle = "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20"
                    } else if (isReview) {
                        buttonStyle = "bg-indigo-500/10 dark:bg-white/10 text-indigo-600 dark:text-white border-indigo-500/20 dark:border-white/20"
                    } else if (isBookmarked) {
                        buttonStyle = "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20"
                    }

                    // Accessibility label
                    const ariaLabel = `Question ${qNum}${isCurrent ? ', current' : ''}${isAnswered ? ', answered' : ''}${isSkipped ? ', skipped' : ''}${!isVisited ? ', not visited' : ''}`

                    return (
                        <button
                            key={qNum}
                            ref={(el) => { questionRefs.current[i] = el }}
                            onClick={() => onNavigate(qNum)}
                            aria-label={ariaLabel}
                            aria-current={isCurrent ? 'true' : 'false'}
                            className={`
                                relative shrink-0 size-10 rounded-full text-xs font-bold 
                                transition-all duration-200 flex items-center justify-center
                                active:scale-95
                                ${buttonStyle}
                            `}
                        >
                            {qNum}
                            {(isAnswered || isCurrent) && !isReview && !isBookmarked && (
                                <span className={`absolute -top-1 left-1/2 -translate-x-1/2 size-1.5 rounded-full ${isCurrent ? (isAnswered ? 'bg-success' : 'bg-primary') : 'bg-success'}`} aria-hidden="true"></span>
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

            {/* Status Legend - Compact */}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 py-2 text-[10px] text-muted-foreground bg-background/30">
                <div className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-primary"></span>
                    <span>Current</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="size-2.5 rounded-full bg-success"></span>
                    <span>Done</span>
                </div>
                {mode === 'exam' && (
                    <div className="flex items-center gap-1">
                        <span className="size-2.5 rounded-full bg-orange-500"></span>
                        <span>Skipped</span>
                    </div>
                )}
                <div className="flex items-center gap-1">
                    <span className="size-2.5 rounded-full bg-indigo-500 dark:bg-white"></span>
                    <span>Review</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="size-2.5 rounded-full bg-yellow-500"></span>
                    <span>Bookmarked</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="size-2.5 rounded-full bg-background border border-border"></span>
                    <span>Unvisited</span>
                </div>
            </div>
        </div>
    )
}
