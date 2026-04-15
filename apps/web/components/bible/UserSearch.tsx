'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import { getRoleColor } from '@/lib/roleColors'

interface User {
  id: string
  username: string
  role: string
}

export default function UserSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const res = await api.get(`/api/users/search?q=${encodeURIComponent(q)}`)
      setResults(res.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => search(query), 300)
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [query, search])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
        setResults([])
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        title="Rechercher un utilisateur"
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '6px',
          border: '1px solid rgba(255,255,255,0.12)',
          background: open ? 'rgba(255,255,255,0.1)' : 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.5)',
          flexShrink: 0,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: '40px',
          right: 0,
          width: '280px',
          background: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          boxShadow: '0 8px 32px rgba(26,22,18,0.15)',
          zIndex: 1000,
          overflow: 'hidden',
        }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', background: 'var(--parchment-dark)' }}>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher un utilisateur..."
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontFamily: 'Spectral, serif',
                fontSize: '14px',
                color: 'var(--ink)',
              }}
            />
          </div>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {query.length < 2 ? (
              <div style={{ padding: '16px', textAlign: 'center', fontFamily: 'Spectral, serif', fontSize: '14px', color: 'var(--ink-faint)', fontStyle: 'italic' }}>
                Tapez au moins 2 caractères
              </div>
            ) : loading ? (
              <div style={{ padding: '16px', textAlign: 'center', fontFamily: 'Spectral, serif', fontSize: '14px', color: 'var(--ink-faint)', fontStyle: 'italic' }}>
                Chargement...
              </div>
            ) : results.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', fontFamily: 'Spectral, serif', fontSize: '14px', color: 'var(--ink-faint)', fontStyle: 'italic' }}>
                Aucun utilisateur trouvé
              </div>
            ) : results.map(u => (
              <div
                key={u.id}
                onClick={() => { window.location.href = `/profile/${u.username}`; setOpen(false) }}
                style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--parchment)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: getRoleColor(u.role), display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'white', flexShrink: 0 }}>
                  {u.username.substring(0, 2).toUpperCase()}
                </div>
                <div style={{ fontFamily: 'Spectral, serif', fontSize: '14px', color: 'var(--ink)', flex: 1 }}>
                  {u.username}
                </div>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: getRoleColor(u.role) }}>
                  {u.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}