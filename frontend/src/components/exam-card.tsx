"use client"

import { useRouter } from "next/navigation"
import { Clock, FileQuestion, ArrowRight } from "lucide-react"
import { CategoryHomeIcon } from "@/components/category-home-icon"

interface ExamCardProps {
  id: number
  slug: string
  title: string
  description: string
  duration: number
  questions: number
  /** Category slug from API, e.g. ssc, railways */
  category: string
}

export function ExamCard({ id, slug, title, description, duration, questions, category }: ExamCardProps) {
  const router = useRouter()

  return (
    <div className="group card-premium relative flex h-full flex-col overflow-hidden p-6">
      <div className="absolute inset-0 bg-gradient-to-br from-secondary/50 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

      <div className="relative z-10 flex h-full flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <CategoryHomeIcon iconName="" categoryLabel={category} />
          <span className="rounded-full border border-success/20 bg-success/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-success">
            Available
          </span>
        </div>

        <div className="mt-2 flex-grow space-y-2">
          <h3 className="font-heading text-[22px] font-bold leading-tight text-primary">{title}</h3>
          <p className="line-clamp-2 text-[15px] font-medium leading-relaxed text-muted-foreground">
            {description || "Access high-quality mock tests and previous year papers for your preparation."}
          </p>
        </div>

        <div className="mt-auto border-t border-border pt-4">
          <div className="flex items-center gap-6 pb-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              <span>{duration}m</span>
            </div>
            <div className="flex items-center gap-2">
              <FileQuestion className="size-4 text-primary" />
              <span>{questions} Qs</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push(`/exam/${slug}`)}
            className="flex w-full items-center justify-between rounded-xl border border-border bg-background p-3 text-sm font-semibold text-primary transition-all duration-300 group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground"
          >
            <span>View details</span>
            <ArrowRight className="size-5 transition-transform duration-300 group-hover:translate-x-2" />
          </button>
        </div>
      </div>
    </div>
  )
}
