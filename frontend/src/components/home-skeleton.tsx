"use client"

export function HomeSkeleton() {
    return (
        <div className="min-h-screen bg-background relative overflow-hidden">
            {/* Soft Background Blurs */}
            <div className="absolute top-[-10%] left-[-10%] size-[600px] rounded-full bg-secondary/80 blur-[150px] pointer-events-none" />
            <div className="absolute top-[20%] right-[-5%] size-[500px] rounded-full bg-primary/5 blur-[150px] pointer-events-none" />

            {/* Navbar Skeleton */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
                <div className="max-w-7xl mx-auto px-4 md:px-8">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo */}
                        <div className="flex items-center gap-3">
                            <div className="size-9 bg-secondary rounded-[10px] animate-pulse" />
                            <div className="h-6 w-28 bg-secondary rounded-lg animate-pulse" />
                        </div>
                        {/* Desktop Nav Items */}
                        <div className="hidden md:flex items-center gap-8">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="h-4 w-16 bg-secondary/70 rounded animate-pulse" />
                            ))}
                        </div>
                        {/* Actions */}
                        <div className="flex items-center gap-3">
                            <div className="size-9 rounded-full bg-secondary animate-pulse" />
                            <div className="hidden md:block h-4 w-12 bg-secondary/70 rounded animate-pulse mx-1" />
                            <div className="h-9 w-32 bg-secondary rounded-lg animate-pulse hidden md:block" />
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex flex-col items-center relative z-10 pt-20 pb-12 px-4 md:px-8">
                <div className="w-full max-w-7xl flex flex-col gap-0 items-center text-center">
                    
                    {/* ── Hero Section Skeleton ── */}
                    <div className="flex flex-col gap-6 items-center max-w-4xl mx-auto pt-10 pb-8">
                        {/* Badge */}
                        <div className="h-[31px] w-[190px] rounded-full bg-secondary animate-pulse mb-2" />
                        
                        {/* 2-line Headline */}
                        <div className="flex flex-col items-center gap-2 w-full">
                            <div className="h-12 md:h-14 w-80 max-w-full bg-secondary border border-border/50 rounded-2xl animate-pulse" />
                            <div className="h-12 md:h-14 w-64 max-w-full bg-secondary border border-border/50 rounded-2xl animate-pulse" />
                        </div>

                        {/* 3-line Subtitle */}
                        <div className="flex flex-col items-center gap-2 w-full max-w-2xl mt-1">
                            <div className="h-5 w-full bg-secondary/60 rounded-lg animate-pulse" />
                            <div className="h-5 w-5/6 bg-secondary/60 rounded-lg animate-pulse" />
                            <div className="h-5 w-2/3 bg-secondary/60 rounded-lg animate-pulse" />
                        </div>
                        
                        {/* Dual CTAs */}
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-6">
                            <div className="h-[40px] w-[160px] bg-secondary border border-border/50 rounded-xl animate-pulse" />
                            <div className="h-[40px] w-[160px] bg-secondary border border-border/50 rounded-xl animate-pulse" />
                        </div>
                    </div>

                    {/* ── Stats Trust Bar Skeleton ── */}
                    <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 mt-10 mb-16">
                        {[
                            { valueW: "w-14", labelW: "w-24" },
                            { valueW: "w-14", labelW: "w-20" },
                            { valueW: "w-8", labelW: "w-28" },
                            { valueW: "w-14", labelW: "w-12" },
                        ].map((stat, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <div className={`h-8 ${stat.valueW} bg-secondary rounded-lg animate-pulse`} />
                                <div className={`h-4 ${stat.labelW} bg-secondary/60 rounded animate-pulse`} />
                            </div>
                        ))}
                    </div>

                    {/* ── How It Works Section Skeleton ── */}
                    <div className="w-full max-w-4xl mx-auto mb-20">
                        <div className="text-center mb-10 flex flex-col items-center gap-2">
                            <div className="h-9 w-48 bg-secondary rounded-xl animate-pulse" />
                            <div className="h-5 w-64 bg-secondary/60 rounded-lg animate-pulse" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="card-premium p-6 flex flex-col items-start text-left animate-pulse">
                                    <div className="h-3.5 w-12 bg-secondary rounded mb-4" />
                                    <div className="size-11 rounded-xl bg-secondary mb-4 border border-border/50" />
                                    <div className="h-5 w-36 bg-secondary rounded-lg mb-2" />
                                    <div className="h-4 w-full bg-secondary/60 rounded mb-1.5" />
                                    <div className="h-4 w-4/5 bg-secondary/60 rounded" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── Category Grid Section Skeleton ── */}
                    <div className="w-full relative z-20 mb-8">
                        <div className="text-center mb-10 flex flex-col items-center gap-2">
                            <div className="h-9 w-56 bg-secondary rounded-xl animate-pulse" />
                            <div className="h-5 w-72 bg-secondary/60 rounded-lg animate-pulse" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <CategoryCardSkeleton key={i} delay={i * 100} />
                            ))}
                        </div>
                    </div>

                    {/* ── Features Section Skeleton ── */}
                    <div className="w-full flex flex-col gap-12 pt-24 pb-20">
                        <div className="text-center flex flex-col items-center gap-2">
                            <div className="h-9 w-80 max-w-full bg-secondary rounded-xl animate-pulse" />
                            <div className="h-5 w-48 bg-secondary/60 rounded-lg animate-pulse" />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="card-premium p-6 flex flex-col items-start gap-4 text-left animate-pulse">
                                    <div className="size-11 rounded-xl bg-secondary border border-border/50" />
                                    <div className="space-y-2 w-full">
                                        <div className="h-5 w-36 bg-secondary rounded-lg" />
                                        <div className="h-4 w-full bg-secondary/60 rounded" />
                                        <div className="h-4 w-4/5 bg-secondary/60 rounded" />
                                    </div>
                                </div>
                            ))}
                        </div>
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
