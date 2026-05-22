'use client'

import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import rehypeSlug from 'rehype-slug'

import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MarkdownRendererProps {
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

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * MarkdownRenderer
 *
 * Renders GitHub-Flavoured Markdown with full math support via KaTeX.
 * Uses react-markdown with:
 *   - remark-math  → parses $…$ and $$…$$ math nodes
 *   - rehype-katex → renders them to KaTeX HTML (requires katex CSS in globals.css)
 *   - rehype-raw   → allows raw HTML embedded in markdown
 *   - rehype-slug  → adds id attributes to headings for anchor links
 *
 * Wrapped in Tailwind Typography prose classes for polished article styling.
 */
export default function MarkdownRenderer({
  content,
  className,
}: MarkdownRendererProps) {
  return (
    <div className={cn(proseClasses, className)}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeRaw, rehypeSlug]}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
