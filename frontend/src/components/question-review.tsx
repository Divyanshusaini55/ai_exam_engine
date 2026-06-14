"use client"

import { useState } from "react"
import { examApi } from "@/lib/api"
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { Sparkles } from "lucide-react"

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

  // Status badge — uses semantic tokens, works in both themes
  const badgeStyle = isCorrect
    ? "bg-success/10 text-success border-success/30"
    : isSkipped
      ? "bg-secondary text-muted-foreground border-border"
      : "bg-destructive/10 text-destructive border-destructive/30"

  const statusText = isCorrect ? "CORRECT" : isSkipped ? "SKIPPED" : "INCORRECT"

  return (
    <div id={`question-${questionId}`} className="card-premium rounded-xl overflow-hidden scroll-mt-24">
      <div className="p-6 flex flex-col gap-6">

        {/* ROW 1: Header (Subject tag + Status badge) */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {subject && (
              <span className="px-2.5 py-1 rounded-md bg-secondary text-primary text-[10px] font-bold uppercase tracking-wider border border-border">
                {subject}
              </span>
            )}
            <span className="text-sm font-bold text-muted-foreground">Question {number}</span>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${badgeStyle}`}>
            {statusText}
          </span>
        </div>

        {/* ROW 2: Question Text */}
        <div className="text-base md:text-lg font-medium text-primary leading-relaxed">
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
          <div className={`flex flex-col gap-1 p-4 rounded-xl border transition-all duration-300 hover:shadow-sm hover:scale-[1.01] ${
            isCorrect
              ? "bg-success/5 border-success/50 hover:bg-success/10 hover:border-success"
              : isSkipped
                ? "bg-secondary/50 border-muted-foreground/30 hover:bg-secondary/70"
                : "bg-destructive/5 border-destructive/50 hover:bg-destructive/10 hover:border-destructive"
          }`}>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
              Your Answer
            </span>
            <span className={`text-sm font-semibold ${
              isCorrect
                ? "text-success"
                : isSkipped
                  ? "text-muted-foreground italic"
                  : "text-destructive"
            }`}>
              {userAnswer.value}
            </span>
          </div>

          {/* Correct Answer — always on-brand success green */}
          <div className="flex flex-col gap-1 p-4 rounded-xl border border-success/50 bg-success/5 transition-all duration-300 hover:bg-success/10 hover:border-success hover:shadow-sm hover:scale-[1.01]">
            <span className="text-[10px] font-bold uppercase tracking-widest text-success mb-1">
              Correct Answer
            </span>
            <span className="text-sm font-semibold text-success">
              {correctAnswer?.value || "—"}
            </span>
          </div>
        </div>

        {/* ROW 4: AI Explanation */}
        <div className="pt-4 border-t border-border">
          {!isVisible ? (
            <button
              onClick={handleExplainClick}
              disabled={loading}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-secondary text-primary rounded-xl text-sm font-bold hover:bg-secondary/70 transition-colors disabled:opacity-50 border border-border"
            >
              {loading ? (
                <>
                  <span className="size-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Generating Explanation...
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  {explanation ? "Show AI Explanation" : "AI Explain This Question"}
                </>
              )}
            </button>
          ) : (
            <div className="animate-fade-in bg-secondary/40 p-5 rounded-xl border border-border">
              <div className="flex items-center gap-2 mb-3 px-1">
                <Sparkles className="size-5 text-primary" />
                <span className="text-sm font-bold text-primary">AI Explanation</span>
                <button
                  onClick={() => setIsVisible(false)}
                  className="ml-auto text-xs text-muted-foreground hover:text-primary hover:underline"
                >
                  Hide
                </button>
              </div>
              <div className="text-sm text-primary leading-relaxed prose prose-neutral dark:prose-invert max-w-none">
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