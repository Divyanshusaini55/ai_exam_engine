'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Heading {
  level: 1 | 2 | 3
  text: string
  id: string
}

interface ResourceSidebarProps {
  content: string
  contentFormat: string
  className?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Turn any heading text into a URL-safe id (mirrors rehype-slug behaviour). */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Extract headings from Markdown source via regex. */
function extractMarkdownHeadings(content: string): Heading[] {
  const headings: Heading[] = []
  const re = /^(#{1,3})\s+(.+)/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    const level = m[1].length as 1 | 2 | 3
    const text = m[2].trim()
    headings.push({ level, text, id: slugify(text) })
  }
  return headings
}

/** Extract headings from HTML via DOMParser (browser-only). */
function extractHtmlHeadings(html: string): Heading[] {
  if (typeof window === 'undefined') return []
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const nodes = doc.querySelectorAll('h1, h2, h3')
  return Array.from(nodes).map((el) => {
    const level = Number(el.tagName[1]) as 1 | 2 | 3
    const text = el.textContent?.trim() ?? ''
    // prefer existing id (rehype-slug may have set it), else slugify
    const id = el.id || slugify(text)
    return { level, text, id }
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * ResourceSidebar
 *
 * Renders a sticky "ON THIS PAGE" navigation list extracted from the
 * article's headings (h1–h3).  Highlights the currently visible section
 * using an IntersectionObserver.  Returns null if no headings are found.
 */
export default function ResourceSidebar({
  content,
  contentFormat,
  className,
}: ResourceSidebarProps) {
  const [headings, setHeadings] = useState<Heading[]>([])
  const [activeId, setActiveId] = useState<string>('')
  const observerRef = useRef<IntersectionObserver | null>(null)

  // ── Extract headings ───────────────────────────────────────────────────────
  useEffect(() => {
    if (contentFormat === 'markdown') {
      setHeadings(extractMarkdownHeadings(content))
    } else if (contentFormat === 'html') {
      setHeadings(extractHtmlHeadings(content))
    } else {
      setHeadings([])
    }
  }, [content, contentFormat])

  // ── IntersectionObserver — track active heading ────────────────────────────
  useEffect(() => {
    if (headings.length === 0) return

    observerRef.current?.disconnect()

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the topmost intersecting heading
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)

        if (visible.length > 0) {
          setActiveId(visible[0].target.id)
        }
      },
      {
        rootMargin: '-80px 0px -60% 0px',
        threshold: 0,
      }
    )

    headings.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    observerRef.current = observer

    return () => observer.disconnect()
  }, [headings])

  // ── Nothing to show ────────────────────────────────────────────────────────
  if (headings.length === 0) return null

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <aside className={cn("w-56 shrink-0 hidden lg:block", className)}>
      <nav
        aria-label="On this page"
        className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto"
      >
        <p className="mb-3 text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
          On This Page
        </p>

        <ul className="space-y-1">
          {headings.map(({ level, text, id }) => {
            const isActive = activeId === id
            return (
              <li
                key={id}
                style={{
                  paddingLeft:
                    level === 2 ? '0.75rem' : level === 3 ? '1.5rem' : '0',
                }}
              >
                <a
                  href={`#${id}`}
                  onClick={(e) => {
                    e.preventDefault()
                    document
                      .getElementById(id)
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    setActiveId(id)
                  }}
                  className={cn(
                    'flex items-center gap-2 rounded py-1 text-sm transition-colors',
                    isActive
                      ? 'font-medium text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {/* Dot indicator */}
                  <span
                    className={cn(
                      'size-1.5 shrink-0 rounded-full transition-colors',
                      isActive ? 'bg-primary' : 'bg-transparent'
                    )}
                  />
                  <span className="line-clamp-2 leading-snug">{text}</span>
                </a>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
