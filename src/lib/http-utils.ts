import { FETCH_TIMEOUT_MS } from './config'

/**
 * Perform a fetch request with a timeout.
 * @param url The URL to fetch.
 * @param options Fetch options.
 * @param timeoutMs Timeout in milliseconds. Defaults to FETCH_TIMEOUT_MS.
 */
export async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeoutMs)
    try {
        const resp = await fetch(url, {
            ...options,
            signal: controller.signal,
            keepalive: options.keepalive ?? true,
        })
        return resp
    } finally {
        clearTimeout(id)
    }
}
