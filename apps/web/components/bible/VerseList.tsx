'use client'

interface WordToken {
  id: string
  position: number
  word: string
  lemma: string
  translit: string | null
  strongNumber: string | null
  morphology: string | null
}

interface VerseText {
  id: string
  language: string
  text: string
  wordTokens: WordToken[]
}

interface Translation {
  id: string
  textFr: string
  isActive: boolean
}

interface Verse {
  id: string
  number: number
  reference: string
  texts: VerseText[]
  translations: Translation[]
}

interface VerseListProps {
  verses: Verse[]
  bookName: string
  chapter: string
  activeVerseId: string | null
  activeWordId: string | null
  onVerseClick: (verse: Verse) => void
  onWordClick: (token: WordToken, x: number, y: number) => void
}

export default function VerseList({ verses, bookName, chapter, activeVerseId, activeWordId, onVerseClick, onWordClick }: VerseListProps) {
  return (
    <div style={{ overflowY: 'auto', padding: '40px 48px' }}>
      <div style={{ marginBottom: '36px' }}>
        <div style={{
          fontFamily: 'DM Mono, monospace',
          fontSize: '13px',
          fontWeight: '400',
          letterSpacing: '0.12em',
          textTransform: 'uppercase' as const,
          color: 'var(--gold)',
          marginBottom: '6px',
        }}>
          {bookName} · Chapitre {chapter}
        </div>
      </div>

      {verses.map(verse => {
        const originalText = verse.texts.find(t => t.language === 'HEB' || t.language === 'GRK')
        const translation = verse.translations[0]

        return (
          <div
            key={verse.id}
            onClick={() => onVerseClick(verse)}
            style={{
              display: 'grid',
              gridTemplateColumns: '32px 1fr',
              gap: '0 16px',
              marginBottom: '20px',
              cursor: 'pointer',
              borderRadius: '8px',
              padding: '8px',
              marginLeft: '-8px',
              background: activeVerseId === verse.id ? 'var(--gold-pale)' : 'transparent',
              outline: activeVerseId === verse.id ? '1.5px solid var(--gold)' : 'none',
              transition: 'background 0.2s',
            }}
          >
            <div style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: '11px',
              color: 'var(--gold)',
              paddingTop: '4px',
              textAlign: 'right',
              fontWeight: '300',
            }}>
              {verse.number}
            </div>
            <div>
              {originalText && (
                <div style={{
                  fontSize: '18px',
                  lineHeight: '2',
                  direction: originalText.language === 'HEB' ? 'rtl' : 'ltr',
                  textAlign: originalText.language === 'HEB' ? 'right' : 'left',
                  color: 'var(--ink)',
                  marginBottom: '6px',
                  fontWeight: '300',
                }}>
                  {(originalText.wordTokens || []).map((token, i) => (
                    <span
                      key={token.id}
                      onClick={e => {
                        e.stopPropagation()
                        const rect = (e.target as HTMLElement).getBoundingClientRect()
                        onWordClick(token, rect.left + rect.width / 2, rect.bottom + window.scrollY)
                      }}
                      style={{
                        cursor: 'pointer',
                        borderRadius: '3px',
                        padding: '0 2px',
                        background: activeWordId === token.id ? 'var(--gold)' : 'transparent',
                        color: activeWordId === token.id ? 'white' : 'inherit',
                        display: 'inline-block',
                        transition: 'all 0.15s',
                      }}
                    >
                      {token.word}{i < originalText.wordTokens.length - 1 ? '\u00A0' : ''}
                    </span>
                  ))}
                </div>
              )}
              {translation && (
                <div style={{
                  fontFamily: 'Spectral, serif',
                  fontSize: '15px',
                  color: 'var(--ink-soft)',
                  fontStyle: 'italic',
                  lineHeight: '1.7',
                }}>
                  {translation.textFr}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}