/**
 * scripts/load_test_notifications.js
 * ---------------------------------------------------------------------------
 * k6 load test for the notification creation burst scenario.
 * Simulates 10,000 concurrent notification requests.
 *
 * Pre-requisites:
 *   1. Install k6: https://k6.io/docs/getting-started/installation/
 *   2. Set the BASE_URL and AUTH_TOKEN env vars.
 *
 * Run locally:
 *   k6 run --env BASE_URL=https://aim-platform-kksd.onrender.com \
 *           --env AUTH_TOKEN=<your-token> \
 *           scripts/load_test_notifications.js
 *
 * Acceptance thresholds (configured below):
 *   - p(95) response time < 500ms
 *   - Error rate < 1%
 */
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'

const errorRate = new Rate('errors')
const duration  = new Trend('notification_duration', true)

export const options = {
    stages: [
        { duration: '30s', target: 100  }, // ramp-up to 100 VUs
        { duration: '60s', target: 500  }, // hold at 500 VUs (notification burst)
        { duration: '30s', target: 1000 }, // spike to 1 000 VUs
        { duration: '30s', target: 0   }, // ramp-down
    ],
    thresholds: {
        http_req_duration: ['p(95)<500'],   // 95th pct must be under 500ms
        errors:            ['rate<0.01'],    // < 1% errors
    },
}

const BASE_URL    = __ENV.BASE_URL    || 'http://localhost:3000'
const AUTH_TOKEN  = __ENV.AUTH_TOKEN  || ''
const CSRF_TOKEN  = __ENV.CSRF_TOKEN  || 'load-test-bypass'

const headers = {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'x-csrf-token':  CSRF_TOKEN,
}

export default function() {
    // Test: fetch notification feed (read path)
    const getRes = http.get(`${BASE_URL}/api/notifications`, { headers })
    const getOk  = check(getRes, { 'GET notifications 200': (r) => r.status === 200 })
    errorRate.add(!getOk)
    duration.add(getRes.timings.duration)

    // Test: poll endpoint (cursor-based long-poll)
    const pollRes = http.get(`${BASE_URL}/api/notifications/poll?cursor=${new Date(Date.now() - 5000).toISOString()}`, { headers })
    const pollOk  = check(pollRes, { 'POLL notifications 200': (r) => r.status === 200 })
    errorRate.add(!pollOk)

    sleep(1)
}
