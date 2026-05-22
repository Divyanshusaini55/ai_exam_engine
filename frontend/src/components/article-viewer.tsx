'use client'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import LatexRenderer from './latex-renderer'
import MarkdownRenderer from './markdown-renderer'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ArticleViewerProps {
  content: string
  contentFormat: 'markdown' | 'html' | 'plaintext' | 'url'
  aiSummary?: string
  resourceType?: string
  externalUrl?: string
  className?: string
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Notion-style callout with amber left border for AI summaries. */
function AiSummaryCallout({ summary }: { summary: string }) {
  return (
    <div
      className={cn(
        'flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4',
        'dark:border-amber-900/40 dark:bg-amber-950/20',
        'mb-6'
      )}
    >
      {/* Amber accent bar */}
      <div className="w-1 shrink-0 rounded-full bg-amber-400 dark:bg-amber-500" />

      <div className="min-w-0 flex-1">
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
          ✦ AI Summary
        </p>
        <p className="text-sm leading-relaxed text-amber-900 dark:text-amber-100">
          {summary}
        </p>
      </div>
    </div>
  )
}

/** Loading state — 3 animated skeleton lines. */
function ContentSkeleton() {
  return (
    <div className="space-y-3 py-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  )
}

/** Card shown for external link / URL-only resources. */
function ExternalLinkCard({ url }: { url: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card py-16 text-center shadow-sm">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted">
        {/* Globe icon via SVG — no extra dependency */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-7 text-muted-foreground"
          aria-hidden
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      </div>

      <div>
        <p className="text-base font-semibold text-foreground">
          External Resource
        </p>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          This resource is hosted externally. Click below to open it in a new tab.
        </p>
      </div>

      <Button asChild size="lg">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open Resource&nbsp;↗
        </a>
      </Button>
    </div>
  )
}

// ─── ArticleViewer ─────────────────────────────────────────────────────────────

/**
 * ArticleViewer
 *
 * Renders a resource's content in the appropriate format:
 *  - external_link / url  → ExternalLinkCard with "Open Resource ↗"
 *  - empty content        → ContentSkeleton (3 animated lines)
 *  - non-empty content    →
 *      • optional AiSummaryCallout above the body
 *      • markdown  → MarkdownRenderer  (KaTeX math, GFM)
 *      • html      → LatexRenderer     (DOMPurify + MathJax)
 *      • plaintext → <pre> monospace block
 */
export default function ArticleViewer({
  content,
  contentFormat,
  aiSummary,
  resourceType,
  externalUrl,
  className,
}: ArticleViewerProps) {
  // ── 1. External link / URL-only resource ──────────────────────────────────
  if (resourceType === 'external_link' || contentFormat === 'url') {
    return (
      <div className={cn('w-full', className)}>
        <ExternalLinkCard url={externalUrl ?? '#'} />
      </div>
    )
  }

  // ── 2. Content not yet loaded → skeleton ──────────────────────────────────
  if (!content) {
    return (
      <div className={cn('w-full', className)}>
        <ContentSkeleton />
      </div>
    )
  }

  // ── 3+4. Content body with optional AI callout ────────────────────────────
  return (
    <div className={cn('w-full', className)}>
      {/* AI Summary callout — shown only when summary is non-empty */}
      {aiSummary && aiSummary.trim().length > 0 && (
        <AiSummaryCallout summary={aiSummary.trim()} />
      )}

      {/* Main content */}
      {contentFormat === 'markdown' && (
        <MarkdownRenderer content={content} />
      )}

      {contentFormat === 'html' && (
        <LatexRenderer content={content} />
      )}

      {contentFormat === 'plaintext' && (
        <pre className="whitespace-pre-wrap font-mono text-sm">{content}</pre>
      )}
    </div>
  )
}
