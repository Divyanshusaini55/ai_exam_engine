"use client"

import { getCategoryHomeColors, getCategoryHomeIcon } from "@/lib/category-home-icons"
import { cn } from "@/lib/utils"

export type CategoryHomeIconProps = {
  /** Backend icon key, e.g. school */
  iconName?: string | null
  /** Category or subcategory display name / slug — drives colors + icon fallback */
  categoryLabel: string
  apiBg?: string | null
  apiIcon?: string | null
  className?: string
}

/**
 * Exact same icon tile as homepage `CategoryGrid`:
 * size-12, rounded-[14px], border, shadow-sm, size-6 icon, group-hover scale + rotate.
 */
export function CategoryHomeIcon({
  iconName = "",
  categoryLabel,
  apiBg,
  apiIcon,
  className,
}: CategoryHomeIconProps) {
  const Icon = getCategoryHomeIcon(iconName || "", categoryLabel)
  const colors = getCategoryHomeColors(categoryLabel, apiBg, apiIcon)

  return (
    <div
      className={cn(
        "flex size-12 shrink-0 items-center justify-center rounded-[14px] border border-border shadow-sm transition-transform duration-300",
        "group-hover:scale-105 group-hover:-rotate-3",
        colors.bg,
        className
      )}
    >
      <Icon className={cn("size-6", colors.icon)} />
    </div>
  )
}
