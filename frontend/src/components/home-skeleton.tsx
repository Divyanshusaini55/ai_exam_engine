"use client"

import { Sparkles, CircleUserRound } from "lucide-react"

export function HomeSkeleton() {
    return (
        <div className="min-h-screen bg-background relative overflow-hidden">
            {/* Soft Background Blurs */}
            <div className="absolute top-[-10%] left-[-10%] size-[600px] rounded-full bg-secondary/80 blur-[150px] pointer-events-none" />
            <div className="absolute top-[20%] right-[-5%] size-[500px] rounded-full bg-primary/5 blur-[150px] pointer-events-none" />

            {/* Navbar Skeleton */}
            <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-xl">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                    <div className="h-8 w-40 bg-secondary rounded-lg animate-pulse" />
                    <div className="flex items-center gap-4">
                        <div className="h-9 w-24 bg-secondary rounded-xl animate-pulse hidden md:block" />
                        <div className="size-9 rounded-full bg-secondary animate-pulse" />
                    </div>
                </div>
            </nav>

            <main className="flex-1 flex flex-col items-center relative z-10 pt-20 pb-12 px-4 md:px-8">
                <div className="w-full max-w-7xl flex flex-col gap-0 items-center text-center">
                    
                    {/* Hero Section Skeleton */}
                    <div className="flex flex-col gap-6 items-center w-full max-w-4xl mx-auto pt-10 pb-8">
                        <div className="h-8 w-64 bg-secondary rounded-full animate-pulse mb-4" />
                        <div className="h-16 md:h-20 w-full max-w-3xl bg-primary/10 rounded-2xl animate-pulse" />
                        <div className="h-6 md:h-8 w-full max-w-2xl bg-secondary/80 rounded-xl animate-pulse mt-2" />
                        
                        {/* Exam Tags Skeleton */}
                        <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="h-9 w-24 bg-secondary rounded-full animate-pulse" />
                            ))}
                        </div>
                    </div>

                    {/* Mock Dashboard Illustration Skeleton */}
                    <div className="w-full max-w-5xl mx-auto mt-16 mb-24 relative">
                        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none" />
                        <div className="w-full h-[400px] rounded-t-[32px] border-t border-l border-r border-border bg-card shadow-[0_-20px_60px_rgba(0,0,0,0.06)] overflow-hidden flex flex-col">
                            {/* Mock Navbar */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/80">
                                <div className="flex items-center gap-3">
                                    <div className="size-7 bg-secondary rounded-lg animate-pulse" />
                                    <div className="h-4 w-28 bg-secondary rounded-md animate-pulse" />
                                </div>
                                <div className="hidden md:flex items-center gap-6">
                                    {[1, 2, 3, 4].map((w, i) => (
                                        <div key={i} className="h-3 w-12 bg-secondary rounded-full animate-pulse" />
                                    ))}
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-20 bg-secondary rounded-lg animate-pulse" />
                                    <div className="size-8 rounded-full bg-secondary animate-pulse" />
                                </div>
                            </div>
                            
                            {/* Mock Content */}
                            <div className="p-6 flex flex-col gap-5 flex-1">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <div className="h-5 w-40 bg-secondary rounded-lg mb-2 animate-pulse" />
                                        <div className="h-3 w-56 bg-secondary/50 rounded-md animate-pulse" />
                                    </div>
                                    <div className="h-9 w-28 bg-secondary rounded-xl animate-pulse" />
                                </div>
                                
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {[1, 2, 3, 4].map((_, i) => (
                                        <div key={i} className="bg-secondary/20 rounded-2xl p-4 border border-border h-24 animate-pulse" />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Category Grid Skeleton */}
                    <div className="w-full relative z-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <CategoryCardSkeleton key={i} delay={i * 100} />
                        ))}
                    </div>
                </div>
            </main>
        </div>
    )
}

function CategoryCardSkeleton({ delay }: { delay: number }) {
    return (
        <div
            className="group card-premium relative flex h-full flex-col gap-5 overflow-hidden p-6 animate-pulse"
            style={{ animationDelay: `${delay}ms` }}
        >
            <div className="relative z-10 flex h-full flex-col gap-5">
                {/* Icon and badge row */}
                <div className="flex items-start justify-between gap-3">
                    <div className="size-12 rounded-xl bg-secondary flex-shrink-0" />
                    <div className="h-8 w-20 bg-secondary rounded-full" />
                </div>

                {/* Title and description */}
                <div className="mt-2 flex-grow space-y-3">
                    <div className="h-6 w-3/4 bg-secondary rounded-lg" />
                    <div className="h-4 w-full bg-secondary/60 rounded" />
                    <div className="h-4 w-5/6 bg-secondary/60 rounded" />
                </div>

                {/* CTA button placeholder */}
                <div className="mt-auto border-t border-border pt-4">
                    <div className="h-11 w-full bg-secondary rounded-xl" />
                </div>
            </div>
        </div>
    )
}
