'use client'

import { useEffect, useState } from 'react'

interface TimerProps {
  durationMinutes: number
  onTimeUp: () => void
}

export default function Timer({ durationMinutes, onTimeUp }: TimerProps) {
  const [timeLeft, setTimeLeft] = useState(durationMinutes * 60) // Convert to seconds
  const [isExpired, setIsExpired] = useState(false)

  useEffect(() => {
    if (timeLeft <= 0) {
      setIsExpired(true)
      onTimeUp()
      return
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsExpired(true)
          onTimeUp()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [timeLeft, onTimeUp])

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const percentage = (timeLeft / (durationMinutes * 60)) * 100
  const isWarning = percentage < 20

  return (
    <div
      style={{
        padding: '1rem',
        backgroundColor: isExpired ? '#dc2626' : isWarning ? '#f59e0b' : '#10b981',
        color: 'white',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontWeight: '600',
        fontSize: '1.1rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }}
    >
      <span>⏱️ Time Remaining:</span>
      <span style={{ fontSize: '1.3rem', fontFamily: 'monospace' }}>
        {isExpired ? '00:00' : formatTime(timeLeft)}
      </span>
    </div>
  )
}
