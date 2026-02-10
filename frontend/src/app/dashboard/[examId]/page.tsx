"use client"
import { useNoIndex } from "@/hooks/useNoIndex"
import { useRouter, useParams } from "next/navigation"
import { PerformanceAnalysisDashboard } from "@/components/performance-analysis"


export default function DashboardPage() {
  const router = useRouter()
  const params = useParams()

  // Logic to handle retaking
  const handleRetake = () => {
    // Add retake parameter to bypass route guard
    router.push(`/shift/${params.examId}?retake=true`)
  }

  return (
    <PerformanceAnalysisDashboard
      examId={params.examId as string}
      onRetake={handleRetake}
    />
  )
}