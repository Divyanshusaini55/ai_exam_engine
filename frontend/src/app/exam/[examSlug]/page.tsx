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
  Award,
  Trophy,
  FileText,
  Timer,
  Navigation,
  RefreshCw,
  BarChart3,
  ShieldCheck,
  AlertCircle,
  Info,
} from "lucide-react"
import { CategoryHomeIcon } from "@/components/category-home-icon"
import { getParentCategorySlugFromId } from "@/lib/category-home-icons"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function ExamPage() {
  const router = useRouter()
  const params = useParams()
  const slug = (params.examSlug as string)?.toLowerCase()

  const [exam, setExam] = useState<any>(null)
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
        await examApi.getResults(slug)
        const q = searchParams.get('q')
        if (q) {
          router.replace(`/dashboard/${slug}?q=${q}`)
        } else {
          router.replace(`/dashboard/${slug}`)
        }
      } catch (error: any) {
        setCheckingResult(false)
      }
    }
    checkForExistingResult()
  }, [slug, router, searchParams])

  useEffect(() => {
    async function fetchData() {
      if (checkingResult) return
      try {
        const res = await examApi.get(slug)
        setExam(res.data)
      } catch (error) {
        console.error("Failed to load exam data:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [slug, checkingResult])

  const handleStart = () => router.replace(`/shift/${slug}`)
  const handleBack = () => router.back()

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
      <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-muted-foreground text-xs font-medium">Loading Assessment Details...</p>
    </div>
  )

  if (!exam) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
      <div className="size-12 bg-muted rounded-full flex items-center justify-center mb-4 text-muted-foreground">
        <AlertCircle className="size-6" />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-1">Exam Not Found</h2>
      <p className="text-xs text-muted-foreground mb-6 max-w-xs">The requested exam &ldquo;{slug}&rdquo; does not exist in our database.</p>
      <div className="flex flex-row gap-3">
        <Button size="sm" onClick={() => window.location.reload()}>Try Reloading</Button>
        <Button size="sm" variant="outline" onClick={() => router.push('/')}>Back to Home</Button>
      </div>
    </div>
  )

  const handleStartExam = async () => {
    if (!isConfirmed) return
    setIsStarting(true)
    try {
      try {
        await examApi.getResults(slug)
        router.replace(`/dashboard/${slug}`)
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
    <div className="min-h-screen bg-background flex flex-col pb-16">
      <div className="w-full">
        <Navbar />
      </div>

      <div className="w-full max-w-3xl mx-auto flex flex-col gap-6 animate-fade-in px-4 py-8 md:py-10">

        {/* Top Navigation & Status */}
        <div className="flex items-center justify-between gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="text-muted-foreground hover:text-foreground gap-2 font-medium text-xs h-8 px-2.5"
          >
            <ArrowLeft className="size-3.5" />
            Back to Exams
          </Button>

          <Badge variant="outline" className="rounded-full px-3 py-1 font-medium text-[11px] gap-1.5 border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 dark:border-emerald-500/30">
            <ShieldCheck className="size-3.5 text-emerald-500" />
            Official Assessment
          </Badge>
        </div>

        {/* Exam Overview Card */}
        <Card className="border border-border/70 bg-card shadow-sm rounded-xl p-6 sm:p-8">
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
              <CategoryHomeIcon iconName="" categoryLabel={examCategoryLabel} />
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                  {exam.title}
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5 font-normal">
                  Standardized Timed Assessment
                </p>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 pt-2">
              <div className="bg-muted/40 border border-border/60 rounded-lg p-3 flex flex-col items-center justify-center text-center gap-1">
                <Clock className="size-4 text-sky-500 mb-0.5" />
                <span className="font-bold text-base text-foreground leading-none">{exam.duration_minutes}</span>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Minutes</span>
              </div>

              <div className="bg-muted/40 border border-border/60 rounded-lg p-3 flex flex-col items-center justify-center text-center gap-1">
                <FileQuestion className="size-4 text-violet-500 mb-0.5" />
                <span className="font-bold text-base text-foreground leading-none">{exam.total_questions}</span>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Questions</span>
              </div>

              <div className="bg-muted/40 border border-border/60 rounded-lg p-3 flex flex-col items-center justify-center text-center gap-1">
                <Award className="size-4 text-emerald-500 mb-0.5" />
                <span className="font-bold text-base text-foreground leading-none">+{exam.marks_per_question ?? 1}</span>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Mark / Q</span>
              </div>

              <div className="bg-muted/40 border border-border/60 rounded-lg p-3 flex flex-col items-center justify-center text-center gap-1">
                <AlertCircle className="size-4 text-rose-500 mb-0.5" />
                <span className="font-bold text-base text-foreground leading-none">-{exam.negative_marks ?? 0}</span>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Negative</span>
              </div>

              <div className="bg-muted/40 border border-border/60 rounded-lg p-3 flex flex-col items-center justify-center text-center gap-1 col-span-2 sm:col-span-1">
                <Trophy className="size-4 text-amber-500 mb-0.5" />
                <span className="font-bold text-base text-foreground leading-none">{exam.total_marks ?? (exam.total_questions * (exam.marks_per_question ?? 1))}</span>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Total Marks</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Instructions Card */}
        <Card className="border border-border/70 bg-card shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="border-b border-border/50 bg-muted/20 px-6 py-4">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              Exam Instructions
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Please review the general guidelines before launching your test.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { Icon: Timer, text: "Exam will auto-submit when timer reaches zero", color: "text-sky-500" },
                { Icon: Navigation, text: "Use question navigator to jump between sections", color: "text-violet-500" },
                { Icon: RefreshCw, text: "Do not refresh or close browser during the test", color: "text-amber-500" },
                { Icon: BarChart3, text: "Detailed AI analysis will be provided upon completion", color: "text-emerald-500" },
              ].map((item, i) => {
                const ItemIcon = item.Icon
                return (
                  <div key={i} className="flex items-start gap-3 p-3.5 rounded-lg border border-border/50 bg-muted/20 text-xs sm:text-sm text-foreground/90 font-normal leading-snug transition-colors hover:bg-muted/30">
                    <ItemIcon className={`size-4 shrink-0 mt-0.5 ${item.color}`} />
                    <span>{item.text}</span>
                  </div>
                )
              })}
            </div>

            {/* Confirmation Checkbox */}
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4 transition-colors hover:bg-muted/40">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={isConfirmed}
                  onChange={(e) => setIsConfirmed(e.target.checked)}
                  className="mt-0.5 size-4 rounded border-input bg-background text-primary focus:ring-1 focus:ring-ring cursor-pointer accent-primary shrink-0"
                />
                <span className="text-xs sm:text-sm text-foreground/90 select-none leading-relaxed font-normal">
                  I have read and understood all the instructions above. I confirm that I will not use any unfair means during this assessment.
                </span>
              </label>
            </div>

            {/* Start Button & Helper */}
            <div className="flex flex-col items-center gap-2 pt-2">
              <Button
                onClick={handleStartExam}
                disabled={!isConfirmed || isStarting}
                size="lg"
                className="w-full sm:w-auto min-w-[260px] h-11 px-8 rounded-lg font-semibold text-sm shadow-sm transition-all flex items-center justify-center gap-2"
              >
                {isStarting ? (
                  <>
                    <div className="size-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    <span>Preparing Test...</span>
                  </>
                ) : (
                  <>
                    <span>Start Assessment Now</span>
                    <ArrowRight className="size-4 ml-0.5" />
                  </>
                )}
              </Button>

              {!isConfirmed && (
                <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5 mt-1">
                  <Info className="size-3.5 text-amber-500/90" />
                  Please confirm the instructions above to unlock the start button.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}

