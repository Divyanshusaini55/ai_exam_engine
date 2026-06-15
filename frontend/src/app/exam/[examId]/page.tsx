"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import { examApi } from "@/lib/api"
import { Navbar } from "@/components/navbar"
import {
  ArrowLeft,
  ArrowRight,
  FileQuestion,
  Clock,
  Calendar,
  Award,
  Trophy,
  FileText,
  Timer,
  Navigation,
  RefreshCw,
  BarChart3,
  AlertTriangle,
  ShieldCheck,
  AlertCircle,
} from "lucide-react"
import { CategoryHomeIcon } from "@/components/category-home-icon"
import { getParentCategorySlugFromId } from "@/lib/category-home-icons"


// Cleaned up legacy category routing data

export default function ExamPage() {
  const router = useRouter()
  const params = useParams()
  const id = (params.examId as string)?.toLowerCase()

  const [exam, setExam] = useState<any>(null)
  const [shifts, setShifts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isConfirmed, setIsConfirmed] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [checkingResult, setCheckingResult] = useState(true)

  const searchParams = useSearchParams()

  useEffect(() => {
    async function checkForExistingResult() {
      const isReviewing = searchParams.get('review') === 'true'
      if (isReviewing) {
        setCheckingResult(false)
        return
      }

      try {
        await examApi.getResults(id)
        const q = searchParams.get('q')
        if (q) {
          router.replace(`/dashboard/${id}?q=${q}`)
        } else {
          router.replace(`/dashboard/${id}`)
        }
      } catch (error: any) {
        setCheckingResult(false)
      }
    }
    checkForExistingResult()
  }, [id, router, searchParams])

  useEffect(() => {
    async function fetchData() {
      if (checkingResult) return
      try {
        const res = await examApi.get(id)
        setExam(res.data)
      } catch (error) {
        console.error("Failed to load exam data:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id, checkingResult])

  const handleStart = () => router.replace(`/shift/${id}`)
  const handleBack = () => router.back()



  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
      <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-muted-foreground font-medium">Loading Exam Details...</p>
    </div>
  )

  if (!exam) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
      <div className="size-20 bg-secondary rounded-full flex items-center justify-center mb-6 text-muted-foreground">
        <AlertCircle className="size-10" />
      </div>
      <h2 className="text-2xl font-bold text-primary mb-2">Exam Not Found</h2>
      <p className="text-muted-foreground mb-8 max-w-sm">The requested exam ID or category &ldquo;{id}&rdquo; does not exist in our database.</p>
      <div className="flex flex-col sm:flex-row gap-4">
        <button onClick={() => window.location.reload()} className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-bold shadow-premium transition-all active:scale-95">Try Reloading</button>
        <button onClick={() => router.push('/')} className="px-8 py-3 bg-secondary text-primary rounded-xl font-bold border border-border transition-all active:scale-95">Back to Home</button>
      </div>
    </div>
  )

  const handleStartExam = async () => {
    if (!isConfirmed) return
    setIsStarting(true)
    try {
      try {
        await examApi.getResults(id)
        router.replace(`/dashboard/${id}`)
        return
      } catch (error) { }
      await new Promise(resolve => setTimeout(resolve, 500))
      handleStart()
    } catch (error) {
      console.error("Failed to start exam:", error)
      setIsStarting(false)
    }
  }

  const examCategoryLabel =
    (exam?.category_slug as string | undefined) ||
    (exam?.category as string | undefined) ||
    getParentCategorySlugFromId(String(exam?.id ?? ""))

  return (
    <div className="min-h-screen bg-background flex flex-col pb-12">
      <div className="w-full">
        <Navbar />
      </div>
      <div className="w-full max-w-4xl mx-auto flex flex-col gap-8 animate-fade-in px-4 py-12">

        {/* Navigation */}
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors text-sm font-bold"
          >
            <ArrowLeft className="size-4.5" />
            Back to Exams
          </button>

          <div className="px-4 py-1.5 rounded-full bg-secondary border border-border text-primary text-xs font-bold uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="size-4 text-success" />
            Official Assessment
          </div>
        </div>

        {/* Hero Section */}
        <div className="card-premium p-8 md:p-12 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32 transition-transform group-hover:scale-110 duration-700" />

          <div className="relative z-10">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
                <CategoryHomeIcon iconName="" categoryLabel={examCategoryLabel} />
                <h1 className="text-4xl md:text-5xl font-extrabold text-primary tracking-tight text-balance leading-[1.1] flex-1">
                  {exam.title}
                </h1>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-4">
                <div className="bg-background/50 backdrop-blur-sm p-4 rounded-2xl border border-border flex flex-col items-center text-center gap-1 transition-all hover:bg-background">
                  <Clock className="text-primary mb-1 size-8" />
                  <div className="font-bold text-xl text-primary">{exam.duration_minutes}</div>
                  <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Minutes</div>
                </div>

                <div className="bg-background/50 backdrop-blur-sm p-4 rounded-2xl border border-border flex flex-col items-center text-center gap-1 transition-all hover:bg-background">
                  <FileQuestion className="text-primary mb-1 size-8" />
                  <div className="font-bold text-xl text-primary">{exam.total_questions}</div>
                  <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Questions</div>
                </div>

                <div className="bg-background/50 backdrop-blur-sm p-4 rounded-2xl border border-border flex flex-col items-center text-center gap-1 transition-all hover:bg-background">
                  <Award className="text-success mb-1 size-8" />
                  <div className="font-bold text-xl text-primary">{exam.marks_per_question ?? 1}</div>
                  <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Mark/Q</div>
                </div>

                <div className="bg-background/50 backdrop-blur-sm p-4 rounded-2xl border border-border flex flex-col items-center text-center gap-1 transition-all hover:bg-background">
                  <AlertCircle className="text-destructive mb-1 size-8" />
                  <div className="font-bold text-xl text-primary">-{exam.negative_marks ?? 0}</div>
                  <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Negative Marks</div>
                </div>

                <div className="bg-background/50 backdrop-blur-sm p-4 rounded-2xl border border-border flex flex-col items-center text-center gap-1 transition-all hover:bg-background">
                  <Trophy className="text-primary mb-1 size-8" />
                  <div className="font-bold text-xl text-primary">{exam.total_marks ?? (exam.total_questions * (exam.marks_per_question ?? 1))}</div>
                  <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Total Marks</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="card-premium p-8 md:p-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="size-10 rounded-xl bg-secondary flex items-center justify-center border border-border shadow-sm">
              <FileText className="size-6 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-primary tracking-tight">Exam Instructions</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
            {[
              { Icon: Timer, text: "Exam will auto-submit when the timer reaches zero" },
              { Icon: Navigation, text: "Use question navigator to jump between sections" },
              { Icon: RefreshCw, text: "Do not refresh or close browser during the test" },
              { Icon: BarChart3, text: "Get detailed AI analysis instantly after submission" },
            ].map((item, i) => {
              const ItemIcon = item.Icon
              return (
                <div key={i} className="flex items-start gap-4 p-4 rounded-2xl bg-secondary/50 border border-border hover:bg-secondary transition-colors">
                  <ItemIcon className="mt-0.5 size-5 shrink-0 text-green-600 dark:text-green-500" />
                  <span className="text-sm font-medium text-primary leading-relaxed">{item.text}</span>
                </div>
              )
            })}
          </div>

          {/* Confirmation & Start */}
          <div className="space-y-6">
            <div className="p-5 rounded-2xl border-2 border-dashed border-border bg-background/50 hover:bg-secondary/30 transition-all">
              <label className="flex items-start gap-4 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={isConfirmed}
                  onChange={(e) => setIsConfirmed(e.target.checked)}
                  className="mt-1 w-6 h-6 rounded-lg border-border text-primary focus:ring-primary/20 cursor-pointer"
                />
                <span className="text-sm font-medium text-primary select-none leading-relaxed">
                  I have read and understood all the instructions mentioned above. I confirm that I will not use any unfair means during this assessment.
                </span>
              </label>
            </div>

            <div className="flex justify-center w-full">
              <button
                onClick={handleStartExam}
                disabled={!isConfirmed || isStarting}
                className="py-2 px-8 rounded-2xl font-bold text-xl text-primary-foreground bg-primary hover:opacity-90 shadow-premium transition-all transform hover:-translate-y-1 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-3 group"
              >
                {isStarting ? (
                  <>
                    <div className="size-6 border-3 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    <span>Preparing Test...</span>
                  </>
                ) : (
                  <>
                    <span>Start Assessment Now</span>
                    <ArrowRight className="size-7 transition-transform duration-300 group-hover:translate-x-2" />
                  </>
                )}
              </button>
            </div>

            {!isConfirmed && (
              <p className="text-center text-xs font-bold text-destructive animate-pulse flex items-center justify-center gap-2">
                <AlertTriangle className="size-4" />
                Please accept the terms to unlock the start button
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
