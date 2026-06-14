"use client"
import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useAuth } from "@/context/auth-context"
import { Navbar } from "@/components/navbar"
import { contributorApi } from "@/lib/api"
import { Users, Award, Zap, MessageSquare, FileText, TrendingUp, CheckCircle2, Star, Clock, Trophy, Flame, BarChart3, Sparkles, ShieldCheck, Cpu, ArrowUpRight, HelpCircle, Eye, Check, RefreshCw } from "lucide-react"
import { XPGuideModal } from "@/components/xp-guide-modal"
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts"

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-secondary/60 rounded-xl ${className}`} />
}

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (d < 60) return `${d}s ago`
  if (d < 3600) return `${Math.floor(d/60)}m ago`
  if (d < 86400) return `${Math.floor(d/3600)}h ago`
  return `${Math.floor(d/86400)}d ago`
}

const ACTIVITY_COLORS: Record<string, string> = {
  SOLUTION: "text-sky-500 bg-sky-500/10",
  COMMENT: "text-pink-500 bg-pink-500/10",
  UPLOAD: "text-emerald-500 bg-emerald-500/10",
  SUGGESTION: "text-amber-500 bg-amber-500/10",
  EXAM: "text-violet-500 bg-violet-500/10",
  BADGE: "text-purple-500 bg-purple-500/10",
  ROADMAP: "text-teal-500 bg-teal-500/10",
}

export default function ContributorsPage() {
  const { user } = useAuth()
  const [overview, setOverview] = useState<any>(null)
  const [myStats, setMyStats] = useState<any>(null)
  const [top, setTop] = useState<any[]>([])
  const [activities, setActivities] = useState<any[]>([])
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [badges, setBadges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isXPModalOpen, setIsXPModalOpen] = useState(false)
  const [actPage, setActPage] = useState(1)
  const [hasMoreAct, setHasMoreAct] = useState(true)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [ov, topR, actR, lbR, badR] = await Promise.allSettled([
        contributorApi.getOverview(),
        contributorApi.getTop(1, 8),
        contributorApi.getActivity(1),
        contributorApi.getLeaderboard(30),
        contributorApi.getBadges(),
      ])
      if (ov.status === "fulfilled") setOverview(ov.value.data)
      if (topR.status === "fulfilled") setTop(topR.value.data.results || [])
      if (actR.status === "fulfilled") { setActivities(actR.value.data.results || []); setHasMoreAct(actR.value.data.has_more) }
      if (lbR.status === "fulfilled") setLeaderboard(lbR.value.data || [])
      if (badR.status === "fulfilled") setBadges(badR.value.data || [])
      // Try auth-only endpoint
      try { const r = await contributorApi.getMyStats(); setMyStats(r.data) } catch {}
    } finally { setLoading(false) }
  }, [])

  const loadMoreAct = async () => {
    const next = actPage + 1
    const r = await contributorApi.getActivity(next)
    setActivities(p => [...p, ...(r.data.results || [])])
    setHasMoreAct(r.data.has_more)
    setActPage(next)
  }

  useEffect(() => { loadAll() }, [loadAll])

  const stats = myStats ? [
    { label: "Solutions Posted", value: myStats.total_solutions, Icon: FileText, color: "text-sky-500", bg: "bg-sky-500/10" },
    { label: "Total Upvotes", value: myStats.total_upvotes_received, Icon: ArrowUpRight, color: "text-orange-500", bg: "bg-orange-500/10" },
    { label: "Content Views", value: myStats.total_views, Icon: TrendingUp, color: "text-green-500", bg: "bg-green-500/10" },
    { label: "Reputation XP", value: myStats.xp, Icon: Zap, color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: "Discussions", value: myStats.total_comments, Icon: MessageSquare, color: "text-pink-500", bg: "bg-pink-500/10" },
    { label: "Tests Solved", value: myStats.exams_solved, Icon: CheckCircle2, color: "text-violet-500", bg: "bg-violet-500/10" },
  ] : null

  const earnedBadges = badges.filter(b => b.earned)

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-12 flex flex-col gap-12">

        {/* ── PROFILE HERO ── */}
        <section>
          <div className="card-premium p-8 md:p-10 flex flex-col lg:flex-row gap-10 items-start overflow-hidden relative">
            <div className="absolute top-0 right-0 size-64 bg-primary/5 rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none" />
            <div className="flex flex-col md:flex-row gap-8 items-center lg:items-start w-full lg:w-3/5 relative z-10">
              <div className="relative group">
                <div className="size-32 md:size-40 rounded-[40px] bg-secondary flex items-center justify-center text-4xl font-bold text-primary shadow-premium border-4 border-card group-hover:scale-105 transition-transform duration-500">
                  {myStats?.avatar_char || <Users className="size-12 text-muted-foreground" />}
                </div>
                {myStats && <div className="absolute -bottom-2 -right-2 bg-success text-white p-2 rounded-full shadow-lg border-4 border-card"><ShieldCheck className="size-5" /></div>}
              </div>
              <div className="flex flex-col items-center md:items-start text-center md:text-left gap-4 flex-1">
                {loading && !myStats ? (
                  <div className="space-y-3 w-full"><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-64" /></div>
                ) : myStats ? (
                  <>
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <h1 className="text-3xl md:text-4xl font-bold font-heading text-primary tracking-tight">{myStats.full_name || myStats.username}</h1>
                        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/50 border border-border text-[10px] font-bold tracking-widest uppercase text-muted-foreground"><Sparkles className="size-3 text-amber-500" />Contributor</div>
                      </div>
                      <p className="text-lg text-muted-foreground font-medium">@{myStats.username}</p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mt-2">
                      <div className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold shadow-premium"><Zap className="size-4 fill-current" />{myStats.xp.toLocaleString()} XP</div>
                      <div className="flex items-center gap-2 px-4 py-2 bg-secondary text-primary rounded-xl text-sm font-bold border border-border"><Flame className="size-4 text-orange-500" />{myStats.streak} Day Streak</div>
                      {myStats.percentile > 0 && <div className="flex items-center gap-2 px-4 py-2 bg-secondary text-primary rounded-xl text-sm font-bold border border-border"><Award className="size-4 text-blue-500" />Top {(100 - myStats.percentile).toFixed(1)}%</div>}
                    </div>
                    <div className="grid grid-cols-3 gap-8 mt-6 w-full">
                      <div><p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Reputation</p><p className="text-2xl font-bold text-primary font-heading">{myStats.reputation_score}</p></div>
                      <div><p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Solutions</p><p className="text-2xl font-bold text-primary font-heading">{myStats.total_solutions}</p></div>
                      <div><p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Upvotes</p><p className="text-2xl font-bold text-primary font-heading">{myStats.total_upvotes_received}</p></div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <h1 className="text-3xl font-bold text-primary">Community Hub</h1>
                    <p className="text-muted-foreground">Sign in to see your personal stats and rank.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="w-full lg:w-2/5 flex flex-col gap-6 relative z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest">Weekly Activity</h3>
                {overview && <div className="text-xs font-bold text-muted-foreground bg-secondary px-3 py-1 rounded-lg">{overview.total_solutions} solutions total</div>}
              </div>
              <div className="h-48 w-full">
                {myStats?.weekly_activity ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={myStats.weekly_activity}>
                      <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--primary)" stopOpacity={0.15}/><stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/></linearGradient></defs>
                      <Tooltip contentStyle={{ backgroundColor: 'var(--card)', color: 'var(--primary)', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} />
                      <Area type="monotone" dataKey="contributions" stroke="var(--primary)" strokeWidth={3} fillOpacity={1} fill="url(#cg)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <Skeleton className="h-full w-full" />}
              </div>
              <div className="flex justify-between items-center bg-secondary/30 p-4 rounded-2xl border border-border">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-card flex items-center justify-center border border-border shadow-sm"><Cpu className="size-5 text-primary" /></div>
                  <div><p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Community</p><p className="text-xs font-medium text-primary">{overview ? `${overview.total_contributors} contributors` : '...'}</p></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── STATS CARDS ── */}
        {(stats || loading) && (
          <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-6">
            {loading && !stats ? Array.from({length: 6}).map((_,i) => <Skeleton key={i} className="h-32" />) :
              stats?.map((s, i) => (
                <div key={i} className="card-premium p-6 flex flex-col gap-4 group hover:border-primary/20 transition-all">
                  <div className={`size-10 rounded-xl ${s.bg} ${s.color} flex items-center justify-center group-hover:scale-110 transition-transform`}><s.Icon className="size-5" /></div>
                  <div><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{s.label}</p><p className="text-2xl font-bold text-primary font-heading">{Number(s.value).toLocaleString()}</p></div>
                </div>
              ))}
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">
          <div className="lg:col-span-2 flex flex-col gap-12">

            {/* ── CATEGORY LEADERBOARD ── */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-[22px] font-bold font-heading text-primary flex items-center gap-2"><Trophy className="size-5 text-amber-500" />Subject Leaders</h2>
                  <p className="text-sm text-muted-foreground font-medium mt-1">Top contributors by category — last 30 days</p>
                </div>
                <button onClick={() => setIsXPModalOpen(true)} className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"><HelpCircle className="size-4" />How XP works</button>
              </div>
              <div className="overflow-hidden relative -mx-4 md:mx-0 md:px-0 py-4">
                {loading && !leaderboard.length ? (
                  <div className="flex px-4 md:px-0">
                    {Array.from({length:4}).map((_,i) => <Skeleton key={i} className="w-[280px] mr-6 h-48 shrink-0" />)}
                  </div>
                ) : leaderboard.length === 0 ? (
                  <p className="text-muted-foreground text-sm px-4 md:px-0">No category data yet. Start contributing!</p>
                ) : (
                  <div className="flex w-max animate-marquee hover:[animation-play-state:paused] px-4 md:px-0">
                    {[...leaderboard, ...leaderboard].map((board, i) => (
                      <div key={i} className="w-[280px] mr-6 bg-card border border-border rounded-premium p-6 shadow-sm hover:shadow-premium transition-all duration-300 shrink-0">
                        <div className="mb-5"><p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-0.5">{board.category_slug?.toUpperCase()}</p><h3 className="text-base font-bold text-primary">{board.category_name}</h3></div>
                        {board.contributors.length === 0 ? <p className="text-xs text-muted-foreground">No solutions yet</p> :
                          <div className="space-y-4">
                            {board.contributors.map((u: any, j: number) => (
                              <div key={j} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <span className="text-sm">{j===0?'🥇':j===1?'🥈':'🥉'}</span>
                                  <div className="size-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-primary border border-border shrink-0">{u.username[0].toUpperCase()}</div>
                                  <span className="text-[13px] font-bold text-primary truncate max-w-[90px]">{u.username}</span>
                                </div>
                                <span className="text-[12px] font-bold text-amber-600 whitespace-nowrap">{u.xp} xp</span>
                              </div>
                            ))}
                          </div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* ── TOP CONTRIBUTORS TABLE ── */}
              <section>
                <div className="mb-6"><h2 className="text-[20px] font-bold font-heading text-primary flex items-center gap-2"><FileText className="size-5" />Top Contributors</h2><p className="text-sm text-muted-foreground font-medium mt-1">Ranked by XP</p></div>
                <div className="bg-card border border-border rounded-premium shadow-sm overflow-hidden">
                  <table className="w-full text-left table-fixed">
                    <thead className="bg-secondary/10 border-b border-border">
                      <tr>
                        <th className="w-[50%] px-5 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">User</th>
                        <th className="px-4 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest text-center">XP</th>
                        <th className="px-5 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest text-right">Rank</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {loading && !top.length ? Array.from({length:6}).map((_,i) => (
                        <tr key={i}><td className="px-5 py-3" colSpan={3}><Skeleton className="h-6" /></td></tr>
                      )) : top.map((u, i) => (
                        <tr key={i} className="hover:bg-secondary/20 transition-colors">
                          <td className="px-5 py-3"><div className="flex items-center gap-3"><div className="size-8 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-primary border border-border shrink-0">{u.avatar_char || u.username[0].toUpperCase()}</div><span className="text-xs font-bold text-primary truncate">{u.username}</span></div></td>
                          <td className="px-4 py-3 text-center"><span className="text-xs font-bold text-primary">{u.xp.toLocaleString()}</span></td>
                          <td className="px-5 py-3 text-right"><span className="text-xs font-bold text-muted-foreground">#{u.community_rank}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* ── ACTIVITY FEED ── */}
              <section>
                <div className="mb-6"><h2 className="text-[20px] font-bold font-heading text-primary flex items-center gap-2"><Users className="size-5" />Live Activity</h2><p className="text-sm text-muted-foreground font-medium mt-1">Real-time community feed</p></div>
                <div className="flex flex-col gap-4 relative">
                  <div className="absolute left-[20px] top-5 bottom-5 w-px bg-border z-0" />
                  {loading && !activities.length ? Array.from({length:3}).map((_,i) => <Skeleton key={i} className="h-20" />) :
                    activities.slice(0,6).map((act, i) => {
                      const colorClass = ACTIVITY_COLORS[act.activity_type] || "text-primary bg-primary/10"
                      return (
                        <div key={i} className="flex gap-4 relative z-10">
                          <div className="size-10 rounded-full bg-secondary border border-border flex items-center justify-center text-sm font-bold text-primary shadow-sm shrink-0">{act.avatar_char}</div>
                          <div className="flex-1 bg-card border border-border rounded-2xl p-4 shadow-sm">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-primary">{act.username}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-black tracking-widest uppercase ${colorClass}`}>{act.activity_type}</span>
                              </div>
                              <span className="text-[10px] text-muted-foreground">{timeAgo(act.created_at)}</span>
                            </div>
                            <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2">{act.description}</p>
                          </div>
                        </div>
                      )
                    })}
                  {hasMoreAct && <button onClick={loadMoreAct} className="flex items-center gap-2 justify-center text-sm font-bold text-muted-foreground hover:text-primary transition-colors mt-2"><RefreshCw className="size-4" />Load more</button>}
                </div>
              </section>
            </div>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="lg:col-span-1 flex flex-col gap-12 pt-[84px]">
            {/* GLOBAL RANK */}
            {myStats && (
              <section>
                <div className="card-premium p-8 bg-primary text-primary-foreground border-none overflow-hidden relative group">
                  <div className="absolute top-0 right-0 size-40 bg-white/10 rounded-full blur-[80px] -mr-20 -mt-20 group-hover:scale-150 transition-transform duration-700" />
                  <h3 className="text-[13px] font-bold text-primary-foreground/60 uppercase tracking-widest mb-6 relative z-10">Global Standing</h3>
                  <div className="flex items-end justify-between mb-8 relative z-10">
                    <div><p className="text-[44px] font-bold font-heading leading-none">#{myStats.community_rank || '—'}</p><p className="text-[13px] font-bold opacity-60 uppercase tracking-widest mt-2">Community rank</p></div>
                    <div className="text-right"><p className="text-xl font-bold font-heading">Top {(100 - myStats.percentile).toFixed(1)}%</p><p className="text-xs font-medium opacity-60 mt-1">Percentile</p></div>
                  </div>
                  <div className="space-y-2 relative z-10">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-widest"><span>Reputation Score</span><span>{myStats.reputation_score}/100</span></div>
                    <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-white rounded-full transition-all duration-1000" style={{ width: `${myStats.reputation_score}%` }} /></div>
                  </div>
                </div>
              </section>
            )}

            {/* BADGES */}
            {/* <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-[20px] font-bold font-heading text-primary">Badges</h2>
                <span className="text-xs font-bold text-muted-foreground">{earnedBadges.length}/{badges.length} earned</span>
              </div>
              {loading && !badges.length ? <div className="grid grid-cols-2 gap-4">{Array.from({length:4}).map((_,i) => <Skeleton key={i} className="h-32" />)}</div> :
                <div className="grid grid-cols-2 gap-4">
                  {badges.slice(0,8).map((badge, i) => (
                    <div key={i} className={`group card-premium p-4 flex flex-col items-center text-center gap-3 cursor-pointer transition-all ${badge.earned ? 'hover:border-primary/30' : 'opacity-40 grayscale'}`}>
                      <div className={`size-14 rounded-2xl bg-gradient-to-br ${badge.color_gradient} p-[1px] shadow-lg ${badge.earned ? 'group-hover:scale-110' : ''} transition-transform duration-500`}>
                        <div className="size-full bg-card rounded-[15px] flex items-center justify-center"><Sparkles className={`size-6 ${badge.earned ? 'text-primary' : 'text-muted-foreground'}`} /></div>
                      </div>
                      <div><p className="text-[11px] font-bold text-primary mb-0.5 leading-tight">{badge.name}</p><p className="text-[10px] text-muted-foreground leading-tight">{badge.description}</p></div>
                      {badge.earned && <div className="size-5 bg-success rounded-full flex items-center justify-center"><Check className="size-3 text-white stroke-[3]" /></div>}
                    </div>
                  ))}
                </div>}
            </section> */}
          </div>
        </div>

        {/* ── CTA ── */}
        <section>
          <div className="bg-secondary/30 rounded-[40px] p-12 md:p-16 text-center border border-border relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent pointer-events-none" />
            <Users className="size-16 text-primary/10 mx-auto mb-8 group-hover:scale-110 transition-transform duration-500" />
            <h2 className="text-2xl md:text-4xl font-bold font-heading text-primary tracking-tight mb-6">Built for the Community</h2>
            <p className="text-lg md:text-xl text-muted-foreground font-medium max-w-2xl mx-auto mb-10 leading-relaxed">Share knowledge, help fellow aspirants, and climb the global ranks. Your contributions power the next generation of AI learning.</p>
            <div className="flex flex-wrap items-center justify-center gap-6">
              <Link href={user ? "/upload" : "/login"} className="px-8 py-2 bg-primary text-primary-foreground font-bold rounded-2xl shadow-premium hover:-translate-y-0.5 transition-all active:scale-95 inline-block">Start Contributing</Link>
              <Link href={user ? "/exams" : "/login"} className="px-8 py-2 bg-card border border-border text-primary font-bold rounded-2xl shadow-sm hover:bg-secondary transition-all active:scale-95 inline-block">Browse Exams</Link>
            </div>
          </div>
        </section>
      </main>
      <XPGuideModal isOpen={isXPModalOpen} onClose={() => setIsXPModalOpen(false)} />
    </div>
  )
}
