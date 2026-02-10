"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"

interface Exam {
    id: number
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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api'

export default function SubCategoryPage() {
    const params = useParams()
    const router = useRouter()
    const categorySlug = params.categorySlug as string
    const subcategorySlug = params.subcategorySlug as string

    const [exams, setExams] = useState<Exam[]>([])
    const [subcategory, setSubcategory] = useState<SubCategory | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        // Fetch subcategory details
        fetch(`${API_BASE_URL}/subcategories/${subcategorySlug}/`)
            .then(res => {
                if (!res.ok) throw new Error('Subcategory not found')
                return res.json()
            })
            .then(data => setSubcategory(data))
            .catch(err => console.error('Subcategory fetch error:', err))

        // Fetch exams for this subcategory
        fetch(`${API_BASE_URL}/exams/?subcategory=${subcategorySlug}`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch exams')
                return res.json()
            })
            .then(data => {
                const examsList = data.results || data
                setExams(examsList)
                setLoading(false)
            })
            .catch(err => {
                setError(err.message)
                setLoading(false)
            })
    }, [subcategorySlug])

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <p className="text-center text-slate-500">Loading exams...</p>
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
                        <Link href={`/category/${categorySlug}`} className="text-blue-600 hover:underline">
                            ← Back to {categorySlug.toUpperCase()}
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Breadcrumb */}
                <div className="mb-8 flex items-center gap-2 text-sm">
                    <Link href="/" className="text-blue-600 hover:underline">Home</Link>
                    <span className="text-slate-400">→</span>
                    <Link href={`/category/${categorySlug}`} className="text-blue-600 hover:underline">
                        {subcategory?.category_name || categorySlug}
                    </Link>
                    <span className="text-slate-400">→</span>
                    <span className="text-slate-600 dark:text-slate-300">{subcategory?.name || subcategorySlug}</span>
                </div>

                {/* Subcategory Header */}
                <div className="mb-12">
                    <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
                        {subcategory?.name || subcategorySlug.toUpperCase()}
                    </h1>
                    {subcategory?.description && (
                        <p className="text-lg text-slate-600 dark:text-slate-300">{subcategory.description}</p>
                    )}
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                        {exams.length} {exams.length === 1 ? 'exam' : 'exams'} available
                    </p>
                </div>

                {/* Exams Grid */}
                {exams.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="mb-6">
                            <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-600">
                                quiz
                            </span>
                        </div>
                        <p className="text-slate-500 text-lg mb-4">No exams available yet for this subcategory.</p>
                        <p className="text-sm text-slate-400 mb-6">Check back later or explore other categories.</p>
                        <Link href={`/category/${categorySlug}`} className="text-blue-600 hover:underline">
                            ← Back to {subcategory?.category_name || categorySlug}
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {exams.map((exam, idx) => (
                            <div
                                key={exam.id}
                                className="opacity-0 translate-y-8 transition-all duration-500 ease-out animate-in"
                                style={{ animationDelay: `${idx * 100}ms` }}
                            >
                                <div
                                    onClick={() => router.push(`/exam/${exam.id}`)}
                                    className="group relative w-full bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-2 overflow-hidden cursor-pointer text-left h-full"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 group-hover:from-blue-500/5 via-transparent to-blue-500/0 group-hover:to-blue-500/5 transition-all duration-500" />

                                    <div className="relative flex flex-col gap-4 h-full">
                                        {/* Header */}
                                        <div className="flex justify-between items-start gap-3">
                                            <h3 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors line-clamp-2">
                                                {exam.title}
                                            </h3>
                                            {exam.year && (
                                                <span className="px-2 py-1 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs font-bold whitespace-nowrap">
                                                    {exam.year}
                                                </span>
                                            )}
                                        </div>

                                        {/* Description */}
                                        {exam.description && (
                                            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
                                                {exam.description}
                                            </p>
                                        )}

                                        {/* Metadata */}
                                        <div className="flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-400">
                                            <div className="flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[16px]">schedule</span>
                                                <span>{exam.duration_minutes} min</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[16px]">quiz</span>
                                                <span>{exam.total_questions} questions</span>
                                            </div>
                                            {exam.shift && (
                                                <div className="flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-[16px]">event</span>
                                                    <span>{exam.shift}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* CTA Button */}
                                        <div className="border-t border-dashed border-gray-200 dark:border-slate-700 pt-4 mt-auto">
                                            <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/20 group-hover:from-primary/10 group-hover:to-primary/20 transition-all duration-300">
                                                <span className="text-sm font-semibold text-primary">Start Exam</span>
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
