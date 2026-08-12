import type { LucideIcon } from "lucide-react"
import {
  GraduationCap,
  School,
  Book,
  FileText,
  Target,
  Award,
  Landmark,
  Train,
  Shield,
  Globe,
  Atom,
  Calculator,
  Zap,
  Activity,
  Wallet,
  Medal,
} from "lucide-react"

export function getCategoryHomeIcon(iconName: string, categoryName = ""): LucideIcon {
  const map: Record<string, LucideIcon> = {
    school: GraduationCap,
    graduation: GraduationCap,
    book: Book,
    article: FileText,
    target: Target,
    award: Award,
    academic: School,
    banking: Wallet,
    bank: Wallet,
    account_balance: Wallet,
    menu_book: Book,
    railways: Train,
    railway: Train,
    defence: Medal,
    defense: Medal,
    ssc: GraduationCap,
    "ssc exams": GraduationCap,
    upsc: Globe,
    civil: Globe,
    "state psc": GraduationCap,
    state_psc: GraduationCap,
    state: GraduationCap,
    "state exams": GraduationCap,
    science: Atom,
    math: Calculator,
    gk: Zap,
    general: Zap,
    teaching: School,
    police: Shield,
    medical: Activity,
    engineering: Atom,
    rrb: Train,
    ntpc: Train,
    alp: Train,
    "group d": Train,

  }

  const key = (iconName || "").toLowerCase()
  const nameKey = (categoryName || "").toLowerCase()

  if (key === "school" || key === "graduation" || !key) {
    return map[nameKey] || map[key] || GraduationCap
  }

  return map[key] || map[nameKey] || GraduationCap
}

const SEMANTIC_CATEGORY_COLORS: Record<string, { bg: string; icon: string }> = {
  banking: { bg: "bg-purple-100 dark:bg-purple-900/30", icon: "text-purple-600 dark:text-purple-400" },
  defence: { bg: "bg-orange-100 dark:bg-orange-900/30", icon: "text-orange-600 dark:text-orange-400" },
  defense: { bg: "bg-orange-100 dark:bg-orange-900/30", icon: "text-orange-600 dark:text-orange-400" },
  railways: { bg: "bg-orange-100 dark:bg-orange-900/30", icon: "text-orange-800 dark:text-orange-200" },
  ssc: { bg: "bg-green-100 dark:bg-green-900/30", icon: "text-green-600 dark:text-green-400" },
  upsc: {
    bg: "bg-slate-100 dark:bg-slate-600",
    icon: "text-slate-700 dark:text-slate-50",
  },
  state: {
    bg: "bg-slate-100 dark:bg-zinc-600",
    icon: "text-zinc-700 dark:text-zinc-50",
  },
}

function colorsFromCategoryName(name: string): { bg: string; icon: string } | null {
  const nameLow = (name || "").toLowerCase()
  for (const key of Object.keys(SEMANTIC_CATEGORY_COLORS)) {
    if (nameLow.includes(key)) return SEMANTIC_CATEGORY_COLORS[key]!
  }
  return null
}

const LEGACY_ICON_COLOR: Record<string, string> = {
  blue: "text-blue-600 dark:text-blue-300",
  purple: "text-purple-600 dark:text-purple-400",
  green: "text-green-600 dark:text-green-400",
  orange: "text-orange-600 dark:text-orange-300",
  red: "text-red-600 dark:text-red-400",
  slate: "text-slate-600 dark:text-slate-300",
  gray: "text-gray-600 dark:text-gray-300",
  zinc: "text-zinc-600 dark:text-zinc-300",
  indigo: "text-indigo-600 dark:text-indigo-400",
}

const LEGACY_BG_DARK: Record<string, string> = {
  "bg-blue-100": "bg-blue-100 dark:bg-blue-950/50",
  "bg-green-100": "bg-green-100 dark:bg-green-950/45",
  "bg-purple-100": "bg-purple-100 dark:bg-purple-950/45",
  "bg-orange-100": "bg-orange-100 dark:bg-orange-950/45",
  "bg-red-100": "bg-red-100 dark:bg-red-950/45",
  "bg-slate-100": "bg-slate-100 dark:bg-slate-800",
  "bg-gray-100": "bg-gray-100 dark:bg-gray-800",
  "bg-zinc-100": "bg-zinc-100 dark:bg-zinc-800",
  "bg-indigo-100": "bg-indigo-100 dark:bg-indigo-950/45",
}

const LIGHT_TEXT_ICON_DARK: Record<string, string> = {
  "text-blue-600": "text-blue-600 dark:text-blue-300",
  "text-blue-700": "text-blue-700 dark:text-blue-300",
  "text-green-600": "text-green-600 dark:text-green-400",
  "text-green-700": "text-green-700 dark:text-green-400",
  "text-purple-600": "text-purple-600 dark:text-purple-400",
  "text-purple-700": "text-purple-700 dark:text-purple-400",
  "text-orange-600": "text-orange-600 dark:text-orange-300",
  "text-orange-700": "text-orange-700 dark:text-orange-300",
  "text-orange-800": "text-orange-800 dark:text-orange-200",
  "text-slate-600": "text-slate-600 dark:text-slate-300",
  "text-slate-700": "text-slate-700 dark:text-slate-300",
  "text-red-600": "text-red-600 dark:text-red-400",
  "text-indigo-600": "text-indigo-600 dark:text-indigo-400",
}

function normalizeApiIconClass(apiIcon: string): string {
  const t = apiIcon.trim()
  if (!t) return "text-primary"
  if (t.includes("dark:")) return t
  if (t.startsWith("text-")) {
    return LIGHT_TEXT_ICON_DARK[t] || `${t} dark:text-zinc-100`
  }
  const short = t.toLowerCase()
  return LEGACY_ICON_COLOR[short] || "text-primary"
}

function normalizeApiBgClass(apiBg: string): string {
  const t = apiBg.trim()
  if (!t) return "bg-secondary"
  if (t.includes("dark:")) return t
  return LEGACY_BG_DARK[t] || `${t} dark:bg-zinc-900/55`
}

export function getCategoryHomeColors(
  name: string,
  apiBg?: string | null,
  apiIcon?: string | null
): { bg: string; icon: string } {
  return {
    bg: "bg-background dark:bg-card text-foreground border-border/80",
    icon: "text-foreground",
  }
}

export function getParentCategorySlugFromId(id: string): string {
  const low = id.toLowerCase()
  const keys = ["ssc", "upsc", "railways", "defence", "defense", "banking"] as const
  for (const k of keys) {
    if (low === k || low.startsWith(`${k}-`) || low.startsWith(`${k}_`)) {
      return k === "defense" ? "defence" : k
    }
  }
  return "state"
}
