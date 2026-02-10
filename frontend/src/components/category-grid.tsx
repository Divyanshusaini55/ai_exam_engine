"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api'

interface CategoryGridProps {
  onDataLoaded?: () => void
}

export function CategoryGrid({ onDataLoaded }: CategoryGridProps) {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    console.log('🔄 CategoryGrid fetching categories...')
    fetch(`${API_BASE_URL}/categories/`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch categories')
        return res.json()
      })
      .then(data => {
        // Django REST Framework returns paginated response: {count, next, previous, results}
        const categoriesList = data.results || data
        console.log('✅ Categories loaded:', categoriesList.length, 'items')
        setCategories(categoriesList)
        setLoading(false)
        // Notify parent that data has loaded
        console.log('📢 Calling onDataLoaded callback')
        onDataLoaded?.()
      })
      .catch(err => {
        console.error('❌ Error loading categories:', err.message)
        setError(err.message)
        setLoading(false)
        // Also notify on error so skeleton doesn't show forever
        onDataLoaded?.()
      })
  }, []) // Don't include onDataLoaded in deps to avoid infinite loop

  const handleCategoryClick = (categorySlug: string) => {
    router.push(`/category/${categorySlug}`)
  }

  // Don't show spinner - parent shows skeleton during loading
  if (loading) {
    return null
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="text-center">
          <span className="material-symbols-outlined text-5xl text-red-400 mb-2">error</span>
          <p className="text-red-500">Error: {error}</p>
        </div>
      </div>
    )
  }

  if (categories.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="text-center">
          <span className="material-symbols-outlined text-5xl text-slate-300 mb-2">category</span>
          <p className="text-slate-500">No categories available yet.</p>
        </div>
      </div>
    )
  }

  // Enhanced color mapping from backend color names to Tailwind classes
  const getColorClasses = (iconColor: string, bgColor: string) => {
    const iconColorMap: Record<string, string> = {
      'blue': 'text-blue-600',
      'purple': 'text-purple-600',
      'indigo': 'text-indigo-600',
      'orange': 'text-orange-600',
      'amber': 'text-amber-600',
      'red': 'text-red-600',
      'rose': 'text-rose-600',
      'green': 'text-green-600',
      'emerald': 'text-emerald-600',
      'teal': 'text-teal-600',
      'cyan': 'text-cyan-600',
      'sky': 'text-sky-600',
    }

    const bgColorMap: Record<string, string> = {
      'blue': 'bg-blue-100 dark:bg-blue-900/30',
      'purple': 'bg-purple-100 dark:bg-purple-900/30',
      'indigo': 'bg-indigo-100 dark:bg-indigo-900/30',
      'orange': 'bg-orange-100 dark:bg-orange-900/30',
      'amber': 'bg-amber-100 dark:bg-amber-900/30',
      'red': 'bg-red-100 dark:bg-red-900/30',
      'rose': 'bg-rose-100 dark:bg-rose-900/30',
      'green': 'bg-green-100 dark:bg-green-900/30',
      'emerald': 'bg-emerald-100 dark:bg-emerald-900/30',
      'teal': 'bg-teal-100 dark:bg-teal-900/30',
      'cyan': 'bg-cyan-100 dark:bg-cyan-900/30',
      'sky': 'bg-sky-100 dark:bg-sky-900/30',
    }

    const accentColorMap: Record<string, string> = {
      'blue': 'from-blue-500/0 group-hover:from-blue-500/5 to-blue-500/0 group-hover:to-blue-500/5',
      'purple': 'from-purple-500/0 group-hover:from-purple-500/5 to-purple-500/0 group-hover:to-purple-500/5',
      'indigo': 'from-indigo-500/0 group-hover:from-indigo-500/5 to-indigo-500/0 group-hover:to-indigo-500/5',
      'orange': 'from-orange-500/0 group-hover:from-orange-500/5 to-orange-500/0 group-hover:to-orange-500/5',
      'amber': 'from-amber-500/0 group-hover:from-amber-500/5 to-amber-500/0 group-hover:to-amber-500/5',
      'red': 'from-red-500/0 group-hover:from-red-500/5 to-red-500/0 group-hover:to-red-500/5',
      'rose': 'from-rose-500/0 group-hover:from-rose-500/5 to-rose-500/0 group-hover:to-rose-500/5',
      'green': 'from-green-500/0 group-hover:from-green-500/5 to-green-500/0 group-hover:to-green-500/5',
      'emerald': 'from-emerald-500/0 group-hover:from-emerald-500/5 to-emerald-500/0 group-hover:to-emerald-500/5',
      'teal': 'from-teal-500/0 group-hover:from-teal-500/5 to-teal-500/0 group-hover:to-teal-500/5',
      'cyan': 'from-cyan-500/0 group-hover:from-cyan-500/5 to-cyan-500/0 group-hover:to-cyan-500/5',
      'sky': 'from-sky-500/0 group-hover:from-sky-500/5 to-sky-500/0 group-hover:to-sky-500/5',
    }

    return {
      iconColor: iconColorMap[iconColor] || 'text-blue-600',
      bgColor: bgColorMap[bgColor] || bgColorMap[iconColor] || 'bg-blue-100 dark:bg-blue-900/30',
      accentGradient: accentColorMap[iconColor] || accentColorMap['blue']
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {categories.map((category, idx) => {
        const colors = getColorClasses(category.icon_color, category.bg_color)
        return (
          <div
            key={category.id}
            className={`opacity-0 translate-y-8 transition-all duration-500 ease-out animate-in`}
            style={{ animationDelay: `${idx * 100}ms` }}
          >
            <div
              className="group relative w-full bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-2 overflow-hidden cursor-pointer"
              onClick={() => handleCategoryClick(category.slug)}
            >
              {/* Gradient Overlay */}
              <div className={`absolute inset-0 bg-gradient-to-br ${colors.accentGradient} via-transparent transition-all duration-500`} />

              <div className="relative flex flex-col gap-6 h-full">
                {/* Header with Icon and Badge */}
                <div className="flex justify-between items-start gap-4">
                  <div
                    className={`size-16 rounded-xl ${colors.bgColor} flex items-center justify-center transition-all duration-300 group-hover:shadow-lg group-hover:scale-110 flex-shrink-0`}
                  >
                    <span className={`material-symbols-outlined text-[36px] ${colors.iconColor}`}>{category.icon}</span>
                  </div>
                  <span className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 text-xs font-bold tracking-wide whitespace-nowrap">
                    {category.exam_count} {category.exam_count === 1 ? 'EXAM' : 'EXAMS'}
                  </span>
                </div>

                {/* Title and Description */}
                <div className="flex-grow space-y-2">
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors leading-tight">
                    {category.name}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                    {category.description || `Explore ${category.name} exams and test series`}
                  </p>
                </div>

                {/* CTA Button */}
                <div className="pt-4 border-t border-dashed border-gray-200 dark:border-slate-700">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/20 group-hover:from-primary/10 group-hover:to-primary/20 transition-all duration-300">
                    <span className="text-sm font-semibold text-primary">Explore Exams</span>
                    <span className="material-symbols-outlined text-[20px] text-primary transition-transform duration-300 group-hover:translate-x-2">
                      arrow_forward
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
