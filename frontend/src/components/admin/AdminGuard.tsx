"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/auth-context"

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace("/login?redirect=/admin")
      } else if (!user.is_staff && !user.is_superuser) {
        router.replace("/dashboard")
      }
    }
  }, [user, loading, router])

  if (loading || !user || (!user.is_staff && !user.is_superuser)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground text-xs font-medium">Verifying Admin Access...</p>
      </div>
    )
  }

  return <>{children}</>
}
