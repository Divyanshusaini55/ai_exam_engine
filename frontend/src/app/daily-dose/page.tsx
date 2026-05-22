"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { dailyDoseApi } from "@/lib/api"
import { Newspaper, Calendar, ArrowRight, Loader2 } from "lucide-react"

export default function DailyDosePage() {
    const [news, setNews] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        dailyDoseApi.getCurrentAffairs()
            .then(res => {
                setNews(res.data.results || res.data || [])
                setLoading(false)
            })
            .catch(err => {
                console.error(err)
                setLoading(false)
            })
    }, [])

    return (
        <div className="min-h-screen bg-background">
            <Navbar />
            <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="flex items-center gap-3 mb-8">
                    <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <Newspaper className="size-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-primary tracking-tight">Daily Dose</h1>
                        <p className="text-muted-foreground mt-1">AI-Curated Current Affairs for Competitive Exams</p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="size-8 animate-spin text-primary" />
                    </div>
                ) : news.length === 0 ? (
                    <div className="text-center py-20 bg-card rounded-2xl border border-dashed border-border">
                        <p className="text-muted-foreground font-medium">No current affairs available yet. Check back later!</p>
                    </div>
                ) : (
                    <div className="grid gap-6 md:grid-cols-2">
                        {news.map((item) => (
                            <Link 
                                key={item.id} 
                                href={`/daily-dose/${item.slug}`}
                                className="group bg-card rounded-2xl border border-border p-6 hover:shadow-premium hover:border-primary/30 transition-all duration-300 flex flex-col"
                            >
                                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground mb-3">
                                    <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-md">
                                        {item.category_name || "General"}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Calendar className="size-3" />
                                        {new Date(item.published_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                </div>
                                
                                <h2 className="text-xl font-bold text-primary leading-tight mb-3 group-hover:text-primary/80 transition-colors">
                                    {item.title}
                                </h2>
                                
                                <p className="text-muted-foreground text-sm line-clamp-3 mb-6 flex-1">
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
                        ))}
                    </div>
                )}
            </main>
        </div>
    )
}
