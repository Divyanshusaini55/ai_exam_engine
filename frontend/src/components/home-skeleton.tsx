"use client"

export function HomeSkeleton() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
            {/* Navbar Skeleton */}
            <nav className="border-b border-slate-200/50 dark:border-slate-800/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex justify-between items-center">
                    {/* Logo placeholder */}
                    <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
                    {/* Profile/Login button placeholder */}
                    <div className="h-10 w-28 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
                </div>
            </nav>

            <main className="flex-1 flex flex-col items-center py-12 px-4 md:px-8">
                <div className="w-full max-w-7xl flex flex-col gap-10">
                    {/* Hero Section Skeleton */}
                    <div className="flex flex-col gap-4 md:gap-6 pt-4 pb-2">
                        {/* Main heading placeholder */}
                        <div className="h-12 md:h-16 w-full max-w-3xl bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
                        {/* Subtitle placeholder */}
                        <div className="h-6 md:h-8 w-full max-w-2xl bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
                    </div>

                    {/* Category Grid Skeleton */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
            className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-sm opacity-0 animate-fade-in"
            style={{ animationDelay: `${delay}ms` }}
        >
            {/* Icon and badge row */}
            <div className="flex justify-between items-start gap-4 mb-6">
                {/* Icon placeholder */}
                <div className="size-16 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse flex-shrink-0" />
                {/* Badge placeholder */}
                <div className="h-8 w-20 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse" />
            </div>

            {/* Title and description */}
            <div className="flex-grow space-y-3 mb-6">
                {/* Title placeholder */}
                <div className="h-7 w-3/4 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
                {/* Description placeholder - two lines */}
                <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                <div className="h-4 w-5/6 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            </div>

            {/* CTA button placeholder */}
            <div className="pt-4 border-t border-dashed border-gray-200 dark:border-slate-700">
                <div className="h-12 w-full bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
            </div>
        </div>
    )
}
