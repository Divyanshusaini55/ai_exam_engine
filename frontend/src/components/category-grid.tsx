"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, LayoutGrid, ArrowRight } from "lucide-react"
import { CategoryHomeIcon } from "@/components/category-home-icon"

interface Category {
  id: number
  slug: string
  name: string
  description: string
  icon: string
  icon_color: string
  bg_color: string
  order: number
  exam_count: number
  subcategory_count: number
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api"

interface CategoryGridProps {
  onDataLoaded?: () => void
}

export const CategoryGrid = React.memo(function CategoryGrid({ onDataLoaded }: CategoryGridProps) {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${API_BASE_URL}/categories/`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch categories")
        return res.json()
      })
      .then((data) => {
        const categoriesList = data.results || data
        setCategories(categoriesList)
        setLoading(false)
        onDataLoaded?.()
      })
      .catch((err) => {
        if (err.name === "AbortError") return
        console.error("❌ Error loading categories:", err.message)
        setError(err.message)
        setLoading(false)
        onDataLoaded?.()
      })
    return () => controller.abort()
  }, [onDataLoaded])

  const handleCategoryClick = (categorySlug: string) => {
    router.push(`/category/${categorySlug}`)
  }

  if (loading) {
    return null
  }

  if (error) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-3 size-12 text-destructive" />
          <p className="font-bold text-destructive">Error: {error}</p>
        </div>
      </div>
    )
  }

  if (categories.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="text-center">
          <LayoutGrid className="mx-auto mb-3 size-12 text-muted-foreground" />
          <p className="font-bold text-muted-foreground">No categories available yet.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {categories.map((category, idx) => (
        <div
          key={category.id}
          className="translate-y-8 opacity-0 transition-all duration-500 ease-out animate-in"
          style={{ animationDelay: `${idx * 100}ms` }}
        >
          <div
            className="group card-premium relative flex h-full cursor-pointer flex-col gap-5 overflow-hidden p-6"
            onClick={() => handleCategoryClick(category.slug)}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-secondary/50 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

            <div className="relative z-10 flex h-full flex-col gap-5">
              <div className="flex items-start justify-between gap-3">
                <CategoryHomeIcon
                  iconName={category.icon}
                  categoryLabel={category.name}
                  apiBg={category.bg_color}
                  apiIcon={category.icon_color}
                />
                <span className="rounded-full border border-border bg-secondary/50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-primary">
                  {category.exam_count} {category.exam_count === 1 ? "Exam" : "Exams"}
                </span>
              </div>

              <div className="mt-2 flex-grow space-y-2">
                <h3 className="font-heading text-[22px] font-bold leading-tight text-primary">
                  {category.name}
                </h3>
                <p className="line-clamp-2 text-[15px] font-medium leading-relaxed text-muted-foreground">
                  {category.description || `Explore ${category.name} exams and test series`}
                </p>
              </div>

              <div className="mt-auto border-t border-border pt-4">
                <div className="flex items-center justify-between rounded-xl border border-border bg-background p-3 transition-all duration-300 group-hover:border-primary group-hover:bg-primary">
                  <span className="text-sm font-semibold text-primary transition-colors duration-300 group-hover:text-primary-foreground">
                    View Details
                  </span>
                  <ArrowRight className="size-5 text-primary transition-all duration-300 group-hover:translate-x-2 group-hover:text-primary-foreground" />
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
})
