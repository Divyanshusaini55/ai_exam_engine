import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getAvatarUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace('/api', '') || 'http://127.0.0.1:8000';
  
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1' || parsedUrl.port === '8000' || parsedUrl.port === '9000') {
        return `${apiBaseUrl}${parsedUrl.pathname}${parsedUrl.search}`;
      }
      if (parsedUrl.hostname.includes('examintel.in') && parsedUrl.protocol === 'http:') {
        return url.replace('http://', 'https://');
      }
      return url;
    } catch (e) {
      return url;
    }
  }
  
  return `${apiBaseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
}
