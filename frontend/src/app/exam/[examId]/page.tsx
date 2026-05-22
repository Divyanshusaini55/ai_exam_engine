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


// --- CATEGORY DATA (Semantic updates) ---
const categoryExams: Record<
  string,
  {
    id: string
    name: string
    description: string
    icon: string
    iconColor: string
    bgColor: string
    duration: number
    questions: number
    students: number
  }[]
> = {
  ssc: [
    {
      id: "ssc-cgl",
      name: "SSC CGL",
      description: "Combined Graduate Level exam covering General Awareness, English, and Quantitative Aptitude.",
      icon: "school",
      iconColor: "text-blue-600",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
      duration: 120,
      questions: 100,
      students: 15420,
    },
    {
      id: "ssc-gd",
      name: "SSC GD",
      description: "General Duty constable recruitment exam with focus on reasoning and general knowledge.",
      icon: "security",
      iconColor: "text-red-600",
      bgColor: "bg-red-100 dark:bg-red-900/30",
      duration: 90,
      questions: 50,
      students: 28500,
    },
    {
      id: "ssc-mts",
      name: "SSC MTS",
      description: "Multi-tasking Staff exam testing numerical ability and comprehension skills.",
      icon: "assignment",
      iconColor: "text-amber-600",
      bgColor: "bg-amber-100 dark:bg-amber-900/30",
      duration: 90,
      questions: 75,
      students: 12300,
    },
    {
      id: "ssc-chsl",
      name: "SSC CHSL",
      description: "Combined Higher Secondary Level exam for office-based positions.",
      icon: "work",
      iconColor: "text-emerald-600",
      bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
      duration: 120,
      questions: 100,
      students: 19800,
    },
  ],
  upsc: [
    {
      id: "upsc-civil",
      name: "UPSC Civil Services",
      description: "Indian Administrative Service exam covering Indian history, polity, and governance.",
      icon: "public",
      iconColor: "text-purple-600",
      bgColor: "bg-purple-100 dark:bg-purple-900/30",
      duration: 120,
      questions: 100,
      students: 8950,
    },
    {
      id: "upsc-ias",
      name: "UPSC IAS",
      description: "Indian Administrative Service - The flagship civil service examination.",
      icon: "account_balance",
      iconColor: "text-indigo-600",
      bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
      duration: 120,
      questions: 100,
      students: 12340,
    },
  ],
  railways: [
    {
      id: "rly-ntpc",
      name: "Railway NTPC",
      description: "National Test for Promotion and Career advancement in Indian Railways.",
      icon: "train",
      iconColor: "text-orange-600",
      bgColor: "bg-orange-100 dark:bg-orange-900/30",
      duration: 90,
      questions: 75,
      students: 34500,
    },
    {
      id: "rly-group-d",
      name: "Railway Group D",
      description: "Group D level exam for various operational positions in Indian Railways.",
      icon: "construction",
      iconColor: "text-primary",
      bgColor: "bg-secondary",
      duration: 90,
      questions: 100,
      students: 45000,
    },
  ],
  defence: [
    {
      id: "def-cds",
      name: "Defence CDS",
      description: "Combined Defence Services exam for commissioning officers in Army, Navy, and Air Force.",
      icon: "military_tech",
      iconColor: "text-primary",
      bgColor: "bg-secondary",
      duration: 120,
      questions: 100,
      students: 5600,
    },
    {
      id: "def-nda",
      name: "Defence NDA",
      description: "National Defence Academy exam for officer training in Armed Forces.",
      icon: "flight_takeoff",
      iconColor: "text-primary",
      bgColor: "bg-secondary",
      duration: 120,
      questions: 120,
      students: 7200,
    },
  ],
  banking: [
    {
      id: "bank-po",
      name: "Banking PO",
      description: "Probationary Officer exam testing banking knowledge and financial awareness.",
      icon: "account_balance_wallet",
      iconColor: "text-primary",
      bgColor: "bg-secondary",
      duration: 120,
      questions: 100,
      students: 22300,
    },
    {
      id: "bank-clerk",
      name: "Banking Clerk",
      description: "Clerk level exam for entry-level banking positions.",
      icon: "badge",
      iconColor: "text-primary",
      bgColor: "bg-secondary",
      duration: 60,
      questions: 100,
      students: 38900,
    },
  ],
}

