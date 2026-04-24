/**
 * Email templates for the /start-project submission flow.
 * Uses the same branded wrapper and helpers from email-templates.ts.
 */

// Re-use the same constants & helpers (they're module-private in email-templates.ts,
// so we duplicate the minimal set needed here for full standalone capability).

const BRAND_COLOR = '#d4a853'
const BG_DARK = '#0f1115'
const BG_CARD = '#1a1d23'
const TEXT_PRIMARY = '#e8e6e3'
const TEXT_SECONDARY = '#9ca3af'
const BORDER = '#2a2d35'
const ACCENT_RED = '#ef4444'
const ACCENT_GREEN = '#10b981'
const ACCENT_BLUE = '#3b82f6'
const BRAND_LIGHT = '#e8c36a'

function emailWrapper(content: string, preheader?: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AIM Studio</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${BG_DARK}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    ${preheader ? `<div style="display:none;font-size:1px;color:${BG_DARK};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div>` : ''}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BG_DARK};">
        <tr>
            <td align="center" style="padding: 40px 16px;">
                <table role="presentation" width="580" cellpadding="0" cellspacing="0" style="max-width: 580px; width: 100%;">
                    <tr><td style="height: 4px; background: linear-gradient(90deg, ${BRAND_COLOR}, ${BRAND_LIGHT}, ${BRAND_COLOR}); border-radius: 12px 12px 0 0;"></td></tr>
                    <tr>
                        <td style="padding: 28px 36px 20px; text-align: center; background-color: ${BG_CARD}; border-left: 1px solid ${BORDER}; border-right: 1px solid ${BORDER};">
                            <span style="font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">
                                <span style="color: ${BRAND_COLOR};">AIM</span>
                                <span style="color: ${TEXT_PRIMARY};"> Studio</span>
                            </span>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0 36px; background-color: ${BG_CARD}; border-left: 1px solid ${BORDER}; border-right: 1px solid ${BORDER};">
                            <div style="border-top: 1px solid ${BORDER};"></div>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: ${BG_CARD}; border-left: 1px solid ${BORDER}; border-right: 1px solid ${BORDER}; padding: 36px 36px 40px;">
                            ${content}
                        </td>
                    </tr>
                    <tr><td style="height: 3px; background: linear-gradient(90deg, ${BRAND_COLOR}, ${BRAND_LIGHT}, ${BRAND_COLOR}); border-radius: 0 0 12px 12px;"></td></tr>
                    <tr>
                        <td style="padding-top: 28px; text-align: center;">
                            <p style="margin: 0; font-size: 12px; color: ${TEXT_SECONDARY}; line-height: 1.6;">
                                &copy; ${new Date().getFullYear()} AIM Studio &bull; AI-Powered Filmmaking
                            </p>
                            <p style="margin: 8px 0 0; font-size: 11px; color: #6b7280;">
                                This email was sent automatically. Please do not reply directly.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`
}

function heading(text: string): string {
    return `<h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 700; color: ${TEXT_PRIMARY}; line-height: 1.3;">${text}</h1>`
}

function subtext(text: string): string {
    return `<p style="margin: 0 0 24px; font-size: 14px; color: ${TEXT_SECONDARY}; line-height: 1.6;">${text}</p>`
}

function paragraph(text: string): string {
    return `<p style="margin: 0 0 16px; font-size: 15px; color: ${TEXT_PRIMARY}; line-height: 1.7;">${text}</p>`
}

function button(text: string, url: string): string {
    return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
        <tr>
            <td style="background: linear-gradient(135deg, ${BRAND_COLOR}, #c49b3a); border-radius: 8px;">
                <a href="${url}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 14px; font-weight: 700; color: #0f1115; text-decoration: none; letter-spacing: 0.3px;">${text}</a>
            </td>
        </tr>
    </table>`
}

function secondaryButton(text: string, url: string): string {
    return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 12px 0;">
        <tr>
            <td style="border: 1px solid ${BORDER}; border-radius: 8px; background-color: #22252d;">
                <a href="${url}" target="_blank" style="display: inline-block; padding: 12px 28px; font-size: 13px; font-weight: 600; color: ${BRAND_COLOR}; text-decoration: none; letter-spacing: 0.3px;">${text}</a>
            </td>
        </tr>
    </table>`
}

function divider(): string {
    return `<hr style="border: none; border-top: 1px solid ${BORDER}; margin: 24px 0;">`
}

function infoRow(label: string, value: string): string {
    return `<tr>
        <td style="padding: 8px 0; font-size: 13px; color: ${TEXT_SECONDARY}; width: 120px; vertical-align: top;">${label}</td>
        <td style="padding: 8px 0; font-size: 13px; color: ${TEXT_PRIMARY}; font-weight: 600;">${value}</td>
    </tr>`
}

