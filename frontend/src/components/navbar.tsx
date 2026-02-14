"use client"

import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/context/auth-context"
import { useState, useRef, useEffect } from "react"

export function Navbar() {
    const { user, loading, logout } = useAuth()
    const router = useRouter()
    const pathname = usePathname()
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    // Close menu on route change
    useEffect(() => {
        setIsMenuOpen(false)
    }, [pathname])

    const navItems = [
        { label: "Home", href: "/", icon: "home" },
        { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
        { label: "Analysis", href: "/analysis", icon: "analytics" },
        { label: "Leaderboard", href: "/leaderboard", icon: "leaderboard" },
        { label: "Profile", href: "/profile", icon: "person" }
    ]

    return (
        <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/50 dark:border-slate-800/50 transition-all duration-300">
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-4">
                <div className="flex items-center justify-between">
                    {/* Logo (Left) */}
                    <div className="flex items-center gap-3 group cursor-pointer" onClick={() => router.push('/')}>
                        <div className="size-9 flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg text-white shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-all duration-300 group-hover:scale-110">
                            <span className="material-symbols-outlined text-xl">school</span>
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors duration-300">
                            AI Exam Engine
                        </h2>
                    </div>

                    {/* Desktop Navigation (Center) - Hidden on Mobile */}
                    <nav className="hidden md:flex items-center gap-8">
                        {navItems.map((item, idx) => {
                            const isActive = pathname === item.href
                            return (
                                <Link
                                    key={item.label}
                                    href={item.href}
                                    className={`text-sm font-medium transition-colors duration-300 relative group ${isActive ? "text-primary dark:text-primary" : "text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary"}`}
                                >
                                    {item.label}
                                    <span className={`absolute bottom-0 left-0 h-0.5 bg-primary transition-all duration-300 ${isActive ? "w-full" : "w-0 group-hover:w-full"}`} />
                                </Link>
                            )
                        })}
                    </nav>

                    {/* Right Actions (Notification + Profile/Menu) */}
                    <div className="flex items-center gap-4">
                        <button className="relative p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-300 group">
                            <span className="material-symbols-outlined">notifications</span>
                            <span className="absolute top-1 right-1 size-2 bg-red-500 rounded-full animate-pulse" />
                        </button>

                        {/* Profile Avatar / Auth Buttons */}
                        {loading ? (
                            <div className="size-10 bg-slate-100 rounded-full animate-pulse" />
                        ) : !user ? (
                            <div className="flex items-center gap-3">
                                <Link
                                    href="/login"
                                    className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-primary transition-colors hidden md:block"
                                >
                                    Sign In
                                </Link>
                                <Link
                                    href="/signup"
                                    className="hidden md:block px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
                                >
                                    Register
                                </Link>
                                <Link
                                    href="/login"
                                    className="md:hidden px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
                                >
                                    Login
                                </Link>
                            </div>
                        ) : (
                            <div className="relative" ref={menuRef}>
                                {/* Avatar Trigger */}
                                <button
                                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                                    className="group relative size-10 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-[2px] shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all duration-300 hover:scale-105 active:scale-95"
                                >
                                    <div className="flex h-full w-full items-center justify-center rounded-full bg-white dark:bg-slate-900 backface-hidden">
                                        <span className="text-sm font-bold bg-gradient-to-br from-indigo-600 to-pink-600 bg-clip-text text-transparent group-hover:scale-110 transition-transform duration-300">
                                            {user.username[0].toUpperCase()}
                                        </span>
                                    </div>
                                </button>

                                {/* Responsive Mobile Dropdown Menu */}
                                {isMenuOpen && (
                                    <div className="absolute right-0 top-14 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 border border-slate-100 dark:border-slate-800 p-2 transform origin-top-right animate-in fade-in zoom-in-95 duration-200">

                                        {/* User Info Header */}
                                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 mb-2">
                                            <div className="flex items-center gap-3">
                                                <div className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-lg font-bold text-slate-600 dark:text-slate-300">
                                                    {user.username[0].toUpperCase()}
                                                </div>
                                                <div className="overflow-hidden">
                                                    <p className="font-bold text-slate-900 dark:text-white truncate">{user.username}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Mobile Navigation Links (Hidden on Desktop) */}
                                        <div className="md:hidden space-y-1 mb-2">
                                            {navItems.map((item) => (
                                                <Link
                                                    key={item.label}
                                                    href={item.href}
                                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname === item.href
                                                        ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold"
                                                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white font-medium"
                                                        }`}
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                                                    {item.label}
                                                </Link>
                                            ))}
                                            <div className="h-px bg-slate-100 dark:bg-slate-800 my-2 mx-2"></div>
                                        </div>

                                        {/* Actions */}
                                        <div className="space-y-1">
                                            {/* Desktop-only Profile Link (since it's in main nav on mobile, but redundant is fine) 
                                                Actually, user asked for "Profile" in the menu list. 
                                                I included it in navItems above, so it renders on mobile.
                                                For desktop, we might want "Profile" here too.
                                            */}
                                            <Link
                                                href="/profile"
                                                className="hidden md:flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white font-medium transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-[20px]">person</span>
                                                Profile
                                            </Link>

                                            <button
                                                onClick={logout}
                                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 font-medium transition-colors text-left"
                                            >
                                                <span className="material-symbols-outlined text-[20px]">logout</span>
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
