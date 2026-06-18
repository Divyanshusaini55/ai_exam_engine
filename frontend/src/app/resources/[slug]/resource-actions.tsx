'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { resourceHubApi } from '@/lib/api'
import ResourceHeader from '@/components/resource-header'

interface ResourceActionsProps {
  slug: string
  initialIsCompleted: boolean
  initialIsBookmarked: boolean
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

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  const handleMarkDone = async () => {
    if (markingDone) return
    setMarkingDone(true)
    setIsCompleted((prev) => !prev)

    try {
      const res = await resourceHubApi.markDone(slug)
      if (res.ok) {
        const data = await res.json()
        setIsCompleted(data.is_completed)
      } else if (res.status === 401) {
        setIsCompleted((prev) => !prev)
        router.push(`/login?redirectTo=${encodeURIComponent(window.location.pathname)}`)
      } else {
        setIsCompleted((prev) => !prev)
      }
    } catch {
      setIsCompleted((prev) => !prev)
    } finally {
      setMarkingDone(false)
    }
  }
  const handleBookmark = async () => {
    if (bookmarking) return
    setBookmarking(true)
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
