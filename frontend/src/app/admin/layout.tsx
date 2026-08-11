"use client"

import { useState } from "react"
import { AdminGuard } from "@/components/admin/AdminGuard"
import { AdminSidebar } from "@/components/admin/AdminSidebar"
import { AdminHeader } from "@/components/admin/AdminHeader"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <AdminGuard>
      <div className="min-h-screen bg-background flex text-foreground font-sans">
        <AdminSidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
        <div className="flex-1 flex flex-col min-w-0">
          <AdminHeader onMobileMenuClick={() => setMobileOpen(true)} />
          <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </AdminGuard>
  )
}
