"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useAuth } from "@/context/auth-context"
import { CategoryGrid } from "@/components/category-grid"
import { Navbar } from "@/components/navbar"
import { HomeSkeleton } from "@/components/home-skeleton"



export function ExamHome() {
  const [dataLoaded, setDataLoaded] = useState(false)
  const router = useRouter()

  // Callback from CategoryGrid when data is loaded
  const handleDataLoaded = useCallback(() => {
    console.log('🎉 Data loaded, hiding skeleton')
    setDataLoaded(true)
  }, [])

  return (
    <>
      {/* Show skeleton overlay while loading */}
      {!dataLoaded && (
        <div className="fixed inset-0 z-50 bg-white dark:bg-slate-950">
          <HomeSkeleton />
        </div>
      )}

      {/* Real content (always rendered, but hidden until loaded) */}
      <div className={`min-h-screen bg-gradient-to-b from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950 transition-all duration-500 ${dataLoaded ? 'opacity-100 animate-fade-in' : 'opacity-0'}`}>
        <Navbar />

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center py-12 px-4 md:px-8">
          <div className="w-full max-w-7xl flex flex-col gap-10">
            {/* Hero Section */}
            <div className="flex flex-col gap-4 md:gap-6 md:items-start pt-4 pb-2">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white text-balance">
                Competitive Exam Platform
              </h1>
              <p className="text-lg md:text-xl text-slate-500 dark:text-slate-400 font-medium max-w-2xl">
                Prepare for SSC, UPSC, Railways, Defence, and Banking exams with our comprehensive test series.
              </p>
            </div>

            {/* Category Grid - Always rendered to trigger data fetch */}
            <CategoryGrid onDataLoaded={handleDataLoaded} />
          </div>
        </main>
      </div>
    </>
  )
}