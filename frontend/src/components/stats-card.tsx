import { LucideIcon } from "lucide-react"

interface StatsCardProps {
  icon: LucideIcon
  label: string
  value: string
  color?: "default" | "blue" | "green" | "red" | "purple"
}

const iconColorClasses: Record<string, string> = {
  default: "bg-secondary text-muted-foreground",
  blue:    "bg-secondary text-primary",
  green:   "bg-success/10 text-success",
  red:     "bg-destructive/10 text-destructive",
  purple:  "bg-secondary text-primary",
}

const valueColorClasses: Record<string, string> = {
  default: "text-primary",
  blue:    "text-primary",
  green:   "text-success",
  red:     "text-destructive",
  purple:  "text-primary",
}

export function StatsCard({ icon: Icon, label, value, color = "default" }: StatsCardProps) {
  return (
    <div className="card-premium p-5 rounded-xl flex flex-col items-center justify-center gap-1 hover:-translate-y-1 transition-transform duration-300">
      <div className={`p-2 rounded-full mb-1 ${iconColorClasses[color]}`}>
        <Icon className="size-5" />
      </div>
      <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold ${valueColorClasses[color]}`}>{value}</p>
    </div>
  )
}