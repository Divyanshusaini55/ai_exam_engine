"use client"
import { Users } from "lucide-react"

export function ContributorPreferencesSection({ settings, setSettings, updateSettings, loading }: any) {
    if (!settings) return null;

    const Toggle = ({ label, description, checked, onChange }: any) => (
        <div className="flex items-center justify-between">
            <div>
                <p className="font-bold text-primary">{label}</p>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <div 
                onClick={onChange}
                className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors ${checked ? 'bg-primary' : 'bg-border'}`}
            >
                <div className={`absolute top-1 size-4 rounded-full shadow-sm transition-all ${checked ? 'left-5 bg-primary-foreground' : 'left-1 bg-white'}`} />
            </div>
        </div>
    )

    return (
        <section className="animate-fade-in space-y-6">
            <div>
                <h2 className="text-xl font-bold text-primary flex items-center gap-2">
                    <Users className="size-5" />
                    Contributor Preferences
                </h2>
                <p className="text-sm text-muted-foreground mt-1">Manage what others can see on your public profile.</p>
            </div>
            
            <div className="card-premium p-6 bg-card border border-border shadow-sm rounded-[24px] space-y-6">
                <div className="space-y-6">
                    <Toggle 
                        label="Public Profile" 
                        description="Allow others to view your profile page"
                        checked={settings.preferences.is_public_profile}
                        onChange={() => setSettings({...settings, preferences: {...settings.preferences, is_public_profile: !settings.preferences.is_public_profile}})}
                    />
                    <div className="h-px bg-border/50" />
                    <Toggle 
                        label="Show XP" 
                        description="Display your total earned XP"
                        checked={settings.preferences.show_xp}
                        onChange={() => setSettings({...settings, preferences: {...settings.preferences, show_xp: !settings.preferences.show_xp}})}
                    />
                    <div className="h-px bg-border/50" />
                    <Toggle 
                        label="Show Streak" 
                        description="Display your current study streak"
                        checked={settings.preferences.show_streak}
                        onChange={() => setSettings({...settings, preferences: {...settings.preferences, show_streak: !settings.preferences.show_streak}})}
                    />
                    <div className="h-px bg-border/50" />
                    <Toggle 
                        label="Show Global Rank" 
                        description="Display your leaderboard position"
                        checked={settings.preferences.show_rank}
                        onChange={() => setSettings({...settings, preferences: {...settings.preferences, show_rank: !settings.preferences.show_rank}})}
                    />
                    <div className="h-px bg-border/50" />
                    <Toggle 
                        label="Show Contribution Activity" 
                        description="Show your history of uploads, comments, and suggestions"
                        checked={settings.preferences.show_contribution_activity}
                        onChange={() => setSettings({...settings, preferences: {...settings.preferences, show_contribution_activity: !settings.preferences.show_contribution_activity}})}
                    />
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
