"use client"

import { useEffect, useState } from "react"
import { jobsAdminApi } from "@/lib/api"
import { Activity, RefreshCw, XCircle, Clock, CheckCircle, AlertCircle } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchJobs(isPolling = false) {
    if (!isPolling) setLoading(true)
    try {
      const res = await jobsAdminApi.getJobs()
      if (res.ok) {
        const json = await res.json()
        setJobs(Array.isArray(json) ? json : json?.results || [])
      }
    } catch (err) {
      console.error("Failed to load jobs data:", err)
    } finally {
      if (!isPolling) setLoading(false)
    }
  }

  useEffect(() => {
    fetchJobs()
    const interval = setInterval(() => {
      fetchJobs(true)
    }, 3000) // Poll every 3 seconds
    return () => clearInterval(interval)
  }, [])

  async function handleCancelJob(id: string) {
    if (!confirm("Are you sure you want to cancel this background job?")) return
    try {
      await jobsAdminApi.cancelJob(id)
      fetchJobs()
    } catch (err) {
      console.error("Failed to cancel job:", err)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle className="size-4 text-emerald-500" />
      case 'FAILED': return <AlertCircle className="size-4 text-rose-500" />
      case 'RUNNING': return <Activity className="size-4 text-blue-500 animate-pulse" />
      case 'QUEUED': return <Clock className="size-4 text-amber-500" />
      case 'CANCELLED': return <XCircle className="size-4 text-muted-foreground" />
      default: return <Activity className="size-4" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
      case 'FAILED': return 'bg-rose-500/10 text-rose-600 border-rose-500/20'
      case 'RUNNING': return 'bg-blue-500/10 text-blue-600 border-blue-500/20'
      case 'QUEUED': return 'bg-amber-500/10 text-amber-600 border-amber-500/20'
      case 'CANCELLED': return 'bg-muted text-muted-foreground border-border/50'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">System Background Jobs</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Monitor and manage Celery tasks (AI generation, stats calculation, etc).</p>
        </div>

        <Button variant="outline" size="sm" onClick={() => fetchJobs()} className="h-9 gap-1.5 text-xs">
          <RefreshCw className="size-3.5" /> Refresh
        </Button>
      </div>

      <Card className="border border-border/70 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-xs text-muted-foreground">Loading Jobs...</div>
        ) : jobs.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground">No background jobs found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-4 w-[250px]">Job ID & Type</th>
                  <th className="p-4">Status & Stage</th>
                  <th className="p-4 w-[200px]">Progress</th>
                  <th className="p-4">Started / Updated</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-4 font-semibold text-foreground">
                      <div className="font-mono text-[10px] text-muted-foreground mb-1">{job.id.substring(0, 8)}...</div>
                      <div>{job.type}</div>
                      {job.username && <div className="text-[10px] text-muted-foreground mt-1 font-normal">by {job.username}</div>}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        {getStatusIcon(job.status)}
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getStatusBadge(job.status)}`}>
                          {job.status}
                        </span>
                      </div>
                      {job.stage && <div className="text-[11px] text-muted-foreground">Stage: {job.stage}</div>}
                    </td>
                    <td className="p-4">
                      <div className="w-full bg-muted rounded-full h-2.5 mb-1 dark:bg-muted/50 overflow-hidden">
                        <div 
                          className={`h-2.5 rounded-full transition-all duration-500 ease-in-out ${job.status === 'FAILED' ? 'bg-rose-500' : 'bg-primary'}`}
                          style={{ width: `${Math.min(Math.max(job.progress || 0, 0), 100)}%` }}
                        ></div>
                      </div>
                      <div className="text-[10px] text-muted-foreground text-right">{job.progress || 0}%</div>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      <div>{job.started_at ? new Date(job.started_at).toLocaleString() : 'Not started'}</div>
                      <div className="text-[10px] mt-1">Updated: {new Date(job.updated_at).toLocaleTimeString()}</div>
                    </td>
                    <td className="p-4 text-right space-x-1">
                      {['QUEUED', 'RUNNING'].includes(job.status) && (
                        <Button variant="destructive" size="sm" onClick={() => handleCancelJob(job.id)} className="h-7 px-2 text-[11px] gap-1 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 hover:text-rose-700 border-0">
                          <XCircle className="size-3" /> Cancel
                        </Button>
                      )}
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
