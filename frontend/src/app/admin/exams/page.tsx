"use client"

import { useEffect, useState } from "react"
import { adminApi } from "@/lib/api"
import {
  Plus,
  Search,
  Edit,
  Trash2,
  HelpCircle,
  Download,
  Upload,
  RefreshCw,
  X,
  FileText
} from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function AdminExamsPage() {
  const [exams, setExams] = useState<any[]>([])
  const [subcategories, setSubcategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingExam, setEditingExam] = useState<any>(null)
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    subcategory: "",
    duration_minutes: 60,
    marks_per_question: 1.0,
    negative_marks: 0.25,
    is_active: true,
    status: "published",
    total_questions: 100,
  })

  // Import JSON Modal
  const [importExamId, setImportExamId] = useState<number | null>(null)
  const [jsonText, setJsonText] = useState("")
  const [importing, setImporting] = useState(false)

  async function fetchData() {
    setLoading(true)
    try {
      const [resExams, resSubs] = await Promise.all([
        adminApi.getExams(),
        adminApi.getSubcategories()
      ])
      if (resExams.ok) {
        const json = await resExams.json()
        setExams(Array.isArray(json) ? json : json?.results || [])
      }
      if (resSubs.ok) {
        const jsonSubs = await resSubs.json()
        setSubcategories(Array.isArray(jsonSubs) ? jsonSubs : jsonSubs?.results || [])
      }
    } catch (err) {
      console.error("Failed to load exams:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  function handleOpenCreate() {
    setEditingExam(null)
    setFormData({
      title: "",
      slug: "",
      subcategory: subcategories[0]?.id || "",
      duration_minutes: 60,
      marks_per_question: 1.0,
      negative_marks: 0.25,
      is_active: true,
      status: "published",
      total_questions: 100,
    })
    setIsModalOpen(true)
  }

  function handleOpenEdit(exam: any) {
    setEditingExam(exam)
    setFormData({
      title: exam.title,
      slug: exam.slug,
      subcategory: exam.subcategory || subcategories[0]?.id || "",
      duration_minutes: exam.duration_minutes,
      marks_per_question: exam.marks_per_question ?? 1.0,
      negative_marks: exam.negative_marks ?? 0.25,
      is_active: exam.is_active,
      status: exam.status || "published",
      total_questions: exam.total_questions,
    })
    setIsModalOpen(true)
  }

  async function handleSaveExam(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (editingExam) {
        await adminApi.updateExam(editingExam.id, formData)
      } else {
        await adminApi.createExam(formData)
      }
      setIsModalOpen(false)
      fetchData()
    } catch (err) {
      console.error("Save exam error:", err)
    }
  }

  async function handleDeleteExam(id: number) {
    if (!confirm("Are you sure you want to delete this exam and all its questions?")) return
    try {
      await adminApi.deleteExam(id)
      fetchData()
    } catch (err) {
      console.error("Delete exam error:", err)
    }
  }

  async function handleExportJson(id: number, title: string) {
    try {
      const res = await adminApi.exportExamJson(id)
      if (res.ok) {
        const json = await res.json()
        const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, "-")}-export.json`
        a.click()
      }
    } catch (err) {
      console.error("Export error:", err)
    }
  }

  async function handleImportJsonSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!importExamId || !jsonText.trim()) return
    setImporting(true)
    try {
      const parsed = JSON.parse(jsonText)
      const res = await adminApi.importExamJson(importExamId, parsed)
      if (res.ok) {
        const json = await res.json()
        alert(json.message)
        setImportExamId(null)
        setJsonText("")
        fetchData()
      } else {
        alert("Failed to import JSON")
      }
    } catch (err: any) {
      alert(`Invalid JSON format: ${err.message}`)
    } finally {
      setImporting(false)
    }
  }

  const examList = Array.isArray(exams) ? exams : []
  const filteredExams = examList.filter((e) =>
    e?.title?.toLowerCase().includes(search.toLowerCase()) ||
    e?.slug?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Exams & Question Papers</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage assessments, question banks, and JSON import/export.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} className="h-9 gap-1.5 text-xs">
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
          <Button size="sm" onClick={handleOpenCreate} className="h-9 gap-1.5 text-xs">
            <Plus className="size-3.5" /> Create Exam
          </Button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <Card className="border border-border/70 p-4 rounded-xl">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search exams by title or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-background border border-border/60 rounded-lg pl-9 pr-4 py-2 text-xs focus:ring-1 focus:ring-primary outline-none"
          />
        </div>
      </Card>

      {/* Exams Table */}
      <Card className="border border-border/70 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-xs text-muted-foreground">Loading Exams...</div>
        ) : filteredExams.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground">No exams found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-4">Title & Slug</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Duration</th>
                  <th className="p-4">Questions</th>
                  <th className="p-4">Marks (+/-)</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredExams.map((exam) => (
                  <tr key={exam.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-4 font-semibold text-foreground">
                      <div>{exam.title}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{exam.slug}</div>
                    </td>
                    <td className="p-4 text-muted-foreground">{exam.subcategory_name || "General"}</td>
                    <td className="p-4 text-muted-foreground">{exam.duration_minutes} mins</td>
                    <td className="p-4">
                      <span className="font-semibold text-foreground">{exam.total_questions}</span>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      +{exam.marks_per_question ?? 1} / -{exam.negative_marks ?? 0}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${exam.is_active ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-muted text-muted-foreground'}`}>
                        {exam.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-1 whitespace-nowrap">
                      <Link href={`/admin/exams/${exam.slug}/questions`}>
                        <Button variant="outline" size="sm" className="h-7 px-2 text-[11px] gap-1">
                          <HelpCircle className="size-3" /> Questions
                        </Button>
                      </Link>
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(exam)} className="size-7">
                        <Edit className="size-3.5 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setImportExamId(exam.id)} title="Import JSON" className="size-7">
                        <Upload className="size-3.5 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleExportJson(exam.id, exam.title)} title="Export JSON" className="size-7">
                        <Download className="size-3.5 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteExam(exam.id)} className="size-7 text-destructive">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create / Edit Exam Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <h3 className="font-bold text-base text-foreground">{editingExam ? "Edit Exam" : "Create New Exam"}</h3>
              <button onClick={() => setIsModalOpen(false)}><X className="size-4 text-muted-foreground" /></button>
            </div>
            <form onSubmit={handleSaveExam} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium mb-1">Exam Title</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-') })}
                  className="w-full bg-background border border-border rounded-lg p-2 outline-none focus:ring-1 focus:ring-primary"
                  placeholder="e.g. SSC CGL 2025 Tier 1"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Slug</label>
                <input
                  type="text"
                  required
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg p-2 font-mono outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Subcategory</label>
                <select
                  value={formData.subcategory}
                  onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg p-2 outline-none"
                >
                  {subcategories.map((sub) => (
                    <option key={sub.id} value={sub.id}>{sub.category_name} &gt; {sub.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium mb-1">Duration (mins)</label>
                  <input
                    type="number"
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 60 })}
                    className="w-full bg-background border border-border rounded-lg p-2 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Marks / Q</label>
                  <input
                    type="number"
                    step="0.25"
                    value={formData.marks_per_question}
                    onChange={(e) => setFormData({ ...formData, marks_per_question: parseFloat(e.target.value) || 1 })}
                    className="w-full bg-background border border-border rounded-lg p-2 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Negative Marks</label>
                  <input
                    type="number"
                    step="0.25"
                    value={formData.negative_marks}
                    onChange={(e) => setFormData({ ...formData, negative_marks: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-background border border-border rounded-lg p-2 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">No of Questions</label>
                  <input
                    type="number"
                    required
                    value={formData.total_questions}
                    onChange={(e) => setFormData({ ...formData, total_questions: parseInt(e.target.value) || 100 })}
                    className="w-full bg-background border border-border rounded-lg p-2 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
                <label htmlFor="is_active" className="cursor-pointer">Active & Visible</label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit" size="sm">Save Exam</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk JSON Import Modal */}
      {importExamId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <h3 className="font-bold text-base text-foreground">Bulk Import Questions (JSON)</h3>
              <button onClick={() => setImportExamId(null)}><X className="size-4 text-muted-foreground" /></button>
            </div>
            <form onSubmit={handleImportJsonSubmit} className="space-y-4 text-xs">
              <p className="text-muted-foreground">Paste JSON containing an array of questions or an object with a <code>questions</code> array.</p>
              <textarea
                rows={10}
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder='{ "questions": [ { "question_text": "What is...", "options": ["A", "B"], "correct_option_index": 0 } ] }'
                className="w-full bg-background border border-border rounded-lg p-3 font-mono text-[11px] outline-none"
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setImportExamId(null)}>Cancel</Button>
                <Button type="submit" size="sm" disabled={importing}>
                  {importing ? "Importing..." : "Import JSON"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
