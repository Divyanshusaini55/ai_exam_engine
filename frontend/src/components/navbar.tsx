"use client"

import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/context/auth-context"
import { useState, useRef, useEffect, useCallback } from "react"
import { communityApi } from "@/lib/api"
import { getAvatarUrl } from "@/lib/utils"
import { useTheme } from "next-themes"
import { 
    Home, 
    LayoutDashboard, 
    BarChart3, 
    Trophy, 
    Upload, 
    Users, 
    CircleUserRound, 
    Bell, 
    LogOut, 
    GraduationCap,
    BookOpen,
    Menu,
    X,
    Settings,
    HelpCircle,
    Newspaper,
    ArrowRight,
    Check,
    Briefcase,
    ShieldCheck,
    Sun,
    Moon
} from "lucide-react"

// Marketing nav — shown to unauthenticated users
const marketingNavItems = [
    { label: "Home", href: "/", icon: Home },
    { label: "Exams", href: "/exams", icon: GraduationCap },
    { label: "Daily Dose", href: "/daily-dose", icon: Newspaper },
    { label: "Leaderboard", href: "/leaderboard", icon: Trophy },
]

// Full app nav — shown to authenticated users
const appNavItems = [
    { label: "Home", href: "/", icon: Home },
    { label: "Daily Dose", href: "/daily-dose", icon: Newspaper },
    { label: "Exams", href: "/exams", icon: GraduationCap },
    { label: "Leaderboard", href: "/leaderboard", icon: Trophy },
    { label: "Upload QP", href: "/upload", icon: Upload },
    { label: "Contributors", href: "/contributors", icon: Users },
]

// Items shown in the profile dropdown menu
const userMenuItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Profile", href: "/profile", icon: CircleUserRound },
    { label: "Analysis", href: "/analysis", icon: BarChart3 },
    { label: "Settings", href: "/settings", icon: Settings },
    { label: "Help Center", href: "/help", icon: HelpCircle },
]

