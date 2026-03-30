'use client'

interface ConfirmModalProps {
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({ message, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(26,22,18,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 200,
    }}>
      <div style={{
        background: 'var(--parchment)',
        borderRadius: '12px',
        padding: '32px',
        maxWidth: '380px',
        width: '90%',
        border: '1px solid var(--border-strong)',
        boxShadow: '0 8px 40px rgba(26,22,18,0.3)',
      }}>
        <div style={{
          fontFamily: 'Crimson Pro, serif',
          fontSize: '20px',
          fontWeight: '300',
          color: 'var(--gold)',
          marginBottom: '16px',
          textAlign: 'center',
        }}>
          בּ Confirmation
        </div>
        <div style={{
          fontFamily: 'Spectral, serif',
          fontSize: '15px',
          color: 'var(--ink-soft)',
          fontStyle: 'italic',
          lineHeight: '1.7',
          textAlign: 'center',
          marginBottom: '28px',
        }}>
          {message}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '10px',
              background: 'transparent',
              color: 'var(--ink-muted)',
              border: '1px solid var(--border-strong)',
              borderRadius: '6px',
              fontFamily: 'DM Mono, monospace',
              fontSize: '10px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase' as const,
              cursor: 'pointer',
            }}
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '10px',
              background: 'var(--red-soft)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontFamily: 'DM Mono, monospace',
              fontSize: '10px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase' as const,
              cursor: 'pointer',
            }}
          >
            Confirmer
          </button>
        </div>
      </div>
    </div>
  )
}