"use client"

import { useState, useMemo, useEffect } from "react"
import { ExamCard } from "@/components/exam-card"
import { examApi } from "@/lib/api"
import { Search, SearchX } from "lucide-react"

// Interface matching your Django Serializer
interface Exam {
  id: number
  title: string
  description: string
  duration_minutes: number
  total_questions: number
  /** Legacy / optional — API exposes category_slug */
  category?: string
  category_slug?: string
  category_name?: string
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
      const catSlug = (exam.category_slug || exam.category || "").toLowerCase()
      const matchesFilter =
        activeFilter === "all" || catSlug === activeFilter
      
      return matchesSearch && matchesFilter
    })
  }, [searchQuery, activeFilter, exams])

  if (loading) {
    return (
        <div className="py-20 text-center text-muted-foreground font-medium animate-pulse">
            Loading exams...
        </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Search and Filter Bar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 animate-fade-in">
        {/* Search Input */}
        <div className="relative w-full md:w-96 group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <input
            type="text"
            placeholder="Search for exams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm focus:ring-2 focus:ring-primary/10 focus:border-primary/30 outline-none transition-all shadow-sm font-medium"
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 px-1">
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
              className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 shadow-sm border ${
                activeFilter === filter.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-muted-foreground hover:bg-secondary hover:text-primary"
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
              category={exam.category_slug || exam.category || exam.category_name || ""}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 animate-fade-in bg-card rounded-3xl border border-dashed border-border shadow-sm">
          <div className="size-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
            <SearchX className="size-8 text-muted-foreground/60" />
          </div>
          <h3 className="text-xl font-bold text-primary mb-2">No exams found</h3>
          <p className="text-sm text-muted-foreground font-medium">Try adjusting your search or filters</p>
        </div>
      )}
    </div>
  )
}