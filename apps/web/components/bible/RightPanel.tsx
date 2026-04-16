'use client'

import { useState, useEffect, useRef } from 'react'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import ConfirmModal from './ConfirmModal'
import CommentText from './CommentText'
import { getRoleColor, getRoleBackground, getRoleBorder } from '@/lib/roleColors'
import { BOOK_NAME_TO_SLUG } from '@/lib/bookSlugs'
import Link from 'next/link'

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

interface CommentReaction {
  userId: string
  emoji: string
}

interface Comment {
  id: string
  text: string
  createdAt: string
  createdBy: string | null
  creator: { username: string; role: string } | null
  reactions: CommentReaction[]
  replies: {
    id: string
    text: string
    createdAt: string
    createdBy: string | null
    creator: { username: string; role: string } | null
    reactions: CommentReaction[]
  }[]
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
  _count?: { comments: number }
}

interface RightPanelProps {
  activeTab: 'verse' | 'word' | 'comments'
  setActiveTab: (tab: 'verse' | 'word' | 'comments') => void
  activeVerse: Verse | null
  bookName?: string
  chapterNumber?: number
  activeWord: WordToken | null
  wordTranslations: WordTranslation[]
  comments: Comment[]
  proposals: Proposal[]
  verseTranslations: VerseTranslation[]
  onTranslationAdded: () => void
  onCommentAdded: () => void
  onProposalUpdated: () => void
}

function OccurrencesList({ occurrences, activeWord }: {
  occurrences: {
    id: string
    word: string
    verseText: {
      verse: {
        number: number
        chapter: { number: number; book: { name: string; slug: string; testament: string } }
        translations?: { textFr: string }[]
      }
    }
  }[]
  activeWord: { word: string }
}) {
  const [showAll, setShowAll] = useState(false)
  const displayed = showAll ? occurrences : occurrences.slice(0, 5)

  return (
    <div>
      {displayed.map((o, i) => {
        const verse = o.verseText.verse
        const prefix = verse.chapter.book.testament === 'AT' ? 'at' : 'nt'
        const url = `/${prefix}/${verse.chapter.book.slug}/${verse.chapter.number}?word=${o.id}&tab=word#v${verse.number}`
        const trans = verse.translations?.[0]?.textFr || ''
        const wordLower = activeWord.word.toLowerCase()
        const idx = trans.toLowerCase().indexOf(wordLower)
        return (
          <Link key={o.id} href={url} style={{ textDecoration: 'none', display: 'block' }}>
            <div
              style={{ padding: '10px 0', borderBottom: i < displayed.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', transition: 'opacity 0.15s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.7'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
            >
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink-muted)', marginBottom: '6px' }}>
                {verse.chapter.book.name} {verse.chapter.number}:{verse.number}
              </div>
              {trans ? (
                <div style={{ fontFamily: 'Spectral, serif', fontSize: '14px', fontStyle: 'italic', color: 'var(--ink-soft)', lineHeight: '1.6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                  {idx >= 0 ? (
                    <>
                      {trans.slice(0, idx)}
                      <span style={{ background: 'var(--gold-pale)', color: 'var(--gold)', borderRadius: '3px', padding: '0 2px', fontStyle: 'normal', fontWeight: '500' }}>
                        {trans.slice(idx, idx + wordLower.length)}
                      </span>
                      {trans.slice(idx + wordLower.length)}
                    </>
                  ) : trans}
                </div>
              ) : (
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: 'var(--ink)', direction: 'rtl' }}>
                  {o.word}
                </div>
              )}
            </div>
          </Link>
        )
      })}
      {occurrences.length > 5 && (
        <div
          onClick={e => { e.preventDefault(); setShowAll(!showAll) }}
          style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--gold)', padding: '8px 0', cursor: 'pointer', userSelect: 'none' as const }}
        >
          {showAll ? '▼ Réduire' : `▶ Voir ${occurrences.length - 5} de plus`}
        </div>
      )}
    </div>
  )
}

