"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"

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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api'

export default function CategoryPage() {
    const params = useParams()
    const router = useRouter()
    const categorySlug = params.categorySlug as string

    const [subcategories, setSubcategories] = useState<SubCategory[]>([])
    const [category, setCategory] = useState<Category | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        // Fetch category details
        fetch(`${API_BASE_URL}/categories/${categorySlug}/`)
            .then(res => {
                if (!res.ok) throw new Error('Category not found')
                return res.json()
            })
            .then(data => setCategory(data))
            .catch(err => console.error('Category fetch error:', err))

        // Fetch subcategories for this category
        fetch(`${API_BASE_URL}/subcategories/?category=${categorySlug}`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch subcategories')
                return res.json()
            })
            .then(data => {
                const subcategoriesList = data.results || data
                setSubcategories(subcategoriesList)
                setLoading(false)
            })
            .catch(err => {
                setError(err.message)
                setLoading(false)
            })
    }, [categorySlug])

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <p className="text-center text-slate-500">Loading subcategories...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <div className="text-center">
                        <p className="text-red-500 mb-4">Error: {error}</p>
                        <Link href="/" className="text-blue-600 hover:underline">← Back to Home</Link>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Breadcrumb */}
                <div className="mb-8">
                    <Link href="/" className="text-blue-600 hover:underline text-sm">← Back to Categories</Link>
                </div>

                {/* Category Header */}
                <div className="mb-12">
                    <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
                        {category?.name || categorySlug.toUpperCase()}
                    </h1>
                    {category?.description && (
                        <p className="text-lg text-slate-600 dark:text-slate-300">{category.description}</p>
                    )}
                </div>

                {/* Subcategories Grid */}
                {subcategories.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-slate-500 text-lg mb-4">No subcategories available yet.</p>
                        <Link href="/" className="text-blue-600 hover:underline">← Back to Home</Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {subcategories.map((subcategory, idx) => (
                            <div
                                key={subcategory.id}
                                className="opacity-0 translate-y-8 transition-all duration-500 ease-out animate-in"
                                style={{ animationDelay: `${idx * 100}ms` }}
                            >
                                <div
                                    onClick={() => router.push(`/category/${categorySlug}/${subcategory.slug}`)}
                                    className="group relative w-full bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-2 overflow-hidden cursor-pointer"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 group-hover:from-blue-500/5 via-transparent to-blue-500/0 group-hover:to-blue-500/5 transition-all duration-500" />

                                    <div className="relative flex flex-col gap-6 h-full">
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="size-16 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center transition-all duration-300 group-hover:shadow-lg group-hover:scale-110 flex-shrink-0">
                                                <span className="material-symbols-outlined text-[36px] text-blue-600">{subcategory.icon}</span>
                                            </div>
                                            <span className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 text-xs font-bold tracking-wide whitespace-nowrap">
                                                {subcategory.exam_count} {subcategory.exam_count === 1 ? 'EXAM' : 'EXAMS'}
                                            </span>
                                        </div>

                                        <div className="flex-grow space-y-2">
                                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors leading-tight">
                                                {subcategory.name}
                                            </h3>
                                            {subcategory.description && (
                                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">{subcategory.description}</p>
                                            )}
                                        </div>

                                        {/* CTA Button */}
                                        <div className="pt-4 border-t border-dashed border-gray-200 dark:border-slate-700">
                                            <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/20 group-hover:from-primary/10 group-hover:to-primary/20 transition-all duration-300">
                                                <span className="text-sm font-semibold text-primary">View Exams</span>
                                                <span className="material-symbols-outlined text-[20px] text-primary transition-transform duration-300 group-hover:translate-x-2">
                                                    arrow_forward
                                                </span>
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
