import { redirect } from 'next/navigation';

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000/api';

// Strict Check for Production
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    if (API_BASE_URL.includes('localhost') || API_BASE_URL.includes('127.0.0.1')) {
        console.error("CRITICAL: Production App is trying to connect to Localhost!");
    }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Retrieves a cookie by name. use for getting csrftoken.
 */
function getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
}

// -----------------------------------------------------------------------------
// Main API Client
// -----------------------------------------------------------------------------

interface FetchOptions extends RequestInit {
    requireAuth?: boolean;
}

export const apiClient = {
    /**
     * General fetch wrapper
     */
    async fetch(endpoint: string, options: FetchOptions = {}) {
        const { requireAuth = true, headers = {}, ...restOptions } = options;

        // 1. Prepare URL
        // Ensure endpoint starts with / if not provided, but handle full URLs gracefully if passed by mistake
        let url = endpoint;
        if (!endpoint.startsWith('http')) {
            const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
            // Remove trailing slash from base if present to avoid double slash
            const cleanBase = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
            url = `${cleanBase}${cleanEndpoint}`;
        }

        // 2. Prepare Headers
        const defaultHeaders: Record<string, string> = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        // 3. Attach Authentication Token (from LocalStorage)
        if (typeof window !== 'undefined') {
            const token = localStorage.getItem('auth_token');
            if (token) {
                defaultHeaders['Authorization'] = `Token ${token}`;
            }
        }

        // 4. Attach CSRF Token (for POST/PUT/DELETE/PATCH)
        if (options.method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method.toUpperCase())) {
            const csrfToken = getCookie('csrftoken');
            if (csrfToken) {
                defaultHeaders['X-CSRFToken'] = csrfToken;
            }
        }

        // Merge custom headers
        const mergedHeaders = { ...defaultHeaders, ...(headers as Record<string, string>) };

        // 5. Execute Request
        try {
            const response = await fetch(url, {
                ...restOptions,
                headers: mergedHeaders,
                credentials: 'include', // Needed for session cookies
            });

            // 6. Handle 401 Unauthorized
            if (response.status === 401 && requireAuth) {
                // Determine if we should redirect
                if (typeof window !== 'undefined') {
                    const pathname = window.location.pathname;
                    if (!pathname.includes('/login') && !pathname.includes('/signup')) {
                        console.warn("Unauthorized: Token might be expired.");
                        // Optional: clean up token
                        // localStorage.removeItem('auth_token');
                    }
                }
            }

            return response;

        } catch (error) {
            console.error(`API Request Failed for ${url}:`, error);
            throw error;
        }
    },

    /**
     * Helper for GET requests
     */
    get(endpoint: string, options: FetchOptions = {}) {
        return this.fetch(endpoint, { ...options, method: 'GET' });
    },

    /**
     * Helper for POST requests
     */
    post(endpoint: string, body: any, options: FetchOptions = {}) {
        return this.fetch(endpoint, {
            ...options,
            method: 'POST',
            body: JSON.stringify(body),
        });
    },

    /**
     * Helper for PUT requests
     */
    put(endpoint: string, body: any, options: FetchOptions = {}) {
        return this.fetch(endpoint, {
            ...options,
            method: 'PUT',
            body: JSON.stringify(body),
        });
    },

    /**
     * Helper for DELETE requests
     */
    delete(endpoint: string, options: FetchOptions = {}) {
        return this.fetch(endpoint, { ...options, method: 'DELETE' });
    }
};
