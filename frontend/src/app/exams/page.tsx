"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowRight, Loader2 } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { CategoryHomeIcon } from "@/components/category-home-icon"
import { examApi } from "@/lib/api"

export default function ExamsPage() {
    const [categories, setCategories] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const res = await examApi.getCategories()
                // Depending on pagination, API might return { results: [...] } or just [...]
                setCategories(res.data.results || res.data || [])
            } catch (error) {
                console.error("Failed to fetch categories", error)
            } finally {
                setLoading(false)
            }
        }
        fetchCategories()
    }, [])

    return (
        <div className="min-h-screen bg-background">
            <Navbar />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <header className="mb-10">
                    <h1 className="text-3xl font-bold text-primary mb-2 tracking-tight">All Exams</h1>
                    <p className="text-muted-foreground font-medium">Choose a category to start your preparation.</p>
                </header>

                {loading ? (
                    <div className="flex h-64 items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : categories.length === 0 ? (
                    <div className="flex h-64 items-center justify-center">
                        <p className="text-muted-foreground font-medium">No categories found.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {categories.map((cat) => (
                        <Link
                            prefetch={false}
                            key={cat.slug}
                            href={`/category/${cat.slug}`}
                            className="block h-full"
                        >
                            <div className="group card-premium relative flex h-full cursor-pointer flex-col gap-5 overflow-hidden p-6">
                                <div className="absolute inset-0 bg-gradient-to-br from-secondary/50 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

                                <div className="relative z-10 flex h-full flex-col gap-5">
                                    <div className="flex items-start justify-between gap-3">
                                        <CategoryHomeIcon
                                            iconName={cat.icon || "school"}
                                            categoryLabel={cat.name}
                                        />
                                        <span className="rounded-full border border-border bg-secondary/50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-primary">
                                            {cat.exam_count || 0} {cat.exam_count === 1 ? "Exam" : "Exams"}
                                        </span>
                                    </div>

                                    <div className="mt-2 flex-grow space-y-2">
                                        <h3 className="font-heading text-[22px] font-bold leading-tight text-primary">
                                            {cat.name}
                                        </h3>
                                        <p className="line-clamp-2 text-[15px] font-medium leading-relaxed text-muted-foreground">
                                            Explore {cat.name.toLowerCase()} and test series
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
                        </Link>
                    ))}
                </div>
                )}
            </div>
        </div>
    )
}