export function Navbar() {
    const { user, loading, logout } = useAuth()
    const { theme, setTheme } = useTheme()
    const router = useRouter()
    const pathname = usePathname()
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const mainNavItems = user ? appNavItems : marketingNavItems
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
    const [notifications, setNotifications] = useState<any[]>([])
    const menuRef = useRef<HTMLDivElement>(null)
    const notifRef = useRef<HTMLDivElement>(null)

    // Fetch notifications
    const fetchNotifications = useCallback(async (signal?: AbortSignal) => {
        if (!user) return
        try {
            const res = await communityApi.getNotifications({ signal })
            setNotifications(res.data.results || res.data || [])
        } catch (error: any) {
            if (error.name === 'CanceledError' || error.name === 'AbortError') return;
            console.error("Failed to fetch notifications:", error)
        }
    }, [user])

    const markAsRead = async (id: number) => {
        try {
            await communityApi.readNotification(id)
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
        } catch (error) {
            console.error("Failed to mark as read:", error)
        }
    }

    const markAllRead = async () => {
        const unread = notifications.filter(n => !n.is_read)
        if (unread.length === 0) return
        
        try {
            await Promise.all(unread.map(n => markAsRead(n.id)))
        } catch (error) {
            console.error("Failed to mark all as read:", error)
        }
    }

    // Close menu/notif when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false)
            }
            if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
                setIsNotificationsOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    useEffect(() => {
        const controller = new AbortController()
        if (user) {
            fetchNotifications(controller.signal)
        }
        return () => controller.abort()
    }, [user, fetchNotifications])

    // Close menu on route change
    useEffect(() => {
        setIsMenuOpen(false)
        setIsNotificationsOpen(false)
    }, [pathname])

    return (
        <header className="sticky top-0 z-50 backdrop-blur-xl bg-card/70 border-b border-border transition-all duration-300 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-4">
                <div className="flex items-center justify-between">
                    {/* Logo (Left) */}
                    <div className="flex items-center gap-3 group cursor-pointer" onClick={() => router.push('/')}>
                        <img src="/icon.svg" alt="ExamIntel Icon" className="size-9 transition-all duration-300 group-hover:-translate-y-1 select-none" />
                        <h2 className="text-[20px] font-bold font-heading text-primary group-hover:opacity-80 transition-opacity duration-300 tracking-tight">
                            ExamIntel
                        </h2>
                    </div>

                    {/* Desktop Navigation (Center) - Hidden on Mobile */}
                    <nav className="hidden md:flex items-center gap-8">
                        {mainNavItems.map((item) => {
                            const isActive = pathname === item.href
                            return (
                                <Link prefetch={false}
                                    key={item.label}
                                    href={item.href}
                                    className={`text-sm transition-all duration-300 relative group py-1 ${isActive ? "text-primary font-semibold" : "text-muted-foreground font-medium hover:text-primary"}`}
                                >
                                    {item.label}
                                    <span className={`absolute bottom-0 left-0 h-[2px] bg-primary transition-all duration-300 rounded-t-full ${isActive ? "w-full" : "w-0 group-hover:w-full opacity-50"}`} />
                                </Link>
                            )
                        })}
                    </nav>

                    {/* Right Actions */}
                    <div className="flex items-center gap-3">
                        {/* Dark / Light toggle */}
                        <button
                            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                            className="size-8 md:size-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all duration-200"
                            title="Toggle Theme"
                        >
                            <Sun className="size-5 hidden dark:block text-amber-400" />
                            <Moon className="size-5 block dark:hidden text-muted-foreground" />
                            <span className="sr-only">Toggle theme</span>
                        </button>

                        {/* Notification bell */}
                        {user && (
                            <div className="relative" ref={notifRef}>
                                <button 
                                    onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                                    className="relative p-2 text-muted-foreground hover:text-primary rounded-full hover:bg-secondary transition-all duration-300"
                                >
                                    <Bell className="size-5" />
                                    {notifications.some(n => !n.is_read) && (
                                        <span className="absolute top-1.5 right-1.5 size-2 bg-red-500 rounded-full animate-pulse ring-2 ring-background" />
                                    )}
                                </button>

                                {isNotificationsOpen && (
                                    <div className="fixed sm:absolute right-4 sm:right-0 left-4 sm:left-auto top-[72px] sm:top-12 w-auto sm:w-[380px] bg-card rounded-3xl shadow-premium border border-border p-4 transform origin-top sm:origin-top-right animate-in fade-in slide-in-from-top-2 duration-200 z-[60]">
                                        <div className="flex items-center justify-between mb-4 px-2">
                                            <h3 className="text-sm font-bold text-primary">Notifications</h3>
                                            <button 
                                                onClick={markAllRead}
                                                className="text-[11px] font-bold text-primary hover:underline"
                                            >
                                                Mark all as read
                                            </button>
                                        </div>

                                        <div className="max-h-[400px] overflow-y-auto space-y-2 scrollbar-hide">
                                            {notifications.length === 0 ? (
                                                <div className="py-12 text-center">
                                                    <Bell className="size-10 mx-auto text-muted-foreground/20 mb-3" />
                                                    <p className="text-sm font-bold text-muted-foreground/60">No notifications yet</p>
                                                </div>
                                            ) : (
                                                notifications.map((notif) => (
                                                    <div 
                                                        key={notif.id}
                                                        className={`p-4 rounded-2xl border transition-all cursor-pointer ${notif.is_read ? 'bg-secondary/5 border-border/30 opacity-70' : 'bg-primary/5 border-primary/10 hover:bg-primary/10'}`}
                                                        onClick={() => markAsRead(notif.id)}
                                                    >
                                                        <div className="flex gap-4">
                                                            <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${notif.type === 'REWARD' ? 'bg-amber-500/10 text-amber-600' : 'bg-primary/10 text-primary'}`}>
                                                                <Trophy className="size-5" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-[13px] font-bold text-primary mb-0.5 line-clamp-1">{notif.title}</p>
                                                                <p className="text-xs text-muted-foreground leading-snug line-clamp-2">{notif.message}</p>
                                                                <p className="text-[9px] text-muted-foreground/50 mt-2 font-medium">
                                                                    {new Date(notif.created_at).toLocaleString()}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Profile Avatar / Auth Buttons */}
                        {loading ? (
                            <div className="size-10 bg-secondary rounded-full animate-pulse" />
                        ) : !user ? (
                            <div className="flex items-center gap-2 md:gap-4">
                                <Link prefetch={false}
                                    href="/login"
                                    className="text-sm font-medium text-secondary-foreground hover:text-primary transition-colors hidden md:block"
                                >
                                    Sign In
                                </Link>
                                <Link prefetch={false}
                                    href="/signup"
                                    className="hidden md:inline-flex items-center gap-1.5 px-5 py-2 text-[13px] font-semibold bg-primary text-primary-foreground rounded-lg shadow-premium hover:-translate-y-[2px] hover:shadow-[0_15px_30px_rgba(0,0,0,0.12)] transition-all duration-300"
                                >
                                    Get Started
                                    <ArrowRight className="size-3.5" />
                                </Link>
                                <Link prefetch={false}
                                    href="/login"
                                    className="md:hidden px-3.5 py-1.5 text-[13px] font-semibold bg-primary text-primary-foreground rounded-lg shadow-premium hover:-translate-y-[1px] transition-all duration-300"
                                >
                                    Sign In
                                </Link>
                                
                                {/* Mobile Menu for Unauthenticated Users */}
                                <div className="relative md:hidden" ref={menuRef}>
                                    <button
                                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                                        className="md:hidden size-8 flex items-center justify-center rounded-lg hover:bg-secondary text-foreground transition-colors"
                                    >
                                        {isMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
                                    </button>
                                    
                                    {isMenuOpen && (
                                        <div className="absolute right-0 top-14 w-64 bg-card rounded-premium shadow-premium border border-border p-2 transform origin-top-right animate-in fade-in zoom-in-95 duration-200 z-[60]">
                                            <div className="space-y-1">
                                                {mainNavItems.map((item) => {
                                                    const Icon = item.icon
                                                    return (
                                                        <Link prefetch={false}
                                                            key={item.label}
                                                            href={item.href}
                                                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${pathname === item.href
                                                                ? "bg-secondary text-primary font-bold"
                                                                : "text-muted-foreground hover:bg-secondary hover:text-primary font-medium"
                                                                }`}
                                                        >
                                                            <Icon className="size-5" />
                                                            {item.label}
                                                        </Link>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="relative" ref={menuRef}>
                                {/* Avatar Trigger */}
                                <button
                                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                                    className="group relative size-10 rounded-full border border-border p-[3px] shadow-sm hover:shadow-premium transition-all duration-300 hover:-translate-y-[2px]"
                                >
                                    <div className="flex h-full w-full items-center justify-center rounded-full bg-secondary overflow-hidden">
                                        {user.avatar_image ? (
                                            <img src={getAvatarUrl(user.avatar_image) || ''} alt={user.username} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                                        ) : (
                                            <span className="text-sm font-bold text-primary transition-transform duration-300 group-hover:scale-110">
                                                {user.username[0].toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                </button>

                                {/* Responsive Mobile Dropdown Menu */}
                                {isMenuOpen && (
                                    <div className="absolute right-0 top-14 w-72 bg-card rounded-premium shadow-premium border border-border p-2 transform origin-top-right animate-in fade-in zoom-in-95 duration-200">
                                        {/* User Info Header */}
                                        <div className="p-4 border-b border-border mb-2">
                                            <div className="flex items-center gap-3">
                                                <div className="size-10 rounded-full bg-secondary flex items-center justify-center text-lg font-bold text-primary overflow-hidden shrink-0">
                                                    {user.avatar_image ? (
                                                        <img src={getAvatarUrl(user.avatar_image) || ''} alt={user.username} className="w-full h-full object-cover" />
                                                    ) : (
                                                        user.username[0].toUpperCase()
                                                    )}
                                                </div>
                                                <div className="overflow-hidden">
                                                    <p className="font-bold font-heading text-primary truncate">{user.username}</p>
                                                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Mobile Navigation Links (Combined) */}
                                        <div className="md:hidden space-y-1 mb-2">
                                            {/* Show Main Nav items on mobile inside the menu */}
                                            {mainNavItems.map((item) => {
                                                const Icon = item.icon
                                                return (
                                                    <Link prefetch={false}
                                                        key={item.label}
                                                        href={item.href}
                                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${pathname === item.href
                                                            ? "bg-secondary text-primary font-bold"
                                                            : "text-muted-foreground hover:bg-secondary hover:text-primary font-medium"
                                                            }`}
                                                    >
                                                        <Icon className="size-5" />
                                                        {item.label}
                                                    </Link>
                                                )
                                            })}
                                            <div className="h-px bg-border my-2 mx-2"></div>
                                        </div>

                                        {/* User Menu Items (Dashboard, Profile, etc.) */}
                                        <div className="space-y-1">
                                            {(user.is_staff || user.is_superuser) && (
                                                <Link prefetch={false}
                                                    href="/admin"
                                                    className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-primary font-bold bg-primary/10 hover:bg-primary/20 mb-1"
                                                >
                                                    <ShieldCheck className="size-5 text-primary" />
                                                    Admin Console
                                                </Link>
                                            )}
                                            {userMenuItems.map((item) => {
                                                const Icon = item.icon
                                                const isActive = pathname === item.href
                                                return (
                                                    <Link prefetch={false}
                                                        key={item.label}
                                                        href={item.href}
                                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive
                                                            ? "bg-secondary text-primary font-bold"
                                                            : "text-muted-foreground hover:bg-secondary hover:text-primary font-medium"
                                                            }`}
                                                    >
                                                        <Icon className="size-5" />
                                                        {item.label}
                                                    </Link>
                                                )
                                            })}

                                            <div className="h-px bg-border my-2 mx-2"></div>

                                            <button
                                                onClick={logout}
                                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-destructive hover:bg-destructive/10 font-bold transition-all duration-200 text-left"
                                            >
                                                <LogOut className="size-5" />
                                                Sign Out
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    )
}