function infoCard(content: string, accentColor?: string): string {
    const borderLeft = accentColor ? `border-left: 3px solid ${accentColor};` : ''
    return `<div style="background-color: ${BG_DARK}; border-radius: 8px; padding: 18px 22px; margin-bottom: 24px; ${borderLeft}">
        ${content}
    </div>`
}


// ──────────────────────────────────────────────────────────────
// Client Confirmation Email
// ──────────────────────────────────────────────────────────────

export function projectRequestConfirmation(
    clientName: string,
    projectId: string,
    projectTitle: string,
    projectType: string,
    trackingUrl: string,
): string {
    const submittedAt = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })
    return emailWrapper(`
        ${heading('Project Request Received! 🎬')}
        ${subtext(`Hi ${clientName}, we got your project brief.`)}
        ${infoCard(`
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${infoRow('Project ID', `<span style="color: ${BRAND_COLOR}; font-family: monospace; letter-spacing: 0.5px;">${projectId}</span>`)}
                ${infoRow('Title', projectTitle)}
                ${infoRow('Type', projectType)}
                ${infoRow('Submitted', submittedAt)}
            </table>
        `, BRAND_COLOR)}
        ${paragraph('Our team will review your submission and reach out to confirm the scope and timeline. You can track the progress of your project at any time using the button below.')}
        ${button('Track Your Project', trackingUrl)}
        ${divider()}
        <div style="background-color: ${BG_DARK}; border-radius: 8px; padding: 18px 22px; margin-bottom: 16px;">
            <p style="margin: 0 0 12px; font-size: 13px; font-weight: 700; color: ${BRAND_COLOR}; text-transform: uppercase; letter-spacing: 0.5px;">What happens next</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                    <td style="padding: 6px 0; font-size: 13px; color: ${ACCENT_GREEN};">✓</td>
                    <td style="padding: 6px 0 6px 10px; font-size: 13px; color: ${TEXT_PRIMARY};">We review your submission</td>
                </tr>
                <tr>
                    <td style="padding: 6px 0; font-size: 13px; color: ${TEXT_SECONDARY};">○</td>
                    <td style="padding: 6px 0 6px 10px; font-size: 13px; color: ${TEXT_SECONDARY};">We confirm scope and timeline</td>
                </tr>
                <tr>
                    <td style="padding: 6px 0; font-size: 13px; color: ${TEXT_SECONDARY};">○</td>
                    <td style="padding: 6px 0 6px 10px; font-size: 13px; color: ${TEXT_SECONDARY};">Production begins</td>
                </tr>
            </table>
        </div>
        ${paragraph(`<span style="font-size: 12px; color: #6b7280;">Keep this email for your records. Your Project ID is <strong>${projectId}</strong>.</span>`)}
    `, `Project "${projectTitle}" received — ID: ${projectId}`)
}


// ──────────────────────────────────────────────────────────────
// Admin Notification Email
// ──────────────────────────────────────────────────────────────

export function projectRequestAdminNotification(
    clientName: string,
    clientEmail: string,
    projectId: string,
    projectTitle: string,
    projectType: string,
    budgetRange?: string | null,
    deadline?: string | null,
    rushDelivery?: boolean,
    siteUrl?: string,
): string {
    const urgencyBadge = rushDelivery
        ? `<span style="display: inline-block; padding: 3px 10px; background-color: rgba(239,68,68,0.15); color: ${ACCENT_RED}; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase;">⚡ RUSH</span>`
        : ''
    return emailWrapper(`
        ${heading('📋 New Project Request')}
        ${subtext('A new project brief has been submitted.')}
        ${urgencyBadge ? `<div style="margin-bottom: 16px;">${urgencyBadge}</div>` : ''}
        ${infoCard(`
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${infoRow('Project ID', `<span style="color: ${BRAND_COLOR}; font-family: monospace;">${projectId}</span>`)}
                ${infoRow('Client', clientName)}
                ${infoRow('Email', `<a href="mailto:${clientEmail}" style="color: ${ACCENT_BLUE}; text-decoration: none;">${clientEmail}</a>`)}
                ${infoRow('Type', projectType)}
                ${infoRow('Title', projectTitle)}
                ${budgetRange ? infoRow('Budget', budgetRange) : ''}
                ${deadline ? infoRow('Deadline', deadline) : ''}
            </table>
        `, ACCENT_BLUE)}
        ${siteUrl ? secondaryButton('Review in Admin Panel', `${siteUrl}/admin/project-requests`) : ''}
    `, `New project: ${projectTitle} from ${clientName}`)
}


