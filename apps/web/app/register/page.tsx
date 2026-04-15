'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', username: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirm) {
      setError('Les mots de passe ne correspondent pas')
      return
    }
    setLoading(true)
    setError('')
    try {
      await api.post('/api/auth/register', {
        email: form.email,
        username: form.username,
        password: form.password,
      })
      router.push('/login?registered=true')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } }
      setError(error.response?.data?.error || 'Erreur lors de l\'inscription')
    } finally {
      setLoading(false)
    }
  }

  const fields = [
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'username', label: 'Nom d\'utilisateur', type: 'text' },
    { key: 'password', label: 'Mot de passe', type: 'password' },
    { key: 'confirm', label: 'Confirmer le mot de passe', type: 'password' },
  ]

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
        background: 'var(--card-bg)',
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
            Créer un compte
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
            fontSize: '14px',
            marginBottom: '20px',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {fields.map(({ key, label, type }) => (
            <div key={key} style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontFamily: 'DM Mono, monospace',
                fontSize: '12px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--ink-muted)',
                marginBottom: '6px',
              }}>
                {label}
              </label>
              <input
                type={type}
                value={form[key as keyof typeof form]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  background: 'var(--input-bg)',
                  fontFamily: 'Spectral, serif',
                  fontSize: '14px',
                  color: 'var(--ink)',
                  outline: 'none',
                }}
              />
            </div>
          ))}

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
              fontSize: '12px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              marginTop: '8px',
            }}
          >
            {loading ? 'Création...' : 'Créer mon compte'}
          </button>
        </form>

        <div style={{
          textAlign: 'center',
          marginTop: '20px',
          fontFamily: 'Spectral, serif',
          fontSize: '14px',
          color: 'var(--ink-muted)',
        }}>
          Déjà un compte ?{' '}
          <Link href="/login" style={{ color: 'var(--gold)' }}>
            Se connecter
          </Link>
        </div>
      </div>
    </div>
  )
}