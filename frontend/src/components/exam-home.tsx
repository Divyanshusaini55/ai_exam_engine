"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useAuth } from "@/context/auth-context"
import { CategoryGrid } from "@/components/category-grid"
import { Navbar } from "@/components/navbar"
import { HomeSkeleton } from "@/components/home-skeleton"
import { DailyDosePromo } from "@/components/daily-dose-promo"
import { motion } from "motion/react"
import {
  Sparkles,
  BarChart3,
  Trophy,
  Upload,
  Brain,
  ArrowRight,
  CheckCircle2,
  FileText,
  Zap,
  Target
} from "lucide-react"


export function ExamHome() {
  const [dataLoaded, setDataLoaded] = useState(false)
  const router = useRouter()

  const handleDataLoaded = useCallback(() => {
    setDataLoaded(true)
  }, [])

  return (
    <>
      {/* Show skeleton overlay while loading */}
      {!dataLoaded && (
        <div className="fixed inset-0 z-50 bg-background">
          <HomeSkeleton />
        </div>
      )}

      {/* Real content */}
      <div className={`min-h-screen bg-background relative overflow-hidden transition-opacity duration-700 ${dataLoaded ? 'opacity-100' : 'opacity-0'}`}>

        {/* Soft Background Blurs */}
        <div className="absolute top-[-10%] left-[-10%] size-[600px] rounded-full bg-secondary/80 blur-[150px] pointer-events-none" />
        <div className="absolute top-[20%] right-[-5%] size-[500px] rounded-full bg-primary/5 blur-[150px] pointer-events-none" />

        <Navbar />

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center relative z-10 pt-20 pb-12 px-4 md:px-8">

          <div className="w-full max-w-7xl flex flex-col gap-0 items-center text-center">

            {/* ── Hero Section ── */}
            <div className="flex flex-col gap-6 items-center max-w-4xl mx-auto pt-10 pb-8 animate-fade-in">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-primary font-bold text-[11px] uppercase tracking-widest shadow-sm mb-2">
                <Sparkles className="size-3.5 text-primary" />
                <span>AI-Powered · Free to Use</span>
              </div>

              <h1 className="text-5xl md:text-6xl leading-[1.05] font-bold font-heading text-primary tracking-[-0.02em] text-balance">
                Practice smarter.
                <br />
                Score higher.
              </h1>

              <p className="text-lg md:text-xl text-muted-foreground font-medium max-w-2xl mt-1 leading-relaxed">
                Take AI-generated exams for SSC, UPSC, Banking & more — with instant grading, detailed explanations, and performance analytics that show you exactly where to improve.
              </p>

              {/* Dual CTAs */}
              <div className="flex flex-col sm:flex-row items-center gap-3 mt-6">
                <Link
                  href="/exams"
                  className="group inline-flex items-center gap-2 px-7 py-2 text-[15px] font-semibold bg-primary text-primary-foreground rounded-xl shadow-premium hover:-translate-y-[2px] hover:shadow-[0_15px_40px_rgba(0,0,0,0.12)] transition-all duration-300"
                >
                  Browse Exams
                  <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 px-7 py-2 text-[15px] font-semibold text-primary bg-secondary hover:bg-secondary/80 rounded-xl border border-border transition-all duration-300"
                >
                  Create Account
                </Link>
              </div>
            </div>

            {/* ── Stats Trust Bar ── */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 mt-10 mb-16"
            >
              {[
                { value: "160+", label: "Exam Papers" },
                { value: "50K+", label: "Questions" },
                { value: "6", label: "Exam Categories" },
                { value: "100%", label: "Free" },
              ].map((stat, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-2xl md:text-3xl font-bold font-heading text-primary tracking-tight">{stat.value}</span>
                  <span className="text-sm text-muted-foreground font-medium">{stat.label}</span>
                </div>
              ))}
            </motion.div>

            {/* ── How It Works ── */}
            <div className="w-full max-w-4xl mx-auto mb-20 animate-fade-in" style={{ animationDelay: "200ms" }}>
              <div className="text-center mb-10">
                <h2 className="text-3xl md:text-[40px] font-extrabold font-heading text-primary tracking-tight leading-tight">
                  How it works
                </h2>
                <p className="text-muted-foreground text-lg font-medium mt-3">Three steps to better exam prep.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  {
                    step: "01",
                    icon: Target,
                    title: "Choose an exam",
                    desc: "Browse 160+ papers across SSC, UPSC, Banking, Railways & more."
                  },
                  {
                    step: "02",
                    icon: FileText,
                    title: "Take the test",
                    desc: "Timed, distraction-free exam simulation with AI-generated questions."
                  },
                  {
                    step: "03",
                    icon: Zap,
                    title: "Get instant results",
                    desc: "Detailed score breakdown, AI explanations, and weak-area analysis."
                  }
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + i * 0.15, duration: 0.5 }}
                    className="relative card-premium p-6 flex flex-col items-start text-left"
                  >
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Step {item.step}</span>
                    <div className="size-11 rounded-xl bg-secondary flex items-center justify-center text-primary shadow-sm border border-border/50 mb-4">
                      <item.icon className="size-5" />
                    </div>
                    <h3 className="font-bold font-heading text-primary text-lg leading-tight mb-2">
                      {item.title}
                    </h3>
                    <p className="text-muted-foreground text-[14px] font-medium leading-relaxed">
                      {item.desc}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* ── Category Grid ── */}
            <div className="w-full relative z-20 mb-8">
              <div className="text-center mb-10">
                <h2 className="text-3xl md:text-[40px] font-extrabold font-heading text-primary tracking-tight leading-tight">
                  Choose your exam
                </h2>
                <p className="text-muted-foreground text-lg font-medium mt-3">Pick a category to start practicing.</p>
              </div>
              <CategoryGrid onDataLoaded={handleDataLoaded} />
            </div>

            {/* ── Features Section ── */}
            <div className={`w-full flex flex-col gap-12 pt-24 pb-20 transition-all duration-700 delay-500 ${dataLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
              <div className="text-center">
                <h2 className="text-3xl md:text-[40px] font-extrabold font-heading text-primary tracking-tight leading-tight">
                  Everything you need to crack it
                </h2>
                <p className="text-muted-foreground text-lg font-medium mt-4">Built for serious aspirants.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

                {/* Feature 1 */}
                <div className="card-premium p-6 flex flex-col items-start gap-4 text-left">
                  <div className="size-11 rounded-xl bg-secondary flex items-center justify-center text-primary shadow-sm border border-border/50">
                    <FileText className="size-5" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-bold font-heading text-primary text-lg leading-tight">
                      160+ Exam Papers
                    </h3>
                    <p className="text-muted-foreground text-[14px] font-medium leading-relaxed">
                      Practice with real and AI-generated papers for SSC, UPSC, Banking, Railways, Defence, and State PSC.
                    </p>
                  </div>
                </div>

                {/* Feature 2 */}
                <div className="card-premium p-6 flex flex-col items-start gap-4 text-left">
                  <div className="size-11 rounded-xl bg-secondary flex items-center justify-center text-primary shadow-sm border border-border/50">
                    <Sparkles className="size-5" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-bold font-heading text-primary text-lg leading-tight">
                      AI Explanations
                    </h3>
                    <p className="text-muted-foreground text-[14px] font-medium leading-relaxed">
                      Don&apos;t just see the answer — understand why. Step-by-step breakdowns for every question.
                    </p>
                  </div>
                </div>

                {/* Feature 3 */}
                <div className="card-premium p-6 flex flex-col items-start gap-4 text-left">
                  <div className="size-11 rounded-xl bg-secondary flex items-center justify-center text-primary shadow-sm border border-border/50">
                    <BarChart3 className="size-5" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-bold font-heading text-primary text-lg leading-tight">
                      Performance Analytics
                    </h3>
                    <p className="text-muted-foreground text-[14px] font-medium leading-relaxed">
                      Track accuracy, speed, and weak topics. Know exactly what to study next.
                    </p>
                  </div>
                </div>

                {/* Feature 4 */}
                <div className="card-premium p-6 flex flex-col items-start gap-4 text-left">
                  <div className="size-11 rounded-xl bg-secondary flex items-center justify-center text-primary shadow-sm border border-border/50">
                    <Trophy className="size-5" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-bold font-heading text-primary text-lg leading-tight">
                      Leaderboard & Streaks
                    </h3>
                    <p className="text-muted-foreground text-[14px] font-medium leading-relaxed">
                      Compete with other aspirants. Stay consistent with daily streaks and rank tracking.
                    </p>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </main>
      </div>
      <DailyDosePromo />
    </>
  )
}