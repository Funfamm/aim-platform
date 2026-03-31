/**
 * k6 Performance Test — Home Page Load
 *
 * Simulates realistic traffic to the home page and health endpoint.
 * Thresholds enforce SLA-grade latency targets.
 *
 * Run: k6 run tests/performance/home_load.js
 */

import http from 'k6/http'
import { check, sleep } from 'k6'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

export const options = {
    stages: [
        { duration: '15s', target: 5 },    // Ramp up to 5 users
        { duration: '30s', target: 10 },   // Sustain 10 users
        { duration: '15s', target: 0 },    // Ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<5000'],         // 95th percentile < 5s (CI runners are slow)
        http_req_failed:   ['rate<0.05'],           // < 5% errors (CI can have transient issues)
        'http_req_duration{name:health}': ['p(99)<2000'],  // Health < 2s on CI
    },
}

export default function () {
    // ── Home page ────────────────────────────────────────────────
    const homeRes = http.get(`${BASE_URL}/`, { tags: { name: 'home' } })
    check(homeRes, {
        'Home: status 200': (r) => r.status === 200,
        'Home: response time < 3s': (r) => r.timings.duration < 3000,
    })

    sleep(1)

    // ── Health endpoint ──────────────────────────────────────────
    const healthRes = http.get(`${BASE_URL}/api/health`, { tags: { name: 'health' } })
    check(healthRes, {
        'Health: status 200': (r) => r.status === 200,
        'Health: response time < 500ms': (r) => r.timings.duration < 500,
    })

    sleep(1)
}
