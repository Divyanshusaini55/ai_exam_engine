"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { ArrowRight, ArrowLeft } from "lucide-react"
import { CategoryHomeIcon } from "@/components/category-home-icon"

interface SubCategory {
  id: number
  slug: string
  name: string
  description: string
  icon: string
  order: number
  is_active: boolean
  category_name: string
  category_slug: string
  exam_count: number
}

interface Category {
  id: number
  slug: string
  name: string
  description: string
  icon: string
  icon_color: string
  bg_color: string
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api"

export default function CategoryPage() {
  const params = useParams()
  const router = useRouter()
  const categorySlug = params.categorySlug as string

  const [subcategories, setSubcategories] = useState<SubCategory[]>([])
  const [category, setCategory] = useState<Category | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const categoryLabel = category?.name || categorySlug

  useEffect(() => {
    fetch(`${API_BASE_URL}/categories/${categorySlug}/`)
      .then((res) => {
        if (!res.ok) throw new Error("Category not found")
        return res.json()
      })
      .then((data) => setCategory(data))
      .catch((err) => console.error("Category fetch error:", err))

    fetch(`${API_BASE_URL}/subcategories/?category=${categorySlug}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch subcategories")
        return res.json()
      })
      .then((data) => {
        const subcategoriesList = data.results || data
        setSubcategories(subcategoriesList)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [categorySlug])

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <p className="text-center font-medium text-muted-foreground">Loading subcategories...</p>
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
              href="/"
              className="flex items-center justify-center gap-2 font-bold text-primary hover:underline"
            >
              <ArrowLeft className="size-4" /> Back to Home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            prefetch={false}
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" /> Back to Categories
          </Link>
        </div>

        <header className="mb-8 flex items-center gap-4">
          <CategoryHomeIcon
            iconName={category?.icon}
            categoryLabel={categoryLabel}
            apiBg={category?.bg_color}
            apiIcon={category?.icon_color}
          />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {category?.name || categorySlug.toUpperCase()}
            </h1>
            {category?.description && (
              <p className="mt-0.5 max-w-2xl text-xs sm:text-sm font-normal text-muted-foreground">
                {category.description}
              </p>
            )}
          </div>
        </header>

        {subcategories.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card py-20 text-center shadow-sm">
            <p className="mb-4 text-xl font-bold text-primary">No subcategories available yet.</p>
            <Link
              prefetch={false}
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-secondary px-6 py-3 font-bold text-primary transition-all hover:bg-secondary/80"
            >
              <ArrowLeft className="size-4" /> Back to Home
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {subcategories.map((subcategory, idx) => (
              <div
                key={subcategory.id}
                className="translate-y-8 opacity-0 transition-all duration-500 ease-out animate-in"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      router.push(`/category/${categorySlug}/${subcategory.slug}`)
                    }
                  }}
                  className="group card-premium relative flex h-full cursor-pointer flex-col gap-5 overflow-hidden p-6"
                  onClick={() => router.push(`/category/${categorySlug}/${subcategory.slug}`)}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-secondary/50 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

                  <div className="relative z-10 flex h-full flex-col gap-5">
                    <div className="flex items-start justify-between gap-3">
                      <CategoryHomeIcon
                        iconName={subcategory.icon}
                        categoryLabel={categoryLabel}
                      />
                      <span className="whitespace-nowrap rounded-full border border-border bg-secondary/50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-primary">
                        {subcategory.exam_count} {subcategory.exam_count === 1 ? "Exam" : "Exams"}
                      </span>
                    </div>

                    <div className="mt-2 flex-grow space-y-2">
                      <h3 className="font-heading text-[22px] font-bold leading-tight text-primary">
                        {subcategory.name}
                      </h3>
                      {subcategory.description && (
                        <p className="line-clamp-2 text-[15px] font-medium leading-relaxed text-muted-foreground">
                          {subcategory.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-auto border-t border-border pt-4">
                      <div className="flex flex-col gap-2">
                        <div 
                          className="flex items-center justify-between rounded-xl border border-border bg-background p-3 transition-all duration-300 group-hover:border-primary group-hover:bg-primary"
                          onClick={(e) => {
                              // Let the parent onClick handle this one since it navigates to exams
                          }}
                        >
                          <span className="text-sm font-semibold text-primary transition-colors duration-300 group-hover:text-primary-foreground">
                            View exams
                          </span>
                          <ArrowRight className="size-5 text-primary transition-all duration-300 group-hover:translate-x-2 group-hover:text-primary-foreground" />
                        </div>

                        <button 
                          onClick={(e) => {
                            e.stopPropagation() // Prevent triggering the card's main onClick
                            router.push(`/roadmap/${subcategory.slug}`)
                          }}
                          className="w-full py-2.5 px-3 rounded-xl border-2 border-dashed border-primary/30 text-primary text-sm font-bold hover:bg-primary/5 hover:border-primary transition-all"
                        >
                          View Study Roadmap
                        </button>
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
