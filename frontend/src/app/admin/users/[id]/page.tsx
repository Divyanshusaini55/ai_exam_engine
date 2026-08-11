"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { adminApi } from "@/lib/api"
import {
  User,
  ArrowLeft,
  Activity,
  CheckCircle,
  XCircle,
  FileText,
  BookOpen,
  Map,
  RefreshCw,
  Clock,
  Flag
} from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function AdminUserProgressPage() {
  const params = useParams()
  const userId = params.id as string
  const [user, setUser] = useState<any>(null)
  const [progress, setProgress] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("exams") // exams, topics, resources, answers

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [userRes, progressRes] = await Promise.all([
        adminApi.getUser(userId),
        adminApi.getUserProgress(userId)
      ])
      
      if (userRes.ok) setUser(await userRes.json())
      if (progressRes.ok) setProgress(await progressRes.json())
    } catch (err) {
      console.error("Failed to load user progress:", err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (userId) fetchData()
  }, [userId, fetchData])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-muted-foreground font-medium">Loading User Analytics...</p>
      </div>
    )
  }

  if (!user || !progress) {
    return (
      <div className="p-12 text-center text-xs text-destructive bg-red-500/10 rounded-xl">
        Failed to load user analytics. User may not exist.
      </div>
    )
  }

  const { exam_results, topic_progress, resource_progress, answer_stats, recent_answers } = progress

  const statsCards = [
    { label: "Exams Attempted", value: exam_results.length, icon: FileText, textCol: "text-blue-600 dark:text-white", bgCol: "bg-blue-500/10 dark:bg-muted/40" },
    { label: "Resources Viewed", value: resource_progress.length, icon: BookOpen, textCol: "text-purple-600 dark:text-white", bgCol: "bg-purple-500/10 dark:bg-muted/40" },
    { label: "Topics Started", value: topic_progress.length, icon: Map, textCol: "text-amber-600 dark:text-white", bgCol: "bg-amber-500/10 dark:bg-muted/40" },
    { label: "Questions Answered", value: answer_stats.total_answers, icon: Activity, textCol: "text-emerald-600 dark:text-white", bgCol: "bg-emerald-500/10 dark:bg-muted/40" },
  ]

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="size-3.5" /> Back to Users
          </Link>
          <div className="flex items-center gap-3">
            <div className="size-12 bg-primary/10 text-primary rounded-full flex items-center justify-center">
              <User className="size-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
                {user.name}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {user.email} • {user.username} • Joined {new Date(user.date_joined).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={fetchData} className="h-9 gap-1.5 text-xs">
          <RefreshCw className="size-3.5" /> Refresh Analytics
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statsCards.map((stat, i) => (
          <Card key={i} className="border-border/70 shadow-sm bg-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.bgCol} ${stat.textCol}`}>
                <stat.icon className="size-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-border/50 pb-px overflow-x-auto scrollbar-hide">
        {[
          { id: "exams", label: "Exam Attempts", count: exam_results.length },
          { id: "topics", label: "Roadmap Progress", count: topic_progress.length },
          { id: "resources", label: "Resource Progress", count: resource_progress.length },
          { id: "answers", label: "Recent Answers", count: recent_answers.length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {tab.label} <span className="ml-1 opacity-50 font-normal">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="pt-2">
        
        {/* EXAMS TAB */}
        {activeTab === "exams" && (
          <Card className="border-border/70 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border/50 text-muted-foreground uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-4">Exam</th>
                    <th className="p-4">Score</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Date Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {exam_results.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No exams attempted yet.</td></tr>
                  ) : (
                    exam_results.map((e: any) => (
                      <tr key={e.id} className="hover:bg-muted/10">
                        <td className="p-4 font-medium">{e.exam_title}</td>
                        <td className="p-4">
                          <span className={`font-bold ${e.percentage >= 70 ? 'text-emerald-500' : 'text-amber-500'}`}>
                            {e.percentage.toFixed(1)}%
                          </span>
                          <span className="text-[10px] text-muted-foreground ml-1">({e.correct_answers}/{e.total_questions})</span>
                        </td>
                        <td className="p-4">
                          {e.is_completed ? (
                            <span className="text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded font-medium">Completed</span>
                          ) : (
                            <span className="text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded font-medium">In Progress</span>
                          )}
                        </td>
                        <td className="p-4 text-muted-foreground flex items-center gap-1.5">
                          <Clock className="size-3" /> {new Date(e.completed_at).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* TOPICS TAB */}
        {activeTab === "topics" && (
          <Card className="border-border/70 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border/50 text-muted-foreground uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-4">Topic</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Last Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {topic_progress.length === 0 ? (
                    <tr><td colSpan={3} className="p-8 text-center text-muted-foreground">No roadmap topics started.</td></tr>
                  ) : (
                    topic_progress.map((t: any) => (
                      <tr key={t.id} className="hover:bg-muted/10">
                        <td className="p-4 font-medium">{t.topic_title}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded font-medium uppercase text-[9px] tracking-wider ${
                            t.status === 'done' ? 'bg-emerald-500/10 text-emerald-600' :
                            t.status === 'in_progress' ? 'bg-blue-500/10 text-blue-600' :
                            t.status === 'skip' ? 'bg-muted text-muted-foreground' :
                            'bg-amber-500/10 text-amber-600'
                          }`}>
                            {t.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-4 text-muted-foreground">{new Date(t.updated_at).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* RESOURCES TAB */}
        {activeTab === "resources" && (
          <Card className="border-border/70 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border/50 text-muted-foreground uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-4">Resource</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Last Viewed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {resource_progress.length === 0 ? (
                    <tr><td colSpan={3} className="p-8 text-center text-muted-foreground">No resources viewed.</td></tr>
                  ) : (
                    resource_progress.map((r: any) => (
                      <tr key={r.id} className="hover:bg-muted/10">
                        <td className="p-4 font-medium">{r.resource_title}</td>
                        <td className="p-4">
                          {r.is_completed ? (
                            <span className="flex items-center gap-1 text-emerald-600 text-[10px] font-bold uppercase tracking-wider">
                              <CheckCircle className="size-3" /> Completed
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-blue-600 text-[10px] font-bold uppercase tracking-wider">
                              <Activity className="size-3" /> Viewing
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-muted-foreground">{new Date(r.last_viewed_at).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ANSWERS TAB */}
        {activeTab === "answers" && (
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 px-4 py-2 rounded-lg flex-1 flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider">Correct</span>
                <span className="text-xl font-black">{answer_stats.correct_answers}</span>
              </div>
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 px-4 py-2 rounded-lg flex-1 flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider">Incorrect</span>
                <span className="text-xl font-black">{answer_stats.incorrect_answers}</span>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 px-4 py-2 rounded-lg flex-1 flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider">Flagged</span>
                <span className="text-xl font-black">{answer_stats.flagged_answers}</span>
              </div>
            </div>

            <Card className="border-border/70 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 border-b border-border/50 text-muted-foreground uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-4">Result</th>
                      <th className="p-4 w-1/2">Question Snapshot</th>
                      <th className="p-4">Flagged</th>
                      <th className="p-4">Answered At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {recent_answers.length === 0 ? (
                      <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No questions answered yet.</td></tr>
                    ) : (
                      recent_answers.map((a: any) => (
                        <tr key={a.id} className="hover:bg-muted/10">
                          <td className="p-4">
                            {a.is_correct ? (
                              <CheckCircle className="size-4 text-emerald-500" />
                            ) : (
                              <XCircle className="size-4 text-rose-500" />
                            )}
                          </td>
                          <td className="p-4 font-medium text-foreground truncate max-w-[200px]" title={a.question_text}>
                            {a.question_text}...
                          </td>
                          <td className="p-4">
                            {a.is_flagged && <Flag className="size-3 text-amber-500" />}
                          </td>
                          <td className="p-4 text-muted-foreground">{new Date(a.answered_at).toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

      </div>
    </div>
  )
}
