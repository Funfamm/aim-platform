import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3'

const MAX_BULK = 200

// ── R2 client (same credentials used by presign route) ─────────────────────
const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
})

const BUCKET         = process.env.R2_BUCKET_NAME!
const R2_PUBLIC_URL  = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '')

/**
 * Converts a stored public URL back to its R2 object key.
 * e.g. "https://pub-xxx.r2.dev/scripts/calls/abc/..." → "scripts/calls/abc/..."
 *
 * Returns null if the URL isn't an R2 URL (e.g. external link stored by mistake).
 */
function urlToR2Key(url: string): string | null {
    if (!url || !R2_PUBLIC_URL) return null
    if (url.startsWith(R2_PUBLIC_URL + '/')) {
        return url.slice(R2_PUBLIC_URL.length + 1)
    }
    // Fallback: if it looks like an internal R2 path (no host), use as-is
    if (!url.startsWith('http')) return url
    return null
}

/**
 * DELETE /api/admin/script-calls/bulk-delete
 *
 * Permanently deletes the given script calls, their submissions (via DB cascade),
 * and any uploaded script files (PDF/FDX/TXT) from Cloudflare R2.
 *
 * Body: { ids: string[] }
 */
export async function DELETE(req: NextRequest) {
    try { await requireAdmin() } catch {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
        const body = await req.json()
        const ids: string[] = (body.ids ?? []).slice(0, MAX_BULK)

        if (ids.length === 0) {
            return NextResponse.json({ error: 'No IDs provided' }, { status: 400 })
        }

        // ── 1. Collect all uploaded file URLs before cascade wipes the rows ──
        const submissions = await prisma.scriptSubmission.findMany({
            where: {
                scriptCallId: { in: ids },
                scriptFilePath: { not: null },
            },
            select: { scriptFilePath: true },
        })

        const r2Keys = submissions
            .map(s => urlToR2Key(s.scriptFilePath!))
            .filter((k): k is string => k !== null)

        // ── 2. Delete DB records (cascade removes submissions automatically) ─
        const result = await prisma.scriptCall.deleteMany({ where: { id: { in: ids } } })

        // ── 3. Delete R2 objects in batches of 1000 (AWS SDK limit) ──────────
        let r2Deleted = 0
        let r2Failed  = 0

        if (r2Keys.length > 0 && BUCKET) {
            // Split into 1000-object chunks (AWS API limit per request)
            for (let i = 0; i < r2Keys.length; i += 1000) {
                const chunk = r2Keys.slice(i, i + 1000)
                try {
                    const cmd = new DeleteObjectsCommand({
                        Bucket: BUCKET,
                        Delete: {
                            Objects:  chunk.map(Key => ({ Key })),
                            Quiet:    true, // only report errors, not successes
                        },
                    })
                    const res = await s3.send(cmd)
                    r2Deleted += chunk.length - (res.Errors?.length ?? 0)
                    r2Failed  += res.Errors?.length ?? 0

                    if (res.Errors?.length) {
                        console.warn('[bulk-delete] R2 partial failure:', res.Errors)
                    }
                } catch (r2Err) {
                    // R2 cleanup is best-effort — DB is already clean
                    console.error('[bulk-delete] R2 batch delete error:', r2Err)
                    r2Failed += chunk.length
                }
            }
        }

        return NextResponse.json({
            success:      true,
            deleted:      result.count,       // script calls removed from DB
            filesDeleted: r2Deleted,          // R2 objects successfully removed
            filesFailed:  r2Failed,           // R2 objects that failed (non-fatal)
        })
    } catch (err) {
        console.error('Bulk script-call delete error:', err)
        return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
    }
}
