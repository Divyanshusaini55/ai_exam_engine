"use client"

import React, { useEffect, useState, useCallback } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { jobsAdminApi } from "@/lib/api"
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  XCircle,
  RefreshCw,
  Cpu,
  Layers,
  FileCode,
  FileCheck,
  Languages,
  Wand2,
  Database,
  Sparkles,
  ExternalLink,
  ChevronRight,
} from "lucide-react"

export interface PipelineStageInfo {
  stage: string
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "ABORTED"
  duration_seconds?: number
  started_at?: string
  completed_at?: string
  details?: Record<string, any>
}

export interface PipelineStatusResponse {
  run_id: string
  status: "RUNNING" | "COMPLETED" | "FAILED" | "ABORTED" | "NOT_FOUND" | string
  stage?: string
  stage_label?: string
  progress: number
  progress_percent: string
  is_aborted: boolean
  error?: string | null
  details?: Record<string, any>
  stages_history: PipelineStageInfo[]
  started_at?: string
  updated_at?: string
  completed_at?: string
  duration_seconds?: number
}

// 10 Standard Lifecycle Milestones
const ORDERED_STAGES = [
  {
    key: "INITIALIZING",
    title: "Environment & Initialization",
    desc: "Verify PDF, setup stages directory, and configure engine router",
    icon: Cpu,
  },
  {
    key: "LAYOUT_EXTRACTION",
    title: "Layout & Text Extraction",
    desc: "Extract styled spans, font sizes, and structural layout blocks",
    icon: Layers,
  },
  {
    key: "MARKDOWN_GENERATION",
    title: "Markdown Document Generation",
    desc: "Synthesize clean, human-readable exam markdown (.md)",
    icon: FileCode,
  },
  {
    key: "QUESTION_CHUNKING",
    title: "Boundary Segmentation",
    desc: "Split document into discrete question blocks and options",
    icon: FileCheck,
  },
  {
    key: "INDIC_FONT_REPAIR",
    title: "Indic Matra & Ligature Repair",
    desc: "Normalize Devanagari Unicode matras and math symbols (×, θ)",
    icon: Languages,
  },
  {
    key: "KATEX_VISION_REFINE",
    title: "KaTeX Multimodal Vision Refine",
    desc: "Refine math expressions and detect diagrams via Gemini Vision",
    icon: Wand2,
  },
  {
    key: "BILINGUAL_ALIGNMENT",
    title: "Bilingual Alignment & Separation",
    desc: "Separate English/Hindi stems and options with clean deduplication",
    icon: Languages,
  },
  {
    key: "AGENTIC_SOLVE",
    title: "Ground-Truth Answer Verification",
    desc: "Resolve unmarked answer keys via batched reasoning solver",
    icon: Sparkles,
  },
  {
    key: "CANONICAL_V2_ASSEMBLY",
    title: "Canonical V2 Schema Assembly",
    desc: "Validate strict Canonical V2 question contract and audit report",
    icon: FileCheck,
  },
  {
    key: "DB_PERSISTENCE",
    title: "Database Ingestion & Asset CDN",
    desc: "Persist canonical questions into database and upload diagrams",
    icon: Database,
  },
]

interface PipelineProgressDrawerProps {
  runId: string | null
  isOpen: boolean
  onClose: () => void
  onJobCancelled?: () => void
}

