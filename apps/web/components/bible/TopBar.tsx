'use client'

interface TopBarProps {
  testament: 'AT' | 'NT'
  book: string
  chapter: string
}

import { useAuthStore } from '@/store/auth'
import { useEffect } from 'react'

export default function TopBar({ testament, book, chapter }: TopBarProps) {
  const { user, setUser, setToken } = useAuthStore()

  useEffect(() => {
    const token = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')
    if (token && savedUser) {
      setToken(token)
      setUser(JSON.parse(savedUser))
    }
  }, [])
  return (
    <div style={{
      gridColumn: '1 / -1',
      background: 'var(--ink)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      gap: '32px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{
        fontFamily: 'Crimson Pro, serif',
        fontSize: '22px',
        fontWeight: '300',
        color: 'var(--gold-light)',
        letterSpacing: '0.06em',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <span style={{ opacity: 0.7, fontStyle: 'italic' }}>בּ</span>
        Biblia
      </div>
      <div style={{ display: 'flex', gap: '2px', marginLeft: '8px' }}>
        {[
          {
            label: 'Ancien Testament',
            href: testament === 'AT' ? `/at/${book}/${chapter}` : `/at/genese/1`,
            active: testament === 'AT',
          },
          {
            label: 'Nouveau Testament',
            href: testament === 'NT' ? `/nt/${book}/${chapter}` : `/nt/matthieu/1`,
            active: testament === 'NT',
          },
        ].map(tab => (
          <a key={tab.label} href={tab.href} style={{
            padding: '6px 16px',
            fontFamily: 'DM Mono, monospace',
            fontSize: '11px',
            letterSpacing: '0.08em',
            color: tab.active ? 'var(--gold-light)' : 'rgba(255,255,255,0.45)',
            borderRadius: '4px',
            background: tab.active ? 'rgba(184,132,58,0.2)' : 'transparent',
            textDecoration: 'none',
            textTransform: 'uppercase' as const,
          }}>
            {tab.label}
          </a>
        ))}
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
        {user ? (
          <>
            <span style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: '10px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase' as const,
              padding: '4px 10px',
              borderRadius: '20px',
              background: 'rgba(42,74,122,0.4)',
              color: '#9ab4d8',
              border: '1px solid rgba(154,180,216,0.25)',
            }}>
              {user.role}
            </span>
            <span style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: '10px',
              color: 'rgba(255,255,255,0.6)',
              letterSpacing: '0.08em',
            }}>
              {user.username}
            </span>
          </>
        ) : (
          <>
            <span style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: '10px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase' as const,
              padding: '4px 10px',
              borderRadius: '20px',
              background: 'rgba(42,74,122,0.4)',
              color: '#9ab4d8',
              border: '1px solid rgba(154,180,216,0.25)',
            }}>
              Visiteur
            </span>
            <a href="/login" style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: '10px',
              color: 'rgba(255,255,255,0.5)',
              textDecoration: 'none',
              letterSpacing: '0.08em',
            }}>
              Connexion
            </a>
          </>
        )}
      </div>
    </div>
  )
}