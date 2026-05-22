"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { 
    LifeBuoy, 
    GraduationCap, 
    BarChart3, 
    Trophy, 
    RotateCcw, 
    MessageCircle, 
    ArrowRight, 
    ArrowUp 
} from "lucide-react"

export default function HelpPage() {
    const [scrolled, setScrolled] = useState(false)

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 200)
        window.addEventListener("scroll", handleScroll)
        return () => window.removeEventListener("scroll", handleScroll)
    }, [])

    const faqs = [
        {
            id: 1,
            question: "How do I take an exam?",
            icon: GraduationCap,
            answer: "Navigate to the 'Exams' page, select your category (e.g., SSC), choose an exam, and click 'Start Exam'. You will be redirected to the secure exam interface where you can attempt questions."
        },
        {
            id: 2,
            question: "Where can I see my results?",
            icon: BarChart3,
            answer: "After submitting an exam, you are automatically redirected to the Results Dashboard. You can also view comprehensive analytics and past performance graphs in the 'Analysis' section."
        },
        {
            id: 3,
            question: "How does the Leaderboard work?",
            icon: Trophy,
            answer: "The Leaderboard ranks students based on their exam scores and speed. Top performers are highlighted in the 'Leaderboard' page. Consistency is key to climbing the ranks!"
        },
        {
            id: 4,
            question: "Can I retake an exam?",
            icon: RotateCcw,
            answer: "Yes! Go to your recent results or the specific exam page and click 'Retake Exam' to attempt it again. Your new score will be recorded separately to track improvement."
        }
    ]

    return (
        <div className="min-h-screen bg-background py-16 md:py-24 px-4 transition-colors duration-300">
            <div className="max-w-3xl mx-auto">

                {/* Header */}
                <header className="text-center mb-16 animate-fade-in">
                    <div className="inline-flex items-center justify-center size-14 bg-secondary rounded-[18px] mb-6 border border-border shadow-sm">
                        <LifeBuoy className="size-7 text-primary" />
                    </div>
                    <h1 className="text-[42px] md:text-[56px] font-bold font-heading text-primary tracking-tight mb-3">
                        Help Center
                    </h1>
                    <p className="text-muted-foreground font-medium text-[17px]">
                        Frequently asked questions and support
                    </p>
                </header>

                {/* FAQ Cards */}
                <div className="space-y-5">
                    {faqs.map((faq, idx) => {
                        const Icon = faq.icon
                        return (
                            <div
                                key={faq.id}
                                className="group card-premium p-8 md:p-10 animate-fade-in"
                                style={{ animationDelay: `${idx * 0.1}s` }}
                            >
                                <div className="flex items-start gap-6">
                                    {/* Number Badge — high contrast */}
                                    <div className="hidden md:flex flex-col items-center gap-2 pt-1 flex-shrink-0">
                                        <span className="flex items-center justify-center size-11 rounded-full bg-secondary text-primary font-bold text-[14px] border border-border shadow-sm transition-all duration-300 group-hover:scale-105">
                                            {faq.id.toString().padStart(2, '0')}
                                        </span>
                                    </div>

                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-3">
                                            {/* Mobile number */}
                                            <span className="md:hidden flex items-center justify-center size-9 rounded-full bg-secondary text-primary font-bold text-[13px] border border-border shadow-sm">
                                                {faq.id.toString().padStart(2, '0')}
                                            </span>
                                            <div className="flex items-center gap-2.5 text-primary">
                                                <Icon className="size-5.5 text-muted-foreground" />
                                                <h2 className="text-[19px] font-bold font-heading">{faq.question}</h2>
                                            </div>
                                        </div>
                                        <p className="text-muted-foreground text-[16px] leading-relaxed font-medium pl-1">
                                            {faq.answer}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Contact Support CTA */}
                <div className="mt-16 animate-fade-in" style={{ animationDelay: "0.5s" }}>
                    <div className="bg-primary rounded-2xl p-6 md:p-8 border border-primary relative overflow-hidden shadow-premium flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="absolute top-0 right-0 size-48 bg-secondary/10 rounded-full blur-3xl pointer-events-none" />
                        
                        <div className="relative z-10 flex flex-row items-center gap-4 text-left">
                            <div className="inline-flex items-center justify-center size-12 bg-secondary/10 rounded-[14px] shrink-0">
                                <MessageCircle className="size-6 text-primary-foreground" />
                            </div>
                            <div>
                                <h2 className="text-[20px] md:text-[22px] font-bold font-heading text-primary-foreground leading-none">Still need help?</h2>
                                <p className="text-white/70 text-[13px] md:text-[14px] font-medium mt-1.5 max-w-xl leading-relaxed">
                                    Our support team is available to assist you with any issues or questions you might have.
                                </p>
                            </div>
                        </div>

                        <div className="relative z-10 shrink-0 flex justify-center md:justify-end w-full md:w-auto">
                            <Link prefetch={false}
                                href="/contact"
                                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-card text-primary font-bold rounded-xl hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 group whitespace-nowrap w-full md:w-auto"
                            >
                                Contact Support
                                <ArrowRight className="size-4.5 transition-transform duration-300 group-hover:translate-x-1" />
                            </Link>
                        </div>
                    </div>
                </div>

            </div>

            {/* Back to Top */}
            <button
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className={`fixed bottom-8 right-8 size-12 bg-card rounded-full shadow-premium border border-border flex items-center justify-center text-primary hover:bg-primary hover:text-primary-foreground hover:scale-110 transition-all duration-300 z-50 ${scrolled ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}
            >
                <ArrowUp className="size-6" />
            </button>
        </div>
    )
}
