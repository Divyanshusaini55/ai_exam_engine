"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth-context'

/**
 * Auth guard hook for protected routes.
 * Redirects to login if user is not authenticated.
 * 
 * @param redirectPath - The path the user was trying to access (for redirect after login)
 * @returns { user, loading, isAuthenticated }
 */
export function useAuthGuard(redirectPath: string = '/dashboard') {
    const { user, loading } = useAuth()
    const router = useRouter()

    useEffect(() => {
        // Only redirect if auth check is complete and user is not authenticated
        if (!loading && !user) {
            // Use replace to avoid adding to history (allows back button to work)
            router.replace(`/login?redirectTo=${encodeURIComponent(redirectPath)}&from=auth-guard`)
        }
    }, [user, loading, router, redirectPath])

    return {
        user,
        loading,
        isAuthenticated: !!user
    }
}
