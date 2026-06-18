"use client"
import { useNoIndex } from "@/hooks/useNoIndex"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import { ExamTakingInterface } from "@/components/exam-taking-interface"
import { useEffect, useState } from "react"
import { examApi } from "@/lib/api"


export default function ShiftPage() {
    useNoIndex()
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const examSlug = params.examSlug as string
  const [loading, setLoading] = useState(true)

  // retake attempt or learning mode review
  const isRetake = searchParams.get('retake') === 'true'
  const isLearningMode = searchParams.get('mode') === 'learning'

  // prevent access to completed exams (unless retaking or reviewing in learning mode)
  useEffect(() => {
    async function checkExamStatus() {
      if (isRetake || isLearningMode) {
        setLoading(false)
        return
      }

      try {
        await examApi.getResults(examSlug)
        router.replace(`/dashboard/${examSlug}`)
      } catch (error: any) {
        if (error.response?.status === 404) {
          setLoading(false)
        } else if (error.response?.status === 401) {
          setLoading(false)
        } else {
          console.warn('Error checking exam status:', error)
          setLoading(false)
        }
      }
    }
    checkExamStatus()
  }, [examSlug, router, isRetake])

  const handleSubmit = (sessionId?: string) => {
    if (sessionId) {
      router.replace(`/dashboard/${examSlug}?session_id=${sessionId}`)
    } else {
      router.replace(`/dashboard/${examSlug}`)
    }
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center font-bold text-xl text-muted-foreground">
        Verifying exam status...
      </div>
    )
  }

  return <ExamTakingInterface onSubmit={handleSubmit} examId={examSlug} />
}
