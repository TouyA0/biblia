'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import api from '@/lib/api'

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

interface Chapter {
  id: string
  number: number
  verses: Verse[]
}

interface Book {
  id: string
  name: string
  slug: string
  testament: string
  chapterCount: number
  chapters: { id: string; number: number }[]
}

export default function ChapterPage() {
  const params = useParams()
  const book = params.book as string
  const chapter = params.chapter as string

  const [bookData, setBookData] = useState<Book | null>(null)
  const [chapterData, setChapterData] = useState<Chapter | null>(null)
  const [allBooks, setAllBooks] = useState<Book[]>([])
  const [activeVerse, setActiveVerse] = useState<Verse | null>(null)
  const [activeWord, setActiveWord] = useState<WordToken | null>(null)
  const [activeTab, setActiveTab] = useState<'verse' | 'word' | 'comments'>('verse')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [book, chapter])

  async function loadData() {
    setLoading(true)
    try {
      const [booksRes, bookRes, chapterRes] = await Promise.all([
        api.get('/api/books'),
        api.get(`/api/books/${book}`),
        api.get(`/api/books/${book}/chapters/${chapter}`),
      ])
      setAllBooks(booksRes.data)
      setBookData(bookRes.data)
      setChapterData(chapterRes.data)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const atBooks = allBooks.filter(b => b.testament === 'AT')

  if (loading) return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--parchment)',
      fontFamily: 'Spectral, serif',
      fontStyle: 'italic',
      color: 'var(--ink-muted)',
      fontSize: '18px',
    }}>
      Chargement...
    </div>
  )

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '220px 1fr',
      gridTemplateRows: '52px 1fr',
      height: '100vh',
      overflow: 'hidden',
    }}>
      {/* TOPBAR */}
      <div style={{
        gridColumn: '1 / -1',
        background: 'var(--ink)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        gap: '32px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{
          fontFamily: 'Crimson Pro, serif',
          fontSize: '22px',
          fontWeight: '300',
          color: 'var(--gold-light)',
          letterSpacing: '0.06em',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <span style={{ opacity: 0.7, fontStyle: 'italic' }}>בּ</span>
          Biblia
        </div>
        <div style={{ display: 'flex', gap: '2px', marginLeft: '8px' }}>
          {[
            { label: 'Ancien Testament', href: `/at/${book}/${chapter}`, active: true },
            { label: 'Nouveau Testament', href: `/nt/matthieu/1`, active: false },
          ].map(tab => (
            <a key={tab.label} href={tab.href} style={{
              padding: '6px 16px',
              fontFamily: 'DM Mono, monospace',
              fontSize: '11px',
              letterSpacing: '0.08em',
              color: tab.active ? 'var(--gold-light)' : 'rgba(255,255,255,0.45)',
              borderRadius: '4px',
              background: tab.active ? 'rgba(184,132,58,0.2)' : 'transparent',
              textDecoration: 'none',
              textTransform: 'uppercase',
            }}>
              {tab.label}
            </a>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{
            fontFamily: 'DM Mono, monospace',
            fontSize: '10px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            padding: '4px 10px',
            borderRadius: '20px',
            background: 'rgba(42,74,122,0.4)',
            color: '#9ab4d8',
            border: '1px solid rgba(154,180,216,0.25)',
          }}>
            Visiteur
          </span>
          <a href="/login" style={{
            fontFamily: 'DM Mono, monospace',
            fontSize: '10px',
            color: 'rgba(255,255,255,0.5)',
            textDecoration: 'none',
            letterSpacing: '0.08em',
          }}>
            Connexion
          </a>
        </div>
      </div>

      {/* SIDEBAR */}
      <div style={{
        background: 'var(--parchment-dark)',
        borderRight: '1px solid var(--border)',
        overflowY: 'auto',
        padding: '20px 0',
      }}>
        {bookData && (
          <>
            <div style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: '9px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--ink-muted)',
              padding: '0 16px 8px',
            }}>
              {bookData.name}
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, 1fr)',
              gap: '4px',
              padding: '6px 16px 14px',
            }}>
              {bookData.chapters.map(ch => (
                <a key={ch.number} href={`/at/${book}/${ch.number}`} style={{
                  textAlign: 'center',
                  padding: '5px 2px',
                  fontFamily: 'DM Mono, monospace',
                  fontSize: '11px',
                  color: ch.number === parseInt(chapter) ? 'white' : 'var(--ink-soft)',
                  borderRadius: '4px',
                  background: ch.number === parseInt(chapter) ? 'var(--gold)' : 'transparent',
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}>
                  {ch.number}
                </a>
              ))}
            </div>
            <div style={{
              borderTop: '1px solid var(--border)',
              marginTop: '8px',
              paddingTop: '8px',
            }}>
              <div style={{
                fontFamily: 'DM Mono, monospace',
                fontSize: '9px',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--ink-muted)',
                padding: '0 16px 8px',
              }}>
                Livres
              </div>
              {atBooks.map(b => (
                <a key={b.slug} href={`/at/${b.slug}/1`} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 16px',
                  fontFamily: 'Spectral, serif',
                  fontSize: '13.5px',
                  color: b.slug === book ? 'var(--ink)' : 'var(--ink-soft)',
                  background: b.slug === book ? 'var(--gold-pale)' : 'transparent',
                  borderLeft: b.slug === book ? '2px solid var(--gold)' : '2px solid transparent',
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}>
                  <span style={{ fontWeight: b.slug === book ? 600 : 400 }}>{b.name}</span>
                  <span style={{
                    fontFamily: 'DM Mono, monospace',
                    fontSize: '10px',
                    color: 'var(--ink-faint)',
                  }}>
                    {b.chapterCount}
                  </span>
                </a>
              ))}
            </div>
          </>
        )}
      </div>

      {/* MAIN */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', overflow: 'hidden' }}>

        {/* ZONE DE LECTURE */}
        <div style={{ overflowY: 'auto', padding: '40px 48px' }}>
          {chapterData && bookData && (
            <>
              <div style={{ marginBottom: '36px' }}>
                <div style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: '13px',
                  fontWeight: '400',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--gold)',
                  marginBottom: '6px',
                }}>
                  {bookData.name} · Chapitre {chapter}
                </div>
              </div>

              {chapterData.verses.map(verse => {
                const hebrewText = verse.texts.find(t => t.language === 'HEB' || t.language === 'GRK')
                const translation = verse.translations[0]

                return (
                  <div
                    key={verse.id}
                    onClick={() => { setActiveVerse(verse); setActiveTab('verse') }}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '32px 1fr',
                      gap: '0 16px',
                      marginBottom: '20px',
                      cursor: 'pointer',
                      borderRadius: '8px',
                      padding: '8px',
                      marginLeft: '-8px',
                      background: activeVerse?.id === verse.id ? 'var(--gold-pale)' : 'transparent',
                      outline: activeVerse?.id === verse.id ? '1.5px solid var(--gold)' : 'none',
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
                      {hebrewText && (
                        <div style={{
                          fontSize: '18px',
                          lineHeight: '2',
                          direction: hebrewText.language === 'HEB' ? 'rtl' : 'ltr',
                          textAlign: hebrewText.language === 'HEB' ? 'right' : 'left',
                          color: 'var(--ink)',
                          marginBottom: '6px',
                          fontWeight: '300',
                        }}>
                          {(hebrewText.wordTokens || []).map((token, i) => (
                            <span
                              key={token.id}
                              onClick={e => {
                                e.stopPropagation()
                                setActiveWord(token)
                                setActiveTab('word')
                              }}
                              style={{
                                cursor: 'pointer',
                                borderRadius: '3px',
                                padding: '0 2px',
                                background: activeWord?.id === token.id ? 'var(--gold)' : 'transparent',
                                color: activeWord?.id === token.id ? 'white' : 'inherit',
                                display: 'inline-block',
                                transition: 'all 0.15s',
                              }}
                            >
                              {token.word}{i < hebrewText.wordTokens.length - 1 ? '\u00A0' : ''}
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
            </>
          )}
        </div>

        {/* PANNEAU DROIT */}
        <div style={{
          borderLeft: '1px solid var(--border)',
          background: 'var(--parchment)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Onglets */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--border)',
            background: 'var(--parchment-dark)',
            flexShrink: 0,
          }}>
            {(['verse', 'word', 'comments'] as const).map(tab => (
              <div
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  padding: '13px 8px',
                  textAlign: 'center',
                  fontFamily: 'DM Mono, monospace',
                  fontSize: '10px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: activeTab === tab ? 'var(--gold)' : 'var(--ink-muted)',
                  cursor: 'pointer',
                  borderBottom: activeTab === tab ? '2px solid var(--gold)' : '2px solid transparent',
                  background: activeTab === tab ? 'var(--parchment)' : 'transparent',
                }}
              >
                {tab === 'verse' ? 'Verset' : tab === 'word' ? 'Mot' : 'Commentaires'}
              </div>
            ))}
          </div>

          {/* Contenu panneau */}
          <div style={{ padding: '24px', flex: 1 }}>

            {/* ONGLET VERSET */}
            {activeTab === 'verse' && (
              activeVerse ? (
                <div>
                  <div style={{
                    background: 'var(--ink)',
                    borderRadius: '10px',
                    padding: '18px 20px',
                    marginBottom: '20px',
                    direction: activeVerse.texts[0]?.language === 'HEB' ? 'rtl' : 'ltr',
                    textAlign: activeVerse.texts[0]?.language === 'HEB' ? 'right' : 'left',
                  }}>
                    <div style={{
                      fontFamily: 'DM Mono, monospace',
                      fontSize: '9px',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: 'rgba(255,255,255,0.35)',
                      marginBottom: '10px',
                      direction: 'ltr',
                      textAlign: 'left',
                    }}>
                      Texte original
                    </div>
                    <div style={{
                      fontSize: '19px',
                      fontWeight: '300',
                      color: 'rgba(255,255,255,0.92)',
                      lineHeight: '2',
                    }}>
                      {activeVerse.texts[0]?.text}
                    </div>
                  </div>
                  {activeVerse.translations[0] && (
                    <div style={{
                      border: '1px solid rgba(45,90,58,0.3)',
                      borderRadius: '8px',
                      padding: '14px 16px',
                      background: 'var(--green-light)',
                    }}>
                      <div style={{
                        fontFamily: 'DM Mono, monospace',
                        fontSize: '9px',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: 'var(--green-valid)',
                        marginBottom: '8px',
                        opacity: 0.7,
                      }}>
                        Traduction Crampon 1923
                      </div>
                      <div style={{
                        fontFamily: 'Spectral, serif',
                        fontSize: '15px',
                        fontStyle: 'italic',
                        color: 'var(--ink)',
                        lineHeight: '1.7',
                      }}>
                        {activeVerse.translations[0].textFr}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '300px',
                  color: 'var(--ink-faint)',
                  fontFamily: 'Spectral, serif',
                  fontStyle: 'italic',
                  textAlign: 'center',
                  gap: '10px',
                }}>
                  <div style={{ fontSize: '36px', opacity: 0.3, fontFamily: 'Crimson Pro, serif' }}>א</div>
                  <div>Cliquez sur un verset<br />pour l&apos;explorer</div>
                </div>
              )
            )}

            {/* ONGLET MOT */}
            {activeTab === 'word' && (
              activeWord ? (
                <div>
                  <div style={{ textAlign: 'center', padding: '20px 0 24px', borderBottom: '1px solid var(--border)', marginBottom: '20px' }}>
                    <div style={{
                      fontSize: '44px',
                      fontWeight: '300',
                      color: 'var(--ink)',
                      lineHeight: '1.3',
                      marginBottom: '6px',
                    }}>
                      {activeWord.word}
                    </div>
                    {activeWord.translit && (
                      <div style={{
                        fontFamily: 'DM Mono, monospace',
                        fontSize: '13px',
                        color: 'var(--gold)',
                        letterSpacing: '0.08em',
                        marginBottom: '12px',
                      }}>
                        {activeWord.translit}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
                      {activeWord.strongNumber && (
                        <span style={{
                          fontFamily: 'DM Mono, monospace',
                          fontSize: '10px',
                          padding: '3px 10px',
                          borderRadius: '20px',
                          background: 'var(--blue-light)',
                          color: 'var(--blue-sacred)',
                          border: '1px solid rgba(42,74,122,0.15)',
                        }}>
                          {activeWord.strongNumber}
                        </span>
                      )}
                      {activeWord.morphology && (
                        <span style={{
                          fontFamily: 'DM Mono, monospace',
                          fontSize: '10px',
                          padding: '3px 10px',
                          borderRadius: '20px',
                          background: 'var(--parchment-deep)',
                          color: 'var(--ink-soft)',
                          border: '1px solid var(--border)',
                        }}>
                          {activeWord.morphology}
                        </span>
                      )}
                      {activeWord.lemma && (
                        <span style={{
                          fontFamily: 'DM Mono, monospace',
                          fontSize: '10px',
                          padding: '3px 10px',
                          borderRadius: '20px',
                          background: 'var(--parchment-deep)',
                          color: 'var(--ink-soft)',
                          border: '1px solid var(--border)',
                        }}>
                          Lemme: {activeWord.lemma}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{
                    fontFamily: 'DM Mono, monospace',
                    fontSize: '10px',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-muted)',
                    marginBottom: '12px',
                  }}>
                    Informations
                  </div>
                  <div style={{
                    fontFamily: 'Spectral, serif',
                    fontSize: '14px',
                    color: 'var(--ink-soft)',
                    lineHeight: '1.7',
                    fontStyle: 'italic',
                  }}>
                    Cliquez sur &ldquo;Voir tout&rdquo; pour voir les traductions alternatives et les occurrences dans la Bible.
                  </div>
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '300px',
                  color: 'var(--ink-faint)',
                  fontFamily: 'Spectral, serif',
                  fontStyle: 'italic',
                  textAlign: 'center',
                  gap: '10px',
                }}>
                  <div style={{ fontSize: '36px', opacity: 0.3, fontFamily: 'Crimson Pro, serif' }}>ב</div>
                  <div>Cliquez sur un mot<br />pour voir son analyse</div>
                </div>
              )
            )}

            {/* ONGLET COMMENTAIRES */}
            {activeTab === 'comments' && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '300px',
                color: 'var(--ink-faint)',
                fontFamily: 'Spectral, serif',
                fontStyle: 'italic',
                textAlign: 'center',
                gap: '10px',
              }}>
                <div style={{ fontSize: '36px', opacity: 0.3, fontFamily: 'Crimson Pro, serif' }}>ג</div>
                <div>Cliquez sur un verset<br />pour voir les commentaires</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}