'use client'

interface WordToken {
  id: string
  word: string
  lemma: string
  translit: string | null
  strongNumber: string | null
  morphology: string | null
}

interface WordPopoverProps {
  word: WordToken
  position: { x: number; y: number }
  onClose: () => void
  onOpenPanel: () => void
}

export default function WordPopover({ word, position, onClose, onOpenPanel }: WordPopoverProps) {
  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'fixed',
        left: `${position.x - 130}px`,
        top: `${position.y + 10}px`,
        width: '260px',
        background: 'var(--ink)',
        borderRadius: '10px',
        padding: '16px 18px',
        boxShadow: '0 8px 40px rgba(26,22,18,0.3)',
        zIndex: 100,
      }}
    >
      <div style={{
        position: 'absolute',
        top: '-8px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0,
        height: 0,
        borderLeft: '8px solid transparent',
        borderRight: '8px solid transparent',
        borderBottom: '8px solid var(--ink)',
      }} />

      <div style={{
        fontSize: '28px',
        fontWeight: '300',
        color: 'white',
        textAlign: 'right',
        direction: 'rtl',
        marginBottom: '4px',
      }}>
        {word.word}
      </div>

      {word.translit && (
        <div style={{
          fontFamily: 'DM Mono, monospace',
          fontSize: '11px',
          color: 'var(--gold-light)',
          marginBottom: '10px',
        }}>
          {word.translit}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
        {word.strongNumber && (
          <span style={{
            fontFamily: 'DM Mono, monospace',
            fontSize: '9px',
            padding: '2px 8px',
            borderRadius: '20px',
            background: 'rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.65)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}>
            {word.strongNumber}
          </span>
        )}
        {word.morphology && (
          <span style={{
            fontFamily: 'DM Mono, monospace',
            fontSize: '9px',
            padding: '2px 8px',
            borderRadius: '20px',
            background: 'rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.65)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}>
            {word.morphology}
          </span>
        )}
        {word.lemma && (
          <span style={{
            fontFamily: 'DM Mono, monospace',
            fontSize: '9px',
            padding: '2px 8px',
            borderRadius: '20px',
            background: 'rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.65)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}>
            Racine: {word.lemma}
          </span>
        )}
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '10px 0' }} />

      <div
        onClick={() => { onClose(); onOpenPanel() }}
        style={{
          fontFamily: 'DM Mono, monospace',
          fontSize: '10px',
          color: 'var(--gold-light)',
          marginTop: '10px',
          cursor: 'pointer',
          opacity: 0.8,
        }}
      >
        Voir tout → panneau droit
      </div>
    </div>
  )
}