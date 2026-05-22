"use client"

import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"

interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string
}

export function AuthInput({ label, type = "text", className = "", ...props }: AuthInputProps) {
    const [showPassword, setShowPassword] = useState(false)
    const isPassword = type === "password"

    return (
        <div className="w-full group">
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2 transition-colors group-focus-within:text-primary">
                {label}
            </label>
            <div className="relative">
                <input
                    type={isPassword ? (showPassword ? "text" : "password") : type}
                    className={`w-full px-4 py-3.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/10 focus:border-primary/30 outline-none transition-all duration-300 placeholder:text-muted-foreground/60 text-primary font-medium shadow-sm ${className}`}
                    {...props}
                />
                {isPassword && (
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-primary transition-colors p-1"
                    >
                        {showPassword ? (
                            <EyeOff className="size-5" />
                        ) : (
                            <Eye className="size-5" />
                        )}
                    </button>
                )}
            </div>
        </div>
    )
}
