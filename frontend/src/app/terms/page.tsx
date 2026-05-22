"use client"

import React, { useState, useEffect } from "react"
import { 
    FileText, 
    ShieldCheck, 
    AlertTriangle, 
    Ban, 
    Gavel, 
    ArrowUp 
} from "lucide-react"

export default function TermsPage() {
    const [scrolled, setScrolled] = useState(false)

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 200)
        window.addEventListener("scroll", handleScroll)
        return () => window.removeEventListener("scroll", handleScroll)
    }, [])

    const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" })

    const sections = [
        {
            id: 1,
            title: "License to Use",
            icon: ShieldCheck,
            content: "Permission is granted to temporarily use the materials (information or software) on AI Exam Engine's website for personal, non-commercial transitory viewing only."
        },
        {
            id: 2,
            title: "Disclaimer",
            icon: AlertTriangle,
            content: "The materials on AI Exam Engine's website are provided on an 'as is' basis. AI Exam Engine makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability."
        },
        {
            id: 3,
            title: "Limitations",
            icon: Ban,
            content: "In no event shall AI Exam Engine or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on AI Exam Engine's website."
        },
        {
            id: 4,
            title: "Governing Law",
            icon: Gavel,
            content: "Any claim relating to AI Exam Engine's website shall be governed by the laws of the service provider's home jurisdiction without regard to its conflict of law provisions."
        }
    ]

    return (
        <div className="min-h-screen bg-background py-16 md:py-24 px-4 transition-colors duration-300">
            <div className="max-w-3xl mx-auto">

                {/* Header */}
                <header className="text-center mb-16 animate-fade-in">
                    <div className="inline-flex items-center justify-center size-14 bg-secondary rounded-[18px] mb-6 border border-border shadow-sm">
                        <FileText className="size-7 text-primary" />
                    </div>
                    <h1 className="text-[42px] md:text-[56px] font-bold font-heading text-primary tracking-tight mb-3">
                        Terms of Service
                    </h1>
                    <p className="text-muted-foreground font-medium text-[17px]">
                        Please read these terms carefully before using our platform
                    </p>
                </header>

                {/* Main Terms Card */}
                <div className="card-premium p-8 md:p-10 mb-10 animate-fade-in" style={{ animationDelay: "0.1s" }}>
                    <p className="text-[18px] text-primary leading-relaxed font-medium">
                        By accessing this website, you are agreeing to be bound by these website Terms and Conditions of Use, all applicable laws and regulations, and agree that you are responsible for compliance with any applicable local laws.
                    </p>
                </div>

                {/* Sections */}
                <div className="space-y-6">
                    {sections.map((section, idx) => {
                        const Icon = section.icon
                        return (
                            <div
                                key={section.id}
                                className="group card-premium p-8 md:p-10 animate-fade-in"
                                style={{ animationDelay: `${(idx + 2) * 0.1}s` }}
                            >
                                <div className="flex items-start gap-6">
                                    <div className="hidden md:flex flex-col items-center gap-2 pt-1 flex-shrink-0">
                                        <span className="flex items-center justify-center size-11 rounded-full bg-secondary text-primary font-bold text-[14px] border border-border shadow-sm transition-all duration-300 group-hover:scale-105">
                                            {section.id.toString().padStart(2, '0')}
                                        </span>
                                    </div>

                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-4">
                                            <span className="md:hidden flex items-center justify-center size-9 rounded-full bg-secondary text-primary font-bold text-[13px] border border-border shadow-sm">
                                                {section.id.toString().padStart(2, '0')}
                                            </span>
                                            <div className="flex items-center gap-2.5 text-primary">
                                                <Icon className="size-5.5 text-muted-foreground" />
                                                <h2 className="text-[20px] font-bold font-heading">{section.title}</h2>
                                            </div>
                                        </div>
                                        <div className="text-muted-foreground text-[16px] leading-relaxed font-medium">
                                            {section.content}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Sticky Back to Top */}
                <button
                    onClick={scrollToTop}
                    className={`fixed bottom-8 right-8 size-12 bg-card rounded-full shadow-premium border border-border flex items-center justify-center text-primary hover:bg-primary hover:text-primary-foreground hover:scale-110 transition-all duration-300 z-50 ${scrolled ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}
                >
                    <ArrowUp className="size-6" />
                </button>

            </div>
        </div>
    )
}
