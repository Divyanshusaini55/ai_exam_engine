"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { useParams, useRouter } from "next/navigation"
import { adminApi } from "@/lib/api"
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  X,
  HelpCircle,
  RefreshCw,
  Sparkles,
  Languages,
  BookOpen,
  Sliders,
  GraduationCap,
  History,
  Image as ImageIcon,
  Tag,
  Clock,
  Check,
  AlertCircle
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function AdminQuestionsPage() {
  const params = useParams()
  const examSlug = params.examSlug as string
  const [mounted, setMounted] = useState(false)
  const [exam, setExam] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([])
  const [translatingId, setTranslatingId] = useState<string | number | null>(null)
  const [bulkTranslating, setBulkTranslating] = useState(false)

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'content' | 'classification' | 'tutor' | 'meta'>('content')

  useEffect(() => {
    setMounted(true)
  }, [])

  const initialFormState = {
    id: "",
    question_type: "mcq_single",
    question_text: "",
    question_text_hi: "",
    image: "",
    explanation: "",
    explanation_hi: "",
    options: [
      { id: "A", answer_text: "", answer_text_hi: "", image_url: "", is_correct: true },
      { id: "B", answer_text: "", answer_text_hi: "", image_url: "", is_correct: false },
      { id: "C", answer_text: "", answer_text_hi: "", image_url: "", is_correct: false },
      { id: "D", answer_text: "", answer_text_hi: "", image_url: "", is_correct: false },
    ],
    correct_options: ["A"],
    nat_min: "",
    nat_max: "",
    nat_unit: "",
    subjective_answer: "",
    subject: "General",
    topic: "",
    subtopic: "",
    difficulty: "Medium",
    cognitive_level: "apply",
    marks: 1,
    negative_marks: 0,
    ideal_time_seconds: 60,
    hints: [""],
    solution_steps: [""],
    tags: "",
    exam_history_exam: "",
    exam_history_year: "",
    exam_history_shift: "",
    verified: true
  }

  const [formData, setFormData] = useState(initialFormState)

  async function fetchData() {
    setLoading(true)
    setError(null)
    try {
      const resExams = await adminApi.getExams()
      let currentExam = null

      if (resExams.ok) {
        const rawExams = await resExams.json()
        const examsList = Array.isArray(rawExams) ? rawExams : rawExams?.results || []
        currentExam = examsList.find((e: any) => e.slug === examSlug)
        if (currentExam) {
          setExam(currentExam)
        }
      }

      const resQ = currentExam
        ? await adminApi.getQuestions(currentExam.id)
        : await adminApi.getQuestions(undefined, examSlug)

      if (resQ.ok) {
        const rawQ = await resQ.json()
        const items = Array.isArray(rawQ) ? rawQ : rawQ?.results || []
        setQuestions(items)

        if (!currentExam && items.length > 0 && items[0].exam_title) {
          setExam({ title: items[0].exam_title, slug: examSlug })
        }
      } else {
        const errJson = await resQ.json().catch(() => ({}))
        setError(errJson?.detail || "Failed to load questions. Please check your admin session.")
      }
    } catch (err: any) {
      console.error("Failed to load questions:", err)
      setError(err?.message || "Failed to connect to backend server.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [examSlug])

  function toggleSelectAll() {
    if (selectedIds.length === questions.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(questions.map(q => q.id))
    }
  }

  function toggleSelect(id: string | number) {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id))
    } else {
      setSelectedIds([...selectedIds, id])
    }
  }

  function handleOpenCreate() {
    setEditingQuestion(null)
    setActiveTab('content')
    setFormData({
      ...initialFormState,
      marks: exam?.marks_per_question || 1,
      negative_marks: exam?.negative_marks || 0,
      exam_history_exam: exam?.title || ""
    })
    setIsModalOpen(true)
  }

  function handleOpenEdit(q: any) {
    setEditingQuestion(q)
    setActiveTab('content')
    const payload = q.schema_payload || {}

    // Extract options
    let rawOpts = q.answers || payload.options || []
    if (!Array.isArray(rawOpts) || rawOpts.length === 0) {
      rawOpts = [
        { id: "A", answer_text: "", answer_text_hi: "", image_url: "", is_correct: true },
        { id: "B", answer_text: "", answer_text_hi: "", image_url: "", is_correct: false },
        { id: "C", answer_text: "", answer_text_hi: "", image_url: "", is_correct: false },
        { id: "D", answer_text: "", answer_text_hi: "", image_url: "", is_correct: false },
      ]
    }

    const correctOpts = (payload.answer && payload.answer.correct_options) || []
    const mappedOpts = rawOpts.map((opt: any, idx: number) => {
      const optId = opt.id || opt.option_label || String.fromCharCode(65 + idx)
      const isCorrect = opt.is_correct || correctOpts.includes(optId) || (idx === 0 && correctOpts.length === 0)
      return {
        id: optId,
        answer_text: opt.answer_text || opt.text || "",
        answer_text_hi: opt.answer_text_hi || "",
        image_url: opt.image_url || "",
        is_correct: isCorrect
      }
    })

    const initialCorrectOptions = mappedOpts.filter((o: any) => o.is_correct).map((o: any) => o.id)

    // Tutor data
    const tutorData = payload.tutor_data || q.tutor_data || {}
    const hints = Array.isArray(tutorData.hints) && tutorData.hints.length > 0 ? tutorData.hints : [""]
    const steps = Array.isArray(tutorData.solution_steps) && tutorData.solution_steps.length > 0 ? tutorData.solution_steps : [""]

    // Classification
    const classification = payload.classification || q.classification || {}
    const marking = payload.marking || q.marking || {}
    const metadata = payload.metadata || q.metadata || {}
    const examHistory = (payload.exam_history && payload.exam_history[0]) || {}

    // Images
    const contentImages = (payload.content && payload.content.images) || {}
    const firstImg = Object.values(contentImages)[0] as any
    const imgUrl = q.image || (firstImg && firstImg.url) || ""

    setFormData({
      id: q.id || "",
      question_type: q.question_type || payload.question_type || "mcq_single",
      question_text: q.question_text || (payload.content && payload.content.text) || "",
      question_text_hi: q.question_text_hi || payload.question_text_hi || "",
      image: imgUrl,
      explanation: q.explanation || (typeof payload.explanation === 'object' ? payload.explanation?.text : payload.explanation) || "",
      explanation_hi: q.explanation_hi || payload.explanation_hi || "",
      options: mappedOpts,
      correct_options: initialCorrectOptions.length > 0 ? initialCorrectOptions : ["A"],
      nat_min: payload.answer?.min ?? "",
      nat_max: payload.answer?.max ?? "",
      nat_unit: payload.answer?.unit ?? "",
      subjective_answer: payload.answer?.model_answer ?? "",
      subject: q.subject || classification.subject || "General",
      topic: q.topic || classification.topic || "",
      subtopic: classification.subtopic || "",
      difficulty: classification.difficulty_label || q.difficulty || "Medium",
      cognitive_level: classification.cognitive_level || "apply",
      marks: marking.positive ?? q.marks ?? 1,
      negative_marks: marking.negative ?? 0,
      ideal_time_seconds: metadata.ideal_time_seconds ?? 60,
      hints: hints,
      solution_steps: steps,
      tags: Array.isArray(metadata.tags) ? metadata.tags.join(", ") : (metadata.tags || ""),
      exam_history_exam: examHistory.exam || exam?.title || "",
      exam_history_year: examHistory.year ? String(examHistory.year) : "",
      exam_history_shift: examHistory.shift || "",
      verified: q.verified ?? true
    })

    setIsModalOpen(true)
  }

  async function handleGenerateHindiSingle(id: string | number) {
    setTranslatingId(id)
    try {
      await adminApi.generateHindiQuestion(id)
      fetchData()
    } catch (err) {
      console.error("Generate Hindi error:", err)
    } finally {
      setTranslatingId(null)
    }
  }

  async function handleBulkGenerateHindi() {
    if (selectedIds.length === 0) return
    setBulkTranslating(true)
    try {
      await adminApi.bulkGenerateHindiQuestions(selectedIds)
      setSelectedIds([])
      fetchData()
    } catch (err) {
      console.error("Bulk generate Hindi error:", err)
    } finally {
      setBulkTranslating(false)
    }
  }

  async function handleSaveQuestion(e: React.FormEvent) {
    e.preventDefault()
    if (!exam) return

    try {
      // Build V2 Options & Answer Key
      let formattedOptions = formData.options.map((opt, idx) => {
        const optId = opt.id || String.fromCharCode(65 + idx)
        const isCorrect = formData.question_type === 'mcq_single'
          ? (formData.correct_options[0] === optId || opt.is_correct)
          : (formData.correct_options.includes(optId) || opt.is_correct)
        return {
          id: optId,
          text: opt.answer_text,
          answer_text: opt.answer_text,
          answer_text_hi: opt.answer_text_hi,
          image_url: opt.image_url || null,
          is_correct: isCorrect
        }
      })

      let answerPayload: any = {}
      if (formData.question_type === 'mcq_single') {
        const correctOpt = formattedOptions.find(o => o.is_correct) || formattedOptions[0]
        answerPayload = { correct_options: [correctOpt?.id || "A"] }
      } else if (formData.question_type === 'mcq_multi') {
        const correctIds = formattedOptions.filter(o => o.is_correct).map(o => o.id)
        answerPayload = { correct_options: correctIds.length > 0 ? correctIds : ["A"] }
      } else if (formData.question_type === 'nat') {
        answerPayload = {
          min: parseFloat(String(formData.nat_min)) || 0,
          max: parseFloat(String(formData.nat_max)) || 0,
          unit: formData.nat_unit || ""
        }
      } else if (formData.question_type === 'subjective') {
        answerPayload = {
          model_answer: formData.subjective_answer || ""
        }
      }

      // Filter empty hints & steps
      const cleanHints = formData.hints.filter(h => h.trim().length > 0)
      const cleanSteps = formData.solution_steps.filter(s => s.trim().length > 0)

      // Tags
      const tagsArray = formData.tags
        .split(",")
        .map(t => t.trim())
        .filter(t => t.length > 0)

      // Exam History
      const examHistoryArray = formData.exam_history_exam ? [{
        exam: formData.exam_history_exam,
        year: formData.exam_history_year ? parseInt(formData.exam_history_year) : null,
        shift: formData.exam_history_shift || null
      }] : []

      const payload: any = {
        exam: exam.id,
        question_type: formData.question_type,
        question_text: formData.question_text,
        question_text_hi: formData.question_text_hi,
        image: formData.image || null,
        options: formattedOptions,
        answer: answerPayload,
        explanation: formData.explanation,
        explanation_hi: formData.explanation_hi,
        tutor_data: {
          hints: cleanHints,
          solution_steps: cleanSteps
        },
        marking: {
          positive: parseFloat(String(formData.marks)) || 1.0,
          negative: parseFloat(String(formData.negative_marks)) || 0.0
        },
        classification: {
          subject: formData.subject,
          topic: formData.topic,
          subtopic: formData.subtopic,
          difficulty_label: formData.difficulty,
          cognitive_level: formData.cognitive_level
        },
        subject: formData.subject,
        topic: formData.topic,
        difficulty: formData.difficulty,
        marks: parseFloat(String(formData.marks)) || 1.0,
        negative_marks: parseFloat(String(formData.negative_marks)) || 0.0,
        metadata: {
          language: formData.question_text_hi && !formData.question_text ? "hi" : "en",
          tags: tagsArray,
          ideal_time_seconds: parseInt(String(formData.ideal_time_seconds)) || 60
        },
        exam_history: examHistoryArray,
        verified: formData.verified
      }

      if (editingQuestion) {
        await adminApi.updateQuestion(editingQuestion.id, payload)
      } else {
        await adminApi.createQuestion(payload)
      }
      setIsModalOpen(false)
      fetchData()
    } catch (err) {
      console.error("Save question error:", err)
    }
  }

  async function handleDeleteQuestion(id: string | number) {
    if (!confirm("Are you sure you want to delete this question?")) return
    try {
      await adminApi.deleteQuestion(id)
      fetchData()
    } catch (err) {
      console.error("Delete question error:", err)
    }
  }

  // Option actions
  function addOption() {
    const nextChar = String.fromCharCode(65 + formData.options.length)
    setFormData({
      ...formData,
      options: [
        ...formData.options,
        { id: nextChar, answer_text: "", answer_text_hi: "", image_url: "", is_correct: false }
      ]
    })
  }

  function removeOption(idx: number) {
    if (formData.options.length <= 2) return
    const newOpts = formData.options.filter((_, i) => i !== idx).map((opt, i) => ({
      ...opt,
      id: String.fromCharCode(65 + i)
    }))
    setFormData({ ...formData, options: newOpts })
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/exams">
            <Button variant="ghost" size="icon" className="size-8">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <span>{exam?.title || "Exam Questions"}</span>
              <span className="text-xs bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-semibold">
                {questions.length} Question{questions.length !== 1 ? 's' : ''}
              </span>
            </h1>
            <p className="text-xs text-muted-foreground">Manage V2 questions, multi-language stems, tutor data, and classification</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handleOpenCreate} size="sm" className="h-8 gap-1.5 text-xs font-semibold shadow-sm">
            <Plus className="size-3.5" /> Add Question
          </Button>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl flex items-center justify-between gap-4 animate-in fade-in">
          <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">
            {selectedIds.length} question(s) selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleBulkGenerateHindi}
              disabled={bulkTranslating}
              className="h-8 text-xs gap-1.5 bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Sparkles className="size-3.5" />
              {bulkTranslating ? "Translating with AI..." : "Translate Selected to Hindi (AI)"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])} className="h-8 text-xs">
              Deselect
            </Button>
          </div>
        </div>
      )}

      {/* Questions List */}
      <Card className="border border-border/70 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
            <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Loading Questions...
          </div>
        ) : error ? (
          <div className="p-12 text-center text-xs space-y-3">
            <p className="text-rose-500 font-semibold">{error}</p>
            <Button size="sm" variant="outline" onClick={fetchData} className="h-8 text-xs gap-1.5">
              <RefreshCw className="size-3.5" /> Retry Loading
            </Button>
          </div>
        ) : questions.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground">No questions created for this exam yet.</div>
        ) : (
          <div className="divide-y divide-border/50 text-xs">
            {questions.map((q, idx) => {
              const qType = q.question_type || q.schema_payload?.question_type || 'mcq_single'
              const topic = q.topic || q.schema_payload?.classification?.topic || ''
              const subject = q.subject || q.schema_payload?.classification?.subject || ''
              const marks = q.marks ?? q.schema_payload?.marking?.positive ?? 1

              return (
                <div key={q.id} className="p-5 hover:bg-muted/20 transition-colors space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(q.id)}
                        onChange={() => toggleSelect(q.id)}
                        className="mt-1 rounded border-border"
                      />
                      <span className="size-6 rounded-md bg-muted flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        Q{idx + 1}
                      </span>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-secondary text-primary rounded-md border border-border/50">
                            {qType}
                          </span>
                          {subject && (
                            <span className="text-[10px] font-medium px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-md border border-blue-500/20">
                              {subject}
                            </span>
                          )}
                          {topic && (
                            <span className="text-[10px] font-medium px-2 py-0.5 bg-muted text-muted-foreground rounded-md">
                              {topic}
                            </span>
                          )}
                          <span className="text-[10px] font-semibold text-muted-foreground">
                            +{marks} Mark{marks !== 1 ? 's' : ''}
                          </span>
                          {q.verified && (
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                              <CheckCircle2 className="size-3" /> Verified
                            </span>
                          )}
                        </div>

                        <p className="font-semibold text-foreground text-sm leading-relaxed">{q.question_text}</p>

                        {q.question_text_hi && (
                          <p className="text-xs text-purple-600 dark:text-purple-400 font-medium flex items-center gap-1 leading-relaxed">
                            <Languages className="size-3 shrink-0" /> {q.question_text_hi}
                          </p>
                        )}

                        {q.explanation && (
                          <div className="text-xs text-muted-foreground mt-2 bg-muted/30 p-2.5 rounded-lg border border-border/40 space-y-1">
                            <p><strong className="text-foreground">Explanation (EN):</strong> {q.explanation}</p>
                            {q.explanation_hi && (
                              <p className="text-purple-600 dark:text-purple-400"><strong className="text-purple-700 dark:text-purple-300">Explanation (HI):</strong> {q.explanation_hi}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={translatingId === q.id}
                        onClick={() => handleGenerateHindiSingle(q.id)}
                        className="h-7 px-2 text-[11px] gap-1 text-purple-600 border-purple-500/30 hover:bg-purple-500/10"
                      >
                        <Sparkles className="size-3" />
                        {translatingId === q.id ? "Gen..." : q.question_text_hi ? "Re-Translate" : "AI Hindi"}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(q)} className="size-7">
                        <Edit className="size-3.5 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteQuestion(q.id)} className="size-7 text-destructive">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Options List */}
                  {q.answers && q.answers.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-9 pt-1">
                      {q.answers.map((opt: any) => (
                        <div
                          key={opt.id}
                          className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${opt.is_correct ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-medium' : 'bg-muted/30 border-border/50 text-muted-foreground'}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="size-5 rounded bg-background border border-border/70 flex items-center justify-center font-bold text-[10px] shrink-0">
                              {opt.option_label || String.fromCharCode(65 + (opt.order ?? 0))}
                            </span>
                            <div>
                              <div>{opt.answer_text}</div>
                              {opt.answer_text_hi && (
                                <div className="text-[10px] text-purple-600 dark:text-purple-400 font-normal">{opt.answer_text_hi}</div>
                              )}
                            </div>
                          </div>
                          {opt.is_correct && <CheckCircle2 className="size-4 text-emerald-500 shrink-0 ml-2" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Modern Full-Featured Create / Edit Question Modal */}
      {mounted && isModalOpen && createPortal(
        <div className="fixed inset-0 z-[99999] w-screen h-screen bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div 
            className="fixed inset-0 -z-10" 
            onClick={() => setIsModalOpen(false)}
          />
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150 relative">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-border/60 flex items-center justify-between shrink-0 bg-muted/20 rounded-t-2xl">
              <div>
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <span>{editingQuestion ? "Edit Question" : "Create New Question"}</span>
                  {formData.id && (
                    <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      {formData.id}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-muted-foreground">Configure statements, bilingual options, taxonomy, and tutor steps</p>
              </div>
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)}
                className="size-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
              >
                <X className="size-4 text-muted-foreground" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-border/60 px-5 gap-4 shrink-0 bg-background text-xs font-semibold overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('content')}
                className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors ${activeTab === 'content' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                <BookOpen className="size-3.5" /> Question & Options
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('classification')}
                className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors ${activeTab === 'classification' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                <Sliders className="size-3.5" /> Classification & Marks
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('tutor')}
                className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors ${activeTab === 'tutor' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                <GraduationCap className="size-3.5" /> Tutor Data & Steps
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('meta')}
                className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors ${activeTab === 'meta' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                <History className="size-3.5" /> Meta & History
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={handleSaveQuestion} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
              
              {/* TAB 1: CONTENT & OPTIONS */}
              {activeTab === 'content' && (
                <div className="space-y-5">
                  {/* Top Bar: Question Type Selector */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/20 border border-border/60 rounded-xl">
                    <div>
                      <label className="block font-semibold mb-1">Question Type</label>
                      <select
                        value={formData.question_type}
                        onChange={(e) => setFormData({ ...formData, question_type: e.target.value })}
                        className="w-full bg-background border border-border rounded-lg p-2 font-medium outline-none"
                      >
                        <option value="mcq_single">Single Choice MCQ (mcq_single)</option>
                        <option value="mcq_multi">Multiple Correct MCQ (mcq_multi)</option>
                        <option value="nat">Numerical Answer (nat)</option>
                        <option value="subjective">Subjective / Descriptive (subjective)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold mb-1">Diagram / Figure Image URL (Optional)</label>
                      <input
                        type="url"
                        value={formData.image}
                        onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                        placeholder="https://example.com/diagram.png"
                        className="w-full bg-background border border-border rounded-lg p-2 outline-none"
                      />
                    </div>
                  </div>

                  {formData.image && (
                    <div className="p-3 bg-muted/20 border border-border/60 rounded-xl flex items-center gap-4">
                      <img src={formData.image} alt="Question Diagram Preview" className="max-h-24 rounded border border-border" />
                      <div className="text-muted-foreground text-[11px]">
                        Diagram Image attached to question stem.
                      </div>
                    </div>
                  )}

                  {/* Statements Side-by-Side */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold mb-1">Question Statement (English)</label>
                      <textarea
                        rows={4}
                        required
                        value={formData.question_text}
                        onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
                        className="w-full bg-background border border-border rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary/20 leading-relaxed font-sans"
                        placeholder="Enter English question statement (supports LaTeX $...$)..."
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1 text-purple-600 dark:text-purple-400 flex items-center gap-1">
                        <Languages className="size-3.5" /> Question Statement (Hindi)
                      </label>
                      <textarea
                        rows={4}
                        value={formData.question_text_hi}
                        onChange={(e) => setFormData({ ...formData, question_text_hi: e.target.value })}
                        className="w-full bg-background border border-purple-500/30 rounded-xl p-3 outline-none focus:ring-2 focus:ring-purple-500/20 leading-relaxed font-sans"
                        placeholder="हिंदी प्रश्न दर्ज करें (वैकल्पिक)..."
                      />
                    </div>
                  </div>

                  {/* Dynamic Options or NAT Range */}
                  {(formData.question_type === 'mcq_single' || formData.question_type === 'mcq_multi') && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <label className="font-semibold text-foreground flex items-center gap-2">
                          <span>Answer Options</span>
                          <span className="text-muted-foreground font-normal text-[11px]">
                            ({formData.question_type === 'mcq_single' ? 'Select 1 correct radio' : 'Select all correct checkboxes'})
                          </span>
                        </label>
                        <Button type="button" variant="outline" size="sm" onClick={addOption} className="h-7 text-xs gap-1">
                          <Plus className="size-3" /> Add Option
                        </Button>
                      </div>

                      <div className="space-y-3">
                        {formData.options.map((opt, idx) => (
                          <div key={idx} className="p-3.5 bg-muted/20 border border-border/70 rounded-xl space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                {formData.question_type === 'mcq_single' ? (
                                  <input
                                    type="radio"
                                    name="correct_option"
                                    checked={formData.correct_options[0] === opt.id || opt.is_correct}
                                    onChange={() => {
                                      const newOpts = formData.options.map((o, i) => ({ ...o, is_correct: i === idx }))
                                      setFormData({ ...formData, options: newOpts, correct_options: [opt.id] })
                                    }}
                                    className="accent-primary size-4"
                                  />
                                ) : (
                                  <input
                                    type="checkbox"
                                    checked={opt.is_correct || formData.correct_options.includes(opt.id)}
                                    onChange={(e) => {
                                      const isChecked = e.target.checked
                                      const newOpts = [...formData.options]
                                      newOpts[idx].is_correct = isChecked
                                      const correctIds = newOpts.filter(o => o.is_correct).map(o => o.id)
                                      setFormData({ ...formData, options: newOpts, correct_options: correctIds })
                                    }}
                                    className="accent-primary size-4 rounded"
                                  />
                                )}
                                <span className="font-bold text-xs">
                                  Option {opt.id} {opt.is_correct && <span className="text-emerald-600 dark:text-emerald-400 font-semibold">(Correct Answer)</span>}
                                </span>
                              </div>

                              {formData.options.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => removeOption(idx)}
                                  className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                                  title="Remove option"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-6">
                              <input
                                type="text"
                                required
                                value={opt.answer_text}
                                onChange={(e) => {
                                  const newOpts = [...formData.options]
                                  newOpts[idx].answer_text = e.target.value
                                  setFormData({ ...formData, options: newOpts })
                                }}
                                placeholder={`Option ${opt.id} (English)...`}
                                className="bg-background border border-border rounded-lg p-2 outline-none font-sans"
                              />
                              <input
                                type="text"
                                value={opt.answer_text_hi}
                                onChange={(e) => {
                                  const newOpts = [...formData.options]
                                  newOpts[idx].answer_text_hi = e.target.value
                                  setFormData({ ...formData, options: newOpts })
                                }}
                                placeholder={`विकल्प ${opt.id} (हिंदी)...`}
                                className="bg-background border border-purple-500/30 rounded-lg p-2 outline-none font-sans"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {formData.question_type === 'nat' && (
                    <div className="p-4 bg-muted/20 border border-border/70 rounded-xl space-y-3">
                      <h4 className="font-bold text-xs text-foreground">Numerical Range & Unit</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block font-semibold mb-1">Minimum Value</label>
                          <input
                            type="number"
                            step="any"
                            value={formData.nat_min}
                            onChange={(e) => setFormData({ ...formData, nat_min: e.target.value })}
                            placeholder="e.g. 9.9"
                            className="w-full bg-background border border-border rounded-lg p-2 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold mb-1">Maximum Value</label>
                          <input
                            type="number"
                            step="any"
                            value={formData.nat_max}
                            onChange={(e) => setFormData({ ...formData, nat_max: e.target.value })}
                            placeholder="e.g. 10.1"
                            className="w-full bg-background border border-border rounded-lg p-2 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold mb-1">Unit (Optional)</label>
                          <input
                            type="text"
                            value={formData.nat_unit}
                            onChange={(e) => setFormData({ ...formData, nat_unit: e.target.value })}
                            placeholder="e.g. m/s² or kg"
                            className="w-full bg-background border border-border rounded-lg p-2 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {formData.question_type === 'subjective' && (
                    <div className="p-4 bg-muted/20 border border-border/70 rounded-xl space-y-2">
                      <label className="block font-bold text-xs text-foreground">Model Answer / Key Points</label>
                      <textarea
                        rows={3}
                        value={formData.subjective_answer}
                        onChange={(e) => setFormData({ ...formData, subjective_answer: e.target.value })}
                        placeholder="Enter reference answer key for grading..."
                        className="w-full bg-background border border-border rounded-lg p-2.5 outline-none font-sans"
                      />
                    </div>
                  )}

                  {/* Explanations Side-by-Side */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block font-semibold mb-1">Explanation (English)</label>
                      <textarea
                        rows={3}
                        value={formData.explanation}
                        onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                        className="w-full bg-background border border-border rounded-xl p-3 outline-none leading-relaxed font-sans"
                        placeholder="Detailed explanation with step-by-step logic (LaTeX $...$ supported)..."
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1 text-purple-600 dark:text-purple-400 flex items-center gap-1">
                        <Languages className="size-3.5" /> Explanation (Hindi)
                      </label>
                      <textarea
                        rows={3}
                        value={formData.explanation_hi}
                        onChange={(e) => setFormData({ ...formData, explanation_hi: e.target.value })}
                        className="w-full bg-background border border-purple-500/30 rounded-xl p-3 outline-none leading-relaxed font-sans"
                        placeholder="हिंदी में विस्तृत व्याख्या..."
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: CLASSIFICATION & MARKING */}
              {activeTab === 'classification' && (
                <div className="space-y-6">
                  {/* Taxonomy */}
                  <div className="p-5 bg-muted/20 border border-border/70 rounded-xl space-y-4">
                    <h4 className="font-bold text-xs text-foreground flex items-center gap-2">
                      <Sliders className="size-3.5" /> Subject & Taxonomy Classification
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-semibold mb-1">Subject</label>
                        <input
                          type="text"
                          required
                          value={formData.subject}
                          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                          placeholder="e.g. Quantitative Aptitude, General Hindi"
                          className="w-full bg-background border border-border rounded-lg p-2 outline-none font-medium"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Topic</label>
                        <input
                          type="text"
                          value={formData.topic}
                          onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                          placeholder="e.g. Speed, Time and Distance"
                          className="w-full bg-background border border-border rounded-lg p-2 outline-none font-medium"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Subtopic</label>
                        <input
                          type="text"
                          value={formData.subtopic}
                          onChange={(e) => setFormData({ ...formData, subtopic: e.target.value })}
                          placeholder="e.g. Trains, Boats & Streams"
                          className="w-full bg-background border border-border rounded-lg p-2 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Cognitive Level (Bloom's Taxonomy)</label>
                        <select
                          value={formData.cognitive_level}
                          onChange={(e) => setFormData({ ...formData, cognitive_level: e.target.value })}
                          className="w-full bg-background border border-border rounded-lg p-2 outline-none"
                        >
                          <option value="remember">Remember (Knowledge)</option>
                          <option value="understand">Understand (Comprehension)</option>
                          <option value="apply">Apply (Application)</option>
                          <option value="analyze">Analyze (Analytical)</option>
                          <option value="evaluate">Evaluate (Evaluation)</option>
                          <option value="create">Create (Synthesis)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Marking Scheme */}
                  <div className="p-5 bg-muted/20 border border-border/70 rounded-xl space-y-4">
                    <h4 className="font-bold text-xs text-foreground flex items-center gap-2">
                      <Clock className="size-3.5" /> Marking Scheme & Time Target
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block font-semibold mb-1">Positive Marks (+)</label>
                        <input
                          type="number"
                          step="0.1"
                          required
                          value={formData.marks}
                          onChange={(e) => setFormData({ ...formData, marks: parseFloat(e.target.value) || 0 })}
                          placeholder="e.g. 2.0"
                          className="w-full bg-background border border-border rounded-lg p-2 outline-none font-semibold text-emerald-600"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Negative Penalty (-)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={formData.negative_marks}
                          onChange={(e) => setFormData({ ...formData, negative_marks: parseFloat(e.target.value) || 0 })}
                          placeholder="e.g. 0.5"
                          className="w-full bg-background border border-border rounded-lg p-2 outline-none font-semibold text-destructive"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Ideal Target Time (Seconds)</label>
                        <input
                          type="number"
                          value={formData.ideal_time_seconds}
                          onChange={(e) => setFormData({ ...formData, ideal_time_seconds: parseInt(e.target.value) || 60 })}
                          placeholder="e.g. 45"
                          className="w-full bg-background border border-border rounded-lg p-2 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: TUTOR DATA & STEPS */}
              {activeTab === 'tutor' && (
                <div className="space-y-6">
                  {/* Hints */}
                  <div className="p-5 bg-muted/20 border border-border/70 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs text-foreground flex items-center gap-2">
                        <GraduationCap className="size-3.5" /> Student Hints (Interactive Tutor)
                      </h4>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setFormData({ ...formData, hints: [...formData.hints, ""] })}
                        className="h-7 text-xs gap-1"
                      >
                        <Plus className="size-3" /> Add Hint
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {formData.hints.map((hint, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="font-bold text-muted-foreground w-12 shrink-0">Hint {idx + 1}:</span>
                          <input
                            type="text"
                            value={hint}
                            onChange={(e) => {
                              const newHints = [...formData.hints]
                              newHints[idx] = e.target.value
                              setFormData({ ...formData, hints: newHints })
                            }}
                            placeholder={`e.g. First, convert the speed from km/h to m/s...`}
                            className="flex-1 bg-background border border-border rounded-lg p-2 outline-none font-sans"
                          />
                          {formData.hints.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, hints: formData.hints.filter((_, i) => i !== idx) })}
                              className="text-muted-foreground hover:text-destructive p-1.5"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Step-by-Step Solution */}
                  <div className="p-5 bg-muted/20 border border-border/70 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs text-foreground flex items-center gap-2">
                        <Sparkles className="size-3.5" /> Step-by-Step Solution Breakdown
                      </h4>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setFormData({ ...formData, solution_steps: [...formData.solution_steps, ""] })}
                        className="h-7 text-xs gap-1"
                      >
                        <Plus className="size-3" /> Add Step
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {formData.solution_steps.map((step, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="font-bold text-muted-foreground w-12 shrink-0">Step {idx + 1}:</span>
                          <input
                            type="text"
                            value={step}
                            onChange={(e) => {
                              const newSteps = [...formData.solution_steps]
                              newSteps[idx] = e.target.value
                              setFormData({ ...formData, solution_steps: newSteps })
                            }}
                            placeholder={`e.g. Convert speed to m/s: $60 \\times \\frac{5}{18} = \\frac{50}{3}$ m/s`}
                            className="flex-1 bg-background border border-border rounded-lg p-2 outline-none font-sans"
                          />
                          {formData.solution_steps.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, solution_steps: formData.solution_steps.filter((_, i) => i !== idx) })}
                              className="text-muted-foreground hover:text-destructive p-1.5"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: META & HISTORY */}
              {activeTab === 'meta' && (
                <div className="space-y-6">
                  <div className="p-5 bg-muted/20 border border-border/70 rounded-xl space-y-4">
                    <h4 className="font-bold text-xs text-foreground flex items-center gap-2">
                      <History className="size-3.5" /> Exam Origin & Past Paper Shift
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block font-semibold mb-1">Exam Name</label>
                        <input
                          type="text"
                          value={formData.exam_history_exam}
                          onChange={(e) => setFormData({ ...formData, exam_history_exam: e.target.value })}
                          placeholder="e.g. UP Police SI / SSC CGL"
                          className="w-full bg-background border border-border rounded-lg p-2 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Exam Year</label>
                        <input
                          type="number"
                          value={formData.exam_history_year}
                          onChange={(e) => setFormData({ ...formData, exam_history_year: e.target.value })}
                          placeholder="e.g. 2021"
                          className="w-full bg-background border border-border rounded-lg p-2 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Shift / Session</label>
                        <input
                          type="text"
                          value={formData.exam_history_shift}
                          onChange={(e) => setFormData({ ...formData, exam_history_shift: e.target.value })}
                          placeholder="e.g. Shift 1 / Morning"
                          className="w-full bg-background border border-border rounded-lg p-2 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-5 bg-muted/20 border border-border/70 rounded-xl space-y-4">
                    <h4 className="font-bold text-xs text-foreground flex items-center gap-2">
                      <Tag className="size-3.5" /> Tags & Verification
                    </h4>

                    <div className="space-y-3">
                      <div>
                        <label className="block font-semibold mb-1">Tags (Comma-separated)</label>
                        <input
                          type="text"
                          value={formData.tags}
                          onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                          placeholder="e.g. speed, trains, time-distance, pyq"
                          className="w-full bg-background border border-border rounded-lg p-2 outline-none"
                        />
                      </div>

                      <div className="pt-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.verified}
                            onChange={(e) => setFormData({ ...formData, verified: e.target.checked })}
                            className="accent-primary size-4 rounded"
                          />
                          <span className="font-semibold text-xs text-foreground">Mark as Verified (Verified with official answer key / human review)</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-border/60">
                <div className="text-muted-foreground text-[11px]">
                  Fields automatically map to V2 canonical schema (<code className="bg-muted px-1.5 py-0.5 rounded font-mono">schemamix.json</code>)
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="font-semibold gap-1.5 shadow-sm">
                    <Check className="size-3.5" /> Save Question
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
