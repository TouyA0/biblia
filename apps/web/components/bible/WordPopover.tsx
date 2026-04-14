'use client'

interface WordToken {
  id: string
  word: string
  lemma: string
  translit: string | null
  strongNumber: string | null
  morphology: string | null
}

interface WordTranslation {
  id: string
  translation: string
  isValidated: boolean
}

interface WordPopoverProps {
  word: WordToken
  position: { x: number; y: number }
  onClose: () => void
  onOpenPanel: () => void
  translations: WordTranslation[]
}

export default function WordPopover({ word, position, onClose, onOpenPanel, translations }: WordPopoverProps) {
  const validatedTranslations = translations.filter(t => t.isValidated)
  const allProposedTranslations = translations.filter(t => !t.isValidated)
  const proposedTranslations = allProposedTranslations.slice(0, 2)
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
          fontSize: '12px',
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
            fontSize: '11px',
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
            fontSize: '11px',
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
            fontSize: '11px',
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

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        marginBottom: '8px',
      }}>
        <span style={{
          fontFamily: 'DM Mono, monospace',
          fontSize: '11px',
          letterSpacing: '0.1em',
          textTransform: 'uppercase' as const,
          color: 'rgba(255,255,255,0.35)',
        }}>
          Traductions
        </span>
        {allProposedTranslations.length > 0 && (
          <span style={{
            fontFamily: 'DM Mono, monospace',
            fontSize: '10px',
            padding: '1px 5px',
            borderRadius: '20px',
            background: 'rgba(122,90,26,0.35)',
            color: 'rgba(212,168,90,0.8)',
            border: '1px solid rgba(122,90,26,0.25)',
          }}>
            {allProposedTranslations.length}
          </span>
        )}
      </div>

      {validatedTranslations.length > 0 ? (
        validatedTranslations.map(t => (
          <div key={t.id} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '4px 0',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
          }}>
            <span style={{
              fontFamily: 'Spectral, serif',
              fontSize: '14px',
              fontStyle: 'italic',
              color: 'rgba(255,255,255,0.85)',
            }}>
              {t.translation}
            </span>
            <span style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: '10px',
              padding: '1px 6px',
              borderRadius: '20px',
              background: 'rgba(45,90,58,0.4)',
              color: '#8fccaa',
              border: '1px solid rgba(45,90,58,0.3)',
              marginLeft: '8px',
              flexShrink: 0,
            }}>
              validée
            </span>
          </div>
        ))
      ) : proposedTranslations.length > 0 ? (
        proposedTranslations.map(t => (
          <div key={t.id} style={{
            padding: '4px 0',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            fontFamily: 'Spectral, serif',
            fontSize: '14px',
            fontStyle: 'italic',
            color: 'rgba(255,255,255,0.65)',
          }}>
            {t.translation}
          </div>
        ))
      ) : (
        <div style={{
          fontFamily: 'Spectral, serif',
          fontSize: '12px',
          fontStyle: 'italic',
          color: 'rgba(255,255,255,0.35)',
        }}>
          Aucune traduction
        </div>
      )}

      <div
        onClick={() => { onClose(); onOpenPanel() }}
        style={{
          fontFamily: 'DM Mono, monospace',
          fontSize: '12px',
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