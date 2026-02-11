"use client"

import React, { useState } from "react"
import { apiClient } from "@/lib/apiClient"


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
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 md:px-8">
            <div className="max-w-2xl mx-auto">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Contact Support</h1>
                <p className="text-slate-500 mb-8">We'd love to hear from you. Send us a message below.</p>

                {status === "success" ? (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center animate-fade-in">
                        <span className="material-symbols-outlined text-green-600 text-5xl mb-4">check_circle</span>
                        <h2 className="text-2xl font-bold text-green-800 mb-2">Message Sent!</h2>
                        <p className="text-green-700">Thank you for contacting us. We will get back to you shortly.</p>
                        <button
                            onClick={() => setStatus("idle")}
                            className="mt-6 text-green-800 font-bold underline hover:no-underline"
                        >
                            Send another message
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Name</label>
                            <input
                                type="text"
                                name="name"
                                required
                                className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                placeholder="John Doe"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Email</label>
                            <input
                                type="email"
                                name="email"
                                required
                                className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                placeholder="john@example.com"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Message</label>
                            <textarea
                                name="message"
                                required
                                rows={5}
                                className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all resize-none"
                                placeholder="How can we help you?"
                            />
                        </div>

                        <div className="flex justify-center">
                            <button
                                type="submit"
                                disabled={status === "submitting"}
                                className="group relative w-full md:w-auto px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-[1.02] active:scale-95 transition-all duration-300 overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <span className="relative z-10 flex items-center gap-2">
                                    {status === "submitting" ? (
                                        <>
                                            <span className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                            Sending...
                                        </>
                                    ) : (
                                        <>
                                            Send Message
                                            <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">send</span>
                                        </>
                                    )}
                                </span>

                                {/* Glossy Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 pointer-events-none" />
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    )
}
