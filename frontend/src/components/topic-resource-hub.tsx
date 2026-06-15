"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import MarkdownRenderer from "./markdown-renderer"
import {
  X, Clock, Eye, ExternalLink, ChevronRight,
  BookOpen, FileText, Video, Link2, Zap,
  Calculator, FlaskConical, Bookmark, BookmarkCheck,
  CheckCircle2, Circle, Search, ChevronDown, Lock,
} from "lucide-react"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"

// ─── Types ─────────────────────────────────────────────────────────────────────
export type TopicResourceItem = {
  id: number
  topic: number
  title: string
  slug: string
  short_description: string
  resource_type: string
  resource_type_display: string
  content_format: string
  difficulty: string
  difficulty_display: string
  external_url: string
  thumbnail_url: string | null
  estimated_read_minutes: number
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
}

export type TopicStatus = "pending" | "in_progress" | "done" | "skip"

export type TopicResourceHubProps = {
  topicTitle: string
  topicDescription?: string
  resources: TopicResourceItem[]
  onClose: () => void
  isOpen: boolean
  // Status tracking
  topicStatus?: TopicStatus
  onStatusChange?: (status: TopicStatus) => void
  prerequisites?: { id: number; title: string; status: string }[]
}

// ─── Status config ──────────────────────────────────────────────────────────────
const STATUS_MAP: Record<TopicStatus, { label: string; dot: string; badge: string }> = {
  pending:     { label: "Pending",     dot: "bg-muted-foreground", badge: "bg-muted text-muted-foreground border-border shadow-sm" },
  in_progress: { label: "In Progress", dot: "bg-yellow-500",       badge: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/30 shadow-sm" },
  done:        { label: "Done",        dot: "bg-emerald-500",       badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30 shadow-sm" },
  skip:        { label: "Skip",        dot: "bg-secondary-foreground",         badge: "bg-secondary text-secondary-foreground border-border shadow-sm" },
}

// ─── Tab config ────────────────────────────────────────────────────────────────
const TABS = [
  { key: "all",           label: "All",      icon: BookOpen },
  { key: "article",       label: "Articles", icon: FileText },
  { key: "markdown_note", label: "Notes",    icon: FileText },
  { key: "video",         label: "Videos",   icon: Video },
  { key: "pdf",           label: "PDFs",     icon: FileText },
  { key: "external_link", label: "Links",    icon: Link2 },
  { key: "ai_note",       label: "AI Notes", icon: Zap },
  { key: "formula_sheet", label: "Formulas", icon: Calculator },
  { key: "quiz",          label: "Practice", icon: FlaskConical },
] as const

const TYPE_ICON: Record<string, any> = {
  article: FileText, markdown_note: FileText, html_note: Link2, latex_note: Calculator,
  video: Video, pdf: FileText, external_link: Link2, ai_note: Zap,
  formula_sheet: Calculator, quiz: FlaskConical,
}

const TYPE_BG: Record<string, string> = {
  article:       "bg-cyan-50 text-cyan-700 border-cyan-100 dark:bg-cyan-900/50 dark:text-cyan-300 dark:border-cyan-800/50",
  markdown_note: "bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-800/50",
  html_note:     "bg-teal-50 text-teal-700 border-teal-100 dark:bg-teal-900/50 dark:text-teal-300 dark:border-teal-800/50",
  latex_note:    "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800/50",
  video:         "bg-red-50 text-red-700 border-red-100 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800/50",
  pdf:           "bg-violet-50 text-violet-700 border-violet-100 dark:bg-violet-900/50 dark:text-violet-300 dark:border-violet-800/50",
  external_link: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800/50 dark:text-zinc-300 dark:border-zinc-700/50",
  ai_note:       "bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-900/50 dark:text-sky-300 dark:border-sky-800/50",
  formula_sheet: "bg-green-50 text-green-700 border-green-100 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800/50",
  quiz:          "bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-800/50",
}

const DIFFICULTY_STYLE: Record<string, string> = {
  beginner:     "text-emerald-700 bg-emerald-50 dark:bg-emerald-900/50 dark:text-emerald-300",
  intermediate: "text-amber-700 bg-amber-50 dark:bg-amber-900/50 dark:text-amber-300",
  advanced:     "text-red-700 bg-red-50 dark:bg-red-900/50 dark:text-red-300",
}

const PREREQ_STATUS_STYLE: Record<string, string> = {
  done: "bg-emerald-50 text-emerald-700 border-emerald-200/50 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30",
  in_progress: "bg-yellow-50 text-yellow-700 border-yellow-200/50 dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-900/30",
  pending: "bg-amber-50 text-amber-700 border-amber-200/50 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30",
  skip: "bg-secondary text-secondary-foreground border-border",
}

// ─── Status Dropdown ──────────────────────────────────────────────────────────
function StatusDropdown({
  current,
  onChange,
}: {
  current: TopicStatus
  onChange: (s: TopicStatus) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const info = STATUS_MAP[current]

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold transition-colors ${info.badge} hover:shadow-md hover:opacity-90`}
      >
        <span className={`w-2 h-2 rounded-full ${info.dot} shrink-0`} />
        {info.label}
        <ChevronDown className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-44 bg-card border border-border rounded-2xl shadow-xl overflow-hidden z-20 animate-in fade-in slide-in-from-top-1 duration-150">
          {(Object.entries(STATUS_MAP) as [TopicStatus, typeof STATUS_MAP[TopicStatus]][]).map(([key, s]) => (
            <button
              key={key}
              onClick={() => { onChange(key); setOpen(false) }}
              className={`flex items-center gap-3 w-full px-4 py-2.5 text-xs font-semibold transition-colors hover:bg-muted/60 ${key === current ? "bg-muted/40" : ""}`}
            >
              <span className={`w-2 h-2 rounded-full ${s.dot} shrink-0`} />
              {s.label}
              {key === current && <CheckCircle2 className="size-3 ml-auto text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Individual Resource Card ─────────────────────────────────────────────────
function ResourceCard({
  resource,
  onBookmarkToggle,
  onCompleteToggle,
}: {
  resource: TopicResourceItem
  onBookmarkToggle: (slug: string, current: boolean) => void
  onCompleteToggle: (slug: string, current: boolean) => void
}) {
  const router = useRouter()
  const isExternal = resource.resource_type === "external_link" || resource.resource_type === "video"

  const handleOpen = () => {
    if (isExternal && resource.external_url) {
      window.open(resource.external_url, "_blank", "noopener noreferrer")
    } else {
      router.push(`/resources/${resource.slug}`)
    }
  }

  return (
    <div
      className={`group relative flex flex-col rounded-2xl border bg-card transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 overflow-hidden
        ${resource.is_featured ? "border-amber-200 shadow-sm shadow-amber-100/50" : "border-border"}
        ${resource.is_completed ? "opacity-70" : ""}
      `}
    >
      {resource.is_featured && (
        <div className="h-0.5 w-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-400" />
      )}

      <div className="p-5 flex flex-col gap-3 flex-1">
        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-md border ${TYPE_BG[resource.resource_type] ?? "bg-muted text-muted-foreground border-border"}`}>
            {(() => {
              const Icon = TYPE_ICON[resource.resource_type] ?? FileText
              return <Icon className="size-3.5" />
            })()}
            {resource.resource_type_display}
          </span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${DIFFICULTY_STYLE[resource.difficulty] ?? ""}`}>
            {resource.difficulty_display}
          </span>
          {resource.is_ai_generated && <span className="text-xs font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-md">🤖 AI</span>}
          {resource.is_featured   && <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">⭐ Featured</span>}
        </div>

        {/* Title */}
        <h3 className="font-bold text-base text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {resource.title}
        </h3>

        {/* Description */}
        {resource.short_description && (
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{resource.short_description}</p>
        )}

        {/* AI Summary */}
        {resource.ai_summary && (
          <div className="flex gap-2 p-3 rounded-xl bg-sky-50 border border-sky-100 text-xs text-sky-800">
            <Zap className="size-3.5 shrink-0 mt-0.5 text-sky-500" />
            <div className="line-clamp-2 overflow-hidden [&>*]:m-0 [&_p]:m-0 text-xs">
              <MarkdownRenderer content={resource.ai_summary} />
            </div>
          </div>
        )}

        {/* Tags */}
        {resource.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {resource.tags.slice(0, 4).map(tag => (
              <span key={tag.id} className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground font-medium">
                #{tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Meta */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-auto pt-1">
          <span className="flex items-center gap-1"><Clock className="size-3" />{resource.estimated_read_minutes}m</span>
          <span className="flex items-center gap-1"><Eye className="size-3" />{resource.view_count}</span>
          {resource.is_completed && (
            <span className="flex items-center gap-1 text-emerald-600 font-semibold ml-auto">
              <CheckCircle2 className="size-3.5" /> Done
            </span>
          )}
        </div>
      </div>

      {/* Action row */}
      <div className="border-t border-border flex items-center px-5 py-3 gap-2 bg-card">
        <button
          onClick={e => { e.stopPropagation(); onBookmarkToggle(resource.slug, resource.is_bookmarked) }}
          className={`p-1.5 rounded-lg transition-colors ${resource.is_bookmarked ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
          title={resource.is_bookmarked ? "Remove bookmark" : "Bookmark"}
        >
          {resource.is_bookmarked ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
        </button>

        <button
          onClick={e => { e.stopPropagation(); onCompleteToggle(resource.slug, resource.is_completed) }}
          className={`p-1.5 rounded-lg transition-colors ${resource.is_completed ? "text-emerald-500" : "text-muted-foreground hover:text-emerald-500"}`}
          title={resource.is_completed ? "Unmark complete" : "Mark complete"}
        >
          {resource.is_completed ? <CheckCircle2 className="size-4" /> : <Circle className="size-4" />}
        </button>

        <button
          onClick={handleOpen}
          className="ml-auto flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all"
        >
          {isExternal ? (<><ExternalLink className="size-3.5" /> Open</>) : (<>Read <ChevronRight className="size-3.5" /></>)}
        </button>
      </div>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ tab }: { tab: string }) {
  const label = TABS.find(t => t.key === tab)?.label ?? "resources"
  const Icon = tab === "all" ? BookOpen : (TYPE_ICON[tab] ?? FileText)
  
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="p-4 rounded-full bg-muted/50 mb-2">
        <Icon className="size-12 text-muted-foreground/40" strokeWidth={1.5} />
      </div>
      <p className="text-muted-foreground text-sm max-w-xs">
        No {label.toLowerCase()} available for this topic yet. Check back later!
      </p>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function TopicResourceHub({
  topicTitle,
  topicDescription,
  resources: initialResources,
  onClose,
  isOpen,
  topicStatus = "pending",
  onStatusChange,
  prerequisites = [],
}: TopicResourceHubProps) {
  const [activeTab, setActiveTab] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [resources, setResources] = useState<TopicResourceItem[]>(initialResources)

  // Sync resources if parent changes (e.g. topic switch)
  useEffect(() => {
    setResources(initialResources)
    setActiveTab("all")
    setSearch("")
  }, [initialResources])

  // Tabs with content only
  const tabsWithContent = TABS.filter(tab => {
    if (tab.key === "all") return true
    return resources.some(r => r.resource_type === tab.key)
  })

  // Filtered list
  const filtered = resources.filter(r => {
    const matchesTab = activeTab === "all" || r.resource_type === activeTab
    const matchesSearch = !search.trim() || (
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.short_description?.toLowerCase().includes(search.toLowerCase())
    )
    return matchesTab && matchesSearch
  })

  const handleBookmark = useCallback(async (slug: string, _current: boolean) => {
    const token = localStorage.getItem("auth_token")
    if (!token) { alert("Please log in to bookmark resources."); return }
    try {
      const res = await fetch(`${API_BASE}/resource-hub/${slug}/bookmark/`, {
        method: "POST",
        headers: { Authorization: `Token ${token}` },
      })
      const data = await res.json()
      setResources(prev => prev.map(r => r.slug === slug ? { ...r, is_bookmarked: data.is_bookmarked } : r))
    } catch { /* silent */ }
  }, [])

  const handleComplete = useCallback(async (slug: string, _current: boolean) => {
    const token = localStorage.getItem("auth_token")
    if (!token) { alert("Please log in to track progress."); return }
    try {
      const res = await fetch(`${API_BASE}/resource-hub/${slug}/mark-done/`, {
        method: "POST",
        headers: { Authorization: `Token ${token}` },
      })
      const data = await res.json()
      setResources(prev => prev.map(r => r.slug === slug ? { ...r, is_completed: data.is_completed } : r))
    } catch { /* silent */ }
  }, [])

  if (!isOpen) return null

  const completedCount = resources.filter(r => r.is_completed).length
  const progressPct = resources.length > 0 ? Math.round((completedCount / resources.length) * 100) : 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Resources for ${topicTitle}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal panel */}
      <div className="relative w-full sm:max-w-3xl h-[100svh] sm:h-[88vh] flex flex-col bg-background rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300 overflow-hidden">

        {/* ── Header ── */}
        <div className="px-6 pt-5 pb-4 border-b border-border shrink-0">
          {/* Mobile drag handle */}
          <div className="w-10 h-1 rounded-full bg-muted mx-auto mb-4 sm:hidden" />

          <div className="flex items-start justify-between gap-3">
            {/* Title + description */}
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-extrabold text-foreground leading-tight line-clamp-1">
                {topicTitle}
              </h2>
              {topicDescription && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{topicDescription}</p>
              )}
              {prerequisites && prerequisites.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mr-1">Prerequisites:</span>
                  {prerequisites.map((p) => {
                    const style = PREREQ_STATUS_STYLE[p.status] || PREREQ_STATUS_STYLE.pending
                    return (
                      <span
                        key={p.id}
                        className={`text-xs px-2.5 py-0.5 rounded-full border font-medium flex items-center gap-1 ${style}`}
                      >
                        {p.status === 'done' ? (
                          <CheckCircle2 className="size-3" />
                        ) : p.status === 'in_progress' ? (
                          <Circle className="size-3 fill-current" />
                        ) : (
                          <Lock className="size-3" />
                        )}
                        {p.title}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Right: status dropdown + close */}
            <div className="flex items-center gap-2 shrink-0 mt-0.5">
              {onStatusChange && (
                <StatusDropdown
                  current={topicStatus}
                  onChange={onStatusChange}
                />
              )}
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>

          {/* Resource completion progress bar */}
          {resources.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                <span>{completedCount} of {resources.length} resources completed</span>
                <span className="font-bold text-primary">{progressPct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Tabs + Search ── */}
        <div className="px-6 pt-4 pb-3 border-b border-border shrink-0 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search resources…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-border bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors"
            />
          </div>

          {/* Tab pills */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
            {tabsWithContent.map(tab => {
              const Icon = tab.icon
              const count = tab.key === "all"
                ? resources.length
                : resources.filter(r => r.resource_type === tab.key).length
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 ${
                    activeTab === tab.key
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  }`}
                >
                  <Icon className="size-3.5" />
                  {tab.label}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === tab.key ? "bg-white/20" : "bg-muted-foreground/10"}`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Resource Grid ── */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5">
          {resources.length === 0 ? (
            <EmptyState tab="all" />
          ) : filtered.length === 0 ? (
            <EmptyState tab={activeTab} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filtered.map(resource => (
                <ResourceCard
                  key={resource.id}
                  resource={resource}
                  onBookmarkToggle={handleBookmark}
                  onCompleteToggle={handleComplete}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
