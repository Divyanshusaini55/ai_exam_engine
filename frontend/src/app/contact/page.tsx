"use client"

import React, { useState } from "react"
import { apiClient } from "@/lib/apiClient"


import Link from "next/link"
import { AuthInput } from "@/components/AuthInput"

export default function ContactPage() {
    const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle")

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setStatus("submitting")

        const formData = new FormData(e.currentTarget)
        const data = {
            name: formData.get('name') as string,
            email: formData.get('email') as string,
            message: formData.get('message') as string
        }

        try {
            const res = await apiClient.post('/contact/submit/', data)

            const responseData = await res.json()

            if (responseData.success === true) {
                setStatus("success")
            } else {
                setStatus("idle")
                alert(responseData.message || "Failed to send message. Please try again.")
            }
        } catch (error) {
            console.error('Error submitting contact form:', error)
            setStatus("idle")
            alert("Failed to send message. Please try again.")
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950 px-4 relative py-12 md:py-0">
            {/* Back to Home Button */}
            <div className="absolute top-6 left-6 md:top-8 md:left-8">
                <Link
                    href="/"
                    className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors text-sm font-medium"
                >
                    <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                    Back to Home
                </Link>
            </div>

            <div className="max-w-[480px] w-full">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none p-8 md:p-10 border border-slate-100 dark:border-slate-800/50">

                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center size-12 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 mb-4 ring-4 ring-blue-50 dark:ring-blue-900/10">
                            <span className="material-symbols-outlined text-2xl">support_agent</span>
                        </div>
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
                            Contact Support
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400">
                            We'd love to hear from you. Send us a message below.
                        </p>
                    </div>

                    {status === "success" ? (
                        <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl p-8 text-center animate-fade-in">
                            <div className="inline-flex items-center justify-center size-16 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
                                <span className="material-symbols-outlined text-green-600 dark:text-green-400 text-3xl">check</span>
                            </div>
                            <h2 className="text-xl font-bold text-green-800 dark:text-green-300 mb-2">Message Sent!</h2>
                            <p className="text-green-700 dark:text-green-400 text-sm mb-6">Thank you for contacting us. We will get back to you shortly.</p>
                            <button
                                onClick={() => setStatus("idle")}
                                className="px-6 py-2 bg-white dark:bg-slate-800 text-green-700 dark:text-green-400 font-semibold rounded-lg border border-green-200 dark:border-green-800 shadow-sm hover:shadow-md transition-all text-sm"
                            >
                                Send another message
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                            <AuthInput
                                label="Full Name"
                                name="name"
                                placeholder="John Doe"
                                required
                            />

                            <AuthInput
                                label="Email Address"
                                type="email"
                                name="email"
                                placeholder="john@example.com"
                                required
                            />

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 ml-1">
                                    Message
                                </label>
                                <textarea
                                    name="message"
                                    required
                                    rows={5}
                                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-sm resize-none"
                                    placeholder="How can we help you today?"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={status === "submitting"}
                                className="w-full py-3.5 mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/25 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2 group"
                            >
                                {status === "submitting" ? (
                                    <>
                                        <span className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        Send Message
                                        <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">send</span>
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}
