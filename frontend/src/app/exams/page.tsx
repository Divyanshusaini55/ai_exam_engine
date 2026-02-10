"use client"

import Link from "next/link"


export default function ExamsPage() {
    const categories = [
        { id: "ssc", name: "SSC Exams", count: 4, icon: "school" },
        { id: "banking", name: "Banking & Insurance", count: 3, icon: "account_balance" },
        { id: "railways", name: "Railways", count: 2, icon: "train" },
        { id: "teaching", name: "Teaching", count: 5, icon: "menu_book" },
    ]

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 md:px-8">
            <div className="max-w-6xl mx-auto">
                <header className="mb-10">
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">All Exams</h1>
                    <p className="text-slate-500">Choose a category to start your preparation.</p>
                </header>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {categories.map((cat) => (
                        <Link
                            key={cat.id}
                            href={`/exam/${cat.id}`}
                            className="group bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 shadow-sm hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300"
                        >
                            <div className="size-12 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <span className="material-symbols-outlined text-2xl">{cat.icon}</span>
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 group-hover:text-blue-600 transition-colors">
                                {cat.name}
                            </h3>
                            <p className="text-sm text-slate-400 font-medium">
                                {cat.count} Active Exams
                            </p>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    )
}