// ──────────────────────────────────────────────────────────────
// Client Status Update Email
// Sent when admin changes the project status
// ──────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; emoji: string; message: string }> = {
    received:        { label: 'Received',        color: '#60a5fa', emoji: '📥', message: 'Your project brief has been received and is in our queue.' },
    reviewing:       { label: 'Under Review',    color: '#a78bfa', emoji: '🔍', message: 'Our team is now reviewing your project brief and requirements.' },
    scope_confirmed: { label: 'Scope Confirmed', color: '#22d3ee', emoji: '📋', message: 'We have confirmed the scope and timeline for your project. Production will begin shortly.' },
    in_production:   { label: 'In Production',   color: '#f59e0b', emoji: '🎬', message: 'Your project is now in active production. Our team is working on bringing your vision to life.' },
    awaiting_client: { label: 'Awaiting Your Response', color: '#f97316', emoji: '⏳', message: 'We need your input to proceed. Please check your project tracker or reply to this email.' },
    delivered:       { label: 'Delivered',        color: '#10b981', emoji: '📦', message: 'Your project has been delivered! Please review the final deliverables and let us know if any revisions are needed.' },
    completed:       { label: 'Completed',        color: '#34d399', emoji: '✅', message: 'Your project is complete. Thank you for choosing AIM Studio. We hope you love the result!' },
    cancelled:       { label: 'Cancelled',        color: '#f87171', emoji: '❌', message: 'This project has been cancelled. If you have any questions, please reach out to our team.' },
}

const STATUS_FLOW = ['received', 'reviewing', 'scope_confirmed', 'in_production', 'delivered', 'completed']

export function projectStatusUpdateEmail(
    clientName: string,
    projectId: string,
    projectTitle: string,
    newStatus: string,
    trackingUrl: string,
): string {
    const meta = STATUS_META[newStatus] || STATUS_META.received
    const currentIdx = STATUS_FLOW.indexOf(newStatus)

    // Build the progress timeline
    const timelineHtml = STATUS_FLOW.map((status, i) => {
        const sMeta = STATUS_META[status]
        const isPast = i < currentIdx
        const isCurrent = status === newStatus
        const isFuture = i > currentIdx
        const dotColor = isCurrent ? sMeta.color : isPast ? ACCENT_GREEN : '#3a3d45'
        const textColor = isCurrent ? TEXT_PRIMARY : isPast ? TEXT_SECONDARY : '#3a3d45'
        const checkmark = isPast ? '✓' : isCurrent ? sMeta.emoji : '○'

        return `<tr>
            <td style="padding: 5px 0; font-size: 16px; width: 28px; text-align: center; color: ${dotColor}; vertical-align: middle;">${checkmark}</td>
            <td style="padding: 5px 0 5px 10px; font-size: 13px; color: ${textColor}; font-weight: ${isCurrent ? '700' : '400'}; vertical-align: middle;">
                ${sMeta.label}
                ${isCurrent ? `<span style="display: inline-block; margin-left: 8px; padding: 1px 8px; background: ${sMeta.color}18; border: 1px solid ${sMeta.color}40; border-radius: 4px; font-size: 10px; font-weight: 700; color: ${sMeta.color}; text-transform: uppercase;">Current</span>` : ''}
            </td>
        </tr>`
    }).join('')

    return emailWrapper(`
        ${heading(`${meta.emoji} Project Update`)}
        ${subtext(`Hi ${clientName}, there is an update on your project.`)}

        ${infoCard(`
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${infoRow('Project', projectTitle)}
                ${infoRow('Project ID', `<span style="color: ${BRAND_COLOR}; font-family: monospace; letter-spacing: 0.5px;">${projectId}</span>`)}
                ${infoRow('New Status', `<span style="display: inline-block; padding: 3px 12px; background: ${meta.color}18; border: 1px solid ${meta.color}40; border-radius: 4px; font-size: 12px; font-weight: 700; color: ${meta.color};">${meta.label}</span>`)}
            </table>
        `, meta.color)}

        ${paragraph(meta.message)}

        ${divider()}

        <div style="background-color: ${BG_DARK}; border-radius: 8px; padding: 18px 22px; margin-bottom: 24px;">
            <p style="margin: 0 0 12px; font-size: 13px; font-weight: 700; color: ${BRAND_COLOR}; text-transform: uppercase; letter-spacing: 0.5px;">Progress</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${timelineHtml}
            </table>
        </div>

        ${button('View Project Status', trackingUrl)}

        ${paragraph(`<span style="font-size: 12px; color: #6b7280;">Your Project ID is <strong>${projectId}</strong>. Bookmark your tracking page for real-time updates.</span>`)}
    `, `Project "${projectTitle}" — Status: ${meta.label}`)
}
