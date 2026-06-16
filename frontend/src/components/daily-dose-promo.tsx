"use client"

import { useState, useEffect } from "react"
import { Zap, X, ArrowRight } from "lucide-react"
import { useRouter } from "next/navigation"

export function DailyDosePromo() {
    const [isOpen, setIsOpen] = useState(false)
    const router = useRouter()

    useEffect(() => {
        const hasSeenPromo = localStorage.getItem("hasSeenDailyDosePromo")
        if (hasSeenPromo !== "true") {
            const timer = setTimeout(() => {
                setIsOpen(true)
            }, 1500)
            return () => clearTimeout(timer)
        }
    }, [])

    if (!isOpen) return null

    const handleClose = () => {
        setIsOpen(false)
        localStorage.setItem("hasSeenDailyDosePromo", "true")
    }

    return (
        <div className="fixed top-24 left-4 right-4 md:left-auto md:right-8 z-50 animate-in fade-in slide-in-from-top-8 duration-500 ease-out fill-mode-forwards md:w-[380px]">
            <div className="bg-card rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] p-4 flex gap-3 items-start relative border border-border">
                <div className="bg-primary/5 p-2.5 rounded-xl shrink-0 border border-primary/10">
                    <Zap className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 pt-0.5 z-10 flex flex-col">
                    <h3 className="font-bold text-sm text-primary tracking-tight mb-1">Meet Your Daily Dose</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-3 pr-2">
                        A quick, AI-curated current affairs every day. Keep your streak alive!
                    </p>
                    <button 
                        onClick={() => {
                            handleClose()
                            router.push('/daily-dose')
                        }}
                        className="self-start py-2 px-4 bg-primary text-primary-foreground font-bold rounded-lg shadow-premium hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-1.5 group text-xs"
                    >
                        Try Today&apos;s Dose
                        <ArrowRight className="size-3 transition-transform duration-300 group-hover:translate-x-1" />
                    </button>
                </div>
                <button 
                    onClick={handleClose}
                    className="text-muted-foreground hover:text-primary shrink-0 p-1.5 hover:bg-secondary rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 z-10"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    )
}
