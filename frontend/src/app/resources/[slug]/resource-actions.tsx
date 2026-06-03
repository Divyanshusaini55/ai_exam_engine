'use client'

/**
 * resource-actions.tsx
 *
 * Inline Client Component that manages bookmark / mark-done state
 * and fires authenticated POST calls to the backend.
 * Rendered inside the Server Component page so that the page shell
 * stays a React Server Component.
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { resourceHubApi } from '@/lib/api'
import ResourceHeader from '@/components/resource-header'

interface ResourceActionsProps {
  slug: string
  initialIsCompleted: boolean
  initialIsBookmarked: boolean
  // Static header data passed down from the server
  title: string
  difficulty: string
  estimatedReadMinutes: number
  viewCount: number
  resourceType: string
}

export default function ResourceActions({
  slug,
  initialIsCompleted,
  initialIsBookmarked,
  title,
  difficulty,
  estimatedReadMinutes,
  viewCount,
  resourceType,
}: ResourceActionsProps) {
  const router = useRouter()
  const [isCompleted, setIsCompleted] = useState(initialIsCompleted)
  const [isBookmarked, setIsBookmarked] = useState(initialIsBookmarked)
  const [markingDone, setMarkingDone] = useState(false)
  const [bookmarking, setBookmarking] = useState(false)

  // Force scroll to top on mount because modal unmounts can lock scroll state
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // ── Mark done toggle ────────────────────────────────────────────────────────
  const handleMarkDone = async () => {
    if (markingDone) return
    setMarkingDone(true)

    // Optimistic update
    setIsCompleted((prev) => !prev)

    try {
      const res = await resourceHubApi.markDone(slug)
      if (res.ok) {
        const data = await res.json()
        setIsCompleted(data.is_completed)
      } else if (res.status === 401) {
        // Revert and redirect to login
        setIsCompleted((prev) => !prev)
        router.push(`/login?redirectTo=${encodeURIComponent(window.location.pathname)}`)
      } else {
        // Revert on unexpected error
        setIsCompleted((prev) => !prev)
      }
    } catch {
      setIsCompleted((prev) => !prev)
    } finally {
      setMarkingDone(false)
    }
  }

  // ── Bookmark toggle ─────────────────────────────────────────────────────────
  const handleBookmark = async () => {
    if (bookmarking) return
    setBookmarking(true)

    // Optimistic update
    setIsBookmarked((prev) => !prev)

    try {
      const res = await resourceHubApi.bookmark(slug)
      if (res.ok) {
        const data = await res.json()
        setIsBookmarked(data.is_bookmarked)
      } else if (res.status === 401) {
        setIsBookmarked((prev) => !prev)
        router.push(`/login?redirectTo=${encodeURIComponent(window.location.pathname)}`)
      } else {
        setIsBookmarked((prev) => !prev)
      }
    } catch {
      setIsBookmarked((prev) => !prev)
    } finally {
      setBookmarking(false)
    }
  }

  return (
    <ResourceHeader
      title={title}
      difficulty={difficulty}
      estimatedReadMinutes={estimatedReadMinutes}
      viewCount={viewCount}
      resourceType={resourceType}
      isCompleted={isCompleted}
      isBookmarked={isBookmarked}
      onMarkDone={handleMarkDone}
      onBookmark={handleBookmark}
    />
  )
}
