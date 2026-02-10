interface CircularProgressProps {
    percentage: number
  }
  
  export function CircularProgress({ percentage }: CircularProgressProps) {
    const radius = 44
    const circumference = 2 * Math.PI * radius
    const offset = circumference - (percentage / 100) * circumference
  
    return (
      <div className="relative size-48">
        <svg className="w-full h-full" viewBox="0 0 100 100">
          {/* Background Circle */}
          <circle
            cx="50"
            cy="50"
            fill="none"
            r={radius}
            stroke="currentColor"
            strokeWidth="4"
            className="text-slate-200 dark:text-slate-700"
          />
  
          {/* Progress Circle */}
          <circle
            cx="50"
            cy="50"
            fill="none"
            r={radius}
            stroke="currentColor"
            strokeWidth="4"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="text-green-600 dark:text-green-400 transition-all duration-1000"
          />
  
          {/* Percentage Text */}
          <text
            x="50"
            y="55"
            textAnchor="middle"
            className="fill-slate-900 dark:fill-white font-bold text-2xl"
            fontSize="24"
            fontWeight="bold"
          >
            {percentage}%
          </text>
        </svg>
      </div>
    )
  }