const categoryInfo: Record<string, { name: string; description: string; icon: string }> = {
  ssc: { name: "SSC", description: "Staff Selection Commission Exams", icon: "school" },
  upsc: { name: "UPSC", description: "Union Public Service Commission Exams", icon: "public" },
  railways: { name: "Railways", description: "Indian Railways Recruitment Exams", icon: "train" },
  defence: { name: "Defence", description: "Defence Services Recruitment Exams", icon: "military_tech" },
  banking: { name: "Banking", description: "Banking and Financial Sector Exams", icon: "account_balance_wallet" },
}

export default function ExamPage() {
  const router = useRouter()
  const params = useParams()
  const id = (params.examId as string)?.toLowerCase()

  const isCategory = categoryExams.hasOwnProperty(id)
  const allSubCategories = Object.values(categoryExams).flat()
  const subCategory = allSubCategories.find((s) => s.id === id)
  const isSubCategory = !!subCategory

  const [exam, setExam] = useState<any>(null)
  const [shifts, setShifts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isConfirmed, setIsConfirmed] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [checkingResult, setCheckingResult] = useState(true)

  const searchParams = useSearchParams()

  useEffect(() => {
    async function checkForExistingResult() {
      if (isCategory || isSubCategory) {
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
  }, [id, isCategory, isSubCategory, router])

  useEffect(() => {
    async function fetchData() {
      if (checkingResult) return
      try {
        if (isSubCategory) {
          const res = await examApi.list({ subcategory: id })
          setShifts(res.data.results || res.data || [])
        } else if (!isCategory) {
          const res = await examApi.get(id)
          setExam(res.data)
        }
      } catch (error) {
        console.error("Failed to load data:", error)
      } finally {
        setLoading(false)
      }
    }
    if (!isCategory) fetchData()
    else setLoading(false)
  }, [id, isCategory, isSubCategory, checkingResult])

  const handleStart = () => router.replace(`/shift/${id}`)
  const handleBack = () => router.back()

  if (isCategory) {
    const exams = categoryExams[id] || []
    const category = categoryInfo[id]

    return (
      <div className="min-h-screen bg-background transition-colors duration-500">
        <header className="sticky top-0 z-50 backdrop-blur-xl bg-card/70 border-b border-border transition-all duration-300 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => router.push("/")}
                className="flex items-center gap-3 group cursor-pointer hover:opacity-80 transition-opacity"
              >
                <ArrowLeft className="size-6 text-muted-foreground group-hover:text-primary transition-colors" />
                <div className="flex flex-col">
                  <h2 className="text-xl font-bold text-primary text-left">{category?.name}</h2>
                  <p className="text-xs text-muted-foreground">{category?.description}</p>
                </div>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center py-12 px-4 md:px-8">
          <div className="w-full max-w-7xl flex flex-col gap-10">
            <div className="flex flex-col gap-4 md:gap-6 md:items-start pt-4 pb-2 animate-fade-in">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-primary">
                {exams.length} Exam Types
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground font-medium max-w-2xl">
                Choose an exam type to view available shifts.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {exams.map((exam) => {
                return (
                  <div key={exam.id} className="group card-premium flex h-full flex-col gap-5 p-6">
                    <div className="flex items-start justify-between gap-3">
                      <CategoryHomeIcon iconName="" categoryLabel={id} />
                    </div>
                    <h3 className="font-heading text-[22px] font-bold leading-tight text-primary">{exam.name}</h3>
                    <p className="flex-grow text-[15px] font-medium leading-relaxed text-muted-foreground">{exam.description}</p>
                    <div className="mt-auto border-t border-border pt-4">
                      <button
                        type="button"
                        onClick={() => router.push(`/exam/${exam.id}`)}
                        className="flex w-full items-center justify-center rounded-xl border border-border bg-background px-3 py-3 text-sm font-semibold text-primary transition-all duration-300 group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground"
                      >
                        View exams
                        <ArrowRight className="ml-2 size-5 transition-transform duration-300 group-hover:translate-x-2" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (isSubCategory) {
    const groupedShifts = shifts.reduce((acc: any, shift: any) => {
      const year = new Date(shift.created_at).getFullYear() || 'Unknown'
      if (!acc[year]) acc[year] = []
      acc[year].push(shift)
      return acc
    }, {})

    const parentSlug = getParentCategorySlugFromId(subCategory?.id || "")

    return (
      <div className="min-h-screen bg-background flex flex-col items-center py-12 px-4">
        <div className="w-full max-w-5xl">
          <button onClick={handleBack} className="flex items-center gap-2 text-muted-foreground hover:text-primary mb-8 transition-colors text-sm font-medium">
            <ArrowLeft className="size-4.5" />
            Back to Categories
          </button>

          <div className="mb-12 flex flex-col gap-6 md:flex-row md:items-center md:gap-8">
            <CategoryHomeIcon iconName={subCategory?.icon || "school"} categoryLabel={parentSlug} />
            <div>
              <h1 className="font-heading text-4xl md:text-5xl font-extrabold text-primary tracking-tight">{subCategory?.name}</h1>
              <p className="text-muted-foreground text-lg font-medium mt-1">Select a shift to start your assessment</p>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-20 text-muted-foreground font-medium">Loading available shifts...</div>
          ) : shifts.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground bg-card rounded-2xl border border-dashed border-border shadow-sm">
              <FileQuestion className="size-12 mb-4 opacity-30 mx-auto" />
              <p className="text-lg font-bold">No active shifts found for this exam type.</p>
              <p className="text-sm">Check back later or explore other categories.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-10">
              {Object.keys(groupedShifts).sort().reverse().map(year => (
                <div key={year} className="animate-fade-in">
                  <h2 className="text-2xl font-bold text-primary mb-6 flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl border border-border bg-secondary text-primary">
                      <Calendar className="size-5" />
                    </span>
                    {year}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {groupedShifts[year].map((shift: any) => (
                      <div key={shift.id} className="group card-premium flex cursor-pointer items-center justify-between p-6" onClick={() => router.push(`/shift/${shift.id}`)}>
                        <div className="flex flex-grow items-start gap-4">
                          <CategoryHomeIcon iconName="" categoryLabel={parentSlug} />
                          <div className="min-w-0 flex-grow">
                            <h3 className="mb-2 text-xl font-bold text-primary transition-colors group-hover:text-primary">{shift.title}</h3>
                            <div className="flex flex-wrap items-center gap-5 text-sm font-medium text-muted-foreground">
                              <span className="flex items-center gap-1.5">
                                <Clock className="size-4 text-primary" /> {shift.duration_minutes} min
                              </span>
                              <span className="flex items-center gap-1.5">
                                <FileQuestion className="size-4 text-primary" /> {shift.total_questions} Q
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="ml-4 shrink-0 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-premium transition-all hover:opacity-90 active:scale-95 whitespace-nowrap"
                        >
                          Start Exam
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

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
      <p className="text-muted-foreground mb-8 max-w-sm">The requested exam ID or category "{id}" does not exist in our database.</p>
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
      } catch (error) {}
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
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
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

            <button
              onClick={handleStartExam}
              disabled={!isConfirmed || isStarting}
              className="w-full py-5 px-8 rounded-2xl font-bold text-xl text-primary-foreground bg-primary hover:opacity-90 shadow-premium transition-all transform hover:-translate-y-1 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-3 group"
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
