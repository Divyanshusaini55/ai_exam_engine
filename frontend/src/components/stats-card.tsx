interface StatsCardProps {
    icon: string
    label: string
    value: string
    color?: "default" | "blue" | "green" | "red" | "purple"
  }
  
  const colorClasses = {
    default: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300",
    blue: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
    green: "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400",
    red: "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400",
    purple: "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400",
  }
  
  export function StatsCard({ icon, label, value, color = "default" }: StatsCardProps) {
    const textColor =
      color === "default"
        ? "text-slate-900 dark:text-white"
        : color === "green"
          ? "text-green-600 dark:text-green-400"
          : color === "red"
            ? "text-red-600 dark:text-red-400"
            : "text-slate-900 dark:text-white"
  
    return (
      <div className="glass-panel p-5 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center gap-1 hover:-translate-y-1 transition-transform duration-300">
        <div className={`p-2 rounded-full mb-1 ${colorClasses[color]}`}>
          <span className="text-xl">{icon}</span>
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">{label}</p>
        <p className={`text-2xl font-bold ${textColor}`}>{value}</p>
      </div>
    )
  }