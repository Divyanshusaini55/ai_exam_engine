"use client"

import React, { useState } from "react"
import { miscApi } from "@/lib/api"
import Link from "next/link"
import { AuthInput } from "@/components/AuthInput"
import { ArrowLeft, Headphones, Check, Send, Loader2 } from "lucide-react"

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
            const res = await miscApi.submitContactForm(data)
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
        <div className="min-h-screen flex items-center justify-center bg-background px-4 relative py-16 overflow-hidden">
            {/* Ambient Blurs */}
            <div className="absolute top-[-10%] left-[-10%] size-[500px] rounded-full bg-secondary/80 blur-[150px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-5%] size-[400px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />

            {/* Back to Home Button */}
            <div className="absolute top-8 left-8 z-10">
                <Link prefetch={false}
                    href="/"
                    className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-all duration-300 text-sm font-bold group"
                >
                    <ArrowLeft className="size-4.5 transition-transform duration-300 group-hover:-translate-x-1" />
                    Back to Home
                </Link>
            </div>

            <div className="max-w-[520px] w-full relative z-10">
                {/* Card */}
                <div className="card-premium p-10 md:p-12 shadow-2xl">

                    {/* Header */}
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center justify-center size-14 rounded-[16px] bg-secondary text-primary mb-6 shadow-sm">
                            <Headphones className="size-7" />
                        </div>
                        <h1 className="text-[34px] font-bold font-heading text-primary mb-2 tracking-tight">
                            Contact Support
                        </h1>
                        <p className="text-muted-foreground font-medium text-[16px]">
                            We&apos;d love to hear from you. Send us a message below.
                        </p>
                    </div>
 
                    {status === "success" ? (
                        <div className="bg-secondary/50 border border-border rounded-premium p-10 text-center animate-fade-in">
                            <div className="inline-flex items-center justify-center size-16 bg-success/10 rounded-[18px] mb-5">
                                <Check className="size-8 text-success" />
                            </div>
                            <h2 className="text-[22px] font-bold font-heading text-primary mb-2">Message Sent!</h2>
                            <p className="text-muted-foreground font-medium mb-8">Thank you for contacting us. We&apos;ll get back to you shortly.</p>
                            <button
                                onClick={() => setStatus("idle")}
                                className="px-6 py-3 bg-card text-primary font-bold rounded-xl border border-border shadow-sm hover:-translate-y-0.5 hover:shadow-premium transition-all duration-300 text-sm"
                            >
                                Send another message
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                            <AuthInput
                                label="Full Name"
                                name="name"
                                placeholder="Your Name"
                                required
                            />

                            <AuthInput
                                label="Email Address"
                                type="email"
                                name="email"
                                placeholder="Your Email Address"
                                required
                            />

                            <div>
                                <label className="block text-sm font-bold text-primary mb-2 uppercase tracking-widest text-[11px]">
                                    Message
                                </label>
                                <textarea
                                    name="message"
                                    required
                                    rows={5}
                                    className="w-full px-4 py-3.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/10 focus:border-primary/30 outline-none transition-all duration-300 placeholder:text-muted-foreground/60 text-primary font-medium shadow-sm resize-none"
                                    placeholder="How can we help you today?"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={status === "submitting"}
                                className="w-full py-2 mt-2 bg-primary text-primary-foreground font-bold rounded-xl shadow-premium hover:-translate-y-1 hover:shadow-[0_15px_30px_rgba(0,0,0,0.15)] transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex justify-center items-center gap-2 group"
                            >
                                {status === "submitting" ? (
                                    <>
                                        <Loader2 className="size-5 animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        Send Message
                                        <Send className="size-4.5 transition-transform duration-300 group-hover:translate-x-1" />
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
