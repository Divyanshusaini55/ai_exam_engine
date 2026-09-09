"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/context/auth-context"
import { CircularProgress } from "@/components/circular-progress"
import { StatsCard } from "@/components/stats-card"
import { QuestionReview } from "@/components/question-review"
import { examApi } from "@/lib/api"
import { 
    ArrowLeft, 
    CircleUserRound, 
    LayoutDashboard, 
    BarChart3, 
    RotateCcw, 
    FileText, 
    CheckCircle2, 
    XCircle, 
    Zap,
    GraduationCap,
    Clock,
    Calendar
} from "lucide-react"

interface PerformanceAnalysisDashboardProps {
  examId: string
  onRetake?: () => void
}

export function PerformanceAnalysisDashboard({ examId, onRetake }: PerformanceAnalysisDashboardProps) {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [result, setResult] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'correct' | 'incorrect' | 'skipped'>('all')

  const qParam = searchParams?.get('q');
  const sessionIdParam = searchParams?.get('session_id');

  useEffect(() => {
    async function fetchData() {
      try {
        // 🔥 Now getResults returns everything we need including full questions with answers!
        const resResults = await examApi.getResults(examId, sessionIdParam)
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
  }, [examId, sessionIdParam])

  useEffect(() => {
    if (!loading && qParam && questions.length > 0) {
      // Find the question id and scroll to it
      const element = document.getElementById(`question-${qParam}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Highlight it briefly
        element.style.transition = 'background-color 0.5s ease';
        element.style.backgroundColor = 'rgba(var(--primary), 0.1)';
        const timer = setTimeout(() => {
          element.style.backgroundColor = '';
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, qParam, questions]);

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

  const handleGoToSummary = () => {
    router.push(`/summary/${examId}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background  gap-4">
        <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-muted-foreground font-medium">Calculating Performance...</p>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background  gap-4">
        <h2 className="text-xl font-bold text-primary">Result not found</h2>
        <button
          onClick={handleBackToHome}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-colors font-bold"
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
    <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden bg-background ">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 bg-card border-b border-border shadow-sm transition-colors duration-300">
        <div className="px-4 md:px-10 py-3 flex items-center justify-between">
          <button onClick={handleBackToHome} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
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
            <span className="text-primary font-medium text-sm border-b-2 border-primary pb-0.5">Analysis</span>
          </nav>

          <div className="flex items-center gap-4">
            <button className="group relative size-10 rounded-full border border-border p-[3px] shadow-sm hover:shadow-premium transition-all duration-300 hover:-translate-y-[2px]">
              <div className="flex h-full w-full items-center justify-center rounded-full bg-secondary">
                {user ? (
                  <span className="text-sm font-bold text-primary transition-transform duration-300 group-hover:scale-110">
                    {user.username[0].toUpperCase()}
                  </span>
                ) : (
                  <CircleUserRound className="size-5 text-muted-foreground transition-transform duration-300 group-hover:scale-110" />
                )}
              </div>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center py-8 px-4 md:px-8">
        <div className="w-full max-w-6xl flex flex-col gap-8">

          {/* Page Heading & Meta */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 animate-fade-in">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1 flex-wrap">
                <button onClick={handleBackToHome} className="hover:text-primary transition-colors">
                  Exams
                </button>
                <span>›</span>
                <span>Result</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-primary">
                {result.exam_title || "Exam Result"}
              </h1>
              <p className="text-muted-foreground text-sm font-medium flex items-center gap-2">
                <Calendar className="size-4" /> Completed on {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleGoToDashboard}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-secondary border border-border hover:bg-background text-primary transition-all text-sm font-bold active:scale-95"
              >
                <LayoutDashboard className="size-4.5" /> Dashboard
              </button>
              <button
                onClick={handleGoToAnalysis}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-secondary border border-border hover:bg-background text-primary transition-all text-sm font-bold active:scale-95"
              >
                <BarChart3 className="size-4.5" /> View Analysis
              </button>
              <button
                onClick={handleGoToSummary}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-secondary border border-border hover:bg-background text-primary transition-all text-sm font-bold active:scale-95"
              >
                <FileText className="size-4.5" /> View Question Paper Summary
              </button>
              <button
                onClick={onRetake}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:opacity-90 text-primary-foreground transition-all text-sm font-bold shadow-premium active:scale-95"
              >
                <RotateCcw className="size-4.5" /> Retake Exam
              </button>
            </div>
          </div>

          {/* Hero Section: Score & Motivation */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            {/* Score Card */}
            <div className="glass-panel rounded-2xl p-8 flex flex-col items-center justify-center relative shadow-sm border border-border bg-card lg:col-span-1">
              <div className={`absolute top-4 right-4 text-xs font-bold px-3 py-1 rounded-full border ${
                percentage >= 40
                  ? "bg-success/10 text-success border-success/30"
                  : "bg-destructive/10 text-destructive border-destructive/30"
              }`}>
                {percentage >= 40 ? "PASS" : "FAIL"}
              </div>
              <CircularProgress percentage={percentage} />
              <div className="text-center mt-4">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Accuracy Score
                </p>
              </div>
            </div>

            {/* Motivation & Summary */}
            <div className="glass-panel rounded-2xl p-8 flex flex-col justify-center shadow-sm border border-border bg-card lg:col-span-2 relative overflow-hidden">
              <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
              <div className="relative z-10 flex flex-col h-full justify-center gap-6">
                <div>
                  <h3 className="text-5xl font-extrabold text-primary mb-2 tracking-tight">
                    {correctAnswers}<span className="text-3xl text-muted-foreground font-medium">/{totalQuestions}</span>
                  </h3>
                  <div className="inline-flex items-center gap-2 bg-secondary px-4 py-2 rounded-lg border-l-4 border-primary mt-2">
                    <Trophy className="size-5 text-primary" />
                    <p className="text-primary font-bold text-sm">
                      {percentage >= 80 ? "Excellent Performance!" : "Keep practicing to improve!"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-4 mt-2">
                  <div className="flex items-center gap-3 bg-secondary/30 w-fit px-5 py-3 rounded-xl border border-border">
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Final Marks</span>
                      <span className="text-2xl font-black text-primary ml-2">{result.total_marks ?? result.score ?? (correctAnswers * 1)}</span>
                    </div>
                    {result.penalty > 0 && (
                      <div className="flex items-center ml-2 border-l pl-4 border-border/50">
                        <span className="text-xs font-semibold text-destructive bg-destructive/10 px-2 py-1 rounded-md">
                          -{result.penalty} Penalty
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-muted-foreground leading-relaxed max-w-xl text-sm">
                    Review the questions below to understand your mistakes.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <StatsCard icon={FileText} label="Total" value={totalQuestions.toString()} />
            <StatsCard icon={CheckCircle2} label="Correct" value={correctAnswers.toString()} color="green" />
            <StatsCard icon={XCircle} label="Incorrect" value={wrongAnswers.toString()} color="red" />
            <StatsCard icon={Zap} label="Attempted" value={(totalQuestions - skippedAnswers).toString()} color="blue" />
          </div>

          {/* Review Section Header & Filter */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-6 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <h3 className="text-xl font-bold text-primary">Question Review</h3>

            <div className="flex flex-wrap gap-2">
              {['all', 'correct', 'incorrect', 'skipped'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f as any)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold capitalize transition-all border ${
                    filter === f
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border hover:bg-secondary"
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
                let status: 'correct' | 'incorrect' | 'skipped' | 'pending' = 'skipped'

                // If user answered
                if (userAnswerEntry) {
                  if (userAnswerEntry.is_correct === true) {
                    status = 'correct'
                  } else if (userAnswerEntry.is_correct === null || userAnswerEntry.is_correct === undefined) {
                    status = (q.question_type === 'subjective') ? 'pending' : 'incorrect'
                  } else {
                    status = 'incorrect'
                  }
                }

                // Correct answer resolution
                const correctOption = q.answers?.filter((a: any) => a.is_correct)
                const correctText = userAnswerEntry?.correct_answer_text || 
                  (correctOption && correctOption.length > 0 ? correctOption.map((a: any) => a.answer_text).join(", ") : "Standard Reference")

                return { ...q, userAnswerEntry, status, correctText, number: idx + 1 }
              })
              .filter(item => filter === 'all' || item.status === filter)
              .map((item) => (
                <QuestionReview
                  key={item.id}
                  number={item.number}
                  questionId={item.id}
                  question={item.question_text}
                  subject={item.subject}
                  status={item.status}
                  userAnswer={{
                    option: item.status === 'skipped' ? "Not Attempted" : "Your Answer",
                    value: item.userAnswerEntry?.selected_answer_text || "Skipped"
                  }}
                  correctAnswer={{
                    option: "Correct Answer",
                    value: item.correctText
                  }}
                  explanation={item.userAnswerEntry?.explanation || item.explanation}
                />
              ))}

            {questions.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">No questions found.</div>
            )}
          </div>

        </div>
      </main>
    </div>
  )
}

// Missing import Trophy
import { Trophy } from "lucide-react"