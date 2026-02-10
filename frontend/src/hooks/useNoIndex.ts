// Helper function to add noindex meta tag for client components
// Copy this function into any client component that needs noindex

import { useEffect } from 'react'

export function useNoIndex() {
    useEffect(() => {
        const metaRobots = document.querySelector('meta[name="robots"]')
        if (metaRobots) {
            metaRobots.setAttribute('content', 'noindex, nofollow')
        } else {
            const meta = document.createElement('meta')
            meta.name = 'robots'
            meta.content = 'noindex, nofollow'
            document.head.appendChild(meta)
        }
    }, [])
}
