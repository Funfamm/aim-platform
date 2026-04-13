const fs = require('fs')
const file = 'src/lib/email-templates.ts'
let src = fs.readFileSync(file, 'utf8').replace(/^\uFEFF+/, '').replace(/\r\n/g, '\n')

const START = '/** Sent to all opted-in users for platform announcements */'
const NEXT  = '\n\n/** Sent to opted-in users when admin publishes new content */'

const si = src.indexOf(START)
const ei = src.indexOf(NEXT, si)

if (si === -1 || ei === -1) {
    console.error('Could not find markers', si, ei)
    process.exit(1)
}

const replacement = `/** Sent to all opted-in users for platform announcements */
export function announcementEmail(
    title: string,
    message: string,
    link?: string,
    siteUrl?: string,
    i18n?: {
        badgeText?: string
        buttonText?: string
        footerOptIn?: string
        managePrefs?: string
    },
    imageUrl?: string,
    bodyHtml?: string,
): string {
    const ctaUrl       = link
        ? (link.startsWith('http') ? link : \`\${siteUrl || 'https://impactaistudio.com'}\${link}\`)
        : \`\${siteUrl || 'https://impactaistudio.com'}/notifications\`
    const ctaText      = i18n?.buttonText  ?? (link ? 'View Announcement \\u2192' : 'View in Notifications \\u2192')
    const badge        = i18n?.badgeText   ?? 'Platform Announcement'
    const footerOptIn  = i18n?.footerOptIn ?? "You're receiving this because you opted in to platform announcements."
    const managePrefs  = i18n?.managePrefs ?? 'Manage preferences'
    // Banner image \u2014 only https URLs are trusted
    const bannerBlock  = (imageUrl && imageUrl.startsWith('https://'))
        ? \`<div style="margin:0 0 24px;border-radius:10px;overflow:hidden;"><img src="\${imageUrl}" alt="" width="100%" style="display:block;width:100%;max-height:300px;object-fit:cover;border-radius:10px;" /></div>\`
        : ''
    // Rich body \u2014 strip to safe subset (p,strong,em,h2,h3,ul,ol,li,a,br)
    const allowedTags  = /(<\\/?(?:p|strong|em|h2|h3|ul|ol|li|a|br)[^>]*>)/gi
    const safeBody     = bodyHtml ? bodyHtml.replace(/<[^>]+>/g, (t) => allowedTags.test(t) ? t : '') : ''
    const bodyBlock    = safeBody ? \`<div style="margin:16px 0;font-size:15px;color:#c9c7c4;line-height:1.75;">\${safeBody}</div>\` : ''
    return emailWrapper(\`
        <div style="text-align:center;padding:16px 0 24px;">
            <div style="font-size:52px;margin-bottom:12px;">\u{1F4E3}</div>
            <div style="display:inline-block;padding:6px 18px;background:\${BG_DARK};border-radius:20px;border:1px solid #8b5cf6;">
                <span style="font-size:12px;font-weight:700;color:#8b5cf6;letter-spacing:1.5px;text-transform:uppercase;">\${badge}</span>
            </div>
        </div>
        \${bannerBlock}
        \${heading(title)}
        \${paragraph(message)}
        \${bodyBlock}
        \${button(ctaText, ctaUrl)}
        \${divider()}
        \${paragraph(\`<span style="font-size:12px;color:#6b7280;">\${footerOptIn} <a href="\${siteUrl || 'https://impactaistudio.com'}/notifications" style="color:#6b7280;text-decoration:underline;">\${managePrefs}</a></span>\`)}
    \`, title)
}`

const out = src.slice(0, si) + replacement + src.slice(ei)
fs.writeFileSync(file, out, 'utf8')
console.log('Done \u2014 announcementEmail upgraded with imageUrl + bodyHtml.')
