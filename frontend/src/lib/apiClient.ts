/**
 * @deprecated Use api.ts instead.
 * This file will be deleted after migration is verified.
 */

import { redirect } from 'next/navigation';
import { logApi, logAbort } from './debug';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000/api';

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    if (API_BASE_URL.includes('localhost') || API_BASE_URL.includes('127.0.0.1')) {
        console.error("CRITICAL: Production App is trying to connect to Localhost!");
    }
}

function getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
}

interface FetchOptions extends RequestInit {
    requireAuth?: boolean;
}

export const apiClient = {
    async fetch(endpoint: string, options: FetchOptions = {}) {
        const { requireAuth = true, headers = {}, ...restOptions } = options;
        let url = endpoint;
        if (!endpoint.startsWith('http')) {
            const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
            const cleanBase = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
            url = `${cleanBase}${cleanEndpoint}`;
        }
        const defaultHeaders: Record<string, string> = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        if (typeof window !== 'undefined') {
            const token = localStorage.getItem('auth_token');
            if (token) {
                defaultHeaders['Authorization'] = `Token ${token}`;
            }
        }
        if (options.method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method.toUpperCase())) {
            const csrfToken = getCookie('csrftoken');
            if (csrfToken) {
                defaultHeaders['X-CSRFToken'] = csrfToken;
            }
        }

        const mergedHeaders = { ...defaultHeaders, ...(headers as Record<string, string>) };

        try {
            logApi(url, options.method || 'GET', 'START');
            const response = await fetch(url, {
                ...restOptions,
                headers: mergedHeaders,
                credentials: 'include', 
            });
            logApi(url, options.method || 'GET', `END - Status: ${response.status}`);

            if (response.status === 401 && requireAuth) {
                if (typeof window !== 'undefined') {
                    const pathname = window.location.pathname;
                    if (!pathname.includes('/login') && !pathname.includes('/signup')) {
                        console.warn("Unauthorized: Token might be expired.");
                    }
                }
            }

            return response;

        } catch (error: any) {
            if (error.name === 'AbortError') {
                logAbort(url);
            }
            console.error(`API Request Failed for ${url}:`, error);
            throw error;
        }
    },
    get(endpoint: string, options: FetchOptions = {}) {
        return this.fetch(endpoint, { ...options, method: 'GET' });
    },
    post(endpoint: string, body: any, options: FetchOptions = {}) {
        return this.fetch(endpoint, {
            ...options,
            method: 'POST',
            body: JSON.stringify(body),
        });
    },
    put(endpoint: string, body: any, options: FetchOptions = {}) {
        return this.fetch(endpoint, {
            ...options,
            method: 'PUT',
            body: JSON.stringify(body),
        });
    },
    delete(endpoint: string, options: FetchOptions = {}) {
        return this.fetch(endpoint, { ...options, method: 'DELETE' });
    }
};
