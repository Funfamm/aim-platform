path = r'src\lib\email-templates.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# The orphaned block starts with a blank line then the template body lines
orphan_start = "\n\n        ${subtext(`Hi ${name}, ${emailT('contactAcknowledgment', locale, 'subtext')"
start_idx = content.find(orphan_start)
if start_idx == -1:
    print("ERROR: orphaned block not found")
    exit(1)

# End marker (what we found in the alternate)
end_marker = "localizedFooter)\n}\n\n"
end_idx = content.find(end_marker, start_idx)
if end_idx == -1:
    print("ERROR: end not found")
    exit(1)

end_idx_full = end_idx + len(end_marker)
print(f"Orphan: {start_idx} -> {end_idx_full}")

# New correct function body to insert at start_idx
# (replaces the orphan AND appends the proper function)
# But actually: before start_idx we have "}\n" from subscribeWithOverrides closing brace
# So we want: everything before start_idx, then \n\nNEW_FUNC\n\n, then content from end_idx_full
NEW_FUNC = """\n\nexport async function contactAcknowledgmentWithOverrides(name: string, subject: string, siteUrl?: string, locale = 'en'): Promise<string> {
    const localizedSubject   = (emailT('contactAcknowledgment', locale, 'subject')   || 'We received your message: {subject}').replace('{subject}', subject)
    const localizedBodyIntro = (emailT('contactAcknowledgment', locale, 'bodyIntro') || 'Your message regarding "{subject}" has been received. Our team will review it and get back to you as soon as possible.').replace(/{subject}/g, subject)
    const localizedFooter    =  emailT('contactAcknowledgment', locale, 'footerAuto') || 'This email was sent automatically. Please do not reply directly.'
    const f = await mergeFields('contact', {
        heading:    emailT('contactAcknowledgment', locale, 'heading') || 'Message Received ✓',
        body:       emailT('contactAcknowledgment', locale, 'body') || 'Typical response time is 1 to 3 business days.',
        buttonText: emailT('contactAcknowledgment', locale, 'buttonText') || 'Back to Homepage',
        buttonUrl:  siteUrl || '',
    })
    return emailWrapper(`
        ${heading(f.heading)}
        ${subtext(`Hi ${name}, ${emailT('contactAcknowledgment', locale, 'subtext') || 'we got your message.'}`)}
        ${paragraph(localizedBodyIntro)}
        ${paragraph(f.body)}
        ${f.buttonUrl ? `${divider()}${secondaryButton(f.buttonText, f.buttonUrl)}` : ''}
    `, localizedSubject, localizedFooter)
}\n\n"""

content = content[:start_idx] + NEW_FUNC + content[end_idx_full:]

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Done! File repaired successfully.")
