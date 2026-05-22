'use client'

import { BookmarkIcon, CheckCircleIcon, EyeIcon, ArrowLeftIcon, ClockIcon } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ResourceHeaderProps {
  title: string
  difficulty: 'beginner' | 'intermediate' | 'advanced' | string
  estimatedReadMinutes: number
  viewCount: number
  resourceType: string
  isCompleted: boolean
  isBookmarked: boolean
  onMarkDone: () => void
  onBookmark: () => void
  className?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DIFFICULTY_STYLES: Record<string, string> = {
  beginner:     'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  intermediate: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  advanced:     'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
        DIFFICULTY_STYLES[difficulty] ?? 'bg-muted text-muted-foreground'
      )}
    >
      {difficulty}
    </span>
  )
}

function ResourceTypeBadge({ type }: { type: string }) {
  const label = type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      {label}
    </span>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * ResourceHeader
 *
 * Five-row article header:
 *  Row 1 – ← Back | centered title | view count + Save + Mark Done actions
 *  Row 2 – Breadcrumb "Roadmaps › Article"
 *  Row 3 – type badge + difficulty badge
 *  Row 4 – <h1> title
 *  Row 5 – ⏱ X min read  👁 Y views
 */
export default function ResourceHeader({
  title,
  difficulty,
  estimatedReadMinutes,
  viewCount,
  resourceType,
  isCompleted,
  isBookmarked,
  onMarkDone,
  onBookmark,
  className,
}: ResourceHeaderProps) {
  const router = useRouter()

  return (
    <header
      className={cn(
        'sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md',
        className
      )}
    >
      <div className="mx-auto max-w-6xl px-4">

        {/* ── Row 1: Back | ghost title | actions ─────────────────────────── */}
        <div className="flex h-14 items-center gap-3">
          {/* Back */}
          <button
            onClick={() => router.back()}
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Back to roadmap"
          >
            <ArrowLeftIcon className="size-4" />
          </button>

          {/* Actions - Pushed to the right automatically because we use flex-1 on an empty div to take up space, or just keep it ml-auto */}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {/* Save / Bookmark */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onBookmark}
              aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this resource'}
              className="gap-1.5 rounded-full"
            >
              <BookmarkIcon
                className={cn(
                  'size-4 transition-colors',
                  isBookmarked
                    ? 'fill-primary stroke-primary'
                    : 'fill-none stroke-current'
                )}
              />
              <span className="hidden sm:inline">
                {isBookmarked ? 'Saved' : 'Save'}
              </span>
            </Button>

            {/* Mark Done */}
            <Button
              variant={isCompleted ? 'secondary' : 'outline'}
              size="sm"
              onClick={onMarkDone}
              aria-label={isCompleted ? 'Mark as not done' : 'Mark as done'}
              className="gap-1.5 rounded-full"
            >
              <CheckCircleIcon
                className={cn(
                  'size-4 transition-colors',
                  isCompleted ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
                )}
              />
              <span className="hidden sm:inline">
                {isCompleted ? 'Done' : 'Mark Done'}
              </span>
            </Button>
          </div>
        </div>

        {/* ── Rows 2–5: article identity ───────────────────────────────────── */}
        <div className="pb-5 pt-2">
          {/* Row 2: Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-3">
            <ol className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <li>
                <button 
                  onClick={() => router.back()} 
                  className="hover:text-foreground hover:underline"
                >
                  Roadmaps
                </button>
              </li>
              <li aria-hidden>›</li>
              <li className="font-medium text-foreground capitalize">
                {resourceType.replace(/_/g, ' ')}
              </li>
            </ol>
          </nav>

          {/* Row 4: Title */}
          <h1 className="mb-2 text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>

          {/* Row 5: Meta stats */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <ClockIcon className="size-4" />
              {estimatedReadMinutes} min read
            </span>
            <span className="flex items-center gap-1.5">
              <EyeIcon className="size-4" />
              {viewCount.toLocaleString()} views
            </span>
          </div>
        </div>

      </div>
    </header>
  )
}
