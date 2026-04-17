'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { getRoleColor } from '@/lib/roleColors'
import TopBar from '@/components/bible/TopBar'

interface Book {
  name: string
  slug: string
  testament: string
}

interface PendingProposal {
  id: string
  proposedText: string
  reason: string | null
  createdAt: string
  createdBy: string | null
  creator: { username: string; role: string } | null
  votes: { id: string; userId: string; value: number }[]
  _count: { comments: number }
  translation: {
    id: string
    verse: {
      id: string
      number: number
      chapter: {
        number: number
        book: Book
      }
    }
  }
}

interface PendingWord {
  id: string
  translation: string
  createdAt: string
  createdBy: string | null
  creator: { username: string; role: string } | null
  wordToken: {
    id: string
    word: string
    lemma: string | null
    verseText: {
      verse: {
        id: string
        number: number
        chapter: {
          number: number
          book: Book
        }
      }
    }
  }
}

export default function ReviewPage() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [tab, setTab] = useState<'proposals' | 'words'>('proposals')
  const [proposals, setProposals] = useState<PendingProposal[]>([])
  const [proposalCursor, setProposalCursor] = useState<string | null>(null)
  const [proposalTotal, setProposalTotal] = useState(0)
  const [words, setWords] = useState<PendingWord[]>([])
  const [wordCursor, setWordCursor] = useState<string | null>(null)
  const [wordTotal, setWordTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [voteThresholds, setVoteThresholds] = useState({ accept: 5, reject: -3 })
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [actioning, setActioning] = useState<Set<string>>(new Set())

  useEffect(() => {
    const token = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')
    if (token && savedUser) {
      useAuthStore.getState().setToken(token)
      useAuthStore.getState().setUser(JSON.parse(savedUser))
    }
  }, [])

  useEffect(() => {
    if (!user) return
    if (!['EXPERT', 'ADMIN'].includes(user.role)) {
      router.replace('/')
    }
  }, [user, router])

  useEffect(() => {
    api.get('/api/settings').then(res => {
      setVoteThresholds({ accept: res.data.vote_threshold_accept, reject: res.data.vote_threshold_reject })
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!user || !['EXPERT', 'ADMIN'].includes(user.role)) return
    setLoading(true)
    Promise.all([
      api.get('/api/review/proposals'),
      api.get('/api/review/words'),
    ]).then(([r1, r2]) => {
      setProposals(r1.data.proposals)
      setProposalCursor(r1.data.nextCursor)
      setProposalTotal(r1.data.total)
      setWords(r2.data.words)
      setWordCursor(r2.data.nextCursor)
      setWordTotal(r2.data.total)
    }).catch(console.error).finally(() => setLoading(false))
  }, [user])

  const timeAgo = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (diff < 60) return 'à l\'instant'
    if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`
    if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`
    const days = Math.floor(diff / 86400)
    if (days < 30) return `il y a ${days} j`
    return new Date(dateStr).toLocaleDateString('fr-FR')
  }

  const verseUrl = (verse: { id: string; number: number; chapter: { number: number; book: Book } }) => {
    const { book, number: chapterNum } = verse.chapter
    const prefix = book.testament === 'AT' ? 'at' : 'nt'
    return `/${prefix}/${book.slug}/${chapterNum}?verse=${verse.id}&tab=verse#v${verse.number}`
  }

  const verseLabel = (verse: { number: number; chapter: { number: number; book: Book } }) =>
    `${verse.chapter.book.name} ${verse.chapter.number}:${verse.number}`

  const setAction = (id: string) => setActioning(prev => new Set([...prev, id]))
  const clearAction = (id: string) => setActioning(prev => { const s = new Set(prev); s.delete(id); return s })

  const loadMoreProposals = async () => {
    if (!proposalCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const res = await api.get('/api/review/proposals', { params: { cursor: proposalCursor } })
      setProposals(prev => [...prev, ...res.data.proposals])
      setProposalCursor(res.data.nextCursor)
    } catch (e) { console.error(e) } finally { setLoadingMore(false) }
  }

  const loadMoreWords = async () => {
    if (!wordCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const res = await api.get('/api/review/words', { params: { cursor: wordCursor } })
      setWords(prev => [...prev, ...res.data.words])
      setWordCursor(res.data.nextCursor)
    } catch (e) { console.error(e) } finally { setLoadingMore(false) }
  }

  // ── Proposal actions ──────────────────────────────────────────────────────

  const handleVote = async (p: PendingProposal, value: number) => {
    setAction(p.id)
    try {
      const res = await api.post(`/api/proposals/${p.id}/vote`, { value })
      setProposals(prev => prev.map(x => {
        if (x.id !== p.id) return x
        // Retirer si changé de statut (accepté/rejeté automatiquement)
        if (res.data.status !== 'PENDING') return null as unknown as PendingProposal
        // Mettre à jour les votes localement
        const existingVoteIdx = x.votes.findIndex(v => v.userId === user!.id)
        let newVotes = [...x.votes]
        if (existingVoteIdx >= 0) {
          if (x.votes[existingVoteIdx].value === value) {
            // Toggle off
            newVotes = newVotes.filter((_, i) => i !== existingVoteIdx)
          } else {
            newVotes[existingVoteIdx] = { ...newVotes[existingVoteIdx], value }
          }
        } else {
          newVotes.push({ id: 'optimistic', userId: user!.id, value })
        }
        return { ...x, votes: newVotes }
      }).filter(Boolean))
    } catch (e) { console.error(e) } finally { clearAction(p.id) }
  }

  const handleAccept = async (id: string) => {
    setAction(id)
    try {
      await api.patch(`/api/proposals/${id}/accept`)
      setProposals(prev => prev.filter(x => x.id !== id))
    } catch (e) { console.error(e) } finally { clearAction(id) }
  }

  const handleReject = async (id: string) => {
    setAction(id)
    try {
      await api.patch(`/api/proposals/${id}/reject`, { reason: rejectReason.trim() || undefined })
      setProposals(prev => prev.filter(x => x.id !== id))
      setRejectingId(null)
      setRejectReason('')
    } catch (e) { console.error(e) } finally { clearAction(id) }
  }

  const handleDeleteProposal = async (id: string) => {
    setAction(id)
    try {
      await api.delete(`/api/proposals/${id}`)
      setProposals(prev => prev.filter(x => x.id !== id))
    } catch (e) { console.error(e) } finally { clearAction(id) }
  }

  // ── Word actions ──────────────────────────────────────────────────────────

  const handleValidateWord = async (id: string) => {
    setAction(id)
    try {
      await api.patch(`/api/word-translations/${id}/validate`)
      setWords(prev => prev.filter(x => x.id !== id))
    } catch (e) { console.error(e) } finally { clearAction(id) }
  }

  const handleDeleteWord = async (id: string) => {
    setAction(id)
    try {
      await api.delete(`/api/word-translations/${id}`)
      setWords(prev => prev.filter(x => x.id !== id))
    } catch (e) { console.error(e) } finally { clearAction(id) }
  }

  if (!user || !['EXPERT', 'ADMIN'].includes(user.role)) return null

  const cardStyle: React.CSSProperties = {
    background: 'var(--card-bg)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    overflow: 'hidden',
    marginBottom: '10px',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <TopBar showSearch={false} showTestaments={true} />

      <div style={{ maxWidth: '760px', margin: '0 auto', width: '100%', padding: '32px 16px' }}>

        {/* En-tête */}
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{
            fontFamily: 'Crimson Pro, serif',
            fontSize: '26px',
            fontWeight: '300',
            color: 'var(--ink)',
            margin: '0 0 6px',
            letterSpacing: '0.02em',
          }}>
            En attente
          </h1>
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: 'var(--ink-faint)', margin: 0 }}>
            Contributions en attente de validation
          </p>
        </div>

        {/* Onglets */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '0' }}>
          {(['proposals', 'words'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '8px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${tab === t ? 'var(--gold)' : 'transparent'}`,
                cursor: 'pointer',
                fontFamily: 'DM Mono, monospace',
                fontSize: '12px',
                color: tab === t ? 'var(--gold)' : 'var(--ink-faint)',
                transition: 'color 0.15s',
                marginBottom: '-1px',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
              }}
            >
              {t === 'proposals' ? 'Propositions' : 'Mots'}
              {!loading && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  minWidth: '20px', height: '18px', padding: '0 5px',
                  borderRadius: '9px',
                  background: t === 'proposals'
                    ? (proposalTotal > 0 ? 'var(--amber-light)' : 'var(--parchment-dark)')
                    : (wordTotal > 0 ? 'var(--blue-light)' : 'var(--parchment-dark)'),
                  color: t === 'proposals'
                    ? (proposalTotal > 0 ? 'var(--amber-pending)' : 'var(--ink-faint)')
                    : (wordTotal > 0 ? 'var(--blue-sacred)' : 'var(--ink-faint)'),
                  fontSize: '10px',
                }}>
                  {t === 'proposals' ? proposalTotal : wordTotal}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', fontFamily: 'DM Mono, monospace', fontSize: '12px', color: 'var(--ink-faint)' }}>
            Chargement…
          </div>
        ) : (

          // ── Onglet Propositions ──────────────────────────────────────────────
          tab === 'proposals' ? (
            proposals.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '60px 0',
                fontFamily: 'Spectral, serif', fontSize: '15px',
                color: 'var(--ink-faint)', fontStyle: 'italic',
              }}>
                Aucune proposition en attente. ✓
              </div>
            ) : (
              <div>
                {proposals.map(p => {
                  const upvotes = p.votes.filter(v => v.value > 0).length
                  const downvotes = p.votes.filter(v => v.value < 0).length
                  const netScore = p.votes.reduce((s, v) => s + v.value, 0)
                  const userVote = user ? (p.votes.find(v => v.userId === user.id)?.value ?? 0) : 0
                  const isActioning = actioning.has(p.id)
                  const verse = p.translation.verse
                  const isRejectOpen = rejectingId === p.id

                  return (
                    <div key={p.id} style={cardStyle}>

                      {/* En-tête */}
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        flexWrap: 'wrap', gap: '6px',
                        padding: '9px 14px',
                        background: 'var(--parchment-dark)',
                        borderBottom: '1px solid var(--border)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          {/* Lien verset */}
                          <Link href={verseUrl(verse)} style={{
                            fontFamily: 'DM Mono, monospace', fontSize: '11px',
                            color: 'var(--gold)', textDecoration: 'none',
                            padding: '2px 8px', borderRadius: '20px',
                            background: 'var(--gold-pale)',
                            border: '1px solid rgba(184,132,58,0.25)',
                            whiteSpace: 'nowrap',
                            transition: 'opacity 0.15s',
                          }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.75'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                          >
                            ↗ {verseLabel(verse)}
                          </Link>
                          <Link href={p.creator ? `/profile/${p.creator.username}` : '#'} style={{
                            fontFamily: 'DM Mono, monospace', fontSize: '11px',
                            color: p.creator ? getRoleColor(p.creator.role) : 'var(--ink-muted)',
                            textDecoration: 'none',
                          }}>
                            @{p.creator?.username || 'anonyme'}
                          </Link>
                          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--ink-faint)' }}>
                            · {timeAgo(p.createdAt)}
                          </span>
                        </div>

                        {/* Supprimer */}
                        {user.role === 'ADMIN' && (
                          <button
                            disabled={isActioning}
                            onClick={() => handleDeleteProposal(p.id)}
                            style={{
                              padding: '2px 6px', borderRadius: '4px',
                              border: '1px solid rgba(122,42,42,0.2)', background: 'transparent',
                              cursor: 'pointer', fontFamily: 'DM Mono, monospace',
                              fontSize: '12px', color: 'var(--red-soft)', opacity: isActioning ? 0.4 : 0.7,
                              transition: 'opacity 0.15s',
                            }}
                            title="Supprimer"
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = isActioning ? '0.4' : '0.7'}
                          >✕</button>
                        )}
                      </div>

                      {/* Texte proposé */}
                      <div style={{ padding: '12px 14px 0' }}>
                        <div style={{
                          fontFamily: 'Spectral, serif', fontSize: '14px', fontStyle: 'italic',
                          color: 'var(--ink)', lineHeight: '1.8',
                        }}>
                          {p.proposedText}
                        </div>
                        {p.reason && (
                          <div style={{
                            marginTop: '8px', padding: '5px 10px', borderRadius: '5px',
                            background: 'var(--parchment-dark)', borderLeft: '2px solid var(--gold)',
                            fontFamily: 'DM Mono, monospace', fontSize: '11px',
                            color: 'var(--ink-muted)', fontStyle: 'italic',
                          }}>
                            « {p.reason} »
                          </div>
                        )}
                      </div>

                      {/* Pied : votes + actions admin */}
                      <div style={{ padding: '10px 14px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>

                          {/* Boutons de vote */}
                          <button
                            disabled={isActioning}
                            onClick={() => handleVote(p, 1)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '3px',
                              padding: '3px 9px', borderRadius: '5px', cursor: isActioning ? 'default' : 'pointer',
                              fontFamily: 'DM Mono, monospace', fontSize: '12px', whiteSpace: 'nowrap',
                              border: `1px solid ${userVote === 1 ? 'var(--gold)' : 'var(--border)'}`,
                              background: userVote === 1 ? 'var(--gold-pale)' : 'transparent',
                              color: userVote === 1 ? 'var(--gold)' : 'var(--ink-soft)',
                              opacity: isActioning ? 0.5 : 1,
                              transition: 'all 0.15s',
                            }}
                          >▲ Pour</button>

                          <button
                            disabled={isActioning}
                            onClick={() => handleVote(p, -1)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '3px',
                              padding: '3px 9px', borderRadius: '5px', cursor: isActioning ? 'default' : 'pointer',
                              fontFamily: 'DM Mono, monospace', fontSize: '12px', whiteSpace: 'nowrap',
                              border: `1px solid ${userVote === -1 ? 'rgba(122,42,42,0.5)' : 'var(--border)'}`,
                              background: userVote === -1 ? 'var(--red-light)' : 'transparent',
                              color: userVote === -1 ? 'var(--red-soft)' : 'var(--ink-soft)',
                              opacity: isActioning ? 0.5 : 1,
                              transition: 'all 0.15s',
                            }}
                          >▼ Contre</button>

                          {/* Score */}
                          <span style={{
                            fontFamily: 'DM Mono, monospace', fontSize: '10px', whiteSpace: 'nowrap',
                          }}>
                            <span style={{ color: upvotes >= voteThresholds.accept ? 'var(--green-valid)' : 'var(--ink-faint)' }}>
                              +{upvotes}/{voteThresholds.accept} acc.
                            </span>
                            <span style={{ color: 'var(--ink-faint)', margin: '0 3px' }}>·</span>
                            <span style={{ color: downvotes >= Math.abs(voteThresholds.reject) ? 'var(--red-soft)' : 'var(--ink-faint)' }}>
                              -{downvotes}/{voteThresholds.reject} rej.
                            </span>
                          </span>

                          {/* Commentaires */}
                          {p._count.comments > 0 && (
                            <Link href={verseUrl(verse)} style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              fontFamily: 'DM Mono, monospace', fontSize: '10px',
                              color: 'var(--blue-sacred)', textDecoration: 'none',
                              marginLeft: 'auto',
                            }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                              </svg>
                              {p._count.comments}
                            </Link>
                          )}

                          {/* Actions admin */}
                          {user.role === 'ADMIN' && (
                            <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                              <button
                                disabled={isActioning}
                                onClick={() => handleAccept(p.id)}
                                style={{
                                  padding: '4px 12px', borderRadius: '5px', cursor: isActioning ? 'default' : 'pointer',
                                  border: '1px solid rgba(45,90,58,0.35)', background: 'var(--green-light)',
                                  fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--green-valid)',
                                  opacity: isActioning ? 0.5 : 1, transition: 'opacity 0.15s',
                                }}
                              >✓ Accepter</button>
                              <button
                                disabled={isActioning}
                                onClick={() => {
                                  if (rejectingId === p.id) {
                                    setRejectingId(null); setRejectReason('')
                                  } else {
                                    setRejectingId(p.id); setRejectReason('')
                                  }
                                }}
                                style={{
                                  padding: '4px 12px', borderRadius: '5px', cursor: isActioning ? 'default' : 'pointer',
                                  border: `1px solid ${isRejectOpen ? 'rgba(122,42,42,0.5)' : 'rgba(122,42,42,0.2)'}`,
                                  background: isRejectOpen ? 'var(--red-light)' : 'transparent',
                                  fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--red-soft)',
                                  opacity: isActioning ? 0.5 : 1, transition: 'all 0.15s',
                                }}
                              >✕ Rejeter</button>
                            </div>
                          )}
                        </div>

                        {/* Formulaire raison de rejet */}
                        {isRejectOpen && (
                          <div style={{ display: 'flex', gap: '6px', marginTop: '10px', alignItems: 'center' }}>
                            <input
                              type="text"
                              placeholder="Raison du rejet (obligatoire)"
                              value={rejectReason}
                              onChange={e => setRejectReason(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter' && rejectReason.trim()) handleReject(p.id) }}
                              style={{
                                flex: 1, padding: '6px 10px',
                                border: `1px solid ${rejectReason.trim() ? 'rgba(122,42,42,0.4)' : 'var(--border)'}`, borderRadius: '6px',
                                background: 'var(--parchment)', fontFamily: 'DM Mono, monospace',
                                fontSize: '12px', color: 'var(--ink)', outline: 'none',
                                transition: 'border-color 0.15s',
                              }}
                              autoFocus
                            />
                            <button
                              disabled={isActioning || !rejectReason.trim()}
                              onClick={() => handleReject(p.id)}
                              style={{
                                padding: '6px 14px', borderRadius: '5px',
                                cursor: isActioning || !rejectReason.trim() ? 'not-allowed' : 'pointer',
                                background: rejectReason.trim() ? 'var(--red-light)' : 'transparent',
                                border: '1px solid rgba(122,42,42,0.4)',
                                fontFamily: 'DM Mono, monospace', fontSize: '12px', color: 'var(--red-soft)',
                                opacity: isActioning || !rejectReason.trim() ? 0.45 : 1,
                                transition: 'all 0.15s', whiteSpace: 'nowrap',
                              }}
                            >Confirmer</button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
                {proposalCursor && (
                  <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <button
                      onClick={loadMoreProposals}
                      disabled={loadingMore}
                      style={{ padding: '7px 20px', borderRadius: '20px', border: '1px solid var(--border)', background: 'transparent', cursor: loadingMore ? 'default' : 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '12px', color: 'var(--ink-muted)', opacity: loadingMore ? 0.5 : 1 }}
                    >
                      {loadingMore ? 'Chargement…' : `Charger plus (${proposalTotal - proposals.length} restantes)`}
                    </button>
                  </div>
                )}
              </div>
            )
          ) : (

            // ── Onglet Mots ──────────────────────────────────────────────────
            words.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '60px 0',
                fontFamily: 'Spectral, serif', fontSize: '15px',
                color: 'var(--ink-faint)', fontStyle: 'italic',
              }}>
                Aucune traduction de mot en attente. ✓
              </div>
            ) : (
              <div>
                {words.map(w => {
                  const isActioning = actioning.has(w.id)
                  const verse = w.wordToken.verseText.verse

                  return (
                    <div key={w.id} style={cardStyle}>
                      <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>

                        {/* Colonne gauche : mot source */}
                        <div style={{ flexShrink: 0, minWidth: '80px' }}>
                          <div style={{
                            fontFamily: 'DM Mono, monospace', fontSize: '16px',
                            color: 'var(--ink)', direction: 'rtl',
                            marginBottom: '3px',
                          }}>
                            {w.wordToken.word}
                          </div>
                          {w.wordToken.lemma && (
                            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--ink-faint)' }}>
                              {w.wordToken.lemma}
                            </div>
                          )}
                        </div>

                        {/* Flèche */}
                        <div style={{ color: 'var(--ink-faint)', fontSize: '16px', paddingTop: '2px', flexShrink: 0 }}>→</div>

                        {/* Traduction proposée */}
                        <div style={{ flex: 1, minWidth: '120px' }}>
                          <div style={{
                            fontFamily: 'Spectral, serif', fontSize: '15px', fontStyle: 'italic',
                            color: 'var(--ink)', marginBottom: '5px',
                          }}>
                            {w.translation}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <Link href={`/${verse.chapter.book.testament === 'AT' ? 'at' : 'nt'}/${verse.chapter.book.slug}/${verse.chapter.number}?word=${w.wordToken.id}&tab=word#v${verse.number}`} style={{
                              fontFamily: 'DM Mono, monospace', fontSize: '10px',
                              color: 'var(--gold)', textDecoration: 'none',
                              padding: '1px 7px', borderRadius: '20px',
                              background: 'var(--gold-pale)',
                              border: '1px solid rgba(184,132,58,0.2)',
                              whiteSpace: 'nowrap',
                            }}>
                              ↗ {verseLabel(verse)}
                            </Link>
                            <Link href={w.creator ? `/profile/${w.creator.username}` : '#'} style={{
                              fontFamily: 'DM Mono, monospace', fontSize: '10px',
                              color: w.creator ? getRoleColor(w.creator.role) : 'var(--ink-muted)',
                              textDecoration: 'none',
                            }}>
                              @{w.creator?.username || 'anonyme'}
                            </Link>
                            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--ink-faint)' }}>
                              · {timeAgo(w.createdAt)}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                          {user.role === 'ADMIN' && (
                            <>
                              <button
                                disabled={isActioning}
                                onClick={() => handleValidateWord(w.id)}
                                style={{
                                  padding: '4px 12px', borderRadius: '5px', cursor: isActioning ? 'default' : 'pointer',
                                  border: '1px solid rgba(45,90,58,0.35)', background: 'var(--green-light)',
                                  fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--green-valid)',
                                  opacity: isActioning ? 0.5 : 1, whiteSpace: 'nowrap',
                                }}
                              >✓ Valider</button>
                              <button
                                disabled={isActioning}
                                onClick={() => handleDeleteWord(w.id)}
                                style={{
                                  padding: '4px 8px', borderRadius: '5px', cursor: isActioning ? 'default' : 'pointer',
                                  border: '1px solid rgba(122,42,42,0.2)', background: 'transparent',
                                  fontFamily: 'DM Mono, monospace', fontSize: '12px', color: 'var(--red-soft)',
                                  opacity: isActioning ? 0.4 : 0.7, transition: 'opacity 0.15s',
                                }}
                                onMouseEnter={e => !isActioning && ((e.currentTarget as HTMLElement).style.opacity = '1')}
                                onMouseLeave={e => !isActioning && ((e.currentTarget as HTMLElement).style.opacity = '0.7')}
                                title="Supprimer"
                              >✕</button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
                {wordCursor && (
                  <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <button
                      onClick={loadMoreWords}
                      disabled={loadingMore}
                      style={{ padding: '7px 20px', borderRadius: '20px', border: '1px solid var(--border)', background: 'transparent', cursor: loadingMore ? 'default' : 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '12px', color: 'var(--ink-muted)', opacity: loadingMore ? 0.5 : 1 }}
                    >
                      {loadingMore ? 'Chargement…' : `Charger plus (${wordTotal - words.length} restants)`}
                    </button>
                  </div>
                )}
              </div>
            )
          )
        )}
      </div>
    </div>
  )
}
