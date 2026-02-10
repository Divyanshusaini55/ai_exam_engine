"use client"
import { useRouter } from "next/navigation"

interface ExamCardProps {
  id: number
  title: string
  description: string
  duration: number
  questions: number
  category: string
}

export function ExamCard({ id, title, description, duration, questions, category }: ExamCardProps) {
  const router = useRouter()

  return (
    <div className="group relative bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 via-transparent to-blue-500/0 group-hover:from-blue-500/5 transition-all duration-500" />
      
      <div className="relative flex flex-col gap-4 h-full">
        <div className="flex justify-between items-start">
          <div className="size-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <span className="material-symbols-outlined text-[28px]">article</span>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold uppercase">
            Available
          </span>
        </div>

        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-primary transition-colors">
            {title}
          </h3>
          <p className="text-sm text-slate-500 line-clamp-2">{description || "No description provided."}</p>
        </div>

        <div className="border-t border-dashed border-gray-200 my-2" />

        <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
          <div className="flex items-center gap-1.5">
            <span>⏱️</span> {duration} min
          </div>
          <div className="flex items-center gap-1.5">
            <span>❓</span> {questions} Q
          </div>
        </div>

        <button
          onClick={() => router.push(`/exam/${id}`)} // Goes to Exam Details Page
          className="w-full py-2.5 rounded-lg bg-primary hover:bg-blue-700 text-white text-sm font-semibold shadow-md transition-all flex items-center justify-center gap-2 mt-auto"
        >
          Start Exam
        </button>
      </div>
    </div>
  )
}