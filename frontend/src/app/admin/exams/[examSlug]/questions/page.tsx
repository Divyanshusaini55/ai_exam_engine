"use client"

import { useEffect, useState } from "react"
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
  Languages
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function AdminQuestionsPage() {
  const params = useParams()
  const examSlug = params.examSlug as string
  const [exam, setExam] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [translatingId, setTranslatingId] = useState<number | null>(null)
  const [bulkTranslating, setBulkTranslating] = useState(false)

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<any>(null)
  const [formData, setFormData] = useState({
    question_text: "",
    question_text_hi: "",
    explanation: "",
    explanation_hi: "",
    subject: "General",
    topic: "",
    difficulty: "medium",
    marks: 1,
    options: [
      { answer_text: "", answer_text_hi: "", is_correct: true },
      { answer_text: "", answer_text_hi: "", is_correct: false },
      { answer_text: "", answer_text_hi: "", is_correct: false },
      { answer_text: "", answer_text_hi: "", is_correct: false },
    ]
  })

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

      // Query questions using exam_id if currentExam is found, or fallback to exam_slug
      const resQ = currentExam
        ? await adminApi.getQuestions(currentExam.id)
        : await adminApi.getQuestions(undefined, examSlug)

      if (resQ.ok) {
        const rawQ = await resQ.json()
        const items = Array.isArray(rawQ) ? rawQ : rawQ?.results || []
        setQuestions(items)

        // If exam metadata wasn't found in getExams list, infer title from questions if available
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

  function toggleSelect(id: number) {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id))
    } else {
      setSelectedIds([...selectedIds, id])
    }
  }

  function handleOpenCreate() {
    setEditingQuestion(null)
    setFormData({
      question_text: "",
      question_text_hi: "",
      explanation: "",
      explanation_hi: "",
      subject: "General",
      topic: "",
      difficulty: "medium",
      marks: exam?.marks_per_question || 1,
      options: [
        { answer_text: "", answer_text_hi: "", is_correct: true },
        { answer_text: "", answer_text_hi: "", is_correct: false },
        { answer_text: "", answer_text_hi: "", is_correct: false },
        { answer_text: "", answer_text_hi: "", is_correct: false },
      ]
    })
    setIsModalOpen(true)
  }

  function handleOpenEdit(q: any) {
    setEditingQuestion(q)
    setFormData({
      question_text: q.question_text || "",
      question_text_hi: q.question_text_hi || "",
      explanation: q.explanation || "",
      explanation_hi: q.explanation_hi || "",
      subject: q.subject || "General",
      topic: q.topic || "",
      difficulty: q.difficulty || "medium",
      marks: q.marks || 1,
      options: q.answers && q.answers.length > 0
        ? q.answers.map((a: any) => ({
            answer_text: a.answer_text || "",
            answer_text_hi: a.answer_text_hi || "",
            is_correct: a.is_correct
          }))
        : [
            { answer_text: "", answer_text_hi: "", is_correct: true },
            { answer_text: "", answer_text_hi: "", is_correct: false },
            { answer_text: "", answer_text_hi: "", is_correct: false },
            { answer_text: "", answer_text_hi: "", is_correct: false },
          ]
    })
    setIsModalOpen(true)
  }

  async function handleGenerateHindiSingle(id: number) {
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
      const payload = {
        ...formData,
        exam: exam.id
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

  async function handleDeleteQuestion(id: number) {
    if (!confirm("Are you sure you want to delete this question?")) return
    try {
      await adminApi.deleteQuestion(id)
      fetchData()
    } catch (err) {
      console.error("Delete question error:", err)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Back & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link href="/admin/exams" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="size-3.5" /> Back to Exams
          </Link>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            {exam ? exam.title : "Exam Questions"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage question items, options, and explanations.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} className="h-9 gap-1.5 text-xs">
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
          <Button size="sm" onClick={handleOpenCreate} className="h-9 gap-1.5 text-xs">
            <Plus className="size-3.5" /> Add Question
          </Button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-between gap-3 text-xs">
          <span className="font-semibold text-purple-600 dark:text-purple-400">
            {selectedIds.length} question{selectedIds.length > 1 ? 's' : ''} selected
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
            {questions.map((q, idx) => (
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
                    <div className="space-y-1">
                      <p className="font-semibold text-foreground text-sm">{q.question_text}</p>
                      {q.question_text_hi && (
                        <p className="text-xs text-purple-600 dark:text-purple-400 font-medium flex items-center gap-1">
                          <Languages className="size-3" /> {q.question_text_hi}
                        </p>
                      )}
                      {q.explanation && (
                        <p className="text-xs text-muted-foreground mt-1 bg-muted/30 p-2 rounded border border-border/40">
                          <span className="font-medium text-foreground">Explanation (EN):</span> {q.explanation}
                          {q.explanation_hi && (
                            <span className="block text-purple-600 dark:text-purple-400 font-medium mt-1">
                              Explanation (HI): {q.explanation_hi}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-9">
                    {q.answers.map((opt: any) => (
                      <div
                        key={opt.id}
                        className={`p-2 rounded border text-xs flex items-center justify-between ${opt.is_correct ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-medium' : 'bg-muted/40 border-border/50 text-muted-foreground'}`}
                      >
                        <div>
                          <div>{opt.answer_text}</div>
                          {opt.answer_text_hi && (
                            <div className="text-[10px] text-purple-600 dark:text-purple-400 font-normal">{opt.answer_text_hi}</div>
                          )}
                        </div>
                        {opt.is_correct && <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Create / Edit Question Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                {editingQuestion ? "Edit Question" : "Add Question"}
              </h3>
              <button onClick={() => setIsModalOpen(false)}><X className="size-4 text-muted-foreground" /></button>
            </div>
            <form onSubmit={handleSaveQuestion} className="space-y-4 text-xs">
              {/* Question Statement English & Hindi Side-by-Side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Question Statement (English)</label>
                  <textarea
                    rows={3}
                    required
                    value={formData.question_text}
                    onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Enter English question statement..."
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-purple-600 dark:text-purple-400 flex items-center gap-1">
                    <Languages className="size-3.5" /> Question Statement (Hindi)
                  </label>
                  <textarea
                    rows={3}
                    value={formData.question_text_hi}
                    onChange={(e) => setFormData({ ...formData, question_text_hi: e.target.value })}
                    className="w-full bg-background border border-purple-500/30 rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-purple-500"
                    placeholder="हिंदी प्रश्न दर्ज करें..."
                  />
                </div>
              </div>

              {/* Options Side-by-Side */}
              <div className="space-y-3">
                <label className="block font-semibold">Answer Options (Select correct option radio)</label>
                {formData.options.map((opt, idx) => (
                  <div key={idx} className="p-3 bg-muted/20 border border-border/60 rounded-xl space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correct_option"
                        checked={opt.is_correct}
                        onChange={() => {
                          const newOpts = formData.options.map((o, i) => ({ ...o, is_correct: i === idx }))
                          setFormData({ ...formData, options: newOpts })
                        }}
                        className="accent-primary"
                      />
                      <span className="font-bold text-xs">Option {idx + 1} {opt.is_correct && "(Correct Answer)"}</span>
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
                        placeholder={`Option ${idx + 1} (English)...`}
                        className="bg-background border border-border rounded-lg p-2 outline-none"
                      />
                      <input
                        type="text"
                        value={opt.answer_text_hi}
                        onChange={(e) => {
                          const newOpts = [...formData.options]
                          newOpts[idx].answer_text_hi = e.target.value
                          setFormData({ ...formData, options: newOpts })
                        }}
                        placeholder={`विकल्प ${idx + 1} (हिंदी)...`}
                        className="bg-background border border-purple-500/30 rounded-lg p-2 outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Explanation English & Hindi Side-by-Side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Explanation (English)</label>
                  <textarea
                    rows={2}
                    value={formData.explanation}
                    onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg p-2.5 outline-none"
                    placeholder="Explanation in English..."
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-purple-600 dark:text-purple-400 flex items-center gap-1">
                    <Languages className="size-3.5" /> Explanation (Hindi)
                  </label>
                  <textarea
                    rows={2}
                    value={formData.explanation_hi}
                    onChange={(e) => setFormData({ ...formData, explanation_hi: e.target.value })}
                    className="w-full bg-background border border-purple-500/30 rounded-lg p-2.5 outline-none"
                    placeholder="हिंदी में व्याख्या..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit" size="sm">Save Question</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
