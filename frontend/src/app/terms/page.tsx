"use client"

import React, { useState, useEffect } from "react"


export default function TermsPage() {
    const [scrolled, setScrolled] = useState(false)

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 200)
        }
        window.addEventListener("scroll", handleScroll)
        return () => window.removeEventListener("scroll", handleScroll)
    }, [])

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: "smooth" })
    }

    const sections = [
        {
            id: 1,
            title: "Terms",
            icon: "gavel",
            content: (
                <>
                    By accessing the website at <strong className="text-slate-900 dark:text-white">Exam Platform</strong>, you are agreeing to be bound by these terms of service, all applicable laws and regulations, and agree that you are responsible for compliance with any applicable local laws.
                </>
            )
        },
        {
            id: 2,
            title: "Use License",
            icon: "badge",
            content: "Permission is granted to temporarily download one copy of the materials (information or software) on Exam Platform's website for personal, non-commercial transitory viewing only."
        },
        {
            id: 3,
            title: "Disclaimer",
            icon: "warning",
            content: "The materials on Exam Platform's website are provided on an 'as is' basis. Exam Platform makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights."
        },
        {
            id: 4,
            title: "Limitations",
            icon: "block",
            content: "In no event shall Exam Platform or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on Exam Platform's website."
        }
    ]

    return (
        <div className="min-h-screen bg-[#f9fafb] dark:bg-slate-950 py-12 md:py-20 px-4 transition-colors duration-300">
            <div className="max-w-3xl mx-auto">

                {/* Header */}
                <header className="text-center mb-16 animate-fade-in-up">
                    <div className="inline-flex items-center justify-center p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl mb-6">
                        <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400 text-3xl">description</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
                        Terms of Service
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">
                        Last Updated: <span className="text-slate-800 dark:text-slate-200">{new Date().toLocaleDateString()}</span>
                    </p>
                </header>

                {/* Sections */}
                <div className="space-y-8">
                    {sections.map((section, idx) => (
                        <div
                            key={section.id}
                            className="group bg-white dark:bg-slate-900 rounded-3xl p-8 md:p-10 shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-md hover:border-indigo-100 dark:hover:border-indigo-900 transition-all duration-300 animate-fade-in-up"
                            style={{ animationDelay: `${idx * 0.1}s` }}
                        >
                            <div className="flex items-start gap-6">
                                <div className="hidden md:flex flex-col items-center gap-2 pt-1">
                                    <span className="flex items-center justify-center size-10 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-500 font-bold border border-slate-200 dark:border-slate-700 group-hover:bg-indigo-50 group-hover:text-indigo-600 group-hover:border-indigo-200 transition-colors">
                                        {section.id.toString().padStart(2, '0')}
                                    </span>
                                    {idx !== sections.length - 1 && (
                                        <div className="w-px h-full bg-slate-100 dark:bg-slate-800 group-hover:bg-indigo-50 transition-colors mt-2" style={{ minHeight: "40px" }}></div>
                                    )}
                                </div>

                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className="md:hidden text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">
                                            {section.id.toString().padStart(2, '0')}
                                        </span>
                                        <div className="flex items-center gap-2 text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                                            <span className="material-symbols-outlined text-2xl opacity-50">{section.icon}</span>
                                            <h2 className="text-xl md:text-2xl font-bold">{section.title}</h2>
                                        </div>
                                    </div>
                                    <div className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed">
                                        {section.content}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer Note */}
                <div className="mt-12 text-center pb-20 animate-fade-in-up" style={{ animationDelay: "0.5s" }}>
                    <p className="text-slate-500 mb-6 max-w-lg mx-auto leading-relaxed">
                        We reserve the right to modify these terms at any time. By using this website you are agreeing to be bound by the then current version of these terms of service.
                    </p>
                </div>

                {/* Sticky Back to Top */}
                <button
                    onClick={scrollToTop}
                    className={`fixed bottom-8 right-8 size-12 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:scale-110 transition-all duration-300 z-50 ${scrolled ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}
                >
                    <span className="material-symbols-outlined">arrow_upward</span>
                </button>

            </div>
        </div>
    )
}
