"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"


export default function HelpPage() {
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

    const faqs = [
        {
            id: 1,
            question: "How do I take an exam?",
            icon: "history_edu",
            answer: "Navigate to the 'Exams' page, select your category (e.g., SSC), choose an exam, and click 'Start Exam'. You will be redirected to the secure exam interface where you can attempt questions."
        },
        {
            id: 2,
            question: "Where can I see my results?",
            icon: "analytics",
            answer: "After submitting an exam, you are automatically redirected to the Results Dashboard. You can also view comprehensive analytics and past performance graphs in the 'Analysis' section."
        },
        {
            id: 3,
            question: "How does the Leaderboard work?",
            icon: "trophy",
            answer: "The Leaderboard ranks students based on their exam scores and speed. Top performers are highlighted in the 'Leaderboard' page. Consistency is key to climbing the ranks!"
        },
        {
            id: 4,
            question: "Can I retake an exam?",
            icon: "replay",
            answer: "Yes! Go to your recent results or the specific exam page and click 'Retake Exam' to attempt it again. Your new score will be recorded separately to track improvement."
        }
    ]

    return (
        <div className="min-h-screen bg-[#f9fafb] dark:bg-slate-950 py-12 md:py-20 px-4 transition-colors duration-300">
            <div className="max-w-3xl mx-auto">

                {/* Header */}
                <header className="text-center mb-16 animate-fade-in-up">
                    <div className="inline-flex items-center justify-center p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl mb-6">
                        <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400 text-3xl">support_agent</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
                        Help Center
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-lg">
                        Frequently asked questions and support
                    </p>
                </header>

                {/* FAQ Sections */}
                <div className="space-y-6">
                    {faqs.map((faq, idx) => (
                        <div
                            key={faq.id}
                            className="group bg-white dark:bg-slate-900 rounded-3xl p-8 md:p-10 shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-md hover:border-indigo-100 dark:hover:border-indigo-900 transition-all duration-300 animate-fade-in-up"
                            style={{ animationDelay: `${idx * 0.1}s` }}
                        >
                            <div className="flex items-start gap-6">
                                <div className="hidden md:flex flex-col items-center gap-2 pt-1">
                                    <span className="flex items-center justify-center size-10 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-500 font-bold border border-slate-200 dark:border-slate-700 group-hover:bg-indigo-50 group-hover:text-indigo-600 group-hover:border-indigo-200 transition-colors">
                                        {faq.id.toString().padStart(2, '0')}
                                    </span>
                                </div>

                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-3">
                                        <span className="md:hidden text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">
                                            {faq.id.toString().padStart(2, '0')}
                                        </span>
                                        <div className="flex items-center gap-2 text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                                            <span className="material-symbols-outlined text-2xl opacity-50">{faq.icon}</span>
                                            <h2 className="text-xl font-bold">{faq.question}</h2>
                                        </div>
                                    </div>
                                    <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed pl-1">
                                        {faq.answer}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Contact Support Footer */}
                <div className="mt-16 text-center animate-fade-in-up" style={{ animationDelay: "0.5s" }}>
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-3xl p-8 md:p-12 border border-indigo-100 dark:border-indigo-800/50">
                        <h2 className="text-2xl font-bold text-indigo-900 dark:text-indigo-100 mb-3">Still need help?</h2>
                        <p className="text-indigo-700 dark:text-indigo-300 mb-8 max-w-md mx-auto">
                            Our support team is available to assist you with any issues or questions you might have.
                        </p>

                        <Link
                            href="/contact"
                            className="group relative inline-flex items-center justify-center px-8 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-105 transition-all duration-300 overflow-hidden"
                        >
                            <span className="relative z-10 flex items-center gap-2">
                                Contact Support
                                <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
                            </span>

                            {/* Glossy Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 pointer-events-none" />
                        </Link>
                    </div>
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
