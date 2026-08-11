"use client"

import { useEffect, useState } from "react"
import { adminApi } from "@/lib/api"
import {
  Sparkles,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  RefreshCw
} from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function AdminAiToolsPage() {
  const [exams, setExams] = useState<any[]>([])
  const [uploads, setUploads] = useState<any[]>([])
  const [selectedExam, setSelectedExam] = useState<string>("")
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadData() {
    try {
      const [resExams, resUploads] = await Promise.all([
        adminApi.getExams(),
        adminApi.getUploads()
      ])
      if (resExams.ok) {
        const json = await resExams.json()
        const list = Array.isArray(json) ? json : json?.results || []
        setExams(list)
        if (list.length > 0 && !selectedExam) setSelectedExam(list[0].id.toString())
      }
      if (resUploads.ok) {
        const jsonU = await resUploads.json()
        setUploads(Array.isArray(jsonU) ? jsonU : jsonU?.results || [])
      }
    } catch (err) {
      console.error("Load data error:", err)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !selectedExam) return
    setUploading(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("exam", selectedExam)
      formData.append("subject", "General")

      const res = await adminApi.uploadPdf(formData)
      if (res.status >= 200 && res.status < 300) {
        setResult(res.data)
        setFile(null)
        loadData()
      } else {
        setError(res.data?.error || "Failed to process PDF file.")
      }
    } catch (err: any) {
      setError(err.message || "Upload failed.")
    } finally {
      setUploading(false)
    }
  }

  async function handleDeleteUpload(id: number) {
    if (!confirm("Delete this PDF upload record?")) return
    try {
      await adminApi.deleteUpload(id)
      loadData()
    } catch (err) {
      console.error("Delete upload error:", err)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
          <Sparkles className="size-6 text-purple-500" />
          AI PDF Question Extractor
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Upload any previous exam PDF paper. Gemini AI will extract questions, options, and explanations into your target exam bank.
        </p>
      </div>

      <Card className="border border-border/70 rounded-xl shadow-sm p-6 space-y-6">
        <form onSubmit={handleUpload} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Select Target Exam</label>
            <select
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
              className="w-full bg-background border border-border rounded-lg p-2.5 text-xs outline-none focus:ring-1 focus:ring-primary"
            >
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.title} ({exam.total_questions} existing Qs)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Upload Exam PDF File</label>
            <div className="border-2 border-dashed border-border hover:border-primary/50 transition-colors rounded-xl p-8 text-center bg-muted/20">
              <input
                type="file"
                accept=".pdf"
                id="pdf_file_input"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <label htmlFor="pdf_file_input" className="cursor-pointer flex flex-col items-center gap-2">
                <Upload className="size-8 text-muted-foreground" />
                {file ? (
                  <div className="flex items-center gap-2 text-xs font-medium text-primary">
                    <FileText className="size-4" />
                    <span>{file.name}</span> ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </div>
                ) : (
                  <>
                    <p className="text-xs font-medium text-foreground">Click to browse or drop PDF file here</p>
                    <p className="text-[10px] text-muted-foreground">Supports question paper PDFs up to 25MB</p>
                  </>
                )}
              </label>
            </div>
          </div>

          <Button
            type="submit"
            disabled={!file || uploading}
            className="w-full h-10 text-xs font-semibold gap-2 bg-purple-600 hover:bg-purple-700 text-white"
          >
            {uploading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Processing & Extracting Questions with Gemini AI...</span>
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                <span>Start AI Question Extraction</span>
              </>
            )}
          </Button>
        </form>

        {/* Result Message */}
        {result && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs flex items-start gap-3">
            <CheckCircle2 className="size-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Extraction Started / Complete!</p>
              <p className="text-[11px] mt-0.5">{result.message || "Questions extracted and added to exam questions bank."}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-start gap-3">
            <AlertCircle className="size-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Extraction Error</p>
              <p className="text-[11px] mt-0.5">{error}</p>
            </div>
          </div>
        )}
      </Card>

      {/* Past Uploads Table */}
      <Card className="border border-border/70 rounded-xl overflow-hidden shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <FileText className="size-4 text-primary" /> Past PDF Uploads History ({uploads.length})
          </h2>
          <Button variant="outline" size="sm" onClick={loadData} className="h-8 gap-1.5 text-xs">
            <RefreshCw className="size-3" /> Refresh
          </Button>
        </div>

        {uploads.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">No past PDF uploads found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3">Subject / Category</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Uploaded Date</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {uploads.map((up) => (
                  <tr key={up.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3 font-semibold text-foreground">
                      {up.subject || up.category_name || `Upload #${up.id}`}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        up.status === 'processed' || up.status === 'approved' ? 'bg-emerald-500/10 text-emerald-600' :
                        up.status === 'pending' ? 'bg-amber-500/10 text-amber-600' : 'bg-muted text-muted-foreground'
                      }`}>
                        {up.status || 'processed'}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {up.created_at ? new Date(up.created_at).toLocaleString() : 'N/A'}
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteUpload(up.id)}
                        className="h-7 px-2 text-[11px] gap-1 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border-0"
                      >
                        <Trash2 className="size-3" /> Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
