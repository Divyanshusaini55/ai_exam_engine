"use client"
import { useNoIndex } from "@/hooks/useNoIndex"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import { ExamTakingInterface } from "@/components/exam-taking-interface"
import { useEffect, useState } from "react"
import { examApi } from "@/lib/api"


export default function ShiftPage() {
    useNoIndex() // Prevent search engine indexing
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const shiftId = params.shiftId as string
  const [loading, setLoading] = useState(true)

  // Check if this is a retake attempt or learning mode review
  const isRetake = searchParams.get('retake') === 'true'
  const isLearningMode = searchParams.get('mode') === 'learning'

  // 🛡️ Route Guard: Prevent access to completed exams (unless retaking or reviewing in learning mode)
  useEffect(() => {
    async function checkExamStatus() {
      // Skip guard if this is a retake or learning mode view
      if (isRetake || isLearningMode) {
        setLoading(false)
        return
      }

      try {
        // Check if result already exists for THIS USER
        await examApi.getResults(shiftId)
        // Result exists - redirect to result page
        router.replace(`/dashboard/${shiftId}`)
      } catch (error: any) {
        // Handle different error cases
        if (error.response?.status === 404) {
          // No result for this user - allow exam access
          setLoading(false)
        } else if (error.response?.status === 401) {
          // Not authenticated - allow (will handle in exam interface)
          setLoading(false)
        } else {
          // Other error - fail open and allow access
          console.warn('Error checking exam status:', error)
          setLoading(false)
        }
      }
    }
    checkExamStatus()
  }, [shiftId, router, isRetake])

  const handleSubmit = () => {
    // Replace history to prevent back-navigation to exam
    router.replace(`/dashboard/${shiftId}`)
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center font-bold text-xl text-muted-foreground">
        Verifying exam status...
      </div>
    )
  }

  return <ExamTakingInterface onSubmit={handleSubmit} examId={shiftId} />
}