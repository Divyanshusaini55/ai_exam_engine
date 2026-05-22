'use client'

import { cn } from '@/lib/utils'

import './article.css'

interface MarkdownRendererProps {
  content: string
  className?: string
}

export default function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div
      className={cn(
        "academic-article", 
        className
      )}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  )
}