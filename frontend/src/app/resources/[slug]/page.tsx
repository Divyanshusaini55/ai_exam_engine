/**
 * src/app/resources/[slug]/page.tsx
 *
 * Server Component — fetches resource detail from the backend.
 * Delegates interactive bookmark/mark-done actions to the
 * inline `ResourceActions` Client Component.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import ArticleViewer from '@/components/article-viewer'
import ResourceHeader from '@/components/resource-header'
import ResourceSidebar from '@/components/resource-sidebar'
import ResourceActions from './resource-actions'
import { processMarkdown } from '@/lib/processor'

// ─── API base (server-side uses the internal URL if set) ──────────────────────
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ResourceDetail {
  id: number
  title: string
  slug: string
  short_description: string
  resource_type: string
  content_format: 'markdown' | 'html' | 'plaintext' | 'url'
  difficulty: string
  estimated_read_minutes: number
  view_count: number
  is_featured: boolean
  is_ai_generated: boolean
  is_completed: boolean
  is_bookmarked: boolean
  ai_summary: string
  is_published: boolean
  order: number
  created_at: string
  updated_at: string
  content: string
  rendered_content_format: 'markdown' | 'html' | 'plaintext' | 'url'
  external_url?: string
  tags: { id: number; name: string; slug: string; color: string }[]
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchResource(slug: string): Promise<ResourceDetail | null> {
  try {
    const res = await fetch(`${API_BASE}/resource-hub/${slug}/`, {
      // Revalidate once every 60 s so edits propagate reasonably fast
      next: { revalidate: 60 },
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`API error ${res.status}`)
    return res.json()
  } catch {
    return null
  }
}

// ─── generateMetadata ─────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const resource = await fetchResource(params.slug)
  if (!resource) {
    return { title: 'Resource Not Found' }
  }
  return {
    title: `${resource.title} | Exam Engine`,
    description:
      resource.short_description ||
      resource.ai_summary ||
      `Study resource: ${resource.title}`,
    openGraph: {
      title: resource.title,
      description: resource.short_description,
    },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ResourcePage({
  params,
}: {
  params: { slug: string }
}) {
  const resource = await fetchResource(params.slug)

  if (!resource) notFound()

  // Process markdown into HTML string on the server!
  const processedContent =
    resource.rendered_content_format === 'markdown'
      ? await processMarkdown(resource.content)
      : resource.content

  return (
    <>
      {/*
        ResourceActions is a Client Component that owns isCompleted /
        isBookmarked state and fires the POST calls.  It renders
        ResourceHeader with the live-updating props.
      */}
      <ResourceActions
        slug={resource.slug}
        initialIsCompleted={resource.is_completed}
        initialIsBookmarked={resource.is_bookmarked}
        // Pass through all static header props
        title={resource.title}
        difficulty={resource.difficulty}
        estimatedReadMinutes={resource.estimated_read_minutes}
        viewCount={resource.view_count}
        resourceType={resource.resource_type}
      />

      {/* Main layout */}
      <div className="mx-auto max-w-6xl px-4 py-8 flex gap-8">
        <main className="flex-1 min-w-0 max-w-3xl mx-auto">
          <ArticleViewer
            content={processedContent}
            contentFormat={resource.rendered_content_format}
            aiSummary={resource.ai_summary}
            resourceType={resource.resource_type}
            externalUrl={resource.external_url}
          />
        </main>

        <ResourceSidebar
          content={processedContent}
          contentFormat={resource.rendered_content_format}
        />
      </div>
    </>
  )
}
