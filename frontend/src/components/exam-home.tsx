"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useAuth } from "@/context/auth-context"
import { CategoryGrid } from "@/components/category-grid"
import { Navbar } from "@/components/navbar"
import { HomeSkeleton } from "@/components/home-skeleton"
import { DailyDosePromo } from "@/components/daily-dose-promo"
import { LayoutTextFlip } from "@/components/ui/layout-text-flip"
import { motion } from "motion/react"
import {
  BookOpen,
  FileQuestion,
  Sparkles,
  Monitor,
  ClipboardCheck,
  TrendingUp,
  Trophy,
  Flame,
  Activity,
  CircleUserRound
} from "lucide-react"


export function ExamHome() {
  const [dataLoaded, setDataLoaded] = useState(false)
  const router = useRouter()

  // Callback from CategoryGrid when data is loaded
  const handleDataLoaded = useCallback(() => {
    setDataLoaded(true)
  }, [])

  const examTags = ["SSC", "UPSC", "Banking", "Railways", "Defence", "State PSC"]

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

            {/* Hero Section */}
            <div className="flex flex-col gap-6 items-center max-w-4xl mx-auto pt-10 pb-8 animate-fade-in">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-primary font-bold text-[11px] uppercase tracking-widest shadow-sm mb-4">
                <Sparkles className="size-3.5 text-primary" />
                <span>The Future of Exam Prep is Here</span>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-[60px] leading-[1.1] font-bold font-heading text-primary tracking-tight text-balance flex flex-wrap justify-center items-center gap-x-3 gap-y-2">
                <LayoutTextFlip
                  text="Master your exams with"
                  words={["AI precision.", "deep analytics.", "smart learning."]}
                  textClassName="!font-heading font-bold text-primary"
                  className="!font-heading font-bold text-blue-600 dark:text-blue-400"
                />
              </h1>

              <p className="text-lg md:text-xl text-muted-foreground font-medium max-w-2xl mt-2 leading-relaxed">
                A premium class platform engineered to accelerate your preparation for competitive exams through real-time analytics and expansive test series.
              </p>

              {/* Exam Tags */}
              <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
                {examTags.map(tag => (
                  <span key={tag} className="px-5 py-2 rounded-full border border-border bg-card shadow-sm text-[13px] font-bold text-primary transition-all duration-300 hover:shadow-premium hover:-translate-y-0.5 cursor-default">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Mock Dashboard Illustration */}
            <div className="w-full max-w-5xl mx-auto mt-16 mb-24 relative animate-fade-in" style={{ animationDelay: "200ms" }}>
              {/* Bottom fade */}
              <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none" />

              <div className="w-full rounded-t-[32px] border-t border-l border-r border-border bg-card shadow-[0_-20px_60px_rgba(0,0,0,0.06)] overflow-hidden">
                {/* Mock Navbar */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/80">
                  <div className="flex items-center gap-3">
                    <motion.div 
                      animate={{ opacity: [0.7, 1, 0.7] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                      className="size-7 bg-primary rounded-lg" 
                    />
                    <div className="h-4 w-28 bg-primary/20 rounded-md overflow-hidden relative">
                       <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent dark:via-white/20 via-black/10 to-transparent -translate-x-full" animate={{ translateX: ["-100%", "200%"] }} transition={{ duration: 3, repeat: Infinity, ease: "linear", repeatDelay: 2 }} />
                    </div>
                  </div>
                  <div className="hidden md:flex items-center gap-6">
                    {[60, 50, 70, 55].map((w, i) => (
                      <motion.div key={i} animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 3, delay: i * 0.2, repeat: Infinity }} className="h-3 bg-primary/15 rounded-full" style={{ width: `${w}px` }} />
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-20 bg-secondary rounded-lg border border-border flex items-center justify-center">
                      <div className="h-2 w-12 bg-primary/20 rounded-full" />
                    </div>
                    <motion.div whileHover={{ scale: 1.1 }} className="size-8 rounded-full bg-secondary border border-border flex items-center justify-center overflow-hidden cursor-pointer">
                      <CircleUserRound className="size-4 text-muted-foreground/50" />
                    </motion.div>
                  </div>
                </div>

                {/* Mock Content */}
                <div className="p-6 flex flex-col gap-5">
                  {/* Page Title + CTA */}
                  <div className="flex justify-between items-center text-left">
                    <div>
                      <div className="h-5 w-40 bg-primary/20 rounded-lg mb-2" />
                      <div className="h-3 w-56 bg-primary/10 rounded-md" />
                    </div>
                    <div className="h-9 w-28 bg-primary rounded-xl" />
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: "Tests Taken", value: "48", icon: ClipboardCheck, color: "bg-primary/5" },
                      { label: "Avg. Score", value: "82%", icon: TrendingUp, color: "bg-primary/5" },
                      { label: "Rank", value: "#12", icon: Trophy, color: "bg-primary/5" },
                      { label: "Streak", value: "7d", icon: Flame, color: "bg-primary/5" },
                    ].map((stat, i) => (
                      <motion.div 
                        key={i} 
                        whileHover={{ scale: 1.02 }}
                        className={`${stat.color} rounded-2xl p-4 border border-border flex flex-col items-start text-left relative overflow-hidden`}
                      >
                        {/* Soft sleek shimmer */}
                        <motion.div
                          className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent dark:via-white/10 via-black/5 to-transparent skew-x-12"
                          animate={{ translateX: ['-100%', '200%'] }}
                          transition={{ duration: 3, repeat: Infinity, delay: i * 0.4, ease: "easeInOut", repeatDelay: 2 }}
                        />
                        <div className="size-8 rounded-lg bg-card border border-border flex items-center justify-center text-primary shadow-sm mb-3">
                          <stat.icon className="size-4.5" />
                        </div>
                        <div className="h-6 flex items-center">
                          <span className="text-[18px] font-bold text-primary tracking-tight">
                            {stat.value}
                          </span>
                        </div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                          {stat.label}
                        </p>
                      </motion.div>
                    ))}
                  </div>

                  {/* Two column: Chart + Recents */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Chart */}
                    <div className="md:col-span-2 bg-secondary/20 rounded-2xl border border-border p-5 text-left">
                      <div className="flex justify-between items-center mb-5">
                        <div className="h-4 w-36 bg-primary/20 rounded-lg overflow-hidden relative">
                           <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent dark:via-white/30 via-black/10 to-transparent -translate-x-full" animate={{ translateX: ["-100%", "200%"] }} transition={{ duration: 2.5, repeat: Infinity, ease: "linear", repeatDelay: 1.5 }} />
                        </div>
                        <div className="h-3 w-20 bg-primary/10 rounded-full" />
                      </div>
                      {/* Bar Chart */}
                      <div className="flex items-end gap-2 h-20">
                        {[40, 65, 50, 80, 60, 90, 72].map((h, i) => (
                          <div key={i} className="flex-1 rounded-t-lg bg-primary/10 relative overflow-hidden" style={{ height: `${h}%` }}>
                            <motion.div 
                              className="absolute bottom-0 inset-x-0 w-full rounded-t-lg bg-primary/40 origin-bottom" 
                              animate={{ height: [`${h * 0.4}%`, `${Math.min(100, h * 0.9)}%`, `${h * 0.4}%`] }}
                              transition={{ duration: 4 + i * 0.5, repeat: Infinity, ease: "easeInOut" }}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-2">
                        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                          <div key={i} className="flex-1 text-center text-[9px] text-muted-foreground font-bold">{d}</div>
                        ))}
                      </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="bg-secondary/20 rounded-2xl border border-border p-5 text-left overflow-hidden">
                      <div className="h-4 w-24 bg-primary/20 rounded-lg mb-4" />
                      <div className="flex flex-col gap-3">
                        {[85, 72, 91].map((score, i) => (
                          <div 
                            key={i} 
                            className="flex items-center gap-3 p-2 bg-card rounded-xl border border-border shadow-sm"
                          >
                            <div className="size-7 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                              <Activity className="size-3.5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="h-2.5 w-full bg-primary/15 rounded-full mb-1.5 overflow-hidden relative">
                                <motion.div 
                                  className="absolute left-0 top-0 bottom-0 bg-primary/40 rounded-full"
                                  animate={{ width: [`${score - 15}%`, `${score}%`, `${score - 15}%`] }}
                                  transition={{ duration: 4 + i * 0.5, repeat: Infinity, ease: "easeInOut" }}
                                />
                              </div>
                              <div className="h-2 w-2/3 bg-primary/10 rounded-full" />
                            </div>
                            <span className="text-[13px] font-bold text-primary flex-shrink-0">
                              {score}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Category Grid */}
            <div className="w-full relative z-20">
              <CategoryGrid onDataLoaded={handleDataLoaded} />
            </div>

            {/* Key Features Section */}
            <div className={`w-full flex flex-col gap-12 pt-24 pb-20 transition-all duration-700 delay-500 ${dataLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
              <div className="text-center">
                <h2 className="text-[40px] font-extrabold font-heading text-primary tracking-tight leading-tight">
                  Engineered for Excellence
                </h2>
                <p className="text-muted-foreground text-lg font-medium mt-4">Everything you need to secure top ranks.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

                {/* Feature 1 */}
                <div className="card-premium p-8 flex flex-col items-start gap-5 text-left">
                  <div className="size-12 rounded-2xl bg-secondary flex items-center justify-center text-primary shadow-sm border border-border/50">
                    <BookOpen className="size-6" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-bold font-heading text-primary text-[20px] leading-tight">
                      160+ Question Papers
                    </h3>
                    <p className="text-muted-foreground text-[15px] font-medium leading-relaxed">
                      Practice with a curated library of historical and mock papers.
                    </p>
                  </div>
                </div>

                {/* Feature 2 */}
                <div className="card-premium p-8 flex flex-col items-start gap-5 text-left">
                  <div className="size-12 rounded-2xl bg-secondary flex items-center justify-center text-primary shadow-sm border border-border/50">
                    <FileQuestion className="size-6" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-bold font-heading text-primary text-[20px] leading-tight">
                      50K+ Questions
                    </h3>
                    <p className="text-muted-foreground text-[15px] font-medium leading-relaxed">
                      Access a vast, categorized database of high-yield questions.
                    </p>
                  </div>
                </div>

                {/* Feature 3 */}
                <div className="card-premium p-8 flex flex-col items-start gap-5 text-left">
                  <div className="size-12 rounded-2xl bg-secondary flex items-center justify-center text-primary shadow-sm border border-border/50">
                    <Sparkles className="size-6" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-bold font-heading text-primary text-[20px] leading-tight">
                      AI Solutions
                    </h3>
                    <p className="text-muted-foreground text-[15px] font-medium leading-relaxed">
                      Instantly resolve doubts with intelligent, step-by-step AI breakdowns.
                    </p>
                  </div>
                </div>

                {/* Feature 4 */}
                <div className="card-premium p-8 flex flex-col items-start gap-5 text-left">
                  <div className="size-12 rounded-2xl bg-secondary flex items-center justify-center text-primary shadow-sm border border-border/50">
                    <Monitor className="size-6" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-bold font-heading text-primary text-[20px] leading-tight">
                      Exam Simulation
                    </h3>
                    <p className="text-muted-foreground text-[15px] font-medium leading-relaxed">
                      Train in a distraction-free environment mirroring real test engines.
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