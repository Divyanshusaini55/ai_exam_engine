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
      {/* Left side items */}
      <div className="flex items-center gap-2 sm:gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMobileMenuClick}
          className="size-8 rounded-lg md:hidden text-muted-foreground hover:text-foreground shrink-0"
          title="Open Menu"
        >
          <Menu className="size-4" />
        </Button>
        <Badge 
          variant="outline" 
          className="h-8 px-2.5 rounded-lg text-xs font-medium gap-1.5 border-primary/30 bg-primary/5 text-primary flex items-center shrink-0"
        >
          <ShieldCheck className="size-4 text-primary shrink-0" />
          <span className="hidden xs:inline font-semibold">Admin Console</span>
          <span className="xs:hidden font-semibold">Admin</span>
        </Badge>
      </div>

      {/* Right side items */}
      <div className="flex items-center gap-2 sm:gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="size-8 rounded-lg text-muted-foreground hover:text-foreground shrink-0"
          title="Toggle Theme"
        >
          <Sun className="size-4 hidden dark:block text-amber-400 shrink-0" />
          <Moon className="size-4 block dark:hidden text-muted-foreground shrink-0" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        {user && (
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-foreground leading-tight">
                {user.name || (user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : '') || user.username || user.email}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono leading-tight">Administrator</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              className="h-8 px-2.5 rounded-lg gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground shrink-0"
            >
              <LogOut className="size-4 shrink-0" />
              <span>Logout</span>
            </Button>
          </div>
        )}
      </div>
    </header>
  )
}
