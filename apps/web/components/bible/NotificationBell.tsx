'use client'

import { useState, useEffect, useRef } from 'react'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { getRoleColor } from '@/lib/roleColors'

interface Proposal {
  id: string
  proposedText: string
  createdAt: string
  creator: { username: string; role: string } | null
  translation: {
    verse: {
      id: string
      number: number
      chapter: { number: number; book: { name: string; slug: string; testament: string } }
    }
  }
}

interface WordTranslation {
  id: string
  translation: string
  voteCount: number
  createdAt: string
  creator: { username: string; role: string } | null
  wordToken: {
    id: string
    word: string
    verseText: {
      verse: {
        id: string
        number: number
        chapter: { number: number; book: { name: string; slug: string; testament: string } }
      }
    }
  }
}

export default function NotificationBell() {
  const { user } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [wordTranslations, setWordTranslations] = useState<WordTranslation[]>([])
  const [personalNotifs, setPersonalNotifs] = useState<{
    id: string
    type: string
    message: string
    link: string | null
    isRead: boolean
    createdAt: string
  }[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    const saved = localStorage.getItem('notif_dismissed')
    return saved ? new Set(JSON.parse(saved)) : new Set()
  })
  const popupRef = useRef<HTMLDivElement>(null)

  const isExpertOrAdmin = user && ['EXPERT', 'ADMIN'].includes(user.role)

	function dismiss(id: string) {
		setDismissed(prev => {
			const next = new Set([...prev, id])
			localStorage.setItem('notif_dismissed', JSON.stringify([...next]))
			return next
		})
	}

	function dismissAll() {
		const allIds = [
			...proposals.map(p => `p-${p.id}`),
			...wordTranslations.map(t => `w-${t.id}`)
		]
		const next = new Set(allIds)
		localStorage.setItem('notif_dismissed', JSON.stringify([...next]))
		setDismissed(next)
	}

  async function fetchPending() {
    try {
      const personalRes = await api.get('/api/notifications')
      setPersonalNotifs(personalRes.data)
      if (isExpertOrAdmin) {
        const pendingRes = await api.get('/api/pending')
        setProposals(pendingRes.data.proposals)
        setWordTranslations(pendingRes.data.wordTranslations)
      }
    } catch (e) { console.error(e) }
  }

  useEffect(() => {
    if (!isExpertOrAdmin) return
    fetchPending()
    const interval = setInterval(fetchPending, 60000)
    return () => clearInterval(interval)
  }, [isExpertOrAdmin])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (!user) return null

  const pendingProposals = proposals
  const pendingWords = wordTranslations
  const unreadPersonal = personalNotifs.filter(n => !n.isRead).length
  const total = proposals.filter(p => !dismissed.has(`p-${p.id}`)).length + wordTranslations.filter(t => !dismissed.has(`w-${t.id}`)).length + unreadPersonal

  function getRefFromLink(link: string | null): string | null {
    if (!link) return null
    const match = link.match(/\/(at|nt)\/([^/]+)\/(\d+).*#v(\d+)/)
    if (!match) return null
    // Trouver le nom du livre depuis le slug
    const slug = match[2]
    const chapter = match[3]
    const verse = match[4]
    return `${slug} ${chapter}:${verse}`
  }

  return (
    <div ref={popupRef} style={{ position: 'relative' }}>
      <button
        onClick={() => { setOpen(!open); if (!open) fetchPending() }}
        style={{
          position: 'relative',
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.15)',
          background: open ? 'rgba(255,255,255,0.1)' : 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          color: total > 0 ? 'var(--gold-light)' : 'rgba(255,255,255,0.5)',
        }}
      >
        🔔
        {total > 0 && (
          <span style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            background: 'var(--red-soft)',
            color: 'white',
            fontFamily: 'DM Mono, monospace',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {total > 9 ? '9+' : total}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: '40px',
          right: 0,
          width: '340px',
          background: 'white',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          boxShadow: '0 8px 32px rgba(26,22,18,0.15)',
          zIndex: 1000,
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--parchment-dark)',
          }}>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--ink-muted)' }}>
              En attente ({total})
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => fetchPending()}
                style={{ padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)', background: 'transparent', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink-muted)', cursor: 'pointer' }}
              >
                ↻
              </button>
              {total > 0 && (
                <button
                  onClick={async () => {
                    dismissAll()
                    if (unreadPersonal > 0) {
                      await api.patch('/api/notifications/read-all')
                      setPersonalNotifs(prev => prev.map(n => ({ ...n, isRead: true })))
                    }
                  }}
                  style={{ padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)', background: 'transparent', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink-muted)', cursor: 'pointer' }}
                >
                  Tout lire
                </button>
              )}
            </div>
          </div>

          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {proposals.length === 0 && wordTranslations.length === 0 && personalNotifs.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', fontFamily: 'Spectral, serif', fontSize: '14px', color: 'var(--ink-faint)', fontStyle: 'italic' }}>
                Aucune notification 🎉
              </div>
            ) : (
              <>
                {/* Notifs personnelles */}
                {personalNotifs.length > 0 && (
                  <div>
                    <div style={{ padding: '8px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--ink-muted)', background: 'var(--parchment-dark)', borderBottom: '1px solid var(--border)' }}>
                      Notifications ({unreadPersonal} non lues)
                    </div>
                    {personalNotifs.slice(0, 5).map(n => (
                      <div
                        key={n.id}
                        onClick={async () => {
                          if (!n.isRead) {
                            await api.patch(`/api/notifications/${n.id}/read`)
                            setPersonalNotifs(prev => prev.map(x => x.id === n.id ? { ...x, isRead: true } : x))
                          }
                          if (n.link) { setOpen(false); window.location.href = n.link }
                        }}
                        style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', cursor: n.link ? 'pointer' : 'default', opacity: n.isRead ? 0.5 : 1, transition: 'background 0.1s', background: n.isRead ? 'transparent' : 'rgba(184,132,58,0.04)' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--parchment)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = n.isRead ? 'transparent' : 'rgba(184,132,58,0.04)'}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', padding: '1px 6px', borderRadius: '20px', background: n.type === 'PROPOSAL_ACCEPTED' ? 'var(--green-light)' : n.type === 'PROPOSAL_REJECTED' ? 'var(--red-light)' : 'var(--blue-light)', color: n.type === 'PROPOSAL_ACCEPTED' ? 'var(--green-valid)' : n.type === 'PROPOSAL_REJECTED' ? 'var(--red-soft)' : 'var(--blue-sacred)' }}>
                            {n.type === 'PROPOSAL_ACCEPTED' ? '✓ Acceptée' : n.type === 'PROPOSAL_REJECTED' ? '✕ Rejetée' : '↩ Réponse'}
                          </span>
                          {getRefFromLink(n.link) && (
                            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--gold)' }}>
                              {getRefFromLink(n.link)}
                            </span>
                          )}
                        </div>
                        <div style={{ fontFamily: 'Spectral, serif', fontSize: '12px', color: 'var(--ink-soft)', marginTop: '4px', lineHeight: '1.4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                          {n.message}
                        </div>
                        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink-faint)', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {new Date(n.createdAt).toLocaleDateString('fr-FR')}
                          {!n.isRead && <span style={{ color: 'var(--gold)' }}>● non lu</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Propositions */}
                {proposals.length > 0 && (
                  <div>
                    <div style={{ padding: '8px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--amber-pending)', background: 'var(--amber-light)', borderBottom: '1px solid var(--border)' }}>
                      Propositions de reformulation ({pendingProposals.length})
                    </div>
                    {pendingProposals.map(p => {
                      const verse = p.translation.verse
                      const url = `/${verse.chapter.book.testament === 'AT' ? 'at' : 'nt'}/${verse.chapter.book.slug}/${verse.chapter.number}?verse=${verse.id}&tab=verse#v${verse.number}`
                      return (
                        <div key={p.id} onClick={() => { dismiss(`p-${p.id}`); setOpen(false); window.location.href = url }} style={{ textDecoration: 'none', display: 'block', cursor: 'pointer', opacity: dismissed.has(`p-${p.id}`) ? 0.4 : 1 }}>
  												<div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--parchment)'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink-muted)' }}>
                                {verse.chapter.book.name} {verse.chapter.number}:{verse.number}
                              </span>
                              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink-faint)' }}>
                                {new Date(p.createdAt).toLocaleDateString('fr-FR')}
                              </span>
                            </div>
                            <div style={{ fontFamily: 'Spectral, serif', fontSize: '12px', fontStyle: 'italic', color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, marginBottom: '3px' }}>
                              {p.proposedText}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
															<div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: p.creator ? getRoleColor(p.creator.role) : 'var(--ink-muted)' }}>
																@{p.creator?.username || 'anonyme'}
															</div>
															<button
																onClick={e => { e.stopPropagation(); if (dismissed.has(`p-${p.id}`)) { setDismissed(prev => { const next = new Set(prev); next.delete(`p-${p.id}`); localStorage.setItem('notif_dismissed', JSON.stringify([...next])); return next }) } else { dismiss(`p-${p.id}`) } }}
																style={{ padding: '1px 6px', borderRadius: '4px', border: `1px solid ${dismissed.has(`p-${p.id}`) ? 'var(--green-valid)' : 'var(--border)'}`, background: dismissed.has(`p-${p.id}`) ? 'var(--green-light)' : 'transparent', fontFamily: 'DM Mono, monospace', fontSize: '10px', color: dismissed.has(`p-${p.id}`) ? 'var(--green-valid)' : 'var(--ink-faint)', cursor: 'pointer' }}
															>
																{dismissed.has(`p-${p.id}`) ? '✓ Lu' : 'Marquer lu'}
															</button>
														</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Traductions de mots */}
                {wordTranslations.length > 0 && (
                  <div>
                    <div style={{ padding: '8px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--blue-sacred)', background: 'var(--blue-light)', borderBottom: '1px solid var(--border)' }}>
                      Traductions de mots ({pendingWords.length})
                    </div>
                    {pendingWords.map(t => {
                      const verse = t.wordToken.verseText.verse
                      const url = `/${verse.chapter.book.testament === 'AT' ? 'at' : 'nt'}/${verse.chapter.book.slug}/${verse.chapter.number}?word=${t.wordToken.id}&tab=word#v${verse.number}`
                      return (
                        <div key={t.id} onClick={() => { dismiss(`w-${t.id}`); setOpen(false); window.location.href = url }} style={{ textDecoration: 'none', display: 'block', cursor: 'pointer', opacity: dismissed.has(`w-${t.id}`) ? 0.4 : 1 }}>
                          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--parchment)'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink-muted)' }}>
                                {verse.chapter.book.name} {verse.chapter.number}:{verse.number} · {t.wordToken.word}
                              </span>
                              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink-faint)' }}>
                                {t.voteCount} vote{t.voteCount !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <div style={{ fontFamily: 'Spectral, serif', fontSize: '12px', fontStyle: 'italic', color: 'var(--ink-soft)', marginBottom: '3px' }}>
                              {t.translation}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
															<div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: t.creator ? getRoleColor(t.creator.role) : 'var(--ink-muted)' }}>
																@{t.creator?.username || 'anonyme'}
															</div>
															<button
																onClick={e => { e.stopPropagation(); if (dismissed.has(`w-${t.id}`)) { setDismissed(prev => { const next = new Set(prev); next.delete(`w-${t.id}`); localStorage.setItem('notif_dismissed', JSON.stringify([...next])); return next }) } else { dismiss(`w-${t.id}`) } }}
																style={{ padding: '1px 6px', borderRadius: '4px', border: `1px solid ${dismissed.has(`w-${t.id}`) ? 'var(--green-valid)' : 'var(--border)'}`, background: dismissed.has(`w-${t.id}`) ? 'var(--green-light)' : 'transparent', fontFamily: 'DM Mono, monospace', fontSize: '10px', color: dismissed.has(`w-${t.id}`) ? 'var(--green-valid)' : 'var(--ink-faint)', cursor: 'pointer' }}
															>
																{dismissed.has(`w-${t.id}`) ? '✓ Lu' : 'Marquer lu'}
															</button>
														</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}