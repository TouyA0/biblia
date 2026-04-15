'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import CommentText from '@/components/bible/CommentText'
import { getRoleColor, getRoleBackground, getRoleBorder } from '@/lib/roleColors'
import TopBar from '@/components/bible/TopBar'
import React from 'react'
import { BOOK_NAME_TO_SLUG } from '@/lib/bookSlugs'

interface Stats {
  users: number
  books: number
  verses: number
  wordTranslations: number
  proposals: number
  comments: number
  usersByRole: { role: string; _count: { role: number } }[]
  recentUsers: { id: string; username: string; role: string; createdAt: string }[]
  recentProposals: {
    id: string
    proposedText: string
    status: string
    createdAt: string
    creator: { username: string; role: string } | null
    translation: {
      verse: {
        id: string
        number: number
        chapter: { number: number; book: { name: string; slug: string; testament: string } }
      }
    }
  }[]
  recentWordTranslations: {
    id: string
    translation: string
    isValidated: boolean
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
  }[]
  recentComments: {
    id: string
    text: string
    createdAt: string
    creator: { username: string; role: string } | null
    verse: {
      id: string
      number: number
      chapter: { number: number; book: { name: string; slug: string; testament: string } }
    } | null
  }[]
}

interface User {
  id: string
  email: string
  username: string
  role: string
  createdAt: string
  isActive: boolean
  forcePasswordReset: boolean
  _count: {
    wordTranslations: number
    proposals: number
    comments: number
  }
}

const ROLES = ['VISITOR', 'NOVICE', 'INTERMEDIATE', 'EXPERT', 'ADMIN']

