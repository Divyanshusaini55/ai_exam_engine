"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { QuestionNavigator } from "./question-navigator"
import { MobileQuestionNavigator } from "./mobile-question-navigator"
import { ModeToggle } from "./mode-toggle"
import { examApi, communityApi, getSessionId } from "@/lib/api"
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { useAuth } from "@/context/auth-context"
import { Button } from "@/components/ui/button"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import { 
    Play, 
    Pause, 
    RotateCcw, 
    CheckCircle2, 
    MoreVertical, 
    Sparkles, 
    Lock, 
    MessageCircle, 
    Edit3, 
    ArrowLeft, 
    ArrowRight,
    RefreshCw,
    Navigation,
    Timer,
    BarChart3,
    Heart,
    Pencil,
    Trash2,
    Download
} from "lucide-react"

import { SuggestCorrectionModal } from "./suggest-correction-modal"
import { SummaryModal } from "./summary-modal"

interface ExamTakingInterfaceProps {
    examId: string
    onSubmit?: () => void
}

export function ExamTakingInterface({ examId, onSubmit }: ExamTakingInterfaceProps) {
    const { user } = useAuth()
    const [exam, setExam] = useState<any>(null)
    const [questions, setQuestions] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
    const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({})
    const [timerKey, setTimerKey] = useState(0) // Used to force reset TimerDisplay
    const [isPaused, setIsPaused] = useState(false)
    const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false)
    const searchParams = useSearchParams()
    
    // Initial states can be derived from searchParams
    const initialMode = searchParams?.get('mode') === 'learning' ? 'learning' : 'exam'
    const initialDiscussion = searchParams?.get('discussion') === 'true'

    const [mode, setMode] = useState<'exam' | 'learning'>(initialMode)
    const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false)

    // 1. Fetch Data on Load
    useEffect(() => {
        async function loadExam() {
            try {
                // Fetch Exam Details, Questions, and Progress in parallel
                const [examRes, qRes, progressRes] = await Promise.all([
                    examApi.get(examId),
                    examApi.getQuestions(examId),
                    examApi.getProgress(examId)
                ])

                setExam(examRes.data)
                setQuestions(qRes.data)
                
                // Jump to question if 'q' param is present
                const qParam = searchParams?.get('q')
                if (qParam && qRes.data) {
                    const targetIndex = qRes.data.findIndex((q: any) => q.id.toString() === qParam)
                    if (targetIndex !== -1) {
                        setCurrentQuestionIndex(targetIndex)
                    }
                }
                
                setSelectedAnswers(progressRes.data || {})
                setLoading(false)
            } catch (e) {
                console.error("Failed to load exam", e)
            }
        }
        loadExam()
    }, [examId])

    const handleResetTimer = () => {
        if (exam) {
            setTimerKey(k => k + 1)
            setIsPaused(false)
        }
    }

    // 3. Handle Selection
    const handleAnswer = async (qId: number, aId: number) => {
        const isCurrentlySelected = selectedAnswers[qId] === aId
        const targetAId = isCurrentlySelected ? null : aId

        setSelectedAnswers(prev => {
            const next = { ...prev }
            if (isCurrentlySelected) {
                delete next[qId]
            } else {
                next[qId] = aId
            }
            return next
        })

        // Background submission (sending null clears it in DB)
        await examApi.submitAnswer(examId, qId, targetAId as any)
    }

    // 4. Explain Logic
    const [explanation, setExplanation] = useState<string | null>(null)
    const [explaining, setExplaining] = useState(false)
    const [visitedQuestions, setVisitedQuestions] = useState<Set<number>>(new Set([1])) // Track visited question IDs (or numbers, using numbers here to match 1-based index)

    // Track Visited
    useEffect(() => {
        if (questions.length > 0) {
            setVisitedQuestions(prev => {
                const newSet = new Set(prev)
                newSet.add(currentQuestionIndex + 1) // Store as 1-based index
                return newSet
            })
        }
    }, [currentQuestionIndex, questions])

    // Reset explanation when changing question
    useEffect(() => {
        setExplanation(null)
    }, [currentQuestionIndex])

    const handleExplain = async () => {
        if (!currentQ) return

        // 🔒 Auth Check for AI
        if (!user) {
            alert("Please login to use AI features.")
            return
        }

        setExplaining(true)
        try {
            const res = await examApi.explainQuestion(currentQ.id)
            setExplanation(res.data.explanation)
        } catch (error) {
            console.error("Explain failed:", error)
            alert("Failed to generate explanation. Please try again.")
        } finally {
            setExplaining(false)
        }
    }

    const handleSubmit = async () => {
        setLoading(true)
        try {
            const sessionId = getSessionId()
            console.log("📝 Submitting Exam...", { examId, sessionId })

            const res = await examApi.submitExam(examId, sessionId)
            console.log("✅ Exam Submitted:", res.data)

            if (onSubmit) {
                onSubmit()
            }
        } catch (error) {
            console.error("❌ Submission Failed:", error)
            alert("Failed to submit exam. Please check your connection and try again.")
            setLoading(false)
        }
    }

    const [isDiscussionOpen, setIsDiscussionOpen] = useState(initialDiscussion)
    const [comments, setComments] = useState<any[]>([])
    const [commentLoading, setCommentLoading] = useState(false)
    const [newComment, setNewComment] = useState("")
    const [postingComment, setPostingComment] = useState(false)

    const [replyingTo, setReplyingTo] = useState<any | null>(null)
    const [editingComment, setEditingComment] = useState<any | null>(null)
    
    const currentQ = questions.length > 0 ? questions[currentQuestionIndex] : null

    // Fetch Comments
    const fetchComments = async (qId: number) => {
        setCommentLoading(true)
        try {
            const res = await communityApi.getComments(qId)
            // Group comments by parent for threading
            const allComments = res.data.results || res.data || []
            setComments(allComments)
        } catch (error) {
            console.error("Failed to fetch comments:", error)
        } finally {
            setCommentLoading(false)
        }
    }

    // Effect to fetch comments when discussion opens or question changes
    useEffect(() => {
        if (isDiscussionOpen && currentQ) {
            fetchComments(currentQ.id)
        }
    }, [isDiscussionOpen, currentQuestionIndex, currentQ])

    const handlePostComment = async () => {
        if (!newComment.trim() || !currentQ || !user) return
        setPostingComment(true)
        try {
            if (editingComment) {
                await communityApi.updateComment(editingComment.id, newComment)
                setEditingComment(null)
            } else {
                await communityApi.postComment({
                    question: currentQ.id,
                    text: newComment,
                    parent: replyingTo?.id
                })
            }
            setNewComment("")
            setReplyingTo(null)
            fetchComments(currentQ.id)
        } catch (error) {
            console.error("Failed to post/update comment:", error)
            alert("Failed to save comment. Please try again.")
        } finally {
            setPostingComment(false)
        }
    }

    const handleDeleteComment = async (commentId: number) => {
        if (!window.confirm("Are you sure you want to delete this comment?")) return
        try {
            await communityApi.deleteComment(commentId)
            fetchComments(currentQ?.id)
        } catch (error) {
            console.error("Delete failed:", error)
            alert("Failed to delete comment.")
        }
    }

    const handleUpvote = async (commentId: number) => {
        try {
            const res = await communityApi.upvoteComment(commentId)
            setComments(prev => prev.map(c => c.id === commentId ? { ...c, upvotes: res.data.upvotes } : c))
        } catch (error) {
            console.error("Upvote failed:", error)
        }
    }

    if (loading) return <div className="h-screen flex items-center justify-center font-bold text-xl text-muted-foreground">Loading Exam Environment...</div>
    if (questions.length === 0) return <div className="h-screen flex items-center justify-center font-bold text-xl text-muted-foreground">No questions found for this exam.</div>

    // Calculate Progress
    const progressPercentage = ((Object.keys(selectedAnswers).length) / questions.length) * 100

    // 🔥 CALCULATE ANSWERED QUESTIONS (For Green Navigator)
    const answeredQuestionNumbers = questions
        .map((q, index) => (selectedAnswers[q.id] ? index + 1 : null))
        .filter((num): num is number => num !== null)

    // Helper to render nested comments
    const renderComments = (parentId: number | null = null, depth = 0) => {
        const filtered = comments.filter(c => c.parent === parentId)
        if (filtered.length === 0 && depth > 0) return null

        return (
            <div className={`space-y-10 ${depth > 0 ? 'ml-12 mt-8 border-l border-border/30 pl-8' : ''}`}>
                {filtered.map((comment, i) => (
                    <div key={comment.id} className="flex gap-6 group animate-fade-in relative">
                        {/* Thread Line Extension for nested */}
                        {depth > 0 && (
                            <div className="absolute -left-[33px] top-6 w-8 border-b border-border/30" />
                        )}

                        <div className="size-12 rounded-2xl bg-secondary flex items-center justify-center text-primary font-bold text-lg border border-border shadow-sm shrink-0 overflow-hidden">
                            {comment.avatar ? <img src={comment.avatar} alt={comment.username} /> : comment.username[0].toUpperCase()}
                        </div>
                        <div className="flex flex-col gap-2 flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <span className="text-base font-bold text-primary">{comment.username}</span>
                                    <span className="text-[11px] text-muted-foreground font-medium opacity-60">
                                        {new Date(comment.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {user?.id === comment.user && (
                                        <div className="flex items-center gap-1 mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => {
                                                    setEditingComment(comment)
                                                    setNewComment(comment.text)
                                                    setReplyingTo(null)
                                                    document.getElementById('comment-input')?.focus()
                                                }}
                                                className="p-1.5 hover:bg-secondary rounded-lg text-muted-foreground hover:text-primary transition-colors"
                                                title="Edit Comment"
                                            >
                                                <Pencil className="size-3.5" />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteComment(comment.id)}
                                                className="p-1.5 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition-colors"
                                                title="Delete Comment"
                                            >
                                                <Trash2 className="size-3.5" />
                                            </button>
                                        </div>
                                    )}
                                    <button 
                                        onClick={() => handleUpvote(comment.id)}
                                        className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-secondary transition-colors text-muted-foreground group-hover:text-primary"
                                    >
                                        <Heart className={`size-4 ${comment.upvotes > 0 ? 'fill-red-500 text-red-500' : ''}`} />
                                        <span className="text-xs font-bold">{comment.upvotes}</span>
                                    </button>
                                </div>
                            </div>
                            <div className="text-[15px] text-muted-foreground leading-relaxed prose dark:prose-invert max-w-none">
                                <ReactMarkdown
                                    remarkPlugins={[remarkMath]}
                                    rehypePlugins={[rehypeKatex]}
                                >
                                    {comment.text}
                                </ReactMarkdown>
                            </div>
                            
                            <div className="flex items-center gap-4 mt-2">
                                <button 
                                    onClick={() => {
                                        setReplyingTo(comment)
                                        setEditingComment(null)
                                        setNewComment("")
                                        document.getElementById('comment-input')?.focus()
                                    }}
                                    className="text-[11px] font-bold text-primary hover:underline"
                                >
                                    Reply
                                </button>
                            </div>

                            {/* Recursive Replies */}
                            {renderComments(comment.id, depth + 1)}
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    return (
        <div className="flex flex-col min-h-screen bg-background ">
            {/* Sticky Header Group */}
            <div className="sticky top-0 z-50 flex flex-col w-full">
                <header className="bg-card border-b border-border shadow-sm h-14 md:h-16 px-2 md:px-8 flex items-center justify-between transition-colors duration-300 gap-1 md:gap-4 shrink-0">

                {/* Left: Exam Info & Progress */}
                <div className="flex items-center gap-4 md:gap-8">
                    {/* Exam Info */}
                    <div className="hidden lg:flex flex-col max-w-[250px] xl:max-w-[350px]">
                        <h1 className="font-bold text-sm text-primary truncate" title={exam?.title}>
                            {exam?.title || 'Loading Exam...'}
                        </h1>
                        <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground truncate mt-0.5">
                            {exam?.subcategory_name || exam?.category_name || 'Exam Category'}
                        </p>
                    </div>

                    {/* Desktop Progress */}
                    <div className="hidden md:flex flex-col w-32 md:w-48 gap-1">
                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            <span>Progress</span>
                            <span>{Math.round(progressPercentage)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-secondary dark:bg-secondary rounded-full overflow-hidden">
                            <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progressPercentage}%` }} />
                        </div>
                    </div>

                    {/* Mobile Progress */}
                    <div className="md:hidden flex items-center justify-center relative size-9 shrink-0">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                            <path
                                className="stroke-slate-200 dark:stroke-slate-700"
                                strokeWidth="3"
                                fill="none"
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                            <path
                                className="stroke-primary transition-all duration-500"
                                strokeDasharray={`${progressPercentage}, 100`}
                                strokeWidth="3"
                                strokeLinecap="round"
                                fill="none"
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                        </svg>
                        <span className="absolute text-[9px] font-bold text-primary">
                            {Math.round(progressPercentage)}%
                        </span>
                    </div>
                </div>

                {/* Center: Timer */}
                <div className="flex items-center gap-2 md:gap-4 px-2 md:px-4 py-1 md:py-1.5 bg-card border border-border rounded-full shadow-sm shrink-0">
                    <TimerDisplay 
                        key={timerKey} 
                        initialSeconds={exam ? exam.duration_minutes * 60 : 0} 
                        isPaused={isPaused} 
                        onTimeUp={handleSubmit} 
                    />
                    <div className="flex items-center gap-1 md:gap-2">
                        <button 
                            onClick={() => setIsPaused(!isPaused)}
                            className="flex items-center justify-center size-7 md:size-8 rounded-full bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white transition-colors"
                        >
                            {isPaused ? <Play className="size-4 md:size-5 fill-white" /> : <Pause className="size-4 md:size-5 fill-white" />}
                        </button>
                        <button 
                            onClick={handleResetTimer}
                            className="flex items-center justify-center size-7 md:size-8 rounded-full bg-destructive hover:bg-destructive/90 text-white transition-colors"
                        >
                            <RotateCcw className="size-4 md:size-5" />
                        </button>
                    </div>
                </div>

                {/* Right: Submit & Options */}
                <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
                    <Button
                        onClick={handleSubmit}
                        className="rounded-[14px] gap-1.5 md:gap-2 px-3 md:px-6 h-8 md:h-10 text-xs md:text-sm shrink-0"
                    >
                        <span className="hidden md:inline">Submit Exam</span>
                        <span className="md:hidden">Submit</span>
                        <CheckCircle2 className="size-4 md:size-[18px]" />
                    </Button>

                    <ModeToggle className="size-8 md:size-10 rounded-[14px]" />

                    <Sheet>
                        <SheetTrigger asChild>
                            <button className="md:hidden flex items-center gap-1 px-1 py-1 rounded-[12px] bg-secondary hover:bg-secondary/80 text-primary transition-colors shrink-0 border border-border">
                                <MoreVertical className="size-4" />
                            </button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="rounded-t-2xl px-4 py-6 flex flex-col gap-4 border-border bg-card">
                            <SheetHeader className="text-left border-b border-border pb-3 mb-2">
                                <SheetTitle className="text-lg font-bold text-primary">Options</SheetTitle>
                            </SheetHeader>
                            
                            {/* Mode Toggle */}
                            <div className="flex bg-secondary p-1 rounded-[14px]">
                                <button 
                                    onClick={() => setMode('exam')}
                                    className={`flex-1 py-2 text-[13px] font-bold rounded-[12px] transition-all ${mode === 'exam' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`}
                                >
                                    Exam Mode
                                </button>
                                <button 
                                    onClick={() => setMode('learning')}
                                    className={`flex-1 py-2 text-[13px] font-bold rounded-[12px] transition-all ${mode === 'learning' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`}
                                >
                                    Learning Mode
                                </button>
                            </div>

                            {/* Summary Button */}
                            <button 
                                onClick={() => setIsSummaryModalOpen(true)}
                                className="w-full mt-2 py-3 bg-primary text-primary-foreground rounded-[14px] text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-95 shadow-sm"
                            >
                                <Sparkles className="size-4.5" />
                                View Question Paper Summary
                            </button>
                            
                            {/* Download Button */}
                            <button 
                                onClick={() => {
                                    if (!user) {
                                        alert("Please login to download the question paper PDF.")
                                        return
                                    }
                                    if (exam?.pdf_file) {
                                        window.open(exam.pdf_file, '_blank')
                                    } else {
                                        alert("PDF not available for this exam.")
                                    }
                                }}
                                className="w-full py-3 bg-card text-primary border border-border rounded-[14px] text-sm font-bold flex items-center justify-center gap-2 hover:bg-secondary transition-all active:scale-95 shadow-sm"
                            >
                                {user ? <Download className="size-4.5" /> : <Lock className="size-4.5" />}
                                Download PDF
                            </button>
                        </SheetContent>
                    </Sheet>
                </div>
                </header>

                {/* Mobile Horizontal Navigator */}
                <MobileQuestionNavigator
                    currentQuestion={currentQuestionIndex + 1}
                    totalQuestions={questions.length}
                    onNavigate={(qNum) => setCurrentQuestionIndex(qNum - 1)}
                    answeredQuestions={answeredQuestionNumbers}
                    visitedQuestions={Array.from(visitedQuestions)}
                />
            </div>

            <div className="flex-1 max-w-7xl mx-auto w-full p-4 pb-24 md:p-8 flex gap-8 items-start">

                {/* Navigator Sidebar */}
                <QuestionNavigator
                    currentQuestion={currentQuestionIndex + 1}
                    totalQuestions={questions.length}
                    onNavigate={(qNum) => setCurrentQuestionIndex(qNum - 1)}
                    answeredQuestions={answeredQuestionNumbers}
                    visitedQuestions={Array.from(visitedQuestions)}
                    mode={mode}
                    onModeChange={setMode}
                    pdfUrl={exam?.pdf_file}
                    isLoggedIn={!!user}
                    onViewSummary={() => setIsSummaryModalOpen(true)}
                />

                {/* Main Question Card */}
                <main className="flex-1 min-w-0">
                    <div className="bg-card rounded-2xl border border-border shadow-sm p-4 pt-6 md:p-10 relative overflow-hidden">

                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Question {currentQuestionIndex + 1}</span>
                                    {/* 🔥 SUBJECT BADGE */}
                                    {currentQ.subject && (
                                        <span className="px-2 py-0.5 rounded-md bg-secondary text-primary text-[10px] font-bold uppercase tracking-wider border border-border">
                                            {currentQ.subject}
                                        </span>
                                    )}
                                    {currentQ.topic && (
                                        <span className="hidden md:inline-block text-[10px] text-muted-foreground font-medium">
                                            • {currentQ.topic}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center justify-between md:justify-end gap-3">
                                <button
                                    onClick={handleExplain}
                                    disabled={explaining || mode === 'exam'}
                                    className={`flex items-center gap-1.5 px-3 py-1 rounded-[12px] text-[10px] font-bold transition-colors disabled:opacity-50 ${mode === 'exam' ? 'bg-secondary/50 text-muted-foreground cursor-not-allowed' : 'bg-secondary text-primary hover:bg-secondary/80'}`}
                                    title={mode === 'exam' ? "AI Explain is disabled in Exam Mode" : ""}
                                >
                                    {explaining ? (
                                        <>
                                            <RefreshCw className="size-3 animate-spin" />
                                            Thinking...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="size-3" />
                                            {user ? "AI Explain" : "Login to Explain"}
                                        </>
                                    )}
                                </button>
                                <span className="text-xs font-bold bg-secondary text-muted-foreground px-3 py-1 rounded-full">{currentQ.points} Point(s)</span>
                            </div>
                        </div>

                        <h2 className="text-lg md:text-xl font-medium text-primary mb-6 leading-relaxed">
                            {currentQ.question_text}
                        </h2>

                        {/* Image Support */}
                        {currentQ.image && (
                            <img src={currentQ.image} alt="Question" className="max-w-full h-auto rounded-lg mb-8 border border-border" />
                        )}

                        <div className="flex flex-col gap-2 md:gap-3">
                            {currentQ.answers.map((ans: any) => {
                                const isSelected = selectedAnswers[currentQ.id] === ans.id
                                return (
                                    <label 
                                        key={ans.id} 
                                        onClick={(e) => {
                                            e.preventDefault()
                                            handleAnswer(currentQ.id, ans.id)
                                        }}
                                        className={`group relative flex items-center p-2.5 md:p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 active:scale-[0.98] ${isSelected ? 'border-primary bg-secondary' : 'border-border hover:border-primary/30 hover:bg-background'}`}
                                    >
                                        <input 
                                            type="radio" 
                                            name={`q-${currentQ.id}`} 
                                            checked={isSelected}
                                            readOnly
                                            className="sr-only" 
                                        />
                                        <div className={`size-7 md:size-8 text-sm md:text-base rounded-lg flex shrink-0 items-center justify-center font-bold mr-3 md:mr-3 transition-colors ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground group-hover:bg-secondary'}`}>
                                            {String.fromCharCode(65 + ans.order)}
                                        </div>
                                        <span className={`text-sm md:text-base transition-colors ${isSelected ? 'text-primary font-bold' : 'text-primary'}`}>
                                            {ans.answer_text}
                                        </span>
                                    </label>
                                )
                            })}
                        </div>

                        {/* AI Explanation Box */}
                        {explanation && (
                            <div className="mt-8 p-6 bg-secondary rounded-xl border border-border animate-fade-in">
                                <div className="flex items-center gap-2 mb-3 text-primary font-bold text-sm">
                                    <Sparkles className="size-4.5" />
                                    AI Explanation
                                </div>
                                <div className="text-primary leading-relaxed text-sm prose dark:prose-invert max-w-none">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkMath]}
                                        rehypePlugins={[rehypeKatex]}
                                    >
                                        {explanation}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        )}

                        <div className="mt-8 flex flex-wrap gap-3 items-center border-t border-border pt-6">
                            <button 
                                onClick={() => setIsDiscussionOpen(true)}
                                className={`flex items-center gap-2 px-4 py-2 border rounded-[14px] text-[13px] font-bold transition-all active:scale-95 shadow-sm ${currentQ.comment_count > 0 ? 'border-green-500/50 text-green-600 bg-green-50 dark:bg-green-900/10' : 'border-border text-primary hover:bg-secondary'}`}
                            >
                                <MessageCircle className={`size-4.5 ${currentQ.comment_count > 0 ? 'text-green-500' : ''}`} />
                                Discussions {currentQ.comment_count > 0 ? `(${currentQ.comment_count})` : ''}
                            </button>
                            <button 
                                onClick={() => setIsCorrectionModalOpen(true)}
                                className="flex items-center gap-2 px-4 py-2 border border-border rounded-[14px] text-[13px] font-bold text-primary hover:bg-secondary transition-all active:scale-95 shadow-sm"
                            >
                                <Edit3 className="size-4.5" />
                                Suggest Correction
                            </button>
                        </div>

                        {/* Suggest Correction Modal */}
                        <SuggestCorrectionModal 
                            isOpen={isCorrectionModalOpen}
                            onClose={() => setIsCorrectionModalOpen(false)}
                            question={currentQ}
                        />

                        {/* Summary Modal */}
                        <SummaryModal 
                            isOpen={isSummaryModalOpen}
                            onClose={() => setIsSummaryModalOpen(false)}
                            examTitle={exam?.title || "Exam Summary"}
                            summaryText={exam?.ai_summary || ""}
                        />

                        {/* PREMIUM DISCUSSION MODAL (Matches Reference UI) */}
                        {isDiscussionOpen && (
                            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-10">
                                {/* Backdrop */}
                                <div 
                                    className="absolute inset-0 bg-black/40 backdrop-blur-md animate-fade-in" 
                                    onClick={() => setIsDiscussionOpen(false)}
                                />
                                
                                {/* Modal Content */}
                                <div className="relative bg-white dark:bg-[#1A1A1A] w-full max-w-6xl h-[85vh] rounded-[32px] shadow-2xl flex flex-col overflow-hidden animate-scale-in border border-white/10">
                                    
                                    {/* Header */}
                                    <div className="flex items-center justify-between px-8 py-6 border-b border-border/50 bg-card/30 shrink-0">
                                        <div className="flex items-center gap-4">
                                            <h2 className="text-xl font-bold text-primary tracking-tight">
                                                Discussions - <span className="opacity-60">{currentQ.id}</span>
                                            </h2>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button className="flex items-center gap-2 px-4 py-2 bg-black dark:bg-white dark:text-black text-white rounded-full text-xs font-bold hover:opacity-90 transition-all active:scale-95">
                                                <Navigation className="size-3.5 rotate-45" />
                                                Share
                                            </button>
                                            <button 
                                                onClick={() => setIsDiscussionOpen(false)}
                                                className="size-10 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground transition-colors"
                                            >
                                                <RefreshCw className="size-5 rotate-45" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Comments List Area */}
                                    <div className="flex-1 overflow-y-auto p-12 scrollbar-hide">
                                        {commentLoading ? (
                                            <div className="h-full flex flex-col items-center justify-center gap-4 text-muted-foreground/40">
                                                <RefreshCw className="size-12 animate-spin" />
                                                <p className="font-medium">Fetching insights...</p>
                                            </div>
                                        ) : comments.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center text-center">
                                                <p className="text-xl font-medium text-muted-foreground/60">No Discussion yet. Be the first to post!</p>
                                            </div>
                                        ) : (
                                            <div className="max-w-4xl mx-auto">
                                                {renderComments(null)}
                                            </div>
                                        )}
                                    </div>

                                    {/* Bottom Input Section */}
                                    <div className="px-12 py-10 border-t border-border/50 bg-secondary/5 shrink-0">
                                        <div className="max-w-5xl">
                                            <div className="flex items-center justify-between mb-1">
                                                <h3 className="text-lg font-bold text-primary">
                                                    {editingComment ? "Editing your comment" : replyingTo ? `Replying to ${replyingTo.username}` : "Add a Comment"}
                                                </h3>
                                                {(replyingTo || editingComment) && (
                                                    <button 
                                                        onClick={() => {
                                                            setReplyingTo(null)
                                                            setEditingComment(null)
                                                            setNewComment("")
                                                        }}
                                                        className="text-[10px] font-bold text-destructive hover:underline"
                                                    >
                                                        Cancel {editingComment ? "Edit" : "Reply"}
                                                    </button>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground font-medium mb-6 opacity-60">
                                                All markdown syntax are supported including maths equations. Use 'Copy' button when copying from GPT to maintain the formatting.
                                            </p>
                                            
                                            {user ? (
                                                <div className="flex flex-col gap-5">
                                                    <textarea 
                                                        id="comment-input"
                                                        value={newComment}
                                                        onChange={(e) => setNewComment(e.target.value)}
                                                        placeholder={replyingTo ? `Write your reply...` : "Share your doubts or points regarding the question...📝"}
                                                        className="w-full bg-card border border-border rounded-2xl p-6 text-sm text-primary placeholder:text-muted-foreground/40 focus:ring-4 focus:ring-primary/5 transition-all resize-none h-32 shadow-inner"
                                                    />
                                                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                                                        <p className="text-[10px] text-muted-foreground font-medium max-w-[350px]">
                                                            By posting content to this discussion panel, you agree to the <span className="underline cursor-pointer">Posting Policy and Terms of Use</span>
                                                        </p>
                                                        <button 
                                                            onClick={handlePostComment}
                                                            disabled={postingComment || !newComment.trim()}
                                                            className="flex items-center gap-2.5 px-10 py-3 bg-[#7CB342] text-white rounded-full text-sm font-bold shadow-lg hover:brightness-105 transition-all active:scale-95 disabled:opacity-50"
                                                        >
                                                            {postingComment ? (
                                                                <RefreshCw className="size-4 animate-spin" />
                                                            ) : (
                                                                <MessageCircle className="size-4.5 fill-current" />
                                                            )}
                                                            {replyingTo ? "Post Reply" : "Submit New Comment"}
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="py-12 bg-card rounded-2xl border border-dashed border-border text-center">
                                                    <Lock className="size-8 mx-auto mb-3 text-muted-foreground/30" />
                                                    <p className="text-base font-bold text-primary">Login to share your thoughts</p>
                                                    <button className="mt-4 text-sm font-bold text-primary underline underline-offset-4">Sign in now</button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Navigation Footer */}
                        <div className="fixed bottom-0 left-0 right-0 p-4 bg-card border-t border-border md:static md:bg-transparent md:border-t md:border-border md:p-0 md:mt-10 md:pt-6 z-40">
                            <div className="max-w-7xl mx-auto flex justify-between gap-4">
                                <button
                                    onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                                    disabled={currentQuestionIndex === 0}
                                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 md:py-2 rounded-[14px] border border-border text-[13px] font-bold text-muted-foreground hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                                >
                                    <ArrowLeft className="size-4.5" />
                                    <span className="hidden md:inline">Previous</span>
                                </button>
                                <button
                                    onClick={() => {
                                        if (currentQuestionIndex === questions.length - 1) handleSubmit()
                                        else setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))
                                    }}
                                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 md:py-2 bg-primary text-primary-foreground text-[13px] rounded-[14px] font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg shadow-primary/10"
                                >
                                    <span className="hidden md:inline">Next Question</span>
                                    <span className="md:hidden">Next</span>
                                    <ArrowRight className="size-4.5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}

// ----- Subcomponents -----

function TimerDisplay({ initialSeconds, isPaused, onTimeUp }: { initialSeconds: number, isPaused: boolean, onTimeUp: () => void }) {
    const [timeLeft, setTimeLeft] = useState(initialSeconds)

    useEffect(() => {
        setTimeLeft(initialSeconds)
    }, [initialSeconds])

    useEffect(() => {
        if (!isPaused && timeLeft > 0) {
            const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000)
            return () => clearInterval(timer)
        } else if (timeLeft === 0 && initialSeconds > 0) {
            onTimeUp()
        }
    }, [timeLeft, isPaused, onTimeUp, initialSeconds])

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600)
        const m = Math.floor((seconds % 3600) / 60)
        const s = seconds % 60
        if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }

    return (
        <span className="font-mono font-bold text-[15px] md:text-xl tabular-nums tracking-widest text-primary ml-1">
            {formatTime(timeLeft)}
        </span>
    )
}
