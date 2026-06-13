"use client"
import { useState, useEffect } from "react"
import { BookOpen, Target, Clock, Globe } from "lucide-react"
import { examApi } from "@/lib/api"

export function ExamPreferencesSection({ settings, setSettings, updateSettings, loading }: any) {
    const [groupedExams, setGroupedExams] = useState<Record<string, any[]>>({});
    const [loadingExams, setLoadingExams] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState<string>("");

    useEffect(() => {
        examApi.getSubcategories({ limit: 100 }).then(res => {
            const subs = res.data.results || [];
            const groups: Record<string, any[]> = {};
            subs.forEach((sub: any) => {
                const catName = sub.category_name || "Other";
                if (!groups[catName]) groups[catName] = [];
                groups[catName].push(sub);
            });
            setGroupedExams(groups);
            setLoadingExams(false);

            // Initialize selectedCategory if primary_exam is already set
            if (settings?.preferences?.primary_exam) {
                const primarySub = subs.find((s: any) => s.id === settings.preferences.primary_exam);
                if (primarySub) {
                    setSelectedCategory(primarySub.category_name);
                }
            }
        }).catch(err => {
            console.error("Failed to fetch subcategories", err);
            setLoadingExams(false);
        });
    }, [settings?.preferences?.primary_exam]);

    if (!settings) return null;

    const languages = [
        { id: "en", label: "English" },
        { id: "hi", label: "Hindi" },
        { id: "bi", label: "Bilingual" }
    ]

    const goals = [
        { id: 30, label: "30 mins/day" },
        { id: 60, label: "1 hour/day" },
        { id: 120, label: "2 hours/day" },
        { id: 240, label: "4+ hours/day" }
    ]

    return (
        <section className="animate-fade-in space-y-6">
            <div>
                <h2 className="text-xl font-bold text-primary flex items-center gap-2">
                    <Target className="size-5" />
                    Exam Preferences
                </h2>
                <p className="text-sm text-muted-foreground mt-1">Personalize your learning experience.</p>
            </div>
            
            <div className="card-premium p-6 bg-card border border-border shadow-sm rounded-[24px] space-y-8">
                
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                        <BookOpen className="size-4 text-muted-foreground" />
                        Target Exams
                    </h3>
                    <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Target Category</label>
                        <select 
                            className="w-full mt-1.5 p-3 rounded-xl border border-border bg-secondary/50 text-primary font-medium focus:outline-none focus:border-primary/50"
                            value={selectedCategory}
                            onChange={(e) => {
                                setSelectedCategory(e.target.value);
                                // Optional: Reset primary exam if they change categories
                                if (e.target.value !== selectedCategory) {
                                    setSettings({...settings, preferences: {...settings.preferences, primary_exam: null}});
                                }
                            }}
                        >
                            <option value="">Select your target category</option>
                            {loadingExams ? (
                                <option value="" disabled>Loading categories...</option>
                            ) : (
                                Object.keys(groupedExams).map(catName => (
                                    <option key={catName} value={catName}>{catName}</option>
                                ))
                            )}
                        </select>
                    </div>

                    {selectedCategory && (
                        <div className="animate-fade-in">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Primary Exam</label>
                            <select 
                                className="w-full mt-1.5 p-3 rounded-xl border border-border bg-secondary/50 text-primary font-medium focus:outline-none focus:border-primary/50"
                                value={settings.preferences.primary_exam || ""}
                                onChange={(e) => setSettings({...settings, preferences: {...settings.preferences, primary_exam: e.target.value ? Number(e.target.value) : null}})}
                            >
                                <option value="">Select your main exam</option>
                                {groupedExams[selectedCategory]?.map(exam => (
                                    <option key={exam.id} value={exam.id}>{exam.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    {selectedCategory && (
                        <div className="animate-fade-in">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Secondary Exams (Optional)</label>
                            <p className="text-xs text-muted-foreground mb-2">Select other exams you're interested in</p>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-2">
                                    {groupedExams[selectedCategory]?.map((exam) => {
                                        const isChecked = settings.preferences.secondary_exams?.includes(exam.id) || false;
                                        return (
                                        <label key={exam.id} className="flex items-center gap-2 p-2 rounded-lg border border-border/50 hover:bg-secondary/20 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={isChecked}
                                                onChange={(e) => {
                                                    let newExams = settings.preferences.secondary_exams || [];
                                                    if (e.target.checked) {
                                                        newExams = [...newExams, exam.id];
                                                    } else {
                                                        newExams = newExams.filter((id: number) => id !== exam.id);
                                                    }
                                                    setSettings({...settings, preferences: {...settings.preferences, secondary_exams: newExams}});
                                                }}
                                                className="rounded text-primary focus:ring-primary accent-primary" 
                                            />
                                            <span className="text-sm font-medium text-primary">{exam.name}</span>
                                        </label>
                                    )})}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="h-px bg-border/50" />

                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                        <Globe className="size-4 text-muted-foreground" />
                        Preferred Language
                    </h3>
                    <div className="flex flex-wrap gap-3">
                        {languages.map(lang => (
                            <button
                                key={lang.id}
                                onClick={() => setSettings({...settings, preferences: {...settings.preferences, preferred_language: lang.id}})}
                                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
                                    settings.preferences.preferred_language === lang.id 
                                    ? "bg-primary text-primary-foreground border-primary" 
                                    : "bg-card text-muted-foreground border-border hover:border-primary/50"
                                }`}
                            >
                                {lang.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="h-px bg-border/50" />

                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                        <Clock className="size-4 text-muted-foreground" />
                        Daily Study Goal
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {goals.map(goal => (
                            <button
                                key={goal.id}
                                onClick={() => setSettings({...settings, preferences: {...settings.preferences, daily_study_goal: goal.id}})}
                                className={`p-3 rounded-xl text-sm font-bold transition-all border text-center ${
                                    settings.preferences.daily_study_goal === goal.id 
                                    ? "bg-primary/10 text-primary border-primary" 
                                    : "bg-card text-muted-foreground border-border hover:border-primary/50"
                                }`}
                            >
                                {goal.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="pt-4 flex justify-end">
                    <button 
                        onClick={updateSettings}
                        disabled={loading}
                        className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-sm hover:opacity-90 disabled:opacity-50 transition-all"
                    >
                        Save Preferences
                    </button>
                </div>
            </div>
        </section>
    )
}
