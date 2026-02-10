"use client"

import { useState, useEffect } from "react"
import { QuestionNavigator } from "./question-navigator"
import { MobileQuestionNavigator } from "./mobile-question-navigator"
import { examApi } from "@/lib/api"
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { useAuth } from "@/context/auth-context"
// import Link from "next/link"

interface ExamTakingInterfaceProps {
    examId: string
    onSubmit?: () => void
}

export function ExamTakingInterface({ examId, onSubmit }: ExamTakingInterfaceProps) {
    const { user } = useAuth()
    const [questions, setQuestions] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
    const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({})
    const [timeLeft, setTimeLeft] = useState(0) // Seconds

    // 1. Fetch Data on Load
    useEffect(() => {
        async function loadExam() {
            try {
                // Get Exam Details (for duration)
                const examRes = await examApi.get(examId)
                setTimeLeft(examRes.data.duration_minutes * 60)

                // Get Questions
                const qRes = await examApi.getQuestions(examId)
                setQuestions(qRes.data)
                setLoading(false)
            } catch (e) {
                console.error("Failed to load exam", e)
            }
        }
        loadExam()
    }, [examId])

    // 2. Timer Logic
    useEffect(() => {
        if (!loading && timeLeft > 0) {
            const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000)
            return () => clearInterval(timer)
        } else if (timeLeft === 0 && !loading && questions.length > 0) {
            handleSubmit() // Auto-submit when time is up
        }
    }, [loading, timeLeft])

    // 3. Handle Selection
    const handleAnswer = async (qId: number, aId: number) => {
        setSelectedAnswers(prev => ({ ...prev, [qId]: aId }))
        // Background submission
        await examApi.submitAnswer(examId, qId, aId)
    }

    // 4. Explain Logic
    const [explanation, setExplanation] = useState<string | null>(null)
    const [explaining, setExplaining] = useState(false)
    const [visitedQuestions, setVisitedQuestions] = useState<Set<number>>(new Set([1])) // Track visited question IDs (or numbers, using numbers here to match 1-based index)

    // Track Visited
    useEffect(() => {
        if (questions.length > 0) {
            setVisitedQuestions(prev => {
                const newSet = new Set(prev)
                newSet.add(currentQuestionIndex + 1) // Store as 1-based index
                return newSet
            })
        }
    }, [currentQuestionIndex, questions])

    // Reset explanation when changing question
    useEffect(() => {
        setExplanation(null)
    }, [currentQuestionIndex])

    const handleExplain = async () => {
        if (!currentQ) return

        // 🔒 Auth Check for AI
        if (!user) {
            alert("Please login to use AI features.")
            return
        }

        setExplaining(true)
        try {
            const res = await examApi.explainQuestion(currentQ.id)
            setExplanation(res.data.explanation)
        } catch (error) {
            console.error("Explain failed:", error)
            alert("Failed to generate explanation. Please try again.")
        } finally {
            setExplaining(false)
        }
    }

    const handleSubmit = () => {
        onSubmit?.()
    }

    if (loading) return <div className="h-screen flex items-center justify-center font-bold text-xl text-slate-500">Loading Exam Environment...</div>
    if (questions.length === 0) return <div className="h-screen flex items-center justify-center font-bold text-xl text-slate-500">No questions found for this exam.</div>

    const currentQ = questions[currentQuestionIndex]

    // Format timer
    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60)
        const s = seconds % 60
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }

    // Calculate Progress
    const progressPercentage = ((Object.keys(selectedAnswers).length) / questions.length) * 100

    // 🔥 CALCULATE ANSWERED QUESTIONS (For Green Navigator)
    const answeredQuestionNumbers = questions
        .map((q, index) => (selectedAnswers[q.id] ? index + 1 : null))
        .filter((num): num is number => num !== null)

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm h-16 px-4 md:px-8 flex items-center justify-between transition-colors duration-300">

                {/* Left: Progress (Desktop) */}
                <div className="hidden md:flex flex-col w-32 md:w-48 gap-1">
                    <div className="flex justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                        <span>Progress</span>
                        <span>{Math.round(progressPercentage)}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${progressPercentage}%` }} />
                    </div>
                </div>

                {/* Mobile Progress Ring (Simplified) */}
                <div className="md:hidden flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500">{Math.round(progressPercentage)}%</span>
                </div>

                {/* Center: Timer */}
                <div className={`flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full border shadow-sm transition-all duration-500 ${timeLeft < 60
                    ? "bg-red-50 border-red-200 text-red-600 animate-pulse dark:bg-red-900/20 dark:border-red-800 dark:text-red-400"
                    : timeLeft < 300
                        ? "bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400"
                        : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                    }`}>
                    <span className={`material-symbols-outlined text-[18px] md:text-[20px] ${timeLeft < 60 ? "animate-bounce" : ""}`}>
                        {timeLeft < 60 ? "timer_off" : "timer"}
                    </span>
                    <span className="font-mono font-bold text-base md:text-lg tabular-nums tracking-widest">
                        {formatTime(timeLeft)}
                    </span>
                </div>

                {/* Right: Submit */}
                <button
                    onClick={handleSubmit}
                    className="flex items-center gap-2 px-4 py-2 md:px-6 md:py-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-full text-sm font-bold shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 hover:scale-105 transition-all duration-300 active:scale-95"
                >
                    <span className="hidden md:inline">Submit Exam</span>
                    <span className="md:hidden">Submit</span>
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                </button>
            </header>

            {/* Mobile Horizontal Navigator */}
            <MobileQuestionNavigator
                currentQuestion={currentQuestionIndex + 1}
                totalQuestions={questions.length}
                onNavigate={(qNum) => setCurrentQuestionIndex(qNum - 1)}
                answeredQuestions={answeredQuestionNumbers}
                visitedQuestions={Array.from(visitedQuestions)}
            />

            <div className="flex-1 max-w-7xl mx-auto w-full p-4 pb-24 md:p-8 flex gap-8 items-start">

                {/* Navigator Sidebar */}
                <QuestionNavigator
                    currentQuestion={currentQuestionIndex + 1}
                    totalQuestions={questions.length}
                    onNavigate={(qNum) => setCurrentQuestionIndex(qNum - 1)}
                    answeredQuestions={answeredQuestionNumbers}
                    visitedQuestions={Array.from(visitedQuestions)} // 🔥 Pass Visited Questions
                />

                {/* Main Question Card */}
                <main className="flex-1 min-w-0">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 pt-6 md:p-10 relative overflow-hidden">

                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Question {currentQuestionIndex + 1}</span>
                                    {/* 🔥 SUBJECT BADGE */}
                                    {currentQ.subject && (
                                        <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] font-bold uppercase tracking-wider border border-blue-200 dark:border-blue-800">
                                            {currentQ.subject}
                                        </span>
                                    )}
                                    {currentQ.topic && (
                                        <span className="hidden md:inline-block text-[10px] text-slate-400 font-medium">
                                            • {currentQ.topic}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center justify-between md:justify-end gap-3">
                                <button
                                    onClick={handleExplain}
                                    disabled={explaining}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors disabled:opacity-50"
                                >
                                    {explaining ? (
                                        <>
                                            <span className="animate-spin material-symbols-outlined text-xs">refresh</span>
                                            Thinking...
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-xs">auto_awesome</span>
                                            {user ? "AI Explain" : "Login to Explain"}
                                        </>
                                    )}
                                </button>
                                <span className="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full">{currentQ.points} Point(s)</span>
                            </div>
                        </div>

                        <h2 className="text-xl md:text-2xl font-medium text-slate-900 dark:text-white mb-8 leading-relaxed">
                            {currentQ.question_text}
                        </h2>

                        {/* Image Support */}
                        {currentQ.image && (
                            <img src={currentQ.image} alt="Question" className="max-w-full h-auto rounded-lg mb-8 border border-slate-200" />
                        )}

                        <div className="flex flex-col gap-3 md:gap-4">
                            {currentQ.answers.map((ans: any) => {
                                const isSelected = selectedAnswers[currentQ.id] === ans.id
                                return (
                                    <label key={ans.id} className={`group relative flex items-center p-3 md:p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 active:scale-[0.98] ${isSelected ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-800 hover:border-blue-600/30 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                        <input type="radio" name={`q-${currentQ.id}`} className="sr-only" onChange={() => handleAnswer(currentQ.id, ans.id)} />
                                        <div className={`size-8 md:size-10 rounded-lg flex shrink-0 items-center justify-center font-bold mr-3 md:mr-4 transition-colors ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-700'}`}>
                                            {String.fromCharCode(65 + ans.order)}
                                        </div>
                                        <span className={`text-base md:text-lg transition-colors ${isSelected ? 'text-blue-700 dark:text-blue-400 font-medium' : 'text-slate-700 dark:text-slate-300'}`}>
                                            {ans.answer_text}
                                        </span>
                                    </label>
                                )
                            })}
                        </div>

                        {/* AI Explanation Box */}
                        {explanation && (
                            <div className="mt-8 p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800 animate-fade-in">
                                <div className="flex items-center gap-2 mb-2 text-indigo-700 dark:text-indigo-400 font-bold text-sm">
                                    <span className="material-symbols-outlined text-lg">auto_awesome</span>
                                    AI Explanation
                                </div>
                                <div className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm prose dark:prose-invert max-w-none">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkMath]}
                                        rehypePlugins={[rehypeKatex]}
                                    >
                                        {explanation}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        )}

                        {/* Navigation Footer */}
                        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 md:static md:bg-transparent md:border-t md:border-slate-100 md:dark:border-slate-800 md:p-0 md:mt-10 md:pt-6 z-40">
                            <div className="max-w-7xl mx-auto flex justify-between gap-4">
                                <button
                                    onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                                    disabled={currentQuestionIndex === 0}
                                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 md:py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                                >
                                    <span className="material-symbols-outlined text-lg">arrow_back</span>
                                    <span className="hidden md:inline">Previous</span>
                                </button>
                                <button
                                    onClick={() => setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))}
                                    disabled={currentQuestionIndex === questions.length - 1}
                                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 md:py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg shadow-slate-900/20"
                                >
                                    <span className="hidden md:inline">Next Question</span>
                                    <span className="md:hidden">Next</span>
                                    <span className="material-symbols-outlined text-lg">arrow_forward</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}
