"use client"
import { Bell } from "lucide-react"

export function NotificationsSection({ settings, setSettings, updateSettings, loading }: any) {
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
                <div className={`absolute top-1 size-4 bg-white rounded-full shadow-sm transition-all ${checked ? 'left-5' : 'left-1'}`} />
            </div>
        </div>
    )

    return (
        <section className="animate-fade-in space-y-6">
            <div>
                <h2 className="text-xl font-bold text-primary flex items-center gap-2">
                    <Bell className="size-5" />
                    Notifications
                </h2>
                <p className="text-sm text-muted-foreground mt-1">Control what alerts you receive.</p>
            </div>
            
            <div className="card-premium p-6 bg-card border border-border shadow-sm rounded-[24px] space-y-6">
                <div className="space-y-6">
                    <Toggle 
                        label="Exam Results" 
                        description="Get notified when your exam analysis is ready"
                        checked={settings.preferences.notify_exam_results}
                        onChange={() => setSettings({...settings, preferences: {...settings.preferences, notify_exam_results: !settings.preferences.notify_exam_results}})}
                    />
                    <div className="h-px bg-border/50" />
                    <Toggle 
                        label="Roadmap Updates" 
                        description="Alerts for new topics in your bookmarked roadmaps"
                        checked={settings.preferences.notify_roadmap_updates}
                        onChange={() => setSettings({...settings, preferences: {...settings.preferences, notify_roadmap_updates: !settings.preferences.notify_roadmap_updates}})}
                    />
                    <div className="h-px bg-border/50" />
                    <Toggle 
                        label="Contributor Activity" 
                        description="When someone replies or upvotes your content"
                        checked={settings.preferences.notify_contributor_activity}
                        onChange={() => setSettings({...settings, preferences: {...settings.preferences, notify_contributor_activity: !settings.preferences.notify_contributor_activity}})}
                    />
                    <div className="h-px bg-border/50" />
                    <Toggle 
                        label="Weekly Progress Report" 
                        description="A summary of your weekly study performance"
                        checked={settings.preferences.notify_weekly_report}
                        onChange={() => setSettings({...settings, preferences: {...settings.preferences, notify_weekly_report: !settings.preferences.notify_weekly_report}})}
                    />
                    <div className="h-px bg-border/50" />
                    <Toggle 
                        label="New Resources" 
                        description="Be the first to know about new study materials"
                        checked={settings.preferences.notify_new_resources}
                        onChange={() => setSettings({...settings, preferences: {...settings.preferences, notify_new_resources: !settings.preferences.notify_new_resources}})}
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
