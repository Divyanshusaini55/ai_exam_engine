"use client"

import { useAuth } from "@/context/auth-context"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Navbar } from "@/components/navbar"
import { 
    User, 
    Settings,
    Target,
    Bell,
    Monitor,
    Users,
    Shield,
    Database,
    AlertTriangle,
    Loader2
} from "lucide-react"

import { api } from "@/lib/api"
// Import components
import { ProfileSection } from "@/components/settings/ProfileSection"
import { AccountSection } from "@/components/settings/AccountSection"
import { ExamPreferencesSection } from "@/components/settings/ExamPreferencesSection"
import { NotificationsSection } from "@/components/settings/NotificationsSection"
import { AppearanceSection } from "@/components/settings/AppearanceSection"
import { ContributorPreferencesSection } from "@/components/settings/ContributorPreferencesSection"
import { SecuritySection } from "@/components/settings/SecuritySection"
import { DataPrivacySection } from "@/components/settings/DataPrivacySection"
import { DangerZoneSection } from "@/components/settings/DangerZoneSection"

export default function SettingsPage() {
    const { user, loading: authLoading } = useAuth()
    const router = useRouter()
    
    const [settings, setSettings] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [activeTab, setActiveTab] = useState("profile")

    const tabs = [
        { id: "profile", label: "Profile", icon: User },
        { id: "account", label: "Account", icon: Settings },
        { id: "exam-preferences", label: "Exam Preferences", icon: Target },
        { id: "notifications", label: "Notifications", icon: Bell },
        { id: "appearance", label: "Appearance", icon: Monitor },
        { id: "contributor", label: "Contributor", icon: Users },
        { id: "security", label: "Security", icon: Shield },
        { id: "privacy", label: "Data & Privacy", icon: Database },
        { id: "danger-zone", label: "Danger Zone", icon: AlertTriangle, danger: true },
    ]

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/login?redirectTo=/settings")
        }
    }, [user, authLoading, router])

    useEffect(() => {
        if (user) {
            fetchSettings()
        }
    }, [user])

    const fetchSettings = async () => {
        try {
            const { data } = await api.get("/community/settings/")
            setSettings(data)
        } catch (error) {
            console.error("Failed to fetch settings:", error)
        } finally {
            setLoading(false)
        }
    }

    const updateSettings = async () => {
        setSaving(true)
        try {
            await api.patch("/community/settings/", settings)
            alert("Settings saved successfully!")
        } catch (error: any) {
            console.error("Failed to update settings:", error)
            let errorMsg = "Failed to save settings."
            if (error.response?.data) {
                const data = error.response.data
                if (data.account?.username) errorMsg = data.account.username[0]
                else if (data.account?.email) errorMsg = data.account.email[0]
                else errorMsg = "Validation error: Please check your inputs."
            }
            alert(errorMsg)
        } finally {
            setSaving(false)
        }
    }

    if (authLoading || loading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="size-8 text-primary animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background font-sans selection:bg-primary/10">
            <Navbar />
            
            <main className="max-w-6xl mx-auto px-4 md:px-8 py-10">
                <div className="mb-8 animate-fade-in">
                    <h1 className="text-3xl font-bold font-heading text-primary tracking-tight">Settings</h1>
                    <p className="text-muted-foreground mt-2">Manage your account preferences and customize your experience.</p>
                </div>

                <div className="flex flex-col lg:flex-row gap-8 animate-fade-in" style={{ animationDelay: "100ms" }}>
                    {/* Sidebar Tabs */}
                    <aside className="w-full lg:w-64 shrink-0">
                        <nav className="flex lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
                            {tabs.map(tab => {
                                const Icon = tab.icon
                                const isActive = activeTab === tab.id
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                                            isActive 
                                            ? tab.danger ? "bg-red-500 text-white shadow-sm" : "bg-primary text-primary-foreground shadow-sm"
                                            : tab.danger ? "text-red-500 hover:bg-red-50" : "text-muted-foreground hover:bg-secondary hover:text-primary"
                                        }`}
                                    >
                                        <Icon className="size-4 shrink-0" />
                                        {tab.label}
                                    </button>
                                )
                            })}
                        </nav>
                    </aside>

                    {/* Main Content Area */}
                    <div className="flex-1 min-w-0">
                        {activeTab === "profile" && <ProfileSection settings={settings} setSettings={setSettings} updateSettings={updateSettings} loading={saving} />}
                        {activeTab === "account" && <AccountSection settings={settings} setSettings={setSettings} updateSettings={updateSettings} loading={saving} />}
                        {activeTab === "exam-preferences" && <ExamPreferencesSection settings={settings} setSettings={setSettings} updateSettings={updateSettings} loading={saving} />}
                        {activeTab === "notifications" && <NotificationsSection settings={settings} setSettings={setSettings} updateSettings={updateSettings} loading={saving} />}
                        {activeTab === "appearance" && <AppearanceSection settings={settings} setSettings={setSettings} updateSettings={updateSettings} loading={saving} />}
                        {activeTab === "contributor" && <ContributorPreferencesSection settings={settings} setSettings={setSettings} updateSettings={updateSettings} loading={saving} />}
                        {activeTab === "security" && <SecuritySection settings={settings} setSettings={setSettings} updateSettings={updateSettings} loading={saving} />}
                        {activeTab === "privacy" && <DataPrivacySection settings={settings} />}
                        {activeTab === "danger-zone" && <DangerZoneSection settings={settings} />}
                    </div>
                </div>
            </main>
        </div>
    )
}
