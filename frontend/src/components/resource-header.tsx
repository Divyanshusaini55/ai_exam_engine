'use client'

import { BookmarkIcon, CheckCircleIcon, EyeIcon, ArrowLeftIcon, ClockIcon } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Cormorant_Garamond } from 'next/font/google'

const cormorantGaramond = Cormorant_Garamond({ 
  subsets: ['latin'], 
  weight: ['300', '400', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
});

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
      <div className="mx-auto max-w-6xl px-2 sm:px-4">
        <div className="flex min-h-16 items-center justify-between py-2">
          
          {/* ── Left: Back | Breadcrumb & Title ─────────────────────────── */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="shrink-0 rounded-full bg-muted/50 p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Back to roadmap"
            >
              <ArrowLeftIcon className="size-4" />
            </button>
            <div className="flex flex-col">
              <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                <button 
                  onClick={() => router.back()} 
                  className="hover:text-foreground hover:underline"
                >
                  Roadmaps
                </button>
                <span aria-hidden>›</span>
                <span>{resourceType.replace(/_/g, ' ')}</span>
              </nav>
              <h1 
                className={cn(
                  "text-xl font-bold leading-none text-foreground mt-0.5",
                  cormorantGaramond.className
                )}
              >
                {title}
              </h1>
            </div>
          </div>

          {/* ── Right: Meta Stats & Actions ─────────────────────────── */}
          <div className="flex items-center gap-4 sm:gap-6">
            
            {/* Meta stats (hidden on mobile to save space) */}
            <div className="hidden items-center gap-4 text-xs text-muted-foreground md:flex">
              <span className="flex items-center gap-1.5">
                <ClockIcon className="size-3.5" />
                {estimatedReadMinutes} min read
              </span>
              <span className="flex items-center gap-1.5">
                <EyeIcon className="size-3.5" />
                {viewCount.toLocaleString()} views
              </span>
            </div>

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-2">
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

        </div>
      </div>
    </header>
  )
}
