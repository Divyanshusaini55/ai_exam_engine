"use client"
import { ShieldAlert } from "lucide-react"

export function AccountSection({ settings, setSettings, updateSettings, loading }: any) {
    if (!settings) return null;

    return (
        <section className="animate-fade-in space-y-6">
            <div>
                <h2 className="text-xl font-bold text-primary">Account Details</h2>
                <p className="text-sm text-muted-foreground mt-1">Manage your unique identity on ExamIntel.</p>
            </div>
            
            <div className="card-premium p-6 bg-card border border-border shadow-sm rounded-[24px] space-y-6">
                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-bold text-muted-foreground">Username</label>
                        <input 
                            type="text" 
                            value={settings.account.username || ""} 
                            onChange={(e) => setSettings({...settings, account: {...settings.account, username: e.target.value}})}
                            className="w-full mt-1.5 p-3 rounded-xl border border-border bg-card text-primary font-medium focus:outline-none focus:border-primary/50"
                        />
                        <p className="text-xs text-muted-foreground mt-1.5">Must be unique. Alphanumeric characters only.</p>
                    </div>
                    <div>
                        <label className="text-sm font-bold text-muted-foreground">Email Address</label>
                        <input 
                            type="email" 
                            value={settings.account.email || ""} 
                            onChange={(e) => setSettings({...settings, account: {...settings.account, email: e.target.value}})}
                            className="w-full mt-1.5 p-3 rounded-xl border border-border bg-card text-primary font-medium focus:outline-none focus:border-primary/50"
                        />
                    </div>
                </div>

                <div className="pt-4 flex justify-end">
                    <button 
                        onClick={updateSettings}
                        disabled={loading}
                        className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-sm hover:opacity-90 disabled:opacity-50 transition-all"
                    >
                        Save Account Details
                    </button>
                </div>
            </div>
        </section>
    )
}
