'use client'

interface TopBarProps {
  testament?: 'AT' | 'NT'
  book?: string
  chapter?: string
  fullscreen?: boolean
  onToggleFullscreen?: () => void
  showSearch?: boolean
  showTestaments?: boolean
  onMenuClick?: () => void
}

import { useAuthStore } from '@/store/auth'
import { useEffect } from 'react'
import { getRoleColor, getRoleBackground, getRoleBorder } from '@/lib/roleColors'
import NotificationBell from './NotificationBell'
import SearchBar from './SearchBar'
import Link from 'next/link'

export default function TopBar({ testament, book, chapter, showSearch = true, showTestaments = true, onMenuClick }: TopBarProps) {
  const { user, setUser, setToken } = useAuthStore()

  useEffect(() => {
    const token = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')
    if (token && savedUser) {
      setToken(token)
      setUser(JSON.parse(savedUser))
    }
  }, [])

  const tabs = [
    {
      label: 'Ancien Testament',
      short: 'AT',
      href: testament === 'AT' ? `/at/${book}/${chapter}` : `/at/genese/1`,
      active: testament === 'AT',
    },
    {
      label: 'Nouveau Testament',
      short: 'NT',
      href: testament === 'NT' ? `/nt/${book}/${chapter}` : `/nt/matthieu/1`,
      active: testament === 'NT',
    },
  ]

  return (
    <div style={{
      gridColumn: '1 / -1',
      width: '100%',
      height: '52px',
      background: 'var(--ink)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      gap: '8px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      boxSizing: 'border-box' as const,
    }}>

      {/* ── Gauche : hamburger + logo + AT/NT ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="show-non-desktop"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '6px',
              color: 'rgba(255,255,255,0.7)',
              alignItems: 'center',
              flexShrink: 0,
            }}
            aria-label="Ouvrir le menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
        )}

        <Link href="/" style={{
          fontFamily: 'Crimson Pro, serif',
          fontSize: '22px',
          fontWeight: '300',
          color: 'var(--gold-light)',
          letterSpacing: '0.06em',
          textDecoration: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexShrink: 0,
        }}>
          <span style={{ opacity: 0.7, fontStyle: 'italic' }}>בּ</span>
          Biblia
        </Link>

        {showTestaments && (
          <div style={{ display: 'flex', gap: '2px', marginLeft: '8px', flexShrink: 0 }}>
            {tabs.map(tab => (
              <a key={tab.short} href={tab.href} style={{
                padding: '6px 12px',
                fontFamily: 'DM Mono, monospace',
                fontSize: '12px',
                letterSpacing: '0.08em',
                color: tab.active ? 'var(--gold-light)' : 'rgba(255,255,255,0.45)',
                borderRadius: '4px',
                background: tab.active ? 'rgba(184,132,58,0.2)' : 'transparent',
                textDecoration: 'none',
                textTransform: 'uppercase' as const,
                whiteSpace: 'nowrap' as const,
              }}>
                <span className="topbar-label-full">{tab.label}</span>
                <span className="topbar-label-short">{tab.short}</span>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* ── Centre : SearchBar centré ── */}
      {showSearch && (
        <div className="hide-tablet" style={{
          flex: '0 1 380px',
          display: 'flex',
          justifyContent: 'center',
        }}>
          <SearchBar />
        </div>
      )}

      {/* ── Droite : section utilisateur ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, justifyContent: 'flex-end', minWidth: 0 }}>
        {user ? (
          <>
            <span className="hide-narrow" style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: '12px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase' as const,
              padding: '4px 10px',
              borderRadius: '20px',
              background: getRoleBackground(user.role),
              color: getRoleColor(user.role),
              border: `1px solid ${getRoleBorder(user.role)}`,
              whiteSpace: 'nowrap' as const,
            }}>
              {user.role}
            </span>
            {user.role === 'ADMIN' && (
              <Link href="/admin" className="hide-narrow" style={{
                fontFamily: 'DM Mono, monospace',
                fontSize: '12px',
                color: '#e88',
                letterSpacing: '0.08em',
                textDecoration: 'none',
                padding: '3px 8px',
                borderRadius: '4px',
                border: '1px solid rgba(122,42,42,0.3)',
                background: 'rgba(122,42,42,0.15)',
                whiteSpace: 'nowrap' as const,
              }}>
                Administration
              </Link>
            )}
            <Link href="/contributeurs" className="hide-narrow" style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: '12px',
              color: 'rgba(255,255,255,0.5)',
              textDecoration: 'none',
              letterSpacing: '0.08em',
              whiteSpace: 'nowrap' as const,
            }}>
              Contributeurs
            </Link>
            <NotificationBell />
            <Link href="/profile" style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: '12px',
              color: 'rgba(255,255,255,0.6)',
              letterSpacing: '0.08em',
              textDecoration: 'none',
              whiteSpace: 'nowrap' as const,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '120px',
            }}>
              {user.username}
            </Link>
            <button
              className="hide-mobile"
              onClick={() => {
                localStorage.removeItem('token')
                localStorage.removeItem('refreshToken')
                localStorage.removeItem('user')
                window.location.href = '/login'
              }}
              style={{
                fontFamily: 'DM Mono, monospace',
                fontSize: '12px',
                color: 'rgba(255,255,255,0.4)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                letterSpacing: '0.08em',
                whiteSpace: 'nowrap' as const,
              }}
            >
              Déconnexion
            </button>
          </>
        ) : (
          <>
            <span className="hide-mobile" style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: '12px',
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
              fontSize: '12px',
              color: 'rgba(255,255,255,0.5)',
              textDecoration: 'none',
              letterSpacing: '0.08em',
              whiteSpace: 'nowrap' as const,
            }}>
              Connexion
            </a>
          </>
        )}
      </div>
    </div>
  )
}