export default function AdminPage() {
  const router = useRouter()
  const { user, setUser, setToken } = useAuthStore()
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'contributions' | 'logs'>('stats')
  const [search, setSearch] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const [roleFilter, setRoleFilter] = useState<string>('ALL')
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Onglet contributions
  const [contribTestament, setContribTestament] = useState<'ALL' | 'AT' | 'NT'>('ALL')
  const [contribBook, setContribBook] = useState('')
  const [contribChapter, setContribChapter] = useState('')
  const [contribVerse, setContribVerse] = useState('')
  const [contribData, setContribData] = useState<{
    wordTranslations: {
      id: string
      translation: string
      isValidated: boolean
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
    }[]
    proposals: {
      id: string
      proposedText: string
      status: string
      reason: string | null
      createdAt: string
      creator: { username: string; role: string } | null
      reviewer: { username: string; role: string } | null
      translation: {
        verse: {
          id: string
          number: number
          chapter: { number: number; book: { name: string; slug: string; testament: string } }
        }
      }
    }[]
    comments: {
      id: string
      text: string
      createdAt: string
      creator: { username: string; role: string } | null
      verse: {
        id: string
        number: number
        chapter: { number: number; book: { name: string; slug: string; testament: string } }
      } | null
    }[]
  } | null>(null)
  const [contribLoading, setContribLoading] = useState(false)

  const [verseHistory, setVerseHistory] = useState<{
    id: string
    textFr: string
    isActive: boolean
    isReference: boolean
    source: string | null
    createdAt: string
    proposals: {
      id: string
      proposedText: string
      status: string
      reason: string | null
      createdAt: string
      creator: { username: string; role: string } | null
      reviewer: { username: string; role: string } | null
    }[]
  }[]>([])
  const [verseHistoryLoading, setVerseHistoryLoading] = useState(false)

  function exportUsersCSV() {
    const rows: string[] = []
    rows.push('Username,Email,Rôle,Inscription,Traductions,Propositions,Commentaires,Actif')
    filteredUsers.forEach(u => {
      rows.push([
        u.username,
        u.email,
        u.role,
        new Date(u.createdAt).toLocaleDateString('fr-FR'),
        u._count.wordTranslations,
        u._count.proposals,
        u._count.comments,
        u.isActive ? 'Oui' : 'Non',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    })
    const csv = rows.join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `biblia-utilisateurs-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportCSV() {
    if (!contribData) return

    const rows: string[] = []
    
    // Header
    rows.push('Type,Livre,Chapitre,Verset,Contenu,Statut,Auteur,Date')

    // Traductions de mots
    contribData.wordTranslations.forEach(t => {
      const verse = t.wordToken.verseText.verse
      rows.push([
        'Traduction de mot',
        verse.chapter.book.name,
        verse.chapter.number,
        verse.number,
        `${t.wordToken.word} → ${t.translation}`,
        t.isValidated ? 'Validée' : 'Proposée',
        t.creator?.username || 'anonyme',
        new Date(t.createdAt).toLocaleDateString('fr-FR'),
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    })

    // Propositions
    contribData.proposals.forEach(p => {
      const verse = p.translation.verse
      rows.push([
        'Reformulation de verset',
        verse.chapter.book.name,
        verse.chapter.number,
        verse.number,
        p.proposedText,
        p.status === 'ACCEPTED' ? 'Acceptée' : p.status === 'REJECTED' ? 'Rejetée' : 'En attente',
        p.creator?.username || 'anonyme',
        new Date(p.createdAt).toLocaleDateString('fr-FR'),
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    })

    // Commentaires
    contribData.comments.forEach(c => {
      const verse = c.verse
      rows.push([
        'Commentaire',
        verse?.chapter.book.name || '',
        verse?.chapter.number || '',
        verse?.number || '',
        c.text,
        '',
        c.creator?.username || 'anonyme',
        new Date(c.createdAt).toLocaleDateString('fr-FR'),
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    })

    const csv = rows.join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const filterLabel = contribBook ? `${contribBook}-ch${contribChapter || 'all'}` : contribTestament !== 'ALL' ? contribTestament : 'all'
    a.download = `biblia-contributions-${filterLabel}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function loadContributions(testament: string, book: string, chapter: string, verse: string) {
    setContribLoading(true)
    try {
      const params = new URLSearchParams()
      if (testament !== 'ALL') params.set('testament', testament)
      if (book) params.set('book', BOOK_NAME_TO_SLUG[book])
      if (chapter) params.set('chapter', chapter)
      if (verse) params.set('verse', verse)
      const res = await api.get(`/api/admin/contributions?${params.toString()}`)
      setContribData(res.data)
      if (verse && chapter && book) {
        setVerseHistoryLoading(true)
        try {
          const histRes = await api.get(`/api/admin/verse-history?book=${BOOK_NAME_TO_SLUG[book]}&chapter=${chapter}&verse=${verse}`)
          setVerseHistory(histRes.data)
        } catch (e) { console.error(e) }
        finally { setVerseHistoryLoading(false) }
      } else {
        setVerseHistory([])
      }
    } catch (e) { console.error(e) }
    finally { setContribLoading(false) }
  }

  const [logSearch, setLogSearch] = useState('')
  const [logActionFilter, setLogActionFilter] = useState<string>('ADMIN')
  const [logPage, setLogPage] = useState(1)
  const LOG_PAGE_SIZE = 20
  
  const [evolution, setEvolution] = useState<{
    label: string
    wordTranslations: number
    proposals: number
    comments: number
    total: number
  }[]>([])
  
  const [adminLogs, setAdminLogs] = useState<{
    id: string
    action: string
    userId: string | null
    metadata: Record<string, string> | null
    ip: string | null
    createdAt: string
    user: { username: string; role: string } | null
  }[]>([])

  useEffect(() => {
    const token = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')
    if (!token || !savedUser) { router.push('/login'); return }
    const u = JSON.parse(savedUser)
    if (u.role !== 'ADMIN') { router.push('/'); return }
    setToken(token)
    setUser(u)
    loadData()
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function loadData() {
    try {
      const [statsRes, usersRes, logsRes] = await Promise.all([
        api.get('/api/admin/stats'),
        api.get('/api/admin/users'),
        api.get('/api/admin/logs'),
      ])
      const evolutionRes = await api.get('/api/admin/stats/evolution')
      setEvolution(evolutionRes.data)
      setStats(statsRes.data)
      setUsers(usersRes.data)
      setAdminLogs(logsRes.data)
    } catch (error) {
      console.error(error)
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    setUpdatingRole(userId)
    try {
      await api.patch(`/api/admin/users/${userId}/role`, { role: newRole })
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
    } catch (error) {
      console.error(error)
    } finally {
      setUpdatingRole(null)
    }
  }

  const filteredUsers = users.filter(u => {
    const matchSearch = u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === 'ALL' 
      || (roleFilter === 'DISABLED' ? !u.isActive : u.role === roleFilter && u.isActive)
    return matchSearch && matchRole
  })

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
    }}>
      Chargement...
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--parchment)' }}>
      <TopBar showSearch={false} />

      <div className="page-content-wide">
        <div style={{
          fontFamily: 'Crimson Pro, serif',
          fontSize: 'clamp(24px, 5vw, 32px)',
          fontWeight: '300',
          color: 'var(--ink)',
          marginBottom: '32px',
        }}>
          Tableau de bord
        </div>

        {/* Onglets */}
        <div className="tabs-scroll">
          {([
            { key: 'stats', label: 'Statistiques' },
            { key: 'users', label: `Utilisateurs (${users.length})` },
            { key: 'contributions', label: 'Contributions' },
            { key: 'logs', label: 'Logs' },
          ] as const).map(tab => (
            <div
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key)
                if (tab.key === 'contributions' && !contribData) {
                  loadContributions('ALL', '', '', '')
                }
              }}
              style={{
                padding: '12px 20px',
                fontFamily: 'DM Mono, monospace',
                fontSize: '12px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase' as const,
                color: activeTab === tab.key ? 'var(--gold)' : 'var(--ink-muted)',
                cursor: 'pointer',
                borderBottom: activeTab === tab.key ? '2px solid var(--gold)' : '2px solid transparent',
                marginBottom: '-1px',
                whiteSpace: 'nowrap' as const,
                flexShrink: 0,
              }}
            >
              {tab.label}
            </div>
          ))}
        </div>

        {/* ONGLET STATS */}
        {activeTab === 'stats' && stats && (
          <div>
            {/* Chiffres clés */}
            <div className="stats-grid">
              {[
                { label: 'Utilisateurs', value: stats.users },
                { label: 'Livres', value: stats.books },
                { label: 'Versets', value: stats.verses.toLocaleString('fr-FR') },
                { label: 'Traductions de mots', value: stats.wordTranslations.toLocaleString('fr-FR') },
                { label: 'Reformulations de versets', value: stats.proposals },
                { label: 'Commentaires', value: stats.comments },
              ].map(stat => (
                <div key={stat.label} style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '20px',
                  textAlign: 'center',
                }}>
                  <div style={{
                    fontFamily: 'Crimson Pro, serif',
                    fontSize: '36px',
                    fontWeight: '300',
                    color: 'var(--gold)',
                    marginBottom: '4px',
                  }}>
                    {stat.value}
                  </div>
                  <div style={{
                    fontFamily: 'DM Mono, monospace',
                    fontSize: '11px',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase' as const,
                    color: 'var(--ink-muted)',
                  }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Répartition des rôles */}
            <div style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '20px',
              marginBottom: '24px',
            }}>
              <div style={{
                fontFamily: 'DM Mono, monospace',
                fontSize: '12px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase' as const,
                color: 'var(--ink-muted)',
                marginBottom: '16px',
              }}>
                Répartition des rôles
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {stats.usersByRole.map(r => {
                  const colors = { bg: getRoleBackground(r.role), color: getRoleColor(r.role), border: getRoleBorder(r.role) }
                  return (
                    <div key={r.role} style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      background: colors.bg,
                      border: `1px solid ${colors.border}`,
                      textAlign: 'center',
                    }}>
                      <div style={{
                        fontFamily: 'Crimson Pro, serif',
                        fontSize: '24px',
                        fontWeight: '300',
                        color: colors.color,
                      }}>
                        {r._count.role}
                      </div>
                      <div style={{
                        fontFamily: 'DM Mono, monospace',
                        fontSize: '11px',
                        letterSpacing: '0.08em',
                        color: colors.color,
                        opacity: 0.8,
                      }}>
                        {r.role}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Nouveaux membres */}
            <div style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '20px',
            }}>
              <div style={{
                fontFamily: 'DM Mono, monospace',
                fontSize: '12px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase' as const,
                color: 'var(--ink-muted)',
                marginBottom: '16px',
              }}>
                Derniers inscrits
              </div>
              {stats.recentUsers.map(u => {
                const colors = { bg: getRoleBackground(u.role), color: getRoleColor(u.role), border: getRoleBorder(u.role) }
                return (
                  <div key={u.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px 0',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'var(--gold)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'DM Mono, monospace',
                      fontSize: '12px',
                      color: 'white',
                      flexShrink: 0,
                    }}>
                      {u.username.substring(0, 2).toUpperCase()}
                    </div>
                    <Link href={`/profile/${u.username}`} style={{
                      fontFamily: 'Spectral, serif',
                      fontSize: '14px',
                      color: 'var(--ink)',
                      flex: 1,
                      textDecoration: 'none',
                    }}>
                      {u.username}
                    </Link>
                    <span style={{
                      fontFamily: 'DM Mono, monospace',
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '20px',
                      background: colors.bg,
                      color: colors.color,
                      border: `1px solid ${colors.border}`,
                    }}>
                      {u.role}
                    </span>
                    <span style={{
                      fontFamily: 'DM Mono, monospace',
                      fontSize: '11px',
                      color: 'var(--ink-faint)',
                    }}>
                      {new Date(u.createdAt).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                )
              })}
            </div>
            {/* Graphique évolution */}
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '10px', padding: '20px', marginTop: '24px', marginBottom: '0' }}>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--ink-muted)', marginBottom: '20px' }}>
                Contributions par mois
              </div>
              {(() => {
                const max = Math.max(...evolution.map(e => e.total), 1)
                return (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '120px', marginBottom: '8px' }}>
                      {evolution.map((e, i) => (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}>
                          {e.total > 0 && (
                            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--ink-muted)' }}>
                              {e.total}
                            </div>
                          )}
                          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                            {/* Commentaires */}
                            <div title={`Commentaires: ${e.comments}`} style={{ width: '100%', height: `${(e.comments / max) * 100}px`, background: 'rgba(42,74,122,0.4)', minHeight: e.comments > 0 ? '2px' : '0' }} />
                            {/* Propositions */}
                            <div title={`Propositions: ${e.proposals}`} style={{ width: '100%', height: `${(e.proposals / max) * 100}px`, background: 'rgba(122,90,26,0.5)', minHeight: e.proposals > 0 ? '2px' : '0' }} />
                            {/* Traductions */}
                            <div title={`Traductions: ${e.wordTranslations}`} style={{ width: '100%', height: `${(e.wordTranslations / max) * 100}px`, background: 'var(--gold)', minHeight: e.wordTranslations > 0 ? '2px' : '0' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Labels */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {evolution.map((e, i) => (
                        <div key={i} style={{ flex: 1, textAlign: 'center', fontFamily: 'DM Mono, monospace', fontSize: '9px', color: 'var(--ink-faint)', overflow: 'hidden' }}>
                          {e.label.split(' ')[0]}
                        </div>
                      ))}
                    </div>
                    {/* Légende */}
                    <div style={{ display: 'flex', gap: '16px', marginTop: '12px', justifyContent: 'center' }}>
                      {[
                        { color: 'var(--gold)', label: 'Traductions' },
                        { color: 'rgba(122,90,26,0.5)', label: 'Reformulations' },
                        { color: 'rgba(42,74,122,0.4)', label: 'Commentaires' },
                      ].map(l => (
                        <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '10px', height: '10px', background: l.color, borderRadius: '2px' }} />
                          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink-muted)' }}>{l.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>
            {/* Dernières activités */}
						<div className="activity-grid">
              {/* Dernières traductions de mots */}
							<div style={{
								background: 'var(--card-bg)',
								border: '1px solid var(--border)',
								borderRadius: '10px',
								padding: '20px',
							}}>
								<div style={{
									fontFamily: 'DM Mono, monospace',
									fontSize: '12px',
									letterSpacing: '0.1em',
									textTransform: 'uppercase' as const,
									color: 'var(--ink-muted)',
									marginBottom: '16px',
								}}>
									Dernières traductions de mots
								</div>
								{stats.recentWordTranslations.map(t => {
									const verse = t.wordToken.verseText.verse
									const url = `/${verse.chapter.book.testament === 'AT' ? 'at' : 'nt'}/${verse.chapter.book.slug}/${verse.chapter.number}?word=${t.wordToken.id}&tab=word#v${verse.number}`
									return (
										<Link key={t.id} href={url} style={{ textDecoration: 'none', display: 'block' }}>
											<div style={{
												padding: '8px 0',
												borderBottom: '1px solid var(--border)',
												cursor: 'pointer',
												transition: 'opacity 0.15s',
											}}
											onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.6'}
											onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
											>
												<div style={{
													display: 'flex',
													justifyContent: 'space-between',
													gap: '8px',
													marginBottom: '2px',
												}}>
													<span style={{
														fontFamily: 'DM Mono, monospace',
														fontSize: '11px',
														color: 'var(--ink-muted)',
														overflow: 'hidden',
														textOverflow: 'ellipsis',
														whiteSpace: 'nowrap',
														minWidth: 0,
													}}>
														{verse.chapter.book.name} {verse.chapter.number}:{verse.number}
													</span>
													<span style={{
														fontFamily: 'DM Mono, monospace',
														fontSize: '11px',
														color: t.isValidated ? 'var(--green-valid)' : 'var(--amber-pending)',
														flexShrink: 0,
													}}>
														{t.isValidated ? 'Validée' : 'Proposée'}
													</span>
												</div>
												<div style={{
													fontFamily: 'Spectral, serif',
													fontSize: '12px',
													fontStyle: 'italic',
													color: 'var(--ink-soft)',
													marginBottom: '2px',
													overflow: 'hidden',
													textOverflow: 'ellipsis',
													whiteSpace: 'nowrap',
												}}>
													{t.wordToken.word} → {t.translation}
												</div>
												<div style={{
													fontFamily: 'DM Mono, monospace',
													fontSize: '11px',
													color: 'var(--ink-faint)',
												}}>
													<span style={{ color: t.creator ? getRoleColor(t.creator.role) : 'var(--ink-muted)' }}>
														@{t.creator?.username || 'anonyme'}
													</span>
													{' · '}{new Date(t.createdAt).toLocaleDateString('fr-FR')}
												</div>
											</div>
										</Link>
									)
								})}
							</div>

							{/* Dernières propositions */}
							<div style={{
								background: 'var(--card-bg)',
								border: '1px solid var(--border)',
								borderRadius: '10px',
								padding: '20px',
							}}>
								<div style={{
									fontFamily: 'DM Mono, monospace',
									fontSize: '12px',
									letterSpacing: '0.1em',
									textTransform: 'uppercase' as const,
									color: 'var(--ink-muted)',
									marginBottom: '16px',
								}}>
									Dernières reformulations de versets
								</div>
								{stats.recentProposals.map(p => {
									const verse = p.translation.verse
									const url = `/${verse.chapter.book.testament === 'AT' ? 'at' : 'nt'}/${verse.chapter.book.slug}/${verse.chapter.number}?verse=${verse.id}&tab=verse#v${verse.number}`
									return (
										<Link key={p.id} href={url} style={{ textDecoration: 'none', display: 'block' }}>
											<div style={{
												padding: '8px 0',
												borderBottom: '1px solid var(--border)',
												cursor: 'pointer',
												transition: 'opacity 0.15s',
											}}
											onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.6'}
											onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
											>
												<div style={{
													display: 'flex',
													justifyContent: 'space-between',
													gap: '8px',
													marginBottom: '2px',
												}}>
													<span style={{
														fontFamily: 'DM Mono, monospace',
														fontSize: '11px',
														color: 'var(--ink-muted)',
														overflow: 'hidden',
														textOverflow: 'ellipsis',
														whiteSpace: 'nowrap',
														minWidth: 0,
													}}>
														{verse.chapter.book.name} {verse.chapter.number}:{verse.number}
													</span>
													<span style={{
														fontFamily: 'DM Mono, monospace',
														fontSize: '11px',
														color: p.status === 'ACCEPTED' ? 'var(--green-valid)' : p.status === 'REJECTED' ? 'var(--red-soft)' : 'var(--amber-pending)',
														flexShrink: 0,
													}}>
														{p.status === 'ACCEPTED' ? 'Acceptée' : p.status === 'REJECTED' ? 'Rejetée' : 'En attente'}
													</span>
												</div>
												<div style={{
													fontFamily: 'Spectral, serif',
													fontSize: '12px',
													fontStyle: 'italic',
													color: 'var(--ink-soft)',
													overflow: 'hidden',
													textOverflow: 'ellipsis',
													whiteSpace: 'nowrap',
													marginBottom: '2px',
												}}>
													{p.proposedText}
												</div>
												<div style={{
													fontFamily: 'DM Mono, monospace',
													fontSize: '11px',
													color: 'var(--ink-faint)',
												}}>
													<span style={{ color: p.creator ? getRoleColor(p.creator.role) : 'var(--ink-muted)' }}>
														@{p.creator?.username || 'anonyme'}
													</span>
													{' · '}{new Date(p.createdAt).toLocaleDateString('fr-FR')}
												</div>
											</div>
										</Link>
									)
								})}
							</div>

							{/* Derniers commentaires */}
							<div style={{
								background: 'var(--card-bg)',
								border: '1px solid var(--border)',
								borderRadius: '10px',
								padding: '20px',
							}}>
								<div style={{
									fontFamily: 'DM Mono, monospace',
									fontSize: '12px',
									letterSpacing: '0.1em',
									textTransform: 'uppercase' as const,
									color: 'var(--ink-muted)',
									marginBottom: '16px',
								}}>
									Derniers commentaires
								</div>
								{stats.recentComments.map(c => {
									const url = c.verse
                    ? `/${c.verse.chapter.book.testament === 'AT' ? 'at' : 'nt'}/${c.verse.chapter.book.slug}/${c.verse.chapter.number}?verse=${c.verse.id}&tab=comments#v${c.verse.number}`
                    : null
									const content = (
										<div style={{
											padding: '8px 0',
											borderBottom: '1px solid var(--border)',
											cursor: url ? 'pointer' : 'default',
											transition: 'opacity 0.15s',
										}}
										onMouseEnter={e => url && ((e.currentTarget as HTMLElement).style.opacity = '0.6')}
										onMouseLeave={e => url && ((e.currentTarget as HTMLElement).style.opacity = '1')}
										>
											{c.verse && (
												<div style={{
													fontFamily: 'DM Mono, monospace',
													fontSize: '11px',
													color: 'var(--ink-muted)',
													marginBottom: '2px',
												}}>
													{c.verse.chapter.book.name} {c.verse.chapter.number}:{c.verse.number}
												</div>
											)}
											<div style={{
												fontFamily: 'Spectral, serif',
												fontSize: '12px',
												color: 'var(--ink-soft)',
												overflow: 'hidden',
												textOverflow: 'ellipsis',
												whiteSpace: 'nowrap',
												marginBottom: '2px',
												pointerEvents: 'none',
											}}>
												<CommentText text={c.text} disableLinks />
											</div>
											<div style={{
												fontFamily: 'DM Mono, monospace',
												fontSize: '11px',
												color: 'var(--ink-faint)',
											}}>
												<span style={{ color: c.creator ? getRoleColor(c.creator.role) : 'var(--ink-muted)' }}>
													@{c.creator?.username || 'anonyme'}
												</span>
												{' · '}{new Date(c.createdAt).toLocaleDateString('fr-FR')}
											</div>
										</div>
									)
									return url ? (
										<Link key={c.id} href={url} style={{ textDecoration: 'none', display: 'block' }}>{content}</Link>
									) : (
										<div key={c.id}>{content}</div>
									)
								})}
							</div>
						</div>
          </div>
        )}

        {/* ONGLET UTILISATEURS */}
        {activeTab === 'users' && (
          <div>
            {/* Filtres */}
            <div style={{
              display: 'flex',
              gap: '12px',
              marginBottom: '20px',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}>
              <div ref={searchRef} style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Rechercher un utilisateur..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setShowSuggestions(true) }}
                  onFocus={() => setShowSuggestions(true)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    background: 'var(--card-bg)',
                    fontFamily: 'Spectral, serif',
                    fontSize: '14px',
                    color: 'var(--ink)',
                    outline: 'none',
                  }}
                />
                {showSuggestions && search.length >= 1 && (
                  <div style={{
                    position: 'absolute',
                    top: '38px',
                    left: 0,
                    right: 0,
                    background: 'var(--card-bg)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    boxShadow: '0 8px 24px rgba(26,22,18,0.1)',
                    zIndex: 100,
                    maxHeight: '200px',
                    overflowY: 'auto',
                  }}>
                    {users
                      .filter(u => u.username.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))
                      .slice(0, 8)
                      .map(u => (
                        <div
                          key={u.id}
                          onClick={() => { setSearch(u.username); setShowSuggestions(false) }}
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            borderBottom: '1px solid var(--border)',
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--parchment)'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                        >
                          <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--parchment-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink-muted)', flexShrink: 0 }}>
                            {u.username.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontFamily: 'Spectral, serif', fontSize: '14px', color: 'var(--ink)' }}>{u.username}</div>
                            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink-faint)' }}>{u.email}</div>
                          </div>
                          <span style={{ marginLeft: 'auto', fontFamily: 'DM Mono, monospace', fontSize: '11px', padding: '2px 6px', borderRadius: '20px', background: getRoleBackground(u.role), color: getRoleColor(u.role), border: `1px solid ${getRoleBorder(u.role)}` }}>
                            {u.role}
                          </span>
                        </div>
                      ))}
                    {users.filter(u => u.username.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())).length === 0 && (
                      <div style={{ padding: '12px', fontFamily: 'Spectral, serif', fontSize: '14px', color: 'var(--ink-faint)', fontStyle: 'italic', textAlign: 'center' }}>
                        Aucun utilisateur trouvé
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {(['ALL', ...ROLES, 'DISABLED'] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setRoleFilter(r)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '20px',
                      border: `1px solid ${roleFilter === r ? 'var(--gold)' : 'var(--border)'}`,
                      background: roleFilter === r ? 'var(--gold-pale)' : 'transparent',
                      fontFamily: 'DM Mono, monospace',
                      fontSize: '11px',
                      color: roleFilter === r ? 'var(--gold)' : 'var(--ink-muted)',
                      cursor: 'pointer',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {r === 'ALL' ? 'Tous' : r}
                  </button>
                ))}
              </div>
              <button
                onClick={exportUsersCSV}
                style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--card-bg)', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink-muted)', cursor: 'pointer', marginLeft: 'auto', flexShrink: 0 }}
              >
                ↓ Exporter CSV ({filteredUsers.length})
              </button>
            </div>

            {/* Liste utilisateurs */}
            <div style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              overflow: 'clip',
            }}>
              {/* Header */}
              <div style={{ overflowX: 'auto' }}><div style={{ minWidth: '960px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 200px 120px 80px 80px 80px 120px 100px',
                padding: '10px 16px',
                background: 'var(--parchment-dark)',
                borderBottom: '1px solid var(--border)',
                fontFamily: 'DM Mono, monospace',
                fontSize: '11px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase' as const,
                color: 'var(--ink-muted)',
              }}>
                <span>Utilisateur</span>
                <span>Email</span>
                <span>Inscription</span>
                <span style={{ textAlign: 'center' }}>Mots.</span>
                <span style={{ textAlign: 'center' }}>Vers.</span>
                <span style={{ textAlign: 'center' }}>Comm.</span>
                <span>Rôle</span>
                <span>Actions</span>
              </div>

              {filteredUsers.length === 0 ? (
                <div style={{
                  padding: '24px',
                  textAlign: 'center',
                  fontFamily: 'Spectral, serif',
                  fontSize: '14px',
                  color: 'var(--ink-faint)',
                  fontStyle: 'italic',
                }}>
                  Aucun utilisateur trouvé.
                </div>
              ) : filteredUsers.map((u, i) => {
                const colors = { bg: getRoleBackground(u.role), color: getRoleColor(u.role), border: getRoleBorder(u.role) }
                const isMe = u.id === user?.id
                return (
                  <div key={u.id} style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 200px 120px 80px 80px 80px 120px 100px',
                    padding: '12px 16px',
                    borderBottom: i < filteredUsers.length - 1 ? '1px solid var(--border)' : 'none',
                    alignItems: 'center',
                    background: isMe ? 'var(--gold-pale)' : 'transparent',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: isMe ? 'var(--gold)' : 'var(--parchment-deep)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'DM Mono, monospace',
                        fontSize: '11px',
                        color: isMe ? 'white' : 'var(--ink-muted)',
                        flexShrink: 0,
                      }}>
                        {u.username.substring(0, 2).toUpperCase()}
                      </div>
                      <span style={{
                        fontFamily: 'Spectral, serif',
                        fontSize: '14px',
                        color: u.isActive ? 'var(--ink)' : 'var(--ink-muted)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '150px',
                        display: 'block',
                      }}>
                        <Link href={`/profile/${u.username}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                          {u.username}
                        </Link>
                        {isMe && (
                          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--gold)', marginLeft: '6px' }}>(vous)</span>
                        )}
                        {!u.isActive && (
                          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--red-soft)', marginLeft: '6px' }}>désactivé</span>
                        )}
                        {u.forcePasswordReset && (
                          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--amber-pending)', marginLeft: '6px' }}>reset mdp</span>
                        )}
                      </span>
                    </div>
                    <span style={{
                      fontFamily: 'DM Mono, monospace',
                      fontSize: '12px',
                      color: 'var(--ink-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {u.email}
                    </span>
                    <span style={{
                      fontFamily: 'DM Mono, monospace',
                      fontSize: '12px',
                      color: 'var(--ink-faint)',
                    }}>
                      {new Date(u.createdAt).toLocaleDateString('fr-FR')}
                    </span>
                    <span style={{
                      fontFamily: 'DM Mono, monospace',
                      fontSize: '12px',
                      color: 'var(--ink-soft)',
                      textAlign: 'center',
                    }}>
                      {u._count.wordTranslations}
                    </span>
                    <span style={{
                      fontFamily: 'DM Mono, monospace',
                      fontSize: '12px',
                      color: 'var(--ink-soft)',
                      textAlign: 'center',
                    }}>
                      {u._count.proposals}
                    </span>
                    <span style={{
                      fontFamily: 'DM Mono, monospace',
                      fontSize: '12px',
                      color: 'var(--ink-soft)',
                      textAlign: 'center',
                    }}>
                      {u._count.comments}
                    </span>
                    <div>
                      {isMe ? (
                        <span style={{
                          fontFamily: 'DM Mono, monospace',
                          fontSize: '11px',
                          padding: '3px 10px',
                          borderRadius: '20px',
                          background: colors.bg,
                          color: colors.color,
                          border: `1px solid ${colors.border}`,
                        }}>
                          {u.role}
                        </span>
                      ) : (
                        <select
                          value={u.role}
                          disabled={updatingRole === u.id}
                          onChange={e => handleRoleChange(u.id, e.target.value)}
                          style={{
                            padding: '3px 6px',
                            border: `1px solid ${colors.border}`,
                            borderRadius: '6px',
                            background: colors.bg,
                            fontFamily: 'DM Mono, monospace',
                            fontSize: '11px',
                            color: colors.color,
                            cursor: 'pointer',
                            outline: 'none',
                            opacity: updatingRole === u.id ? 0.5 : 1,
                          }}
                        >
                          {ROLES.map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      {!isMe && (
                        <>
                          {/* Désactiver / Réactiver */}
                          <button
                            title={u.isActive ? 'Désactiver' : 'Réactiver'}
                            disabled={actionLoading === u.id}
                            onClick={async () => {
                              setActionLoading(u.id)
                              try {
                                if (u.isActive) {
                                  await api.patch(`/api/admin/users/${u.id}/deactivate`)
                                  setUsers(prev => prev.map(x => x.id === u.id ? { ...x, isActive: false } : x))
                                } else {
                                  await api.patch(`/api/admin/users/${u.id}/reactivate`)
                                  setUsers(prev => prev.map(x => x.id === u.id ? { ...x, isActive: true } : x))
                                }
                              } catch (error) { console.error(error) }
                              finally { setActionLoading(null) }
                            }}
                            style={{
                              width: '24px', height: '24px',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              borderRadius: '4px',
                              border: `1px solid ${u.isActive ? 'rgba(122,42,42,0.2)' : 'rgba(45,90,58,0.2)'}`,
                              background: u.isActive ? 'var(--red-light)' : 'var(--green-light)',
                              cursor: 'pointer',
                              fontSize: '12px',
                              color: u.isActive ? 'var(--red-soft)' : 'var(--green-valid)',
                              opacity: actionLoading === u.id ? 0.5 : 1,
                            }}
                          >
                            {u.isActive ? '✕' : '✓'}
                          </button>

                          {/* Forcer reset mdp */}
                          <button
                            title="Forcer réinitialisation mot de passe"
                            disabled={actionLoading === u.id || u.forcePasswordReset}
                            onClick={async () => {
                              setActionLoading(u.id)
                              try {
                                await api.patch(`/api/admin/users/${u.id}/force-reset`)
                                setUsers(prev => prev.map(x => x.id === u.id ? { ...x, forcePasswordReset: true } : x))
                              } catch (error) { console.error(error) }
                              finally { setActionLoading(null) }
                            }}
                            style={{
                              width: '24px', height: '24px',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              borderRadius: '4px',
                              border: '1px solid rgba(122,90,26,0.2)',
                              background: 'var(--amber-light)',
                              cursor: u.forcePasswordReset ? 'not-allowed' : 'pointer',
                              fontSize: '12px',
                              color: 'var(--amber-pending)',
                              opacity: actionLoading === u.id || u.forcePasswordReset ? 0.5 : 1,
                            }}
                          >
                            🔑
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div></div></div>

            <div style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: '12px',
              color: 'var(--ink-faint)',
              marginTop: '12px',
              textAlign: 'right',
            }}>
              {filteredUsers.length} utilisateur{filteredUsers.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}
        {/* ONGLET CONTRIBUTIONS */}
        {activeTab === 'contributions' && (
          <div>
            {/* Filtres */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
              {(['ALL', 'AT', 'NT'] as const).map(t => (
                <button key={t} onClick={() => {
                  setContribTestament(t)
                  setContribBook('')
                  setContribChapter('')
                  setContribVerse('')
                  loadContributions(t, '', '', '')
                }}
                  style={{ padding: '5px 10px', borderRadius: '20px', border: `1px solid ${contribTestament === t ? 'var(--gold)' : 'var(--border)'}`, background: contribTestament === t ? 'var(--gold-pale)' : 'transparent', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: contribTestament === t ? 'var(--gold)' : 'var(--ink-muted)', cursor: 'pointer' }}>
                  {t === 'ALL' ? 'Tout' : t}
                </button>
              ))}

              <select
                value={contribBook}
                onChange={e => {
                  const val = e.target.value
                  setContribBook(val)
                  setContribChapter('')
                  setContribVerse('')
                  loadContributions(contribTestament, val, '', '')
                }}
                style={{ padding: '5px 10px', border: `1px solid ${contribBook ? 'var(--gold)' : 'var(--border)'}`, borderRadius: '6px', background: contribBook ? 'var(--gold-pale)' : 'var(--card-bg)', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: contribBook ? 'var(--gold)' : 'var(--ink-muted)', cursor: 'pointer', outline: 'none' }}
              >
                <option value="">Tous les livres</option>
                {Object.keys(BOOK_NAME_TO_SLUG)
                  .filter(b => contribTestament === 'ALL' || (contribTestament === 'AT' ? Object.keys(BOOK_NAME_TO_SLUG).indexOf(b) < 46 : Object.keys(BOOK_NAME_TO_SLUG).indexOf(b) >= 46))
                  .map(b => <option key={b} value={b}>{b}</option>)}
              </select>

              {contribBook && (
                <input
                  type="number"
                  min={1}
                  placeholder="Chapitre"
                  value={contribChapter}
                  onChange={e => {
                    setContribChapter(e.target.value)
                    setContribVerse('')
                    loadContributions(contribTestament, contribBook, e.target.value, '')
                  }}
                  style={{ width: '80px', padding: '5px 10px', border: `1px solid ${contribChapter ? 'var(--gold)' : 'var(--border)'}`, borderRadius: '6px', background: contribChapter ? 'var(--gold-pale)' : 'var(--card-bg)', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink)', outline: 'none' }}
                />
              )}

              {contribChapter && (
                <input
                  type="number"
                  min={1}
                  placeholder="Verset"
                  value={contribVerse}
                  onChange={e => {
                    setContribVerse(e.target.value)
                    loadContributions(contribTestament, contribBook, contribChapter, e.target.value)
                  }}
                  style={{ width: '80px', padding: '5px 10px', border: `1px solid ${contribVerse ? 'var(--gold)' : 'var(--border)'}`, borderRadius: '6px', background: contribVerse ? 'var(--gold-pale)' : 'var(--card-bg)', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink)', outline: 'none' }}
                />
              )}

              {(contribTestament !== 'ALL' || contribBook) && (
                <button onClick={() => {
                  setContribTestament('ALL')
                  setContribBook('')
                  setContribChapter('')
                  setContribVerse('')
                  setContribData(null)
                }}
                  style={{ padding: '5px 10px', borderRadius: '20px', border: '1px solid rgba(122,42,42,0.2)', background: 'var(--red-light)', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--red-soft)', cursor: 'pointer' }}>
                  ✕ Réinitialiser
                </button>
              )}
              {contribData && (
                <button
                  onClick={exportCSV}
                  style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--card-bg)', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink-muted)', cursor: 'pointer' }}
                >
                  ↓ Exporter CSV ({contribData.wordTranslations.length + contribData.proposals.length + contribData.comments.length})
                </button>
              )}
            </div>

            {contribLoading && (
              <div style={{ fontFamily: 'Spectral, serif', fontSize: '14px', color: 'var(--ink-faint)', fontStyle: 'italic', textAlign: 'center', padding: '24px' }}>
                Chargement...
              </div>
            )}

            {!contribLoading && !contribData && (
              <div style={{ fontFamily: 'Spectral, serif', fontSize: '14px', color: 'var(--ink-faint)', fontStyle: 'italic', textAlign: 'center', padding: '40px' }}>
                Sélectionnez un filtre pour afficher les contributions.
              </div>
            )}

            {contribData && !contribLoading && (
              <div>
                <div className="activity-grid">
                {/* Traductions de mots */}
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '10px', padding: '20px' }}>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--ink-muted)', marginBottom: '16px' }}>
                    Traductions de mots ({contribData.wordTranslations.length})
                  </div>
                  {contribData.wordTranslations.length === 0 ? (
                    <div style={{ fontFamily: 'Spectral, serif', fontSize: '14px', color: 'var(--ink-faint)', fontStyle: 'italic' }}>Aucune.</div>
                  ) : contribData.wordTranslations.map(t => {
                    const verse = t.wordToken.verseText.verse
                    const url = `/${verse.chapter.book.testament === 'AT' ? 'at' : 'nt'}/${verse.chapter.book.slug}/${verse.chapter.number}?word=${t.wordToken.id}&tab=word#v${verse.number}`
                    return (
                      <Link key={t.id} href={url} style={{ textDecoration: 'none', display: 'block' }}>
                        <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'opacity 0.15s' }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.7'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '3px' }}>
                            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                              {verse.chapter.book.name} {verse.chapter.number}:{verse.number} · {t.wordToken.word}
                            </span>
                            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', padding: '1px 6px', borderRadius: '20px', background: t.isValidated ? 'var(--green-light)' : 'var(--amber-light)', color: t.isValidated ? 'var(--green-valid)' : 'var(--amber-pending)', flexShrink: 0 }}>
                              {t.isValidated ? 'Validée' : 'Proposée'}
                            </span>
                          </div>
                          <div style={{ fontFamily: 'Spectral, serif', fontSize: '14px', fontStyle: 'italic', color: 'var(--ink)', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {t.translation}
                          </div>
                          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink-faint)' }}>
                            <span style={{ color: t.creator ? getRoleColor(t.creator.role) : 'var(--ink-muted)' }}>
                              @{t.creator?.username || 'anonyme'}
                            </span>
                            {' · '}{new Date(t.createdAt).toLocaleDateString('fr-FR')}
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>

                {/* Propositions */}
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '10px', padding: '20px' }}>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--ink-muted)', marginBottom: '16px' }}>
                    Reformulations de versets ({contribData.proposals.length})
                  </div>
                  {contribData.proposals.length === 0 ? (
                    <div style={{ fontFamily: 'Spectral, serif', fontSize: '14px', color: 'var(--ink-faint)', fontStyle: 'italic' }}>Aucune.</div>
                  ) : contribData.proposals.map(p => {
                    const verse = p.translation.verse
                    const url = `/${verse.chapter.book.testament === 'AT' ? 'at' : 'nt'}/${verse.chapter.book.slug}/${verse.chapter.number}?verse=${verse.id}&tab=verse#v${verse.number}`
                    return (
                      <Link key={p.id} href={url} style={{ textDecoration: 'none', display: 'block' }}>
                        <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'opacity 0.15s' }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.7'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '3px' }}>
                            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                              {verse.chapter.book.name} {verse.chapter.number}:{verse.number}
                            </span>
                            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', padding: '1px 6px', borderRadius: '20px', background: p.status === 'ACCEPTED' ? 'var(--green-light)' : p.status === 'REJECTED' ? 'var(--red-light)' : 'var(--amber-light)', color: p.status === 'ACCEPTED' ? 'var(--green-valid)' : p.status === 'REJECTED' ? 'var(--red-soft)' : 'var(--amber-pending)', flexShrink: 0 }}>
                              {p.status === 'ACCEPTED' ? 'Acceptée' : p.status === 'REJECTED' ? 'Rejetée' : 'En attente'}
                            </span>
                          </div>
                          <div style={{ fontFamily: 'Spectral, serif', fontSize: '12px', fontStyle: 'italic', color: 'var(--ink-soft)', lineHeight: '1.5', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                            {p.proposedText}
                          </div>
                          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink-faint)' }}>
                            <span style={{ color: p.creator ? getRoleColor(p.creator.role) : 'var(--ink-muted)' }}>
                              @{p.creator?.username || 'anonyme'}
                            </span>
                            {' · '}{new Date(p.createdAt).toLocaleDateString('fr-FR')}
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>

                {/* Commentaires */}
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '10px', padding: '20px' }}>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--ink-muted)', marginBottom: '16px' }}>
                    Commentaires ({contribData.comments.length})
                  </div>
                  {contribData.comments.length === 0 ? (
                    <div style={{ fontFamily: 'Spectral, serif', fontSize: '14px', color: 'var(--ink-faint)', fontStyle: 'italic' }}>Aucun.</div>
                  ) : contribData.comments.map(c => {
                    const url = c.verse ? `/${c.verse.chapter.book.testament === 'AT' ? 'at' : 'nt'}/${c.verse.chapter.book.slug}/${c.verse.chapter.number}?verse=${c.verse.id}&tab=comments#v${c.verse.number}` : null
                    return url ? (
                      <Link key={c.id} href={url} style={{ textDecoration: 'none', display: 'block' }}>
                        <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'opacity 0.15s' }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.7'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}>
                          {c.verse && (
                            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink-muted)', marginBottom: '3px' }}>
                              {c.verse.chapter.book.name} {c.verse.chapter.number}:{c.verse.number}
                            </div>
                          )}
                          <div style={{ fontFamily: 'Spectral, serif', fontSize: '12px', color: 'var(--ink-soft)', lineHeight: '1.5', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, pointerEvents: 'none' }}>
                            <CommentText text={c.text} disableLinks />
                          </div>
                          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink-faint)' }}>
                            <span style={{ color: c.creator ? getRoleColor(c.creator.role) : 'var(--ink-muted)' }}>
                              @{c.creator?.username || 'anonyme'}
                            </span>
                            {' · '}{new Date(c.createdAt).toLocaleDateString('fr-FR')}
                          </div>
                        </div>
                      </Link>
                    ) : <div key={c.id} />
                  })}
                </div>
              </div>
              {/* Historique des traductions */}
              {contribVerse && (
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '10px', padding: '20px', marginTop: '16px' }}>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--ink-muted)', marginBottom: '16px' }}>
                    Historique des traductions — {contribBook} {contribChapter}:{contribVerse}
                  </div>
                  {verseHistoryLoading ? (
                    <div style={{ fontFamily: 'Spectral, serif', fontSize: '14px', color: 'var(--ink-faint)', fontStyle: 'italic' }}>Chargement...</div>
                  ) : verseHistory.length === 0 ? (
                    <div style={{ fontFamily: 'Spectral, serif', fontSize: '14px', color: 'var(--ink-faint)', fontStyle: 'italic' }}>Aucun historique.</div>
                  ) : verseHistory.map(t => (
                    <div key={t.id} style={{ marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
                      {/* Traduction */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: t.isActive ? 'var(--green-light)' : t.isReference ? 'var(--blue-light)' : 'var(--parchment-deep)', color: t.isActive ? 'var(--green-valid)' : t.isReference ? 'var(--blue-sacred)' : 'var(--ink-muted)' }}>
                          {t.isActive ? 'Active' : t.isReference ? 'Référence' : 'Inactive'}
                        </span>
                        {t.source && (
                          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink-faint)' }}>{t.source}</span>
                        )}
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink-faint)', marginLeft: 'auto' }}>
                          {new Date(t.createdAt).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      <div style={{ fontFamily: 'Spectral, serif', fontSize: '14px', fontStyle: 'italic', color: 'var(--ink)', lineHeight: '1.6', marginBottom: t.proposals.length > 0 ? '10px' : '0' }}>
                        {t.textFr}
                      </div>
                      {/* Propositions liées */}
                      {t.proposals.length > 0 && (
                        <div style={{ paddingLeft: '16px', borderLeft: '2px solid var(--border)' }}>
                          {t.proposals.map(p => (
                            <div key={p.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', padding: '1px 6px', borderRadius: '20px', background: p.status === 'ACCEPTED' ? 'var(--green-light)' : p.status === 'REJECTED' ? 'var(--red-light)' : 'var(--amber-light)', color: p.status === 'ACCEPTED' ? 'var(--green-valid)' : p.status === 'REJECTED' ? 'var(--red-soft)' : 'var(--amber-pending)' }}>
                                  {p.status === 'ACCEPTED' ? 'Acceptée' : p.status === 'REJECTED' ? 'Rejetée' : 'En attente'}
                                </span>
                                {p.creator && (
                                  <Link href={`/profile/${p.creator.username}`} style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: getRoleColor(p.creator.role), textDecoration: 'none' }}>
                                    @{p.creator.username}
                                  </Link>
                                )}
                                {p.reviewer && (
                                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink-faint)' }}>
                                    → revu par <Link href={`/profile/${p.reviewer.username}`} style={{ color: getRoleColor(p.reviewer.role), textDecoration: 'none' }}>@{p.reviewer.username}</Link>
                                  </span>
                                )}
                                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink-faint)', marginLeft: 'auto' }}>
                                  {new Date(p.createdAt).toLocaleDateString('fr-FR')}
                                </span>
                              </div>
                              <div style={{ fontFamily: 'Spectral, serif', fontSize: '12px', fontStyle: 'italic', color: 'var(--ink-soft)', lineHeight: '1.5' }}>
                                {p.proposedText}
                              </div>
                              {p.reason && (
                                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--red-soft)', marginTop: '3px' }}>
                                  Raison : {p.reason}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        )}
        {/* ONGLET LOGS */}
        {activeTab === 'logs' && (
          <div>
            {/* Filtres */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Rechercher par utilisateur..."
                value={logSearch}
                onChange={e => { setLogSearch(e.target.value); setLogPage(1) }}
                style={{ flex: 1, minWidth: '200px', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--card-bg)', fontFamily: 'Spectral, serif', fontSize: '14px', color: 'var(--ink)', outline: 'none' }}
              />
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {[
                  { key: 'ADMIN', label: 'Admin' },
                  { key: 'ALL', label: 'Tous' },
                  { key: 'LOGIN', label: 'Connexions' },
                  { key: 'REGISTER', label: 'Inscriptions' },
                  { key: 'PROFILE_CHANGE', label: 'Profil' },
                  { key: 'ACCOUNT_SUSPENDED', label: 'Comptes' },
                  { key: 'ROLE_CHANGE', label: 'Rôles' },
                  { key: 'PASSWORD_CHANGE', label: 'Mdp' },
                  { key: 'CONTRIBUTIONS', label: 'Contributions' },
                ].map(f => (
                  <button key={f.key} onClick={() => { setLogActionFilter(f.key); setLogPage(1) }}
                    style={{ padding: '4px 10px', borderRadius: '20px', border: `1px solid ${logActionFilter === f.key ? 'var(--gold)' : 'var(--border)'}`, background: logActionFilter === f.key ? 'var(--gold-pale)' : 'transparent', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: logActionFilter === f.key ? 'var(--gold)' : 'var(--ink-muted)', cursor: 'pointer' }}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            {(() => {
              const ADMIN_ACTIONS = ['ACCOUNT_SUSPENDED', 'ROLE_CHANGE', 'PASSWORD_CHANGE']
              const filtered = adminLogs.filter(log => {
                const matchSearch = !logSearch || log.user?.username.toLowerCase().includes(logSearch.toLowerCase())
                const matchAction = logActionFilter === 'ALL'
                  ? true
                  : logActionFilter === 'ADMIN'
                  ? ADMIN_ACTIONS.includes(log.action) && !(log.action === 'PASSWORD_CHANGE' && !log.metadata?.forced)
                  : logActionFilter === 'PROFILE_CHANGE'
                  ? ['PASSWORD_CHANGE', 'EMAIL_CHANGE', 'USERNAME_CHANGE'].includes(log.action) && !log.metadata?.forced
                  : logActionFilter === 'CONTRIBUTIONS'
                  ? ['TRANSLATION_ADDED', 'TRANSLATION_VALIDATED', 'TRANSLATION_DELETED', 'PROPOSAL_ADDED', 'PROPOSAL_ACCEPTED', 'PROPOSAL_REJECTED', 'PROPOSAL_DELETED', 'COMMENT_ADDED', 'COMMENT_DELETED'].includes(log.action)
                  : log.action === logActionFilter
                return matchSearch && matchAction
              })

              const totalPages = Math.ceil(filtered.length / LOG_PAGE_SIZE)
              const paged = filtered.slice((logPage - 1) * LOG_PAGE_SIZE, logPage * LOG_PAGE_SIZE)

              return (
                <>
                  <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                    <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--ink-muted)' }}>
                        {filtered.length} entrée{filtered.length !== 1 ? 's' : ''}
                      </span>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink-faint)' }}>
                          Page {logPage} / {Math.max(totalPages, 1)}
                        </span>
                        <button
                          onClick={async () => {
                            try {
                              const logsRes = await api.get('/api/admin/logs')
                              setAdminLogs(logsRes.data)
                            } catch (e) { console.error(e) }
                          }}
                          style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'transparent', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink-muted)', cursor: 'pointer' }}
                        >
                          ↻ Rafraîchir
                        </button>
                      </div>
                    </div>

                    {paged.length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', fontFamily: 'Spectral, serif', fontSize: '14px', color: 'var(--ink-faint)', fontStyle: 'italic' }}>
                        Aucun log trouvé.
                      </div>
                    ) : paged.map((log, i) => {
                      const actionLabel = 
                        log.action === 'ACCOUNT_SUSPENDED' && log.metadata?.action === 'REACTIVATED' ? 'Compte réactivé'
                        : log.action === 'ACCOUNT_SUSPENDED' ? 'Compte désactivé'
                        : log.action === 'ROLE_CHANGE' ? 'Changement de rôle'
                        : log.action === 'PASSWORD_CHANGE' && log.metadata?.forced === 'true' ? 'Reset mdp forcé'
                        : log.action === 'PASSWORD_CHANGE' ? 'Mdp modifié'
                        : log.action === 'EMAIL_CHANGE' ? 'Email modifié'
                        : log.action === 'USERNAME_CHANGE' ? 'Pseudo modifié'
                        : log.action === 'LOGIN' ? 'Connexion'
                        : log.action === 'LOGOUT' ? 'Déconnexion'
                        : log.action === 'REGISTER' ? 'Inscription'
                        : log.action === 'TRANSLATION_ADDED' ? 'Trad. mot ajoutée'
                        : log.action === 'TRANSLATION_VALIDATED' ? 'Trad. mot validée'
                        : log.action === 'TRANSLATION_DELETED' ? 'Trad. mot supprimée'
                        : log.action === 'PROPOSAL_ADDED' ? 'Ref. verset ajoutée'
                        : log.action === 'PROPOSAL_ACCEPTED' ? 'Ref. verset acceptée'
                        : log.action === 'PROPOSAL_REJECTED' ? 'Ref. verset rejetée'
                        : log.action === 'PROPOSAL_DELETED' ? 'Ref. verset supprimée'
                        : log.action === 'COMMENT_ADDED' ? 'Commentaire ajouté'
                        : log.action === 'COMMENT_DELETED' ? 'Commentaire supprimé'
                        : log.action

                      const colors = 
                        log.action === 'ACCOUNT_SUSPENDED' ? { bg: 'var(--red-light)', color: 'var(--red-soft)' }
                        : log.action === 'ROLE_CHANGE' ? { bg: 'var(--blue-light)', color: 'var(--blue-sacred)' }
                        : log.action === 'LOGIN' || log.action === 'REGISTER' ? { bg: 'var(--green-light)', color: 'var(--green-valid)' }
                        : log.action === 'LOGOUT' ? { bg: 'var(--parchment-deep)', color: 'var(--ink-muted)' }
                        : ['TRANSLATION_ADDED', 'PROPOSAL_ADDED', 'COMMENT_ADDED'].includes(log.action) ? { bg: 'var(--green-light)', color: 'var(--green-valid)' }
                        : ['TRANSLATION_DELETED', 'PROPOSAL_DELETED', 'COMMENT_DELETED', 'PROPOSAL_REJECTED'].includes(log.action) ? { bg: 'var(--red-light)', color: 'var(--red-soft)' }
                        : ['TRANSLATION_VALIDATED', 'PROPOSAL_ACCEPTED'].includes(log.action) ? { bg: 'var(--blue-light)', color: 'var(--blue-sacred)' }
                        : { bg: 'var(--amber-light)', color: 'var(--amber-pending)' }

                      return (
                        <div key={log.id} className="log-row">
                          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: colors.bg, color: colors.color, textAlign: 'center', whiteSpace: 'nowrap' as const, display: 'inline-block' }}>
                            {actionLabel}
                          </span>
                          <div className="log-row-meta">
                            {log.user ? (
                              <Link href={`/profile/${log.user.username}`} style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: getRoleColor(log.user.role), textDecoration: 'none' }}>
                                @{log.user.username}
                              </Link>
                            ) : (
                              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: 'var(--ink-faint)' }}>compte supprimé</span>
                            )}
                          </div>
                          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {log.metadata && Object.keys(log.metadata).filter(k => !['forced', 'by', 'action'].includes(k)).length > 0
                              ? Object.entries(log.metadata).filter(([k]) => !['forced', 'by', 'action'].includes(k)).map(([k, v]) => `${k} : ${v}`).join(' · ')
                              : log.user ? `@${log.user.username}` : ''}
                          </div>
                          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink-faint)', textAlign: 'right' }}>
                            {new Date(log.createdAt).toLocaleDateString('fr-FR')} {new Date(log.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '16px', alignItems: 'center' }}>
                      <button
                        onClick={() => setLogPage(p => Math.max(1, p - 1))}
                        disabled={logPage === 1}
                        style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', fontFamily: 'DM Mono, monospace', fontSize: '12px', color: logPage === 1 ? 'var(--ink-faint)' : 'var(--ink-muted)', cursor: logPage === 1 ? 'not-allowed' : 'pointer' }}
                      >
                        ← Précédent
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || Math.abs(p - logPage) <= 2).map((p, idx, arr) => (
                        <React.Fragment key={p}>
                          {idx > 0 && arr[idx - 1] !== p - 1 && (
                            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: 'var(--ink-faint)' }}>...</span>
                          )}
                          <button
                            onClick={() => setLogPage(p)}
                            style={{ padding: '6px 10px', borderRadius: '6px', border: `1px solid ${logPage === p ? 'var(--gold)' : 'var(--border)'}`, background: logPage === p ? 'var(--gold-pale)' : 'transparent', fontFamily: 'DM Mono, monospace', fontSize: '12px', color: logPage === p ? 'var(--gold)' : 'var(--ink-muted)', cursor: 'pointer' }}
                          >
                            {p}
                          </button>
                        </ React.Fragment>
                      ))}
                      <button
                        onClick={() => setLogPage(p => Math.min(totalPages, p + 1))}
                        disabled={logPage === totalPages}
                        style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', fontFamily: 'DM Mono, monospace', fontSize: '12px', color: logPage === totalPages ? 'var(--ink-faint)' : 'var(--ink-muted)', cursor: logPage === totalPages ? 'not-allowed' : 'pointer' }}
                      >
                        Suivant →
                      </button>
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}