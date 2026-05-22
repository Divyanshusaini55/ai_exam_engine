'use client'

import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LatexRendererProps {
  /** Pre-rendered HTML string produced by the backend pandoc pipeline. */
  content: string
  className?: string
}

// ─── Shared prose class string ─────────────────────────────────────────────────

const proseClasses =
  'prose prose-neutral dark:prose-invert max-w-none ' +
  'prose-headings:font-bold prose-headings:scroll-mt-20 ' +
  'prose-code:bg-muted prose-code:rounded prose-code:px-1 ' +
  'prose-code:before:content-none prose-code:after:content-none ' +
  'prose-pre:bg-muted prose-pre:rounded-lg prose-pre:p-4'

// ─── MathJax ambient type ──────────────────────────────────────────────────────

declare global {
  interface Window {
    MathJax?: {
      typesetPromise?: (elements?: Element[]) => Promise<void>
    }
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * LatexRenderer
 *
 * Renders HTML that was already converted from LaTeX by the backend's
 * pandoc pipeline (with --mathjax).  The HTML may contain MathJax-style
 * math spans/scripts, so we:
 *
 * 1. Dynamically import DOMPurify (browser-only) and sanitize the HTML on
 *    the client so no XSS vectors survive.
 * 2. Insert the sanitised HTML via dangerouslySetInnerHTML.
 * 3. Ask MathJax to re-typeset the container after render so any math
 *    elements that were injected as HTML strings get properly rendered.
 *
 * Returns null until sanitisation is complete to avoid a flash of raw HTML.
 */
export default function LatexRenderer({
  content,
  className,
}: LatexRendererProps) {
  const [sanitizedContent, setSanitizedContent] = useState<string | null>(null)

  // ── Step 1: sanitise with DOMPurify (dynamic import — browser only) ─────────
  useEffect(() => {
    if (!content) {
      setSanitizedContent('')
      return
    }

    let cancelled = false

    import('dompurify').then(({ default: DOMPurify }) => {
      if (cancelled) return

      const clean = DOMPurify.sanitize(content, {
        // Allow MathJax-generated elements and common article markup
        ADD_TAGS: [
          'math', 'mrow', 'mi', 'mo', 'mn',
          'msup', 'msub', 'mfrac', 'msqrt', 'mtext',
          'annotation', 'semantics',
        ],
        ADD_ATTR: [
          'encoding',   // <annotation encoding="application/x-tex">
          'display',    // <math display="block">
          'xmlns',      // MathML namespace
        ],
        FORCE_BODY: false,
      })

      setSanitizedContent(clean)
    })

    return () => {
      cancelled = true
    }
  }, [content])

  // ── Step 2: ask MathJax to re-typeset after the HTML lands in the DOM ───────
  useEffect(() => {
    if (sanitizedContent === null) return

    window.MathJax?.typesetPromise?.()
  }, [sanitizedContent])

  // Render nothing until sanitisation is ready (prevents raw HTML flash)
  if (sanitizedContent === null) return null

  return (
    <div
      className={cn(proseClasses, className)}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  )
}
