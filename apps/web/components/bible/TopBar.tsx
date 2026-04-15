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
import { useEffect, useRef, useState } from 'react'
import { getRoleColor, getRoleBackground, getRoleBorder } from '@/lib/roleColors'
import { useTheme } from '@/lib/useTheme'
import NotificationBell from './NotificationBell'
import SearchBar from './SearchBar'
import Link from 'next/link'

export default function TopBar({ testament, book, chapter, showSearch = true, showTestaments = true, onMenuClick }: TopBarProps) {
  const { user, setUser, setToken } = useAuthStore()
  const { dark, toggle: toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')
    if (token && savedUser) {
      setToken(token)
      setUser(JSON.parse(savedUser))
    }
  }, [])

  // Fermeture du menu au clic extérieur
  useEffect(() => {
    if (!menuOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

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

  const avatarLetter = user?.username?.[0]?.toUpperCase() ?? '?'

  function handleLogout() {
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
    window.location.href = '/login'
  }

  return (
    <div style={{
      gridColumn: '1 / -1',
      width: '100%',
      height: '52px',
      background: 'var(--topbar-bg)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: '8px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      boxSizing: 'border-box',
      position: 'relative',
    }}>

      {/* ── Gauche : hamburger + logo + AT/NT ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>

        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="show-non-desktop"
            aria-label="Ouvrir le menu"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '6px',
              color: 'rgba(255,255,255,0.6)',
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
            }}
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
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                transition: 'color 0.15s, background 0.15s',
              }}>
                <span className="topbar-label-full">{tab.label}</span>
                <span className="topbar-label-short">{tab.short}</span>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* ── Centre : SearchBar ── */}
      {showSearch && (
        <div className="hide-tablet" style={{
          flex: '0 1 380px',
          display: 'flex',
          justifyContent: 'center',
        }}>
          <SearchBar />
        </div>
      )}

      {/* ── Droite : cloche + utilisateur ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>

        {/* Cloche de notifications (utilisateurs connectés) */}
        {user && <NotificationBell />}

        {/* Bouton utilisateur (connecté) ou lien connexion (visiteur) */}
        {user ? (
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: menuOpen ? 'rgba(255,255,255,0.08)' : 'transparent',
                border: '1px solid',
                borderColor: menuOpen ? 'rgba(255,255,255,0.12)' : 'transparent',
                borderRadius: '8px',
                cursor: 'pointer',
                padding: '5px 8px 5px 6px',
                transition: 'background 0.15s, border-color 0.15s',
                color: 'rgba(255,255,255,0.7)',
                marginLeft: '2px',
              }}
              onMouseEnter={e => {
                if (!menuOpen) {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'
                  ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'
                }
              }}
              onMouseLeave={e => {
                if (!menuOpen) {
                  (e.currentTarget as HTMLElement).style.background = 'transparent'
                  ;(e.currentTarget as HTMLElement).style.borderColor = 'transparent'
                }
              }}
            >
              {/* Avatar */}
              <div style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                background: 'rgba(184,132,58,0.35)',
                border: '1px solid rgba(184,132,58,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'DM Mono, monospace',
                fontSize: '11px',
                fontWeight: '400',
                color: 'var(--gold-light)',
                flexShrink: 0,
              }}>
                {avatarLetter}
              </div>
              {/* Nom d'utilisateur */}
              <span style={{
                fontFamily: 'DM Mono, monospace',
                fontSize: '12px',
                letterSpacing: '0.06em',
                color: 'rgba(255,255,255,0.65)',
                maxWidth: '100px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {user.username}
              </span>
              {/* Chevron */}
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                style={{
                  flexShrink: 0,
                  opacity: 0.45,
                  transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}
              >
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {/* ── Dropdown ── */}
            {menuOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                minWidth: '220px',
                background: '#1a1714',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                overflow: 'hidden',
                zIndex: 1000,
              }}>

                {/* En-tête : avatar + nom + rôle */}
                <div style={{
                  padding: '14px 16px',
                  borderBottom: '1px solid rgba(255,255,255,0.07)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'rgba(184,132,58,0.3)',
                    border: '1px solid rgba(184,132,58,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'DM Mono, monospace',
                    fontSize: '14px',
                    color: 'var(--gold-light)',
                    flexShrink: 0,
                  }}>
                    {avatarLetter}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'DM Mono, monospace',
                      fontSize: '13px',
                      color: 'rgba(255,255,255,0.85)',
                      letterSpacing: '0.05em',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {user.username}
                    </div>
                    <div style={{
                      marginTop: '4px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '2px 8px',
                      borderRadius: '20px',
                      background: getRoleBackground(user.role),
                      color: getRoleColor(user.role),
                      border: `1px solid ${getRoleBorder(user.role)}`,
                      fontFamily: 'DM Mono, monospace',
                      fontSize: '10px',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                    }}>
                      {user.role}
                    </div>
                  </div>
                </div>

                {/* Liens */}
                <div style={{ padding: '6px 0' }}>

                  <Link
                    href="/profile"
                    onClick={() => setMenuOpen(false)}
                    style={dropdownItemStyle}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                    Mon profil
                  </Link>

                  <Link
                    href="/contributeurs"
                    onClick={() => setMenuOpen(false)}
                    style={dropdownItemStyle}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    Contributeurs
                  </Link>

                  {user.role === 'ADMIN' && (
                    <Link
                      href="/admin"
                      onClick={() => setMenuOpen(false)}
                      style={{ ...dropdownItemStyle, color: '#e88' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(200,80,80,0.08)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>
                      </svg>
                      Administration
                    </Link>
                  )}

                  {/* Séparateur */}
                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '6px 0' }} />

                  {/* Toggle thème */}
                  <button
                    onClick={() => { toggleTheme(); setMenuOpen(false) }}
                    style={{
                      ...dropdownButtonStyle,
                      width: '100%',
                      textAlign: 'left',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    {dark ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="5"/>
                        <line x1="12" y1="1" x2="12" y2="3"/>
                        <line x1="12" y1="21" x2="12" y2="23"/>
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                        <line x1="1" y1="12" x2="3" y2="12"/>
                        <line x1="21" y1="12" x2="23" y2="12"/>
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                      </svg>
                    )}
                    {dark ? 'Mode jour' : 'Mode nuit'}
                  </button>

                  {/* Séparateur */}
                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '6px 0' }} />

                  {/* Déconnexion */}
                  <button
                    onClick={handleLogout}
                    style={{
                      ...dropdownButtonStyle,
                      width: '100%',
                      textAlign: 'left',
                      color: 'rgba(255,120,120,0.7)',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(200,80,80,0.08)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                      <polyline points="16 17 21 12 16 7"/>
                      <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    Déconnexion
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Visiteur */
          <a href="/login" style={{
            fontFamily: 'DM Mono, monospace',
            fontSize: '12px',
            color: 'rgba(255,255,255,0.5)',
            textDecoration: 'none',
            letterSpacing: '0.08em',
            padding: '6px 10px',
            borderRadius: '6px',
            border: '1px solid rgba(255,255,255,0.1)',
            whiteSpace: 'nowrap',
            transition: 'color 0.15s, border-color 0.15s',
            marginLeft: '4px',
          }}>
            Connexion
          </a>
        )}
      </div>
    </div>
  )
}

/* ── Styles partagés pour les items du dropdown ── */

const dropdownItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '9px 16px',
  fontFamily: 'DM Mono, monospace',
  fontSize: '12px',
  letterSpacing: '0.06em',
  color: 'rgba(255,255,255,0.6)',
  textDecoration: 'none',
  background: 'transparent',
  transition: 'background 0.1s',
  cursor: 'pointer',
}

const dropdownButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '9px 16px',
  fontFamily: 'DM Mono, monospace',
  fontSize: '12px',
  letterSpacing: '0.06em',
  color: 'rgba(255,255,255,0.6)',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  transition: 'background 0.1s',
}
