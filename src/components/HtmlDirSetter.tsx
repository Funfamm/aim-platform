'use client'

import { useEffect } from 'react'

/**
 * Sets the `lang` and `dir` attributes on the root <html> element.
 * This ensures browsers, screen readers, and CSS know the text direction.
 */
export function HtmlDirSetter({ locale, dir }: { locale: string; dir: 'ltr' | 'rtl' }) {
    useEffect(() => {
        document.documentElement.lang = locale
        document.documentElement.dir = dir
    }, [locale, dir])

    return null
}
