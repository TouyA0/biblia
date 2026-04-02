'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'

export default function LoginPage() {
  const router = useRouter()
  const { setUser, setToken } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/api/auth/login', { email, password })
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('refreshToken', res.data.refreshToken)
      localStorage.setItem('user', JSON.stringify(res.data.user))
      setToken(res.data.token)
      setUser(res.data.user)
      router.push('/')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } }
      if (error.response?.data?.error === 'FORCE_PASSWORD_RESET') {
        setError('Votre mot de passe doit être réinitialisé. Contactez un administrateur.')
      } else {
        setError(error.response?.data?.error || 'Erreur de connexion')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--parchment)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        padding: '40px',
        background: 'white',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        boxShadow: '0 4px 24px rgba(26,22,18,0.08)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            fontFamily: 'Crimson Pro, serif',
            fontSize: '28px',
            fontWeight: '300',
            color: 'var(--gold)',
            marginBottom: '8px',
          }}>
            בּ Biblia
          </div>
          <div style={{
            fontFamily: 'Spectral, serif',
            fontSize: '14px',
            color: 'var(--ink-muted)',
            fontStyle: 'italic',
          }}>
            Connexion à votre compte
          </div>
        </div>

        {error && (
          <div style={{
            padding: '10px 14px',
            background: 'var(--red-light)',
            border: '1px solid rgba(122,42,42,0.2)',
            borderRadius: '6px',
            color: 'var(--red-soft)',
            fontFamily: 'Spectral, serif',
            fontSize: '13px',
            marginBottom: '20px',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontFamily: 'DM Mono, monospace',
              fontSize: '10px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--ink-muted)',
              marginBottom: '6px',
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                background: 'var(--parchment)',
                fontFamily: 'Spectral, serif',
                fontSize: '14px',
                color: 'var(--ink)',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontFamily: 'DM Mono, monospace',
              fontSize: '10px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--ink-muted)',
              marginBottom: '6px',
            }}>
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                background: 'var(--parchment)',
                fontFamily: 'Spectral, serif',
                fontSize: '14px',
                color: 'var(--ink)',
                outline: 'none',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              background: 'var(--gold)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontFamily: 'DM Mono, monospace',
              fontSize: '11px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <div style={{
          textAlign: 'center',
          marginTop: '20px',
          fontFamily: 'Spectral, serif',
          fontSize: '13px',
          color: 'var(--ink-muted)',
        }}>
          Pas encore de compte ?{' '}
          <Link href="/register" style={{ color: 'var(--gold)' }}>
            S&apos;inscrire
          </Link>
        </div>
      </div>
    </div>
  )
}