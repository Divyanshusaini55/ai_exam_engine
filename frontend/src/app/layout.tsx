import type { Metadata } from "next"
import { Inter, Sora, Crimson_Pro, Cormorant_Garamond, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import "katex/dist/katex.min.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })
const sora = Sora({ subsets: ["latin"], variable: "--font-heading" })
const crimsonPro = Crimson_Pro({ subsets: ["latin"], variable: "--font-crimson-pro" })
const cormorantGaramond = Cormorant_Garamond({ subsets: ["latin"], weight: ["300", "400", "600"], variable: "--font-cormorant", style: ['normal', 'italic'] })
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" })

export const metadata: Metadata = {
  // Add this metadataBase line
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://your-production-domain.com'),
  title: {
    default: "ExamIntel",
    template: "%s | ExamIntel"
  },
  description: "Competitive Exam Preparation",
  // Optional: add openGraph defaults if you have a site-wide logo/og-image
  openGraph: {
    images: ['/og-image.png'],
  },
}

import { AuthProvider } from "@/context/auth-context"
import { ExamLanguageProvider } from "@/context/exam-language-context"
import { Footer } from "@/components/footer"
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", inter.variable, sora.variable, crimsonPro.variable, cormorantGaramond.variable, jetbrainsMono.variable)}>
      <head>
        {/* Precise Mobile Browser Theme Colors */}
        <meta name="theme-color" content="#F8F6F2" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#111111" media="(prefers-color-scheme: dark)" />
      </head>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <ExamLanguageProvider>
              {children}
              <Footer />
            </ExamLanguageProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}