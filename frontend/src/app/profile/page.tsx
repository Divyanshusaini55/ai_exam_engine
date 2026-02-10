"use client"

import { useAuth } from "@/context/auth-context"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Navbar } from "@/components/navbar"

export default function ProfilePage() {
    const { user, loading, logout } = useAuth()
    const router = useRouter()

    // Local state for toggles (mock functionality for UI demo)
    const [notificationsEnabled, setNotificationsEnabled] = useState(true)
    const [darkModeEnabled, setDarkModeEnabled] = useState(false)

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login?redirectTo=/profile")
        }
    }, [user, loading, router])

    // Set noindex meta tag for SEO
    useEffect(() => {
        const metaRobots = document.querySelector('meta[name="robots"]')
        if (metaRobots) {
            metaRobots.setAttribute('content', 'noindex, nofollow')
        } else {
            const meta = document.createElement('meta')
            meta.name = 'robots'
            meta.content = 'noindex, nofollow'
            document.head.appendChild(meta)
        }
    }, [])

    if (loading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-slate-950">
                <div className="animate-spin size-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 font-sans transition-colors duration-500">
            <Navbar />
            <div className="py-12 px-4 md:px-8">
                <div className="max-w-4xl mx-auto animate-fade-in-up">

                    {/* Main Profile Card */}
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">

                        {/* Artistic Header */}
                        <div className="h-40 bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 relative">
                            <div className="absolute inset-0 bg-white/5 pattern-dots opacity-20"></div>
                        </div>

                        <div className="px-8 md:px-12 pb-12 relative">
                            {/* Avatar & Header Info */}
                            <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 -mt-12 mb-10">
                                <div className="flex flex-col md:flex-row items-center md:items-end gap-6">
                                    <div className="size-24 md:size-32 rounded-full border-[6px] border-white dark:border-slate-900 bg-slate-100 dark:bg-slate-800 shadow-lg flex items-center justify-center text-4xl overflow-hidden relative group cursor-pointer">
                                        <span className="group-hover:opacity-50 transition-opacity">
                                            {user.username[0].toUpperCase()}
                                        </span>
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="material-symbols-outlined text-white text-2xl">edit</span>
                                        </div>
                                    </div>
                                    <div className="text-center md:text-left mb-2">
                                        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-1">
                                            {user.username}
                                        </h1>
                                        <p className="text-slate-500 dark:text-slate-400 font-medium">
                                            {user.email}
                                        </p>
                                    </div>
                                </div>

                                <button
                                    onClick={logout}
                                    className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-red-600 dark:hover:text-red-400 transition-all active:scale-95 flex items-center gap-2 shadow-sm"
                                >
                                    <span className="material-symbols-outlined text-[18px]">logout</span>
                                    Sign Out
                                </button>
                            </div>

                            {/* Content Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 border-t border-slate-100 dark:border-slate-800 pt-10">

                                {/* Left Column: Account Info */}
                                <div>
                                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Account Details</h3>

                                    <div className="space-y-6">
                                        <div className="group">
                                            <span className="text-xs font-bold text-slate-400 block mb-1.5 group-hover:text-indigo-500 transition-colors">USER ID</span>
                                            <div className="flex items-center gap-3">
                                                <span className="font-mono text-sm bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                    #{user.id.toString().padStart(6, '0')}
                                                </span>
                                                <span className="text-xs text-slate-400">Unique Identifier</span>
                                            </div>
                                        </div>

                                        <div className="group">
                                            <span className="text-xs font-bold text-slate-400 block mb-1.5 group-hover:text-indigo-500 transition-colors">MEMBER SINCE</span>
                                            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-medium">
                                                <span className="material-symbols-outlined text-slate-400 text-[20px]">calendar_month</span>
                                                {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                            </div>
                                        </div>

                                        <div className="group">
                                            <span className="text-xs font-bold text-slate-400 block mb-1.5 group-hover:text-indigo-500 transition-colors">PLAN</span>
                                            <div className="flex items-center gap-2">
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold border border-indigo-100 dark:border-indigo-800">
                                                    <span className="material-symbols-outlined text-[14px]">school</span>
                                                    Student Free
                                                </span>
                                                <Link href="#" className="text-xs font-bold text-indigo-600 hover:underline">Upgrade Plan</Link>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Preferences */}
                                <div>
                                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Preferences</h3>

                                    <div className="space-y-6">
                                        {/* Email Toggle */}
                                        <div className="flex items-center justify-between group cursor-pointer" onClick={() => setNotificationsEnabled(!notificationsEnabled)}>
                                            <div className="flex items-center gap-3">
                                                <div className="size-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center transition-colors group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40">
                                                    <span className="material-symbols-outlined">mail</span>
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900 dark:text-white">Email Notifications</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">Updates & exam results</p>
                                                </div>
                                            </div>
                                            {/* Toggle Switch */}
                                            <div className={`w-12 h-7 rounded-full transition-colors duration-300 relative ${notificationsEnabled ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                                <div className={`absolute top-1 size-5 bg-white rounded-full shadow-sm transition-transform duration-300 ${notificationsEnabled ? 'left-[22px]' : 'left-1'}`}></div>
                                            </div>
                                        </div>

                                        {/* Dark Mode Toggle (Visual Only for now) */}
                                        <div className="flex items-center justify-between group cursor-pointer" onClick={() => setDarkModeEnabled(!darkModeEnabled)}>
                                            <div className="flex items-center gap-3">
                                                <div className="size-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center transition-colors group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/40">
                                                    <span className="material-symbols-outlined">dark_mode</span>
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900 dark:text-white">Dark Mode</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">Adjust appearance</p>
                                                </div>
                                            </div>
                                            {/* Toggle Switch */}
                                            <div className={`w-12 h-7 rounded-full transition-colors duration-300 relative ${darkModeEnabled ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                                <div className={`absolute top-1 size-5 bg-white rounded-full shadow-sm transition-transform duration-300 ${darkModeEnabled ? 'left-[22px]' : 'left-1'}`}></div>
                                            </div>
                                        </div>

                                        {/* Edit Button Placeholder */}
                                        <button className="w-full mt-4 py-3 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
                                            <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
                                            Manage Account Settings
                                        </button>

                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
