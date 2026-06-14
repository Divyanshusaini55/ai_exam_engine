"use client"

import { useState, useEffect } from "react"
import { Navbar } from "@/components/navbar"
import { 
    Upload, 
    ChevronDown, 
    Calendar as CalendarIcon, 
    FileText, 
    CheckCircle2, 
    AlertCircle, 
    X,
    Search,
    Cloud
} from "lucide-react"
import { examApi } from "@/lib/api"
import { cn } from "@/lib/utils"

export default function UploadPage() {
    const [categories, setCategories] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedCategory, setSelectedCategory] = useState("")
    const [selectedSubject, setSelectedSubject] = useState("")
    const [examDate, setExamDate] = useState("")
    const [file, setFile] = useState<File | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null)

    useEffect(() => {
        async function fetchCategories() {
            try {
                const res = await examApi.getCategories()
                const data = Array.isArray(res.data) ? res.data : res.data.results || []
                setCategories(data)
            } catch (err) {
                console.error("Failed to fetch categories", err)
            } finally {
                setLoading(false)
            }
        }
        fetchCategories()
    }, [])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0])
            setStatus(null)
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = () => {
        setIsDragging(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setFile(e.dataTransfer.files[0])
            setStatus(null)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedCategory || !selectedSubject || !examDate || !file) {
            setStatus({ type: 'error', message: 'Please fill in all required fields.' })
            return
        }

        setSubmitting(true)
        setStatus(null)

        const formData = new FormData()
        formData.append('category', selectedCategory)
        formData.append('subject', selectedSubject)
        formData.append('exam_date', examDate)
        formData.append('file', file)

        try {
            await examApi.uploadPaper(formData)
            setStatus({ type: 'success', message: 'Question paper uploaded successfully! It is now under review.' })
            // Reset form
            setSelectedCategory("")
            setSelectedSubject("")
            setExamDate("")
            setFile(null)
        } catch (err: any) {
            console.error("Upload failed", err)
            setStatus({ 
                type: 'error', 
                message: err.response?.data?.error || 'Failed to upload question paper. Please try again.' 
            })
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="min-h-screen bg-background font-sans selection:bg-primary/10">
            <Navbar />
            
            <main className="max-w-[1200px] mx-auto px-4 md:px-8 py-16 animate-fade-in">
                {/* Header Section */}
                <div className="mb-12">
                    <h1 className="text-[30px] md:text-[36px] font-bold font-heading text-primary tracking-tight leading-tight mb-4">
                        Upload Question Paper
                    </h1>
                    <p className="text-[17px] text-muted-foreground font-medium max-w-2xl leading-relaxed">
                        Submit a subject-specific question paper PDF. It will be reviewed by our team before publishing.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Left: Upload Form Card */}
                    <div className="lg:col-span-8">
                        <div className="card-premium p-8 md:p-12 rounded-[32px] bg-card shadow-premium border border-border">
                            {status && (
                                <div className={cn(
                                    "mb-8 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300",
                                    status.type === 'success' ? "bg-success/10 text-success border border-success/20" : "bg-destructive/10 text-destructive border border-destructive/20"
                                )}>
                                    {status.type === 'success' ? <CheckCircle2 className="size-5" /> : <AlertCircle className="size-5" />}
                                    <p className="text-sm font-bold">{status.message}</p>
                                    <button onClick={() => setStatus(null)} className="ml-auto opacity-50 hover:opacity-100">
                                        <X className="size-4" />
                                    </button>
                                </div>
                            )}

                            <form className="space-y-8" onSubmit={handleSubmit}>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Exam Select */}
                                    <div className="space-y-2">
                                        <label className="text-[13px] font-bold text-primary uppercase tracking-widest ml-1">
                                            Category <span className="text-destructive">*</span>
                                        </label>
                                        <div className="relative group">
                                            <select 
                                                value={selectedCategory}
                                                onChange={(e) => setSelectedCategory(e.target.value)}
                                                className="w-full appearance-none bg-secondary/30 border border-border rounded-xl px-4 py-3.5 text-sm font-medium text-primary focus:ring-2 focus:ring-primary/5 outline-none cursor-pointer transition-all hover:bg-secondary/50 pr-12"
                                                required
                                            >
                                                <option value="" disabled>Select category</option>
                                                {categories.map(cat => (
                                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                ))}
                                            </select>
                                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none group-hover:text-primary transition-colors" />
                                        </div>
                                    </div>

                                    {/* Subject Select */}
                                    <div className="space-y-2">
                                        <label className="text-[13px] font-bold text-primary uppercase tracking-widest ml-1">
                                            Exam Name <span className="text-destructive">*</span>
                                        </label>
                                        <div className="relative group">
                                            <input 
                                                type="text"
                                                placeholder="e.g. SSC CGL, NTPC ..."
                                                value={selectedSubject}
                                                onChange={(e) => setSelectedSubject(e.target.value)}
                                                className="w-full bg-secondary/30 border border-border rounded-xl px-4 py-3.5 text-sm font-medium text-primary focus:ring-2 focus:ring-primary/5 outline-none transition-all hover:bg-secondary/50 pr-12"
                                                required
                                            />
                                            <Search className="absolute right-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none group-hover:text-primary transition-colors" />
                                        </div>
                                    </div>
                                </div>

                                {/* Exam Date */}
                                <div className="space-y-2">
                                    <label className="text-[13px] font-bold text-primary uppercase tracking-widest ml-1">
                                        Exam Date <span className="text-destructive">*</span>
                                    </label>
                                    <div className="relative group">
                                        <input 
                                            type="date"
                                            value={examDate}
                                            onChange={(e) => setExamDate(e.target.value)}
                                            className="w-full bg-secondary/30 border border-border rounded-xl px-4 py-3.5 pl-12 text-sm font-medium text-primary focus:ring-2 focus:ring-primary/5 outline-none transition-all hover:bg-secondary/50"
                                            required
                                        />
                                        <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                    </div>
                                    <p className="text-[11px] text-muted-foreground font-medium ml-1">When the exam was conducted</p>
                                </div>

                                {/* PDF Upload Area */}
                                <div className="space-y-2">
                                    <label className="text-[13px] font-bold text-primary uppercase tracking-widest ml-1">
                                        Question Paper PDF <span className="text-destructive">*</span>
                                    </label>
                                    <div 
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        className={cn(
                                            "relative h-56 rounded-[24px] border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center gap-4 cursor-pointer overflow-hidden",
                                            isDragging 
                                                ? "border-primary bg-primary/5 scale-[1.01]" 
                                                : "border-border bg-secondary/10 hover:bg-secondary/20 hover:border-muted-foreground"
                                        )}
                                        onClick={() => document.getElementById('file-upload')?.click()}
                                    >
                                        <input 
                                            id="file-upload"
                                            type="file"
                                            className="hidden"
                                            accept=".pdf"
                                            onChange={handleFileChange}
                                        />
                                        
                                        {file ? (
                                            <div className="flex flex-col items-center gap-2 animate-scale-in">
                                                <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm mb-2">
                                                    <FileText className="size-8" />
                                                </div>
                                                <p className="text-sm font-bold text-primary max-w-[200px] truncate">{file.name}</p>
                                                <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-widest">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                                                <button 
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                                                    className="mt-2 text-xs font-bold text-destructive hover:underline"
                                                >
                                                    Remove file
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="size-16 rounded-2xl bg-secondary/50 flex items-center justify-center text-muted-foreground border border-border group-hover:scale-110 transition-transform">
                                                    <Cloud className="size-8" />
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-sm font-bold text-primary">Drop your PDF here or click to browse</p>
                                                    <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-widest mt-1">PDF files up to 40 MB</p>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Submit Button */}
                                <div className="flex justify-center w-full pt-4">
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className={cn(
                                            "px-6 py-2.5 rounded-xl font-bold text-[15px] shadow-premium transition-all active:scale-95 flex items-center justify-center gap-2 group",
                                            submitting 
                                                ? "bg-primary/50 cursor-not-allowed text-primary-foreground/70" 
                                                : "bg-primary text-primary-foreground hover:-translate-y-1"
                                        )}
                                    >
                                        {submitting ? (
                                            <div className="size-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                                        ) : (
                                            <Upload className="size-5 transition-transform group-hover:-translate-y-1" />
                                        )}
                                        {submitting ? "Uploading..." : "Submit for Review"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* Right: Guidelines Card */}
                    <div className="lg:col-span-4 sticky top-28">
                        <div className="card-premium p-8 rounded-[24px] bg-card border border-border shadow-sm">
                            <div className="flex items-center gap-3 mb-8 pb-4 border-b border-border">
                                <AlertCircle className="size-5 text-primary" />
                                <h2 className="text-xl font-bold text-primary font-heading tracking-tight">Guidelines</h2>
                            </div>

                            <ul className="space-y-6">
                                {[
                                    { text: "Upload only exam-specific question papers", icon: CheckCircle2 },
                                    { text: "Ensure the PDF is complete and not corrupted", icon: CheckCircle2 },
                                    { text: "Select the correct category and exam to help us categorize it", icon: CheckCircle2 },
                                    { text: "PDF should follow latest format", icon: CheckCircle2 },
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-4 group">
                                        <item.icon className="size-5 text-success shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                                        <p className="text-[14px] font-medium text-muted-foreground leading-relaxed">
                                            {item.text.split(' ').map((word, j) => (
                                                <span key={j} className={cn(
                                                    ["subject-specific", "complete", "correct"].includes(word.toLowerCase().replace(/[^\w]/g, '')) ? "text-primary font-bold" : ""
                                                )}>
                                                    {word}{' '}
                                                </span>
                                            ))}
                                        </p>
                                    </li>
                                ))}
                            </ul>

                            <div className="mt-10 pt-6 border-t border-border">
                                <p className="text-[13px] text-muted-foreground font-medium italic leading-relaxed">
                                    Your submission will be reviewed. The questions will be available for practice.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
