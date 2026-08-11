"use client"

import { useEffect, useState } from "react"
import { communityAdminApi, adminApi } from "@/lib/api"
import {
  Trophy,
  Medal,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  LayoutGrid,
  List,
  Search,
  CheckCircle2,
  XCircle,
  X,
  Award,
  Sparkles
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const CRITERIA_OPTIONS = [
  { value: "MANUAL", label: "Manual Award Only", desc: "Awarded manually by administrators" },
  { value: "XP", label: "Total XP Milestone", desc: "Triggered when user reaches required XP" },
  { value: "SOLUTIONS", label: "Solutions Contributed", desc: "Triggered by number of approved solutions" },
  { value: "STREAK", label: "Daily Streak", desc: "Triggered by consecutive login/study days" },
  { value: "EXAMS_COMPLETED", label: "Exams Completed", desc: "Triggered by total completed tests" },
  { value: "PERFECT_SCORE", label: "100% Score Count", desc: "Triggered by perfect score count" },
]

export default function AdminBadgesPage() {
  const [badges, setBadges] = useState<any[]>([])
  const [userBadges, setUserBadges] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // UI View States
  const [viewMode, setViewMode] = useState<"table" | "cards">("cards")
  const [searchQuery, setSearchQuery] = useState("")
  const [userSearchQuery, setUserSearchQuery] = useState("")

  // Edit / Create States
  const [isBadgeModalOpen, setIsBadgeModalOpen] = useState(false)
  const [isAwardModalOpen, setIsAwardModalOpen] = useState(false)
  const [editingBadge, setEditingBadge] = useState<any>(null)

  const [badgeForm, setBadgeForm] = useState({
    name: "",
    slug: "",
    description: "",
    criteria_type: "MANUAL",
    criteria_value: 0,
    icon_url: "",
    is_active: true
  })
  const [awardForm, setAwardForm] = useState({ user: "", badge: "" })
  const [isSaving, setIsSaving] = useState(false)

  async function fetchData() {
    setLoading(true)
    try {
      const [resBadges, resUserBadges, resUsers] = await Promise.all([
        communityAdminApi.getBadges(),
        communityAdminApi.getUserBadges(),
        adminApi.getUsers()
      ])

      if (resBadges.ok) {
        const json = await resBadges.json()
        setBadges(Array.isArray(json) ? json : json?.results || [])
      }
      if (resUserBadges.ok) {
        const json = await resUserBadges.json()
        setUserBadges(Array.isArray(json) ? json : json?.results || [])
      }
      if (resUsers.ok) {
        const json = await resUsers.json()
        setUsers(Array.isArray(json) ? json : json?.results || [])
      }
    } catch (err) {
      console.error("Failed to load badges data:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // --- Badge Management ---
  function openCreateBadge() {
    setEditingBadge(null)
    setBadgeForm({
      name: "",
      slug: "",
      description: "",
      criteria_type: "MANUAL",
      criteria_value: 0,
      icon_url: "",
      is_active: true
    })
    setIsBadgeModalOpen(true)
  }

  function openEditBadge(badge: any) {
    setEditingBadge(badge)
    setBadgeForm({
      name: badge.name,
      slug: badge.slug,
      description: badge.description,
      criteria_type: badge.criteria_type,
      criteria_value: badge.criteria_value,
      icon_url: badge.icon_url || "",
      is_active: badge.is_active
    })
    setIsBadgeModalOpen(true)
  }

  async function handleSaveBadge(e: React.FormEvent) {
    e.preventDefault()
    setIsSaving(true)
    try {
      if (editingBadge) {
        await communityAdminApi.updateBadge(editingBadge.id, badgeForm)
      } else {
        await communityAdminApi.createBadge(badgeForm)
      }
      setIsBadgeModalOpen(false)
      fetchData()
    } catch (err) {
      console.error("Failed to save badge:", err)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteBadge(id: number) {
    if (!confirm("Are you sure you want to delete this badge?")) return
    try {
      await communityAdminApi.deleteBadge(id)
      fetchData()
    } catch (err) {
      console.error("Failed to delete badge:", err)
    }
  }

  // --- Award Management ---
  async function handleAwardBadge(e: React.FormEvent) {
    e.preventDefault()
    setIsSaving(true)
    try {
      await communityAdminApi.awardBadge(awardForm)
      setIsAwardModalOpen(false)
      fetchData()
    } catch (err) {
      console.error("Failed to award badge:", err)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRevokeBadge(id: number) {
    if (!confirm("Are you sure you want to revoke this badge assignment?")) return
    try {
      await communityAdminApi.removeUserBadge(id)
      fetchData()
    } catch (err) {
      console.error("Failed to revoke badge:", err)
    }
  }

  // Filtered lists
  const filteredBadges = badges.filter(
    (b) =>
      b.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.slug?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredUserBadges = userBadges.filter(
    (ub) =>
      ub.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ub.badge_name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredUsersForAward = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      u.username?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Gamification Badges</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure platform badges, set auto-award criteria, and grant achievements to users.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} className="h-9 gap-1.5 text-xs">
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
          <Button onClick={openCreateBadge} size="sm" className="h-9 gap-1.5 text-xs">
            <Plus className="size-3.5" /> Create Badge
          </Button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border border-border/70 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Badges</span>
            <Trophy className="size-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{badges.length}</p>
        </Card>

        <Card className="border border-border/70 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Active Badges</span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{badges.filter((b) => b.is_active).length}</p>
        </Card>

        <Card className="border border-border/70 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Awarded Count</span>
            <Medal className="size-4 text-purple-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{userBadges.length}</p>
        </Card>

        <Card className="border border-border/70 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">System Users</span>
            <Award className="size-4 text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{users.length}</p>
        </Card>
      </div>

      {/* Tabs & View Controls */}
      <Tabs defaultValue="badges" className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <TabsList>
            <TabsTrigger value="badges" className="gap-2 text-xs">
              <Trophy className="size-4" /> Badge Definitions ({filteredBadges.length})
            </TabsTrigger>
            <TabsTrigger value="awarded" className="gap-2 text-xs">
              <Medal className="size-4" /> Awarded Badges ({filteredUserBadges.length})
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search badges or users..."
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

            {/* View Switcher Toggle */}
            <div className="border border-border/70 rounded-lg p-0.5 flex bg-card shrink-0">
              <button
                onClick={() => setViewMode("cards")}
                className={`p-1.5 rounded-md text-xs transition-colors ${viewMode === "cards" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                title="Grid Cards View"
              >
                <LayoutGrid className="size-3.5" />
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-md text-xs transition-colors ${viewMode === "table" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                title="Table View"
              >
                <List className="size-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* BADGES DEFINITIONS TAB */}
        <TabsContent value="badges">
          {loading ? (
            <div className="p-12 text-center text-xs text-muted-foreground bg-card border border-border/70 rounded-xl">
              Loading Badges...
            </div>
          ) : filteredBadges.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted-foreground bg-card border border-border/70 rounded-xl">
              {searchQuery ? "No badges match your search." : "No badges defined yet."}
            </div>
          ) : viewMode === "cards" ? (
            /* Cards View */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredBadges.map((badge) => (
                <Card
                  key={badge.id}
                  className="border border-border/70 rounded-xl p-5 shadow-sm relative flex flex-col justify-between hover:border-primary/40 transition-all group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="size-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0 shadow-sm">
                        {badge.icon_url ? (
                          <img src={badge.icon_url} alt="" className="size-7 rounded object-cover" />
                        ) : (
                          <Trophy className="size-6" />
                        )}
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          badge.is_active
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-600 border-rose-500/20"
                        }`}
                      >
                        {badge.is_active ? "Active" : "Disabled"}
                      </span>
                    </div>

                    <h3 className="font-bold text-foreground text-sm tracking-tight">{badge.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                      {badge.description || "No description provided."}
                    </p>

                    <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Criteria:</span>
                      <span className="font-mono bg-muted px-2 py-0.5 rounded font-semibold text-foreground">
                        {badge.criteria_type} {badge.criteria_value > 0 ? `(${badge.criteria_value})` : ""}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditBadge(badge)}
                      className="h-7 px-2.5 text-[11px] gap-1"
                    >
                      <Edit2 className="size-3" /> Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteBadge(badge.id)}
                      className="h-7 px-2.5 text-[11px] gap-1 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 hover:text-rose-700 border-0"
                    >
                      <Trash2 className="size-3" /> Delete
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            /* Table View */
            <Card className="border border-border/70 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-4">Badge</th>
                      <th className="p-4">Criteria</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {filteredBadges.map((badge) => (
                      <tr key={badge.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-4 font-semibold text-foreground">
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
                              {badge.icon_url ? (
                                <img src={badge.icon_url} alt="" className="size-5 rounded" />
                              ) : (
                                <Trophy className="size-4" />
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-foreground">{badge.name}</div>
                              <div className="text-[11px] text-muted-foreground font-normal line-clamp-1">
                                {badge.description}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="font-mono bg-muted px-2 py-0.5 rounded text-[10px] font-medium">
                            {badge.criteria_type}
                          </span>
                          {badge.criteria_value > 0 && (
                            <span className="ml-1.5 text-muted-foreground font-semibold">
                              ({badge.criteria_value})
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              badge.is_active
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                : "bg-rose-500/10 text-rose-600 border-rose-500/20"
                            }`}
                          >
                            {badge.is_active ? "Active" : "Disabled"}
                          </span>
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditBadge(badge)}
                            className="h-7 px-2 text-[11px] gap-1"
                          >
                            <Edit2 className="size-3" /> Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteBadge(badge.id)}
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
            </Card>
          )}
        </TabsContent>

        {/* AWARDED BADGES TAB */}
        <TabsContent value="awarded">
          <Card className="border border-border/70 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border/60 flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Assigned Community Achievements</span>
              <Button
                onClick={() => {
                  setAwardForm({ user: "", badge: "" })
                  setUserSearchQuery("")
                  setIsAwardModalOpen(true)
                }}
                size="sm"
                className="h-8 gap-1.5 text-xs"
              >
                <Medal className="size-3.5" /> Award Badge to User
              </Button>
            </div>
            {loading ? (
              <div className="p-12 text-center text-xs text-muted-foreground">Loading Awarded Badges...</div>
            ) : filteredUserBadges.length === 0 ? (
              <div className="p-12 text-center text-xs text-muted-foreground">
                {searchQuery ? "No awarded badges match your search." : "No badges awarded yet."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-4">User</th>
                      <th className="p-4">Badge Granted</th>
                      <th className="p-4">Awarded Date</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {filteredUserBadges.map((ub) => (
                      <tr key={ub.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-4 font-semibold text-foreground">
                          <div className="flex items-center gap-2">
                            <div className="size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase">
                              {ub.username?.[0] || "U"}
                            </div>
                            <span>{ub.username}</span>
                          </div>
                        </td>
                        <td className="p-4 font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            <Trophy className="size-3.5 text-amber-500" />
                            <span>{ub.badge_name}</span>
                          </div>
                        </td>
                        <td className="p-4 text-muted-foreground">
                          {ub.awarded_at ? new Date(ub.awarded_at).toLocaleDateString() : "N/A"}
                        </td>
                        <td className="p-4 text-right">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRevokeBadge(ub.id)}
                            className="h-7 px-2.5 text-[11px] gap-1 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 hover:text-rose-700 border-0"
                          >
                            <Trash2 className="size-3" /> Revoke
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

      {/* Create / Edit Badge Modal */}
      {isBadgeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <Card className="w-full max-w-lg p-6 border-border shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border/50 pb-4 mb-4">
              <h2 className="text-lg font-bold text-foreground">
                {editingBadge ? "Edit Badge" : "Create New Badge"}
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setIsBadgeModalOpen(false)} className="size-8">
                <X className="size-4" />
              </Button>
            </div>

            <form onSubmit={handleSaveBadge} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-foreground mb-1 block">Badge Name</label>
                <input
                  type="text"
                  placeholder="e.g. Master Contributor"
                  value={badgeForm.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const val = e.target.value
                    setBadgeForm({
                      ...badgeForm,
                      name: val,
                      slug: editingBadge ? badgeForm.slug : val.toLowerCase().replace(/[^a-z0-9]+/g, "-")
                    })
                  }}
                  className="w-full rounded-md border border-border bg-card px-3 h-9 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-foreground mb-1 block">Slug Identifier</label>
                <input
                  type="text"
                  placeholder="master-contributor"
                  value={badgeForm.slug}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBadgeForm({ ...badgeForm, slug: e.target.value })}
                  className="w-full rounded-md border border-border bg-card px-3 h-9 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-foreground mb-1 block">Description</label>
                <textarea
                  value={badgeForm.description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBadgeForm({ ...badgeForm, description: e.target.value })}
                  placeholder="Explain how users earn this achievement..."
                  className="w-full p-2.5 text-xs border border-border rounded-md bg-card text-foreground focus:ring-1 focus:ring-primary outline-none shadow-sm"
                  rows={3}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-foreground mb-1 block">Criteria Type</label>
                  <select
                    value={badgeForm.criteria_type}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBadgeForm({ ...badgeForm, criteria_type: e.target.value })}
                    className="w-full p-2 text-xs border border-border rounded-md bg-card text-foreground h-9 shadow-sm"
                  >
                    {CRITERIA_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-foreground mb-1 block">Criteria Threshold Value</label>
                  <input
                    type="number"
                    value={badgeForm.criteria_value}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBadgeForm({ ...badgeForm, criteria_value: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-md border border-border bg-card px-3 h-9 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-foreground mb-1 block">Icon Image URL (Optional)</label>
                <input
                  type="text"
                  placeholder="https://example.com/badge-icon.png"
                  value={badgeForm.icon_url}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBadgeForm({ ...badgeForm, icon_url: e.target.value })}
                  className="w-full rounded-md border border-border bg-card px-3 h-9 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={badgeForm.is_active}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBadgeForm({ ...badgeForm, is_active: e.target.checked })}
                  className="rounded border-border"
                />
                <label htmlFor="isActive" className="text-xs font-semibold text-foreground cursor-pointer">
                  Enable badge for auto-assignment
                </label>
              </div>

              <div className="pt-4 border-t border-border/50 flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsBadgeModalOpen(false)} disabled={isSaving}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save Badge"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Award Badge Modal */}
      {isAwardModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md p-6 border-border shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border/50 pb-4 mb-4">
              <h2 className="text-lg font-bold text-foreground">Award Badge to User</h2>
              <Button variant="ghost" size="icon" onClick={() => setIsAwardModalOpen(false)} className="size-8">
                <X className="size-4" />
              </Button>
            </div>

            <form onSubmit={handleAwardBadge} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-foreground mb-1 block">Filter & Select User</label>
                <input
                  type="text"
                  placeholder="Filter users..."
                  value={userSearchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUserSearchQuery(e.target.value)}
                  className="w-full rounded-md border border-border bg-card px-3 h-8 mb-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                />
                <select
                  value={awardForm.user}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAwardForm({ ...awardForm, user: e.target.value })}
                  className="w-full p-2 text-xs border border-border rounded-md bg-card text-foreground h-9 shadow-sm"
                  required
                >
                  <option value="">-- Choose User ({filteredUsersForAward.length}) --</option>
                  {filteredUsersForAward.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.username} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-foreground mb-1 block">Select Badge</label>
                <select
                  value={awardForm.badge}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAwardForm({ ...awardForm, badge: e.target.value })}
                  className="w-full p-2 text-xs border border-border rounded-md bg-card text-foreground h-9 shadow-sm"
                  required
                >
                  <option value="">-- Choose Badge --</option>
                  {badges.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.criteria_type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 border-t border-border/50 flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsAwardModalOpen(false)} disabled={isSaving}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isSaving}>
                  {isSaving ? "Awarding..." : "Award Badge"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
