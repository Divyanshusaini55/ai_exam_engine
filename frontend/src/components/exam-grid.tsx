"use client"

import { useState, useMemo, useEffect } from "react"
import { ExamCard } from "@/components/exam-card"
import { examApi } from "@/lib/api"

// Interface matching your Django Serializer
interface Exam {
  id: number
  title: string
  description: string
  duration_minutes: number
  total_questions: number
  category: string
}

export function ExamGrid() {
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeFilter, setActiveFilter] = useState("all")

  // 1. Fetch Real Exams from Django
  useEffect(() => {
    async function loadExams() {
      try {
        const res = await examApi.list()
        setExams(res.data)
      } catch (error) {
        console.error("Failed to load exams", error)
      } finally {
        setLoading(false)
      }
    }
    loadExams()
  }, [])

  // 2. Client-side Filtering
  const filteredExams = useMemo(() => {
    return exams.filter((exam) => {
      const matchesSearch = exam.title.toLowerCase().includes(searchQuery.toLowerCase())
      
      // Map Django categories to Filter IDs
      const matchesFilter = 
        activeFilter === "all" || 
        exam.category === activeFilter
      
      return matchesSearch && matchesFilter
    })
  }, [searchQuery, activeFilter, exams])

  if (loading) {
    return <div className="py-20 text-center text-slate-500">Loading exams...</div>
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Search and Filter Bar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 animate-fade-in">
        {/* Search Input */}
        <div className="relative w-full md:w-96 group">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined">
            search
          </span>
          <input
            type="text"
            placeholder="Search for exams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all shadow-sm"
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {[
            { label: "All", value: "all" },
            { label: "SSC", value: "ssc" },
            { label: "UPSC", value: "upsc" },
            { label: "Railways", value: "railways" },
            { label: "Banking", value: "banking" },
          ].map((filter) => (
            <button
              key={filter.value}
              onClick={() => setActiveFilter(filter.value)}
              className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 shadow-sm ${
                activeFilter === filter.value
                  ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
                  : "bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dynamic Exam Cards Grid */}
      {filteredExams.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredExams.map((exam) => (
            <ExamCard
              key={exam.id}
              id={exam.id}
              title={exam.title}
              description={exam.description}
              duration={exam.duration_minutes}
              questions={exam.total_questions}
              category={exam.category}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 animate-fade-in">
          <div className="size-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-2xl text-slate-400">search_off</span>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No exams found</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Try adjusting your search or filters</p>
        </div>
      )}
    </div>
  )
}