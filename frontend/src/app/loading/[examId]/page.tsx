"use client"
import { useNoIndex } from "@/hooks/useNoIndex"

import { useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { SubmissionLoadingState } from "@/components/submission-loading-state"



export default function LoadingPage() {
  useNoIndex() // Prevent search engine indexing
  const router = useRouter()
  const params = useParams()
  const examId = params.examId as string

  useEffect(() => {
    // 1. Simulate a short "processing" delay
    // In a real app, you might poll an API status here
    const timer = setTimeout(() => {
      // 2. Redirect to the Results Dashboard
      router.replace(`/dashboard/${examId}`)
    }, 3000) // 3 seconds delay for effect

    return () => clearTimeout(timer)
  }, [router, examId])

  return <SubmissionLoadingState />
}