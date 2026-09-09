"use client"
import { useNoIndex } from "@/hooks/useNoIndex"

import { useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { SubmissionLoadingState } from "@/components/submission-loading-state"



export default function LoadingPage() {
  useNoIndex() // Prevent search engine indexing
  const router = useRouter()
  const params = useParams()
  const examId = params.examSlug as string

  useEffect(() => {
    router.replace(`/dashboard/${examId}`)
  }, [router, examId])

  return <SubmissionLoadingState />
}