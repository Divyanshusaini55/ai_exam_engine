"use client"
import { Database, Download } from "lucide-react"
import { useState } from "react"

import { api } from "@/lib/api"

export function DataPrivacySection({ settings }: any) {
    const [exporting, setExporting] = useState(false)

    if (!settings) return null;

    const handleExport = async () => {
        setExporting(true)
        try {
            const { data } = await api.post("/community/settings/export/")
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = "examintel_data.json"
            a.click()
        } catch (error) {
            console.error("Export failed", error)
        } finally {
            setExporting(false)
        }
    }

    return (
        <section className="animate-fade-in space-y-6">
            <div>
                <h2 className="text-xl font-bold text-primary flex items-center gap-2">
                    <Database className="size-5" />
                    Data & Privacy
                </h2>
                <p className="text-sm text-muted-foreground mt-1">Manage your data and privacy settings.</p>
            </div>
            
            <div className="card-premium p-6 bg-card border border-border shadow-sm rounded-[24px] space-y-6">
                <div>
                    <h3 className="text-sm font-bold text-primary mb-2">Export Your Data</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        Download a copy of your ExamIntel data, including your profile information, exam history, and contribution logs in JSON format.
                    </p>
                    <button 
                        onClick={handleExport}
                        disabled={exporting}
                        className="px-6 py-2.5 rounded-xl bg-secondary text-primary text-sm font-bold shadow-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2"
                    >
                        <Download className="size-4" />
                        {exporting ? "Exporting..." : "Export Data"}
                    </button>
                </div>

                <div className="h-px bg-border/50" />

                <div>
                    <h3 className="text-sm font-bold text-primary mb-2">Privacy Policy</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        Read our privacy policy to understand how we collect, use, and protect your personal data.
                    </p>
                    <a href="#" className="text-sm font-bold text-primary hover:underline">
                        View Privacy Policy &rarr;
                    </a>
                </div>
            </div>
        </section>
    )
}
