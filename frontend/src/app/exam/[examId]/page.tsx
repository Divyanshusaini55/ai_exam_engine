"use client"
import { useNoIndex } from "@/hooks/useNoIndex"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { examApi } from "@/lib/api"


// --- CATEGORY DATA (FROM USER) ---
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
      iconColor: "text-yellow-600",
      bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
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
      iconColor: "text-red-700",
      bgColor: "bg-red-100 dark:bg-red-900/30",
      duration: 120,
      questions: 100,
      students: 5600,
    },
    {
      id: "def-nda",
      name: "Defence NDA",
      description: "National Defence Academy exam for officer training in Armed Forces.",
      icon: "flight_takeoff",
      iconColor: "text-sky-600",
      bgColor: "bg-sky-100 dark:bg-sky-900/30",
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
      iconColor: "text-green-600",
      bgColor: "bg-green-100 dark:bg-green-900/30",
      duration: 120,
      questions: 100,
      students: 22300,
    },
    {
      id: "bank-clerk",
      name: "Banking Clerk",
      description: "Clerk level exam for entry-level banking positions.",
      icon: "badge",
      iconColor: "text-lime-600",
      bgColor: "bg-lime-100 dark:bg-lime-900/30",
      duration: 60,
      questions: 100,
      students: 38900,
    },
  ],
}

const categoryInfo: Record<string, { name: string; description: string; icon: string }> = {
  ssc: {
    name: "SSC",
    description: "Staff Selection Commission Exams",
    icon: "school",
  },
  upsc: {
    name: "UPSC",
    description: "Union Public Service Commission Exams",
    icon: "public",
  },
  railways: {
    name: "Railways",
    description: "Indian Railways Recruitment Exams",
    icon: "train",
  },
  defence: {
    name: "Defence",
    description: "Defence Services Recruitment Exams",
    icon: "military_tech",
  },
  banking: {
    name: "Banking",
    description: "Banking and Financial Sector Exams",
    icon: "account_balance_wallet",
  },
}

