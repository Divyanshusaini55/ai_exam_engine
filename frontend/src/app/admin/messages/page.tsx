"use client"

import { useEffect, useState } from "react"
import { adminApi } from "@/lib/api"
import {
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Mail,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  HelpCircle,
  User as UserIcon,
  X,
  Copy,
  Check
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function AdminMessagesPage() {
  const [activeTab, setActiveTab] = useState<"messages" | "suggestions">("messages")
  const [messages, setMessages] = useState<any[]>([])
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [copiedId, setCopiedId] = useState<number | null>(null)

  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<number[]>([])
  const [bulkLoading, setBulkLoading] = useState(false)

  async function fetchData() {
    setLoading(true)
    try {
      const [resMsg, resSugg] = await Promise.all([
        adminApi.getContactMessages(),
        adminApi.getSuggestions()
      ])
      if (resMsg.ok) {
        const jsonMsg = await resMsg.json()
        setMessages(Array.isArray(jsonMsg) ? jsonMsg : jsonMsg?.results || [])
      }
      if (resSugg.ok) {
        const jsonSugg = await resSugg.json()
        setSuggestions(Array.isArray(jsonSugg) ? jsonSugg : jsonSugg?.results || [])
      }
    } catch (err) {
      console.error("Failed to load messages:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Filtered Contact Messages
  const filteredMessages = messages.filter((m) => {
    const q = searchQuery.toLowerCase()
    const matchesSearch =
      m.name?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q) ||
      m.message?.toLowerCase().includes(q)

    if (!matchesSearch) return false

    if (statusFilter === "pending") return !m.is_resolved
    if (statusFilter === "resolved") return m.is_resolved
    return true
  })

  // Filtered Suggestions
  const filteredSuggestions = suggestions.filter((s) => {
    const q = searchQuery.toLowerCase()
    const matchesSearch =
      s.user_email?.toLowerCase().includes(q) ||
      s.suggestion_text?.toLowerCase().includes(q) ||
      String(s.question).includes(q)

    if (!matchesSearch) return false

    if (statusFilter !== "all" && s.status !== statusFilter) return false
    return true
  })

  // Metrics
  const unresolvedMsgs = messages.filter((m) => !m.is_resolved).length
  const pendingSuggestions = suggestions.filter((s) => s.status === "pending").length
  const acceptedSuggestions = suggestions.filter((s) => s.status === "accepted").length

  function toggleSelectAllSuggestions() {
    if (selectedSuggestionIds.length === filteredSuggestions.length) {
      setSelectedSuggestionIds([])
    } else {
      setSelectedSuggestionIds(filteredSuggestions.map((s) => s.id))
    }
  }

  function toggleSelectSuggestion(id: number) {
    if (selectedSuggestionIds.includes(id)) {
      setSelectedSuggestionIds(selectedSuggestionIds.filter((i) => i !== id))
    } else {
      setSelectedSuggestionIds([...selectedSuggestionIds, id])
    }
  }

  async function handleBulkStatus(status: string) {
    if (selectedSuggestionIds.length === 0) return
    setBulkLoading(true)
    try {
      await adminApi.bulkUpdateSuggestionStatus(selectedSuggestionIds, status)
      setSelectedSuggestionIds([])
      fetchData()
    } catch (err) {
      console.error("Bulk status error:", err)
    } finally {
      setBulkLoading(false)
    }
  }

  async function handleToggleResolveMsg(id: number) {
    try {
      await adminApi.toggleMessageResolve(id)
      fetchData()
    } catch (err) {
      console.error("Resolve error:", err)
    }
  }

  async function handleDeleteMsg(id: number) {
    if (!confirm("Are you sure you want to delete this message?")) return
    try {
      await adminApi.deleteContactMessage(id)
      fetchData()
    } catch (err) {
      console.error("Delete error:", err)
    }
  }

  async function handleUpdateSuggestion(id: number, status: string) {
    try {
      await adminApi.updateSuggestionStatus(id, status)
      fetchData()
    } catch (err) {
      console.error("Status update error:", err)
    }
  }

  async function handleDeleteSuggestion(id: number) {
    if (!confirm("Are you sure you want to delete this suggestion?")) return
    try {
      await adminApi.deleteSuggestion(id)
      fetchData()
    } catch (err) {
      console.error("Delete error:", err)
    }
  }

  function handleCopyEmail(email: string, id: number) {
    navigator.clipboard.writeText(email)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Messages & Question Bugs</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review user support requests, contact inquiries, and reported question corrections.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={fetchData} className="h-9 gap-1.5 text-xs">
          <RefreshCw className="size-3.5" /> Refresh
        </Button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border border-border/70 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Unresolved Messages
            </span>
            <Mail className="size-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{unresolvedMsgs}</p>
        </Card>

        <Card className="border border-border/70 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Pending Bug Fixes
            </span>
            <AlertTriangle className="size-4 text-rose-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{pendingSuggestions}</p>
        </Card>

        <Card className="border border-border/70 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Accepted Corrections
            </span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{acceptedSuggestions}</p>
        </Card>

        <Card className="border border-border/70 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Total Submissions
            </span>
            <MessageSquare className="size-4 text-indigo-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{messages.length + suggestions.length}</p>
        </Card>
      </div>

      {/* Main Tabs & Search Filter Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-border/60 pb-1">
          <button
            onClick={() => {
              setActiveTab("messages")
              setStatusFilter("all")
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "messages"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
          >
            <Mail className="size-3.5" /> Contact Messages ({messages.length})
          </button>

          <button
            onClick={() => {
              setActiveTab("suggestions")
              setStatusFilter("all")
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "suggestions"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
          >
            <AlertTriangle className="size-3.5" /> Question Bug Reports ({suggestions.length})
          </button>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
            className="h-9 px-3 text-xs border border-border rounded-md bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
          >
            <option value="all">All Statuses</option>
            {activeTab === "messages" ? (
              <>
                <option value="pending">Unresolved Only</option>
                <option value="resolved">Resolved Only</option>
              </>
            ) : (
              <>
                <option value="pending">Pending</option>
                <option value="reviewed">Reviewed</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
              </>
            )}
          </select>

          {/* Live Search */}
          <div className="relative w-full sm:w-64">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search sender, message, question ID..."
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
      </div>

      {/* Content Container */}
      <Card className="border border-border/70 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
            <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Loading records...
          </div>
        ) : activeTab === "messages" ? (
          /* MESSAGES LIST */
          filteredMessages.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted-foreground">
              {searchQuery || statusFilter !== "all"
                ? "No contact messages match your filter criteria."
                : "No contact messages found."}
            </div>
          ) : (
            <div className="divide-y divide-border/50 text-xs">
              {filteredMessages.map((m) => (
                <div key={m.id} className="p-5 hover:bg-muted/15 transition-colors space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase shrink-0">
                        {m.name?.[0] || m.email?.[0] || "U"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground text-sm">{m.name || "Anonymous Sender"}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              m.is_resolved
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                            }`}
                          >
                            {m.is_resolved ? "Resolved" : "Unresolved"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-muted-foreground font-mono text-[11px]">{m.email}</span>
                          <button
                            onClick={() => handleCopyEmail(m.email, m.id)}
                            className="text-muted-foreground hover:text-primary transition-colors"
                            title="Copy Email"
                          >
                            {copiedId === m.id ? (
                              <Check className="size-3 text-emerald-500" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleResolveMsg(m.id)}
                        className={`h-8 px-3 text-xs gap-1.5 transition-colors ${
                          m.is_resolved
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20"
                            : "hover:bg-muted"
                        }`}
                      >
                        <CheckCircle2 className="size-3.5" />
                        {m.is_resolved ? "Resolved" : "Mark Resolved"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteMsg(m.id)}
                        className="size-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                        title="Delete Message"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="p-3.5 bg-muted/30 border border-border/50 rounded-lg text-foreground leading-relaxed whitespace-pre-wrap font-medium">
                    {m.message}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" /> Received: {new Date(m.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* QUESTION SUGGESTIONS / BUGS LIST */
          <div>
            {selectedSuggestionIds.length > 0 && (
              <div className="p-3 bg-primary/10 border-b border-border/50 flex items-center justify-between gap-3 text-xs">
                <span className="font-semibold text-primary">
                  {selectedSuggestionIds.length} suggestion{selectedSuggestionIds.length > 1 ? 's' : ''} selected
                </span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleBulkStatus("accepted")} disabled={bulkLoading} className="h-7 text-[11px] gap-1 text-emerald-600">
                    <CheckCircle className="size-3" /> Approve Selected
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleBulkStatus("rejected")} disabled={bulkLoading} className="h-7 text-[11px] gap-1 text-rose-600">
                    <XCircle className="size-3" /> Reject Selected
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleBulkStatus("reviewed")} disabled={bulkLoading} className="h-7 text-[11px] gap-1 text-sky-600">
                    Mark Reviewed
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedSuggestionIds([])} className="h-7 text-[11px]">
                    Deselect
                  </Button>
                </div>
              </div>
            )}

            {filteredSuggestions.length === 0 ? (
              <div className="p-12 text-center text-xs text-muted-foreground">
                {searchQuery || statusFilter !== "all"
                  ? "No question correction reports match your filter criteria."
                  : "No question correction reports found."}
              </div>
            ) : (
              <div className="divide-y divide-border/50 text-xs">
                {filteredSuggestions.map((s) => (
                  <div key={s.id} className="p-5 hover:bg-muted/15 transition-colors space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedSuggestionIds.includes(s.id)}
                          onChange={() => toggleSelectSuggestion(s.id)}
                          className="mt-1 rounded border-border"
                        />
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground text-sm">Question ID: #{s.question}</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase border ${
                                s.status === "accepted" || s.status === "approved"
                                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                  : s.status === "rejected"
                                  ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                                  : s.status === "reviewed"
                                  ? "bg-sky-500/10 text-sky-600 border-sky-500/20"
                                  : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                              }`}
                            >
                              {s.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Reported by: <span className="font-mono text-foreground">{s.user_email || "Candidate"}</span>
                          </p>
                        </div>
                      </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Status Selector Dropdown */}
                      <select
                        value={s.status}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                          handleUpdateSuggestion(s.id, e.target.value)
                        }
                        className="bg-card border border-border rounded-md px-2.5 py-1.5 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                      >
                        <option value="pending">Pending</option>
                        <option value="reviewed">Reviewed</option>
                        <option value="accepted">Accepted</option>
                        <option value="rejected">Rejected</option>
                      </select>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteSuggestion(s.id)}
                        className="size-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                        title="Delete Bug Report"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="p-3.5 bg-muted/30 border border-border/50 rounded-lg text-foreground leading-relaxed whitespace-pre-wrap font-medium">
                    <span className="text-[11px] font-semibold text-muted-foreground block mb-1">
                      Suggested Correction:
                    </span>
                    {s.suggestion_text}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" /> Submitted: {new Date(s.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      </Card>
    </div>
  )
}
