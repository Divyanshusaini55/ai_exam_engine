"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { dailyDoseApi } from "@/lib/api"
import { Newspaper, Calendar, ArrowRight, Loader2, Filter } from "lucide-react"

interface Category {
    id: number
    name: string
    slug: string
    count: number
}

// Color map for category chips — gives each domain a distinct visual identity
const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; activeBg: string; activeText: string }> = {
    "economy-finance":        { bg: "bg-amber-500/10",   text: "text-amber-600 dark:text-amber-400",   border: "border-amber-500/20",   activeBg: "bg-amber-500",   activeText: "text-white" },
    "polity-governance":      { bg: "bg-blue-500/10",    text: "text-blue-600 dark:text-blue-400",     border: "border-blue-500/20",    activeBg: "bg-blue-500",    activeText: "text-white" },
    "science-technology":     { bg: "bg-violet-500/10",  text: "text-violet-600 dark:text-violet-400", border: "border-violet-500/20",  activeBg: "bg-violet-500",  activeText: "text-white" },
    "international-relations":{ bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400",border: "border-emerald-500/20",activeBg: "bg-emerald-500", activeText: "text-white" },
    "environment-ecology":    { bg: "bg-green-500/10",   text: "text-green-600 dark:text-green-400",   border: "border-green-500/20",   activeBg: "bg-green-500",   activeText: "text-white" },
    "defence-security":       { bg: "bg-red-500/10",     text: "text-red-600 dark:text-red-400",       border: "border-red-500/20",     activeBg: "bg-red-500",     activeText: "text-white" },
    "society-social-justice":  { bg: "bg-pink-500/10",    text: "text-pink-600 dark:text-pink-400",     border: "border-pink-500/20",    activeBg: "bg-pink-500",    activeText: "text-white" },
    "geography-disasters":    { bg: "bg-orange-500/10",  text: "text-orange-600 dark:text-orange-400", border: "border-orange-500/20",  activeBg: "bg-orange-500",  activeText: "text-white" },
    "history-culture":        { bg: "bg-cyan-500/10",    text: "text-cyan-600 dark:text-cyan-400",     border: "border-cyan-500/20",    activeBg: "bg-cyan-500",    activeText: "text-white" },
    "current-affairs":        { bg: "bg-primary/10",     text: "text-primary",                         border: "border-primary/20",     activeBg: "bg-primary",     activeText: "text-primary-foreground" },
}

const DEFAULT_COLOR = { bg: "bg-primary/10", text: "text-primary", border: "border-primary/20", activeBg: "bg-primary", activeText: "text-primary-foreground" }

function getCategoryColor(slug: string) {
    return CATEGORY_COLORS[slug] || DEFAULT_COLOR
}

export default function DailyDosePage() {
    const [news, setNews] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [hasNext, setHasNext] = useState(false)
    const [hasPrev, setHasPrev] = useState(false)
    const [totalPages, setTotalPages] = useState(1)

    // Category filter state
    const [categories, setCategories] = useState<Category[]>([])
    const [activeCategory, setActiveCategory] = useState<string | undefined>(undefined)
    const [categoriesLoading, setCategoriesLoading] = useState(true)

    // Fetch categories once on mount
    useEffect(() => {
        dailyDoseApi.getCategories()
            .then(res => {
                setCategories(res.data || [])
                setCategoriesLoading(false)
            })
            .catch(err => {
                console.error("Failed to load categories:", err)
                setCategoriesLoading(false)
            })
    }, [])

    // Fetch articles when page or category changes
    useEffect(() => {
        setLoading(true)
        dailyDoseApi.getCurrentAffairs(activeCategory, page)
            .then(res => {
                setNews(res.data.results || res.data || [])
                setHasNext(!!res.data.next)
                setHasPrev(!!res.data.previous)
                if (res.data.count) {
                    setTotalPages(Math.ceil(res.data.count / 20))
                }
                setLoading(false)
            })
            .catch(err => {
                console.error(err)
                setLoading(false)
            })
    }, [page, activeCategory])

    const handleCategoryClick = (slug: string | undefined) => {
        setActiveCategory(slug)
        setPage(1) // Reset to first page when switching category
    }

    return (
        <div className="min-h-screen bg-background">
            <Navbar />
            <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Header */}
                <div className="flex items-center gap-3 mb-8">
                    <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <Newspaper className="size-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-heading font-extrabold text-primary tracking-tight">Daily Dose</h1>
                        <p className="text-muted-foreground mt-1">AI-Curated Current Affairs for Competitive Exams</p>
                    </div>
                </div>

                {/* Category Filter Chips */}
                {!categoriesLoading && categories.length > 0 && (
                    <div className="mb-8">
                        <div className="flex items-center gap-2 mb-3">
                            <Filter className="size-4 text-muted-foreground" />
                            <span className="text-sm font-semibold text-muted-foreground">Filter by Topic</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {/* "All" chip */}
                            <button
                                onClick={() => handleCategoryClick(undefined)}
                                className={`
                                    px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all duration-200
                                    ${!activeCategory
                                        ? "bg-primary text-primary-foreground border-primary shadow-md scale-105"
                                        : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-primary"
                                    }
                                `}
                            >
                                All Topics
                            </button>

                            {categories.map((cat) => {
                                const colors = getCategoryColor(cat.slug)
                                const isActive = activeCategory === cat.slug
                                return (
                                    <button
                                        key={cat.id}
                                        onClick={() => handleCategoryClick(cat.slug)}
                                        className={`
                                            px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all duration-200
                                            ${isActive
                                                ? `${colors.activeBg} ${colors.activeText} border-transparent shadow-md scale-105`
                                                : `${colors.bg} ${colors.text} ${colors.border} hover:shadow-sm hover:scale-[1.02]`
                                            }
                                        `}
                                    >
                                        {cat.name}
                                        <span className={`ml-1.5 ${isActive ? "opacity-80" : "opacity-60"}`}>
                                            {cat.count}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Article Grid */}
                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="size-8 animate-spin text-primary" />
                    </div>
                ) : news.length === 0 ? (
                    <div className="text-center py-20 bg-card rounded-2xl border border-dashed border-border">
                        <p className="text-muted-foreground font-medium">
                            {activeCategory
                                ? "No articles found in this category. Try another topic!"
                                : "No current affairs available yet. Check back later!"
                            }
                        </p>
                        {activeCategory && (
                            <button
                                onClick={() => handleCategoryClick(undefined)}
                                className="mt-4 px-4 py-2 text-sm font-bold text-primary hover:underline underline-offset-4"
                            >
                                ← View all topics
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid gap-6 md:grid-cols-2">
                        {news.map((item) => {
                            const catSlug = categories.find(c => c.name === item.category_name)?.slug || ""
                            const colors = getCategoryColor(catSlug)
                            return (
                                <Link 
                                    key={item.id} 
                                    href={`/daily-dose/${item.slug}`}
                                    className="group bg-card rounded-2xl border border-border p-6 hover:shadow-premium hover:border-primary/30 transition-all duration-300 flex flex-col"
                                >
                                    <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground mb-3">
                                        <span className={`${colors.bg} ${colors.text} px-2.5 py-1 rounded-md border ${colors.border}`}>
                                            {item.category_name || "General"}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Calendar className="size-3" />
                                            {new Date(item.published_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </span>
                                    </div>
                                    
                                    <h2 className="text-xl font-heading font-extrabold tracking-tight text-primary leading-[1.2] mb-3 group-hover:text-primary/80 transition-colors">
                                        {item.title}
                                    </h2>
                                    
                                    <p className="text-muted-foreground/90 font-crimson text-[18px] leading-relaxed line-clamp-3 mb-6 flex-1">
                                        {item.summary}
                                    </p>
                                    
                                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/50">
                                        <span className="text-xs font-medium text-muted-foreground/70">
                                            Source: {item.source_name}
                                        </span>
                                        <span className="flex items-center gap-1 text-sm font-bold text-primary group-hover:translate-x-1 transition-transform">
                                            Read full <ArrowRight className="size-4" />
                                        </span>
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
                )}

                {/* Pagination Controls */}
                {!loading && (hasNext || hasPrev) && (
                    <div className="flex items-center justify-center gap-4 mt-12 pt-8 border-t border-border/50">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={!hasPrev}
                            className="px-4 py-2 text-sm rounded-lg border border-border bg-card text-primary font-bold shadow-sm hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            Previous
                        </button>
                        
                        <div className="text-sm font-medium text-muted-foreground">
                            Page <span className="text-primary font-bold">{page}</span> {totalPages > 1 && `of ${totalPages}`}
                        </div>

                        <button
                            onClick={() => setPage(p => p + 1)}
                            disabled={!hasNext}
                            className="px-4 py-2 text-sm rounded-lg border border-border bg-card text-primary font-bold shadow-sm hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            Next
                        </button>
                    </div>
                )}
            </main>
        </div>
    )
}
