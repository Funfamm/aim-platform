import { readFileSync, writeFileSync } from 'fs'

const f = 'src/lib/email-templates.ts'
let c = readFileSync(f, 'utf8')

const START_MARKER = '/** Sent to all opted-in users when admin publishes a new casting role */'
const END_MARKER   = '\n/** Sent to all opted-in users for platform announcements */'

const start = c.indexOf(START_MARKER)
const end   = c.indexOf(END_MARKER)

if (start === -1 || end === -1) {
    console.error('Markers not found:', { start, end })
    process.exit(1)
}

const oldFn = c.slice(start, end)

const newFn = `/** Sent to all opted-in users when admin publishes a new casting role — fully localized */
export function newCastingRoleEmail(roleName: string, projectTitle: string, applyUrl: string, locale = 'en'): string {
    const r = (s: string) => s.replace('{role}', roleName).replace('{project}', projectTitle)
    const badge       = emailT('castingNewRole', locale, 'badge')      || 'New Casting Call'
    const h           = r(emailT('castingNewRole', locale, 'heading')  || 'Now Open: {role}')
    const sub         = r(emailT('castingNewRole', locale, 'subtext')  || 'A new audition in {project} is now live.')
    const bodyTxt     =   emailT('castingNewRole', locale, 'body')     || 'Applications reviewed on a rolling basis.'
    const statusOpen  =   emailT('castingNewRole', locale, 'statusOpen') || 'Open'
    const btnTxt      =   emailT('castingNewRole', locale, 'buttonText') || 'Apply Now'
    const footerTxt   =   emailT('castingNewRole', locale, 'footer')   || 'Roles close once filled.'
    const roleLabel   =   emailT('castingConfirmation', locale, 'roleLabel')    || 'Role'
    const projLabel   =   emailT('castingConfirmation', locale, 'projectLabel') || 'Project'
    const statusLabel =   emailT('castingConfirmation', locale, 'statusLabel')  || 'Status'
    const subject     = r(emailT('castingNewRole', locale, 'subject') || 'New Audition Open: {role} | AIM Studio')
    return emailWrapper(\`
        <div style="text-align:center;padding:16px 0 24px;">
            <div style="font-size:52px;margin-bottom:12px;">&#127917;</div>
            <div style="display:inline-block;padding:6px 18px;background:\${BG_DARK};border-radius:20px;border:1px solid \${BRAND_COLOR};">
                <span style="font-size:12px;font-weight:700;color:\${BRAND_COLOR};letter-spacing:1.5px;text-transform:uppercase;">\${badge}</span>
            </div>
        </div>
        \${heading(h)}
        \${subtext(sub)}
        \${paragraph(bodyTxt)}
        \${infoCard(\`
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                \${infoRow(roleLabel, roleName)}
                \${infoRow(projLabel, projectTitle)}
                \${infoRow(statusLabel, \`<span style="color:#10b981;font-weight:700;">\${statusOpen}</span>\`)}
            </table>
        \`, BRAND_COLOR)}
        \${button(btnTxt, applyUrl)}
        \${paragraph(\`<span style="font-size:12px;color:#6b7280;">\${footerTxt}</span>\`)}
    \`, subject)
}

/** Sent to applicant when they withdraw their application — fully localized */
export function applicationWithdrawalEmail(name: string, roleName: string, castingUrl: string, locale = 'en'): string {
    const r = (s: string) => s.replace('{role}', roleName)
    const h       = emailT('castingWithdrawal', locale, 'heading')    || 'Application Withdrawn'
    const sub     = emailT('castingWithdrawal', locale, 'subtext')    || 'your application has been withdrawn.'
    const bodyTxt = r(emailT('castingWithdrawal', locale, 'body')     || 'Your application for the role has been withdrawn.')
    const btnTxt  = emailT('castingWithdrawal', locale, 'buttonText') || 'Browse Other Roles'
    const footer  = emailT('castingWithdrawal', locale, 'footer')     || 'You received this because you withdrew a casting application on AIM Studio.'
    const subject = r(emailT('castingWithdrawal', locale, 'subject')  || 'Application Withdrawn: {role}')
    return emailWrapper(\`
        <div style="text-align:center;padding:16px 0 24px;">
            <div style="font-size:52px;margin-bottom:12px;">&#128203;</div>
        </div>
        \${heading(h)}
        \${subtext(\`Hi \${name}, \${sub}\`)}
        \${paragraph(bodyTxt)}
        \${castingUrl ? button(btnTxt, castingUrl) : ''}
        \${paragraph(\`<span style="font-size:12px;color:#6b7280;">\${footer}</span>\`)}
    \`, subject)
}
`

c = c.slice(0, start) + newFn + c.slice(end)
writeFileSync(f, c)
console.log('Done. Replaced', oldFn.length, 'chars with', newFn.length)
