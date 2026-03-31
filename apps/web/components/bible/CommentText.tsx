'use client'

import React from 'react'

interface CommentTextProps {
  text: string
  disableLinks?: boolean
}

export default function CommentText({ text, disableLinks = false }: CommentTextProps) {
  const urlLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g
  const verseRefRegex = /\[([A-Za-zÀ-ÿ0-9\s]+\d+:\d+)\]/g

  const renderText = () => {
    const combined = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)|\[([A-Za-zÀ-ÿ0-9\s]+\d+:\d+)\]/g
    const result: React.ReactNode[] = []
    let lastIndex = 0
    let m: RegExpExecArray | null

    while ((m = combined.exec(text)) !== null) {
      if (m.index > lastIndex) {
        result.push(text.slice(lastIndex, m.index))
      }
      if (m[1] && m[2]) {
        result.push(
          disableLinks
            ? React.createElement('span', {
                key: m.index,
                style: { color: 'var(--gold)', borderBottom: '1px solid var(--gold-pale)' }
              }, m[1])
            : React.createElement('a', {
                key: m.index,
                href: m[2],
                target: '_blank',
                rel: 'noopener noreferrer',
                style: { color: 'var(--gold)', textDecoration: 'none', borderBottom: '1px solid var(--gold-pale)' }
              }, m[1])
        )
      } else if (m[3]) {
        result.push(
          disableLinks
            ? React.createElement('span', {
                key: m.index,
                style: {
                  color: 'var(--blue-sacred)',
                  fontFamily: 'DM Mono, monospace',
                  fontSize: '11px',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  background: 'var(--blue-light)',
                  border: '1px solid rgba(42,74,122,0.15)',
                }
              }, m[3])
            : React.createElement('a', {
                key: m.index,
                href: '#',
                style: {
                  color: 'var(--blue-sacred)',
                  textDecoration: 'none',
                  fontFamily: 'DM Mono, monospace',
                  fontSize: '11px',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  background: 'var(--blue-light)',
                  border: '1px solid rgba(42,74,122,0.15)',
                }
              }, m[3])
        )
      }
      lastIndex = m.index + m[0].length
    }

    if (lastIndex < text.length) {
      result.push(text.slice(lastIndex))
    }

    return result
  }

  return (
    <span>
      {renderText().map((part, i) => (
        <span key={i}>{part}</span>
      ))}
    </span>
  )
}