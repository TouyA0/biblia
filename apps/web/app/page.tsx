'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function HomePage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--parchment)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Spectral, Georgia, serif',
    }}>
      <div style={{ textAlign: 'center', maxWidth: '600px', padding: '40px' }}>
        <div style={{
          fontFamily: 'Crimson Pro, serif',
          fontSize: '72px',
          fontWeight: '300',
          color: 'var(--gold)',
          marginBottom: '8px',
          letterSpacing: '0.04em',
        }}>
          בּ
        </div>
        <div style={{
          fontFamily: 'Crimson Pro, serif',
          fontSize: '48px',
          fontWeight: '300',
          color: 'var(--ink)',
          marginBottom: '16px',
          letterSpacing: '0.06em',
        }}>
          Biblia
        </div>
        <div style={{
          fontFamily: 'Spectral, serif',
          fontSize: '18px',
          color: 'var(--ink-muted)',
          fontStyle: 'italic',
          marginBottom: '48px',
          lineHeight: '1.8',
        }}>
          Plateforme collaborative de traduction biblique
        </div>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <Link href="/at/genese/1" style={{
            padding: '14px 32px',
            background: 'var(--ink)',
            color: 'var(--gold-light)',
            textDecoration: 'none',
            borderRadius: '6px',
            fontFamily: 'DM Mono, monospace',
            fontSize: '11px',
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
            fontSize: '11px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            border: '1px solid var(--border-strong)',
          }}>
            Nouveau Testament
          </Link>
        </div>
      </div>
    </div>
  )
}