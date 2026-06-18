"use client"
import { Suspense } from "react"
import { useNoIndex } from "@/hooks/useNoIndex"
import { useRouter, useParams } from "next/navigation"
import { PerformanceAnalysisDashboard } from "@/components/performance-analysis"


export default function DashboardPage() {
  const router = useRouter()
  const params = useParams()
  const examSlug = params.examSlug as string

  // Logic to handle retaking
  const handleRetake = () => {
    // Add retake parameter to bypass route guard
    router.push(`/shift/${examSlug}?retake=true`)
  }

  return (
    <Suspense fallback={<div>Loading Dashboard...</div>}>
      <PerformanceAnalysisDashboard
        examId={examSlug}
        onRetake={handleRetake}
      />
    </Suspense>
  )
}