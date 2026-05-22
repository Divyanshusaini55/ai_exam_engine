"use client"

import { 
    Trophy, 
    X, 
    FileText, 
    CheckSquare, 
    PenTool, 
    Layout, 
    Star, 
    ThumbsUp, 
    MessageSquare, 
    Heart, 
    Calendar,
    Send
} from "lucide-react"
import { cn } from "@/lib/utils"

interface XPActivity {
    title: string
    description: string
    amount: number
    icon: any
    color: string
}

const ACTIVITIES: XPActivity[] = [
    {
        title: "Question paper approved",
        description: "Awarded when submitted question paper is approved",
        amount: 50,
        icon: FileText,
        color: "text-amber-600 bg-amber-500/10"
    },
    {
        title: "Correction approved",
        description: "Awarded when a user correction is approved",
        amount: 25,
        icon: CheckSquare,
        color: "text-blue-600 bg-blue-500/10"
    },
    {
        title: "Post a solution",
        description: "Awarded when a user posts a new solution",
        amount: 15,
        icon: PenTool,
        color: "text-indigo-600 bg-indigo-500/10"
    },
    {
        title: "Format fix approved",
        description: "Awarded when a format fix request is approved",
        amount: 15,
        icon: Layout,
        color: "text-purple-600 bg-purple-500/10"
    },
    {
        title: "Quiz score >80%",
        description: "Awarded when quiz evaluation score exceeds 80%",
        amount: 10,
        icon: Star,
        color: "text-success text-success bg-success/10"
    },
    {
        title: "Solution upvoted",
        description: "Awarded to solution author when upvoted",
        amount: 5,
        icon: ThumbsUp,
        color: "text-sky-600 bg-sky-500/10"
    },
    {
        title: "Post a comment",
        description: "Awarded when a user posts a comment",
        amount: 5,
        icon: MessageSquare,
        color: "text-emerald-600 bg-emerald-500/10"
    },
    {
        title: "Comment liked",
        description: "Awarded to comment author when liked",
        amount: 3,
        icon: Heart,
        color: "text-pink-600 bg-pink-500/10"
    },
    {
        title: "Daily visit",
        description: "Awarded once per day for visiting the site",
        amount: 2,
        icon: Calendar,
        color: "text-orange-600 bg-orange-500/10"
    },
    {
        title: "Submit a quiz",
        description: "Awarded once per question paper for submitting a quiz",
        amount: 1,
        icon: Send,
        color: "text-slate-600 bg-slate-500/10"
    }
]

export function XPGuideModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />
            
            {/* Modal Content */}
            <div className="relative w-full max-w-[500px] max-h-[85vh] bg-card rounded-[32px] border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-300 flex flex-col">
                
                {/* Header */}
                <div className="p-6 md:p-8 border-b border-border/50">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                            <div className="size-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                                <Trophy className="size-6" />
                            </div>
                            <h2 className="text-2xl font-bold font-heading text-primary tracking-tight">How to Earn XP</h2>
                        </div>
                        <button 
                            onClick={onClose}
                            className="p-2 hover:bg-secondary rounded-full transition-colors text-muted-foreground hover:text-primary"
                        >
                            <X className="size-5" />
                        </button>
                    </div>
                    <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                        Complete these activities to earn XP and climb the subject leaderboard.
                    </p>
                </div>

                {/* List - Scrollable */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 custom-scrollbar">
                    {ACTIVITIES.map((activity, i) => (
                        <div 
                            key={i}
                            className="group relative flex items-center justify-between p-4 rounded-2xl border border-border/50 bg-secondary/5 hover:bg-secondary/20 hover:border-border transition-all duration-300"
                        >
                            <div className="flex items-center gap-4">
                                <div className={cn(
                                    "size-12 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 shadow-sm",
                                    activity.color
                                )}>
                                    <activity.icon className="size-6" />
                                </div>
                                <div className="min-w-0">
                                    <h4 className="text-[15px] font-bold text-primary mb-0.5">{activity.title}</h4>
                                    <p className="text-[12px] text-muted-foreground font-medium line-clamp-1">{activity.description}</p>
                                </div>
                            </div>
                            <div className="text-right shrink-0 ml-4">
                                <span className="text-[15px] font-black text-success tracking-tight">+{activity.amount} xp</span>
                            </div>
                        </div>
                    ))}
                    
                    {/* Bottom Padding for scroll */}
                    <div className="h-2" />
                </div>
            </div>
        </div>
    )
}
