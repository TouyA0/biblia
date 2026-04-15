'use client'

import Link from 'next/link'
import TopBar from '@/components/bible/TopBar'

export default function HomePage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--parchment)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Spectral, Georgia, serif',
    }}>
      <TopBar showTestaments={false} showSearch={false} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
      <div style={{ textAlign: 'center', maxWidth: '560px', width: '100%' }}>
        <div style={{
          fontFamily: 'Crimson Pro, serif',
          fontSize: 'clamp(48px, 12vw, 72px)',
          fontWeight: '300',
          color: 'var(--gold)',
          marginBottom: '8px',
          letterSpacing: '0.04em',
        }}>
          בּ
        </div>
        <div style={{
          fontFamily: 'Crimson Pro, serif',
          fontSize: 'clamp(32px, 8vw, 48px)',
          fontWeight: '300',
          color: 'var(--ink)',
          marginBottom: '16px',
          letterSpacing: '0.06em',
        }}>
          Biblia
        </div>
        <div style={{
          fontFamily: 'Spectral, serif',
          fontSize: 'clamp(15px, 3vw, 18px)',
          color: 'var(--ink-muted)',
          fontStyle: 'italic',
          marginBottom: '40px',
          lineHeight: '1.8',
        }}>
          Plateforme collaborative de traduction biblique
        </div>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/at/genese/1" style={{
            padding: '14px 32px',
            background: 'var(--surface-dark)',
            color: 'var(--gold-light)',
            textDecoration: 'none',
            borderRadius: '6px',
            fontFamily: 'DM Mono, monospace',
            fontSize: '12px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}>
            Ancien Testament
          </Link>
          <Link href="/nt/matthieu/1" style={{
            padding: '14px 32px',
            background: 'transparent',
            color: 'var(--ink)',
            textDecoration: 'none',
            borderRadius: '6px',
            fontFamily: 'DM Mono, monospace',
            fontSize: '12px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            border: '1px solid var(--border-strong)',
          }}>
            Nouveau Testament
          </Link>
        </div>
      </div>
      </div>
    </div>
  )
}