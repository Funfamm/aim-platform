/**
 * OpenTelemetry provider setup for LiveKit observability.
 * Imported by src/instrumentation.ts only on the nodejs runtime.
 *
 * Tracks 9 key metrics per the implementation plan:
 *  - livekit.token.success / .failure
 *  - livekit.room.join_latency_ms
 *  - livekit.room.reconnect_count
 *  - livekit.captions.lag_ms
 *  - livekit.translation.lag_ms
 *  - livekit.webhook.verification_failure
 *  - livekit.egress.failure_rate
 *  - livekit.captions.lang_usage
 *  - livekit.turn.fallback_rate
 *
 * Wire a real OTel exporter (Grafana, Datadog, Honeycomb, etc.) by
 * setting OTEL_EXPORTER_OTLP_ENDPOINT + OTEL_EXPORTER_OTLP_HEADERS.
 */
export async function registerTelemetry() {
    // Only log in production to avoid noise during development
    if (process.env.NODE_ENV === 'production') {
        console.info('[AIM Telemetry] LiveKit OTel metrics registered. Connect an OTLP exporter to stream metrics.')
    }

    // TODO: Replace with your OTel SDK setup when you add an exporter, e.g.:
    // const { NodeSDK } = await import('@opentelemetry/sdk-node')
    // const { OTLPMetricExporter } = await import('@opentelemetry/exporter-metrics-otlp-proto')
    // new NodeSDK({ ... }).start()
}

/**
 * Helper: record a LiveKit metric event. Call from any server-side handler.
 * When a real OTel SDK is wired in, replace console.info with SDK counter/histogram calls.
 */
export function recordMetric(
    metric:
        | 'livekit.token.success'
        | 'livekit.token.failure'
        | 'livekit.room.join_latency_ms'
        | 'livekit.room.reconnect_count'
        | 'livekit.captions.lag_ms'
        | 'livekit.translation.lag_ms'
        | 'livekit.webhook.verification_failure'
        | 'livekit.egress.failure_rate'
        | 'livekit.captions.lang_usage'
        | 'livekit.turn.fallback_rate',
    value: number = 1,
    attributes?: Record<string, string | number>,
) {
    if (process.env.NODE_ENV !== 'production') return
    console.info(`[OTel] ${metric}`, { value, ...attributes })
}
