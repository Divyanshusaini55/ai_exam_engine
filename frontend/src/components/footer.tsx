"use client"

import Link from "next/link"
import React from "react"
import { GraduationCap, Globe, Mail, Twitter } from "lucide-react"

const platformLinks = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Exams", href: "/exams" },
    { label: "Analysis", href: "/analysis" },
    { label: "Leaderboard", href: "/leaderboard" },
    { label: "Profile", href: "/profile" },
]

const supportLinks = [
    { label: "Help Center", href: "/help" },
    { label: "Contact Support", href: "/contact" },
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
]

import { usePathname } from "next/navigation"

export function Footer() {
    const currentYear = new Date().getFullYear()
    const pathname = usePathname()

    if (pathname?.startsWith("/admin")) return null

    return (
        <footer className="w-full bg-background border-t border-border">
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-16 lg:py-20">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12 lg:gap-8 mb-16">

                    {/* 1. Brand Section */}
                    <div className="flex flex-col gap-5 md:col-span-2 pr-8">
                        <div className="flex items-center gap-3">
                            <img src="/icon.svg" alt="ExamIntel Icon" className="size-10 select-none" />
                            <span className="text-[22px] font-bold font-heading text-primary tracking-tight">
                                ExamIntel
                            </span>
                        </div>
                        <p className="text-muted-foreground text-[15px] leading-relaxed max-w-sm font-medium">
                            Prepare smarter for competitive exams with our advanced AI-driven analysis and comprehensive test series. Built for ambitious students.
                        </p>
                        <div className="flex items-center gap-4 mt-2">
                            <a href="/" target="_blank" rel="noopener noreferrer" className="size-10 flex items-center justify-center rounded-full bg-secondary text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300">
                                <Globe className="size-5" />
                            </a>
                            <a href="mailto:support@examintel.com" className="size-10 flex items-center justify-center rounded-full bg-secondary text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300">
                                <Mail className="size-5" />
                            </a>
                            <a href="https://x.com/resultintel" target="_blank" rel="noopener noreferrer" className="size-10 flex items-center justify-center rounded-full bg-secondary text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300">
                                <Twitter className="size-5 fill-current" />
                            </a>
                        </div>
                    </div>

                    {/* 2. Navigation Section */}
                    <div className="flex flex-col gap-5">
                        <h3 className="text-[13px] font-bold text-primary uppercase tracking-widest">
                            Platform
                        </h3>
                        <div className="flex flex-col gap-3">
                            {platformLinks.map((item) => (
                                <Link prefetch={false}
                                    key={item.label}
                                    href={item.href}
                                    className="text-muted-foreground hover:text-primary text-[15px] font-medium transition-all duration-200 w-fit hover:translate-x-1"
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* 3. Support & Legal Section */}
                    <div className="flex flex-col gap-5">
                        <h3 className="text-[13px] font-bold text-primary uppercase tracking-widest">
                            Support
                        </h3>
                        <div className="flex flex-col gap-3">
                            {supportLinks.map((item) => (
                                <Link prefetch={false}
                                    key={item.label}
                                    href={item.href}
                                    className="text-muted-foreground hover:text-primary text-[15px] font-medium transition-all duration-200 w-fit hover:translate-x-1"
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 4. Bottom Strip */}
                <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-muted-foreground text-[14px] text-center md:text-left font-medium">
                        © {currentYear} ExamIntel. All rights reserved.
                    </p>
                    <div className="flex gap-6 text-[14px] font-medium text-muted-foreground">
                        <span>Built for you by <a href="https://divyanshusaini.me" target="_blank" rel="noopener noreferrer" className="font-bold text-primary hover:underline transition-all underline-offset-4">divyanshu</a></span>
                    </div>
                </div>
            </div>
        </footer>
    )
}
