"use client"

import { useEffect, useState } from "react"

export function SubmissionLoadingState() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 100
        return prev + Math.random() * 15
      })
    }, 500)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden">
      {/* Ambient Background Gradient Blobs */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-primary/20 dark:bg-primary/10 blur-[130px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-blue-300/30 dark:bg-blue-600/10 blur-[100px]"></div>
        <div className="absolute top-[30%] left-[60%] w-[25vw] h-[25vw] rounded-full bg-indigo-200/20 dark:bg-indigo-900/10 blur-[80px]"></div>
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 w-full max-w-[960px] px-4 flex flex-col items-center justify-center gap-12">
        {/* Glassmorphic Card */}
        <div className="w-full max-w-[460px] bg-white/70 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/60 dark:border-slate-700/50 shadow-lg rounded-3xl p-8 md:p-10 flex flex-col items-center text-center transition-all">
          {/* Circular Loader Animation */}
          <div className="relative mb-8 size-24 flex items-center justify-center">
            {/* Static Background Ring */}
            <svg className="absolute inset-0 size-full text-slate-200 dark:text-slate-700/50" viewBox="0 0 100 100">
              <circle cx="50" cy="50" fill="none" r="44" stroke="currentColor" strokeWidth="4" />
            </svg>

            {/* Spinning Active Ring */}
            <svg
              className="absolute inset-0 size-full text-primary animate-spin"
              style={{ animation: "spin 1.5s linear infinite" }}
              viewBox="0 0 100 100"
            >
              <circle
                cx="50"
                cy="50"
                fill="none"
                r="44"
                stroke="currentColor"
                strokeDasharray="276"
                strokeDashoffset="180"
                strokeLinecap="round"
                strokeWidth="4"
              />
            </svg>

            {/* Center Icon */}
            <div className="relative z-10 text-primary/90 animate-pulse">
              <span className="text-4xl">📊</span>
            </div>
          </div>

          {/* Text Content */}
          <div className="space-y-3 mb-8">
            <h2 className="text-slate-900 dark:text-white text-2xl font-bold leading-tight tracking-tight">
              Analyzing your performance...
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-normal leading-relaxed px-2">
              Calculating your percentile and generating insights.
            </p>
          </div>

          {/* Progress Bar Component */}
          <div className="w-full flex flex-col gap-2.5">
            <div className="flex justify-between items-end px-1">
              <span className="text-xs font-bold text-primary uppercase tracking-widest opacity-80">
                Processing Data
              </span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden border border-slate-200/50 dark:border-slate-600/20">
              <div
                className="h-full bg-primary rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute inset-0 bg-white/20 w-full h-full animate-pulse"></div>
              </div>
            </div>
          </div>

          {/* Footer Warning */}
          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700/50 w-full flex justify-center">
            <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
              <span className="text-sm">ℹ️</span>
              <span className="text-xs font-medium">This may take a few seconds. Do not close this window.</span>
            </div>
          </div>
        </div>

        {/* Minimal Branding Footer */}
        <div className="opacity-40 hover:opacity-100 transition-opacity duration-300">
          <div className="flex items-center gap-2.5 text-slate-900 dark:text-white group cursor-default">
            <div className="size-5 bg-primary rounded"></div>
            <h2 className="text-sm font-bold leading-tight tracking-tight">ExamPlatform</h2>
          </div>
        </div>
      </div>
    </div>
  )
}
