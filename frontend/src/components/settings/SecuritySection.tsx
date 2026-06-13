"use client"
import { Shield, Lock } from "lucide-react"

export function SecuritySection({ settings, setSettings, updateSettings, loading }: any) {
    if (!settings) return null;

    return (
        <section className="animate-fade-in space-y-6">
            <div>
                <h2 className="text-xl font-bold text-primary flex items-center gap-2">
                    <Shield className="size-5" />
                    Security
                </h2>
                <p className="text-sm text-muted-foreground mt-1">Keep your account secure.</p>
            </div>
            
            <div className="card-premium p-6 bg-card border border-border shadow-sm rounded-[24px] space-y-6">
                <div>
                    <h3 className="text-sm font-bold text-primary mb-4">Change Password</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-bold text-muted-foreground">Current Password</label>
                            <input 
                                type="password" 
                                className="w-full mt-1.5 p-3 rounded-xl border border-border bg-card text-primary font-medium focus:outline-none focus:border-primary/50"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-bold text-muted-foreground">New Password</label>
                            <input 
                                type="password" 
                                className="w-full mt-1.5 p-3 rounded-xl border border-border bg-card text-primary font-medium focus:outline-none focus:border-primary/50"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-bold text-muted-foreground">Confirm New Password</label>
                            <input 
                                type="password" 
                                className="w-full mt-1.5 p-3 rounded-xl border border-border bg-card text-primary font-medium focus:outline-none focus:border-primary/50"
                            />
                        </div>
                    </div>
                </div>

                <div className="pt-4 flex justify-end">
                    <button 
                        className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-sm hover:opacity-90 transition-all flex items-center gap-2"
                    >
                        <Lock className="size-4" />
                        Update Password
                    </button>
                </div>
            </div>
        </section>
    )
}
