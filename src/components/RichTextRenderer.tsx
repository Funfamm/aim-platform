'use client'

import { useMemo } from 'react'
import DOMPurify from 'isomorphic-dompurify'
import './RichTextEditor.css'

interface RichTextRendererProps {
    html: string
    className?: string
}

/**
 * Safely renders sanitized HTML from TipTap.
 * Uses DOMPurify to strip dangerous tags/attributes.
 * Only allows a safe subset: headings, paragraphs, lists, links, bold, italic.
 */
export default function RichTextRenderer({ html, className = '' }: RichTextRendererProps) {
    const clean = useMemo(() => {
        if (!html) return ''
        return DOMPurify.sanitize(html, {
            ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'h2', 'h3', 'ul', 'ol', 'li', 'a'],
            ALLOWED_ATTR: ['href', 'target', 'rel'],
        })
    }, [html])

    if (!clean) return null

    return (
        <div
            className={`rtr-body ${className}`}
            dangerouslySetInnerHTML={{ __html: clean }}
        />
    )
}
