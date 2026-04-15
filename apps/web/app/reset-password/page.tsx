'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
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
      // Marquer forcePasswordReset comme false
      await api.patch('/api/profile/clear-reset')
      router.push('/')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } }
      setError(error.response?.data?.error || 'Erreur')
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
      background: 'var(--input-bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        padding: '40px',
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
      }}>
        <div style={{
          fontFamily: 'Crimson Pro, serif',
          fontSize: '24px',
          fontWeight: '300',
          color: 'var(--ink)',
          marginBottom: '8px',
        }}>
          Réinitialisation du mot de passe
        </div>
        <div style={{
          fontFamily: 'Spectral, serif',
          fontSize: '14px',
          color: 'var(--ink-muted)',
          fontStyle: 'italic',
          marginBottom: '24px',
        }}>
          Un administrateur vous demande de changer votre mot de passe.
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

        {[
          { label: 'Mot de passe actuel', value: currentPassword, setter: setCurrentPassword },
          { label: 'Nouveau mot de passe', value: newPassword, setter: setNewPassword },
          { label: 'Confirmer le nouveau mot de passe', value: confirmPassword, setter: setConfirmPassword },
        ].map(field => (
          <div key={field.label} style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontFamily: 'DM Mono, monospace',
              fontSize: '12px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase' as const,
              color: 'var(--ink-muted)',
              marginBottom: '6px',
            }}>
              {field.label}
            </label>
            <input
              type="password"
              value={field.value}
              onChange={e => field.setter(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
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
          onClick={handleSubmit}
          disabled={loading || !currentPassword || !newPassword || !confirmPassword}
          style={{
            width: '100%',
            padding: '12px',
            background: 'var(--gold)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontFamily: 'DM Mono, monospace',
            fontSize: '12px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase' as const,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading || !currentPassword || !newPassword || !confirmPassword ? 0.6 : 1,
          }}
        >
          {loading ? 'Enregistrement...' : 'Changer le mot de passe'}
        </button>
      </div>
    </div>
  )
}