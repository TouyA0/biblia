'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import api from '@/lib/api'

interface SearchResult {
  id: string
  number: number
  texts: { language: string; text: string }[]
  translations: { textFr: string }[]
  chapter: {
    number: number
    book: { name: string; slug: string; testament: string }
  }
}

export default function SearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setOpen(false); return }
    setLoading(true)
    try {
      const res = await api.get(`/api/search?q=${encodeURIComponent(q)}`)
      setResults(res.data)
      setOpen(true)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => search(query), 400)
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [query, search])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function highlight(text: string, q: string) {
    if (!q) return text
    const idx = text.toLowerCase().indexOf(q.toLowerCase())
    if (idx === -1) return text
    return (
      text.slice(0, idx) +
      `<mark style="background:rgba(184,132,58,0.3);color:inherit;border-radius:2px;">${text.slice(idx, idx + q.length)}</mark>` +
      text.slice(idx + q.length)
    )
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '6px',
        padding: '5px 10px',
      }}>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', flexShrink: 0 }}>🔍</span>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Rechercher un verset..."
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontFamily: 'Spectral, serif',
            fontSize: '14px',
            color: 'rgba(255,255,255,0.8)',
            letterSpacing: '0.02em',
          }}
        />
        {loading && (
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', flexShrink: 0 }}>…</span>
        )}
        {query && !loading && (
          <button
            onClick={() => { setQuery(''); setResults([]); setOpen(false) }}
            style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '12px', padding: 0, flexShrink: 0 }}
          >
            ✕
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '38px',
          left: 0,
          right: 0,
          background: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          boxShadow: '0 8px 32px rgba(26,22,18,0.15)',
          zIndex: 1000,
          maxHeight: '400px',
          overflowY: 'auto',
        }}>
          <div style={{
            padding: '8px 12px',
            fontFamily: 'DM Mono, monospace',
            fontSize: '11px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase' as const,
            color: 'var(--ink-muted)',
            borderBottom: '1px solid var(--border)',
            background: 'var(--parchment-dark)',
          }}>
            {results.length} résultat{results.length > 1 ? 's' : ''} pour « {query} »
          </div>
          {results.map(verse => {
            const testament = verse.chapter.book.testament === 'AT' ? 'at' : 'nt'
            const url = `/${testament}/${verse.chapter.book.slug}/${verse.chapter.number}?verse=${verse.id}&tab=verse#v${verse.number}`
            const translation = verse.translations[0]?.textFr || ''
            const original = verse.texts[0]?.text || ''
            return (
              <div
                key={verse.id}
                onClick={() => { setOpen(false); setQuery(''); window.location.href = url }}
                style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--parchment)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <div style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: '11px',
                  color: 'var(--gold)',
                  marginBottom: '4px',
                }}>
                  {verse.chapter.book.name} {verse.chapter.number}:{verse.number}
                </div>
                {translation && (
                  <div
                    style={{ fontFamily: 'Spectral, serif', fontSize: '14px', fontStyle: 'italic', color: 'var(--ink-soft)', lineHeight: '1.5', marginBottom: original ? '4px' : 0 }}
                    dangerouslySetInnerHTML={{ __html: highlight(translation, query) }}
                  />
                )}
                {original && (
                  <div
                    style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: 'var(--ink-faint)', direction: verse.texts[0]?.language === 'HEB' ? 'rtl' : 'ltr' }}
                    dangerouslySetInnerHTML={{ __html: highlight(original, query) }}
                  />
                )}
              </div>
            )
          })}
          {results.length === 20 && (
            <div style={{ padding: '8px 14px', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink-faint)', textAlign: 'center' }}>
              Affichage limité à 20 résultats — affinez votre recherche
            </div>
          )}
        </div>
      )}

      {open && query.length >= 2 && results.length === 0 && !loading && (
        <div style={{
          position: 'absolute',
          top: '38px',
          left: 0,
          right: 0,
          background: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          boxShadow: '0 8px 32px rgba(26,22,18,0.15)',
          zIndex: 1000,
          padding: '16px',
          textAlign: 'center',
          fontFamily: 'Spectral, serif',
          fontSize: '14px',
          color: 'var(--ink-faint)',
          fontStyle: 'italic',
        }}>
          Aucun résultat pour « {query} »
        </div>
      )}
    </div>
  )
}