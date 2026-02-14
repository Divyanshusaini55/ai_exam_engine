"use client"

import Link from "next/link"
import React from "react"

export function Footer() {
    const currentYear = new Date().getFullYear()

    return (
        <footer className="w-full bg-white border-t border-slate-200">
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 lg:py-16">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-8 mb-12">

                    {/* 1. Brand Section */}
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2">
                            <div className="size-8 flex items-center justify-center bg-slate-900 rounded-lg text-white">
                                <span className="material-symbols-outlined text-lg">school</span>
                            </div>
                            <span className="text-xl font-semibold text-slate-900 tracking-tight">
                                AI Exam Engine
                            </span>
                        </div>
                        <p className="text-slate-500 text-sm leading-relaxed max-w-xs">
                            Prepare smarter for competitive exams with our advanced AI-driven analysis and comprehensive test series.
                        </p>
                    </div>

                    {/* 2. Navigation Section */}
                    <div className="flex flex-col gap-4 md:items-start md:pl-8">
                        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                            Platform
                        </h3>
                        <div className="flex flex-col gap-3">
                            {[
                                { label: "Dashboard", href: "/dashboard" },
                                { label: "Exams", href: "/exams" },
                                { label: "Analysis", href: "/analysis" },
                                { label: "Leaderboard", href: "/leaderboard" },
                                { label: "Profile", href: "/profile" },
                            ].map((item) => (
                                <Link
                                    key={item.label}
                                    href={item.href}
                                    className="text-slate-500 hover:text-slate-900 text-sm transition-colors duration-200 w-fit"
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* 3. Support & Legal Section */}
                    <div className="flex flex-col gap-4 md:items-start">
                        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                            Support
                        </h3>
                        <div className="flex flex-col gap-3">
                            {[
                                { label: "Help Center", href: "/help" },
                                { label: "Contact Support", href: "/contact" },
                                { label: "Privacy Policy", href: "/privacy" },
                                { label: "Terms of Service", href: "/terms" },
                            ].map((item) => (
                                <Link
                                    key={item.label}
                                    href={item.href}
                                    className="text-slate-500 hover:text-slate-900 text-sm transition-colors duration-200 w-fit"
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 4. Bottom Strip */}
                <div className="pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-slate-400 text-sm text-center md:text-left">
                        © {currentYear} AI Exam Engine. All rights reserved.
                    </p>
                    <div className="flex gap-6">
                        {/* Socials / Extra Links if needed (kept minimal as requested) */}
                    </div>
                </div>
            </div>
        </footer>
    )
}
