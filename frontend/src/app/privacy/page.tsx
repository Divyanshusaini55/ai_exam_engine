"use client"

import React, { useState, useEffect } from "react"
import { 
    Shield, 
    Eye, 
    BarChart3, 
    Cookie, 
    Link2, 
    ArrowRight, 
    ArrowUp 
} from "lucide-react"

export default function PrivacyPage() {
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
            title: "Information We Collect",
            icon: Eye,
            content: "We only ask for personal information when we truly need it to provide a service to you. We collect it by fair and lawful means, with your knowledge and consent. We also let you know why we’re collecting it and how it will be used."
        },
        {
            id: 2,
            title: "Usage of Data",
            icon: BarChart3,
            content: (
                <>
                    We use your data to pinpoint your exam performance through our <strong className="text-primary font-bold">AI Analysis Engine</strong>. This includes recording your answers, time taken, and usage patterns to generate personalized learning insights.
                </>
            )
        },
        {
            id: 3,
            title: "Cookies",
            icon: Cookie,
            content: "We use cookies to maintain your session and preferences. You are free to refuse our request for your personal information, with the understanding that we may be unable to provide you with some of your desired services."
        },
        {
            id: 4,
            title: "External Links",
            icon: Link2,
            content: "Our website may link to external sites that are not operated by us. Please be aware that we have no control over the content and practices of these sites, and cannot accept responsibility or liability for their respective privacy policies."
        }
    ]

    return (
        <div className="min-h-screen bg-background py-16 md:py-24 px-4 transition-colors duration-300">
            <div className="max-w-3xl mx-auto">

                {/* Header */}
                <header className="text-center mb-16 animate-fade-in">
                    <div className="inline-flex items-center justify-center size-14 bg-secondary rounded-[18px] mb-6 border border-border shadow-sm">
                        <Shield className="size-7 text-primary" />
                    </div>
                    <h1 className="text-[42px] md:text-[56px] font-bold font-heading text-primary tracking-tight mb-3">
                        Privacy Policy
                    </h1>
                    <p className="text-muted-foreground font-medium text-[17px]">
                        Last Updated: <span className="text-primary">{new Date().toLocaleDateString()}</span>
                    </p>
                </header>

                {/* Introduction Card */}
                <div className="card-premium p-8 md:p-10 mb-10 animate-fade-in" style={{ animationDelay: "0.1s" }}>
                    <p className="text-[18px] text-primary leading-relaxed font-medium">
                        Your privacy is important to us. It is ExamIntel's policy to respect your privacy regarding any information we may collect from you across our website.
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

                {/* Footer Note */}
                <div className="mt-16 text-center pb-20 animate-fade-in" style={{ animationDelay: "0.6s" }}>
                    <p className="text-muted-foreground mb-6 font-medium">
                        If you have any questions about how we handle user data and personal information, feel free to contact us.
                    </p>
                    <a href="/contact" className="inline-flex items-center gap-2 text-primary font-bold hover:translate-x-1 transition-transform border-b-2 border-secondary hover:border-primary pb-0.5">
                        Contact Support
                        <ArrowRight className="size-4" />
                    </a>
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
