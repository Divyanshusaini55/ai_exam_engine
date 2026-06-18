"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { FileQuestion, Clock, Calendar, ArrowRight, ArrowLeft, ChevronRight, SearchX } from "lucide-react"
import { CategoryHomeIcon } from "@/components/category-home-icon"

interface Exam {
  id: number
  slug: string
  title: string
  description: string
  subcategory: number
  subcategory_name: string
  category_name: string
  category_slug: string
  year: number | null
  shift: string
  status: string
  duration_minutes: number
  total_questions: number
  question_count: number
  is_active: boolean
}

interface SubCategory {
  id: number
  slug: string
  name: string
  description: string
  category_name: string
  category_slug: string
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api"

export default function SubCategoryPage() {
  const params = useParams()
  const router = useRouter()
  const categorySlug = params.categorySlug as string
  const subcategorySlug = params.subcategorySlug as string

  const [exams, setExams] = useState<Exam[]>([])
  const [subcategory, setSubcategory] = useState<SubCategory | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const parentCategoryLabel = subcategory?.category_name || categorySlug

  useEffect(() => {
    fetch(`${API_BASE_URL}/subcategories/${subcategorySlug}/`)
      .then((res) => {
        if (!res.ok) throw new Error("Subcategory not found")
        return res.json()
      })
      .then((data) => setSubcategory(data))
      .catch((err) => console.error("Subcategory fetch error:", err))

    fetch(`${API_BASE_URL}/exams/?subcategory=${subcategorySlug}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch exams")
        return res.json()
      })
      .then((data) => {
        const examsList = data.results || data
        setExams(examsList)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [subcategorySlug])

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <p className="text-center font-medium text-muted-foreground">Loading exams...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="mb-4 font-bold text-destructive">Error: {error}</p>
            <Link
              prefetch={false}
              href={`/category/${categorySlug}`}
              className="flex items-center justify-center gap-2 font-bold text-primary hover:underline"
            >
              <ArrowLeft className="size-4" /> Back to {categorySlug.toUpperCase()}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <nav className="mb-8 flex flex-wrap items-center gap-2 text-sm font-medium text-muted-foreground">
          <Link prefetch={false} href="/" className="text-primary hover:underline">
            Home
          </Link>
          <ChevronRight className="size-3 shrink-0" />
          <Link prefetch={false} href={`/category/${categorySlug}`} className="text-primary hover:underline">
            {subcategory?.category_name || categorySlug}
          </Link>
          <ChevronRight className="size-3 shrink-0" />
          <span>{subcategory?.name || subcategorySlug}</span>
        </nav>

        <header className="mb-12 flex flex-col gap-6 md:flex-row md:items-center md:gap-8">
          <CategoryHomeIcon iconName="" categoryLabel={parentCategoryLabel} />
          <div>
            <h1 className="font-heading text-4xl font-extrabold tracking-tight text-primary md:text-5xl">
              {subcategory?.name || subcategorySlug.toUpperCase()}
            </h1>
            {subcategory?.description && (
              <p className="mt-3 text-lg font-medium text-muted-foreground">{subcategory.description}</p>
            )}
            <p className="mt-2 text-sm font-medium text-muted-foreground">
              {exams.length} {exams.length === 1 ? "exam" : "exams"} available
            </p>
          </div>
        </header>

        {exams.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card py-20 text-center shadow-sm">
            <div className="mb-6 flex justify-center">
              <SearchX className="size-16 text-muted-foreground/40" />
            </div>
            <p className="mb-2 text-xl font-bold text-primary">No exams available yet</p>
            <p className="mb-8 text-muted-foreground">Check back later or explore other categories.</p>
            <Link
              prefetch={false}
              href={`/category/${categorySlug}`}
              className="inline-flex items-center gap-2 rounded-xl bg-secondary px-6 py-3 font-bold text-primary transition-all hover:bg-secondary/80"
            >
              <ArrowLeft className="size-4" /> Back to {subcategory?.category_name || categorySlug}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {exams.map((exam, idx) => (
              <div
                key={exam.id}
                className="translate-y-8 opacity-0 transition-all duration-500 ease-out animate-in"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      router.push(`/exam/${exam.slug}`)
                    }
                  }}
                  className="group card-premium relative flex h-full cursor-pointer flex-col gap-5 overflow-hidden p-6 text-left"
                  onClick={() => router.push(`/exam/${exam.slug}`)}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-secondary/50 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

                  <div className="relative z-10 flex h-full flex-col gap-5">
                    <div className="flex items-start justify-between gap-3">
                      <CategoryHomeIcon
                        iconName=""
                        categoryLabel={exam.category_slug || parentCategoryLabel}
                      />
                      {exam.year ? (
                        <span className="whitespace-nowrap rounded-full border border-border bg-secondary/50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-primary">
                          {exam.year}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-2 flex-grow space-y-2">
                      <h3 className="font-heading text-[22px] font-bold leading-tight text-primary">{exam.title}</h3>
                      {exam.description && (
                        <p className="line-clamp-2 text-[15px] font-medium leading-relaxed text-muted-foreground">
                          {exam.description}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Clock className="size-4 text-primary" />
                        <span>{exam.duration_minutes}m</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileQuestion className="size-4 text-primary" />
                        <span>{exam.total_questions} Qs</span>
                      </div>
                      {exam.shift ? (
                        <div className="flex items-center gap-2">
                          <Calendar className="size-4 text-primary" />
                          <span>{exam.shift}</span>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-auto border-t border-border pt-4">
                      <div className="flex items-center justify-between rounded-xl border border-border bg-background p-3 transition-all duration-300 group-hover:border-primary group-hover:bg-primary">
                        <span className="text-sm font-semibold text-primary transition-colors duration-300 group-hover:text-primary-foreground">
                          View details
                        </span>
                        <ArrowRight className="size-5 text-primary transition-all duration-300 group-hover:translate-x-2 group-hover:text-primary-foreground" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
