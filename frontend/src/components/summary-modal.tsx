"use client"

import { X } from "lucide-react"
import MarkdownRenderer from "./markdown-renderer"

interface SummaryModalProps {
    isOpen: boolean
    onClose: () => void
    examTitle: string
    summaryText: string
    isLoading?: boolean
}

export function SummaryModal({ isOpen, onClose, examTitle, summaryText, isLoading }: SummaryModalProps) {
    if (!isOpen) return null

    // Default summary if empty to show the UI is working
    const displaySummary = summaryText || `## AI Summary Not Available\nNo summary has been generated for **${examTitle}** yet.`

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center px-2 py-6 sm:p-10">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" 
                onClick={onClose}
            />
            
            {/* Modal Content */}
            <div className="relative bg-white dark:bg-[#1A1A1A] w-full max-w-3xl h-[85vh] rounded-[24px] sm:rounded-[32px] shadow-2xl flex flex-col overflow-hidden animate-scale-in border border-white/10">
                
                {/* Header */}
                <div className="flex items-center justify-between px-5 sm:px-8 py-4 sm:py-6 border-b border-border/50 bg-card/30 shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-primary tracking-tight">Summary</h2>
                        <p className="text-[12px] text-destructive font-bold mt-1">This is AI-generated content and may contain mistakes.</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="size-10 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground transition-colors"
                    >
                        <X className="size-5" />
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto px-3 py-4 sm:p-5 prose dark:prose-invert prose-sm md:prose-base max-w-none prose-headings:text-primary prose-a:text-blue-500 font-crimson prose-headings:font-heading prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-h4:text-base prose-p:text-[17px] prose-li:text-[17px]">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full py-20 space-y-4">
                            <div className="relative size-16 flex items-center justify-center">
                                <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-ping" />
                                <div className="size-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                            </div>
                            <div className="text-center">
                                <h3 className="text-lg font-bold text-primary animate-pulse">Generating AI Summary...</h3>
                                <p className="text-xs text-muted-foreground mt-1">Analyzing questions, subjects, and difficulty patterns</p>
                            </div>
                        </div>
                    ) : (
                        <MarkdownRenderer content={displaySummary} variant="prose" className="!p-0 !border-0 !shadow-none !bg-transparent" />
                    )}
                </div>
                
                {/* Footer (matches second screenshot close button) */}
                <div className="px-5 sm:px-8 py-4 border-t border-border/50 bg-card/30 flex justify-end shrink-0">
                    <button 
                        onClick={onClose}
                        className="px-8 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl shadow-sm hover:opacity-90 transition-opacity active:scale-95"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}
