"use client"

import { useEffect, useState } from "react"
import { adminApi } from "@/lib/api"
import {
  Map,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  X,
  ArrowRight,
  Eye
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function AdminRoadmapsPage() {
  const [roadmaps, setRoadmaps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingRoadmap, setEditingRoadmap] = useState<any>(null)
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    description: "",
    is_active: true
  })

  async function fetchData() {
    setLoading(true)
    try {
      const res = await adminApi.getRoadmaps()
      if (res.ok) {
        const json = await res.json()
        setRoadmaps(Array.isArray(json) ? json : json?.results || [])
      }
    } catch (err) {
      console.error("Failed to load roadmaps:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  function handleOpenCreate() {
    setEditingRoadmap(null)
    setFormData({
      title: "",
      slug: "",
      description: "",
      is_active: true
    })
    setIsModalOpen(true)
  }

  function handleOpenEdit(r: any) {
    setEditingRoadmap(r)
    setFormData({
      title: r.title,
      slug: r.slug,
      description: r.description || "",
      is_active: r.is_active
    })
    setIsModalOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (editingRoadmap) {
        await adminApi.updateRoadmap(editingRoadmap.id, formData)
      } else {
        await adminApi.createRoadmap(formData)
      }
      setIsModalOpen(false)
      fetchData()
    } catch (err) {
      console.error("Save error:", err)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this roadmap? It will cascade delete all phases and topics.")) return
    try {
      await adminApi.deleteRoadmap(id)
      fetchData()
    } catch (err) {
      console.error("Delete error:", err)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Map className="size-6 text-primary" />
            Exam Roadmaps
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage learning paths and exam preparation roadmaps.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} className="h-9 gap-1.5 text-xs">
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
          <Button size="sm" onClick={handleOpenCreate} className="h-9 gap-1.5 text-xs">
            <Plus className="size-3.5" /> Add Roadmap
          </Button>
        </div>
      </div>

      <Card className="border border-border/70 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-xs text-muted-foreground">Loading Roadmaps...</div>
        ) : roadmaps.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground">No roadmaps found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-4">Title & Slug</th>
                  <th className="p-4 w-1/3">Description</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {roadmaps.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-4 font-semibold text-foreground">
                      <div>{r.title}</div>
                      <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{r.slug}</div>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      <span className="line-clamp-2">{r.description || "No description"}</span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${r.is_active ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                        {r.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-1 whitespace-nowrap">
                      <Link href={`/admin/roadmaps/${r.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 text-xs font-medium text-primary hover:text-primary/80 gap-1 px-2">
                          Builder <ArrowRight className="size-3" />
                        </Button>
                      </Link>
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(r)} className="size-7">
                        <Edit className="size-3.5 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)} className="size-7 text-destructive">
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

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <h3 className="font-bold text-base text-foreground">{editingRoadmap ? "Edit Roadmap" : "Add Roadmap"}</h3>
              <button onClick={() => setIsModalOpen(false)}><X className="size-4 text-muted-foreground" /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg p-2 outline-none"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Slug</label>
                <input
                  type="text"
                  required
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg p-2 outline-none font-mono text-[10px]"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Description</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg p-2 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-border"
                />
                <label htmlFor="isActive" className="font-medium cursor-pointer">Active</label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
                <Button type="button" variant="ghost" size="sm" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit" size="sm">{editingRoadmap ? "Save Changes" : "Create Roadmap"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
