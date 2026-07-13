"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { dailyDoseApi } from "@/lib/api"
import { Calendar, ArrowLeft, ExternalLink, Loader2 } from "lucide-react"
import ReactMarkdown from "react-markdown"

// Category color map (same as list page for consistency)
const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    "Economy & Finance":        { bg: "bg-amber-500/10",   text: "text-amber-600 dark:text-amber-400",    border: "border-amber-500/20" },
    "Polity & Governance":      { bg: "bg-sky-500/10",     text: "text-sky-600 dark:text-sky-400",        border: "border-sky-500/20" },
    "Science & Technology":     { bg: "bg-violet-500/10",  text: "text-violet-600 dark:text-violet-400",  border: "border-violet-500/20" },
    "International Relations":  { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400",border: "border-emerald-500/20" },
    "Environment & Ecology":    { bg: "bg-green-500/10",   text: "text-green-600 dark:text-green-400",    border: "border-green-500/20" },
    "Defence & Security":       { bg: "bg-red-500/10",     text: "text-red-600 dark:text-red-400",        border: "border-red-500/20" },
    "Society & Social Justice": { bg: "bg-pink-500/10",    text: "text-pink-600 dark:text-pink-400",      border: "border-pink-500/20" },
    "Geography & Disasters":    { bg: "bg-orange-500/10",  text: "text-orange-600 dark:text-orange-400",  border: "border-orange-500/20" },
    "History & Culture":        { bg: "bg-cyan-500/10",    text: "text-cyan-600 dark:text-cyan-400",      border: "border-cyan-500/20" },
}

const DEFAULT_CAT_COLOR = { bg: "bg-primary/10", text: "text-primary", border: "border-primary/20" }

function getCatColor(name: string) {
    return CATEGORY_COLORS[name] || DEFAULT_CAT_COLOR
}

export default function DailyDoseDetail() {
    const params = useParams()
    const router = useRouter()
    const slug = params.slug as string
    
    const [article, setArticle] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)

    useEffect(() => {
        if (!slug) return
        dailyDoseApi.getAffairBySlug(slug)
            .then(res => {
                setArticle(res.data)
                setLoading(false)
            })
            .catch(err => {
                console.error(err)
                setError(true)
                setLoading(false)
            })
    }, [slug])

    if (loading) {
        return (
            <div className="min-h-screen bg-background">
                <Navbar />
                <div className="flex justify-center items-center h-[calc(100vh-80px)]">
                    <Loader2 className="size-8 animate-spin text-primary" />
                </div>
            </div>
        )
    }

    if (error || !article) {
        return (
            <div className="min-h-screen bg-background">
                <Navbar />
                <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)]">
                    <h1 className="text-2xl font-bold text-primary mb-4">Article not found</h1>
                    <button 
                        onClick={() => router.push('/daily-dose')}
                        className="px-6 py-2 bg-primary text-primary-foreground rounded-full font-bold hover:opacity-90"
                    >
                        Back to Daily Dose
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background pb-20">
            <Navbar />
            
            <main className="max-w-3xl mx-auto px-2 sm:px-6 lg:px-8 py-8 md:py-12">
                <button 
                    onClick={() => router.push('/daily-dose')}
                    className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary transition-colors mb-8"
                >
                    <ArrowLeft className="size-4" /> Back to all news
                </button>

                <article className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm">
                    {article.image_url && (
                        <div className="w-full h-48 md:h-72 bg-muted relative">
                            <img 
                                src={article.image_url} 
                                alt={article.title}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    )}
                    
                    <div className="p-3 md:p-6">
                        <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-muted-foreground mb-6">
                            {(() => {
                                const catName = article.category_name || "General"
                                const colors = getCatColor(catName)
                                return (
                                    <Link
                                        href={`/daily-dose`}
                                        className={`${colors.bg} ${colors.text} ${colors.border} border px-3 py-1.5 rounded-md hover:opacity-80 transition-opacity`}
                                    >
                                        {catName}
                                    </Link>
                                )
                            })()}
                            <span className="flex items-center gap-1.5 bg-secondary px-3 py-1.5 rounded-md">
                                <Calendar className="size-3.5" />
                                {new Date(article.published_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </span>
                        </div>

                        <h1 className="text-2xl md:text-3xl font-heading font-extrabold text-primary leading-[1.15] mb-8 tracking-tight">
                            {article.title}
                        </h1>

                        <div className="prose prose-lg md:prose-xl font-crimson leading-relaxed dark:prose-invert max-w-none prose-headings:font-heading prose-headings:font-bold prose-headings:text-primary prose-h2:text-xl md:prose-h2:text-2xl prose-h3:text-lg md:prose-h3:text-xl prose-a:text-primary prose-strong:text-primary prose-p:text-primary/90 prose-li:text-primary/90 [&>h1:first-child]:hidden [&>h1]:text-xl md:[&>h1]:text-2xl [&>h1]:mt-8">
                            <ReactMarkdown>{article.content}</ReactMarkdown>
                        </div>

                        {article.source_url && (
                            <div className="mt-12 pt-6 border-t border-border flex items-center justify-between">
                                <p className="text-sm font-medium text-muted-foreground">
                                    Source: <span className="font-bold">{article.source_name}</span>
                                </p>
                                <a 
                                    href={article.source_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-sm font-bold text-primary hover:underline underline-offset-4"
                                >
                                    View Original <ExternalLink className="size-4" />
                                </a>
                            </div>
                        )}
                    </div>
                </article>
            </main>
        </div>
    )
}
