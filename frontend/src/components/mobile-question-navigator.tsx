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
        <div className="md:hidden sticky top-16 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
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
                    let buttonStyle = "bg-slate-50 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"

                    if (isCurrent) {
                        buttonStyle = "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/30 scale-105"
                    } else if (isAnswered) {
                        buttonStyle = "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800"
                    } else if (isSkipped) {
                        buttonStyle = "bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800"
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
                                relative shrink-0 size-11 rounded-full text-xs font-bold 
                                transition-all duration-200 flex items-center justify-center
                                active:scale-95
                                ${buttonStyle}
                            `}
                        >
                            {qNum}
                            {isAnswered && !isCurrent && (
                                <span className="absolute -top-0.5 -right-0.5 size-2 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900" aria-hidden="true"></span>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Status Legend - Compact */}
            <div className="flex items-center justify-center gap-4 px-4 py-2 text-[10px] text-slate-500 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-blue-600"></span>
                    <span>Current</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-emerald-500"></span>
                    <span>Done</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-orange-400"></span>
                    <span>Skipped</span>
                </div>
            </div>
        </div>
    )
}
