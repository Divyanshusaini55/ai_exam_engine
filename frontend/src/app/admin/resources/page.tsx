"use client"

import { useEffect, useState } from "react"
import { adminApi } from "@/lib/api"
import {
  BookOpen,
  Plus,
  Edit,
  Trash2,
  Sparkles,
  Star,
  CheckCircle2,
  RefreshCw,
  X
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function AdminResourcesPage() {
  const [resources, setResources] = useState<any[]>([])
  const [tags, setTags] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [generatingId, setGeneratingId] = useState<number | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [bulkActionLoading, setBulkActionLoading] = useState(false)

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isTagModalOpen, setIsTagModalOpen] = useState(false)
  const [editingRes, setEditingRes] = useState<any>(null)
  const [formData, setFormData] = useState({
    title: "",
    short_description: "",
    resource_type: "article",
    content_format: "markdown",
    markdown_content: "",
    estimated_read_minutes: 5,
    difficulty: "beginner",
    is_published: true,
    is_featured: false,
    tags: [] as number[]
  })
  
  const [tagFormData, setTagFormData] = useState({ name: "", color: "#3b82f6" })
  const [editingTag, setEditingTag] = useState<any>(null)

  async function fetchData() {
    setLoading(true)
    try {
      const [resResources, resTags] = await Promise.all([
        adminApi.getResources(),
        adminApi.getTags()
      ])
      
      if (resResources.ok) {
        const json = await resResources.json()
        setResources(Array.isArray(json) ? json : json?.results || [])
      }
      
      if (resTags.ok) {
        const json = await resTags.json()
        setTags(Array.isArray(json) ? json : json?.results || [])
      }
    } catch (err) {
      console.error("Failed to load data:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  function toggleSelectAll() {
    if (selectedIds.length === resources.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(resources.map(r => r.id))
    }
  }

  function toggleSelect(id: number) {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id))
    } else {
      setSelectedIds([...selectedIds, id])
    }
  }

  async function handleBulkPublish() {
    if (selectedIds.length === 0) return
    setBulkActionLoading(true)
    try {
      await adminApi.bulkPublishResources(selectedIds)
      setSelectedIds([])
      fetchData()
    } catch (err) {
      console.error("Bulk publish failed:", err)
    } finally {
      setBulkActionLoading(false)
    }
  }

  async function handleBulkUnpublish() {
    if (selectedIds.length === 0) return
    setBulkActionLoading(true)
    try {
      await adminApi.bulkUnpublishResources(selectedIds)
      setSelectedIds([])
      fetchData()
    } catch (err) {
      console.error("Bulk unpublish failed:", err)
    } finally {
      setBulkActionLoading(false)
    }
  }

  async function handleBulkFeature() {
    if (selectedIds.length === 0) return
    setBulkActionLoading(true)
    try {
      await adminApi.bulkFeatureResources(selectedIds)
      setSelectedIds([])
      fetchData()
    } catch (err) {
      console.error("Bulk feature failed:", err)
    } finally {
      setBulkActionLoading(false)
    }
  }

  async function handleBulkAiSummary() {
    if (selectedIds.length === 0) return
    setBulkActionLoading(true)
    try {
      await adminApi.bulkAiSummaryResources(selectedIds)
      setSelectedIds([])
      fetchData()
    } catch (err) {
      console.error("Bulk AI summary failed:", err)
    } finally {
      setBulkActionLoading(false)
    }
  }

  function handleOpenCreate() {
    setEditingRes(null)
    setFormData({
      title: "",
      short_description: "",
      resource_type: "article",
      content_format: "markdown",
      markdown_content: "",
      estimated_read_minutes: 5,
      difficulty: "beginner",
      is_published: true,
      is_featured: false,
      tags: []
    })
    setIsModalOpen(true)
  }

  function handleOpenEdit(r: any) {
    setEditingRes(r)
    setFormData({
      title: r.title,
      short_description: r.short_description || "",
      resource_type: r.resource_type || "article",
      content_format: r.content_format || "markdown",
      markdown_content: r.markdown_content || "",
      estimated_read_minutes: r.estimated_read_minutes || 5,
      difficulty: r.difficulty || "beginner",
      is_published: r.is_published,
      is_featured: r.is_featured,
      tags: r.tags || []
    })
    setIsModalOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (editingRes) {
        await adminApi.updateResource(editingRes.id, formData)
      } else {
        await adminApi.createResource(formData)
      }
      setIsModalOpen(false)
      fetchData()
    } catch (err) {
      console.error("Save error:", err)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this resource?")) return
    try {
      await adminApi.deleteResource(id)
      fetchData()
    } catch (err) {
      console.error("Delete error:", err)
    }
  }

  async function handleTogglePublish(id: number) {
    try {
      await adminApi.togglePublishResource(id)
      fetchData()
    } catch (err) {
      console.error("Publish error:", err)
    }
  }

  async function handleToggleFeature(id: number) {
    try {
      await adminApi.toggleFeatureResource(id)
      fetchData()
    } catch (err) {
      console.error("Feature error:", err)
    }
  }

  async function handleGenerateAiSummary(id: number) {
    setGeneratingId(id)
    try {
      const res = await adminApi.generateAiResourceSummary(id)
      if (res.ok) {
        const json = await res.json()
        alert(`AI Summary Generated:\n\n${json.ai_summary}`)
        fetchData()
      }
    } catch (err) {
      console.error("AI summary error:", err)
    } finally {
      setGeneratingId(null)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <BookOpen className="size-6 text-primary" />
            Study Resources
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage articles, formula sheets, Markdown notes, and AI summaries.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} className="h-9 gap-1.5 text-xs">
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsTagModalOpen(true)} className="h-9 gap-1.5 text-xs">
            Manage Tags
          </Button>
          <Button size="sm" onClick={handleOpenCreate} className="h-9 gap-1.5 text-xs">
            <Plus className="size-3.5" /> Add Resource
          </Button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="font-semibold text-primary">
            {selectedIds.length} resource{selectedIds.length > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={handleBulkPublish} disabled={bulkActionLoading} className="h-8 text-[11px] gap-1">
              Publish All
            </Button>
            <Button size="sm" variant="outline" onClick={handleBulkUnpublish} disabled={bulkActionLoading} className="h-8 text-[11px] gap-1">
              Unpublish All
            </Button>
            <Button size="sm" variant="outline" onClick={handleBulkFeature} disabled={bulkActionLoading} className="h-8 text-[11px] gap-1">
              Feature All
            </Button>
            <Button size="sm" variant="outline" onClick={handleBulkAiSummary} disabled={bulkActionLoading} className="h-8 text-[11px] gap-1 text-purple-600">
              <Sparkles className="size-3" /> Gen AI Summaries
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])} className="h-8 text-[11px]">
              Deselect
            </Button>
          </div>
        </div>
      )}

      <Card className="border border-border/70 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-xs text-muted-foreground">Loading Study Hub Resources...</div>
        ) : resources.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground">No resources found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-4 w-8">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === resources.length && resources.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-border"
                    />
                  </th>
                  <th className="p-4">Title & Type</th>
                  <th className="p-4">Format</th>
                  <th className="p-4">Difficulty</th>
                  <th className="p-4">AI Summary</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {resources.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(r.id)}
                        onChange={() => toggleSelect(r.id)}
                        className="rounded border-border"
                      />
                    </td>
                    <td className="p-4 font-semibold text-foreground max-w-xs">
                      <div>{r.title}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono mt-0.5">{r.resource_type}</div>
                    </td>
                    <td className="p-4 text-muted-foreground">{r.content_format}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground capitalize">
                        {r.difficulty}
                      </span>
                      {r.tags && r.tags.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {r.tags.map((tid: number) => {
                            const t = tags.find(tag => tag.id === tid)
                            return t ? (
                              <span key={tid} className="px-1.5 py-0.5 rounded text-[9px] text-white" style={{ backgroundColor: t.color }}>
                                {t.name}
                              </span>
                            ) : null
                          })}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      {r.ai_summary ? (
                        <span className="text-[10px] text-sky-600 dark:text-sky-400 font-medium">✓ Generated</span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={generatingId === r.id}
                          onClick={() => handleGenerateAiSummary(r.id)}
                          className="h-6 px-2 text-[10px] gap-1"
                        >
                          <Sparkles className="size-3 text-purple-500" />
                          {generatingId === r.id ? "Gen..." : "Gen AI Summary"}
                        </Button>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleTogglePublish(r.id)}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${r.is_published ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}
                        >
                          {r.is_published ? 'Published' : 'Draft'}
                        </button>
                        <button
                          onClick={() => handleToggleFeature(r.id)}
                          title="Toggle Featured"
                          className="p-1 text-amber-500 hover:scale-110 transition-transform"
                        >
                          <Star className={`size-3.5 ${r.is_featured ? 'fill-amber-400 text-amber-500' : 'text-muted-foreground/30'}`} />
                        </button>
                      </div>
                    </td>
                    <td className="p-4 text-right space-x-1 whitespace-nowrap">
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
          <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <h3 className="font-bold text-base text-foreground">{editingRes ? "Edit Resource" : "Add Resource"}</h3>
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
                  className="w-full bg-background border border-border rounded-lg p-2.5 outline-none"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Short Description</label>
                <textarea
                  rows={2}
                  value={formData.short_description}
                  onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg p-2 outline-none"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Markdown Content</label>
                <textarea
                  rows={8}
                  value={formData.markdown_content}
                  onChange={(e) => setFormData({ ...formData, markdown_content: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg p-3 font-mono text-[11px] outline-none"
                  placeholder="# Article Title..."
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Tags</label>
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => {
                    const isSelected = formData.tags.includes(tag.id)
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setFormData({ ...formData, tags: formData.tags.filter(id => id !== tag.id) })
                          } else {
                            setFormData({ ...formData, tags: [...formData.tags, tag.id] })
                          }
                        }}
                        className={`px-2 py-1 rounded text-[10px] font-semibold border transition-colors`}
                        style={{
                          backgroundColor: isSelected ? tag.color : 'transparent',
                          color: isSelected ? '#fff' : tag.color,
                          borderColor: tag.color
                        }}
                      >
                        {tag.name}
                      </button>
                    )
                  })}
                  {tags.length === 0 && <span className="text-muted-foreground">No tags available. Manage Tags to add some.</span>}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_published}
                    onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                  />
                  <span>Published</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_featured}
                    onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                  />
                  <span>Featured</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit" size="sm">Save Resource</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tags Management Modal */}
      {isTagModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <h3 className="font-bold text-base text-foreground">Manage Resource Tags</h3>
              <button onClick={() => setIsTagModalOpen(false)}><X className="size-4 text-muted-foreground" /></button>
            </div>
            
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Tag Name"
                  value={tagFormData.name}
                  onChange={(e) => setTagFormData({ ...tagFormData, name: e.target.value })}
                  className="flex-1 bg-background border border-border rounded-lg p-2 text-xs outline-none"
                />
                <input
                  type="color"
                  value={tagFormData.color}
                  onChange={(e) => setTagFormData({ ...tagFormData, color: e.target.value })}
                  className="w-10 h-9 p-1 bg-background border border-border rounded-lg cursor-pointer"
                />
                <Button 
                  size="sm" 
                  onClick={async () => {
                    if (!tagFormData.name) return
                    try {
                      if (editingTag) {
                        await adminApi.updateTag(editingTag.id, tagFormData)
                      } else {
                        await adminApi.createTag(tagFormData)
                      }
                      setTagFormData({ name: "", color: "#3b82f6" })
                      setEditingTag(null)
                      fetchData()
                    } catch (err) { console.error(err) }
                  }}
                  className="h-9 px-3 text-xs"
                >
                  {editingTag ? "Save" : "Add"}
                </Button>
                {editingTag && (
                  <Button variant="outline" size="sm" onClick={() => { setEditingTag(null); setTagFormData({ name: "", color: "#3b82f6" })}} className="h-9 px-3">
                    Cancel
                  </Button>
                )}
              </div>
              
              <div className="border border-border/50 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 border-b border-border/50 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3">Tag</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {tags.length === 0 ? (
                      <tr><td colSpan={2} className="p-4 text-center text-muted-foreground">No tags found.</td></tr>
                    ) : (
                      tags.map(tag => (
                        <tr key={tag.id} className="hover:bg-muted/10">
                          <td className="p-3">
                            <span className="px-2 py-1 rounded text-white font-medium text-[10px]" style={{ backgroundColor: tag.color }}>
                              {tag.name}
                            </span>
                          </td>
                          <td className="p-3 text-right space-x-1">
                            <Button variant="ghost" size="icon" onClick={() => { setEditingTag(tag); setTagFormData({ name: tag.name, color: tag.color })}} className="size-7">
                              <Edit className="size-3 text-muted-foreground" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={async () => {
                              if (!confirm("Delete tag?")) return
                              try {
                                await adminApi.deleteTag(tag.id)
                                fetchData()
                              } catch (err) { console.error(err) }
                            }} className="size-7 text-destructive">
                              <Trash2 className="size-3" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
