'use client'

import { useEffect, useState } from 'react'
import { Play, Pause, RotateCcw } from 'lucide-react'

interface TimerProps {
  durationMinutes: number
  onTimeUp: () => void
  mode?: 'exam' | 'learning'
}

export default function Timer({ durationMinutes, onTimeUp, mode = 'exam' }: TimerProps) {
  const [timeLeft, setTimeLeft] = useState(durationMinutes * 60) // Convert to seconds
  const [isExpired, setIsExpired] = useState(false)
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    setTimeLeft(durationMinutes * 60)
    setIsExpired(false)
    setIsPaused(false)
  }, [durationMinutes])

  useEffect(() => {
    if (timeLeft <= 0) {
      setIsExpired(true)
      onTimeUp()
      return
    }

    if (isPaused) return

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
  }, [timeLeft, onTimeUp, isPaused])

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

  const handleReset = () => {
    setTimeLeft(durationMinutes * 60)
    setIsExpired(false)
    setIsPaused(false)
  }

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
        gap: '1rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span>⏱️ Time Remaining:</span>
        <span style={{ fontSize: '1.3rem', fontFamily: 'monospace' }}>
          {isExpired ? '00:00' : formatTime(timeLeft)}
        </span>
      </div>

      {mode === 'learning' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={() => setIsPaused(!isPaused)}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 8px',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isPaused ? <Play size={16} fill="white" /> : <Pause size={16} fill="white" />}
          </button>
          <button
            onClick={handleReset}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 8px',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <RotateCcw size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
