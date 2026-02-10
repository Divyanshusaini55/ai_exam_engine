"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { CircularProgress } from "@/components/circular-progress"
import { StatsCard } from "@/components/stats-card"
import { QuestionReview } from "@/components/question-review"
import { examApi } from "@/lib/api"

interface PerformanceAnalysisDashboardProps {
  examId: string
  onRetake?: () => void
}

export function PerformanceAnalysisDashboard({ examId, onRetake }: PerformanceAnalysisDashboardProps) {
  const router = useRouter()
  const [result, setResult] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'correct' | 'incorrect' | 'skipped'>('all')

  useEffect(() => {
    async function fetchData() {
      try {
        // 🔥 Now getResults returns everything we need including full questions with answers!
        const resResults = await examApi.getResults(examId)
        setResult(resResults.data)

        // If the API returns questions, use them. Otherwise fallback (backward compat)
        if (resResults.data.questions) {
          setQuestions(resResults.data.questions)
        } else {
          const resQuestions = await examApi.getQuestions(examId)
          setQuestions(resQuestions.data)
        }
      } catch (error) {
        console.error("Failed to fetch data:", error)
      } finally {
        setLoading(false)
      }
    }

    if (examId) {
      fetchData()
    }
  }, [examId])

  const handleBackToHome = () => {
    // Use replace to prevent back navigation to exam
    router.replace("/")
  }

  const handleGoToDashboard = () => {
    router.replace("/dashboard")
  }

  const handleGoToAnalysis = () => {
    router.replace("/analysis")
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 gap-4">
        <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-medium">Calculating Performance...</p>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 gap-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Result not found</h2>
        <button
          onClick={handleBackToHome}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Go Back Home
        </button>
      </div>
    )
  }

  // 🛡️ SAFE DATA CALCULATION
  const totalQuestions = result.total_questions || 0
  const correctAnswers = result.correct_answers || 0

  // Calculate specific metrics to avoid 'undefined' errors
  const skippedAnswers = result.skipped_answers ?? (totalQuestions - (result.answered_questions || 0))
  // If 'wrong_answers' is missing from API, calculate it: Total - Correct - Skipped
  const wrongAnswers = result.wrong_answers ?? (totalQuestions - correctAnswers - skippedAnswers)

  // 🔥 FIXED LINE BELOW: Added parentheses around the calculation
  const percentage = result.percentage ?? (Math.round((correctAnswers / totalQuestions) * 100) || 0)

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden bg-slate-50 dark:bg-slate-950">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-300">
        <div className="px-4 md:px-10 py-3 flex items-center justify-between">
          <button onClick={handleBackToHome} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <span className="material-symbols-outlined text-xl text-slate-600 dark:text-slate-300">arrow_back</span>
            <div>
              <div className="size-8 flex items-center justify-center bg-primary rounded-lg text-white font-bold shadow-md shadow-blue-500/20">
                📚
              </div>
            </div>
            <h2 className="text-lg font-bold leading-tight tracking-tight text-slate-900 dark:text-white">
              ExamPlatform
            </h2>
          </button>

          <nav className="hidden md:flex items-center gap-8">
            <span className="text-primary font-medium text-sm border-b-2 border-primary pb-0.5">Analysis</span>
          </nav>

          <div className="flex items-center gap-4">
            <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-800 border-2 border-white dark:border-slate-700 shadow-sm flex items-center justify-center">
              <span className="text-xs">👤</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center py-8 px-4 md:px-8">
        <div className="w-full max-w-6xl flex flex-col gap-8">

          {/* Page Heading & Meta */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 animate-fade-in">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-1 flex-wrap">
                <button onClick={handleBackToHome} className="hover:text-primary transition-colors">
                  Exams
                </button>
                <span>›</span>
                <span>Result</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
                {result.exam_title || "Exam Result"}
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium flex items-center gap-2">
                📅 Completed on {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleGoToDashboard}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all text-sm font-bold active:scale-95"
              >
                <span className="material-symbols-outlined text-[18px]">dashboard</span> Dashboard
              </button>
              <button
                onClick={handleGoToAnalysis}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all text-sm font-bold active:scale-95"
              >
                <span className="material-symbols-outlined text-[18px]">analytics</span> View Analysis
              </button>
              <button
                onClick={onRetake}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-blue-700 text-white transition-all text-sm font-bold shadow-lg shadow-blue-500/20 active:scale-95"
              >
                <span className="material-symbols-outlined text-[18px]">restart_alt</span> Retake Exam
              </button>
            </div>
          </div>

          {/* Hero Section: Score & Motivation */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            {/* Score Card */}
            <div className="glass-panel rounded-2xl p-8 flex flex-col items-center justify-center relative shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 lg:col-span-1">
              <div className={`absolute top-4 right-4 text-xs font-bold px-3 py-1 rounded-full border ${percentage >= 40
                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800"
                : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800"
                }`}>
                {percentage >= 40 ? "PASS" : "FAIL"}
              </div>
              <CircularProgress percentage={percentage} />
              <div className="text-center mt-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Accuracy Score
                </p>
              </div>
            </div>

            {/* Motivation & Summary */}
            <div className="glass-panel rounded-2xl p-8 flex flex-col justify-center shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 lg:col-span-2 relative overflow-hidden">
              <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
              <div className="relative z-10 flex flex-col h-full justify-center gap-6">
                <div>
                  <h3 className="text-5xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">
                    {correctAnswers}<span className="text-3xl text-slate-400 font-medium">/{totalQuestions}</span>
                  </h3>
                  <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg border-l-4 border-primary mt-2">
                    <span>🏆</span>
                    <p className="text-primary font-bold text-sm">
                      {percentage >= 80 ? "Excellent Performance!" : "Keep practicing to improve!"}
                    </p>
                  </div>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                  You scored <span className="font-bold text-slate-900 dark:text-white">{result.score || (correctAnswers * 1)}</span> points.
                  Review the questions below to understand your mistakes.
                </p>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <StatsCard icon="📝" label="Total" value={totalQuestions.toString()} />
            <StatsCard icon="✓" label="Correct" value={correctAnswers.toString()} color="green" />
            <StatsCard icon="✕" label="Incorrect" value={wrongAnswers.toString()} color="red" />
            <StatsCard icon="⚡" label="Attempted" value={(totalQuestions - skippedAnswers).toString()} color="blue" />
          </div>

          {/* Review Section Header & Filter */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-6 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Question Review</h3>

            <div className="flex flex-wrap gap-2">
              {['all', 'correct', 'incorrect', 'skipped'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f as any)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold capitalize transition-colors border ${filter === f
                    ? "bg-slate-800 text-white border-slate-800 dark:bg-white dark:text-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800 dark:hover:bg-slate-800"
                    }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Questions List */}
          <div className="flex flex-col gap-6 animate-fade-in" style={{ animationDelay: '0.4s' }}>
            {questions
              .map((q, idx) => {
                // Find if user answered this question
                const userAnswerEntry = result.answers?.find((a: any) => a.question === q.id)

                // Determine status and correct answer
                let status: 'correct' | 'incorrect' | 'skipped' = 'skipped'

                // If user answered
                if (userAnswerEntry) {
                  status = userAnswerEntry.is_correct ? 'correct' : 'incorrect'
                }

                // 🔥 FIND CORRECT ANSWER (Robust way)
                // q.answers contains ALL answers with is_correct flag (thanks to updated API)
                const correctOption = q.answers?.find((a: any) => a.is_correct)
                const correctText = correctOption ? correctOption.answer_text : "Unknown"

                return { ...q, userAnswerEntry, status, correctText, number: idx + 1 }
              })
              .filter(item => filter === 'all' || item.status === filter)
              .map((item) => (
                <QuestionReview
                  key={item.id}
                  number={item.number}
                  questionId={item.id}
                  question={item.question_text}
                  subject={item.subject} // 🔥 Pass Subject
                  status={item.status}
                  userAnswer={{
                    option: item.status === 'skipped' ? "Not Attempted" : "Your Answer",
                    value: item.userAnswerEntry?.selected_answer_text || "Skipped"
                  }}
                  correctAnswer={{
                    option: "Correct Answer",
                    value: item.correctText // 🔥 Show Correct Answer ALWAYS
                  }}
                  explanation={item.explanation} // Pass explanation if available
                />
              ))}

            {questions.length === 0 && (
              <div className="text-center py-10 text-slate-500">No questions found.</div>
            )}
          </div>

        </div>
      </main>
    </div>
  )
}