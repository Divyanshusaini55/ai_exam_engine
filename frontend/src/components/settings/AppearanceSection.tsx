"use client"
import { Monitor, Sun, Moon } from "lucide-react"
import { useTheme } from "next-themes"

export function AppearanceSection({ settings, setSettings, updateSettings, loading }: any) {
    const { setTheme } = useTheme()

    if (!settings) return null;

    const themes = [
        { id: "light", label: "Light", icon: Sun },
        { id: "dark", label: "Dark", icon: Moon },
        { id: "system", label: "System", icon: Monitor },
    ]

    const handleThemeChange = (newTheme: string) => {
        setTheme(newTheme)
        setSettings({...settings, preferences: {...settings.preferences, theme: newTheme}})
    }

    return (
        <section className="animate-fade-in space-y-6">
            <div>
                <h2 className="text-xl font-bold text-primary flex items-center gap-2">
                    <Monitor className="size-5" />
                    Appearance
                </h2>
                <p className="text-sm text-muted-foreground mt-1">Customize how ExamIntel looks on your device.</p>
            </div>
            
            <div className="card-premium p-6 bg-card border border-border shadow-sm rounded-[24px] space-y-6">
                <div>
                    <h3 className="text-sm font-bold text-primary mb-4">Theme Preference</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {themes.map((t) => {
                            const Icon = t.icon
                            const isActive = settings.preferences.theme === t.id
                            return (
                                <div 
                                    key={t.id}
                                    onClick={() => handleThemeChange(t.id)}
                                    className={`p-3 rounded-2xl border-2 cursor-pointer transition-all flex flex-col items-center gap-2 ${
                                        isActive 
                                        ? "border-primary bg-primary/5" 
                                        : "border-border bg-card hover:border-primary/30"
                                    }`}
                                >
                                    <div className={`p-2 rounded-xl ${isActive ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                                        <Icon className="size-5" />
                                    </div>
                                    <span className={`text-sm font-bold ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                                        {t.label}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </div>

                <div className="pt-4 flex justify-end">
                    <button 
                        onClick={updateSettings}
                        disabled={loading}
                        className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-sm hover:opacity-90 disabled:opacity-50 transition-all"
                    >
                        Save Preferences
                    </button>
                </div>
            </div>
        </section>
    )
}
