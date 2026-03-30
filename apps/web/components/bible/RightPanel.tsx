'use client'

import { useState, useEffect } from 'react'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import ConfirmModal from './ConfirmModal'

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
  voteCount: number
  isValidated: boolean
  createdBy: string | null
  creator: { username: string; role: string } | null
}

interface Translation {
  id: string
  textFr: string
  isActive: boolean
}

interface VerseText {
  id: string
  language: string
  text: string
}

interface Verse {
  id: string
  number: number
  texts: VerseText[]
  translations: Translation[]
}

interface RightPanelProps {
  activeTab: 'verse' | 'word' | 'comments'
  setActiveTab: (tab: 'verse' | 'word' | 'comments') => void
  activeVerse: Verse | null
  activeWord: WordToken | null
  wordTranslations: WordTranslation[]
  onTranslationAdded: () => void
}

export default function RightPanel({
  activeTab,
  setActiveTab,
  activeVerse,
  activeWord,
  wordTranslations,
  onTranslationAdded,
}: RightPanelProps) {
  const [newTranslation, setNewTranslation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const { user } = useAuthStore()
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set())
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null)

  const validatedTranslations = wordTranslations.filter(t => t.isValidated)
  const proposedTranslations = wordTranslations.filter(t => !t.isValidated)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')
    if (token && savedUser) {
      useAuthStore.getState().setToken(token)
      useAuthStore.getState().setUser(JSON.parse(savedUser))
    }
  }, [])

  async function handleSubmitTranslation() {
    if (!activeWord || !newTranslation.trim()) return
    setSubmitting(true)
    setError('')
    try {
      await api.post(`/api/words/${activeWord.id}/translations`, {
        translation: newTranslation.trim()
      })
      setNewTranslation('')
      setShowForm(false)
      onTranslationAdded()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } }
      setError(error.response?.data?.error || 'Erreur lors de la proposition')
    } finally {
      setSubmitting(false)
    }
  }

  return (
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
              textTransform: 'uppercase' as const,
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
                  textTransform: 'uppercase' as const,
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
                    textTransform: 'uppercase' as const,
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
              <div style={{
                textAlign: 'center',
                padding: '20px 0 24px',
                borderBottom: '1px solid var(--border)',
                marginBottom: '20px',
              }}>
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
                textTransform: 'uppercase' as const,
                color: 'var(--ink-muted)',
                marginBottom: '12px',
              }}>
                Traductions disponibles
              </div>

              {wordTranslations.length === 0 ? (
                <div style={{
                  fontFamily: 'Spectral, serif',
                  fontSize: '14px',
                  color: 'var(--ink-faint)',
                  fontStyle: 'italic',
                  marginBottom: '16px',
                }}>
                  Aucune traduction proposée pour ce mot.
                </div>
              ) : (
                <>
                  {/* VALIDÉES */}
                  {validatedTranslations.length > 0 && (
                    <>
                      <div style={{
                        fontFamily: 'DM Mono, monospace',
                        fontSize: '9px',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase' as const,
                        color: 'var(--green-valid)',
                        marginBottom: '8px',
                        opacity: 0.7,
                      }}>
                        Validées
                      </div>
                      {validatedTranslations.map(t => (
                        <div key={t.id} style={{
                          border: '1px solid rgba(45,90,58,0.3)',
                          borderRadius: '8px',
                          padding: '12px 14px',
                          marginBottom: '8px',
                          background: 'var(--green-light)',
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '6px',
                          }}>
                            <div style={{
                              fontFamily: 'Spectral, serif',
                              fontSize: '15px',
                              fontStyle: 'italic',
                              color: 'var(--ink)',
                            }}>
                              {t.translation}
                            </div>
                            <span style={{
                              fontFamily: 'DM Mono, monospace',
                              fontSize: '9px',
                              padding: '2px 8px',
                              borderRadius: '20px',
                              background: 'var(--green-light)',
                              color: 'var(--green-valid)',
                              border: '1px solid rgba(45,90,58,0.2)',
                              flexShrink: 0,
                              marginLeft: '8px',
                            }}>
                              Validée
                            </span>
                          </div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            fontFamily: 'DM Mono, monospace',
                            fontSize: '10px',
                            color: 'var(--ink-muted)',
                          }}>
                            {t.creator && <span>@{t.creator.username}</span>}
                            {user && ['EXPERT', 'ADMIN'].includes(user.role) && (
                              <button
                                onClick={() => {
                                  setConfirmModal({
                                    message: 'Êtes-vous sûr de vouloir supprimer cette traduction validée ?',
                                    onConfirm: async () => {
                                      try {
                                        await api.delete(`/api/word-translations/${t.id}`)
                                        setConfirmModal(null)
                                        onTranslationAdded()
                                      } catch (error) {
                                        console.error(error)
                                      }
                                    }
                                  })
                                }}
                                style={{
                                  padding: '3px 8px',
                                  borderRadius: '4px',
                                  border: '1px solid rgba(122,42,42,0.3)',
                                  background: 'var(--red-light)',
                                  cursor: 'pointer',
                                  fontFamily: 'DM Mono, monospace',
                                  fontSize: '10px',
                                  color: 'var(--red-soft)',
                                }}
                              >
                                ✕ Supprimer
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {/* PROPOSÉES */}
                  {proposedTranslations.length > 0 && (
                    <>
                      <div style={{
                        fontFamily: 'DM Mono, monospace',
                        fontSize: '9px',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase' as const,
                        color: 'var(--amber-pending)',
                        marginBottom: '8px',
                        marginTop: validatedTranslations.length > 0 ? '16px' : '0',
                        opacity: 0.7,
                      }}>
                        Proposées
                      </div>
                      {proposedTranslations.map(t => (
                        <div key={t.id} style={{
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          padding: '12px 14px',
                          marginBottom: '8px',
                          background: 'white',
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '6px',
                          }}>
                            <div style={{
                              fontFamily: 'Spectral, serif',
                              fontSize: '15px',
                              fontStyle: 'italic',
                              color: 'var(--ink)',
                            }}>
                              {t.translation}
                            </div>
                            <span style={{
                              fontFamily: 'DM Mono, monospace',
                              fontSize: '9px',
                              padding: '2px 8px',
                              borderRadius: '20px',
                              background: 'var(--amber-light)',
                              color: 'var(--amber-pending)',
                              border: '1px solid rgba(122,90,26,0.2)',
                              flexShrink: 0,
                              marginLeft: '8px',
                            }}>
                              Proposée
                            </span>
                          </div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            fontFamily: 'DM Mono, monospace',
                            fontSize: '10px',
                            color: 'var(--ink-muted)',
                          }}>
                            <span>{t.voteCount} vote{t.voteCount !== 1 ? 's' : ''}</span>
                            {t.creator && <span>@{t.creator.username}</span>}
                            {user && ['INTERMEDIATE', 'EXPERT', 'ADMIN'].includes(user.role) && (
                              <button
                                onClick={async () => {
                                  try {
                                    const res = await api.post(`/api/word-translations/${t.id}/vote`)
                                    if (res.data.voted) {
                                      setVotedIds(prev => new Set([...prev, t.id]))
                                    } else {
                                      setVotedIds(prev => { const s = new Set(prev); s.delete(t.id); return s })
                                    }
                                    onTranslationAdded()
                                  } catch (error) {
                                    console.error(error)
                                  }
                                }}
                                style={{
                                  padding: '3px 8px',
                                  borderRadius: '4px',
                                  border: `1px solid ${votedIds.has(t.id) ? 'var(--gold)' : 'var(--border)'}`,
                                  background: votedIds.has(t.id) ? 'var(--gold-pale)' : 'transparent',
                                  cursor: 'pointer',
                                  fontFamily: 'DM Mono, monospace',
                                  fontSize: '10px',
                                  color: votedIds.has(t.id) ? 'var(--gold)' : 'var(--ink-soft)',
                                }}
                              >
                                ▲ {votedIds.has(t.id) ? 'Voté' : 'Voter'}
                              </button>
                            )}
                            {user && ['EXPERT', 'ADMIN'].includes(user.role) && (
                              <>
                                <button
                                  onClick={async () => {
                                    try {
                                      await api.patch(`/api/word-translations/${t.id}/validate`)
                                      onTranslationAdded()
                                    } catch (error) {
                                      console.error(error)
                                    }
                                  }}
                                  style={{
                                    padding: '3px 8px',
                                    borderRadius: '4px',
                                    border: '1px solid rgba(45,90,58,0.3)',
                                    background: 'var(--green-light)',
                                    cursor: 'pointer',
                                    fontFamily: 'DM Mono, monospace',
                                    fontSize: '10px',
                                    color: 'var(--green-valid)',
                                  }}
                                >
                                  ✓ Valider
                                </button>
                                <button
                                  onClick={() => {
                                    setConfirmModal({
                                      message: 'Êtes-vous sûr de vouloir supprimer cette proposition ?',
                                      onConfirm: async () => {
                                        try {
                                          await api.delete(`/api/word-translations/${t.id}`)
                                          setConfirmModal(null)
                                          onTranslationAdded()
                                        } catch (error) {
                                          console.error(error)
                                        }
                                      }
                                    })
                                  }}
                                  style={{
                                    padding: '3px 8px',
                                    borderRadius: '4px',
                                    border: '1px solid rgba(122,42,42,0.3)',
                                    background: 'var(--red-light)',
                                    cursor: 'pointer',
                                    fontFamily: 'DM Mono, monospace',
                                    fontSize: '10px',
                                    color: 'var(--red-soft)',
                                  }}
                                >
                                  ✕ Supprimer
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}

              {/* Formulaire de proposition */}
              {!showForm ? (
                <button
                  onClick={() => setShowForm(true)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1.5px dashed var(--border-strong)',
                    borderRadius: '8px',
                    background: 'transparent',
                    fontFamily: 'Spectral, serif',
                    fontSize: '13px',
                    fontStyle: 'italic',
                    color: 'var(--ink-muted)',
                    cursor: 'pointer',
                    marginTop: '4px',
                  }}
                  onMouseEnter={e => {
                    (e.target as HTMLElement).style.borderColor = 'var(--gold)'
                    ;(e.target as HTMLElement).style.color = 'var(--gold)'
                  }}
                  onMouseLeave={e => {
                    (e.target as HTMLElement).style.borderColor = 'var(--border-strong)'
                    ;(e.target as HTMLElement).style.color = 'var(--ink-muted)'
                  }}
                >
                  + Proposer une traduction
                </button>
              ) : (
                <div style={{
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '12px',
                  background: 'white',
                  marginTop: '4px',
                }}>
                  {error && (
                    <div style={{
                      padding: '8px 10px',
                      background: 'var(--red-light)',
                      border: '1px solid rgba(122,42,42,0.2)',
                      borderRadius: '6px',
                      color: 'var(--red-soft)',
                      fontFamily: 'Spectral, serif',
                      fontSize: '12px',
                      marginBottom: '10px',
                    }}>
                      {error}
                    </div>
                  )}
                  <input
                    type="text"
                    value={newTranslation}
                    onChange={e => setNewTranslation(e.target.value)}
                    placeholder="Votre traduction..."
                    onKeyDown={e => e.key === 'Enter' && handleSubmitTranslation()}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      fontFamily: 'Spectral, serif',
                      fontSize: '14px',
                      fontStyle: 'italic',
                      color: 'var(--ink)',
                      background: 'var(--parchment)',
                      outline: 'none',
                      marginBottom: '10px',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={handleSubmitTranslation}
                      disabled={submitting || !newTranslation.trim()}
                      style={{
                        flex: 1,
                        padding: '8px',
                        background: 'var(--gold)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontFamily: 'DM Mono, monospace',
                        fontSize: '10px',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase' as const,
                        cursor: submitting ? 'not-allowed' : 'pointer',
                        opacity: submitting || !newTranslation.trim() ? 0.6 : 1,
                      }}
                    >
                      {submitting ? 'Envoi...' : 'Proposer'}
                    </button>
                    <button
                      onClick={() => { setShowForm(false); setNewTranslation(''); setError('') }}
                      style={{
                        padding: '8px 14px',
                        background: 'transparent',
                        color: 'var(--ink-muted)',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        fontFamily: 'DM Mono, monospace',
                        fontSize: '10px',
                        cursor: 'pointer',
                      }}
                    >
                      Annuler
                    </button>
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
      {confirmModal && (
        <ConfirmModal
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  )
}