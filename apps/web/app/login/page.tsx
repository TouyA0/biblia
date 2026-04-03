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
  const [forceReset, setForceReset] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

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
      if (res.data.forcePasswordReset) {
        setForceReset(true)
      } else {
        router.push('/')
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } }
      setError(error.response?.data?.error || 'Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  async function handleReset() {
    setError('')
    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return
    }
    if (newPassword.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caractères')
      return
    }
    setLoading(true)
    try {
      await api.patch('/api/profile/password', { currentPassword, newPassword })
      await api.patch('/api/profile/clear-reset')
      router.push('/')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } }
      setError(error.response?.data?.error || 'Erreur')
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

        {forceReset ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '28px', fontWeight: '300', color: 'var(--gold)', marginBottom: '8px' }}>
                בּ Biblia
              </div>
            </div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.08em', color: 'var(--ink)', marginBottom: '8px' }}>
              Nouveau mot de passe requis
            </div>
            <div style={{ fontFamily: 'Spectral, serif', fontSize: '13px', color: 'var(--amber-pending)', fontStyle: 'italic', marginBottom: '24px', padding: '10px 14px', background: 'var(--amber-light)', border: '1px solid rgba(122,90,26,0.2)', borderRadius: '6px' }}>
              Un administrateur vous demande de changer votre mot de passe avant de continuer.
            </div>

            {error && (
              <div style={{ padding: '10px 14px', background: 'var(--red-light)', border: '1px solid rgba(122,42,42,0.2)', borderRadius: '6px', color: 'var(--red-soft)', fontFamily: 'Spectral, serif', fontSize: '13px', marginBottom: '20px' }}>
                {error}
              </div>
            )}

            {[
              { label: 'Mot de passe actuel', value: currentPassword, setter: setCurrentPassword },
              { label: 'Nouveau mot de passe', value: newPassword, setter: setNewPassword },
              { label: 'Confirmer', value: confirmPassword, setter: setConfirmPassword },
            ].map(field => (
              <div key={field.label} style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--ink-muted)', marginBottom: '6px' }}>
                  {field.label}
                </label>
                <input
                  type="password"
                  value={field.value}
                  onChange={e => field.setter(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--parchment)', fontFamily: 'Spectral, serif', fontSize: '14px', color: 'var(--ink)', outline: 'none' }}
                />
              </div>
            ))}

            <button
              onClick={handleReset}
              disabled={loading || !currentPassword || !newPassword || !confirmPassword}
              style={{ width: '100%', padding: '12px', background: 'var(--gold)', color: 'white', border: 'none', borderRadius: '6px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading || !currentPassword || !newPassword || !confirmPassword ? 0.6 : 1 }}
            >
              {loading ? 'Enregistrement...' : 'Changer le mot de passe'}
            </button>
          </>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '28px', fontWeight: '300', color: 'var(--gold)', marginBottom: '8px' }}>
                בּ Biblia
              </div>
              <div style={{ fontFamily: 'Spectral, serif', fontSize: '14px', color: 'var(--ink-muted)', fontStyle: 'italic' }}>
                Connexion à votre compte
              </div>
            </div>

            {error && (
              <div style={{ padding: '10px 14px', background: 'var(--red-light)', border: '1px solid rgba(122,42,42,0.2)', borderRadius: '6px', color: 'var(--red-soft)', fontFamily: 'Spectral, serif', fontSize: '13px', marginBottom: '20px' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: '6px' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--parchment)', fontFamily: 'Spectral, serif', fontSize: '14px', color: 'var(--ink)', outline: 'none' }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: '6px' }}>
                  Mot de passe
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--parchment)', fontFamily: 'Spectral, serif', fontSize: '14px', color: 'var(--ink)', outline: 'none' }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{ width: '100%', padding: '12px', background: 'var(--gold)', color: 'white', border: 'none', borderRadius: '6px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
              >
                {loading ? 'Connexion...' : 'Se connecter'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '20px', fontFamily: 'Spectral, serif', fontSize: '13px', color: 'var(--ink-muted)' }}>
              Pas encore de compte ?{' '}
              <Link href="/register" style={{ color: 'var(--gold)' }}>
                S&apos;inscrire
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}