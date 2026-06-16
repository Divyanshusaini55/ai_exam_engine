"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { useAuth } from "@/context/auth-context"
import {
  ArrowLeft, Bookmark, BookmarkCheck, CheckCircle2, Circle,
  Clock, ExternalLink, Loader2, Zap, AlertCircle, ChevronRight,
  Eye, Star, FileText, Hash
} from "lucide-react"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import rehypeHighlight from "rehype-highlight"
import rehypeSlug from "rehype-slug"


import "highlight.js/styles/github-dark.css"
import "@/styles/article.css"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:9000/api"

type Resource = {
  id: number
  topic: number
  title: string
  slug: string
  short_description: string
  resource_type: string
  resource_type_display: string
  content_format: string
  content_format_display: string
  markdown_content: string
  html_content: string
  latex_content: string
  external_url: string
  thumbnail_url: string | null
  estimated_read_minutes: number
  difficulty: string
  difficulty_display: string
  order: number
  is_featured: boolean
  is_published: boolean
  is_ai_generated: boolean
  ai_summary: string
  is_bookmarked: boolean
  is_completed: boolean
  view_count: number
  tags: { id: number; name: string; slug: string; color: string }[]
  created_at: string
  updated_at: string
}

type TocItem = { id: string; text: string; level: number }