export default function RightPanel({
  activeTab,
  setActiveTab,
  activeVerse,
  activeWord,
  bookName,
  chapterNumber,
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
  const [proposalReason, setProposalReason] = useState('')
  const [submittingProposal, setSubmittingProposal] = useState(false)
  const [proposalError, setProposalError] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [showRejected, setShowRejected] = useState(false)
  const [proposalVotedIds, setProposalVotedIds] = useState<Set<string>>(new Set())
  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [pickerOpenId, setPickerOpenId] = useState<string | null>(null)
  const [diffIds, setDiffIds] = useState<Set<string>>(new Set())
  const toggleFullText = (id: string) => setDiffIds(prev => {
    const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s
  })
  const [openDiscussions, setOpenDiscussions] = useState<Set<string>>(new Set())
  const [proposalComments, setProposalComments] = useState<Record<string, Comment[]>>({})
  const [loadingDiscussion, setLoadingDiscussion] = useState<Set<string>>(new Set())
  const [proposalCommentText, setProposalCommentText] = useState<Record<string, string>>({})
  const [submittingProposalComment, setSubmittingProposalComment] = useState<Set<string>>(new Set())
  const [proposalReplyingTo, setProposalReplyingTo] = useState<{ commentId: string; proposalId: string; username: string } | null>(null)
  const [localReactions, setLocalReactions] = useState<Record<string, CommentReaction[]>>({})

  const [occurrences, setOccurrences] = useState<{
    id: string
    word: string
    position: number
    verseText: {
      verse: {
        number: number
        chapter: { number: number; book: { name: string; slug: string; testament: string } }
        translations?: { textFr: string }[]
      }
    }
  }[]>([])
  const [loadingOccurrences, setLoadingOccurrences] = useState(false)

  const [insertMode, setInsertMode] = useState<null | 'verse' | 'link'>(null)
  const [insertBook, setInsertBook] = useState('')
  const [insertChapter, setInsertChapter] = useState('')
  const [insertVerse, setInsertVerse] = useState('')
  const [insertLinkText, setInsertLinkText] = useState('')
  const [insertLinkUrl, setInsertLinkUrl] = useState('')
  const [insertTestament, setInsertTestament] = useState<'AT' | 'NT'>('AT')
  const commentRef = useRef<HTMLTextAreaElement>(null)

  const booksByTestament = {
    AT: Object.keys(BOOK_NAME_TO_SLUG).slice(0, 46),
    NT: Object.keys(BOOK_NAME_TO_SLUG).slice(46),
  }

  useEffect(() => {
    const ta = commentRef.current
    if (ta) {
      ta.style.height = 'auto'
      ta.style.height = ta.scrollHeight + 'px'
    }
  }, [newComment])

  const timeAgo = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (diff < 60) return 'à l\'instant'
    if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`
    if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`
    return new Date(dateStr).toLocaleDateString('fr-FR')
  }

  const computeWordDiff = (oldText: string, newText: string) => {
    const oldTokens = oldText.match(/\S+|\s+/g) || []
    const newTokens = newText.match(/\S+|\s+/g) || []
    const n = oldTokens.length, m = newTokens.length
    const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
    for (let i = 1; i <= n; i++)
      for (let j = 1; j <= m; j++)
        dp[i][j] = oldTokens[i-1] === newTokens[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1])
    const result: { type: 'same' | 'added' | 'removed'; text: string }[] = []
    let i = n, j = m
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && oldTokens[i-1] === newTokens[j-1]) {
        result.unshift({ type: 'same', text: oldTokens[i-1] }); i--; j--
      } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
        result.unshift({ type: 'added', text: newTokens[j-1] }); j--
      } else {
        result.unshift({ type: 'removed', text: oldTokens[i-1] }); i--
      }
    }
    return result
  }

  const loadProposalComments = async (proposalId: string) => {
    if (proposalComments[proposalId] !== undefined) return // already loaded
    setLoadingDiscussion(prev => new Set([...prev, proposalId]))
    try {
      const res = await api.get(`/api/proposals/${proposalId}/comments`)
      setProposalComments(prev => ({ ...prev, [proposalId]: res.data }))
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingDiscussion(prev => { const s = new Set(prev); s.delete(proposalId); return s })
    }
  }

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

  useEffect(() => {
    if (!activeWord) return
    setLoadingOccurrences(true)
    api.get(`/api/words/${activeWord.id}/occurrences`)
      .then(res => setOccurrences(res.data))
      .catch(console.error)
      .finally(() => setLoadingOccurrences(false))
  }, [activeWord?.id])

  const getReactions = (comment: { id: string; reactions?: CommentReaction[] }) => {
    return localReactions[comment.id] ?? comment.reactions ?? []
  }

  useEffect(() => {
    if (!pickerOpenId) return
    const close = () => setPickerOpenId(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [pickerOpenId])

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

  const EMOJIS = ['👍', '❤️', '🙏', '💡']

  const ReactionRow = ({ comment }: { comment: { id: string; reactions?: CommentReaction[] } }) => {
    const reactions = getReactions(comment)
    const counts: Record<string, number> = {}
    const userReacted: Record<string, boolean> = {}
    for (const r of reactions) {
      counts[r.emoji] = (counts[r.emoji] || 0) + 1
      if (user && r.userId === user.id) userReacted[r.emoji] = true
    }
    const usedEmojis = EMOJIS.filter(e => counts[e])

    const toggle = async (emoji: string) => {
      if (!user) return
      setPickerOpenId(null)
      try {
        const res = await api.post(`/api/comments/${comment.id}/react`, { emoji })
        setLocalReactions(prev => ({ ...prev, [comment.id]: res.data.reactions }))
      } catch {}
    }

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
        {usedEmojis.map(emoji => (
          <button
            key={emoji}
            onClick={() => toggle(emoji)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              padding: '2px 7px',
              borderRadius: '10px',
              border: userReacted[emoji]
                ? '1px solid rgba(184,132,58,0.5)'
                : '1px solid var(--border)',
              background: userReacted[emoji] ? 'var(--gold-pale)' : 'var(--parchment-dark)',
              cursor: user ? 'pointer' : 'default',
              fontSize: '12px',
              fontFamily: 'DM Mono, monospace',
              color: userReacted[emoji] ? 'var(--gold)' : 'var(--ink-muted)',
              transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: '13px' }}>{emoji}</span>
            <span style={{ fontSize: '11px' }}>{counts[emoji]}</span>
          </button>
        ))}
        {user && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={(e) => { e.stopPropagation(); setPickerOpenId(pickerOpenId === comment.id ? null : comment.id) }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: '13px',
                color: 'var(--ink-faint)',
                transition: 'all 0.15s',
                lineHeight: 1,
              }}
              title="Ajouter une réaction"
            >
              +
            </button>
            {pickerOpenId === comment.id && (
              <div style={{
                position: 'absolute',
                bottom: '28px',
                left: 0,
                display: 'flex',
                gap: '2px',
                background: 'var(--card-bg)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '5px 7px',
                boxShadow: 'var(--shadow-md)',
                zIndex: 10,
              }}>
                {EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => toggle(emoji)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '18px',
                      padding: '2px 4px',
                      borderRadius: '6px',
                      transition: 'transform 0.1s',
                      lineHeight: 1,
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'scale(1.25)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'scale(1)'}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
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
              padding: '14px 8px',
              textAlign: 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase' as const,
              color: activeTab === tab ? 'var(--gold)' : 'var(--ink-faint)',
              cursor: 'pointer',
              borderBottom: activeTab === tab ? '2px solid var(--gold)' : '2px solid transparent',
              background: activeTab === tab ? 'var(--parchment)' : 'transparent',
              transition: 'color var(--transition-fast)',
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

              {/* Référence du verset */}
              {bookName && chapterNumber && (
                <div
                  onClick={() => navigator.clipboard.writeText(`${bookName} ${chapterNumber}:${activeVerse.number}`)}
                  title="Copier la référence"
                  style={{
                    display: 'inline-block',
                    marginBottom: '14px',
                    fontFamily: 'DM Mono, monospace',
                    fontSize: '12px',
                    color: 'var(--ink-muted)',
                    letterSpacing: '0.08em',
                    cursor: 'pointer',
                    borderBottom: '1px dashed var(--border)',
                    paddingBottom: '1px',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--gold)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--ink-muted)'}
                >
                  {bookName} {chapterNumber}:{activeVerse.number}
                </div>
              )}

              {/* Texte original */}
              <div style={{
                background: 'var(--surface-dark)',
                borderRadius: '10px',
                padding: '18px 20px',
                marginBottom: '20px',
                direction: activeVerse.texts[0]?.language === 'HEB' ? 'rtl' : 'ltr',
                textAlign: activeVerse.texts[0]?.language === 'HEB' ? 'right' : 'left',
              }}>
                <div style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: '11px',
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
                          fontSize: '11px',
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
                          fontSize: '16px',
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
                            fontSize: '11px',
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
                                fontSize: '11px',
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
                    background: 'var(--card-bg)',
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
                        fontSize: '11px',
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
                            fontSize: '11px',
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
                fontSize: '12px',
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
                    fontSize: '11px',
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
                const referenceText = activeVerse?.translations[0]?.textFr || ''
                const isActiveTrad = p.proposedText === referenceText
                const diff = computeWordDiff(referenceText, p.proposedText)
                const hasDiff = referenceText.length > 0 && diff.some(d => d.type !== 'same')
                const showingDiff = hasDiff && diffIds.has(p.id)

                const borderColor = isActiveTrad
                  ? 'rgba(184,132,58,0.5)'
                  : p.status === 'ACCEPTED'
                  ? 'rgba(45,90,58,0.35)'
                  : 'var(--border)'
                const headerBg = isActiveTrad
                  ? 'rgba(184,132,58,0.08)'
                  : p.status === 'ACCEPTED'
                  ? 'rgba(45,90,58,0.06)'
                  : 'var(--parchment-dark)'

                return (
                  <div key={p.id} style={{
                    border: `1px solid ${borderColor}`,
                    borderRadius: '10px',
                    overflow: 'hidden',
                    marginBottom: '12px',
                    background: 'var(--card-bg)',
                  }}>

                    {/* ── En-tête ── */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '6px',
                      padding: '9px 14px',
                      background: headerBg,
                      borderBottom: '1px solid var(--border)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                        <Link href={p.creator ? `/profile/${p.creator.username}` : '#'} style={{
                          fontFamily: 'DM Mono, monospace',
                          fontSize: '12px',
                          color: p.creator ? getRoleColor(p.creator.role) : 'var(--ink-muted)',
                          textDecoration: 'none',
                          whiteSpace: 'nowrap',
                        }}>
                          @{p.creator?.username || 'anonyme'}
                        </Link>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink-faint)', whiteSpace: 'nowrap' }}>
                          · {timeAgo(p.createdAt)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <span style={{
                          fontFamily: 'DM Mono, monospace',
                          fontSize: '11px',
                          padding: '2px 9px',
                          borderRadius: '20px',
                          background: isActiveTrad ? 'var(--gold-pale)' : p.status === 'ACCEPTED' ? 'var(--green-light)' : 'var(--amber-light)',
                          color: isActiveTrad ? 'var(--gold)' : p.status === 'ACCEPTED' ? 'var(--green-valid)' : 'var(--amber-pending)',
                          border: `1px solid ${isActiveTrad ? 'rgba(184,132,58,0.3)' : p.status === 'ACCEPTED' ? 'rgba(45,90,58,0.2)' : 'rgba(122,90,26,0.2)'}`,
                          whiteSpace: 'nowrap',
                        }}>
                          {isActiveTrad ? '★ Active' : p.status === 'ACCEPTED' ? 'Acceptée' : 'En attente'}
                        </span>
                        {p.status === 'ACCEPTED' && user && ['EXPERT', 'ADMIN'].includes(user.role) && !isActiveTrad && (
                          <button
                            onClick={async () => {
                              try { await api.patch(`/api/proposals/${p.id}/activate`); onProposalUpdated() } catch (e) { console.error(e) }
                            }}
                            style={{
                              padding: '2px 8px', borderRadius: '4px',
                              border: '1px solid rgba(45,90,58,0.3)', background: 'var(--green-light)',
                              cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--green-valid)', whiteSpace: 'nowrap',
                            }}
                          >↑ Rendre active</button>
                        )}
                        {user && (['EXPERT', 'ADMIN'].includes(user.role) || (p.createdBy === user.id && p.status === 'PENDING')) && (
                          <button
                            onClick={() => setConfirmModal({
                              message: 'Supprimer définitivement cette proposition ?',
                              onConfirm: async () => {
                                try { await api.delete(`/api/proposals/${p.id}`); setConfirmModal(null); onProposalUpdated() } catch (e) { console.error(e) }
                              }
                            })}
                            style={{
                              padding: '2px 6px', borderRadius: '4px',
                              border: '1px solid rgba(122,42,42,0.2)', background: 'transparent',
                              cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '12px', color: 'var(--red-soft)',
                            }}
                          >✕</button>
                        )}
                      </div>
                    </div>

                    {/* ── Corps : diff ou texte complet ── */}
                    <div style={{ padding: '12px 14px 10px' }}>
                      <div style={{
                        fontFamily: 'Spectral, serif',
                        fontSize: '14px',
                        fontStyle: 'italic',
                        lineHeight: '1.9',
                        color: 'var(--ink)',
                      }}>
                        {showingDiff ? diff.map((token, idx) => {
                          if (token.type === 'removed') return (
                            <span key={idx} style={{
                              background: 'var(--red-light)',
                              color: 'var(--red-soft)',
                              textDecoration: 'line-through',
                              borderRadius: '3px',
                              padding: '0 2px',
                            }}>{token.text}</span>
                          )
                          if (token.type === 'added') return (
                            <span key={idx} style={{
                              background: 'var(--green-light)',
                              color: 'var(--green-valid)',
                              borderRadius: '3px',
                              padding: '0 2px',
                              fontWeight: '500',
                            }}>{token.text}</span>
                          )
                          return <span key={idx}>{token.text}</span>
                        }) : p.proposedText}
                      </div>

                      {hasDiff && (
                        <button
                          onClick={() => toggleFullText(p.id)}
                          style={{
                            marginTop: '7px',
                            padding: '2px 8px',
                            background: 'transparent',
                            border: '1px solid var(--border)',
                            borderRadius: '4px',
                            fontFamily: 'DM Mono, monospace',
                            fontSize: '11px',
                            color: 'var(--ink-faint)',
                            cursor: 'pointer',
                          }}
                        >
                          {showingDiff ? 'Texte complet' : '~ Voir diff'}
                        </button>
                      )}

                      {p.reason && (
                        <div style={{
                          marginTop: '8px',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          background: 'var(--parchment-dark)',
                          borderLeft: '2px solid var(--gold)',
                          fontFamily: 'var(--font-serif)',
                          fontSize: '12px',
                          color: 'var(--ink-muted)',
                          fontStyle: 'italic',
                        }}>
                          « {p.reason} »
                        </div>
                      )}
                    </div>

                    {/* ── Discussion ── */}
                    <div style={{ borderTop: '1px solid var(--border)' }}>
                      <button
                        onClick={() => {
                          setOpenDiscussions(prev => {
                            const s = new Set(prev)
                            if (s.has(p.id)) {
                              s.delete(p.id)
                            } else {
                              s.add(p.id)
                              loadProposalComments(p.id)
                            }
                            return s
                          })
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          width: '100%',
                          padding: '8px 14px',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          fontFamily: 'DM Mono, monospace',
                          fontSize: '11px',
                          color: 'var(--ink-muted)',
                          textAlign: 'left' as const,
                          transition: 'color 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--ink)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--ink-muted)'}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        Discussion
                        {(p._count?.comments ?? 0) > 0 && (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            minWidth: '18px', height: '18px', padding: '0 5px',
                            borderRadius: '9px',
                            background: 'var(--blue-light)',
                            color: 'var(--blue-sacred)',
                            fontSize: '10px',
                          }}>
                            {p._count?.comments}
                          </span>
                        )}
                        <span style={{ marginLeft: 'auto', fontSize: '10px', opacity: 0.6 }}>
                          {openDiscussions.has(p.id) ? '▲' : '▼'}
                        </span>
                      </button>

                      {openDiscussions.has(p.id) && (
                        <div style={{
                          borderTop: '1px solid var(--border)',
                          background: 'var(--parchment)',
                          padding: '12px 14px',
                        }}>
                          {loadingDiscussion.has(p.id) ? (
                            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink-faint)', textAlign: 'center', padding: '8px 0' }}>
                              Chargement…
                            </div>
                          ) : (proposalComments[p.id] || []).length === 0 ? (
                            <div style={{ fontFamily: 'Spectral, serif', fontSize: '13px', color: 'var(--ink-faint)', fontStyle: 'italic', marginBottom: '10px' }}>
                              Aucun commentaire — soyez le premier à donner votre avis.
                            </div>
                          ) : (
                            <div style={{ marginBottom: '12px' }}>
                              {(proposalComments[p.id] || []).map((c, ci) => (
                                <div key={c.id} style={{
                                  paddingBottom: '10px',
                                  marginBottom: '10px',
                                  borderBottom: ci < (proposalComments[p.id] || []).length - 1 ? '1px solid var(--border)' : 'none',
                                }}>
                                  {/* Comment header */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                    <Link href={c.creator ? `/profile/${c.creator.username}` : '#'} style={{
                                      fontFamily: 'DM Mono, monospace', fontSize: '11px',
                                      color: c.creator ? getRoleColor(c.creator.role) : 'var(--ink-muted)',
                                      textDecoration: 'none',
                                    }}>
                                      @{c.creator?.username || 'anonyme'}
                                    </Link>
                                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--ink-faint)' }}>
                                      · {timeAgo(c.createdAt)}
                                    </span>
                                  </div>
                                  {/* Comment text */}
                                  <div style={{ fontFamily: 'Spectral, serif', fontSize: '13px', color: 'var(--ink-soft)', lineHeight: '1.7', marginLeft: '0' }}>
                                    <CommentText text={c.text} />
                                  </div>
                                  {/* Reactions */}
                                  <ReactionRow comment={c} />
                                  {/* Actions : répondre + supprimer */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                                    {user && (
                                      <button
                                        onClick={() => {
                                          setProposalReplyingTo(
                                            proposalReplyingTo?.commentId === c.id
                                              ? null
                                              : { commentId: c.id, proposalId: p.id, username: c.creator?.username || 'anonyme' }
                                          )
                                        }}
                                        style={{
                                          background: 'transparent', border: 'none', cursor: 'pointer',
                                          fontFamily: 'DM Mono, monospace', fontSize: '10px', padding: '0',
                                          color: proposalReplyingTo?.commentId === c.id ? 'var(--gold)' : 'var(--ink-faint)',
                                        }}
                                      >↩ Répondre</button>
                                    )}
                                    {user && (c.createdBy === user.id || ['EXPERT', 'ADMIN'].includes(user.role)) && (
                                      <button
                                        onClick={async () => {
                                          try {
                                            await api.delete(`/api/comments/${c.id}`)
                                            setProposalComments(prev => ({
                                              ...prev,
                                              [p.id]: (prev[p.id] || []).filter(x => x.id !== c.id)
                                            }))
                                          } catch (err) { console.error(err) }
                                        }}
                                        style={{
                                          background: 'transparent', border: 'none', cursor: 'pointer',
                                          fontFamily: 'DM Mono, monospace', fontSize: '10px', padding: '0',
                                          color: 'var(--red-soft)', opacity: 0.6,
                                        }}
                                        title="Supprimer ce commentaire"
                                      >✕ Supprimer</button>
                                    )}
                                  </div>
                                  {/* Replies */}
                                  {c.replies && c.replies.length > 0 && (
                                    <div style={{ marginTop: '8px', paddingLeft: '14px', borderLeft: '2px solid var(--border)' }}>
                                      {c.replies.map(r => (
                                        <div key={r.id} style={{ marginBottom: '8px' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                                            <Link href={r.creator ? `/profile/${r.creator.username}` : '#'} style={{
                                              fontFamily: 'DM Mono, monospace', fontSize: '11px',
                                              color: r.creator ? getRoleColor(r.creator.role) : 'var(--ink-muted)',
                                              textDecoration: 'none',
                                            }}>
                                              @{r.creator?.username || 'anonyme'}
                                            </Link>
                                            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--ink-faint)' }}>
                                              · {timeAgo(r.createdAt)}
                                            </span>
                                          </div>
                                          <div style={{ fontFamily: 'Spectral, serif', fontSize: '13px', color: 'var(--ink-soft)', lineHeight: '1.7' }}>
                                            <CommentText text={r.text} />
                                          </div>
                                          <ReactionRow comment={r} />
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* New comment / reply input */}
                          {user && (
                            <div>
                              {/* Bannière de réponse */}
                              {proposalReplyingTo?.proposalId === p.id && (
                                <div style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  padding: '5px 10px', marginBottom: '6px',
                                  background: 'var(--gold-pale)', borderRadius: '6px',
                                  border: '1px solid rgba(184,132,58,0.25)',
                                  fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--gold)',
                                }}>
                                  <span>↩ Répondre à @{proposalReplyingTo.username}</span>
                                  <button onClick={() => setProposalReplyingTo(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--gold)', fontSize: '13px', lineHeight: 1, padding: '0 2px' }}>×</button>
                                </div>
                              )}
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                                <textarea
                                  value={proposalCommentText[p.id] || ''}
                                  onChange={e => setProposalCommentText(prev => ({ ...prev, [p.id]: e.target.value }))}
                                  onInput={e => {
                                    const ta = e.target as HTMLTextAreaElement
                                    ta.style.height = 'auto'
                                    ta.style.height = ta.scrollHeight + 'px'
                                  }}
                                  placeholder={proposalReplyingTo?.proposalId === p.id
                                    ? `Répondre à @${proposalReplyingTo.username}…`
                                    : 'Votre avis…'
                                  }
                                  rows={1}
                                  style={{
                                    flex: 1, padding: '7px 10px',
                                    border: `1px solid ${proposalReplyingTo?.proposalId === p.id ? 'rgba(184,132,58,0.4)' : 'var(--border)'}`,
                                    borderRadius: '8px',
                                    fontFamily: 'Spectral, serif', fontSize: '13px',
                                    color: 'var(--ink)', background: 'var(--input-bg)', outline: 'none',
                                    resize: 'none', overflow: 'hidden', transition: 'border-color 0.15s',
                                    minHeight: '36px',
                                  }}
                                  onFocus={e => (e.target as HTMLElement).style.borderColor = 'rgba(184,132,58,0.4)'}
                                  onBlur={e => (e.target as HTMLElement).style.borderColor = proposalReplyingTo?.proposalId === p.id ? 'rgba(184,132,58,0.4)' : 'var(--border)'}
                                />
                                <button
                                  disabled={submittingProposalComment.has(p.id) || !(proposalCommentText[p.id] || '').trim()}
                                  onClick={async () => {
                                    const text = (proposalCommentText[p.id] || '').trim()
                                    if (!text) return
                                    setSubmittingProposalComment(prev => new Set([...prev, p.id]))
                                    try {
                                      if (proposalReplyingTo?.proposalId === p.id) {
                                        const res = await api.post(`/api/comments/${proposalReplyingTo.commentId}/reply`, { text })
                                        setProposalComments(prev => ({
                                          ...prev,
                                          [p.id]: (prev[p.id] || []).map(c =>
                                            c.id === proposalReplyingTo.commentId
                                              ? { ...c, replies: [...(c.replies || []), { ...res.data, reactions: res.data.reactions ?? [] }] }
                                              : c
                                          )
                                        }))
                                        setProposalReplyingTo(null)
                                      } else {
                                        const res = await api.post(`/api/proposals/${p.id}/comments`, { text })
                                        setProposalComments(prev => ({
                                          ...prev,
                                          [p.id]: [...(prev[p.id] || []), res.data]
                                        }))
                                      }
                                      setProposalCommentText(prev => ({ ...prev, [p.id]: '' }))
                                    } catch (err) { console.error(err) } finally {
                                      setSubmittingProposalComment(prev => { const s = new Set(prev); s.delete(p.id); return s })
                                    }
                                  }}
                                  style={{
                                    padding: '7px 14px', alignSelf: 'flex-end',
                                    background: 'var(--gold)', color: 'white', border: 'none',
                                    borderRadius: '8px', cursor: 'pointer',
                                    fontFamily: 'DM Mono, monospace', fontSize: '11px',
                                    opacity: (!(proposalCommentText[p.id] || '').trim() || submittingProposalComment.has(p.id)) ? 0.5 : 1,
                                    transition: 'opacity 0.15s', whiteSpace: 'nowrap',
                                  }}
                                >
                                  {proposalReplyingTo?.proposalId === p.id ? 'Répondre' : 'Publier'}
                                </button>
                              </div>
                            </div>
                          )}
                          {!user && (
                            <div style={{ fontFamily: 'Spectral, serif', fontSize: '12px', color: 'var(--ink-faint)', fontStyle: 'italic', textAlign: 'center' }}>
                              Connectez-vous pour participer à la discussion
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* ── Pied : votes + actions ── */}
                    {p.status === 'PENDING' && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 14px',
                        borderTop: '1px solid var(--border)',
                        flexWrap: 'wrap',
                        background: 'var(--parchment-dark)',
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
                              } catch (e) { console.error(e) }
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 10px',
                              borderRadius: '5px',
                              border: `1px solid ${hasVoted ? 'var(--gold)' : 'var(--border)'}`,
                              background: hasVoted ? 'var(--gold-pale)' : 'transparent',
                              cursor: 'pointer',
                              fontFamily: 'DM Mono, monospace',
                              fontSize: '12px',
                              color: hasVoted ? 'var(--gold)' : 'var(--ink-soft)',
                              transition: 'all 0.15s',
                            }}
                          >
                            ▲ {hasVoted ? 'Voté' : 'Voter'}
                          </button>
                        )}
                        <span style={{
                          fontFamily: 'DM Mono, monospace',
                          fontSize: '12px',
                          color: 'var(--ink-muted)',
                          marginRight: 'auto',
                        }}>
                          {voteCount} vote{voteCount !== 1 ? 's' : ''}
                        </span>
                        {user && ['EXPERT', 'ADMIN'].includes(user.role) && (
                          rejectingId === p.id ? (
                            <div style={{ display: 'flex', gap: '6px', width: '100%', marginTop: '4px' }}>
                              <input
                                type="text"
                                placeholder="Raison du rejet..."
                                value={rejectReason}
                                onChange={e => setRejectReason(e.target.value)}
                                style={{
                                  flex: 1, padding: '5px 8px',
                                  border: '1px solid var(--border)', borderRadius: '6px',
                                  fontFamily: 'Spectral, serif', fontSize: '12px',
                                  color: 'var(--ink)', background: 'var(--input-bg)', outline: 'none',
                                }}
                              />
                              <button
                                onClick={async () => {
                                  if (!rejectReason.trim()) return
                                  try {
                                    await api.patch(`/api/proposals/${p.id}/reject`, { reason: rejectReason })
                                    setRejectingId(null); setRejectReason(''); onProposalUpdated()
                                  } catch (e) { console.error(e) }
                                }}
                                style={{
                                  padding: '5px 10px', background: 'transparent', color: 'var(--red-soft)',
                                  border: '1px solid rgba(122,42,42,0.3)', borderRadius: '6px',
                                  fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer',
                                }}
                              >Rejeter</button>
                              <button
                                onClick={() => { setRejectingId(null); setRejectReason('') }}
                                style={{
                                  padding: '5px 10px', background: 'transparent', color: 'var(--ink-muted)',
                                  border: '1px solid var(--border)', borderRadius: '6px',
                                  fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer',
                                }}
                              >Annuler</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                onClick={async () => {
                                  try { await api.patch(`/api/proposals/${p.id}/accept`); onProposalUpdated() } catch (e) { console.error(e) }
                                }}
                                style={{
                                  padding: '4px 10px', background: 'var(--green-valid)', color: 'white',
                                  border: 'none', borderRadius: '5px',
                                  fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer',
                                }}
                              >✓ Accepter</button>
                              <button
                                onClick={() => setRejectingId(p.id)}
                                style={{
                                  padding: '4px 10px', background: 'transparent', color: 'var(--red-soft)',
                                  border: '1px solid rgba(122,42,42,0.3)', borderRadius: '5px',
                                  fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer',
                                }}
                              >✕ Rejeter</button>
                            </div>
                          )
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
                      fontSize: '14px',
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
                    background: 'var(--card-bg)',
                    marginTop: '4px',
                  }}>
                    <div style={{
                      fontFamily: 'DM Mono, monospace',
                      fontSize: '11px',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase' as const,
                      color: 'var(--ink-muted)',
                      marginBottom: '8px',
                    }}>
                      Proposer une reformulation
                    </div>
                    {proposalError && (
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
                        {proposalError}
                      </div>
                    )}
                    <textarea
                      ref={commentRef}
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
                        marginBottom: '8px',
                        resize: 'vertical',
                        minHeight: '80px',
                      }}
                    />
                    <input
                      type="text"
                      value={proposalReason}
                      onChange={e => setProposalReason(e.target.value)}
                      placeholder="Justification (facultatif) — ex : terme plus fidèle au texte hébreu"
                      maxLength={500}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        fontFamily: 'Spectral, serif',
                        fontSize: '12px',
                        fontStyle: 'italic',
                        color: 'var(--ink)',
                        background: 'var(--parchment)',
                        outline: 'none',
                        marginBottom: '10px',
                      }}
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={async () => {
                          if (!newProposal.trim() || !activeVerse) return
                          setSubmittingProposal(true)
                          setProposalError('')
                          try {
                            await api.post(`/api/verses/${activeVerse.id}/proposals`, {
                              proposedText: newProposal.trim(),
                              reason: proposalReason.trim() || undefined,
                            })
                            setShowProposalForm(false)
                            setNewProposal('')
                            setProposalReason('')
                            onProposalUpdated()
                          } catch (err: unknown) {
                            const error = err as { response?: { data?: { error?: string } } }
                            setProposalError(error.response?.data?.error || 'Erreur lors de la proposition')
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
                          fontSize: '12px',
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
                          fontSize: '12px',
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
                  fontSize: '14px',
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
                      fontSize: '11px',
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
                      background: 'var(--card-bg)',
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
                          fontSize: '11px',
                          color: 'var(--ink-muted)',
                        }}>
                          <Link href={p.creator ? `/profile/${p.creator.username}` : '#'} style={{ color: p.creator ? getRoleColor(p.creator.role) : 'var(--ink-muted)', textDecoration: 'none' }}>
                            @{p.creator?.username || 'anonyme'}
                          </Link>
                          {' · '}{p.reason === 'Supprimée par un expert' ? 'Supprimée' : 'Rejetée'}
                          {p.reviewer && (
                            <> par <Link href={`/profile/${p.reviewer.username}`} style={{ color: getRoleColor(p.reviewer.role), textDecoration: 'none' }}>@{p.reviewer.username}</Link></>
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
                              fontSize: '12px',
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
                          fontSize: '14px',
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
                            fontSize: '11px',
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
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              textAlign: 'center',
              gap: '16px',
            }}>
              <div style={{ fontSize: '56px', opacity: 0.2, fontFamily: 'var(--font-title)', fontWeight: '300', lineHeight: 1 }}>א</div>
              <div style={{ fontSize: '14px', lineHeight: '1.6' }}>Cliquez sur un verset<br />pour l&apos;explorer</div>
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
                    fontSize: '14px',
                    color: 'var(--gold)',
                    letterSpacing: '0.08em',
                    marginBottom: '12px',
                  }}>
                    {activeWord.translit}
                  </div>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
                  {activeWord.strongNumber && (
                    <a
                      href={`https://www.blueletterbible.org/lexicon/${activeWord.strongNumber.toLowerCase()}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Dictionnaire Strong — ${activeWord.strongNumber}`}
                      style={{
                        fontFamily: 'DM Mono, monospace',
                        fontSize: '12px',
                        padding: '3px 10px',
                        borderRadius: '20px',
                        background: 'var(--blue-light)',
                        color: 'var(--blue-sacred)',
                        border: '1px solid rgba(42,74,122,0.15)',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#c8d9f0'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--blue-light)'}
                    >
                      {activeWord.strongNumber}
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                        <polyline points="15 3 21 3 21 9"/>
                        <line x1="10" y1="14" x2="21" y2="3"/>
                      </svg>
                    </a>
                  )}
                  {activeWord.morphology && (
                    <span style={{
                      fontFamily: 'DM Mono, monospace',
                      fontSize: '12px',
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
                      fontSize: '12px',
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
                fontSize: '12px',
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
                        fontSize: '11px',
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
                              fontSize: '16px',
                              fontStyle: 'italic',
                              color: 'var(--ink)',
                            }}>
                              {t.translation}
                            </div>
                            <span style={{
                              fontFamily: 'DM Mono, monospace',
                              fontSize: '11px',
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
                            fontSize: '12px',
                            color: 'var(--ink-muted)',
                          }}>
                            {t.creator && (
                              <Link href={`/profile/${t.creator.username}`} style={{ color: getRoleColor(t.creator.role), textDecoration: 'none' }}>
                                @{t.creator.username}
                              </Link>
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
                                  fontSize: '12px',
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
                        fontSize: '11px',
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
                          background: 'var(--card-bg)',
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '6px',
                          }}>
                            <div style={{
                              fontFamily: 'Spectral, serif',
                              fontSize: '16px',
                              fontStyle: 'italic',
                              color: 'var(--ink)',
                            }}>
                              {t.translation}
                            </div>
                            <span style={{
                              fontFamily: 'DM Mono, monospace',
                              fontSize: '11px',
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
                              fontSize: '12px',
                              color: 'var(--ink-muted)',
                            }}>
                              <span>{t.voteCount} vote{t.voteCount !== 1 ? 's' : ''}</span>
                              {t.creator && (
                                <Link href={`/profile/${t.creator.username}`} style={{ color: getRoleColor(t.creator.role), textDecoration: 'none' }}>
                                  @{t.creator.username}
                                </Link>
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
                                    fontSize: '11px',
                                    color: votedIds.has(t.id) ? 'var(--gold)' : 'var(--ink-soft)',
                                  }}
                                >
                                  ▲ {votedIds.has(t.id) ? 'Voté' : 'Voter'}
                                </button>
                              )}
                              {user && ['EXPERT', 'ADMIN'].includes(user.role) && (
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
                                    fontSize: '11px',
                                    color: 'var(--green-valid)',
                                  }}
                                >
                                  ✓
                                </button>
                              )}
                              {user && (['EXPERT', 'ADMIN'].includes(user.role) || t.createdBy === user.id) && (
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
                                    fontSize: '11px',
                                    color: 'var(--red-soft)',
                                  }}
                                >
                                  ✕
                                </button>
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
                    fontSize: '14px',
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
                  background: 'var(--card-bg)',
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
                        fontSize: '12px',
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
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            {/* Occurrences */}
              {activeWord.lemma && (
                <div style={{ marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                  <div style={{
                    fontFamily: 'DM Mono, monospace',
                    fontSize: '12px',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase' as const,
                    color: 'var(--ink-muted)',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}>
                    Occurrences dans la Bible
                    {!loadingOccurrences && occurrences.length > 0 && (
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', padding: '1px 6px', borderRadius: '20px', background: 'var(--parchment-deep)', color: 'var(--ink-muted)', border: '1px solid var(--border)' }}>
                        {occurrences.length}
                      </span>
                    )}
                  </div>
                  {loadingOccurrences ? (
                    <div style={{ fontFamily: 'Spectral, serif', fontSize: '14px', color: 'var(--ink-faint)', fontStyle: 'italic' }}>Chargement...</div>
                  ) : occurrences.length === 0 ? (
                    <div style={{ fontFamily: 'Spectral, serif', fontSize: '14px', color: 'var(--ink-faint)', fontStyle: 'italic' }}>Aucune autre occurrence trouvée.</div>
                  ) : (
                    <OccurrencesList occurrences={occurrences} activeWord={activeWord} />
                  )}
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
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              textAlign: 'center',
              gap: '16px',
            }}>
              <div style={{ fontSize: '56px', opacity: 0.2, fontFamily: 'var(--font-title)', fontWeight: '300', lineHeight: 1 }}>ב</div>
              <div style={{ fontSize: '14px', lineHeight: '1.6' }}>Cliquez sur un mot<br />pour voir son analyse</div>
            </div>
          )
        )}

        {/* ═══════════════ ONGLET COMMENTAIRES ═══════════════ */}
        {activeTab === 'comments' && (
          activeVerse ? (
            <div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--ink-muted)', marginBottom: '20px' }}>
                {comments.length} commentaire{comments.length !== 1 ? 's' : ''}
              </div>

              {comments.length === 0 && (
                <div style={{ fontFamily: 'Spectral, serif', fontSize: '14px', color: 'var(--ink-faint)', fontStyle: 'italic', marginBottom: '24px' }}>
                  Soyez le premier à commenter ce verset.
                </div>
              )}

              <div style={{ marginBottom: '24px' }}>
              {comments.map(c => (
                <div key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  {/* Commentaire principal */}
                  <div style={{ padding: '12px 0' }}>
                    {/* Meta ligne */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: c.creator ? getRoleColor(c.creator.role) : 'var(--blue-sacred)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'white', flexShrink: 0 }}>
                        {c.creator?.username?.substring(0, 2).toUpperCase() || '??'}
                      </div>
                      <Link href={c.creator ? `/profile/${c.creator.username}` : '#'} style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: c.creator ? getRoleColor(c.creator.role) : 'var(--ink-muted)', textDecoration: 'none', fontWeight: 500 }}>
                        {c.creator?.username || 'Anonyme'}
                      </Link>
                      {c.creator?.role && (
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', padding: '1px 6px', borderRadius: '20px', background: getRoleBackground(c.creator.role), color: getRoleColor(c.creator.role), border: `1px solid ${getRoleBorder(c.creator.role)}` }}>
                          {c.creator.role}
                        </span>
                      )}
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink-faint)' }}>
                        {timeAgo(c.createdAt)}
                      </span>
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                        {user && (
                          <button onClick={() => {
                            if (replyingToId === c.id) {
                              setReplyingToId(null)
                            } else {
                              setReplyingToId(c.id)
                              setNewComment('')
                              setInsertMode(null)
                              setTimeout(() => commentRef.current?.focus(), 50)
                            }
                          }} style={{ padding: '2px 7px', borderRadius: '4px', border: `1px solid ${replyingToId === c.id ? 'var(--gold)' : 'var(--border)'}`, background: replyingToId === c.id ? 'var(--gold-pale)' : 'transparent', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: replyingToId === c.id ? 'var(--gold)' : 'var(--ink-muted)' }}>
                            ↩
                          </button>
                        )}
                        {user && (['EXPERT', 'ADMIN'].includes(user.role) || user.id === c.createdBy) && (
                          <button onClick={() => setConfirmModal({ message: 'Supprimer ce commentaire et ses réponses ?', onConfirm: async () => { try { await api.delete(`/api/comments/${c.id}`); setConfirmModal(null); onCommentAdded() } catch (error) { console.error(error) } } })} style={{ padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(122,42,42,0.2)', background: 'transparent', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--red-soft)' }}>
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Texte */}
                    <div style={{ fontFamily: 'Spectral, serif', fontSize: '13.5px', color: 'var(--ink-soft)', lineHeight: '1.65', paddingLeft: '31px' }}>
                      <CommentText text={c.text} />
                    </div>
                    <div style={{ paddingLeft: '31px' }}>
                      <ReactionRow comment={c} />
                    </div>
                  </div>

                  {/* Réponses */}
                  {c.replies && c.replies.length > 0 && (
                    <div style={{ marginLeft: '11px', paddingLeft: '20px', borderLeft: '2px solid var(--border)', marginBottom: '10px' }}>
                      {c.replies.map((r, ri) => (
                        <div key={r.id} style={{ padding: '8px 0', borderBottom: ri < c.replies.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '6px', flexWrap: 'wrap' }}>
                            <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: r.creator ? getRoleColor(r.creator.role) : 'var(--blue-sacred)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'white', flexShrink: 0 }}>
                              {r.creator?.username?.substring(0, 2).toUpperCase() || '??'}
                            </div>
                            <Link href={r.creator ? `/profile/${r.creator.username}` : '#'} style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: r.creator ? getRoleColor(r.creator.role) : 'var(--ink-muted)', textDecoration: 'none', fontWeight: 500 }}>
                              {r.creator?.username || 'Anonyme'}
                            </Link>
                            {r.creator?.role && (
                              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', padding: '1px 6px', borderRadius: '20px', background: getRoleBackground(r.creator.role), color: getRoleColor(r.creator.role), border: `1px solid ${getRoleBorder(r.creator.role)}` }}>
                                {r.creator.role}
                              </span>
                            )}
                            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink-faint)' }}>
                              {timeAgo(r.createdAt)}
                            </span>
                            {user && (['EXPERT', 'ADMIN'].includes(user.role) || user.id === r.createdBy) && (
                              <button onClick={() => setConfirmModal({ message: 'Supprimer cette réponse ?', onConfirm: async () => { try { await api.delete(`/api/comments/${r.id}`); setConfirmModal(null); onCommentAdded() } catch (error) { console.error(error) } } })} style={{ marginLeft: 'auto', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(122,42,42,0.2)', background: 'transparent', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--red-soft)' }}>
                                ✕
                              </button>
                            )}
                          </div>
                          <div style={{ fontFamily: 'Spectral, serif', fontSize: '13px', color: 'var(--ink-soft)', lineHeight: '1.65' }}>
                            <CommentText text={r.text} />
                          </div>
                          <ReactionRow comment={r} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              </div>

              {/* ── Zone de rédaction ── */}
              {user ? (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                  {/* Bannière répondre */}
                  {replyingToId && (() => {
                    const target = comments.find(c => c.id === replyingToId)
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: 'var(--gold-pale)', border: '1px solid rgba(184,132,58,0.25)', borderRadius: '6px', marginBottom: '8px' }}>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--gold)', flex: 1 }}>
                          ↩ Répondre à <strong>@{target?.creator?.username || 'ce commentaire'}</strong>
                        </span>
                        <button onClick={() => { setReplyingToId(null); setNewComment('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '14px', color: 'var(--gold)', lineHeight: 1, padding: '0 2px' }}>×</button>
                      </div>
                    )
                  })()}

                  {/* Textarea */}
                  <textarea
                    ref={commentRef}
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && newComment.trim()) {
                        e.preventDefault()
                        e.currentTarget.form?.requestSubmit?.()
                      }
                    }}
                    placeholder={replyingToId ? 'Écrire une réponse…' : 'Ajouter un commentaire…'}
                    style={{ width: '100%', padding: '10px 12px', border: `1px solid ${replyingToId ? 'rgba(184,132,58,0.4)' : 'var(--border)'}`, borderRadius: '8px', background: 'var(--card-bg)', fontFamily: 'Spectral, serif', fontSize: '13.5px', color: 'var(--ink)', resize: 'none', minHeight: '80px', overflow: 'hidden', outline: 'none', marginBottom: '8px', transition: 'border-color 0.15s' }}
                  />

                  {/* Panneaux d'insertion */}
                  {insertMode === 'verse' && (
                    <div style={{ padding: '10px 12px', background: 'var(--blue-light)', border: '1px solid rgba(42,74,122,0.2)', borderRadius: '8px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {(['AT', 'NT'] as const).map(t => (
                            <button key={t} onClick={() => { setInsertTestament(t); setInsertBook(''); setInsertChapter(''); setInsertVerse('') }}
                              style={{ padding: '2px 8px', borderRadius: '20px', border: `1px solid ${insertTestament === t ? 'var(--blue-sacred)' : 'rgba(42,74,122,0.2)'}`, background: insertTestament === t ? 'var(--blue-sacred)' : 'transparent', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: insertTestament === t ? 'white' : 'var(--blue-sacred)', cursor: 'pointer' }}>
                              {t}
                            </button>
                          ))}
                        </div>
                        <select value={insertBook} onChange={e => { setInsertBook(e.target.value); setInsertChapter(''); setInsertVerse('') }}
                          style={{ padding: '3px 6px', border: '1px solid rgba(42,74,122,0.2)', borderRadius: '4px', background: 'var(--card-bg)', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink)', outline: 'none' }}>
                          <option value="">Livre</option>
                          {booksByTestament[insertTestament].map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                        {insertBook && (
                          <input type="number" min={1} placeholder="Ch." value={insertChapter} onChange={e => { setInsertChapter(e.target.value); setInsertVerse('') }}
                            style={{ width: '48px', padding: '3px 6px', border: '1px solid rgba(42,74,122,0.2)', borderRadius: '4px', background: 'var(--card-bg)', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink)', outline: 'none' }} />
                        )}
                        {insertChapter && (
                          <input type="number" min={1} placeholder="V." value={insertVerse} onChange={e => setInsertVerse(e.target.value)}
                            style={{ width: '48px', padding: '3px 6px', border: '1px solid rgba(42,74,122,0.2)', borderRadius: '4px', background: 'var(--card-bg)', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink)', outline: 'none' }} />
                        )}
                        {insertBook && insertChapter && insertVerse && (
                          <button onClick={() => {
                            const ref = `[${insertBook} ${insertChapter}:${insertVerse}]`
                            const ta = commentRef.current
                            if (ta) {
                              const start = ta.selectionStart; const end = ta.selectionEnd
                              const newText = newComment.slice(0, start) + ref + newComment.slice(end)
                              setNewComment(newText)
                              setTimeout(() => { ta.focus(); ta.setSelectionRange(start + ref.length, start + ref.length) }, 0)
                            } else { setNewComment(prev => prev + ref) }
                            setInsertMode(null); setInsertBook(''); setInsertChapter(''); setInsertVerse('')
                          }} style={{ padding: '3px 10px', borderRadius: '4px', border: 'none', background: 'var(--blue-sacred)', color: 'white', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer' }}>
                            ✓ Insérer
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {insertMode === 'link' && (
                    <div style={{ padding: '10px 12px', background: 'var(--gold-pale)', border: '1px solid rgba(184,132,58,0.2)', borderRadius: '8px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <input type="text" placeholder="Texte affiché" value={insertLinkText} onChange={e => setInsertLinkText(e.target.value)}
                          style={{ flex: 1, minWidth: '100px', padding: '3px 6px', border: '1px solid rgba(184,132,58,0.2)', borderRadius: '4px', background: 'var(--card-bg)', fontFamily: 'Spectral, serif', fontSize: '12px', color: 'var(--ink)', outline: 'none' }} />
                        <input type="url" placeholder="https://..." value={insertLinkUrl} onChange={e => setInsertLinkUrl(e.target.value)}
                          style={{ flex: 2, minWidth: '140px', padding: '3px 6px', border: '1px solid rgba(184,132,58,0.2)', borderRadius: '4px', background: 'var(--card-bg)', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink)', outline: 'none' }} />
                        {insertLinkText && insertLinkUrl && (
                          <button onClick={() => {
                            const ref = `[${insertLinkText}](${insertLinkUrl})`
                            const ta = commentRef.current
                            if (ta) {
                              const start = ta.selectionStart; const end = ta.selectionEnd
                              const newText = newComment.slice(0, start) + ref + newComment.slice(end)
                              setNewComment(newText)
                              setTimeout(() => { ta.focus(); ta.setSelectionRange(start + ref.length, start + ref.length) }, 0)
                            } else { setNewComment(prev => prev + ref) }
                            setInsertMode(null); setInsertLinkText(''); setInsertLinkUrl('')
                          }} style={{ padding: '3px 10px', borderRadius: '4px', border: 'none', background: 'var(--gold)', color: 'white', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer' }}>
                            ✓ Insérer
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Barre d'action */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <button onClick={() => setInsertMode(insertMode === 'verse' ? null : 'verse')} style={{ padding: '4px 10px', borderRadius: '4px', border: `1px solid ${insertMode === 'verse' ? 'var(--blue-sacred)' : 'var(--border)'}`, background: insertMode === 'verse' ? 'var(--blue-light)' : 'transparent', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: insertMode === 'verse' ? 'var(--blue-sacred)' : 'var(--ink-muted)', cursor: 'pointer' }}>
                      📖 Verset
                    </button>
                    <button onClick={() => setInsertMode(insertMode === 'link' ? null : 'link')} style={{ padding: '4px 10px', borderRadius: '4px', border: `1px solid ${insertMode === 'link' ? 'var(--gold)' : 'var(--border)'}`, background: insertMode === 'link' ? 'var(--gold-pale)' : 'transparent', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: insertMode === 'link' ? 'var(--gold)' : 'var(--ink-muted)', cursor: 'pointer' }}>
                      🔗 Lien
                    </button>
                    <button
                      onClick={async () => {
                        if (!newComment.trim() || !activeVerse) return
                        setSubmittingComment(true)
                        try {
                          if (replyingToId) {
                            await api.post(`/api/comments/${replyingToId}/reply`, { text: newComment.trim() })
                            setReplyingToId(null)
                          } else {
                            await api.post(`/api/verses/${activeVerse.id}/comments`, { text: newComment.trim() })
                          }
                          setNewComment('')
                          setInsertMode(null)
                          onCommentAdded()
                        } catch (error) {
                          console.error(error)
                        } finally {
                          setSubmittingComment(false)
                        }
                      }}
                      disabled={submittingComment || !newComment.trim()}
                      style={{ marginLeft: 'auto', padding: '6px 18px', background: 'var(--gold)', color: 'white', border: 'none', borderRadius: '6px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase' as const, cursor: submittingComment ? 'not-allowed' : 'pointer', opacity: submittingComment || !newComment.trim() ? 0.6 : 1, flexShrink: 0 }}
                    >
                      {submittingComment ? 'Envoi…' : replyingToId ? 'Répondre' : 'Publier'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: '8px', fontFamily: 'Spectral, serif', fontSize: '14px', color: 'var(--ink-faint)', fontStyle: 'italic', textAlign: 'center', padding: '20px', border: '1px solid var(--border)', borderRadius: '8px' }}>
                  <a href="/login" style={{ color: 'var(--gold)', textDecoration: 'none' }}>Connectez-vous</a> pour participer à la discussion.
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
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              textAlign: 'center',
              gap: '16px',
            }}>
              <div style={{ fontSize: '56px', opacity: 0.2, fontFamily: 'var(--font-title)', fontWeight: '300', lineHeight: 1 }}>ג</div>
              <div style={{ fontSize: '14px', lineHeight: '1.6' }}>Cliquez sur un verset<br />pour voir les commentaires</div>
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