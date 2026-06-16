"use client"
import { User, Upload } from "lucide-react"
import { getAvatarUrl } from "@/lib/utils"

export function ProfileSection({ settings, setSettings, updateSettings, loading }: any) {
    if (!settings) return null;
    
    return (
        <section className="animate-fade-in space-y-6">
            <div>
                <h2 className="text-xl font-bold text-primary flex items-center gap-2">
                    <User className="size-5" />
                    Profile
                </h2>
                <p className="text-sm text-muted-foreground mt-1">Manage your public profile information.</p>
            </div>
            
            <div className="card-premium p-6 bg-card border border-border shadow-sm rounded-[24px] space-y-6">
                <div className="flex items-center gap-6">
                    <div className="size-24 rounded-full border-[4px] border-secondary bg-primary/10 flex items-center justify-center text-3xl font-bold text-primary overflow-hidden shrink-0 relative group">
                        {settings.profile.avatar_image ? (
                            <img 
                                src={getAvatarUrl(settings.profile.avatar_image) || ''} 
                                alt="Avatar" 
                                className="w-full h-full object-cover" 
                            />
                        ) : (
                            settings.profile.avatar_char
                        )}
                        <label htmlFor="avatar-upload" className="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center cursor-pointer transition-all">
                            <Upload className="size-6 text-white" />
                        </label>
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <label htmlFor="avatar-upload" className="flex items-center justify-center gap-2 cursor-pointer px-4 py-2 bg-secondary text-primary font-bold rounded-xl text-sm hover:bg-secondary/80 transition-colors">
                                <Upload className="size-4 shrink-0" />
                                <span className="hidden sm:inline">Upload new avatar</span>
                                <span className="sm:hidden"></span>
                            </label>
                            {settings.profile.avatar_image && (
                                <button 
                                    onClick={() => setSettings({...settings, profile: {...settings.profile, avatar_image: null}})}
                                    className="px-4 py-2 bg-red-500/10 text-red-500 font-bold rounded-xl text-sm hover:bg-red-500/20 transition-colors"
                                >
                                    Remove
                                </button>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 font-medium">JPG, GIF or PNG. 1MB max.</p>
                        <input 
                            type="file" 
                            id="avatar-upload" 
                            accept="image/png, image/jpeg, image/gif" 
                            className="hidden" 
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    if (file.size > 1024 * 1024) {
                                        alert("File size must be under 1MB.");
                                        return;
                                    }
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                        const base64String = event.target?.result as string;
                                        setSettings({...settings, profile: {...settings.profile, avatar_image: base64String}});
                                    };
                                    reader.readAsDataURL(file);
                                }
                            }}
                        />
                    </div>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-bold text-muted-foreground">Display Name</label>
                        <input 
                            type="text" 
                            value={settings.profile.full_name || ""} 
                            onChange={(e) => setSettings({...settings, profile: {...settings.profile, full_name: e.target.value}})}
                            className="w-full mt-1.5 p-3 rounded-xl border border-border bg-card text-primary font-medium focus:outline-none focus:border-primary/50"
                            placeholder="Your Name"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-bold text-muted-foreground">Bio</label>
                        <textarea 
                            value={settings.profile.bio || ""} 
                            onChange={(e) => setSettings({...settings, profile: {...settings.profile, bio: e.target.value}})}
                            className="w-full mt-1.5 p-3 rounded-xl border border-border bg-card text-primary font-medium focus:outline-none focus:border-primary/50 min-h-[100px]"
                            placeholder="Tell us about yourself..."
                        />
                    </div>
                </div>

                <div className="pt-4 flex justify-end">
                    <button 
                        onClick={updateSettings}
                        disabled={loading}
                        className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-sm hover:opacity-90 disabled:opacity-50 transition-all"
                    >
                        Save Changes
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
                <div className="card-premium p-4 bg-card border border-border shadow-sm rounded-[16px] text-center">
                    <p className="text-2xl font-bold text-amber-600 font-heading">{settings.profile.xp}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Total XP</p>
                </div>
                <div className="card-premium p-4 bg-card border border-border shadow-sm rounded-[16px] text-center">
                    <p className="text-2xl font-bold text-orange-600 font-heading">{settings.profile.streak}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Day Streak</p>
                </div>
                <div className="card-premium p-4 bg-card border border-border shadow-sm rounded-[16px] text-center">
                    <p className="text-2xl font-bold text-primary font-heading">#{settings.profile.community_rank || '-'}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Global Rank</p>
                </div>
            </div>
        </section>
    )
}
