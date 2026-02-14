"use client"

interface QuestionNavigatorProps {
    currentQuestion: number
    totalQuestions: number
    onNavigate: (index: number) => void
    answeredQuestions: number[]
    visitedQuestions: number[]
}

export function QuestionNavigator({
    currentQuestion,
    totalQuestions,
    onNavigate,
    answeredQuestions,
    visitedQuestions,
}: QuestionNavigatorProps) {
    return (
        <aside className="hidden md:flex flex-col w-72 shrink-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden sticky top-24 max-h-[calc(100vh-120px)]">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-600">grid_view</span>
                    navigator
                </h3>
                <div className="flex justify-between items-center mt-2">
                    <p className="text-xs text-slate-500">
                        {answeredQuestions.length}/{totalQuestions} Attempted
                    </p>
                    <div className="flex gap-1">
                        <span className="size-2 rounded-full bg-emerald-500" title="Answered" />
                        <span className="size-2 rounded-full bg-orange-400" title="Skipped" />
                        <span className="size-2 rounded-full bg-slate-300" title="Not Visited" />
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <div className="grid grid-cols-5 gap-3">
                    {Array.from({ length: totalQuestions }).map((_, i) => {
                        const qNum = i + 1
                        const isCurrent = currentQuestion === qNum
                        const isAnswered = answeredQuestions.includes(qNum)
                        const isVisited = visitedQuestions.includes(qNum)
                        const isSkipped = isVisited && !isAnswered && !isCurrent // Skipped if visited but not answered (and not current) - simple logic

                        // Determine Style
                        let buttonStyle = "bg-slate-50 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"

                        if (isCurrent) {
                            buttonStyle = "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/30 scale-110 z-10"
                        } else if (isAnswered) {
                            buttonStyle = "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800 hover:bg-emerald-200"
                        } else if (isSkipped) {
                            // Skipped Style: Light red/orange tint/border
                            buttonStyle = "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800 hover:bg-orange-100"
                        }

                        return (
                            <button
                                key={qNum}
                                onClick={() => onNavigate(qNum)}
                                className={`
                                    relative size-10 rounded-full text-sm font-bold transition-all duration-200
                                    flex items-center justify-center shrink-0
                                    ${buttonStyle}
                                `}
                            >
                                {qNum}
                                {isAnswered && !isCurrent && (
                                    <span className="absolute -top-0.5 -right-0.5 size-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900"></span>
                                )}
                            </button>
                        )
                    })}
                </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 flex flex-col gap-2 font-medium">
                <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2">
                        <span className="size-3 rounded-full bg-blue-600"></span> Current
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="size-3 rounded-full bg-emerald-100 border border-emerald-200"></span> Answered
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="size-3 rounded-full bg-orange-50 border border-orange-200"></span> Skipped
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="size-3 rounded-full bg-slate-50 border border-slate-200"></span> Not Visited
                    </div>
                </div>
            </div>
        </aside>
    )
}
