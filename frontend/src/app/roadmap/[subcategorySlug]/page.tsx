"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { roadmapApi } from "@/lib/api"
import { useAuth } from "@/context/auth-context"
import { ArrowLeft, CheckCircle2, Circle, Loader2, Map as MapIcon, Clock, BookMarked, Bookmark, Download, Share2, Lock } from "lucide-react"
import { TopicResourceHub, type TopicResourceItem, type TopicStatus } from "@/components/topic-resource-hub"

// Define a mapping for status styles and labels
const STATUS_MAP = {
    pending: { label: "Pending", color: "text-muted-foreground", bg: "bg-muted", dot: "bg-muted-foreground" },
    in_progress: { label: "In Progress", color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-100 dark:bg-yellow-500/20", dot: "bg-yellow-500" },
    done: { label: "Done", color: "text-green-600 dark:text-green-400", bg: "bg-green-100 dark:bg-green-500/20", dot: "bg-green-500" },
    skip: { label: "Skip", color: "text-secondary-foreground opacity-70", bg: "bg-secondary border border-border", dot: "bg-secondary-foreground" },
}



export default function RoadmapPage() {
    const params = useParams()
    const router = useRouter()
    const slug = params?.subcategorySlug as string
    const { user } = useAuth()
    
    const [roadmap, setRoadmap] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)

    const topicStatusMap = useMemo(() => {
        const statusMap = new Map<number, string>()
        if (roadmap?.phases) {
            for (const phase of roadmap.phases) {
                if (phase.topics) {
                    for (const topic of phase.topics) {
                        statusMap.set(topic.id, topic.status || 'pending')
                    }
                }
            }
        }
        return statusMap
    }, [roadmap])
    
    // Modal / Hub state
    const [selectedTopic, setSelectedTopic] = useState<any>(null)
    const [hubOpen, setHubOpen] = useState(false)
    const [copied, setCopied] = useState(false)

    const openTopicHub = (topic: any) => {
        setSelectedTopic(topic)
        setHubOpen(true)
    }

    const closeTopicHub = () => {
        setHubOpen(false)
        setTimeout(() => setSelectedTopic(null), 300)
    }

    useEffect(() => {
        if (!slug) return
        fetchRoadmap()
    }, [slug])

    const fetchRoadmap = () => {
        roadmapApi.getRoadmap(slug)
            .then(res => {
                setRoadmap(res.data)
                setLoading(false)
            })
            .catch(err => {
                console.error(err)
                setError(true)
                setLoading(false)
            })
    }

    const updateTopicStatus = async (topicId: number, newStatus: string) => {
        if (!user) {
            alert("Please login to track your progress!")
            return
        }

        // Optimistic UI update
        const updatedRoadmap = { ...roadmap }
        for (const phase of updatedRoadmap.phases) {
            const topic = phase.topics.find((t: any) => t.id === topicId)
            if (topic) {
                topic.status = newStatus
                // Also update the hub's selected topic so the dropdown reflects instantly
                if (selectedTopic && selectedTopic.id === topicId) {
                    setSelectedTopic({ ...topic, status: newStatus })
                }
                break
            }
        }
        setRoadmap(updatedRoadmap)

        try {
            await roadmapApi.updateTopicStatus(topicId, newStatus)
        } catch (err) {
            console.error("Failed to update status", err)
            fetchRoadmap() // Revert on failure
        }
    }

    const toggleBookmark = async () => {
        if (!user) {
            alert("Please login to bookmark roadmaps!")
            return
        }

        // Optimistic UI update
        const originalState = roadmap.is_bookmarked
        setRoadmap({ ...roadmap, is_bookmarked: !originalState })

        try {
            await roadmapApi.toggleRoadmapBookmark(slug)
        } catch (err) {
            console.error("Failed to toggle bookmark", err)
            setRoadmap({ ...roadmap, is_bookmarked: originalState })
        }
    }

    const downloadRoadmap = () => {
        if (!roadmap) return

        const printWindow = window.open("", "_blank")
        if (!printWindow) {
            alert("Please allow popups to download the PDF roadmap.")
            return
        }

        let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Syllabus Roadmap: ${roadmap.title}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
                body {
                    font-family: 'Inter', -apple-system, sans-serif;
                    color: #1e293b;
                    padding: 40px;
                    max-width: 850px;
                    margin: 0 auto;
                    line-height: 1.6;
                    background-color: #ffffff;
                }
                .header {
                    border-bottom: 2px solid #f1f5f9;
                    padding-bottom: 24px;
                    margin-bottom: 32px;
                }
                .title {
                    font-size: 32px;
                    font-weight: 800;
                    color: #0f172a;
                    margin: 4px 0 12px 0;
                    letter-spacing: -0.02em;
                }
                .subtitle {
                    font-size: 13px;
                    color: #3b82f6;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    font-weight: 700;
                }
                .description {
                    font-size: 16px;
                    color: #475569;
                    margin-top: 8px;
                }
                .progress-container {
                    margin-top: 24px;
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 16px 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-weight: 600;
                    font-size: 14px;
                }
                .progress-bar-wrapper {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .progress-bg {
                    width: 160px;
                    background: #cbd5e1;
                    border-radius: 9999px;
                    height: 8px;
                    display: inline-block;
                    overflow: hidden;
                }
                .progress-bar {
                    height: 100%;
                    background: #3b82f6;
                    border-radius: 9999px;
                    width: ${progressPercentage}%;
                }
                .phase {
                    margin-bottom: 40px;
                    page-break-inside: avoid;
                }
                .phase-title {
                    font-size: 20px;
                    font-weight: 700;
                    color: #1e3a8a;
                    background: #eff6ff;
                    padding: 10px 16px;
                    border-radius: 8px;
                    border-left: 5px solid #3b82f6;
                    margin-bottom: 18px;
                }
                .topic {
                    border: 1px solid #e2e8f0;
                    border-radius: 10px;
                    padding: 18px;
                    margin-bottom: 16px;
                    background: #fafafa;
                    page-break-inside: avoid;
                    transition: border-color 0.2s;
                }
                .topic-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 6px;
                }
                .topic-title {
                    font-size: 16px;
                    font-weight: 600;
                    color: #0f172a;
                }
                .topic-status {
                    font-size: 11px;
                    padding: 3px 10px;
                    border-radius: 9999px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .status-done { background: #dcfce7; color: #15803d; }
                .status-pending { background: #f1f5f9; color: #475569; }
                .status-in_progress { background: #fef9c3; color: #a16207; }
                .status-skip { background: #e2e8f0; color: #475569; }
                
                .topic-meta {
                    font-size: 13px;
                    color: #64748b;
                    margin-bottom: 10px;
                    font-weight: 500;
                }
                .topic-desc {
                    font-size: 14px;
                    color: #334155;
                    margin-bottom: 12px;
                }
                .resources {
                    border-top: 1px dashed #e2e8f0;
                    padding-top: 10px;
                    margin-top: 10px;
                }
                .resource-link {
                    display: inline-flex;
                    align-items: center;
                    font-size: 13px;
                    color: #2563eb;
                    text-decoration: none;
                    margin-right: 18px;
                    font-weight: 600;
                }
                .resource-link:hover {
                    text-decoration: underline;
                }
                @media print {
                    body {
                        padding: 10px;
                    }
                    .topic {
                        background: #ffffff !important;
                    }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="subtitle">${roadmap.subcategory_name || "Competitive Exam"}</div>
                <h1 class="title">${roadmap.title}</h1>
                <div class="description">${roadmap.description || "Follow this step-by-step path to master the syllabus."}</div>
                <div class="progress-container">
                    <div>Progress: ${progressPercentage}% Completed (${completedTopics}/${totalTopics} topics)</div>
                    <div class="progress-bar-wrapper">
                        <span class="progress-bg"><span class="progress-bar"></span></span>
                    </div>
                </div>
            </div>
            
            ${roadmap.phases.map((phase: any, pIdx: number) => `
                <div class="phase">
                    <div class="phase-title">Phase ${pIdx + 1}: ${phase.title}</div>
                    ${phase.description ? `<p style="font-size: 14px; color: #64748b; margin-top: -10px; margin-bottom: 20px; font-style: italic;">${phase.description}</p>` : ''}
                    
                    ${phase.topics.map((topic: any) => {
                        const statusClass = 'status-' + (topic.status || 'pending');
                        const statusLabel = STATUS_MAP[topic.status as keyof typeof STATUS_MAP]?.label || 'Pending';
                        return `
                            <div class="topic">
                                <div class="topic-header">
                                    <div class="topic-title">${topic.title}</div>
                                    <div class="topic-status ${statusClass}">${statusLabel}</div>
                                </div>
                                <div class="topic-meta">⏳ Estimated Study Time: ${topic.estimated_minutes || 60} mins</div>
                                ${topic.description ? `<div class="topic-desc">${topic.description}</div>` : ''}
                                
                                ${topic.resources && topic.resources.length > 0 ? `
                                    <div class="resources">
                                        <span style="font-size: 13px; font-weight: 700; color: #475569; margin-right: 12px;">📚 Resources:</span>
                                        ${topic.resources.map((res: any) => `
                                            <a class="resource-link" href="${res.url}" target="_blank">🔗 ${res.title}</a>
                                        `).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            `).join('')}
            
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(function() {
                        window.close();
                    }, 500);
                };
            </script>
        </body>
        </html>
        `

        printWindow.document.write(html)
        printWindow.document.close()
    }

    const handleShare = async () => {
        if (!roadmap) return

        const shareData = {
            title: roadmap.title,
            text: `Check out this syllabus study roadmap for ${roadmap.subcategory_name || "this exam"}!`,
            url: window.location.href,
        }

        if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
            try {
                await navigator.share(shareData)
                return
            } catch (err) {
                console.log("Share failed or cancelled", err)
            }
        }

        // Clipboard Copy Fallback
        try {
            await navigator.clipboard.writeText(window.location.href)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            console.error("Clipboard copy failed", err)
            alert("Could not copy link automatically. Please copy the URL from your address bar.")
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-background">
                <Navbar />
                <div className="flex justify-center items-center h-[calc(100vh-80px)]">
                    <Loader2 className="size-8 animate-spin text-primary" />
                </div>
            </div>
        )
    }

    if (error || !roadmap) {
        return (
            <div className="min-h-screen bg-background">
                <Navbar />
                <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)]">
                    <h1 className="text-2xl font-bold text-primary mb-4">Roadmap not found</h1>
                    <button 
                        onClick={() => router.back()}
                        className="px-6 py-2 bg-primary text-primary-foreground rounded-full font-bold hover:opacity-90"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        )
    }

    // Calculate overall progress
    let totalTopics = 0
    let completedTopics = 0
    roadmap.phases.forEach((phase: any) => {
        phase.topics.forEach((topic: any) => {
            totalTopics++
            if (topic.status === 'done') completedTopics++
        })
    })
    const progressPercentage = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0

    return (
        <div className="min-h-screen bg-background pb-20">
            <Navbar />

            {copied && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-black/90 backdrop-blur-md text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 border border-white/10 animate-fade-in">
                    <CheckCircle2 className="size-4 text-emerald-400 fill-current" />
                    <span className="text-sm font-bold tracking-tight">Link copied to clipboard!</span>
                </div>
            )}
            
            {/* Sticky Progress Header */}
            <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border py-4 px-4 sm:px-6 lg:px-8 shadow-sm">
                <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1">
                        <button 
                            onClick={() => router.back()}
                            className="p-2 hover:bg-muted rounded-full transition-colors hidden sm:block"
                        >
                            <ArrowLeft className="size-5 text-muted-foreground" />
                        </button>
                        <div>
                            <h2 className="font-bold text-primary truncate max-w-[200px] sm:max-w-md">{roadmap.title}</h2>
                            <p className="text-xs text-muted-foreground">{roadmap.subcategory_name}</p>
                        </div>
                    </div>
                    
                    <div className="flex flex-col items-end min-w-[120px]">
                        <span className="text-sm font-bold text-primary mb-1">
                            {progressPercentage}% Completed
                        </span>
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-primary transition-all duration-500 ease-out"
                                style={{ width: `${progressPercentage}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                            <MapIcon className="size-6 text-primary" />
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold text-primary tracking-tight">Syllabus Roadmap</h1>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={toggleBookmark}
                            className={`flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-xl border transition-colors ${
                                roadmap.is_bookmarked 
                                    ? "bg-primary text-primary-foreground border-primary hover:opacity-90" 
                                    : "border-border bg-background hover:bg-secondary text-muted-foreground hover:text-primary"
                            }`}
                        >
                            <Bookmark className={`size-4 ${roadmap.is_bookmarked ? "fill-current" : ""}`} /> 
                            <span className="hidden sm:inline">{roadmap.is_bookmarked ? "Bookmarked" : "Bookmark"}</span>
                        </button>
                        <button 
                            onClick={downloadRoadmap}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-xl border border-border bg-background hover:bg-secondary text-muted-foreground hover:text-primary transition-colors active:scale-95"
                        >
                            <Download className="size-4" /> <span className="hidden sm:inline">Download</span>
                        </button>
                        <button 
                            onClick={handleShare}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-xl border border-border bg-background hover:bg-secondary text-muted-foreground hover:text-primary transition-colors active:scale-95"
                        >
                            <Share2 className="size-4" /> <span className="hidden sm:inline">Share</span>
                        </button>
                    </div>
                </div>
                
                <p className="text-muted-foreground text-lg mb-12 max-w-2xl">
                    {roadmap.description || "Follow this step-by-step path to master the syllabus."}
                </p>

                <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                    {roadmap.phases.map((phase: any, index: number) => (
                        <div key={phase.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                            
                            {/* Timeline Node */}
                            <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-primary shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 text-primary-foreground font-bold">
                                {index + 1}
                            </div>
                            
                            {/* Phase Content */}
                            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-2xl border border-border bg-card shadow-sm">
                                <h3 className="font-bold text-lg text-primary mb-1">{phase.title}</h3>
                                {phase.description && <p className="text-sm text-muted-foreground mb-4">{phase.description}</p>}
                                
                                <div className="space-y-3 mt-4">
                                    {phase.topics.map((topic: any) => {
                                        const currentStatus = topic.status || 'pending'
                                        const statusInfo = STATUS_MAP[currentStatus as keyof typeof STATUS_MAP]
                                        const hasUnmetPrerequisites = topic.prerequisites?.some((p: any) => topicStatusMap.get(p.id) !== 'done')

                                        return (
                                            <div 
                                                key={topic.id} 
                                                onClick={() => openTopicHub(topic)}
                                                className={`p-3 rounded-xl border transition-all cursor-pointer flex gap-3 ${
                                                    currentStatus === 'done'
                                                        ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900/50 hover:bg-green-100 dark:hover:bg-green-900/50" 
                                                        : currentStatus === 'in_progress'
                                                        ? "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-900/50 hover:bg-yellow-100 dark:hover:bg-yellow-900/50"
                                                        : currentStatus === 'skip'
                                                        ? "bg-secondary/20 border-border hover:bg-secondary/40"
                                                        : "bg-background border-border hover:border-primary/50"
                                                }`}
                                            >
                                                <div className="shrink-0 mt-0.5">
                                                    {currentStatus === 'done' ? (
                                                        <CheckCircle2 className={`size-5 ${statusInfo.color}`} />
                                                    ) : hasUnmetPrerequisites ? (
                                                        <Lock className="size-5 text-amber-500 animate-pulse" title="Prerequisites pending" />
                                                    ) : currentStatus === 'in_progress' ? (
                                                        <Circle className={`size-5 ${statusInfo.color} fill-yellow-100 dark:fill-yellow-900/50`} />
                                                    ) : currentStatus === 'skip' ? (
                                                        <Circle className={`size-5 ${statusInfo.color} fill-secondary`} />
                                                    ) : (
                                                        <Circle className="size-5 text-muted-foreground" />
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className={`text-sm font-semibold ${currentStatus === 'done' ? "text-green-800 dark:text-green-400 line-through opacity-70" : "text-foreground"}`}>
                                                        {topic.title}
                                                    </h4>
                                                    {topic.description && (
                                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                                            {topic.description}
                                                        </p>
                                                    )}
                                                    {topic.prerequisites && topic.prerequisites.length > 0 && (
                                                        <div className="flex flex-wrap items-center gap-1.5 mt-2" onClick={e => e.stopPropagation()}>
                                                            <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Prereq:</span>
                                                            {topic.prerequisites.map((p: any) => {
                                                                const isPrereqDone = topicStatusMap.get(p.id) === 'done'
                                                                return (
                                                                    <span 
                                                                        key={p.id} 
                                                                        className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium border transition-colors ${
                                                                            isPrereqDone 
                                                                                ? "bg-green-50 dark:bg-green-950/20 border-green-200/50 dark:border-green-900/30 text-green-700 dark:text-green-400"
                                                                                : "bg-amber-50 dark:bg-amber-950/20 border-amber-200/50 dark:border-amber-900/30 text-amber-700 dark:text-amber-400"
                                                                        }`}
                                                                    >
                                                                        {p.title}
                                                                    </span>
                                                                )
                                                            })}
                                                        </div>
                                                    )}
                                                    <div className="flex items-center justify-between mt-2">
                                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                                                            <Clock className="size-3" /> {topic.estimated_minutes} mins
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {/* CMS resource count badge */}
                                                            {topic.topic_resources && topic.topic_resources.length > 0 && (
                                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-primary/10 text-primary flex items-center gap-0.5">
                                                                    <BookMarked className="size-2.5" />
                                                                    {topic.topic_resources.length}
                                                                </span>
                                                            )}
                                                            {/* Direct status cycle button — stops propagation so hub doesn't open */}
                                                            <button
                                                                onClick={e => {
                                                                    e.stopPropagation()
                                                                    const order: string[] = ["pending", "in_progress", "done", "skip"]
                                                                    const next = order[(order.indexOf(currentStatus) + 1) % order.length]
                                                                    updateTopicStatus(topic.id, next)
                                                                }}
                                                                title="Click to cycle status"
                                                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full cursor-pointer hover:opacity-75 active:scale-95 transition-all ${statusInfo.bg} ${statusInfo.color}`}
                                                            >
                                                                {statusInfo.label}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </main>

             {selectedTopic && (
                <TopicResourceHub
                    isOpen={hubOpen}
                    topicTitle={selectedTopic.title}
                    topicDescription={selectedTopic.description}
                    resources={(selectedTopic.topic_resources ?? []) as TopicResourceItem[]}
                    onClose={closeTopicHub}
                    topicStatus={(selectedTopic.status || "pending") as TopicStatus}
                    onStatusChange={(newStatus) => updateTopicStatus(selectedTopic.id, newStatus)}
                    prerequisites={selectedTopic.prerequisites?.map((p: any) => ({
                        ...p,
                        status: topicStatusMap.get(p.id) || 'pending'
                    }))}
                />
            )}
        </div>
    )
}
