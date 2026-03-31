/**
 * MSW (Mock Service Worker) Handlers
 *
 * These handlers mock all external API calls during tests so that:
 * 1. Tests are deterministic and fast (no real network calls).
 * 2. CI doesn't need real API keys.
 * 3. External-service outages never break our test suite.
 *
 * Usage:
 *   import { handlers } from '@/mocks/handlers'
 *   const server = setupServer(...handlers)
 */

import { http, HttpResponse } from 'msw'

// ── Microsoft Graph (Email) ──────────────────────────────────────────
const graphHandlers = [
    // Token endpoint
    http.post('https://login.microsoftonline.com/*/oauth2/v2.0/token', () => {
        return HttpResponse.json({
            access_token: 'mock-graph-access-token',
            expires_in: 3600,
            token_type: 'Bearer',
        })
    }),

    // Send mail endpoint
    http.post('https://graph.microsoft.com/v1.0/users/*/sendMail', () => {
        return new HttpResponse(null, { status: 202 })
    }),
]

// ── PayPal ───────────────────────────────────────────────────────────
const paypalHandlers = [
    // OAuth token
    http.post('https://api-m.sandbox.paypal.com/v1/oauth2/token', () => {
        return HttpResponse.json({
            access_token: 'mock-paypal-token',
            token_type: 'Bearer',
            expires_in: 32400,
        })
    }),

    // Create order
    http.post('https://api-m.sandbox.paypal.com/v2/checkout/orders', () => {
        return HttpResponse.json({
            id: 'MOCK-ORDER-ID',
            status: 'CREATED',
            links: [
                { href: 'https://sandbox.paypal.com/checkoutnow?token=MOCK', rel: 'approve' },
            ],
        })
    }),

    // Capture order
    http.post('https://api-m.sandbox.paypal.com/v2/checkout/orders/*/capture', () => {
        return HttpResponse.json({
            id: 'MOCK-ORDER-ID',
            status: 'COMPLETED',
            purchase_units: [
                {
                    payments: {
                        captures: [
                            { id: 'MOCK-CAPTURE', amount: { value: '10.00', currency_code: 'USD' } },
                        ],
                    },
                },
            ],
        })
    }),
]

// ── Google OAuth ─────────────────────────────────────────────────────
const googleHandlers = [
    // Token exchange
    http.post('https://oauth2.googleapis.com/token', () => {
        return HttpResponse.json({
            access_token: 'mock-google-access-token',
            id_token: 'mock-google-id-token',
            token_type: 'Bearer',
            expires_in: 3600,
        })
    }),

    // User info
    http.get('https://www.googleapis.com/oauth2/v2/userinfo', () => {
        return HttpResponse.json({
            id: 'mock-google-user-id',
            email: 'testuser@gmail.com',
            name: 'Test User',
            picture: 'https://placehold.co/100x100',
        })
    }),
]

// ── Cloudflare R2 ────────────────────────────────────────────────────
const r2Handlers = [
    // PUT object (upload)
    http.put('https://*.r2.cloudflarestorage.com/*', () => {
        return new HttpResponse(null, {
            status: 200,
            headers: { ETag: '"mock-etag"' },
        })
    }),

    // GET object
    http.get('https://*.r2.cloudflarestorage.com/*', () => {
        return new HttpResponse(new Uint8Array([0]), {
            status: 200,
            headers: { 'Content-Type': 'application/octet-stream' },
        })
    }),

    // DELETE object
    http.delete('https://*.r2.cloudflarestorage.com/*', () => {
        return new HttpResponse(null, { status: 204 })
    }),
]

// ── Gemini AI ────────────────────────────────────────────────────────
const geminiHandlers = [
    http.post('https://generativelanguage.googleapis.com/v1beta/models/*', () => {
        return HttpResponse.json({
            candidates: [
                {
                    content: {
                        parts: [
                            {
                                text: JSON.stringify({
                                    score: 78,
                                    recommendation: 'ADVANCE',
                                    summary: 'Mock AI evaluation: strong candidate.',
                                    strengths: ['Natural talent', 'Good screen presence'],
                                    weaknesses: ['Minor timing issues'],
                                }),
                            },
                        ],
                    },
                },
            ],
        })
    }),
]

// ── ElevenLabs TTS ───────────────────────────────────────────────────
const elevenLabsHandlers = [
    http.get('https://api.elevenlabs.io/v1/voices', () => {
        return HttpResponse.json({
            voices: [
                { voice_id: 'mock-voice-1', name: 'Rachel' },
                { voice_id: 'mock-voice-2', name: 'Drew' },
            ],
        })
    }),

    http.post('https://api.elevenlabs.io/v1/text-to-speech/*', () => {
        return new HttpResponse(new Uint8Array([0]), {
            status: 200,
            headers: { 'Content-Type': 'audio/mpeg' },
        })
    }),
]

// ── Export all handlers ──────────────────────────────────────────────
export const handlers = [
    ...graphHandlers,
    ...paypalHandlers,
    ...googleHandlers,
    ...r2Handlers,
    ...geminiHandlers,
    ...elevenLabsHandlers,
]
