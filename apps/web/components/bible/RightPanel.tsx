'use client'

import { useState, useEffect } from 'react'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import ConfirmModal from './ConfirmModal'
import CommentText from './CommentText'
import { getRoleColor } from '@/lib/roleColors'

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

interface Comment {
  id: string
  text: string
  createdAt: string
  createdBy: string | null
  creator: { username: string; role: string } | null
}

interface VerseTranslation {
  id: string
  textFr: string
  isActive: boolean
  isReference: boolean
  source: string | null
  createdAt: string
}

interface Proposal {
  id: string
  proposedText: string
  status: string
  reason: string | null
  createdAt: string
  createdBy: string | null
  creator: { username: string; role: string } | null
  reviewer: { username: string; role: string } | null
  votes: { id: string; userId: string }[]
}

interface RightPanelProps {
  activeTab: 'verse' | 'word' | 'comments'
  setActiveTab: (tab: 'verse' | 'word' | 'comments') => void
  activeVerse: Verse | null
  activeWord: WordToken | null
  wordTranslations: WordTranslation[]
  comments: Comment[]
  proposals: Proposal[]
  verseTranslations: VerseTranslation[]
  onTranslationAdded: () => void
  onCommentAdded: () => void
  onProposalUpdated: () => void
}

export default function RightPanel({
  activeTab,
  setActiveTab,
  activeVerse,
  activeWord,
  wordTranslations,
  comments,
  proposals,
  verseTranslations,
  onTranslationAdded,
  onCommentAdded,
  onProposalUpdated,
}: RightPanelProps) {
  const [newTranslation, setNewTranslation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const { user } = useAuthStore()
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set())
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null)
  const [newComment, setNewComment] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [showProposalForm, setShowProposalForm] = useState(false)
  const [newProposal, setNewProposal] = useState('')
  const [submittingProposal, setSubmittingProposal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [showRejected, setShowRejected] = useState(false)
  const [proposalVotedIds, setProposalVotedIds] = useState<Set<string>>(new Set())

  const validatedTranslations = wordTranslations.filter(t => t.isValidated)
  const proposedTranslations = wordTranslations.filter(t => !t.isValidated)
  const activeProposals = proposals
    .filter(p => p.status === 'PENDING' || p.status === 'ACCEPTED')
    .sort((a, b) => {
      const aIsActive = a.proposedText === activeVerse?.translations[0]?.textFr
      const bIsActive = b.proposedText === activeVerse?.translations[0]?.textFr
      if (aIsActive && !bIsActive) return -1
      if (!aIsActive && bIsActive) return 1
      if (a.status === 'ACCEPTED' && b.status !== 'ACCEPTED') return -1
      if (a.status !== 'ACCEPTED' && b.status === 'ACCEPTED') return 1
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })
  const closedProposals = proposals.filter(p => p.status === 'REJECTED')

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

        {/* ═══════════════ ONGLET VERSET ═══════════════ */}
        {activeTab === 'verse' && (
          activeVerse ? (
            <div>

              {/* Texte original */}
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

              {/* Traduction active */}
              {(() => {
                const crampon = verseTranslations.find(t => t.isReference)
                const activeTranslation = activeVerse.translations[0]
                const cramponIsActive = crampon?.isActive

                return (
                  <>
                    {activeTranslation && (
                      <div style={{
                        border: '1px solid rgba(45,90,58,0.3)',
                        borderRadius: '8px',
                        padding: '14px 16px',
                        background: 'var(--green-light)',
                        marginBottom: '12px',
                      }}>
                        <div style={{
                          fontFamily: 'DM Mono, monospace',
                          fontSize: '9px',
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase' as const,
                          color: 'var(--green-valid)',
                          marginBottom: '8px',
                          opacity: 0.7,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}>
                          Traduction active
                          {cramponIsActive && crampon && (
                            <span style={{ opacity: 0.7 }}>· {crampon.source || 'Crampon 1923'} · Référence</span>
                          )}
                        </div>
                        <div style={{
                          fontFamily: 'Spectral, serif',
                          fontSize: '15px',
                          fontStyle: 'italic',
                          color: 'var(--ink)',
                          lineHeight: '1.7',
                        }}>
                          {activeTranslation.textFr}
                        </div>
                      </div>
                    )}

                    {/* Crampon si pas active */}
                    {crampon && !cramponIsActive && (
                      <div style={{
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        padding: '12px 14px',
                        background: 'var(--parchment-dark)',
                        marginBottom: '12px',
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '8px',
                        }}>
                          <span style={{
                            fontFamily: 'DM Mono, monospace',
                            fontSize: '9px',
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase' as const,
                            color: 'var(--ink-muted)',
                          }}>
                            {crampon.source || 'Crampon 1923'} · Référence
                          </span>
                          {user && ['EXPERT', 'ADMIN'].includes(user.role) && (
                            <button
                              onClick={async () => {
                                try {
                                  await api.patch(`/api/translations/${crampon.id}/activate`)
                                  onProposalUpdated()
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
                                fontSize: '9px',
                                color: 'var(--green-valid)',
                              }}
                            >
                              ↑ Remettre active
                            </button>
                          )}
                        </div>
                        <div style={{
                          fontFamily: 'Spectral, serif',
                          fontSize: '14px',
                          fontStyle: 'italic',
                          color: 'var(--ink-soft)',
                          lineHeight: '1.7',
                        }}>
                          {crampon.textFr}
                        </div>
                      </div>
                    )}
                  </>
                )
              })()}

              {/* Anciennes traductions acceptées (non référence, non active) */}
              {verseTranslations
                .filter(t => !t.isReference && !t.isActive && !proposals.some(p => p.proposedText === t.textFr))
                .map(t => (
                  <div key={t.id} style={{
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    background: 'white',
                    marginBottom: '8px',
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '8px',
                    }}>
                      <span style={{
                        fontFamily: 'DM Mono, monospace',
                        fontSize: '9px',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase' as const,
                        color: 'var(--ink-muted)',
                      }}>
                        Acceptée
                      </span>
                      {user && ['EXPERT', 'ADMIN'].includes(user.role) && (
                        <button
                          onClick={async () => {
                            try {
                              await api.patch(`/api/translations/${t.id}/activate`)
                              onProposalUpdated()
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
                            fontSize: '9px',
                            color: 'var(--green-valid)',
                          }}
                        >
                          ↑ Remettre active
                        </button>
                      )}
                    </div>
                    <div style={{
                      fontFamily: 'Spectral, serif',
                      fontSize: '14px',
                      fontStyle: 'italic',
                      color: 'var(--ink-soft)',
                      lineHeight: '1.7',
                    }}>
                      {t.textFr}
                    </div>
                  </div>
                ))
              }

              {/* Titre Propositions */}
              <div style={{
                fontFamily: 'DM Mono, monospace',
                fontSize: '10px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase' as const,
                color: 'var(--ink-muted)',
                marginBottom: '12px',
                marginTop: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                Propositions
                {proposals.filter(p => p.status === 'PENDING').length > 0 && (
                  <span style={{
                    fontFamily: 'DM Mono, monospace',
                    fontSize: '9px',
                    padding: '1px 6px',
                    borderRadius: '20px',
                    background: 'var(--amber-light)',
                    color: 'var(--amber-pending)',
                    border: '1px solid rgba(122,90,26,0.2)',
                  }}>
                    {proposals.filter(p => p.status === 'PENDING').length} en attente
                  </span>
                )}
              </div>

              {activeProposals.length === 0 && (
                <div style={{
                  fontFamily: 'Spectral, serif',
                  fontSize: '14px',
                  color: 'var(--ink-faint)',
                  fontStyle: 'italic',
                  marginBottom: '16px',
                }}>
                  Aucune proposition pour ce verset.
                </div>
              )}

              {/* Propositions actives et acceptées */}
              {activeProposals.map(p => {
                const voteCount = p.votes?.length || 0
                const hasVoted = proposalVotedIds.has(p.id)
                return (
                  <div key={p.id} style={{
                    border: `1px solid ${p.status === 'ACCEPTED' ? 'rgba(45,90,58,0.3)' : 'var(--border)'}`,
                    borderRadius: '8px',
                    overflow: 'hidden',
                    marginBottom: '12px',
                    background: 'white',
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: 'var(--parchment-dark)',
                      borderBottom: '1px solid var(--border)',
                    }}>
                      <span style={{
                        fontFamily: 'DM Mono, monospace',
                        fontSize: '10px',
                        color: p.creator ? getRoleColor(p.creator.role) : 'var(--ink-muted)',
                      }}>
                        @{p.creator?.username || 'anonyme'}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          fontFamily: 'DM Mono, monospace',
                          fontSize: '9px',
                          padding: '2px 8px',
                          borderRadius: '20px',
                          background: p.status === 'ACCEPTED' ? 'var(--green-light)' : 'var(--amber-light)',
                          color: p.status === 'ACCEPTED' ? 'var(--green-valid)' : 'var(--amber-pending)',
                          border: `1px solid ${p.status === 'ACCEPTED' ? 'rgba(45,90,58,0.2)' : 'rgba(122,90,26,0.2)'}`,
                        }}>
                          {p.status === 'ACCEPTED' ? (
                            <>
                              {p.proposedText === activeVerse?.translations[0]?.textFr ? '★ Active' : 'Acceptée'}
                            </>
                          ) : 'En attente'}
                        </span>
                        {p.status === 'ACCEPTED' && user && ['EXPERT', 'ADMIN'].includes(user.role) && 
                          p.proposedText !== activeVerse?.translations[0]?.textFr && (
                          <button
                            onClick={async () => {
                              try {
                                await api.patch(`/api/proposals/${p.id}/activate`)
                                onProposalUpdated()
                              } catch (error) {
                                console.error(error)
                              }
                            }}
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              border: '1px solid rgba(45,90,58,0.3)',
                              background: 'var(--green-light)',
                              cursor: 'pointer',
                              fontFamily: 'DM Mono, monospace',
                              fontSize: '9px',
                              color: 'var(--green-valid)',
                            }}
                          >
                            ↑ Rendre active
                          </button>
                        )}
                        {user && ['EXPERT', 'ADMIN'].includes(user.role) && (
                          <button
                            onClick={() => setConfirmModal({
                              message: 'Supprimer définitivement cette proposition ?',
                              onConfirm: async () => {
                                try {
                                  await api.delete(`/api/proposals/${p.id}`)
                                  setConfirmModal(null)
                                  onProposalUpdated()
                                } catch (error) {
                                  console.error(error)
                                }
                              }
                            })}
                            style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              border: '1px solid rgba(122,42,42,0.2)',
                              background: 'transparent',
                              cursor: 'pointer',
                              fontFamily: 'DM Mono, monospace',
                              fontSize: '9px',
                              color: 'var(--red-soft)',
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ padding: '12px 14px' }}>
                      <div style={{
                        fontFamily: 'Spectral, serif',
                        fontSize: '14px',
                        fontStyle: 'italic',
                        lineHeight: '1.8',
                        color: 'var(--ink)',
                      }}>
                        {p.proposedText}
                      </div>
                    </div>
                    {p.status === 'PENDING' && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 14px',
                        borderTop: '1px solid var(--border)',
                        flexWrap: 'wrap',
                      }}>
                        {user && ['INTERMEDIATE', 'EXPERT', 'ADMIN'].includes(user.role) && (
                          <button
                            onClick={async () => {
                              try {
                                const res = await api.post(`/api/proposals/${p.id}/vote`)
                                if (res.data.voted) {
                                  setProposalVotedIds(prev => new Set([...prev, p.id]))
                                } else {
                                  setProposalVotedIds(prev => { const s = new Set(prev); s.delete(p.id); return s })
                                }
                                onProposalUpdated()
                              } catch (error) {
                                console.error(error)
                              }
                            }}
                            style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              border: `1px solid ${hasVoted ? 'var(--gold)' : 'var(--border)'}`,
                              background: hasVoted ? 'var(--gold-pale)' : 'transparent',
                              cursor: 'pointer',
                              fontFamily: 'DM Mono, monospace',
                              fontSize: '10px',
                              color: hasVoted ? 'var(--gold)' : 'var(--ink-soft)',
                            }}
                          >
                            ▲ {hasVoted ? 'Voté' : 'Voter'}
                          </button>
                        )}
                        <span style={{
                          fontFamily: 'DM Mono, monospace',
                          fontSize: '10px',
                          color: 'var(--ink-muted)',
                        }}>
                          {voteCount} vote{voteCount !== 1 ? 's' : ''}
                        </span>
                        {user && ['EXPERT', 'ADMIN'].includes(user.role) && (
                          <>
                            {rejectingId === p.id ? (
                              <div style={{ display: 'flex', gap: '6px', width: '100%', marginTop: '4px' }}>
                                <input
                                  type="text"
                                  placeholder="Raison du rejet..."
                                  value={rejectReason}
                                  onChange={e => setRejectReason(e.target.value)}
                                  style={{
                                    flex: 1,
                                    padding: '5px 8px',
                                    border: '1px solid var(--border)',
                                    borderRadius: '6px',
                                    fontFamily: 'Spectral, serif',
                                    fontSize: '12px',
                                    color: 'var(--ink)',
                                    outline: 'none',
                                  }}
                                />
                                <button
                                  onClick={async () => {
                                    if (!rejectReason.trim()) return
                                    try {
                                      await api.patch(`/api/proposals/${p.id}/reject`, { reason: rejectReason })
                                      setRejectingId(null)
                                      setRejectReason('')
                                      onProposalUpdated()
                                    } catch (error) {
                                      console.error(error)
                                    }
                                  }}
                                  style={{
                                    padding: '5px 10px',
                                    background: 'transparent',
                                    color: 'var(--red-soft)',
                                    border: '1px solid rgba(122,42,42,0.3)',
                                    borderRadius: '6px',
                                    fontFamily: 'DM Mono, monospace',
                                    fontSize: '9px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Rejeter
                                </button>
                                <button
                                  onClick={() => { setRejectingId(null); setRejectReason('') }}
                                  style={{
                                    padding: '5px 10px',
                                    background: 'transparent',
                                    color: 'var(--ink-muted)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '6px',
                                    fontFamily: 'DM Mono, monospace',
                                    fontSize: '9px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Annuler
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={async () => {
                                    try {
                                      await api.patch(`/api/proposals/${p.id}/accept`)
                                      onProposalUpdated()
                                    } catch (error) {
                                      console.error(error)
                                    }
                                  }}
                                  style={{
                                    padding: '3px 8px',
                                    background: 'var(--green-valid)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    fontFamily: 'DM Mono, monospace',
                                    fontSize: '9px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  ✓ Accepter
                                </button>
                                <button
                                  onClick={() => setRejectingId(p.id)}
                                  style={{
                                    padding: '3px 8px',
                                    background: 'transparent',
                                    color: 'var(--red-soft)',
                                    border: '1px solid rgba(122,42,42,0.3)',
                                    borderRadius: '4px',
                                    fontFamily: 'DM Mono, monospace',
                                    fontSize: '9px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  ✕ Rejeter
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Formulaire proposition */}
              {user ? (
                !showProposalForm ? (
                  <button
                    onClick={() => {
                      setShowProposalForm(true)
                      setNewProposal(activeVerse.translations[0]?.textFr || '')
                    }}
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
                    + Proposer une reformulation
                  </button>
                ) : (
                  <div style={{
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '12px',
                    background: 'white',
                    marginTop: '4px',
                  }}>
                    <div style={{
                      fontFamily: 'DM Mono, monospace',
                      fontSize: '9px',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase' as const,
                      color: 'var(--ink-muted)',
                      marginBottom: '8px',
                    }}>
                      Proposer une reformulation
                    </div>
                    <textarea
                      value={newProposal}
                      onChange={e => setNewProposal(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        fontFamily: 'Spectral, serif',
                        fontSize: '14px',
                        color: 'var(--ink)',
                        background: 'var(--parchment)',
                        outline: 'none',
                        marginBottom: '10px',
                        resize: 'vertical',
                        minHeight: '80px',
                      }}
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={async () => {
                          if (!newProposal.trim() || !activeVerse) return
                          setSubmittingProposal(true)
                          try {
                            await api.post(`/api/verses/${activeVerse.id}/proposals`, {
                              proposedText: newProposal.trim()
                            })
                            setShowProposalForm(false)
                            setNewProposal('')
                            onProposalUpdated()
                          } catch (error) {
                            console.error(error)
                          } finally {
                            setSubmittingProposal(false)
                          }
                        }}
                        disabled={submittingProposal || !newProposal.trim()}
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
                          cursor: submittingProposal ? 'not-allowed' : 'pointer',
                          opacity: submittingProposal || !newProposal.trim() ? 0.6 : 1,
                        }}
                      >
                        {submittingProposal ? 'Envoi...' : 'Proposer'}
                      </button>
                      <button
                        onClick={() => { setShowProposalForm(false); setNewProposal('') }}
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
                )
              ) : (
                <div style={{
                  marginTop: '16px',
                  fontFamily: 'Spectral, serif',
                  fontSize: '13px',
                  color: 'var(--ink-muted)',
                  fontStyle: 'italic',
                  textAlign: 'center',
                }}>
                  <a href="/login" style={{ color: 'var(--gold)' }}>Connectez-vous</a> pour proposer une reformulation
                </div>
              )}

              {/* Section repliable : propositions rejetées */}
              {closedProposals.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <div
                    onClick={() => setShowRejected(!showRejected)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      fontFamily: 'DM Mono, monospace',
                      fontSize: '9px',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase' as const,
                      color: 'var(--ink-faint)',
                      marginBottom: '8px',
                      userSelect: 'none' as const,
                    }}
                  >
                    <span>{showRejected ? '▼' : '▶'}</span>
                    {closedProposals.length} proposition{closedProposals.length > 1 ? 's' : ''} rejetée{closedProposals.length > 1 ? 's' : ''} / supprimée{closedProposals.length > 1 ? 's' : ''}
                  </div>
                  {showRejected && closedProposals.map(p => (
                    <div key={p.id} style={{
                      border: '1px solid rgba(122,42,42,0.2)',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      marginBottom: '8px',
                      background: 'white',
                      opacity: 0.7,
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: 'var(--red-light)',
                        borderBottom: '1px solid rgba(122,42,42,0.1)',
                      }}>
                        <span style={{
                          fontFamily: 'DM Mono, monospace',
                          fontSize: '9px',
                          color: 'var(--ink-muted)',
                        }}>
                          <span style={{ color: p.creator ? getRoleColor(p.creator.role) : 'var(--ink-muted)' }}>
                            @{p.creator?.username || 'anonyme'}
                          </span>
                          {' · '}{p.reason === 'Supprimée par un expert' ? 'Supprimée' : 'Rejetée'}
                          {p.reviewer && (
                            <> par <span style={{ color: getRoleColor(p.reviewer.role) }}>@{p.reviewer.username}</span></>
                          )}
                        </span>
                        {user && ['EXPERT', 'ADMIN'].includes(user.role) && (
                          <button
                            onClick={() => setConfirmModal({
                              message: 'Supprimer définitivement cette proposition ?',
                              onConfirm: async () => {
                                try {
                                  await api.delete(`/api/proposals/${p.id}`)
                                  setConfirmModal(null)
                                  onProposalUpdated()
                                } catch (error) {
                                  console.error(error)
                                }
                              }
                            })}
                            style={{
                              padding: '1px 5px',
                              borderRadius: '4px',
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              fontSize: '10px',
                              color: 'var(--red-soft)',
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      <div style={{ padding: '10px 12px' }}>
                        <div style={{
                          fontFamily: 'Spectral, serif',
                          fontSize: '13px',
                          fontStyle: 'italic',
                          color: 'var(--ink-soft)',
                          lineHeight: '1.7',
                          marginBottom: p.reason ? '6px' : '0',
                        }}>
                          {p.proposedText}
                        </div>
                        {p.reason && (
                          <div style={{
                            fontFamily: 'DM Mono, monospace',
                            fontSize: '9px',
                            color: 'var(--red-soft)',
                            opacity: 0.8,
                          }}>
                            Raison : {p.reason}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
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

        {/* ═══════════════ ONGLET MOT ═══════════════ */}
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
                            {t.creator && (
                              <span style={{ color: getRoleColor(t.creator.role) }}>
                                @{t.creator.username}
                              </span>
                            )}
                            {user && ['EXPERT', 'ADMIN'].includes(user.role) && (
                              <button
                                onClick={() => setConfirmModal({
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
                                })}
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
                            justifyContent: 'space-between',
                            marginTop: '6px',
                          }}>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontFamily: 'DM Mono, monospace',
                              fontSize: '10px',
                              color: 'var(--ink-muted)',
                            }}>
                              <span>{t.voteCount} vote{t.voteCount !== 1 ? 's' : ''}</span>
                              {t.creator && (
                                <span style={{ color: getRoleColor(t.creator.role) }}>
                                  @{t.creator.username}
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
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
                                    padding: '2px 7px',
                                    borderRadius: '4px',
                                    border: `1px solid ${votedIds.has(t.id) ? 'var(--gold)' : 'var(--border)'}`,
                                    background: votedIds.has(t.id) ? 'var(--gold-pale)' : 'transparent',
                                    cursor: 'pointer',
                                    fontFamily: 'DM Mono, monospace',
                                    fontSize: '9px',
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
                                      padding: '2px 7px',
                                      borderRadius: '4px',
                                      border: '1px solid rgba(45,90,58,0.3)',
                                      background: 'var(--green-light)',
                                      cursor: 'pointer',
                                      fontFamily: 'DM Mono, monospace',
                                      fontSize: '9px',
                                      color: 'var(--green-valid)',
                                    }}
                                  >
                                    ✓
                                  </button>
                                  <button
                                    onClick={() => setConfirmModal({
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
                                    })}
                                    style={{
                                      padding: '2px 7px',
                                      borderRadius: '4px',
                                      border: '1px solid rgba(122,42,42,0.3)',
                                      background: 'var(--red-light)',
                                      cursor: 'pointer',
                                      fontFamily: 'DM Mono, monospace',
                                      fontSize: '9px',
                                      color: 'var(--red-soft)',
                                    }}
                                  >
                                    ✕
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}

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

        {/* ═══════════════ ONGLET COMMENTAIRES ═══════════════ */}
        {activeTab === 'comments' && (
          activeVerse ? (
            <div>
              <div style={{
                fontFamily: 'DM Mono, monospace',
                fontSize: '10px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase' as const,
                color: 'var(--ink-muted)',
                marginBottom: '16px',
              }}>
                {comments.length} commentaire{comments.length !== 1 ? 's' : ''}
              </div>

              {comments.length === 0 && (
                <div style={{
                  fontFamily: 'Spectral, serif',
                  fontSize: '14px',
                  color: 'var(--ink-faint)',
                  fontStyle: 'italic',
                  marginBottom: '20px',
                }}>
                  Aucun commentaire pour ce verset.
                </div>
              )}

              {comments.map(c => (
                <div key={c.id} style={{
                  padding: '12px 0',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '6px',
                  }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: 'var(--blue-sacred)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'DM Mono, monospace',
                      fontSize: '9px',
                      color: 'white',
                      flexShrink: 0,
                    }}>
                      {c.creator?.username?.substring(0, 2).toUpperCase() || '??'}
                    </div>
                    <span style={{
                      fontFamily: 'DM Mono, monospace',
                      fontSize: '10px',
                      color: c.creator ? getRoleColor(c.creator.role) : 'var(--ink-muted)',
                    }}>
                      {c.creator?.username || 'Anonyme'}
                    </span>
                    {c.creator?.role && (
                      <span style={{
                        fontFamily: 'DM Mono, monospace',
                        fontSize: '9px',
                        padding: '2px 6px',
                        borderRadius: '20px',
                        background: 'var(--blue-light)',
                        color: 'var(--blue-sacred)',
                        border: '1px solid rgba(42,74,122,0.15)',
                      }}>
                        {c.creator.role}
                      </span>
                    )}
                    {user && (['EXPERT', 'ADMIN'].includes(user.role) || user.id === c.createdBy) && (
                      <button
                        onClick={() => setConfirmModal({
                          message: 'Supprimer ce commentaire ?',
                          onConfirm: async () => {
                            try {
                              await api.delete(`/api/comments/${c.id}`)
                              setConfirmModal(null)
                              onCommentAdded()
                            } catch (error) {
                              console.error(error)
                            }
                          }
                        })}
                        style={{
                          marginLeft: 'auto',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          border: '1px solid rgba(122,42,42,0.2)',
                          background: 'transparent',
                          cursor: 'pointer',
                          fontFamily: 'DM Mono, monospace',
                          fontSize: '9px',
                          color: 'var(--red-soft)',
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div style={{
                    fontFamily: 'Spectral, serif',
                    fontSize: '13.5px',
                    color: 'var(--ink-soft)',
                    lineHeight: '1.65',
                  }}>
                    <CommentText text={c.text} />
                  </div>
                </div>
              ))}

              {user ? (
                <div style={{ marginTop: '20px' }}>
                  <textarea
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    placeholder="Ajouter un commentaire…"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      background: 'white',
                      fontFamily: 'Spectral, serif',
                      fontSize: '13.5px',
                      color: 'var(--ink)',
                      resize: 'vertical',
                      minHeight: '80px',
                      outline: 'none',
                      marginBottom: '8px',
                    }}
                  />
                  <div style={{
                    fontFamily: 'DM Mono, monospace',
                    fontSize: '9px',
                    color: 'var(--ink-faint)',
                    marginBottom: '8px',
                    lineHeight: '1.6',
                  }}>
                    [Genèse 1:1] → lien verset · [texte](https://url.com) → lien externe
                  </div>
                  <button
                    onClick={async () => {
                      if (!newComment.trim() || !activeVerse) return
                      setSubmittingComment(true)
                      try {
                        await api.post(`/api/verses/${activeVerse.id}/comments`, { text: newComment.trim() })
                        setNewComment('')
                        onCommentAdded()
                      } catch (error) {
                        console.error(error)
                      } finally {
                        setSubmittingComment(false)
                      }
                    }}
                    disabled={submittingComment || !newComment.trim()}
                    style={{
                      padding: '8px 20px',
                      background: 'var(--gold)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontFamily: 'DM Mono, monospace',
                      fontSize: '10px',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase' as const,
                      cursor: submittingComment ? 'not-allowed' : 'pointer',
                      opacity: submittingComment || !newComment.trim() ? 0.6 : 1,
                    }}
                  >
                    {submittingComment ? 'Envoi...' : 'Publier'}
                  </button>
                </div>
              ) : (
                <div style={{
                  marginTop: '20px',
                  fontFamily: 'Spectral, serif',
                  fontSize: '13px',
                  color: 'var(--ink-muted)',
                  fontStyle: 'italic',
                  textAlign: 'center',
                }}>
                  <a href="/login" style={{ color: 'var(--gold)' }}>Connectez-vous</a> pour commenter
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
              <div style={{ fontSize: '36px', opacity: 0.3, fontFamily: 'Crimson Pro, serif' }}>ג</div>
              <div>Cliquez sur un verset<br />pour voir les commentaires</div>
            </div>
          )
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