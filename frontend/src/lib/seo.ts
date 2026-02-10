/**
 * SEO Metadata Helpers
 * Provides reusable metadata configurations for public and private pages
 */

import { Metadata } from 'next'

const SITE_NAME = 'Competitive Exam Platform'
const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://yoursite.com'

/**
 * Metadata for pages that should NOT be indexed by search engines
 * Use for: dashboard, profile, login, exam attempts, results, etc.
 */
export const noIndexMetadata: Metadata = {
    robots: {
        index: false,
        follow: false,
        googleBot: {
            index: false,
            follow: false,
        },
    },
}

/**
 * Generate SEO-optimized metadata for public pages
 */
export function createMetadata({
    title,
    description,
    path = '',
    ogImage,
}: {
    title: string
    description: string
    path?: string
    ogImage?: string
}): Metadata {
    const fullTitle = `${title} | ${SITE_NAME}`
    const url = `${SITE_URL}${path}`

    return {
        title: fullTitle,
        description,
        robots: {
            index: true,
            follow: true,
            googleBot: {
                index: true,
                follow: true,
            },
        },
        openGraph: {
            title: fullTitle,
            description,
            url,
            siteName: SITE_NAME,
            type: 'website',
            ...(ogImage && { images: [{ url: ogImage }] }),
        },
        twitter: {
            card: 'summary_large_image',
            title: fullTitle,
            description,
            ...(ogImage && { images: [ogImage] }),
        },
        alternates: {
            canonical: url,
        },
    }
}

/**
 * Home page metadata
 */
export const homeMetadata = createMetadata({
    title: 'Home',
    description: 'Prepare for SSC, UPSC, Railways, Defence, and Banking exams with our comprehensive test series and practice questions.',
    path: '/',
})

/**
 * Exams listing metadata
 */
export const examsMetadata = createMetadata({
    title: 'All Exams',
    description: 'Browse all available competitive exams including SSC, Banking, Railways, UPSC, and Defence exam preparation materials.',
    path: '/exams',
})

/**
 * Generate category-specific metadata
 */
export function createCategoryMetadata(categoryName: string, categorySlug: string, description?: string): Metadata {
    return createMetadata({
        title: `${categoryName} Exams`,
        description: description || `Practice tests and preparation materials for ${categoryName} competitive exams.`,
        path: `/category/${categorySlug}`,
    })
}

/**
 * Static page metadata
 */
export const contactMetadata = createMetadata({
    title: 'Contact Us',
    description: 'Get in touch with our team for support, feedback, or inquiries about our exam preparation platform.',
    path: '/contact',
})

export const helpMetadata = createMetadata({
    title: 'Help & FAQ',
    description: 'Find answers to frequently asked questions and get help with using our exam preparation platform.',
    path: '/help',
})

export const privacyMetadata = createMetadata({
    title: 'Privacy Policy',
    description: 'Read our privacy policy to understand how we collect, use, and protect your personal information.',
    path: '/privacy',
})

export const termsMetadata = createMetadata({
    title: 'Terms of Service',
    description: 'Review our terms of service and user agreement for using the exam preparation platform.',
    path: '/terms',
})
