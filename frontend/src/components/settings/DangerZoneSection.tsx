"use client"
import { AlertTriangle, Trash2 } from "lucide-react"
import { useState } from "react"
import { useRouter } from "next/navigation"

import { api } from "@/lib/api"

export function DangerZoneSection({ settings }: any) {
    const [confirmText, setConfirmText] = useState("")
    const [deleting, setDeleting] = useState(false)
    const router = useRouter()

    if (!settings) return null;

    const handleDelete = async () => {
        if (confirmText !== "DELETE_ACCOUNT") return;
        setDeleting(true)
        try {
            await api.post("/community/settings/delete-account/", { confirmation: confirmText })
            localStorage.removeItem("auth_token")
            localStorage.removeItem("refresh_token")
            router.push("/")
        } catch (error) {
            console.error("Delete failed", error)
            alert("Failed to delete account.")
            setDeleting(false)
        }
    }

    return (
        <section className="animate-fade-in space-y-6">
            <div>
                <h2 className="text-xl font-bold text-red-500 flex items-center gap-2">
                    <AlertTriangle className="size-5" />
                    Danger Zone
                </h2>
                <p className="text-sm text-muted-foreground mt-1">Irreversible and destructive actions.</p>
            </div>
            
            <div className="card-premium p-6 bg-red-500/5 border border-red-500/20 shadow-sm rounded-[24px] space-y-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
                
                <div>
                    <h3 className="text-sm font-bold text-red-500 mb-2">Delete Account</h3>
                    <p className="text-sm text-muted-foreground mb-4 max-w-xl">
                        Once you delete your account, there is no going back. All your data, exam history, xp, and contributions will be permanently removed. Please be certain.
                    </p>
                    
                    <div className="space-y-4 max-w-md">
                        <div>
                            <label className="text-xs font-bold text-red-500/80 uppercase tracking-wider">Type 'DELETE_ACCOUNT' to confirm</label>
                            <input 
                                type="text" 
                                value={confirmText}
                                onChange={(e) => setConfirmText(e.target.value)}
                                className="w-full mt-1.5 p-3 rounded-xl border border-red-500/30 bg-card text-primary font-medium focus:outline-none focus:border-red-500"
                                placeholder="DELETE_ACCOUNT"
                            />
                        </div>
                        <button 
                            onClick={handleDelete}
                            disabled={deleting || confirmText !== "DELETE_ACCOUNT"}
                            className="w-full px-6 py-3 rounded-xl bg-red-500 text-white text-sm font-bold shadow-sm hover:bg-red-600 disabled:opacity-50 disabled:hover:bg-red-500 transition-all flex items-center justify-center gap-2"
                        >
                            <Trash2 className="size-4" />
                            {deleting ? "Deleting..." : "Permanently Delete Account"}
                        </button>
                    </div>
                </div>
            </div>
        </section>
    )
}
