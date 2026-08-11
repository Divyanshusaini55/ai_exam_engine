"use client"

import { useEffect, useState } from "react"
import { adminApi, communityAdminApi } from "@/lib/api"
import {
  Users,
  Search,
  Shield,
  ShieldAlert,
  UserCheck,
  UserX,
  RefreshCw,
  Trophy,
  Edit2,
  Activity
} from "lucide-react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [profiles, setProfiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  // Modal State
  const [editingProfile, setEditingProfile] = useState<any>(null)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [isSaving, setIsSaving] = useState(false)
  
  // Security Modal State
  const [staffToggleTarget, setStaffToggleTarget] = useState<any>(null)
  const [adminPassword, setAdminPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")

  async function fetchUsers(searchQuery = "") {
    setLoading(true)
    try {
      const [resUsers, resProfiles] = await Promise.all([
        adminApi.getUsers(searchQuery),
        communityAdminApi.getProfiles()
      ])
      
      if (resUsers.ok) {
        const json = await resUsers.json()
        setUsers(Array.isArray(json) ? json : json?.results || [])
      }
      if (resProfiles.ok) {
        const json = await resProfiles.json()
        setProfiles(Array.isArray(json) ? json : json?.results || [])
      }
    } catch (err) {
      console.error("Failed to load users:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers(search)
  }, [search])

  async function handleSaveUser(e: React.FormEvent) {
    e.preventDefault()
    if (!editingUser) return
    setIsSaving(true)
    try {
      await adminApi.updateUser(editingUser.id, {
        first_name: editingUser.first_name || "",
        last_name: editingUser.last_name || "",
        email: editingUser.email || "",
        is_active: editingUser.is_active
      })
      setEditingUser(null)
      fetchUsers(search)
    } catch (err) {
      console.error("Failed to update user:", err)
    } finally {
      setIsSaving(false)
    }
  }

  async function confirmToggleStaff(e: React.FormEvent) {
    e.preventDefault()
    if (!staffToggleTarget) return
    setIsSaving(true)
    setPasswordError("")
    try {
      const res = await adminApi.toggleUserStaff(staffToggleTarget.id, adminPassword)
      if (!res.ok) {
        const errData = await res.json()
        setPasswordError(errData.error || "Failed to update staff privileges")
        return
      }
      setStaffToggleTarget(null)
      setAdminPassword("")
      fetchUsers(search)
    } catch (err) {
      console.error("Toggle staff error:", err)
      setPasswordError("An unexpected error occurred")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleToggleActive(id: number) {
    try {
      await adminApi.toggleUserActive(id)
      fetchUsers(search)
    } catch (err) {
      console.error("Toggle active error:", err)
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!editingProfile) return
    setIsSaving(true)
    try {
      await communityAdminApi.updateProfile(editingProfile.id, {
        xp: parseInt(editingProfile.xp),
        streak: parseInt(editingProfile.streak),
        best_streak: parseInt(editingProfile.best_streak)
      })
      setEditingProfile(null)
      fetchUsers(search)
    } catch (err) {
      console.error("Failed to update profile", err)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">User Management</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage platform candidates, staff privileges, and account status.</p>
        </div>

        <Button variant="outline" size="sm" onClick={() => fetchUsers(search)} className="h-9 gap-1.5 text-xs">
          <RefreshCw className="size-3.5" /> Refresh
        </Button>
      </div>

      <Card className="border border-border/70 p-4 rounded-xl">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search users by name, email or username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-background border border-border/60 rounded-lg pl-9 pr-4 py-2 text-xs focus:ring-1 focus:ring-primary outline-none"
          />
        </div>
      </Card>

      <Card className="border border-border/70 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-xs text-muted-foreground">Loading Users...</div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-4">User</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Gamification</th>
                  <th className="p-4">Joined Date</th>
                  <th className="p-4">Account Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {users.map((user) => {
                  const profile = profiles.find((p) => p.user === user.id)
                  
                  return (
                  <tr key={user.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-4 font-semibold text-foreground">
                      <div>{user.name}</div>
                      <div className="text-[11px] text-muted-foreground">{user.email}</div>
                    </td>
                    <td className="p-4">
                      {user.is_staff ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 flex items-center gap-1 w-fit">
                          <Shield className="size-3" /> Admin Staff
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground w-fit">
                          Candidate
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      {profile ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1 text-[11px]">
                            <Trophy className="size-3 text-amber-500" />
                            <span className="font-medium">{profile.xp} XP</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            Rank #{profile.community_rank || '-'} | Streak: {profile.streak}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">No profile</span>
                      )}
                    </td>
                    <td className="p-4 text-muted-foreground">{new Date(user.date_joined).toLocaleDateString()}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${user.is_active ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'}`}>
                        {user.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-1 whitespace-nowrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingUser({ ...user })}
                        className="h-7 px-2 text-[11px] gap-1 mr-1"
                      >
                        <Edit2 className="size-3" /> Edit
                      </Button>
                      {profile && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingProfile(profile)}
                          className="h-7 px-2 text-[11px] gap-1 mr-1"
                        >
                          <Trophy className="size-3 text-amber-500" /> Stats
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setStaffToggleTarget(user)
                          setAdminPassword("")
                          setPasswordError("")
                        }}
                        className="h-7 px-2 text-[11px] gap-1"
                      >
                        {user.is_staff ? <ShieldAlert className="size-3" /> : <Shield className="size-3" />}
                        {user.is_staff ? "Demote" : "Make Staff"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleActive(user.id)}
                        className="h-7 px-2 text-[11px] gap-1"
                      >
                        {user.is_active ? <UserX className="size-3" /> : <UserCheck className="size-3" />}
                        {user.is_active ? "Disable" : "Enable"}
                      </Button>
                      <Link href={`/admin/users/${user.id}`}>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-7 px-2 text-[11px] gap-1 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary border-transparent"
                        >
                          <Activity className="size-3" />
                          Progress
                        </Button>
                      </Link>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Gamification Stats Edit Modal */}
      {editingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md p-6 border-border shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Edit User Gamification</h2>
              <Button variant="ghost" size="sm" onClick={() => setEditingProfile(null)}>✕</Button>
            </div>
            
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Username</label>
                <div className="text-sm font-semibold">{editingProfile.username}</div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">XP (Experience)</label>
                  <input
                    type="number"
                    value={editingProfile.xp}
                    onChange={(e) => setEditingProfile({...editingProfile, xp: e.target.value})}
                    className="w-full p-2 text-sm border rounded bg-background"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Current Streak</label>
                  <input
                    type="number"
                    value={editingProfile.streak}
                    onChange={(e) => setEditingProfile({...editingProfile, streak: e.target.value})}
                    className="w-full p-2 text-sm border rounded bg-background"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Best Streak</label>
                <input
                  type="number"
                  value={editingProfile.best_streak}
                  onChange={(e) => setEditingProfile({...editingProfile, best_streak: e.target.value})}
                  className="w-full p-2 text-sm border rounded bg-background"
                  required
                />
              </div>
              
              <div className="pt-2 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditingProfile(null)} disabled={isSaving}>Cancel</Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save Stats"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Staff Privilege Password Modal */}
      {staffToggleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md p-6 border-border shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <ShieldAlert className="size-5 text-amber-500" /> Security Verification
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setStaffToggleTarget(null)} disabled={isSaving}>✕</Button>
            </div>
            
            <p className="text-sm text-muted-foreground mb-4">
              You are about to {staffToggleTarget.is_staff ? 'demote' : 'promote'} <strong>{staffToggleTarget.name} ({staffToggleTarget.username})</strong>.
              Please enter your admin password to confirm this action. Note: There is a maximum limit of 2 staff members.
            </p>

            <form onSubmit={confirmToggleStaff} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Your Password</label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full border border-border/60 bg-muted/30 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                  required
                />
                {passwordError && <p className="text-rose-500 text-xs mt-1">{passwordError}</p>}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button type="button" variant="ghost" onClick={() => setStaffToggleTarget(null)} disabled={isSaving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving || !adminPassword}>
                  {isSaving ? "Verifying..." : "Confirm Action"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md p-6 border-border shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Edit2 className="size-4 text-primary" /> Edit User Profile
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setEditingUser(null)}>✕</Button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4 text-xs">
              <div>
                <label className="text-xs font-semibold mb-1 block">Username</label>
                <div className="p-2.5 rounded bg-muted/40 font-mono text-xs font-bold text-foreground">
                  {editingUser.username}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1 block">First Name</label>
                  <input
                    type="text"
                    value={editingUser.first_name || ""}
                    onChange={(e) => setEditingUser({ ...editingUser, first_name: e.target.value })}
                    className="w-full p-2.5 bg-background border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block">Last Name</label>
                  <input
                    type="text"
                    value={editingUser.last_name || ""}
                    onChange={(e) => setEditingUser({ ...editingUser, last_name: e.target.value })}
                    className="w-full p-2.5 bg-background border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold mb-1 block">Email Address</label>
                <input
                  type="email"
                  required
                  value={editingUser.email || ""}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  className="w-full p-2.5 bg-background border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="user_is_active_checkbox"
                  checked={editingUser.is_active}
                  onChange={(e) => setEditingUser({ ...editingUser, is_active: e.target.checked })}
                  className="rounded border-border"
                />
                <label htmlFor="user_is_active_checkbox" className="font-semibold text-xs cursor-pointer">
                  Account Active (Access Enabled)
                </label>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-border/50">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditingUser(null)} disabled={isSaving}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save User"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
