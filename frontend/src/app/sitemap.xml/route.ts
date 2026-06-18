import { NextResponse } from 'next/server'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.examintel.in'
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000/api'

interface Category {
    id: number
    slug: string
    name: string
    updated_at?: string
}

interface Subcategory {
    id: number
    slug: string
    category_slug: string
    name: string
    updated_at?: string
}

interface Exam {
    id: number
    slug: string
    updated_at?: string
}

async function fetchCategories(): Promise<Category[]> {
    try {
        const res = await fetch(`${API_BASE_URL}/categories/`, {
            next: { revalidate: 3600 } 
        })
        if (!res.ok) return []
        const data = await res.json()
        return data.results || data || []
    } catch (error) {
        console.error('Error fetching categories for sitemap:', error)
        return []
    }
}

async function fetchSubcategories(): Promise<Subcategory[]> {
    try {
        const res = await fetch(`${API_BASE_URL}/subcategories/`, {
            next: { revalidate: 3600 } 
        })
        if (!res.ok) return []
        const data = await res.json()
        return data.results || data || []
    } catch (error) {
        console.error('Error fetching subcategories for sitemap:', error)
        return []
    }
}

async function fetchExams(): Promise<Exam[]> {
    try {
        const res = await fetch(`${API_BASE_URL}/exams/`, {
            next: { revalidate: 3600 } // Cache for 1 hour
        })
        if (!res.ok) return []
        const data = await res.json()
        return data.results || data || []
    } catch (error) {
        console.error('Error fetching exams for sitemap:', error)
        return []
    }
}


function generateSitemapXML(categories: Category[], subcategories: Subcategory[], exams: Exam[]): string {
    const currentDate = new Date().toISOString().split('T')[0]

    const staticUrls = [
        // Home
        {
            loc: `${BASE_URL}/`,
            lastmod: currentDate,
            changefreq: 'daily',
            priority: '1.0',
        },
        // Main listings
        {
            loc: `${BASE_URL}/exams`,
            lastmod: currentDate,
            changefreq: 'daily',
            priority: '0.9',
        },
        // Static pages
        {
            loc: `${BASE_URL}/contact`,
            lastmod: currentDate,
            changefreq: 'monthly',
            priority: '0.5',
        },
        {
            loc: `${BASE_URL}/help`,
            lastmod: currentDate,
            changefreq: 'monthly',
            priority: '0.5',
        },
        {
            loc: `${BASE_URL}/privacy`,
            lastmod: currentDate,
            changefreq: 'monthly',
            priority: '0.5',
        },
        {
            loc: `${BASE_URL}/terms`,
            lastmod: currentDate,
            changefreq: 'monthly',
            priority: '0.5',
        },
    ]

    // Category pages
    const categoryUrls = categories.map((cat) => ({
        loc: `${BASE_URL}/category/${cat.slug}`,
        lastmod: cat.updated_at || currentDate,
        changefreq: 'weekly',
        priority: '0.8',
    }))

    // Subcategory pages
    const subcategoryUrls = subcategories.map((subcat) => ({
        loc: `${BASE_URL}/category/${subcat.category_slug}/${subcat.slug}`,
        lastmod: subcat.updated_at || currentDate,
        changefreq: 'weekly',
        priority: '0.7',
    }))

    // Exam pages
    const examUrls = exams.map((exam) => ({
        loc: `${BASE_URL}/exam/${exam.slug}`,
        lastmod: exam.updated_at || currentDate,
        changefreq: 'weekly',
        priority: '0.8',
    }))

    // Summary pages
    const summaryUrls = exams.map((exam) => ({
        loc: `${BASE_URL}/summary/${exam.slug}`,
        lastmod: exam.updated_at || currentDate,
        changefreq: 'weekly',
        priority: '0.6',
    }))

    const allUrls = [...staticUrls, ...categoryUrls, ...subcategoryUrls, ...examUrls, ...summaryUrls]

    const urlsXML = allUrls
        .map(
            (url) => `
  <url>
    <loc>${url.loc}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`
        )
        .join('')

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">${urlsXML}
</urlset>`
}


export async function GET() {
    try {
        // Fetch dynamic content
        const [categories, subcategories, exams] = await Promise.all([
            fetchCategories(),
            fetchSubcategories(),
            fetchExams(),
        ])

        // Generate sitemap XML
        const sitemap = generateSitemapXML(categories, subcategories, exams)

        // Return with proper headers
        return new NextResponse(sitemap, {
            status: 200,
            headers: {
                'Content-Type': 'application/xml',
                'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
            },
        })
    } catch (error) {
        console.error('Error generating sitemap:', error)
        return new NextResponse('Error generating sitemap', { status: 500 })
    }
}

export const dynamic = 'force-dynamic'
export const revalidate = 3600 
