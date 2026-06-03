"use client"

import { useState, useEffect, useCallback } from "react"
import { 
    X, 
    Check, 
    MessageSquare, 
    Plus, 
    Type, 
    CheckSquare, 
    ListTodo, 
    Send,
    ThumbsUp,
    AlertCircle,
    RotateCw
} from "lucide-react"
import { communityApi, examApi } from "@/lib/api"
import { useAuth } from "@/context/auth-context"

interface SuggestCorrectionModalProps {
    isOpen: boolean
    onClose: () => void
    question: any
}

export function SuggestCorrectionModal({ isOpen, onClose, question }: SuggestCorrectionModalProps) {
    const { user } = useAuth()
    const [activeTab, setActiveTab] = useState<'list' | 'new'>('list')
    const [correctionType, setCorrectionType] = useState<'question_text' | 'correct_answer' | 'option_text'>('question_text')
    
    // Form state
    const [questionText, setQuestionText] = useState(question?.question_text || "")
    const [correctAnswerId, setCorrectAnswerId] = useState<number | null>(null)
    const [options, setOptions] = useState<any[]>(question?.answers || [])
    const [note, setNote] = useState("")
    
    const [suggestions, setSuggestions] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    // Reset form when question changes or modal opens
    useEffect(() => {
        if (question) {
            setQuestionText(question.question_text)
            setOptions(question.answers || [])
            const currentCorrect = question.answers?.find((a: any) => a.is_correct)
            setCorrectAnswerId(currentCorrect?.id || null)
        }
    }, [question])

    const fetchSuggestions = useCallback(async () => {
        if (!question) return
        setLoading(true)
        try {
            // Assuming we have an endpoint for this
            const res = await examApi.getSuggestions(question.id)
            setSuggestions(res.data.results || res.data || [])
        } catch (error) {
            console.error("Failed to fetch suggestions:", error)
        } finally {
            setLoading(false)
        }
    }, [question])

    useEffect(() => {
        if (isOpen && activeTab === 'list') {
            fetchSuggestions()
        }
    }, [isOpen, activeTab, question, fetchSuggestions])

    const handleSubmit = async () => {
        if (!user) {
            alert("Please login to submit suggestions.")
            return
        }

        setSubmitting(true)
        try {
            let suggestion_data = {}
            if (correctionType === 'question_text') {
                suggestion_data = { question_text: questionText }
            } else if (correctionType === 'correct_answer') {
                suggestion_data = { correct_answer_id: correctAnswerId }
            } else if (correctionType === 'option_text') {
                suggestion_data = { options: options.map(o => ({ id: o.id, text: o.answer_text })) }
            }

            await examApi.submitSuggestion({
                question: question.id,
                type: correctionType,
                suggestion_data,
                note
            })

            alert("Suggestion submitted successfully! It will be reviewed by the community.")
            setActiveTab('list')
            setNote("")
        } catch (error) {
            console.error("Failed to submit suggestion:", error)
            alert("Failed to submit suggestion. Please try again.")
        } finally {
            setSubmitting(false)
        }
    }

    const handleUpvote = async (id: number) => {
        try {
            await examApi.upvoteSuggestion(id)
            setSuggestions(prev => prev.map(s => s.id === id ? { ...s, upvotes: s.upvotes + 1 } : s))
        } catch (error) {
            console.error("Upvote failed:", error)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-10">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" 
                onClick={onClose}
            />
            
            {/* Modal Content */}
            <div className="relative bg-white dark:bg-[#1A1A1A] w-full max-w-4xl h-[85vh] rounded-[32px] shadow-2xl flex flex-col overflow-hidden animate-scale-in border border-white/10">
                
                {/* Header */}
                <div className="flex items-center justify-between px-8 py-6 border-b border-border/50 bg-card/30 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="size-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                            <Plus className="size-6 text-blue-500" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-primary tracking-tight">Suggest Correction</h2>
                            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">Help improve this question</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="size-10 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground transition-colors"
                    >
                        <X className="size-5" />
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto flex flex-col">
                    
                    {/* Tab Navigation */}
                    <div className="px-8 pt-8">
                        <div className="bg-secondary/50 p-1 rounded-2xl flex gap-1">
                            <button 
                                onClick={() => setActiveTab('list')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'list' ? 'bg-white dark:bg-[#2A2A2A] text-primary shadow-sm' : 'text-muted-foreground hover:text-primary'}`}
                            >
                                <MessageSquare className="size-4" />
                                Suggestions
                            </button>
                            <button 
                                onClick={() => setActiveTab('new')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'new' ? 'bg-white dark:bg-[#2A2A2A] text-primary shadow-sm' : 'text-muted-foreground hover:text-primary'}`}
                            >
                                <Plus className="size-4" />
                                New Suggestion
                            </button>
                        </div>
                    </div>

                    {activeTab === 'list' ? (
                        <div className="flex-1 p-8">
                            {loading ? (
                                <div className="h-full flex flex-col items-center justify-center gap-4 text-muted-foreground/40">
                                    <RotateCw className="size-12 animate-spin" />
                                    <p className="font-medium">Loading suggestions...</p>
                                </div>
                            ) : suggestions.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto">
                                    <div className="size-20 rounded-full bg-secondary flex items-center justify-center mb-6">
                                        <AlertCircle className="size-10 text-muted-foreground/30" />
                                    </div>
                                    <h3 className="text-xl font-bold text-primary mb-2">No suggestions yet</h3>
                                    <p className="text-sm text-muted-foreground mb-8">Be the first to suggest an improvement for this question!</p>
                                    <button 
                                        onClick={() => setActiveTab('new')}
                                        className="flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground rounded-xl font-bold transition-all active:scale-95 shadow-lg"
                                    >
                                        <Plus className="size-4" />
                                        Create Suggestion
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {suggestions.map((s) => (
                                        <div key={s.id} className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:border-primary/30 transition-all group">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="size-10 rounded-full bg-secondary flex items-center justify-center text-primary font-bold">
                                                        {s.username[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-primary">{s.username}</p>
                                                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                                                            {new Date(s.created_at).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest ${
                                                        s.status === 'approved' ? 'bg-success/10 text-success' : 
                                                        s.status === 'rejected' ? 'bg-destructive/10 text-destructive' : 
                                                        'bg-amber-500/10 text-amber-500'
                                                    }`}>
                                                        {s.status}
                                                    </span>
                                                    <button 
                                                        onClick={() => handleUpvote(s.id)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-primary"
                                                    >
                                                        <ThumbsUp className={`size-3.5 ${s.upvotes > 0 ? 'fill-current' : ''}`} />
                                                        <span className="text-xs font-bold">{s.upvotes}</span>
                                                    </button>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className="px-2 py-0.5 rounded-md bg-secondary text-primary text-[10px] font-bold uppercase tracking-wider">
                                                    {s.type.replace('_', ' ')}
                                                </span>
                                            </div>

                                            {s.note && (
                                                <p className="text-sm text-muted-foreground bg-secondary/30 p-4 rounded-xl border border-border/50">
                                                    {s.note}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex-1 p-8 space-y-8">
                            {/* Correction Type Selector */}
                            <div className="space-y-4">
                                <label className="text-sm font-bold text-primary uppercase tracking-widest opacity-60">What needs correction?</label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    {[
                                        { id: 'question_text', label: 'Question Text', icon: Type },
                                        { id: 'correct_answer', label: 'Correct Answer', icon: CheckSquare },
                                        { id: 'option_text', label: 'Option Text', icon: ListTodo },
                                    ].map((type) => (
                                        <button
                                            key={type.id}
                                            onClick={() => setCorrectionType(type.id as any)}
                                            className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${correctionType === type.id ? 'border-primary bg-secondary/50 shadow-sm' : 'border-border bg-card hover:bg-secondary/20'}`}
                                        >
                                            <div className={`size-8 rounded-lg flex items-center justify-center ${correctionType === type.id ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}>
                                                <type.icon className="size-4" />
                                            </div>
                                            <span className={`text-xs font-bold ${correctionType === type.id ? 'text-primary' : 'text-muted-foreground'}`}>{type.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Dynamic Form Content */}
                            <div className="animate-fade-in">
                                {correctionType === 'question_text' && (
                                    <div className="space-y-4">
                                        <label className="text-sm font-bold text-primary uppercase tracking-widest opacity-60">Proposed Question Text</label>
                                        <textarea 
                                            value={questionText}
                                            onChange={(e) => setQuestionText(e.target.value)}
                                            className="w-full bg-secondary/30 border border-border rounded-2xl p-6 text-sm text-primary focus:ring-4 focus:ring-primary/5 transition-all min-h-[150px] shadow-inner"
                                            placeholder="Enter corrected question text..."
                                        />
                                    </div>
                                )}

                                {correctionType === 'correct_answer' && (
                                    <div className="space-y-4">
                                        <label className="text-sm font-bold text-primary uppercase tracking-widest opacity-60">Select the correct option:</label>
                                        <div className="space-y-3">
                                            {options.map((ans) => (
                                                <button
                                                    key={ans.id}
                                                    onClick={() => setCorrectAnswerId(ans.id)}
                                                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${correctAnswerId === ans.id ? 'border-success bg-success/5 shadow-sm' : 'border-border hover:bg-secondary/20'}`}
                                                >
                                                    <div className={`size-6 rounded-full border-2 flex items-center justify-center shrink-0 ${correctAnswerId === ans.id ? 'border-success bg-success text-white' : 'border-border'}`}>
                                                        {correctAnswerId === ans.id && <Check className="size-3.5 stroke-[3]" />}
                                                    </div>
                                                    <span className={`text-sm font-medium ${correctAnswerId === ans.id ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                                                        {ans.answer_text}
                                                    </span>
                                                    {ans.is_correct && (
                                                        <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-success bg-success/10 px-2 py-0.5 rounded-full border border-success/20">Current</span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {correctionType === 'option_text' && (
                                    <div className="space-y-4">
                                        <label className="text-sm font-bold text-primary uppercase tracking-widest opacity-60">Edit Options Text</label>
                                        <div className="space-y-4">
                                            {options.map((ans, idx) => (
                                                <div key={ans.id} className="space-y-2">
                                                    <div className="flex items-center justify-between px-2">
                                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Option {String.fromCharCode(65 + idx)}</span>
                                                        {ans.is_correct && <span className="text-[9px] font-bold text-success uppercase tracking-widest">Correct Answer</span>}
                                                    </div>
                                                    <input 
                                                        value={ans.answer_text}
                                                        onChange={(e) => {
                                                            const newOptions = [...options]
                                                            newOptions[idx] = { ...newOptions[idx], answer_text: e.target.value }
                                                            setOptions(newOptions)
                                                        }}
                                                        className="w-full bg-secondary/30 border border-border rounded-xl p-4 text-sm text-primary focus:ring-4 focus:ring-primary/5 transition-all shadow-inner"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Common Note Field */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-bold text-primary uppercase tracking-widest opacity-60">Note (optional)</label>
                                    <span className="text-[10px] font-bold text-muted-foreground">{note.length}/500</span>
                                </div>
                                <textarea 
                                    value={note}
                                    onChange={(e) => setNote(e.target.value.slice(0, 500))}
                                    className="w-full bg-secondary/30 border border-border rounded-2xl p-6 text-sm text-primary focus:ring-4 focus:ring-primary/5 transition-all min-h-[120px] shadow-inner"
                                    placeholder="Explain why this correction is needed..."
                                />
                            </div>

                            {/* Submit Button */}
                            <button 
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="w-full py-2 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold text-lg flex items-center justify-center gap-3 shadow-xl hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-50"
                            >
                                {submitting ? <RotateCw className="size-6 animate-spin" /> : <Send className="size-5" />}
                                Submit Correction Suggestion
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
