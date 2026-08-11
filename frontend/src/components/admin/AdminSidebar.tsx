"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  FolderTree,
  LayoutDashboard,
  FileText,
  Newspaper,
  Sparkles,
  Users,
  MessageSquare,
  ShieldCheck,
  Home,
} from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { BookOpen, Trophy, Server, Map } from "lucide-react"
import {
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react"

const navItems = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Exams & Questions", href: "/admin/exams", icon: FileText },
  { label: "Categories", href: "/admin/categories", icon: FolderTree },
  { label: "Roadmaps", href: "/admin/roadmaps", icon: Map },
  { label: "Current Affairs", href: "/admin/current-affairs", icon: Newspaper },
  { label: "Study Hub Resources", href: "/admin/resources", icon: BookOpen },
  { label: "AI PDF Tools", href: "/admin/ai-tools", icon: Sparkles },
  { label: "User Management", href: "/admin/users", icon: Users },
  { label: "Community Moderation", href: "/admin/community", icon: ShieldCheck },
  { label: "Gamification Badges", href: "/admin/badges", icon: Trophy },
  { label: "System Jobs", href: "/admin/jobs", icon: Server },
  { label: "Messages & Bugs", href: "/admin/messages", icon: MessageSquare },
]

interface AdminSidebarProps {
  mobileOpen?: boolean
  setMobileOpen?: (open: boolean) => void
}

export function AdminSidebar({ mobileOpen = false, setMobileOpen }: AdminSidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const sidebarContent = (isMobile: boolean = false) => {
    const isExpanded = isMobile || !collapsed
    return (
      <>
        {/* Brand Header */}
        <div className={cn("h-14 border-b border-border/60 flex items-center justify-between px-4", !isExpanded && "justify-center px-0")}>
          {isExpanded ? (
            <>
              <Link
                href="/admin"
                onClick={() => isMobile && setMobileOpen?.(false)}
                className="flex items-center gap-2 font-bold text-foreground tracking-tight text-sm"
              >
                <img src="/icon.svg" alt="ExamIntel Icon" className="size-7 select-none" />
                <span>ExamIntel</span>
              </Link>
              {isMobile ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileOpen?.(false)}
                  className="size-7 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCollapsed(!collapsed)}
                  className="size-7 text-muted-foreground hover:text-foreground hidden sm:flex"
                  title="Collapse Sidebar"
                >
                  <ChevronLeft className="size-4" />
                </Button>
              )}
            </>
          ) : (
            <button
              onClick={() => setCollapsed(false)}
              className="size-9 rounded-lg hover:bg-muted/60 transition-all flex items-center justify-center"
              title="Expand Sidebar"
            >
              <img src="/icon.svg" alt="ExamIntel Icon" className="size-6 select-none" />
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto scrollbar-hide">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => isMobile && setMobileOpen?.(false)}
                className={cn(
                  "flex items-center text-xs font-medium transition-all rounded-lg",
                  !isExpanded
                    ? "size-9 mx-auto justify-center"
                    : "gap-3 px-3 py-2",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
                title={!isExpanded ? item.label : undefined}
              >
                <Icon className="size-4 shrink-0" />
                {isExpanded && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Footer / Back to App */}
        <div className="p-2 border-t border-border/60">
          <Link
            href="/"
            onClick={() => isMobile && setMobileOpen?.(false)}
            className={cn(
              "flex items-center text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all rounded-lg",
              !isExpanded
                ? "size-9 mx-auto justify-center"
                : "gap-3 px-3 py-2"
            )}
            title={!isExpanded ? "Back to Main Site" : undefined}
          >
            <Home className="size-4 shrink-0" />
            {isExpanded && <span>Back to Main Site</span>}
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "bg-card border-r border-border/70 hidden md:flex flex-col transition-all duration-300 relative z-20 shrink-0 min-h-screen",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {sidebarContent(false)}
      </aside>

      {/* Mobile Drawer Overlay */}
      <div
        className={cn(
          "fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden transition-opacity duration-200",
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setMobileOpen?.(false)}
      />

      {/* Mobile Drawer Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border flex flex-col transition-transform duration-300 md:hidden shadow-2xl",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent(true)}
      </aside>
    </>
  )
}
