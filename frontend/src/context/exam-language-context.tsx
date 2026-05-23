"use client"

import React, { createContext, useContext, useState } from "react"

export type Language = "en" | "hi"

interface ExamLanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
}

const ExamLanguageContext = createContext<ExamLanguageContextType | undefined>(undefined)

export function ExamLanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("en")

  return (
    <ExamLanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </ExamLanguageContext.Provider>
  )
}

export function useExamLanguage() {
  const context = useContext(ExamLanguageContext)
  if (!context) {
    throw new Error("useExamLanguage must be used within an ExamLanguageProvider")
  }
  return context
}
