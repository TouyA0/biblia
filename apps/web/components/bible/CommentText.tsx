'use client'

import React, { useState, useRef, useCallback } from 'react'
import api from '@/lib/api'
import { parseVerseRef } from '@/lib/bookSlugs'

interface CommentTextProps {
  text: string
  disableLinks?: boolean
}

interface VerseTooltip {
  ref: string
  x: number
  y: number
  loading: boolean
  data: {
    texts: { language: string; text: string }[]
    translations: { textFr: string }[]
  } | null
}

export default function CommentText({ text, disableLinks = false }: CommentTextProps) {
  const [tooltip, setTooltip] = useState<VerseTooltip | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const handleVerseHover = useCallback(async (ref: string, e: React.MouseEvent) => {
    if (disableLinks) return
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setTooltip({ ref, x: rect.left, y: rect.bottom + 8, loading: true, data: null })

    const parsed = parseVerseRef(ref)
    if (!parsed) { setTooltip(null); return }

    try {
      const res = await api.get(`/api/verses/by-ref?book=${parsed.slug}&chapter=${parsed.chapter}&verse=${parsed.verse}`)
      setTooltip(prev => prev?.ref === ref ? { ...prev, loading: false, data: res.data } : prev)
    } catch {
      setTooltip(null)
    }
  }, [disableLinks])

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
        const verseRef = m[3]
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
              }, verseRef)
            : React.createElement('span', {
                key: m.index,
                onMouseEnter: (e: React.MouseEvent) => handleVerseHover(verseRef, e),
                onMouseLeave: () => setTooltip(null),
                style: {
                  color: 'var(--blue-sacred)',
                  textDecoration: 'none',
                  fontFamily: 'DM Mono, monospace',
                  fontSize: '11px',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  background: 'var(--blue-light)',
                  border: '1px solid rgba(42,74,122,0.15)',
                  cursor: 'pointer',
                }
              }, verseRef)
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
    <>
      <span>
        {renderText().map((part, i) => (
          <span key={i}>{part}</span>
        ))}
      </span>

      {tooltip && !disableLinks && (
        <div
          ref={tooltipRef}
          style={{
            position: 'fixed',
            left: Math.min(tooltip.x, window.innerWidth - 320),
            top: tooltip.y,
            width: '300px',
            background: 'var(--ink)',
            borderRadius: '8px',
            padding: '12px 14px',
            zIndex: 9999,
            boxShadow: '0 8px 32px rgba(26,22,18,0.3)',
            pointerEvents: 'none',
          }}
        >
          <div style={{
            fontFamily: 'DM Mono, monospace',
            fontSize: '9px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.4)',
            marginBottom: '8px',
          }}>
            {tooltip.ref}
          </div>

          {tooltip.loading ? (
            <div style={{ fontFamily: 'Spectral, serif', fontSize: '13px', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>
              Chargement...
            </div>
          ) : tooltip.data ? (
            <>
              {tooltip.data.texts[0] && (
                <div style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: '14px',
                  color: 'rgba(255,255,255,0.85)',
                  lineHeight: '1.8',
                  marginBottom: '8px',
                  direction: tooltip.data.texts[0].language === 'HEB' ? 'rtl' : 'ltr',
                }}>
                  {tooltip.data.texts[0].text}
                </div>
              )}
              {tooltip.data.translations[0] && (
                <div style={{
                  fontFamily: 'Spectral, serif',
                  fontSize: '13px',
                  fontStyle: 'italic',
                  color: 'var(--gold-light)',
                  lineHeight: '1.6',
                  borderTop: '1px solid rgba(255,255,255,0.1)',
                  paddingTop: '8px',
                }}>
                  {tooltip.data.translations[0].textFr}
                </div>
              )}
            </>
          ) : (
            <div style={{ fontFamily: 'Spectral, serif', fontSize: '13px', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
              Verset introuvable
            </div>
          )}
        </div>
      )}
    </>
  )
}