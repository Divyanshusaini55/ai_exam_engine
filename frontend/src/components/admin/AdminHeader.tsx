"use client"

import { useAuth } from "@/context/auth-context"
import { ShieldCheck, LogOut, Menu, Sun, Moon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useTheme } from "next-themes"

interface AdminHeaderProps {
  onMobileMenuClick?: () => void
}

export function AdminHeader({ onMobileMenuClick }: AdminHeaderProps) {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()

  return (
    <header className="h-14 border-b border-border/70 bg-card px-4 sm:px-6 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMobileMenuClick}
          className="size-8 md:hidden text-muted-foreground hover:text-foreground"
          title="Open Menu"
        >
          <Menu className="size-5" />
        </Button>
        <Badge variant="outline" className="px-2.5 py-0.5 text-[11px] font-medium gap-1.5 border-primary/30 bg-primary/5 text-primary">
          <ShieldCheck className="size-3.5 text-primary" />
          <span className="hidden xs:inline">Admin Console</span>
          <span className="xs:hidden">Admin</span>
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="size-8 text-muted-foreground hover:text-foreground"
          title="Toggle Theme"
        >
          <Sun className="size-3.5 hidden dark:block text-amber-400" />
          <Moon className="size-3.5 block dark:hidden text-muted-foreground" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        {user && (
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-foreground">
                {user.name || (user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : '') || user.username || user.email}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">Administrator</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              className="h-8 px-2.5 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <LogOut className="size-3.5" />
              <span>Logout</span>
            </Button>
          </div>
        )}
      </div>
    </header>
  )
}
