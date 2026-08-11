"use client"

import { useEffect, useState } from "react"
import { adminApi } from "@/lib/api"
import {
  Plus,
  Newspaper,
  Sparkles,
  Edit,
  Trash2,
  RefreshCw,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  Calendar,
  ExternalLink
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function AdminCurrentAffairsPage() {
  const [articles, setArticles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState(false)

  // Pagination & Search State
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const pageSize = 20

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingArticle, setEditingArticle] = useState<any>(null)
  const [formData, setFormData] = useState({
    title: "",
    summary: "",
    source_name: "",
    source_url: "",
  })

  async function fetchData(targetPage: number = page, query: string = search) {
    setLoading(true)
    try {
      const res = await adminApi.getCurrentAffairs(targetPage, query)
      if (res.ok) {
        const json = await res.json()
        if (Array.isArray(json)) {
          setArticles(json)
          setTotalCount(json.length)
        } else if (json && json.results) {
          setArticles(json.results)
          setTotalCount(json.count || json.results.length)
        } else {
          setArticles([])
          setTotalCount(0)
        }
      }
    } catch (err) {
      console.error("Failed to load current affairs:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData(page, search)
  }, [page, search])

  const totalPages = Math.ceil(totalCount / pageSize) || 1

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    setSearch(searchInput)
  }

  function handleClearSearch() {
    setSearchInput("")
    setSearch("")
    setPage(1)
  }

  function handleOpenCreate() {
    setEditingArticle(null)
    setFormData({
      title: "",
      summary: "",
      source_name: "",
      source_url: "",
    })
    setIsModalOpen(true)
  }

  function handleOpenEdit(art: any) {
    setEditingArticle(art)
    setFormData({
      title: art.title || "",
      summary: art.summary || "",
      source_name: art.source_name || "",
      source_url: art.source_url || "",
    })
    setIsModalOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (editingArticle) {
        await adminApi.updateCurrentAffair(editingArticle.id, formData)
      } else {
        await adminApi.createCurrentAffair(formData)
      }
      setIsModalOpen(false)
      fetchData(page, search)
    } catch (err) {
      console.error("Save error:", err)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this article?")) return
    try {
      await adminApi.deleteCurrentAffair(id)
      fetchData(page, search)
    } catch (err) {
      console.error("Delete error:", err)
    }
  }

  async function handleTriggerAiGen() {
    setTriggering(true)
    try {
      const res = await adminApi.triggerAiCurrentAffairs()
      if (res.ok) {
        const json = await res.json()
        alert(json.message || "AI Generation Task Queued")
        fetchData(1, search)
      }
    } catch (err) {
      console.error("AI Gen error:", err)
    } finally {
      setTriggering(false)
    }
  }

  const startRecord = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const endRecord = Math.min(page * pageSize, totalCount)

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Newspaper className="size-6 text-primary" /> Current Affairs & Daily Dose
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage daily exam news updates, AI content generation, and article archives.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchData(page, search)} className="h-9 gap-1.5 text-xs">
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleTriggerAiGen}
            disabled={triggering}
            className="h-9 gap-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Sparkles className="size-3.5" />
            {triggering ? "Generating..." : "Generate AI Daily Dose"}
          </Button>
          <Button size="sm" onClick={handleOpenCreate} className="h-9 gap-1.5 text-xs">
            <Plus className="size-3.5" /> Add Article
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card border border-border/70 p-3 rounded-xl shadow-sm">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-96 flex items-center">
          <Search className="size-3.5 absolute left-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search articles by title or source..."
            value={searchInput}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchInput(e.target.value)}
            className="w-full bg-background border border-border rounded-lg pl-9 pr-8 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {searchInput && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </form>

        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <span>Total: <strong className="text-foreground">{totalCount}</strong> articles</span>
          {search && (
            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] font-medium">
              Filtered
            </span>
          )}
        </div>
      </div>

      {/* Table Card */}
      <Card className="border border-border/70 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
            <RefreshCw className="size-5 animate-spin text-primary" />
            <span>Loading Articles...</span>
          </div>
        ) : articles.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground">
            No current affairs articles found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-4">Headline</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Source</th>
                  <th className="p-4">Published Date</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {articles.map((art) => (
                  <tr key={art.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-4 font-semibold text-foreground max-w-md">
                      <div className="line-clamp-2">{art.title}</div>
                      {art.summary && (
                        <div className="text-[11px] font-normal text-muted-foreground line-clamp-1 mt-0.5">
                          {art.summary}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-muted-foreground whitespace-nowrap">
                      <span className="bg-muted px-2 py-0.5 rounded text-[10px] font-medium">
                        {art.category_name || art.category || 'General'}
                      </span>
                    </td>
                    <td className="p-4 text-muted-foreground whitespace-nowrap">
                      {art.source_url ? (
                        <a
                          href={art.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline text-primary flex items-center gap-1"
                        >
                          {art.source_name || "Link"} <ExternalLink className="size-3" />
                        </a>
                      ) : (
                        art.source_name || "-"
                      )}
                    </td>
                    <td className="p-4 text-muted-foreground whitespace-nowrap">
                      <span className="flex items-center gap-1 text-[11px]">
                        <Calendar className="size-3 text-muted-foreground" />
                        {art.published_date || "Today"}
                      </span>
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          art.published_date
                            ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {art.published_date ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-1 whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(art)}
                        className="size-7"
                        title="Edit Article"
                      >
                        <Edit className="size-3.5 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(art.id)}
                        className="size-7 text-destructive"
                        title="Delete Article"
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

        {/* Pagination Footer */}
        {!loading && totalCount > 0 && (
          <div className="p-4 border-t border-border/60 bg-card flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{startRecord}</span> to{" "}
              <span className="font-semibold text-foreground">{endRecord}</span> of{" "}
              <span className="font-semibold text-foreground">{totalCount}</span> articles
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="h-8 px-2.5 gap-1 text-xs"
              >
                <ChevronLeft className="size-3.5" /> Previous
              </Button>

              <div className="flex items-center gap-1 px-2 text-xs font-medium text-foreground">
                Page {page} of {totalPages}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="h-8 px-2.5 gap-1 text-xs"
              >
                Next <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <h3 className="font-bold text-base text-foreground">
                {editingArticle ? "Edit Article" : "Add Article"}
              </h3>
              <button onClick={() => setIsModalOpen(false)}>
                <X className="size-4 text-muted-foreground" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium mb-1">Headline</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full bg-background border border-border rounded-lg p-2 outline-none"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Summary</label>
                <textarea
                  rows={4}
                  required
                  value={formData.summary}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setFormData({ ...formData, summary: e.target.value })
                  }
                  className="w-full bg-background border border-border rounded-lg p-2 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Source Name</label>
                  <input
                    type="text"
                    value={formData.source_name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData({ ...formData, source_name: e.target.value })
                    }
                    placeholder="e.g. Indian Express"
                    className="w-full bg-background border border-border rounded-lg p-2 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Source URL</label>
                  <input
                    type="url"
                    value={formData.source_url}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData({ ...formData, source_url: e.target.value })
                    }
                    placeholder="https://..."
                    className="w-full bg-background border border-border rounded-lg p-2 outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Save Article
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