export function PipelineProgressDrawer({
  runId,
  isOpen,
  onClose,
  onJobCancelled,
}: PipelineProgressDrawerProps) {
  const [data, setData] = useState<PipelineStatusResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [aborting, setAborting] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchStatus = useCallback(async (isPolling = false) => {
    if (!runId) return
    if (!isPolling) setLoading(true)

    try {
      const res = await jobsAdminApi.getPipelineStatus(runId)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      } else {
        setData(null)
      }
    } catch (err) {
      console.error("Failed to fetch pipeline status:", err)
    } finally {
      if (!isPolling) setLoading(false)
    }
  }, [runId])

  useEffect(() => {
    if (!isOpen || !runId) {
      setData(null)
      return
    }

    fetchStatus(false)

    if (!autoRefresh) return

    const interval = setInterval(() => {
      fetchStatus(true)
    }, 1500)

    return () => clearInterval(interval)
  }, [isOpen, runId, autoRefresh, fetchStatus])

  // Stop polling once pipeline reaches terminal status
  useEffect(() => {
    if (data && ["COMPLETED", "FAILED", "ABORTED"].includes(data.status)) {
      setAutoRefresh(false)
    }
  }, [data?.status])

  async function handleAbort() {
    if (!runId) return
    if (!confirm("Are you sure you want to abort this pipeline execution immediately?")) return

    setAborting(true)
    try {
      await jobsAdminApi.abortPipeline(runId, "Aborted by admin from dashboard")
      await fetchStatus(false)
      if (onJobCancelled) onJobCancelled()
    } catch (err) {
      console.error("Failed to abort pipeline:", err)
    } finally {
      setAborting(false)
    }
  }

  // Determine stage status
  const getStageState = (stageKey: string) => {
    if (!data) return { status: "PENDING" }

    const isCurrent = data.stage === stageKey
    const historyItem = data.stages_history?.find((h) => h.stage === stageKey)

    if (data.is_aborted && isCurrent) {
      return { status: "ABORTED", duration: historyItem?.duration_seconds, details: historyItem?.details }
    }

    if (data.status === "FAILED" && isCurrent) {
      return { status: "FAILED", duration: historyItem?.duration_seconds, details: historyItem?.details }
    }

    if (isCurrent && data.status === "RUNNING") {
      return { status: "RUNNING", details: data.details }
    }

    if (historyItem) {
      return {
        status: historyItem.status || "COMPLETED",
        duration: historyItem.duration_seconds,
        details: historyItem.details,
      }
    }

    // If overall is completed and stage was bypassed or finished earlier
    if (data.status === "COMPLETED") {
      return { status: "COMPLETED" }
    }

    return { status: "PENDING" }
  }

  const isTerminal = data ? ["COMPLETED", "FAILED", "ABORTED"].includes(data.status) : false

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl p-0 flex flex-col bg-background/95 backdrop-blur-md border-l border-border/80 shadow-2xl"
      >
        {/* Header */}
        <SheetHeader className="p-5 border-b border-border/60 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <Sparkles className="size-4" />
              </span>
              <div>
                <SheetTitle className="text-sm font-bold tracking-tight">
                  Pipeline Execution Monitor
                </SheetTitle>
                <SheetDescription className="text-[11px] font-mono text-muted-foreground">
                  Run ID: {runId?.substring(0, 18)}...
                </SheetDescription>
              </div>
            </div>

            <div className="flex items-center gap-2 mr-6">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => fetchStatus(false)}
                disabled={loading}
                className="size-7"
                title="Refresh Status"
              >
                <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {/* Top Level Summary Bar */}
          {data && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                      data.status === "COMPLETED"
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                        : data.status === "FAILED"
                        ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                        : data.status === "ABORTED"
                        ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                        : "bg-blue-500/10 text-blue-600 border-blue-500/20"
                    }`}
                  >
                    {data.status}
                  </span>
                  <span className="text-muted-foreground text-[11px]">
                    {data.stage_label || data.stage}
                  </span>
                </div>
                <span className="font-bold text-foreground">{data.progress}%</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    data.status === "FAILED"
                      ? "bg-rose-500"
                      : data.status === "ABORTED"
                      ? "bg-amber-500"
                      : data.status === "COMPLETED"
                      ? "bg-emerald-500"
                      : "bg-gradient-to-r from-blue-500 to-primary"
                  }`}
                  style={{ width: `${Math.min(Math.max(data.progress, 0), 100)}%` }}
                />
              </div>

              {/* Timing Metadata */}
              <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
                <span>Started: {data.started_at ? new Date(data.started_at).toLocaleTimeString() : "--"}</span>
                {data.duration_seconds && <span>Total Duration: {data.duration_seconds}s</span>}
              </div>
            </div>
          )}
        </SheetHeader>

        {/* Content Body: 10 Stages Stepper */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {loading && !data ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-3">
              <Loader2 className="size-6 animate-spin text-primary" />
              <p className="text-xs">Connecting to real-time pipeline monitoring...</p>
            </div>
          ) : !data ? (
            <div className="p-8 text-center text-xs text-muted-foreground bg-muted/20 rounded-xl">
              No live monitoring stream found for this run ID. The pipeline may have completed or was run without tracking.
            </div>
          ) : (
            <>
              {data.error && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-start gap-2.5">
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Error / Abort Notice</p>
                    <p className="text-[11px] mt-0.5">{data.error}</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {ORDERED_STAGES.map((step, idx) => {
                  const state = getStageState(step.key)
                  const StepIcon = step.icon

                  const isCurrent = data.stage === step.key
                  const isCompleted = state.status === "COMPLETED"
                  const isRunning = state.status === "RUNNING"
                  const isFailed = state.status === "FAILED"
                  const isAborted = state.status === "ABORTED"

                  return (
                    <Card
                      key={step.key}
                      className={`p-3 border transition-all duration-200 rounded-xl ${
                        isRunning
                          ? "bg-blue-500/5 border-blue-500/40 shadow-sm"
                          : isCompleted
                          ? "bg-card/80 border-border/60 hover:bg-muted/10"
                          : isFailed || isAborted
                          ? "bg-rose-500/5 border-rose-500/30"
                          : "bg-muted/10 border-border/40 opacity-70"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Status Icon */}
                        <div className="mt-0.5 shrink-0">
                          {isCompleted ? (
                            <div className="size-6 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                              <CheckCircle2 className="size-3.5" />
                            </div>
                          ) : isRunning ? (
                            <div className="size-6 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center animate-pulse">
                              <Loader2 className="size-3.5 animate-spin" />
                            </div>
                          ) : isFailed || isAborted ? (
                            <div className="size-6 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center">
                              <XCircle className="size-3.5" />
                            </div>
                          ) : (
                            <div className="size-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[10px] font-bold">
                              {idx + 1}
                            </div>
                          )}
                        </div>

                        {/* Title & Desc */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4
                              className={`text-xs font-semibold tracking-tight ${
                                isRunning
                                  ? "text-blue-600 dark:text-blue-400"
                                  : isCompleted
                                  ? "text-foreground"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {step.title}
                            </h4>

                            {state.duration !== undefined && (
                              <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {state.duration}s
                              </span>
                            )}
                          </div>

                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                            {step.desc}
                          </p>

                          {/* Detail Pills */}
                          {state.details && Object.keys(state.details).length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {Object.entries(state.details).map(([k, v]) => (
                                <span
                                  key={k}
                                  className="text-[10px] bg-background border border-border/70 text-muted-foreground px-2 py-0.5 rounded-md font-mono"
                                >
                                  {k}: <strong className="text-foreground font-semibold">{String(v)}</strong>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Action Footer */}
        <div className="p-4 border-t border-border/70 bg-muted/30 flex items-center justify-between gap-3">
          <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${autoRefresh ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`} />
            <span>{autoRefresh ? "Live polling active (1.5s)" : "Polling paused"}</span>
          </div>

          <div className="flex items-center gap-2">
            {!isTerminal && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleAbort}
                disabled={aborting}
                className="h-8 text-xs gap-1.5 bg-rose-600 hover:bg-rose-700 text-white"
              >
                {aborting ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <XCircle className="size-3.5" />
                )}
                Abort Pipeline
              </Button>
            )}

            <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
              Close
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