export default function ExamPage() {
  const router = useRouter()
  const params = useParams()
  const id = (params.examId as string)?.toLowerCase()

  // 1️⃣ CHECK IF IT'S A CATEGORY (e.g. 'ssc')
  const isCategory = categoryExams.hasOwnProperty(id)

  // 2️⃣ CHECK IF IT'S A SUBCATEGORY (e.g. 'ssc-cgl')
  const allSubCategories = Object.values(categoryExams).flat()
  const subCategory = allSubCategories.find((s) => s.id === id)
  const isSubCategory = !!subCategory

  // 3️⃣ STATE
  const [exam, setExam] = useState<any>(null)
  const [shifts, setShifts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isConfirmed, setIsConfirmed] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [checkingResult, setCheckingResult] = useState(true)

  // 🛡️ Route Guard: Check if exam already completed (runs first)
  useEffect(() => {
    async function checkForExistingResult() {
      // Only check for single exam views, not categories/subcategories
      if (isCategory || isSubCategory) {
        setCheckingResult(false)
        return
      }

      try {
        // Check if THIS USER has completed this exam
        await examApi.getResults(id)
        // Result exists for this user - redirect to result page
        router.replace(`/dashboard/${id}`)
      } catch (error: any) {
        // Handle different error cases
        if (error.response?.status === 404) {
          // No result for this user - allow access to instructions
          setCheckingResult(false)
        } else if (error.response?.status === 401) {
          // Not authenticated - allow (user can still view instructions)
          setCheckingResult(false)
        } else {
          // Other error - fail open and allow access
          console.warn('Error checking exam status:', error)
          setCheckingResult(false)
        }
      }
    }
    checkForExistingResult()
  }, [id, isCategory, isSubCategory, router])

  // Fetch exam data (runs after route guard check)
  useEffect(() => {
    async function fetchData() {
      // Don't fetch if still checking for result
      if (checkingResult) return

      try {
        if (isSubCategory) {
          // Fetch all exams for this subcategory (Shifts)
          const res = await examApi.list({ subcategory: id })
          setShifts(res.data.results || res.data || [])
        } else if (!isCategory) {
          // Fetch single exam details
          const res = await examApi.get(id)
          setExam(res.data)
        }
      } catch (error) {
        console.error("Failed to load data:", error)
      } finally {
        setLoading(false)
      }
    }

    if (!isCategory) {
      fetchData()
    } else {
      setLoading(false)
    }
  }, [id, isCategory, isSubCategory, checkingResult])

  const handleStart = () => {
    // Replace history instead of push to prevent back navigation
    router.replace(`/shift/${id}`)
  }

  const handleBack = () => {
    router.back()
  }

  // ------------------------------------------
  // RENDER: CATEGORY VIEW (List of Exam Types)
  // ------------------------------------------
  if (isCategory) {
    const exams = categoryExams[id] || []
    const category = categoryInfo[id]

    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950 transition-colors duration-500">
        <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/50 dark:border-slate-800/50 transition-all duration-300">
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => router.push("/")}
                className="flex items-center gap-3 group cursor-pointer hover:opacity-80 transition-opacity"
              >
                <span className="material-symbols-outlined text-2xl text-slate-600 dark:text-slate-300 group-hover:text-primary transition-colors">
                  arrow_back
                </span>
                <div className="flex flex-col">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white text-left">{category?.name}</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{category?.description}</p>
                </div>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center py-12 px-4 md:px-8">
          <div className="w-full max-w-7xl flex flex-col gap-10">
            <div className="flex flex-col gap-4 md:gap-6 md:items-start pt-4 pb-2 animate-fade-in">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white text-balance">
                {exams.length} Exam Types
              </h1>
              <p className="text-lg md:text-xl text-slate-500 dark:text-slate-400 font-medium max-w-2xl">
                Choose an exam type to view available shifts.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-max">
              {exams.map((exam, idx) => (
                <div key={exam.id} className="group relative bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-lg transition-all duration-300">
                  <div className="flex justify-between items-start mb-4">
                    <div className={`size-12 rounded-xl ${exam.bgColor} flex items-center justify-center`}>
                      <span className={`material-symbols-outlined text-[28px] ${exam.iconColor}`}>{exam.icon}</span>
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{exam.name}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{exam.description}</p>
                  <button
                    onClick={() => router.push(`/exam/${exam.id}`)}
                    className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-all"
                  >
                    View Exams
                  </button>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    )
  }

  // ------------------------------------------
  // RENDER: SUB-CATEGORY VIEW (Shifts List)
  // ------------------------------------------
  if (isSubCategory) {
    // Generate Year Groups
    const groupedShifts = shifts.reduce((acc: any, shift: any) => {
      const year = new Date(shift.created_at).getFullYear() || 'Unknown'
      if (!acc[year]) acc[year] = []
      acc[year].push(shift)
      return acc
    }, {})

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center py-12 px-4">
        <div className="w-full max-w-5xl">
          <button onClick={handleBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:hover:text-white mb-8 transition-colors">
            ← Back to Categories
          </button>

          <div className="mb-10">
            <div className="flex items-center gap-4 mb-2">
              <div className={`size-16 rounded-2xl ${subCategory?.bgColor} flex items-center justify-center`}>
                <span className={`material-symbols-outlined text-4xl ${subCategory?.iconColor}`}>{subCategory?.icon}</span>
              </div>
              <div>
                <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white">{subCategory?.name}</h1>
                <p className="text-slate-500 text-lg">Select a shift to start your assessment</p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-20 text-slate-500">Loading available shifts...</div>
          ) : shifts.length === 0 ? (
            <div className="text-center py-20 text-slate-500 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300">
              No active shifts found for this exam type. <br /> Check back later!
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              {Object.keys(groupedShifts).sort().reverse().map(year => (
                <div key={year} className="animate-fade-in">
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-slate-400">calendar_today</span>
                    {year}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {groupedShifts[year].map((shift: any) => (
                      <div key={shift.id} className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-blue-500 transition-all flex justify-between items-center group">
                        <div>
                          <h3 className="font-bold text-lg text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">{shift.title}</h3>
                          <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                            <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">schedule</span> {shift.duration_minutes} min</span>
                            <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">quiz</span> {shift.total_questions} Q</span>
                          </div>
                        </div>
                        <button
                          onClick={() => router.push(`/shift/${shift.id}`)}
                          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-md shadow-blue-500/20 transition-all active:scale-95"
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

  // ------------------------------------------
  // RENDER: SINGLE EXAM VIEW (Classic/Fallback)
  // ------------------------------------------
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading Exam Details...</div>

  if (!exam) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h2 className="text-xl font-bold">Exam Not Found</h2>
      <p className="text-slate-500">The requested exam ID or category "{id}" does not exist.</p>
      {/* Show API URL for debugging */}
      <p className="text-xs text-slate-400 font-mono bg-slate-100 p-2 rounded">
        API: {process.env.NEXT_PUBLIC_API_BASE_URL || 'Using Default (Prod)'}
      </p>
      <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Try Reloading</button>
      <button onClick={() => router.push('/')} className="text-blue-500 underline">Back to Home</button>
    </div>
  )


  const handleStartExam = async () => {
    if (!isConfirmed) return
    setIsStarting(true)

    try {
      // 🛡️ Route Guard: Check if exam already completed
      try {
        await examApi.getResults(id)
        // If result exists, redirect to result page instead
        router.replace(`/dashboard/${id}`)
        return
      } catch (error) {
        // No result found, proceed with exam
      }

      // Small delay for loading animation
      await new Promise(resolve => setTimeout(resolve, 500))
      handleStart()
    } catch (error) {
      console.error("Failed to start exam:", error)
      setIsStarting(false)
    }
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 flex flex-col items-center justify-center py-8 px-4">
      {/* Main Card - Max 900px, Centered */}
      <div className="w-full max-w-[900px] bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 overflow-hidden opacity-0 translate-y-8 transition-all duration-500 ease-out animate-in">

        {/* Header Section - Sticky */}
        <div className="sticky top-0 z-10 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border-b border-gray-100 dark:border-slate-700 px-6 sm:px-8 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Back Button */}
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors text-sm font-medium"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Back to Exams
            </button>

            {/* Center Title */}
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate max-w-md">
              {exam.title}
            </h1>

            {/* Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-bold whitespace-nowrap">
              <span className="material-symbols-outlined text-[16px]">quiz</span>
              CBT Exam
            </div>
          </div>
        </div>

        {/* Exam Summary Stats */}
        <div className="px-6 sm:px-8 pt-8 pb-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Duration */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-900/10 rounded-xl p-4 border border-blue-200 dark:border-blue-800 hover:shadow-md transition-all duration-300 hover:-translate-y-1">
              <div className="flex flex-col items-center text-center gap-2">
                <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[32px]">schedule</span>
                <div className="font-bold text-2xl text-slate-900 dark:text-white">{exam.duration_minutes}</div>
                <div className="text-xs text-slate-600 dark:text-slate-400 font-medium uppercase tracking-wide">Minutes</div>
              </div>
            </div>

            {/* Questions */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-900/10 rounded-xl p-4 border border-purple-200 dark:border-purple-800 hover:shadow-md transition-all duration-300 hover:-translate-y-1">
              <div className="flex flex-col items-center text-center gap-2">
                <span className="material-symbols-outlined text-purple-600 dark:text-purple-400 text-[32px]">quiz</span>
                <div className="font-bold text-2xl text-slate-900 dark:text-white">{exam.total_questions}</div>
                <div className="text-xs text-slate-600 dark:text-slate-400 font-medium uppercase tracking-wide">Questions</div>
              </div>
            </div>

            {/* Marks */}
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-900/20 dark:to-emerald-900/10 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800 hover:shadow-md transition-all duration-300 hover:-translate-y-1">
              <div className="flex flex-col items-center text-center gap-2">
                <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[32px]">grade</span>
                <div className="font-bold text-2xl text-slate-900 dark:text-white">{exam.marks_per_question ?? 1}</div>
                <div className="text-xs text-slate-600 dark:text-slate-400 font-medium uppercase tracking-wide">Mark/Ques</div>
              </div>
            </div>

            {/* Total Marks */}
            <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-900/10 rounded-xl p-4 border border-amber-200 dark:border-amber-800 hover:shadow-md transition-all duration-300 hover:-translate-y-1">
              <div className="flex flex-col items-center text-center gap-2">
                <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-[32px]">emoji_events</span>
                <div className="font-bold text-2xl text-slate-900 dark:text-white">{exam.total_marks ?? (exam.total_questions * (exam.marks_per_question ?? 1))}</div>
                <div className="text-xs text-slate-600 dark:text-slate-400 font-medium uppercase tracking-wide">Total Marks</div>
              </div>
            </div>
          </div>
        </div>

        {/* Instructions Section */}
        <div className="px-6 sm:px-8 pb-8">
          {/* Info Banner */}
          <div className="mb-6 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 flex items-start gap-3">
            <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[20px] flex-shrink-0">info</span>
            <p className="text-sm text-blue-800 dark:text-blue-300 font-medium">
              Please read all instructions carefully before starting the exam
            </p>
          </div>

          {/* Instructions Title */}
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">description</span>
            Important Instructions
          </h2>

          {/* Instructions List */}
          <div className="space-y-3 mb-6">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
              <span className="material-symbols-outlined text-green-600 dark:text-green-400 text-[20px] flex-shrink-0">check_circle</span>
              <span className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                The exam will <strong>auto-submit</strong> when the timer reaches zero
              </span>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
              <span className="material-symbols-outlined text-green-600 dark:text-green-400 text-[20px] flex-shrink-0">check_circle</span>
              <span className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                Use the <strong>question navigator</strong> or Next/Previous buttons to move between questions
              </span>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
              <span className="material-symbols-outlined text-green-600 dark:text-green-400 text-[20px] flex-shrink-0">check_circle</span>
              <span className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                <strong>Do not refresh</strong> the page or close the browser during the exam
              </span>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
              <span className="material-symbols-outlined text-green-600 dark:text-green-400 text-[20px] flex-shrink-0">check_circle</span>
              <span className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                <strong>Results & detailed analysis</strong> will be available immediately after submission
              </span>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
              <span className="material-symbols-outlined text-green-600 dark:text-green-400 text-[20px] flex-shrink-0">check_circle</span>
              <span className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                You can mark questions for <strong>review later</strong> and return to them before final submission
              </span>
            </div>
          </div>

          {/* Confirmation Checkbox */}
          <div className="mb-6 p-4 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/30">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={isConfirmed}
                onChange={(e) => setIsConfirmed(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-slate-300 text-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors select-none">
                I have read and understood all the instructions mentioned above and I'm ready to start the exam
              </span>
            </label>
          </div>

          {/* Primary CTA Button */}
          <button
            onClick={handleStartExam}
            disabled={!isConfirmed || isStarting}
            className="w-full py-4 px-6 rounded-xl font-bold text-lg text-white bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-all duration-300 transform hover:-translate-y-1 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-lg flex items-center justify-center gap-2 group"
          >
            {isStarting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Starting...</span>
              </>
            ) : (
              <>
                <span>Start Test Now</span>
                <span className="material-symbols-outlined text-[24px] transition-transform duration-300 group-hover:translate-x-1">
                  arrow_forward
                </span>
              </>
            )}
          </button>

          {/* Helper Text */}
          {!isConfirmed && (
            <p className="text-center text-xs text-amber-600 dark:text-amber-400 mt-3 flex items-center justify-center gap-1">
              <span className="material-symbols-outlined text-[16px]">info</span>
              Please confirm that you've read the instructions to continue
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
