"use client"

import { useState } from "react"
import { examApi } from "@/lib/api"
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'

interface QuestionReviewProps {
  number: number
  questionId: number
  question: string
  subject?: string
  status: "correct" | "incorrect" | "skipped"
  userAnswer: { option: string; value: string }
  correctAnswer?: { option: string; value: string }
  explanation?: string | null
}

export function QuestionReview({
  number,
  questionId,
  question,
  subject,
  status,
  userAnswer,
  correctAnswer,
  explanation: initialExplanation,
}: QuestionReviewProps) {
  const isCorrect = status === "correct"
  const isSkipped = status === "skipped"

  const [explanation, setExplanation] = useState<string | null>(initialExplanation || null)
  const [isVisible, setIsVisible] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleExplainClick = async () => {
    if (explanation) {
      setIsVisible(true)
      return
    }

    setLoading(true)
    try {
      const res = await examApi.explainQuestion(questionId)
      setExplanation(res.data.explanation)
      setIsVisible(true)
    } catch (error) {
      console.error("Failed to explain", error)
    } finally {
      setLoading(false)
    }
  }

  // Define Badge Styles
  const badgeStyle = isCorrect
    ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
    : isSkipped
      ? "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
      : "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"

  const statusText = isCorrect ? "CORRECT" : isSkipped ? "SKIPPED" : "INCORRECT"

  return (
    <div className="glass-panel rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-300">
      <div className="p-6 flex flex-col gap-6">

        {/* ROW 1: Header (Subject + Status) */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {subject && (
              <span className="px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 text-[10px] font-bold uppercase tracking-wider border border-blue-100 dark:border-blue-800">
                {subject}
              </span>
            )}
            <span className="text-sm font-bold text-slate-400">Question {number}</span>
          </div>

          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${badgeStyle}`}>
            {statusText}
          </span>
        </div>

        {/* ROW 2: Question Text */}
        <div className="text-base md:text-lg font-medium text-slate-900 dark:text-white leading-relaxed">
          <ReactMarkdown
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
              p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />
            }}
          >
            {question}
          </ReactMarkdown>
        </div>

        {/* ROW 3: Answers Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* User Answer */}
          <div className={`flex flex-col gap-1 p-3 rounded-lg border-l-4 ${isCorrect ? "bg-green-50 border-green-500 dark:bg-green-900/10" :
              isSkipped ? "bg-slate-50 border-slate-400 dark:bg-slate-900/50" :
                "bg-red-50 border-red-500 dark:bg-red-900/10"
            }`}>
            <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Your Answer</span>
            <span className={`text-sm font-medium ${isCorrect ? "text-green-700 dark:text-green-400" :
                isSkipped ? "text-slate-500 dark:text-slate-500 italic" :
                  "text-red-700 dark:text-red-400"
              }`}>
              {userAnswer.value}
            </span>
          </div>

          {/* Correct Answer */}
          <div className="flex flex-col gap-1 p-3 rounded-lg border-l-4 bg-emerald-50 border-emerald-500 dark:bg-emerald-900/10">
            <span className="text-xs font-bold uppercase text-emerald-600 dark:text-emerald-500 mb-1">Correct Answer</span>
            <span className="text-sm font-medium text-emerald-800 dark:text-emerald-400">
              {correctAnswer?.value || "—"}
            </span>
          </div>
        </div>

        {/* ROW 4: AI Explanation */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
          {!isVisible ? (
            <button
              onClick={handleExplainClick}
              disabled={loading}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 rounded-lg text-sm font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                  Generating Explanation...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">auto_awesome</span>
                  {explanation ? "Show AI Explanation" : "AI Explain This Question"}
                </>
              )}
            </button>
          ) : (
            <div className="animate-fade-in bg-indigo-50/50 dark:bg-indigo-900/10 p-5 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400 text-xl">auto_awesome</span>
                <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">AI Explanation</span>
                <button
                  onClick={() => setIsVisible(false)}
                  className="ml-auto text-xs text-slate-400 hover:text-slate-600 hover:underline"
                >
                  Hide
                </button>
              </div>

              <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed prose prose-indigo dark:prose-invert max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {explanation}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}