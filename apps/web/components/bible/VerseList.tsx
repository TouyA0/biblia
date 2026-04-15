'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '@/store/auth'

type FontSize = 'S' | 'M' | 'L'

const FONT_LEVELS: { key: FontSize; btnSize: string }[] = [
  { key: 'S', btnSize: '12px' },
  { key: 'M', btnSize: '15px' },
  { key: 'L', btnSize: '19px' },
]

interface WordToken {
  id: string
  position: number
  word: string
  lemma: string
  translit: string | null
  strongNumber: string | null
  morphology: string | null
  translations?: { id: string }[]
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
  storageKey: string
  onVerseClick: (verse: Verse) => void
  onWordClick: (token: WordToken, x: number, y: number) => void
}

export default function VerseList({ verses, bookName, chapter, activeVerseId, activeWordId, storageKey, onVerseClick, onWordClick }: VerseListProps) {
  const { user } = useAuthStore()
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [fontSize, setFontSizeState] = useState<FontSize>('S')
  const [showFrench, setShowFrenchState] = useState(true)
  const [showMissing, setShowMissingState] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem('verse_font_size') as FontSize | null
    if (saved && ['S', 'M', 'L'].includes(saved)) setFontSizeState(saved)
    const fr = localStorage.getItem('verse_show_french')
    if (fr !== null) setShowFrenchState(fr === 'true')
    const missing = localStorage.getItem('verse_show_missing')
    if (missing !== null) setShowMissingState(missing === 'true')
  }, [])

  // Sauvegarde de la position de lecture
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let timer: ReturnType<typeof setTimeout>
    const onScroll = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        const containerTop = el.getBoundingClientRect().top
        const verseEls = el.querySelectorAll('[id^="v"]')
        for (const v of Array.from(verseEls)) {
          const rect = v.getBoundingClientRect()
          if (rect.bottom > containerTop + 10) {
            const num = Number((v as HTMLElement).id.slice(1))
            if (num > 1) {
              localStorage.setItem(storageKey, String(num))
            } else {
              localStorage.removeItem(storageKey)
            }
            break
          }
        }
      }, 400)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      clearTimeout(timer)
    }
  }, [storageKey])

  function setFontSize(size: FontSize) {
    setFontSizeState(size)
    localStorage.setItem('verse_font_size', size)
  }

  function toggleFrench() {
    const next = !showFrench
    setShowFrenchState(next)
    localStorage.setItem('verse_show_french', String(next))
  }

  function toggleMissing() {
    const next = !showMissing
    setShowMissingState(next)
    localStorage.setItem('verse_show_missing', String(next))
  }

  return (
    <div ref={scrollRef} className="verse-list-scroll" data-verse-size={fontSize}>
      <div className="verse-list-inner">

        {/* En-tête : livre + chapitre + contrôle taille */}
        <div style={{ marginBottom: '48px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              fontWeight: '400',
              letterSpacing: '0.14em',
              textTransform: 'uppercase' as const,
              color: 'var(--gold)',
            }}>
              {bookName} · Chapitre {chapter}
            </div>

            {/* Boutons S / M / L + toggles affichage */}
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              {FONT_LEVELS.map(({ key, btnSize }) => (
                <button
                  key={key}
                  onClick={() => setFontSize(key)}
                  title={`Taille ${key === 'S' ? 'normale' : key === 'M' ? 'grande' : 'très grande'}`}
                  style={{
                    width: '30px',
                    height: '26px',
                    borderRadius: '4px',
                    border: `1px solid ${fontSize === key ? 'var(--gold)' : 'var(--border)'}`,
                    background: fontSize === key ? 'var(--gold-pale)' : 'transparent',
                    color: fontSize === key ? 'var(--gold)' : 'var(--ink-faint)',
                    fontFamily: 'Crimson Pro, serif',
                    fontSize: btnSize,
                    fontWeight: '600',
                    cursor: 'pointer',
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  A
                </button>
              ))}

              {/* Séparateur */}
              <div style={{ width: '1px', height: '16px', background: 'var(--border)', margin: '0 2px' }} />

              {/* Toggle traduction française */}
              <button
                onClick={toggleFrench}
                title={showFrench ? 'Masquer la traduction française' : 'Afficher la traduction française'}
                style={{
                  height: '26px',
                  padding: '0 8px',
                  borderRadius: '4px',
                  border: `1px solid ${showFrench ? 'var(--gold)' : 'var(--border)'}`,
                  background: showFrench ? 'var(--gold-pale)' : 'transparent',
                  color: showFrench ? 'var(--gold)' : 'var(--ink-faint)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'all var(--transition-fast)',
                  whiteSpace: 'nowrap' as const,
                }}
              >
                fr
              </button>

              {/* Filtre mots sans traduction — contributeurs connectés uniquement */}
              {user && (
                <>
                  <div style={{ width: '1px', height: '16px', background: 'var(--border)', margin: '0 2px' }} />
                  <button
                    onClick={toggleMissing}
                    title={showMissing ? 'Masquer les mots sans traduction' : 'Voir les mots sans traduction'}
                    style={{
                      width: '30px',
                      height: '26px',
                      borderRadius: '4px',
                      border: `1px solid ${showMissing ? 'var(--amber-pending)' : 'var(--border)'}`,
                      background: showMissing ? 'var(--amber-light)' : 'transparent',
                      color: showMissing ? 'var(--amber-pending)' : 'var(--ink-faint)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="9" strokeDasharray="3 3"/>
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>

          <div style={{
            fontFamily: 'var(--font-title)',
            fontSize: '48px',
            fontWeight: '300',
            color: 'var(--ink)',
            lineHeight: '1.1',
            marginBottom: '8px',
          }}>
            {verses[0]?.texts?.find(t => t.language === 'HEB' || t.language === 'GRK')?.text?.split(' ').slice(0, 1).join('')}
          </div>
        </div>

        {/* Versets */}
        {verses.map(verse => {
          const originalText = verse.texts.find(t => t.language === 'HEB' || t.language === 'GRK')
          const translation = verse.translations[0]

          return (
            <div
              key={verse.id}
              id={`v${verse.number}`}
              onClick={() => onVerseClick(verse)}
              className={`verse-block ${activeVerseId === verse.id ? 'active' : ''}`}
              style={{
                borderLeft: verse.hasContributions
                  ? '3px solid rgba(184,132,58,0.4)'
                  : '3px solid transparent',
              }}
            >
              <div style={{
                fontFamily: 'DM Mono, monospace',
                fontSize: '12px',
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
                    fontSize: 'var(--verse-orig-size)',
                    lineHeight: '2.4',
                    direction: originalText.language === 'HEB' ? 'rtl' : 'ltr',
                    textAlign: originalText.language === 'HEB' ? 'right' : 'left',
                    color: 'var(--ink)',
                    marginBottom: '10px',
                    fontWeight: '300',
                    letterSpacing: '0.02em',
                  }}>
                    {(originalText.wordTokens || []).map((token, i) => (
                      <span
                        key={token.id}
                        onClick={e => {
                          e.stopPropagation()
                          const rect = (e.target as HTMLElement).getBoundingClientRect()
                          onWordClick(token, rect.left + rect.width / 2, rect.bottom + window.scrollY)
                        }}
                        className={`word-token ${activeWordId === token.id ? 'active' : ''}`}
                        style={(() => {
                          const hasTranslation = token.translations && token.translations.length > 0
                          if (showMissing) {
                            return hasTranslation
                              ? { textDecoration: 'underline dotted', textDecorationColor: 'var(--green-valid)', textDecorationThickness: '2px', textUnderlineOffset: '4px', opacity: 0.45 }
                              : { borderBottom: '2px solid var(--amber-pending)', background: 'var(--amber-light)', borderRadius: '2px' }
                          }
                          return hasTranslation
                            ? { textDecoration: 'underline dotted', textDecorationColor: 'rgba(184,132,58,0.65)', textDecorationThickness: '2px', textUnderlineOffset: '4px' }
                            : {}
                        })()}
                      >
                        {token.word}{i < originalText.wordTokens.length - 1 ? '\u00A0' : ''}
                      </span>
                    ))}
                  </div>
                )}
                {showFrench && translation && (
                  <div style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: 'var(--verse-fr-size)',
                    color: 'var(--ink-soft)',
                    fontStyle: 'italic',
                    lineHeight: '1.8',
                    letterSpacing: '0.01em',
                    fontWeight: '300',
                  }}>
                    {translation.textFr}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
