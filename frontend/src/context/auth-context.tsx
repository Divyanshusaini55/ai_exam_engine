"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface User {
    id: number
    username: string
    email: string
    date_joined: string
}

interface AuthContextType {
    user: User | null
    loading: boolean
    login: (token: string, user: User) => void
    logout: () => void
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    login: () => { },
    logout: () => { },
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const router = useRouter()

    useEffect(() => {
        const token = localStorage.getItem("auth_token")
        if (token) {
            fetchUser(token)
        } else {
            setLoading(false)
        }
    }, [])

    const fetchUser = async (token: string) => {
        try {
            const res = await fetch("http://127.0.0.1:8000/api/auth/user/", {
                headers: {
                    "Authorization": `Token ${token}`
                }
            })

            if (res.ok) {
                const data = await res.json()
                setUser(data)
            } else {
                // Invalid token
                logout()
            }
        } catch (error) {
            console.error("Auth check failed", error)
            logout()
        } finally {
            setLoading(false)
        }
    }

    const login = (token: string, userData: User) => {
        localStorage.setItem("auth_token", token)
        setUser(userData)
        // Redirection should be handled by the component calling login
    }

    const logout = () => {
        localStorage.removeItem("auth_token")
        setUser(null)
        // Redirect to login with current path (if not already on login)
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
            router.push(`/login?redirectTo=${encodeURIComponent(window.location.pathname)}`)
        } else {
            router.push("/login")
        }
    }

    return (
        <AuthContext.Provider value={{ user, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)
