"use client"

import { useEffect, useState } from "react"
import { adminApi } from "@/lib/api"
import {
  Plus,
  FolderTree,
  Sparkles,
  Edit,
  Trash2,
  RefreshCw,
  X,
  Folder,
  Layers,
  CheckCircle2,
  XCircle
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<any[]>([])
  const [subcategories, setSubcategories] = useState<any[]>([])
  const [topics, setTopics] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("topics")

  // Category Modal State
  const [isCatModalOpen, setIsCatModalOpen] = useState(false)
  const [editingCat, setEditingCat] = useState<any>(null)
  const [catFormData, setCatFormData] = useState({
    name: "",
    slug: "",
    description: "",
    icon: "school",
    icon_color: "#3b82f6",
    bg_color: "#eff6ff",
    order: 0,
    is_active: true,
  })

  // Subcategory Modal State
  const [isSubModalOpen, setIsSubModalOpen] = useState(false)
  const [editingSub, setEditingSub] = useState<any>(null)
  const [subFormData, setSubFormData] = useState({
    name: "",
    slug: "",
    category: "",
    description: "",
    icon: "school",
    order: 0,
    is_active: true,
  })

  // Topic Modal State
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false)
  const [editingTopic, setEditingTopic] = useState<any>(null)
  const [topicFormData, setTopicFormData] = useState({
    name: "",
    slug: "",
    subcategory: "",
    description: "",
    icon: "school",
    order: 0,
    is_active: true,
  })

  async function fetchData() {
    setLoading(true)
    try {
      const [resCats, resSubs, resTopics] = await Promise.all([
        adminApi.getCategories(),
        adminApi.getSubcategories(),
        adminApi.getTopics()
      ])
      if (resCats.ok) {
        const jsonCats = await resCats.json()
        setCategories(Array.isArray(jsonCats) ? jsonCats : jsonCats?.results || [])
      }
      if (resSubs.ok) {
        const jsonSubs = await resSubs.json()
        setSubcategories(Array.isArray(jsonSubs) ? jsonSubs : jsonSubs?.results || [])
      }
      if (resTopics.ok) {
        const jsonTopics = await resTopics.json()
        setTopics(Array.isArray(jsonTopics) ? jsonTopics : jsonTopics?.results || [])
      }
    } catch (err) {
      console.error("Failed to load categories/topics:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // --- Category Handlers ---
  function handleOpenCreateCat() {
    setEditingCat(null)
    setCatFormData({
      name: "",
      slug: "",
      description: "",
      icon: "school",
      icon_color: "#3b82f6",
      bg_color: "#eff6ff",
      order: categories.length,
      is_active: true,
    })
    setIsCatModalOpen(true)
  }

  function handleOpenEditCat(cat: any) {
    setEditingCat(cat)
    setCatFormData({
      name: cat.name,
      slug: cat.slug,
      description: cat.description || "",
      icon: cat.icon || "school",
      icon_color: cat.icon_color || "#3b82f6",
      bg_color: cat.bg_color || "#eff6ff",
      order: cat.order || 0,
      is_active: cat.is_active ?? true,
    })
    setIsCatModalOpen(true)
  }

  async function handleSaveCat(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (editingCat) {
        await adminApi.updateCategory(editingCat.id, catFormData)
      } else {
        await adminApi.createCategory(catFormData)
      }
      setIsCatModalOpen(false)
      fetchData()
    } catch (err) {
      console.error("Save category error:", err)
    }
  }

  async function handleDeleteCat(id: number, name: string) {
    if (!confirm(`Are you sure you want to delete category "${name}"? This may affect linked subcategories.`)) return
    try {
      await adminApi.deleteCategory(id)
      fetchData()
    } catch (err) {
      console.error("Delete category error:", err)
    }
  }

  // --- Subcategory Handlers ---
  function handleOpenCreateSub() {
    setEditingSub(null)
    setSubFormData({
      name: "",
      slug: "",
      category: categories[0]?.id || "",
      description: "",
      icon: "school",
      order: subcategories.length,
      is_active: true,
    })
    setIsSubModalOpen(true)
  }

  function handleOpenEditSub(sub: any) {
    setEditingSub(sub)
    setSubFormData({
      name: sub.name,
      slug: sub.slug,
      category: sub.category,
      description: sub.description || "",
      icon: sub.icon || "school",
      order: sub.order || 0,
      is_active: sub.is_active ?? true,
    })
    setIsSubModalOpen(true)
  }

  async function handleSaveSub(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (editingSub) {
        await adminApi.updateSubcategory(editingSub.id, subFormData)
      } else {
        await adminApi.createSubcategory(subFormData)
      }
      setIsSubModalOpen(false)
      fetchData()
    } catch (err) {
      console.error("Save subcategory error:", err)
    }
  }

  async function handleDeleteSub(id: number) {
    if (!confirm("Are you sure you want to delete this subcategory?")) return
    try {
      await adminApi.deleteSubcategory(id)
      fetchData()
    } catch (err) {
      console.error("Delete subcategory error:", err)
    }
  }

  async function handleTriggerRoadmap(id: number, name: string) {
    try {
      const res = await adminApi.triggerRoadmap(id)
      if (res.ok) {
        const json = await res.json()
        alert(json.message || `Queued AI Roadmap generation for ${name}`)
      }
    } catch (err) {
      console.error("Roadmap trigger error:", err)
    }
  }

  // --- Topic Handlers ---
  function handleOpenCreateTopic() {
    setEditingTopic(null)
    setTopicFormData({
      name: "",
      slug: "",
      subcategory: subcategories[0]?.id || "",
      description: "",
      icon: "school",
      order: topics.length,
      is_active: true,
    })
    setIsTopicModalOpen(true)
  }

  function handleOpenEditTopic(topic: any) {
    setEditingTopic(topic)
    setTopicFormData({
      name: topic.name,
      slug: topic.slug,
      subcategory: topic.subcategory,
      description: topic.description || "",
      icon: topic.icon || "school",
      order: topic.order || 0,
      is_active: topic.is_active ?? true,
    })
    setIsTopicModalOpen(true)
  }

  async function handleSaveTopic(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (editingTopic) {
        await adminApi.updateTopic(editingTopic.id, topicFormData)
      } else {
        await adminApi.createTopic(topicFormData)
      }
      setIsTopicModalOpen(false)
      fetchData()
    } catch (err) {
      console.error("Save topic error:", err)
    }
  }

  async function handleDeleteTopic(id: number) {
    if (!confirm("Are you sure you want to delete this topic?")) return
    try {
      await adminApi.deleteTopic(id)
      fetchData()
    } catch (err) {
      console.error("Delete topic error:", err)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <FolderTree className="size-6 text-primary" /> Categories & Subcategories
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage parent categories, subcategories, exam mappings, and trigger AI study roadmaps.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} className="h-9 gap-1.5 text-xs">
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleOpenCreateCat} className="h-9 gap-1.5 text-xs">
            <Folder className="size-3.5 text-primary" /> Create Category
          </Button>
          <Button variant="outline" size="sm" onClick={handleOpenCreateSub} className="h-9 gap-1.5 text-xs">
            <Layers className="size-3.5 text-primary" /> Create Subcategory
          </Button>
          <Button size="sm" onClick={handleOpenCreateTopic} className="h-9 gap-1.5 text-xs">
            <Plus className="size-3.5" /> Create Topic
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <TabsList className="bg-muted/60 p-1 rounded-lg">
            <TabsTrigger value="topics" className="text-xs gap-1.5 px-3 py-1.5">
              <FolderTree className="size-3.5" /> Topics ({topics.length})
            </TabsTrigger>
            <TabsTrigger value="subcategories" className="text-xs gap-1.5 px-3 py-1.5">
              <Layers className="size-3.5" /> Subcategories ({subcategories.length})
            </TabsTrigger>
            <TabsTrigger value="categories" className="text-xs gap-1.5 px-3 py-1.5">
              <Folder className="size-3.5" /> Categories ({categories.length})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* --- TOPICS TAB CONTENT --- */}
        <TabsContent value="topics" className="m-0">
          <Card className="border border-border/70 rounded-xl overflow-hidden shadow-sm">
            {loading ? (
              <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                <RefreshCw className="size-4 animate-spin text-primary" /> Loading Topics...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-4">Topic</th>
                      <th className="p-4">Category</th>
                      <th className="p-4">Subcategory</th>
                      <th className="p-4">Exams Count</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {topics.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-12 text-center text-xs text-muted-foreground">
                          No topics found. Click &quot;Create Topic&quot; to add one.
                        </td>
                      </tr>
                    ) : (
                      topics.map((topic) => (
                        <tr key={topic.id} className="hover:bg-muted/20 transition-colors">
                          <td className="p-4 font-semibold text-foreground">
                            <div>{topic.name}</div>
                            <div className="text-[10px] text-muted-foreground font-mono">{topic.slug}</div>
                          </td>
                          <td className="p-4 text-muted-foreground">
                            <span className="bg-muted px-2 py-0.5 rounded text-[11px] font-medium">
                              {subcategories.find((s) => s.id === topic.subcategory)?.category_name || "Unassigned"}
                            </span>
                          </td>
                          <td className="p-4 text-muted-foreground">
                            <span className="bg-muted px-2 py-0.5 rounded text-[11px] font-medium">
                              {topic.subcategory_name || subcategories.find((s) => s.id === topic.subcategory)?.name || "Unassigned"}
                            </span>
                          </td>
                          <td className="p-4 font-medium">{topic.exam_count || 0} exams</td>
                          <td className="p-4 text-right space-x-1 whitespace-nowrap">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEditTopic(topic)}
                              className="size-7"
                              title="Edit Topic"
                            >
                              <Edit className="size-3.5 text-muted-foreground" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteTopic(topic.id)}
                              className="size-7 text-destructive"
                              title="Delete Topic"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* --- SUBCATEGORIES TAB CONTENT --- */}
        <TabsContent value="subcategories" className="m-0">
          <Card className="border border-border/70 rounded-xl overflow-hidden shadow-sm">
            {loading ? (
              <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                <RefreshCw className="size-4 animate-spin text-primary" /> Loading Subcategories...
              </div>
            ) : subcategories.length === 0 ? (
              <div className="p-12 text-center text-xs text-muted-foreground">
                No subcategories found. Click &quot;Create Subcategory&quot; to add one.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-4">Subcategory</th>
                      <th className="p-4">Parent Category</th>
                      <th className="p-4">Exams Count</th>
                      <th className="p-4">AI Roadmap</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {subcategories.map((sub) => (
                      <tr key={sub.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-4 font-semibold text-foreground">
                          <div>{sub.name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{sub.slug}</div>
                        </td>
                        <td className="p-4 text-muted-foreground">
                          <span className="bg-muted px-2 py-0.5 rounded text-[11px] font-medium">
                            {sub.category_name || categories.find((c) => c.id === sub.category)?.name || "Unassigned"}
                          </span>
                        </td>
                        <td className="p-4 font-medium">{sub.exam_count || 0} exams</td>
                        <td className="p-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTriggerRoadmap(sub.id, sub.name)}
                            className="h-7 px-2 text-[11px] gap-1 text-purple-600 dark:text-purple-400 border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10"
                          >
                            <Sparkles className="size-3" /> Generate AI Roadmap
                          </Button>
                        </td>
                        <td className="p-4 text-right space-x-1 whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEditSub(sub)}
                            className="size-7"
                            title="Edit Subcategory"
                          >
                            <Edit className="size-3.5 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteSub(sub.id)}
                            className="size-7 text-destructive"
                            title="Delete Subcategory"
                          >
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
        </TabsContent>

        {/* --- PARENT CATEGORIES TAB CONTENT --- */}
        <TabsContent value="categories" className="m-0">
          <Card className="border border-border/70 rounded-xl overflow-hidden shadow-sm">
            {loading ? (
              <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                <RefreshCw className="size-4 animate-spin text-primary" /> Loading Parent Categories...
              </div>
            ) : categories.length === 0 ? (
              <div className="p-12 text-center text-xs text-muted-foreground">
                No parent categories found. Click &quot;Create Category&quot; to add your first top-level category (e.g. SSC, UPSC, Banking).
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-4">Category Name</th>
                      <th className="p-4">Slug</th>
                      <th className="p-4">Child Subcategories</th>
                      <th className="p-4">Order</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {categories.map((cat) => {
                      const childCount = subcategories.filter((s) => s.category === cat.id).length
                      return (
                        <tr key={cat.id} className="hover:bg-muted/20 transition-colors">
                          <td className="p-4 font-semibold text-foreground">
                            <div>{cat.name}</div>
                            {cat.description && (
                              <div className="text-[11px] text-muted-foreground font-normal line-clamp-1 mt-0.5">
                                {cat.description}
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-muted-foreground font-mono text-[11px]">{cat.slug}</td>
                          <td className="p-4 font-medium">
                            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[11px]">
                              {childCount} subcategories
                            </span>
                          </td>
                          <td className="p-4 text-muted-foreground">{cat.order ?? 0}</td>
                          <td className="p-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 w-fit ${
                                cat.is_active !== false
                                  ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {cat.is_active !== false ? (
                                <>
                                  <CheckCircle2 className="size-3" /> Active
                                </>
                              ) : (
                                <>
                                  <XCircle className="size-3" /> Hidden
                                </>
                              )}
                            </span>
                          </td>
                          <td className="p-4 text-right space-x-1 whitespace-nowrap">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEditCat(cat)}
                              className="size-7"
                              title="Edit Category"
                            >
                              <Edit className="size-3.5 text-muted-foreground" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteCat(cat.id, cat.name)}
                              className="size-7 text-destructive"
                              title="Delete Category"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* --- CREATE / EDIT PARENT CATEGORY MODAL --- */}
      {isCatModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <h3 className="font-bold text-base text-foreground">
                {editingCat ? "Edit Parent Category" : "Create Parent Category"}
              </h3>
              <button onClick={() => setIsCatModalOpen(false)}>
                <X className="size-4 text-muted-foreground" />
              </button>
            </div>
            <form onSubmit={handleSaveCat} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Category Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SSC, UPSC, Banking"
                  value={catFormData.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setCatFormData({
                      ...catFormData,
                      name: e.target.value,
                      slug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "-"),
                    })
                  }
                  className="w-full bg-background border border-border rounded-lg p-2 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Slug</label>
                <input
                  type="text"
                  required
                  value={catFormData.slug}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setCatFormData({ ...catFormData, slug: e.target.value })
                  }
                  className="w-full bg-background border border-border rounded-lg p-2 font-mono outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Description (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="Short description of this category..."
                  value={catFormData.description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setCatFormData({ ...catFormData, description: e.target.value })
                  }
                  className="w-full bg-background border border-border rounded-lg p-2 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Icon Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={catFormData.icon_color}
                      onChange={(e) => setCatFormData({ ...catFormData, icon_color: e.target.value })}
                      className="size-8 rounded cursor-pointer border border-border p-0.5"
                    />
                    <input
                      type="text"
                      value={catFormData.icon_color}
                      onChange={(e) => setCatFormData({ ...catFormData, icon_color: e.target.value })}
                      className="w-full bg-background border border-border rounded-lg p-2 font-mono text-xs outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Background Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={catFormData.bg_color}
                      onChange={(e) => setCatFormData({ ...catFormData, bg_color: e.target.value })}
                      className="size-8 rounded cursor-pointer border border-border p-0.5"
                    />
                    <input
                      type="text"
                      value={catFormData.bg_color}
                      onChange={(e) => setCatFormData({ ...catFormData, bg_color: e.target.value })}
                      className="w-full bg-background border border-border rounded-lg p-2 font-mono text-xs outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Display Order</label>
                  <input
                    type="number"
                    value={catFormData.order}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setCatFormData({ ...catFormData, order: parseInt(e.target.value) || 0 })
                    }
                    className="w-full bg-background border border-border rounded-lg p-2 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Status</label>
                  <select
                    value={catFormData.is_active ? "true" : "false"}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      setCatFormData({ ...catFormData, is_active: e.target.value === "true" })
                    }
                    className="w-full bg-background border border-border rounded-lg p-2 outline-none"
                  >
                    <option value="true">Active (Visible)</option>
                    <option value="false">Hidden</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsCatModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Save Category
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- CREATE / EDIT SUBCATEGORY MODAL --- */}
      {isSubModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <h3 className="font-bold text-base text-foreground">
                {editingSub ? "Edit Subcategory" : "Create Subcategory"}
              </h3>
              <button onClick={() => setIsSubModalOpen(false)}>
                <X className="size-4 text-muted-foreground" />
              </button>
            </div>
            <form onSubmit={handleSaveSub} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Subcategory Name</label>
                <input
                  type="text"
                  required
                  value={subFormData.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setSubFormData({
                      ...subFormData,
                      name: e.target.value,
                      slug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "-"),
                    })
                  }
                  className="w-full bg-background border border-border rounded-lg p-2 outline-none"
                  placeholder="e.g. SSC CGL"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Slug</label>
                <input
                  type="text"
                  required
                  value={subFormData.slug}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setSubFormData({ ...subFormData, slug: e.target.value })
                  }
                  className="w-full bg-background border border-border rounded-lg p-2 font-mono outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Parent Category</label>
                <select
                  required
                  value={subFormData.category}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setSubFormData({ ...subFormData, category: e.target.value })
                  }
                  className="w-full bg-background border border-border rounded-lg p-2 outline-none font-medium"
                >
                  <option value="" disabled>
                    Select Parent Category
                  </option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Description (Optional)</label>
                <textarea
                  rows={3}
                  value={subFormData.description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setSubFormData({ ...subFormData, description: e.target.value })
                  }
                  className="w-full bg-background border border-border rounded-lg p-2 outline-none"
                  placeholder="e.g. Combined Graduate Level Examination..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Display Order</label>
                  <input
                    type="number"
                    value={subFormData.order}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setSubFormData({ ...subFormData, order: parseInt(e.target.value) || 0 })
                    }
                    className="w-full bg-background border border-border rounded-lg p-2 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Status</label>
                  <select
                    value={subFormData.is_active ? "true" : "false"}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      setSubFormData({ ...subFormData, is_active: e.target.value === "true" })
                    }
                    className="w-full bg-background border border-border rounded-lg p-2 outline-none"
                  >
                    <option value="true">Active (Visible)</option>
                    <option value="false">Hidden</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsSubModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Save Subcategory
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- CREATE / EDIT TOPIC MODAL --- */}
      {isTopicModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <h3 className="font-bold text-base text-foreground">
                {editingTopic ? "Edit Topic" : "Create Topic"}
              </h3>
              <button onClick={() => setIsTopicModalOpen(false)}>
                <X className="size-4 text-muted-foreground" />
              </button>
            </div>
            <form onSubmit={handleSaveTopic} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Topic Name</label>
                <input
                  type="text"
                  required
                  value={topicFormData.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setTopicFormData({
                      ...topicFormData,
                      name: e.target.value,
                      slug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "-"),
                    })
                  }
                  className="w-full bg-background border border-border rounded-lg p-2 outline-none"
                  placeholder="e.g. Quantitative Aptitude"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Slug</label>
                <input
                  type="text"
                  required
                  value={topicFormData.slug}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setTopicFormData({ ...topicFormData, slug: e.target.value })
                  }
                  className="w-full bg-background border border-border rounded-lg p-2 font-mono outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Subcategory</label>
                <select
                  required
                  value={topicFormData.subcategory}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setTopicFormData({ ...topicFormData, subcategory: e.target.value })
                  }
                  className="w-full bg-background border border-border rounded-lg p-2 outline-none font-medium"
                >
                  <option value="" disabled>
                    Select Subcategory
                  </option>
                  {subcategories.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.category_name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Description (Optional)</label>
                <textarea
                  rows={3}
                  value={topicFormData.description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setTopicFormData({ ...topicFormData, description: e.target.value })
                  }
                  className="w-full bg-background border border-border rounded-lg p-2 outline-none"
                  placeholder="e.g. Mathematics and Quantitative Aptitude..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Display Order</label>
                  <input
                    type="number"
                    value={topicFormData.order}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setTopicFormData({ ...topicFormData, order: parseInt(e.target.value) || 0 })
                    }
                    className="w-full bg-background border border-border rounded-lg p-2 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Status</label>
                  <select
                    value={topicFormData.is_active ? "true" : "false"}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      setTopicFormData({ ...topicFormData, is_active: e.target.value === "true" })
                    }
                    className="w-full bg-background border border-border rounded-lg p-2 outline-none"
                  >
                    <option value="true">Active (Visible)</option>
                    <option value="false">Hidden</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsTopicModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Save Topic
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
