"use client"

import { useEffect, useState } from "react"
import { adminApi } from "@/lib/api"
import {
  Users,
  FileText,
  HelpCircle,
  CheckCircle2,
  Newspaper,
  AlertTriangle,
  ArrowUpRight,
  RefreshCw,
  Plus,
  Sparkles,
  Activity,
  Clock,
  MessageSquare
} from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function AdminDashboardPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  async function fetchStats() {
    setLoading(true)
    try {
      const res = await adminApi.getStats()
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (err) {
      console.error("Failed to load admin stats:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-muted-foreground font-medium">Loading Dashboard Metrics...</p>
      </div>
    )
  }

  const stats = data?.stats || data || {}
  const recentAttempts = data?.recent_attempts || []
  const recentUsers = data?.recent_users || []

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Admin Overview</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Real-time system statistics and platform activity.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchStats} className="h-9 gap-1.5 text-xs">
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
          <Link href="/admin/ai-tools">
            <Button size="sm" className="h-9 gap-1.5 text-xs">
              <Sparkles className="size-3.5" />
              AI PDF Generator
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {[
          { label: "Active Users", value: stats.active_users ?? 0, icon: Activity },
          { label: "Pending Jobs", value: stats.pending_jobs ?? 0, icon: Clock },
          { label: "New Solutions", value: stats.new_solutions_today ?? 0, icon: MessageSquare },
          { label: "Total Users", value: stats.total_users ?? 0, icon: Users },
          { label: "Total Exams", value: stats.total_exams ?? 0, icon: FileText },
          { label: "Questions", value: stats.total_questions ?? 0, icon: HelpCircle },
          { label: "Completed Tests", value: stats.total_attempts ?? 0, icon: CheckCircle2 },
          { label: "Current Affairs", value: stats.active_current_affairs ?? 0, icon: Newspaper },
          { label: "Pending Issues", value: stats.pending_suggestions ?? 0, icon: AlertTriangle },
        ].map((item, idx) => {
          const Icon = item.icon
          return (
            <Card key={idx} className="border border-border/70 bg-card shadow-sm rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{item.label}</span>
                <Icon className="size-4 text-foreground dark:text-white shrink-0" />
              </div>
              <div className="mt-2 text-2xl font-bold text-foreground tracking-tight">{item.value}</div>
            </Card>
          )
        })}
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Attempts */}
        <Card className="border border-border/70 shadow-sm rounded-xl">
          <CardHeader className="border-b border-border/50 px-6 py-4">
            <CardTitle className="text-base font-semibold text-foreground">Recent Submissions</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">Latest test attempts by candidates.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {recentAttempts.length === 0 ? (
              <p className="p-6 text-center text-xs text-muted-foreground">No recent attempts found.</p>
            ) : (
              <div className="divide-y divide-border/50 text-xs">
                {recentAttempts.map((att: any) => (
                  <div key={att.id} className="p-4 flex items-center justify-between hover:bg-muted/20 transition-colors">
                    <div>
                      <p className="font-semibold text-foreground">{att.exam_title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{att.user}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-foreground">{att.score} pts</span>
                      <p className="text-[10px] text-muted-foreground">{att.accuracy}% accuracy</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Users */}
        <Card className="border border-border/70 shadow-sm rounded-xl">
          <CardHeader className="border-b border-border/50 px-6 py-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-foreground">New Registrations</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">Recently registered user accounts.</CardDescription>
            </div>
            <Link href="/admin/users" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
              View All <ArrowUpRight className="size-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {recentUsers.length === 0 ? (
              <p className="p-6 text-center text-xs text-muted-foreground">No users found.</p>
            ) : (
              <div className="divide-y divide-border/50 text-xs">
                {recentUsers.map((u: any) => (
                  <div key={u.id} className="p-4 flex items-center justify-between hover:bg-muted/20 transition-colors">
                    <div>
                      <p className="font-semibold text-foreground">{u.name}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{u.email}</p>
                    </div>
                    <div>
                      {u.is_staff ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                          Staff
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                          Candidate
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
