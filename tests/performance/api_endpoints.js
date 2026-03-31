/**
 * k6 Performance Test — API Endpoints
 *
 * Stress-tests critical API routes to validate latency under load.
 *
 * Run: k6 run tests/performance/api_endpoints.js
 */

import http from 'k6/http'
import { check, sleep } from 'k6'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

export const options = {
    stages: [
        { duration: '20s', target: 30 },
        { duration: '1m',  target: 80 },
        { duration: '20s', target: 0 },
    ],
    thresholds: {
        'http_req_duration{name:search}':       ['p(95)<500'],
        'http_req_duration{name:settings}':     ['p(95)<300'],
        'http_req_duration{name:sponsors}':     ['p(95)<300'],
        'http_req_duration{name:subscribe}':    ['p(95)<500'],
        http_req_failed: ['rate<0.02'],
    },
}

export default function () {
    // Search
    const searchRes = http.get(`${BASE_URL}/api/search?q=test`, { tags: { name: 'search' } })
    check(searchRes, { 'Search: 200': (r) => r.status === 200 })

    // Site settings
    const settingsRes = http.get(`${BASE_URL}/api/site-settings`, { tags: { name: 'settings' } })
    check(settingsRes, { 'Settings: 200': (r) => r.status === 200 })

    // Sponsors
    const sponsorsRes = http.get(`${BASE_URL}/api/sponsors`, { tags: { name: 'sponsors' } })
    check(sponsorsRes, { 'Sponsors: 200': (r) => r.status === 200 })

    // Subscribe (POST with body)
    const subRes = http.post(
        `${BASE_URL}/api/subscribe`,
        JSON.stringify({ email: `perf-${__VU}-${__ITER}@test.dev` }),
        { headers: { 'Content-Type': 'application/json' }, tags: { name: 'subscribe' } }
    )
    check(subRes, { 'Subscribe: ok': (r) => r.status < 500 })

    sleep(0.5)
}