function extractToc(markdown: string): TocItem[] {
  const lines = markdown.split("\n")
  const toc: TocItem[] = []
  for (const line of lines) {
    const match = line.match(/^(#{1,4})\s+(.+)/)
    if (match) {
      const level = match[1].length
      const text = match[2].trim()
      const id = text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-")
      toc.push({ id, text, level })
    }
  }
  return toc
}

const DIFFICULTY_CONFIG: Record<string, { label: string; cls: string }> = {
  beginner:     { label: "Beginner",     cls: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800" },
  intermediate: { label: "Intermediate", cls: "bg-amber-50  text-amber-700  border border-amber-200  dark:bg-amber-900/20  dark:text-amber-400  dark:border-amber-800" },
  advanced:     { label: "Advanced",     cls: "bg-red-50    text-red-700    border border-red-200    dark:bg-red-900/20    dark:text-red-400    dark:border-red-800" },
}

const TYPE_ICON: Record<string, string> = {
  article: "📄", markdown_note: "📝", html_note: "🌐", latex_note: "∑",
  video: "▶️", pdf: "📋", external_link: "🔗", ai_note: "🤖",
  formula_sheet: "📐", quiz: "🧪",
}

// ─── Markdown component overrides ─────────────────────────────────────────────
const MD_COMPONENTS: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  // Headings — add scroll-margin and IDs
  h1: ({ children, ...props }) => (
    <h1 {...props} className="scroll-mt-24">{children}</h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 {...props} className="scroll-mt-24">{children}</h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 {...props} className="scroll-mt-24">{children}</h3>
  ),
  h4: ({ children, ...props }) => (
    <h4 {...props} className="scroll-mt-24">{children}</h4>
  ),

  // Blockquotes → styled callout
  blockquote: ({ children }) => (
    <blockquote>{children}</blockquote>
  ),

  // Code: inline vs block
  code: ({ className, children, ...props }) => {
    const isBlock = className?.startsWith("language-")
    if (isBlock) {
      return <code className={className} {...props}>{children}</code>
    }
    return <code {...props}>{children}</code>
  },

  // Tables → wrapped for horizontal scroll on mobile
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table>{children}</table>
    </div>
  ),

  // Horizontal rules
  hr: () => <hr />,
}

export default function ResourceReaderPage() {
  const { resourceId } = useParams<{ resourceId: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const contentRef = useRef<HTMLDivElement>(null)

  const [resource, setResource]       = useState<Resource | null>(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(false)
  const [readProgress, setReadProgress] = useState(0)
  const [toc, setToc]                 = useState<TocItem[]>([])
  const [activeId, setActiveId]       = useState("")
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [isCompleted, setIsCompleted]   = useState(false)
  const [sanitizedHtml, setSanitizedHtml] = useState("")

  // ── Fetch ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!resourceId) return
    const token = localStorage.getItem("auth_token")
    const headers: Record<string, string> = {}
    if (token) headers["Authorization"] = `Token ${token}`

    fetch(`${API_BASE}/resources/${resourceId}/`, { headers })
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then((data: Resource) => {
        setResource(data)
        setIsBookmarked(data.is_bookmarked)
        setIsCompleted(data.is_completed)
        if (data.markdown_content) setToc(extractToc(data.markdown_content))
        if (data.content_format === "html" && data.html_content) {
          import("dompurify").then(({ default: DOMPurify }) =>
            setSanitizedHtml(DOMPurify.sanitize(data.html_content))
          )
        }
        setLoading(false)
      })
      .catch(() => { setError(true); setLoading(false) })
  }, [resourceId])

  // ── Scroll tracking ─────────────────────────────────────────────────────────
  useEffect(() => {
    const el = contentRef.current
    if (!el) return

    const onScroll = () => {
      const total = el.scrollHeight
      const scrolled = window.scrollY - el.offsetTop + window.innerHeight
      setReadProgress(Math.min(100, Math.max(0, (scrolled / total) * 100)))

      const headings = el.querySelectorAll("h1,h2,h3,h4")
      let current = ""
      headings.forEach(h => {
        if (h.getBoundingClientRect().top < window.innerHeight * 0.35) {
          current = h.id
        }
      })
      setActiveId(current)
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [resource])

  // ── Actions ─────────────────────────────────────────────────────────────────
  const toggleBookmark = useCallback(async () => {
    if (!user) { alert("Please log in to bookmark resources."); return }
    const token = localStorage.getItem("auth_token")
    const res = await fetch(`${API_BASE}/resources/${resourceId}/bookmark/`, {
      method: "POST", headers: { Authorization: `Token ${token}` },
    })
    const data = await res.json()
    setIsBookmarked(data.is_bookmarked)
  }, [user, resourceId])

  const toggleComplete = useCallback(async () => {
    if (!user) { alert("Please log in to track progress."); return }
    const token = localStorage.getItem("auth_token")
    const res = await fetch(`${API_BASE}/resources/${resourceId}/complete/`, {
      method: "POST", headers: { Authorization: `Token ${token}` },
    })
    const data = await res.json()
    setIsCompleted(data.is_completed)
  }, [user, resourceId])

  // ── Content renderer ────────────────────────────────────────────────────────
  const renderContent = () => {
    if (!resource) return null

    if (resource.content_format === "html" && sanitizedHtml) {
      return <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
    }

    if (resource.content_format === "latex" && resource.latex_content) {
      return (
        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
          {`$$\n${resource.latex_content}\n$$`}
        </ReactMarkdown>
      )
    }

    if (resource.markdown_content) {
      return (
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex, rehypeHighlight, rehypeSlug]}
          components={MD_COMPONENTS}
        >
          {resource.markdown_content}
        </ReactMarkdown>
      )
    }

    if (resource.external_url) {
      return (
        <div className="flex flex-col items-center justify-center gap-6 py-20 text-center">
          <div className="text-7xl">{TYPE_ICON[resource.resource_type] ?? "🔗"}</div>
          <p className="text-muted-foreground text-lg max-w-sm">
            This resource is hosted externally.
          </p>
          <a
            href={resource.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-7 py-3 bg-foreground text-background rounded-xl font-bold hover:opacity-85 transition-opacity"
          >
            Open Resource <ExternalLink className="size-4" />
          </a>
        </div>
      )
    }

    return <p className="text-muted-foreground italic">No content available.</p>
  }

  // ── Loading / Error ─────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex items-center justify-center h-[calc(100vh-80px)]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    </div>
  )

  if (error || !resource) return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)] gap-5">
        <AlertCircle className="size-12 text-destructive" />
        <h1 className="text-2xl font-bold">Resource not found</h1>
        <button onClick={() => router.back()} className="px-6 py-2.5 bg-foreground text-background rounded-xl font-bold">
          Go Back
        </button>
      </div>
    </div>
  )

  const diffConfig = DIFFICULTY_CONFIG[resource.difficulty]

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* ── Reading progress bar ── */}
      <div
        className="fixed top-[64px] left-0 z-50 h-[3px] bg-foreground transition-all duration-200 ease-out"
        style={{ width: `${readProgress}%` }}
      />

      {/* ── Sticky action bar ── */}
      <div className="sticky top-[64px] z-30 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-3 flex items-center justify-between gap-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Back</span>
          </button>

          <p className="text-sm font-semibold text-foreground truncate max-w-sm hidden md:block">
            {resource.title}
          </p>

          <div className="flex items-center gap-2">
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
              <Eye className="size-3.5" />
              {resource.view_count.toLocaleString()}
            </span>

            <button
              onClick={toggleBookmark}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                isBookmarked
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground"
              }`}
            >
              {isBookmarked ? <BookmarkCheck className="size-3.5" /> : <Bookmark className="size-3.5" />}
              <span className="hidden sm:inline">{isBookmarked ? "Saved" : "Save"}</span>
            </button>

            <button
              onClick={toggleComplete}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                isCompleted
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "bg-background text-muted-foreground border-border hover:border-emerald-400 hover:text-emerald-600"
              }`}
            >
              {isCompleted ? <CheckCircle2 className="size-3.5" /> : <Circle className="size-3.5" />}
              <span className="hidden sm:inline">{isCompleted ? "Done" : "Mark Done"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Page layout ── */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-12 flex gap-14">

        {/* ══ Main article ══════════════════════════════════════════════════════ */}
        <article className="flex-1 min-w-0 max-w-[720px]">

          {/* ── Article header ── */}
          <header className="mb-10">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-5">
              <Link href="/roadmap" className="hover:text-foreground transition-colors">Roadmaps</Link>
              <ChevronRight className="size-3 opacity-50" />
              <span className="text-foreground/70">{resource.resource_type_display}</span>
            </div>

            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 bg-foreground/5 text-foreground/70 rounded-lg">
                <span>{TYPE_ICON[resource.resource_type] ?? "📄"}</span>
                {resource.resource_type_display}
              </span>

              {diffConfig && (
                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${diffConfig.cls}`}>
                  {diffConfig.label}
                </span>
              )}

              {resource.is_featured && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400">
                  <Star className="size-3 fill-current" /> Featured
                </span>
              )}

              {resource.is_ai_generated && (
                <span className="text-xs font-bold text-sky-600 bg-sky-50 border border-sky-200 px-2.5 py-1 rounded-lg dark:bg-sky-900/20 dark:border-sky-800 dark:text-sky-400">
                  🤖 AI Generated
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-3xl sm:text-4xl lg:text-[2.6rem] font-extrabold text-foreground tracking-tight leading-[1.15] mb-4">
              {resource.title}
            </h1>

            {/* Short description */}
            {resource.short_description && (
              <p className="text-lg text-muted-foreground leading-relaxed mb-5">
                {resource.short_description}
              </p>
            )}

            {/* Meta strip */}
            <div className="flex flex-wrap items-center gap-4 pb-6 border-b border-border">
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="size-4" />
                {resource.estimated_read_minutes} min read
              </span>
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Eye className="size-4" />
                {resource.view_count.toLocaleString()} views
              </span>
              {resource.tags.map(tag => (
                <span key={tag.id} className="text-xs px-2.5 py-1 bg-muted rounded-full font-medium text-muted-foreground">
                  #{tag.name}
                </span>
              ))}
            </div>

            {/* AI Summary callout */}
            {resource.ai_summary && (
              <div className="mt-6 flex gap-4 p-5 rounded-2xl bg-gradient-to-br from-sky-50 to-indigo-50 border border-sky-100 dark:from-sky-950/20 dark:to-indigo-950/20 dark:border-sky-900/30">
                <div className="size-9 shrink-0 rounded-xl bg-sky-500/10 flex items-center justify-center">
                  <Zap className="size-4.5 text-sky-500" />
                </div>
                <div>
                  <p className="text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-widest mb-1.5">
                    AI Summary
                  </p>
                  <p className="text-sm text-sky-900 dark:text-sky-200 leading-relaxed">
                    {resource.ai_summary}
                  </p>
                </div>
              </div>
            )}

            {/* External URL banner */}
            {resource.external_url && (
              <a
                href={resource.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 flex items-center gap-3 p-4 rounded-2xl border border-border bg-card hover:bg-muted/40 transition-colors group"
              >
                <div className="size-8 shrink-0 rounded-xl bg-muted flex items-center justify-center">
                  <ExternalLink className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
                <span className="text-sm text-muted-foreground group-hover:text-foreground truncate flex-1 transition-colors">
                  {resource.external_url}
                </span>
                <span className="text-xs font-bold text-foreground shrink-0">Open →</span>
              </a>
            )}
          </header>

          {/* ── Article body ── */}
          <div ref={contentRef} className="article-body">
            {renderContent()}
          </div>

          {/* ── Completion footer ── */}
          <div className="mt-16 p-8 rounded-3xl border border-border bg-gradient-to-br from-card to-muted/20 flex flex-col sm:flex-row items-center justify-between gap-5">
            <div>
              <p className="font-bold text-xl text-foreground mb-1">
                {isCompleted ? "Great work! 🎉" : "Finished reading?"}
              </p>
              <p className="text-sm text-muted-foreground">
                {isCompleted
                  ? "This resource is marked as complete."
                  : "Mark it complete to track your progress."}
              </p>
            </div>
            <button
              onClick={toggleComplete}
              className={`shrink-0 flex items-center gap-2.5 px-7 py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-95 ${
                isCompleted
                  ? "bg-emerald-500 text-white hover:bg-emerald-600"
                  : "bg-foreground text-background hover:opacity-85"
              }`}
            >
              {isCompleted ? <CheckCircle2 className="size-5" /> : <Circle className="size-5" />}
              {isCompleted ? "Completed ✓" : "Mark as Complete"}
            </button>
          </div>
        </article>

        {/* ══ Sidebar ToC ═══════════════════════════════════════════════════════ */}
        {toc.length > 0 && (
          <aside className="hidden xl:flex flex-col w-60 shrink-0">
            <div className="sticky top-[120px] space-y-4">

              {/* ToC card */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="size-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    On this page
                  </span>
                </div>
                <nav className="space-y-0.5">
                  {toc.map(item => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      className={`
                        flex items-center gap-2 py-1.5 text-sm leading-snug rounded-lg px-2 transition-all duration-150 group
                        ${item.level === 1 ? "font-semibold" : item.level === 2 ? "pl-4 font-medium" : item.level === 3 ? "pl-7" : "pl-10"}
                        ${activeId === item.id
                          ? "text-foreground bg-muted font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}
                      `}
                    >
                      {item.level >= 2 && (
                        <span className={`shrink-0 size-1.5 rounded-full transition-colors ${activeId === item.id ? "bg-foreground" : "bg-muted-foreground/30 group-hover:bg-muted-foreground/60"}`} />
                      )}
                      <span className="truncate">{item.text}</span>
                    </a>
                  ))}
                </nav>
              </div>

              {/* Reading progress card */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-muted-foreground">Reading progress</span>
                  <span className="text-xs font-bold text-foreground tabular-nums">
                    {Math.round(readProgress)}%
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-foreground rounded-full transition-all duration-300"
                    style={{ width: `${readProgress}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-3">
                  {readProgress < 30
                    ? "Just getting started…"
                    : readProgress < 70
                    ? "You're making good progress!"
                    : readProgress < 99
                    ? "Almost there, keep going!"
                    : "Article complete! 🎉"}
                </p>
              </div>

              {/* Quick actions */}
              <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
                <button
                  onClick={toggleBookmark}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    isBookmarked
                      ? "bg-foreground text-background"
                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isBookmarked ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
                  {isBookmarked ? "Bookmarked" : "Save article"}
                </button>
                <button
                  onClick={toggleComplete}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    isCompleted
                      ? "bg-emerald-500 text-white"
                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="size-4" /> : <Circle className="size-4" />}
                  {isCompleted ? "Completed" : "Mark complete"}
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
