"use client"

import { useEffect, useState } from "react"
import { communityAdminApi } from "@/lib/api"
import {
  MessageSquare,
  FileText,
  Trash2,
  RefreshCw,
  Search,
  Sparkles,
  ThumbsUp,
  Eye,
  X,
  ExternalLink,
  Activity,
  Bell,
  Plus
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function AdminCommunityPage() {
  const [solutions, setSolutions] = useState<any[]>([])
  const [comments, setComments] = useState<any[]>([])
  const [activities, setActivities] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false)
  const [notifData, setNotifData] = useState({ user_id: "", title: "", message: "", type: "SYSTEM" })
  const [sendingNotif, setSendingNotif] = useState(false)

  const [viewingItem, setViewingItem] = useState<{
    title: string
    username: string
    content: string
    date: string
    type: "solution" | "comment" | "activity" | "notification"
    isAi?: boolean
    stats?: { upvotes: number; views?: number }
  } | null>(null)

  async function fetchData() {
    setLoading(true)
    try {
      const [resSol, resCom, resAct, resNot] = await Promise.all([
        communityAdminApi.getSolutions(),
        communityAdminApi.getComments(),
        communityAdminApi.getActivities(),
        communityAdminApi.getNotifications()
      ])
      
      if (resSol.ok) {
        const json = await resSol.json()
        setSolutions(Array.isArray(json) ? json : json?.results || [])
      }
      if (resCom.ok) {
        const json = await resCom.json()
        setComments(Array.isArray(json) ? json : json?.results || [])
      }
      if (resAct.ok) {
        const json = await resAct.json()
        setActivities(Array.isArray(json) ? json : json?.results || [])
      }
      if (resNot.ok) {
        const json = await resNot.json()
        setNotifications(Array.isArray(json) ? json : json?.results || [])
      }
    } catch (err) {
      console.error("Failed to load community data:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  async function handleDeleteSolution(id: number) {
    if (!confirm("Are you sure you want to delete this solution?")) return
    try {
      await communityAdminApi.deleteSolution(id)
      fetchData()
    } catch (err) {
      console.error("Failed to delete solution:", err)
    }
  }

  async function handleDeleteNotification(id: number) {
    if (!confirm("Are you sure you want to delete this notification?")) return
    try {
      await communityAdminApi.deleteNotification(id)
      fetchData()
    } catch (err) {
      console.error("Failed to delete notification:", err)
    }
  }

  async function handleSendNotification(e: React.FormEvent) {
    e.preventDefault()
    if (!notifData.user_id || !notifData.title || !notifData.message) return
    setSendingNotif(true)
    try {
      await communityAdminApi.createNotification({
        user: parseInt(notifData.user_id),
        title: notifData.title,
        message: notifData.message,
        type: notifData.type
      })
      setIsNotifModalOpen(false)
      setNotifData({ user_id: "", title: "", message: "", type: "SYSTEM" })
      fetchData()
    } catch (err) {
      console.error("Failed to send notification:", err)
    } finally {
      setSendingNotif(false)
    }
  }

  // Filtered Lists
  const filteredSolutions = solutions.filter((sol) => {
    const q = searchQuery.toLowerCase()
    return (
      sol.username?.toLowerCase().includes(q) ||
      sol.content?.toLowerCase().includes(q) ||
      sol.question_text?.toLowerCase().includes(q)
    )
  })

  const filteredComments = comments.filter((comment) => {
    const q = searchQuery.toLowerCase()
    return (
      comment.username?.toLowerCase().includes(q) ||
      comment.text?.toLowerCase().includes(q) ||
      comment.question_text?.toLowerCase().includes(q)
    )
  })

  const filteredActivities = activities.filter((act) => {
    const q = searchQuery.toLowerCase()
    return (
      act.username?.toLowerCase().includes(q) ||
      act.activity_type?.toLowerCase().includes(q) ||
      act.description?.toLowerCase().includes(q)
    )
  })

  const filteredNotifications = notifications.filter((notif) => {
    const q = searchQuery.toLowerCase()
    return (
      notif.username?.toLowerCase().includes(q) ||
      notif.title?.toLowerCase().includes(q) ||
      notif.message?.toLowerCase().includes(q)
    )
  })

  // Metrics
  const aiSolutionsCount = solutions.filter((s) => s.is_ai_generated).length
  const totalUpvotes = solutions.reduce((acc, s) => acc + (s.upvotes || 0), 0) + comments.reduce((acc, c) => acc + (c.upvotes || 0), 0)

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Community Moderation</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Audit and moderate user solutions, discussions, comments, activity logs, and notifications.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} className="h-9 gap-1.5 text-xs">
            <RefreshCw className="size-3.5 shrink-0" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setIsNotifModalOpen(true)} className="h-9 gap-1.5 text-xs bg-primary text-primary-foreground">
            <Plus className="size-3.5 shrink-0" /> Send Notification
          </Button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border border-border/70 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate">Solutions</span>
            <FileText className="size-4 text-blue-500 shrink-0" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{solutions.length}</p>
        </Card>

        <Card className="border border-border/70 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate">Comments</span>
            <MessageSquare className="size-4 text-purple-500 shrink-0" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{comments.length}</p>
        </Card>

        <Card className="border border-border/70 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate">Activities</span>
            <Activity className="size-4 text-emerald-500 shrink-0" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{activities.length}</p>
        </Card>

        <Card className="border border-border/70 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate">Notifications</span>
            <Bell className="size-4 text-amber-500 shrink-0" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{notifications.length}</p>
        </Card>
      </div>

      {/* Main Content Tabs & Filter Bar */}
      <Tabs defaultValue="solutions" className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="max-w-full overflow-x-auto scrollbar-hide pb-1">
            <TabsList>
              <TabsTrigger value="solutions" className="gap-2 text-xs shrink-0 whitespace-nowrap">
                <FileText className="size-4" /> Solutions ({filteredSolutions.length})
              </TabsTrigger>
              <TabsTrigger value="comments" className="gap-2 text-xs shrink-0 whitespace-nowrap">
                <MessageSquare className="size-4" /> Comments ({filteredComments.length})
              </TabsTrigger>
              <TabsTrigger value="activities" className="gap-2 text-xs shrink-0 whitespace-nowrap">
                <Activity className="size-4" /> Activity Log ({filteredActivities.length})
              </TabsTrigger>
              <TabsTrigger value="notifications" className="gap-2 text-xs shrink-0 whitespace-nowrap">
                <Bell className="size-4" /> Notifications ({filteredNotifications.length})
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Search Filter */}
          <div className="relative w-full sm:w-72">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search user, text or question..."
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 w-full rounded-md border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>

        {/* SOLUTIONS TAB */}
        <TabsContent value="solutions">
          <Card className="border border-border/70 rounded-xl overflow-hidden shadow-sm">
            {loading ? (
              <div className="p-12 text-center text-xs text-muted-foreground">Loading Solutions...</div>
            ) : filteredSolutions.length === 0 ? (
              <div className="p-12 text-center text-xs text-muted-foreground">
                {searchQuery ? "No solutions match your search." : "No solutions found."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-4">User</th>
                      <th className="p-4">Question</th>
                      <th className="p-4">Content Preview</th>
                      <th className="p-4">Engagement</th>
                      <th className="p-4">Date</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {filteredSolutions.map((sol) => (
                      <tr key={sol.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-4 font-semibold text-foreground">
                          <div className="flex items-center gap-2">
                            <div className="size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase">
                              {sol.username?.[0] || "U"}
                            </div>
                            <span>{sol.username}</span>
                          </div>
                        </td>
                        <td className="p-4 max-w-[200px] truncate font-medium" title={sol.question_text}>
                          {sol.question_text || `Question #${sol.question}`}
                        </td>
                        <td className="p-4 max-w-[320px]">
                          <div className="line-clamp-2 text-muted-foreground leading-relaxed" title={sol.content}>
                            {sol.content}
                          </div>
                          {sol.is_ai_generated && (
                            <span className="mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[9px] rounded font-bold">
                              <Sparkles className="size-2.5" /> AI Generated
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                              <ThumbsUp className="size-3" /> {sol.upvotes || 0}
                            </span>
                            <span className="flex items-center gap-1 text-muted-foreground text-[11px]">
                              <Eye className="size-3" /> {sol.views || 0}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-muted-foreground">
                          {sol.created_at ? new Date(sol.created_at).toLocaleDateString() : "N/A"}
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setViewingItem({
                                title: sol.question_text || `Question #${sol.question}`,
                                username: sol.username,
                                content: sol.content,
                                date: sol.created_at,
                                type: "solution",
                                isAi: sol.is_ai_generated,
                                stats: { upvotes: sol.upvotes, views: sol.views }
                              })
                            }
                            className="h-7 px-2 text-[11px] gap-1"
                          >
                            <ExternalLink className="size-3" /> Inspect
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteSolution(sol.id)}
                            className="h-7 px-2 text-[11px] gap-1 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 hover:text-rose-700 border-0"
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
        </TabsContent>

        {/* COMMENTS TAB */}
        <TabsContent value="comments">
          <Card className="border border-border/70 rounded-xl overflow-hidden shadow-sm">
            {loading ? (
              <div className="p-12 text-center text-xs text-muted-foreground">Loading Comments...</div>
            ) : filteredComments.length === 0 ? (
              <div className="p-12 text-center text-xs text-muted-foreground">
                {searchQuery ? "No comments match your search." : "No comments found."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-4">User</th>
                      <th className="p-4">Location / Context</th>
                      <th className="p-4">Comment Body</th>
                      <th className="p-4">Upvotes</th>
                      <th className="p-4">Date</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {filteredComments.map((comment) => (
                      <tr key={comment.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-4 font-semibold text-foreground">
                          <div className="flex items-center gap-2">
                            <div className="size-7 rounded-full bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold text-xs uppercase">
                              {comment.username?.[0] || "U"}
                            </div>
                            <span>{comment.username}</span>
                          </div>
                        </td>
                        <td className="p-4 max-w-[200px] truncate font-medium text-muted-foreground" title={comment.question_text}>
                          {comment.solution ? `Solution #${comment.solution}` : comment.question_text || `Q#${comment.question}`}
                        </td>
                        <td className="p-4 max-w-[320px]">
                          <div className="line-clamp-2 text-foreground" title={comment.text}>
                            {comment.text}
                          </div>
                        </td>
                        <td className="p-4 text-emerald-600 font-semibold flex items-center gap-1 text-[11px]">
                          <ThumbsUp className="size-3" /> {comment.upvotes || 0}
                        </td>
                        <td className="p-4 text-muted-foreground">
                          {comment.created_at ? new Date(comment.created_at).toLocaleDateString() : "N/A"}
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setViewingItem({
                                title: comment.question_text || `Solution #${comment.solution || comment.question}`,
                                username: comment.username,
                                content: comment.text,
                                date: comment.created_at,
                                type: "comment",
                                stats: { upvotes: comment.upvotes }
                              })
                            }
                            className="h-7 px-2 text-[11px] gap-1"
                          >
                            <ExternalLink className="size-3" /> Inspect
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteComment(comment.id)}
                            className="h-7 px-2 text-[11px] gap-1 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 hover:text-rose-700 border-0"
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
        </TabsContent>

        {/* ACTIVITIES TAB */}
        <TabsContent value="activities">
          <Card className="border border-border/70 rounded-xl overflow-hidden shadow-sm">
            {loading ? (
              <div className="p-12 text-center text-xs text-muted-foreground">Loading Activities...</div>
            ) : filteredActivities.length === 0 ? (
              <div className="p-12 text-center text-xs text-muted-foreground">
                {searchQuery ? "No activities match your search." : "No contributor activities logged yet."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-4">User</th>
                      <th className="p-4">Activity Type</th>
                      <th className="p-4">Description</th>
                      <th className="p-4">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {filteredActivities.map((act) => (
                      <tr key={act.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-4 font-semibold text-foreground">
                          <div className="flex items-center gap-2">
                            <div className="size-7 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-xs uppercase">
                              {act.username?.[0] || "U"}
                            </div>
                            <span>{act.username}</span>
                          </div>
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono text-[10px] font-bold">
                            {act.activity_type}
                          </span>
                        </td>
                        <td className="p-4 text-foreground font-medium">
                          {act.description}
                        </td>
                        <td className="p-4 text-muted-foreground whitespace-nowrap">
                          {act.created_at ? new Date(act.created_at).toLocaleString() : "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* NOTIFICATIONS TAB */}
        <TabsContent value="notifications">
          <Card className="border border-border/70 rounded-xl overflow-hidden shadow-sm">
            {loading ? (
              <div className="p-12 text-center text-xs text-muted-foreground">Loading Notifications...</div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-12 text-center text-xs text-muted-foreground">
                {searchQuery ? "No notifications match your search." : "No notifications sent yet."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-4">User</th>
                      <th className="p-4">Type</th>
                      <th className="p-4">Title</th>
                      <th className="p-4">Message</th>
                      <th className="p-4">Read Status</th>
                      <th className="p-4">Sent Date</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {filteredNotifications.map((notif) => (
                      <tr key={notif.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-4 font-semibold text-foreground">
                          <div className="flex items-center gap-2">
                            <div className="size-7 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-xs uppercase">
                              {notif.username?.[0] || "U"}
                            </div>
                            <span>{notif.username}</span>
                          </div>
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-muted text-foreground font-mono text-[10px] font-bold">
                            {notif.type}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-foreground">
                          {notif.title}
                        </td>
                        <td className="p-4 max-w-[260px] truncate text-muted-foreground" title={notif.message}>
                          {notif.message}
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${notif.is_read ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                            {notif.is_read ? "Read" : "Unread"}
                          </span>
                        </td>
                        <td className="p-4 text-muted-foreground whitespace-nowrap">
                          {notif.created_at ? new Date(notif.created_at).toLocaleString() : "N/A"}
                        </td>
                        <td className="p-4 text-right space-x-2 whitespace-nowrap">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteNotification(notif.id)}
                            className="h-7 px-2 text-[11px] gap-1 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 hover:text-rose-700 border-0"
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
        </TabsContent>
      </Tabs>

      {/* Send Notification Modal */}
      {isNotifModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md border-border/80 shadow-2xl animate-in fade-in zoom-in-95 duration-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <Bell className="size-4 text-primary" /> Send User Notification
              </h3>
              <button onClick={() => setIsNotifModalOpen(false)}>
                <X className="size-4 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
            <form onSubmit={handleSendNotification} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium mb-1">Target User ID</label>
                <input
                  type="number"
                  required
                  placeholder="Enter User ID (e.g. 1)"
                  value={notifData.user_id}
                  onChange={(e) => setNotifData({ ...notifData, user_id: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Notification Type</label>
                <select
                  value={notifData.type}
                  onChange={(e) => setNotifData({ ...notifData, type: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="SYSTEM">System Notification</option>
                  <option value="BADGE">Badge Awarded</option>
                  <option value="SOLUTION">Solution Alert</option>
                  <option value="STREAK">Streak Alert</option>
                </select>
              </div>

              <div>
                <label className="block font-medium mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="Notification title..."
                  value={notifData.title}
                  onChange={(e) => setNotifData({ ...notifData, title: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Message</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Notification message body..."
                  value={notifData.message}
                  onChange={(e) => setNotifData({ ...notifData, message: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsNotifModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={sendingNotif}>
                  {sendingNotif ? "Sending..." : "Send Notification"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Content Inspection Modal */}
      {viewingItem && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-xl border-border/80 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-4 border-b border-border/50 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 bg-primary/10 text-primary rounded font-bold">
                      {viewingItem.type}
                    </span>
                    {viewingItem.isAi && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded">
                        AI Generated
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-foreground mt-2">{viewingItem.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Posted by <span className="font-semibold text-foreground">{viewingItem.username}</span> on{" "}
                    {viewingItem.date ? new Date(viewingItem.date).toLocaleString() : "N/A"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setViewingItem(null)}
                  className="size-8 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </Button>
              </div>

              <div className="max-h-[350px] overflow-y-auto p-4 bg-muted/30 rounded-xl border border-border/50 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                {viewingItem.content}
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
                  <span className="flex items-center gap-1 text-emerald-600 font-bold">
                    <ThumbsUp className="size-3.5" /> {viewingItem.stats?.upvotes || 0} Upvotes
                  </span>
                  {viewingItem.stats?.views !== undefined && (
                    <span className="flex items-center gap-1">
                      <Eye className="size-3.5" /> {viewingItem.stats.views} Views
                    </span>
                  )}
                </div>
                <Button onClick={() => setViewingItem(null)} variant="secondary" size="sm" className="h-8 text-xs px-4">
                  Close
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
