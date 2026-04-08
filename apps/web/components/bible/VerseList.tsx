'use client'

import { useState } from 'react'

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
  _count?: {
    comments: number
    translations: number
  }
  hasContributions?: boolean
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
  const [copiedId, setCopiedId] = useState<string | null>(null)
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
            id={`v${verse.number}`}
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
              borderLeft: verse.hasContributions
                ? '3px solid rgba(184,132,58,0.4)'
                : '3px solid transparent',
            }}
          >
            <div style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: '11px',
              color: 'var(--gold)',
              paddingTop: '4px',
              textAlign: 'right',
              fontWeight: '300',
              position: 'relative',
            }}
              onMouseEnter={e => { const btn = e.currentTarget.querySelector('.copy-btn') as HTMLElement; if (btn) btn.style.opacity = '1' }}
              onMouseLeave={e => { const btn = e.currentTarget.querySelector('.copy-btn') as HTMLElement; if (btn) btn.style.opacity = '0' }}
            >
              {verse.number}
              <button
                className="copy-btn"
                onClick={e => {
                  e.stopPropagation()
                  const ref = `${bookName} ${chapter}:${verse.number}`
                  const text = translation ? `${ref}\n« ${translation.textFr} »` : ref
                  navigator.clipboard.writeText(text)
                  setCopiedId(verse.id)
                  setTimeout(() => setCopiedId(null), 2000)
                }}
                style={{
                  position: 'absolute',
                  top: '2px',
                  right: '18px',
                  opacity: 0,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px',
                  color: 'var(--gold)',
                  transition: 'opacity 0.15s',
                }}
                title="Copier la référence et le texte"
              >
                {copiedId === verse.id ? (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--green-valid)" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                ) : (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                )}
              </button>
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