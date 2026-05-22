"use client"

import { useRef, useEffect } from "react"

interface MobileQuestionNavigatorProps {
    currentQuestion: number
    totalQuestions: number
    onNavigate: (index: number) => void
    answeredQuestions: number[]
    visitedQuestions: number[]
}

export function MobileQuestionNavigator({
    currentQuestion,
    totalQuestions,
    onNavigate,
    answeredQuestions,
    visitedQuestions,
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
                    const isCurrent = currentQuestion === qNum
                    const isAnswered = answeredQuestions.includes(qNum)
                    const isVisited = visitedQuestions.includes(qNum)
                    const isSkipped = isVisited && !isAnswered && !isCurrent

                    // Determine button style
                    let buttonStyle = "bg-background text-muted-foreground border border-border"

                    if (isCurrent) {
                        buttonStyle = "bg-primary text-primary-foreground border-primary shadow-premium scale-103 z-10"
                    } else if (isAnswered) {
                        buttonStyle = "bg-success/10 text-success border-success/20"
                    } else if (isSkipped) {
                        buttonStyle = "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20"
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
                            {(isAnswered || isCurrent) && (
                                <span className={`absolute -top-1 left-1/2 -translate-x-1/2 size-1.5 rounded-full ${isCurrent ? (isAnswered ? 'bg-success' : 'bg-primary') : 'bg-success'}`} aria-hidden="true"></span>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Status Legend - Compact */}
            <div className="flex items-center justify-center gap-4 px-4 py-2 text-[10px] text-muted-foreground bg-background/30">
                <div className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-primary"></span>
                    <span>Current</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="size-2.5 rounded-full bg-success/10 border border-success/20 flex items-center justify-center">
                        <span className="size-1 rounded-full bg-success"></span>
                    </div>
                    <span>Done</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="size-2.5 rounded-full bg-orange-500/10 border border-orange-500/20"></span>
                    <span>Skipped</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="size-2.5 rounded-full bg-background border border-border"></span>
                    <span>Unvisited</span>
                </div>
            </div>
        </div>
    )
}
