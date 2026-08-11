"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { adminApi } from "@/lib/api"
import {
  Map,
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  X,
  ChevronDown,
  ChevronRight,
  BookOpen
} from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function AdminRoadmapBuilderPage() {
  const params = useParams()
  const roadmapId = parseInt(params.id as string)
  const [roadmap, setRoadmap] = useState<any>(null)
  const [phases, setPhases] = useState<any[]>([])
  const [topics, setTopics] = useState<Record<number, any[]>>({})
  const [loading, setLoading] = useState(true)
  const [expandedPhases, setExpandedPhases] = useState<Record<number, boolean>>({})

  // Phase Modal State
  const [isPhaseModalOpen, setIsPhaseModalOpen] = useState(false)
  const [editingPhase, setEditingPhase] = useState<any>(null)
  const [phaseFormData, setPhaseFormData] = useState({
    title: "",
    description: "",
    order: 1
  })

  // Topic Modal State
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false)
  const [editingTopic, setEditingTopic] = useState<any>(null)
  const [targetPhaseId, setTargetPhaseId] = useState<number | null>(null)
  const [topicFormData, setTopicFormData] = useState({
    title: "",
    description: "",
    order: 1,
    is_premium: false
  })

  async function fetchData() {
    setLoading(true)
    try {
      const resRm = await adminApi.getRoadmap(roadmapId)
      if (resRm.ok) {
        setRoadmap(await resRm.json())
      }
      
      const resPh = await adminApi.getRoadmapPhases(roadmapId)
      if (resPh.ok) {
        const jsonPh = await resPh.json()
        const phaseList = Array.isArray(jsonPh) ? jsonPh : jsonPh?.results || []
        setPhases(phaseList)
        
        // Fetch topics for each phase
        const newTopics: Record<number, any[]> = {}
        for (const p of phaseList) {
          const resT = await adminApi.getRoadmapTopics(p.id)
          if (resT.ok) {
            const jsonT = await resT.json()
            newTopics[p.id] = Array.isArray(jsonT) ? jsonT : jsonT?.results || []
          }
        }
        setTopics(newTopics)
      }
    } catch (err) {
      console.error("Failed to load roadmap builder:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isNaN(roadmapId)) {
      fetchData()
    }
  }, [roadmapId])

  function togglePhase(id: number) {
    setExpandedPhases(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // --- Phase Handlers ---
  function handleOpenPhaseCreate() {
    setEditingPhase(null)
    setPhaseFormData({ title: "", description: "", order: phases.length + 1 })
    setIsPhaseModalOpen(true)
  }

  function handleOpenPhaseEdit(p: any) {
    setEditingPhase(p)
    setPhaseFormData({ title: p.title, description: p.description || "", order: p.order })
    setIsPhaseModalOpen(true)
  }

  async function handleSavePhase(e: React.FormEvent) {
    e.preventDefault()
    try {
      const payload = { ...phaseFormData, roadmap: roadmapId }
      if (editingPhase) {
        await adminApi.updateRoadmapPhase(editingPhase.id, payload)
      } else {
        await adminApi.createRoadmapPhase(payload)
      }
      setIsPhaseModalOpen(false)
      fetchData()
    } catch (err) { console.error(err) }
  }

  async function handleDeletePhase(id: number) {
    if (!confirm("Are you sure you want to delete this phase? All its topics will also be deleted.")) return
    try {
      await adminApi.deleteRoadmapPhase(id)
      fetchData()
    } catch (err) { console.error(err) }
  }

  // --- Topic Handlers ---
  function handleOpenTopicCreate(phaseId: number) {
    setEditingTopic(null)
    setTargetPhaseId(phaseId)
    const topicCount = topics[phaseId]?.length || 0
    setTopicFormData({ title: "", description: "", order: topicCount + 1, is_premium: false })
    setIsTopicModalOpen(true)
  }

  function handleOpenTopicEdit(phaseId: number, t: any) {
    setEditingTopic(t)
    setTargetPhaseId(phaseId)
    setTopicFormData({ title: t.title, description: t.description || "", order: t.order, is_premium: t.is_premium })
    setIsTopicModalOpen(true)
  }

  async function handleSaveTopic(e: React.FormEvent) {
    e.preventDefault()
    if (!targetPhaseId) return
    try {
      const payload = { ...topicFormData, phase: targetPhaseId }
      if (editingTopic) {
        await adminApi.updateRoadmapTopic(editingTopic.id, payload)
      } else {
        await adminApi.createRoadmapTopic(payload)
      }
      setIsTopicModalOpen(false)
      fetchData()
    } catch (err) { console.error(err) }
  }

  async function handleDeleteTopic(id: number) {
    if (!confirm("Are you sure you want to delete this topic?")) return
    try {
      await adminApi.deleteRoadmapTopic(id)
      fetchData()
    } catch (err) { console.error(err) }
  }


  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-muted-foreground font-medium">Loading Roadmap Builder...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link href="/admin/roadmaps" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="size-3.5" /> Back to Roadmaps
          </Link>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            {roadmap?.title || "Roadmap Builder"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">{roadmap?.slug}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} className="h-9 gap-1.5 text-xs">
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
          <Button size="sm" onClick={handleOpenPhaseCreate} className="h-9 gap-1.5 text-xs">
            <Plus className="size-3.5" /> Add Phase
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {phases.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground bg-card border border-border/70 rounded-xl">
            No phases created yet. Click &quot;Add Phase&quot; to get started.
          </div>
        ) : (
          phases.map((p) => {
            const isExpanded = expandedPhases[p.id] !== false
            const phaseTopics = topics[p.id] || []
            return (
              <Card key={p.id} className="border border-border/70 shadow-sm rounded-xl overflow-hidden transition-colors">
                <div 
                  className="bg-muted/30 hover:bg-muted/50 p-4 flex items-center justify-between cursor-pointer border-b border-border/50"
                  onClick={() => togglePhase(p.id)}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
                    <div>
                      <h3 className="font-semibold text-foreground text-sm">Phase {p.order}: {p.title}</h3>
                      {p.description && <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <span className="text-[10px] text-muted-foreground mr-3 font-medium bg-background px-2 py-1 rounded border border-border/50">
                      {phaseTopics.length} Topics
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => handleOpenPhaseEdit(p)} className="size-8">
                      <Edit className="size-3.5 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeletePhase(p.id)} className="size-8 text-destructive">
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="p-0 bg-background/50">
                    <div className="divide-y divide-border/30">
                      {phaseTopics.map(t => (
                        <div key={t.id} className="p-3 pl-12 flex items-center justify-between hover:bg-muted/10 transition-colors">
                          <div className="flex items-start gap-3">
                            <span className="bg-primary/10 text-primary font-bold text-[10px] rounded size-5 flex items-center justify-center mt-0.5">
                              {t.order}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-xs text-foreground">{t.title}</span>
                                {t.is_premium && <span className="px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider font-bold bg-amber-500/20 text-amber-600 border border-amber-500/30">Premium</span>}
                              </div>
                              {t.description && <p className="text-[11px] text-muted-foreground mt-0.5">{t.description}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleOpenTopicEdit(p.id, t)} className="size-7">
                              <Edit className="size-3 text-muted-foreground" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteTopic(t.id)} className="size-7 text-destructive">
                              <Trash2 className="size-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="p-3 pl-12 border-t border-border/30 bg-muted/10">
                      <Button variant="outline" size="sm" onClick={() => handleOpenTopicCreate(p.id)} className="h-7 gap-1.5 text-[10px] border-dashed">
                        <Plus className="size-3" /> Add Topic to Phase {p.order}
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            )
          })
        )}
      </div>

      {/* Phase Modal */}
      {isPhaseModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <h3 className="font-bold text-base text-foreground">{editingPhase ? "Edit Phase" : "Add Phase"}</h3>
              <button onClick={() => setIsPhaseModalOpen(false)}><X className="size-4 text-muted-foreground" /></button>
            </div>
            <form onSubmit={handleSavePhase} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium mb-1">Phase Title</label>
                <input
                  type="text"
                  required
                  value={phaseFormData.title}
                  onChange={(e) => setPhaseFormData({ ...phaseFormData, title: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg p-2 outline-none"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Description</label>
                <textarea
                  rows={2}
                  value={phaseFormData.description}
                  onChange={(e) => setPhaseFormData({ ...phaseFormData, description: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg p-2 outline-none"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Order Index</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={phaseFormData.order}
                  onChange={(e) => setPhaseFormData({ ...phaseFormData, order: parseInt(e.target.value) })}
                  className="w-full bg-background border border-border rounded-lg p-2 outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
                <Button type="button" variant="ghost" size="sm" onClick={() => setIsPhaseModalOpen(false)}>Cancel</Button>
                <Button type="submit" size="sm">Save Phase</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Topic Modal */}
      {isTopicModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <h3 className="font-bold text-base text-foreground">{editingTopic ? "Edit Topic" : "Add Topic"}</h3>
              <button onClick={() => setIsTopicModalOpen(false)}><X className="size-4 text-muted-foreground" /></button>
            </div>
            <form onSubmit={handleSaveTopic} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium mb-1">Topic Title</label>
                <input
                  type="text"
                  required
                  value={topicFormData.title}
                  onChange={(e) => setTopicFormData({ ...topicFormData, title: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg p-2 outline-none"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Description</label>
                <textarea
                  rows={2}
                  value={topicFormData.description}
                  onChange={(e) => setTopicFormData({ ...topicFormData, description: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg p-2 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium mb-1">Order Index</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={topicFormData.order}
                    onChange={(e) => setTopicFormData({ ...topicFormData, order: parseInt(e.target.value) })}
                    className="w-full bg-background border border-border rounded-lg p-2 outline-none"
                  />
                </div>
                <div className="flex flex-col justify-center mt-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={topicFormData.is_premium}
                      onChange={(e) => setTopicFormData({ ...topicFormData, is_premium: e.target.checked })}
                      className="rounded border-border"
                    />
                    <span className="font-medium text-amber-500">Premium Topic</span>
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
                <Button type="button" variant="ghost" size="sm" onClick={() => setIsTopicModalOpen(false)}>Cancel</Button>
                <Button type="submit" size="sm">Save Topic</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
