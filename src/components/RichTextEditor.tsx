'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useCallback } from 'react'
import './RichTextEditor.css'

interface RichTextEditorProps {
    value: string
    onChange: (html: string) => void
    placeholder?: string
    maxLength?: number
    disabled?: boolean
}

export default function RichTextEditor({
    value,
    onChange,
    placeholder = 'Write your announcement…',
    maxLength = 2000,
    disabled = false,
}: RichTextEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [2, 3] },
                code: false,
                codeBlock: false,
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
            }),
            Placeholder.configure({ placeholder }),
        ],
        content: value || '',
        editable: !disabled,
        onUpdate({ editor }) {
            const html = editor.isEmpty ? '' : editor.getHTML()
            onChange(html)
        },
    })

    // Sync external value changes (e.g. when draft loads or form resets)
    useEffect(() => {
        if (!editor) return
        const currentHtml = editor.isEmpty ? '' : editor.getHTML()
        if (value !== currentHtml) {
            editor.commands.setContent(value || '', { emitUpdate: false })
        }
    }, [value, editor])

    // Character count from plain text
    const charCount = editor?.getText().length ?? 0

    const setLink = useCallback(() => {
        if (!editor) return
        const prev = editor.getAttributes('link').href as string | undefined
        const url = window.prompt('URL', prev ?? 'https://')
        if (url === null) return
        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run()
            return
        }
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }, [editor])

    if (!editor) return null

    const btn = (active: boolean): React.CSSProperties => ({
        padding: '5px 9px',
        borderRadius: '6px',
        border: 'none',
        background: active ? 'rgba(212,168,83,0.25)' : 'transparent',
        color: active ? 'var(--accent-gold)' : 'var(--text-secondary)',
        cursor: 'pointer',
        fontSize: '0.8rem',
        fontWeight: 600,
        lineHeight: 1,
        transition: 'all 0.15s',
    })

    return (
        <div className="rte-wrapper">
            {/* Toolbar */}
            <div className="rte-toolbar">
                <button type="button" style={btn(editor.isActive('bold'))}
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    title="Bold">
                    <strong>B</strong>
                </button>
                <button type="button" style={btn(editor.isActive('italic'))}
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    title="Italic">
                    <em>I</em>
                </button>
                <button type="button" style={btn(editor.isActive('heading', { level: 2 }))}
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    title="Heading">
                    H2
                </button>
                <button type="button" style={btn(editor.isActive('bulletList'))}
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    title="Bullet list">
                    ≡
                </button>
                <button type="button" style={btn(editor.isActive('orderedList'))}
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    title="Numbered list">
                    1.
                </button>
                <button type="button" style={btn(editor.isActive('link'))}
                    onClick={setLink}
                    title="Link">
                    🔗
                </button>
                <button type="button" style={btn(false)}
                    onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
                    title="Clear formatting">
                    ✕
                </button>
                <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: charCount > maxLength * 0.9 ? '#ef4444' : 'var(--text-tertiary)' }}>
                    {charCount}/{maxLength}
                </span>
            </div>

            {/* Editor area */}
            <EditorContent editor={editor} className="rte-content" />
        </div>
    )
}
